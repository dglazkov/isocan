import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
import { describe, expect, it } from "vitest";

/**
 * **A SYN that goes nowhere now costs a second, not eight** — the flake
 * family's fix (`docs/research/2026-08-29-the-flake-family.md`), proved the
 * way the mechanism was: a listener whose accept queue is full drops or
 * parks the next SYN, and the kernel's retransmit ladder used to hold the
 * connect for ~7.8 s, past every budget. `test/setup.ts`'s fetch now bounds
 * the CONNECT alone (undici's `UND_ERR_CONNECT_TIMEOUT`, which by
 * construction means nothing was written) and retries inside its budget.
 *
 * The listener here is a child that listens with a backlog of one and is
 * then STOPPED, so the kernel completes the handshakes it can and the rest
 * wait or drop — the seventh witness's shape (`incqlen 1`), made on demand.
 * What is asserted is the property that matters to a test suite: giving up
 * takes about the budget, with more than one attempt, and says why.
 */
async function stoppedListener(): Promise<{ child: ChildProcess; port: number }> {
  const child = spawn(process.execPath, [
    "-e",
    "const s=require('net').createServer();s.listen(0,'127.0.0.1',1,()=>{console.log(s.address().port);});",
  ]);
  const port = await new Promise<number>((resolve, reject) => {
    child.stdout!.once("data", (chunk: Buffer) => resolve(Number(String(chunk).trim())));
    child.once("exit", () => reject(new Error("the listener died before saying its port")));
  });
  child.kill("SIGSTOP");
  return { child, port };
}

/** Fill the stopped listener's queue: connects the kernel completes without
 *  the process ever accepting. Each is left open so its slot stays taken. */
function occupy(port: number, n: number): net.Socket[] {
  return Array.from({ length: n }, () => {
    const socket = net.connect({ port, host: "127.0.0.1" });
    socket.on("error", () => {});
    return socket;
  });
}

const darwinOrLinux = process.platform === "darwin" || process.platform === "linux";

describe.skipIf(!darwinOrLinux)("the connect deadline", () => {
  it("gives up on a full accept queue in about the budget, after more than one attempt, and says so", async () => {
    const { child, port } = await stoppedListener();
    const held = occupy(port, 16);
    // Let the kernel finish what it will finish before the SYN that matters.
    await new Promise((r) => setTimeout(r, 300));
    const started = Date.now();
    let failure: Error | null = null;
    try {
      await fetch(`http://127.0.0.1:${port}/api/door`, { method: "POST" });
    } catch (err) {
      failure = err as Error;
    } finally {
      for (const socket of held) socket.destroy();
      child.kill("SIGCONT");
      child.kill("SIGKILL");
    }
    const took = Date.now() - started;
    // A connect that was queued or dropped either times out at the deadline
    // (the fix at work) or, on a kernel that completed it anyway, hangs on a
    // stopped process until the suite's own timeout — so the assertion below
    // is the only shape a passing run can have.
    expect(failure, "a stopped listener with a full queue cannot answer").not.toBeNull();
    expect(failure!.message).toMatch(/UND_ERR_CONNECT_TIMEOUT|ETIMEDOUT|ECONNRESET|ECONNREFUSED/);
    expect(took, "the retransmit ladder's eight seconds are gone").toBeLessThan(6_500);
    if (/UND_ERR_CONNECT_TIMEOUT/.test(failure!.message)) {
      expect(failure!.message).toMatch(/and [2-9] attempts/);
      expect(failure!.message).toContain("budget 3000ms");
    }
  }, 20_000);
});
