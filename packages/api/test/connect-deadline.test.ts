import { spawn, type ChildProcess } from "node:child_process";
import { promises as fs } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { DaemonClient, platformFetch } from "../src/index.ts";

/**
 * **The product half of the flake family's connect deadline**
 * (`docs/research/2026-08-29-the-flake-family.md`).
 *
 * The suite's own fetch got a connect deadline on 3 Sep, and on 12 Sep the
 * family turned up in a SPAWNED `isocan rc` instead — eight seconds on a
 * loopback connect, where the CLI had no deadline and one attempt. What a
 * person typing a command got out of that was `error: fetch failed`.
 *
 * These are the three claims that decision rests on, each asserted against
 * the real client rather than against a copy of its logic:
 *
 * 1. on this machine, a connect that goes nowhere costs about the budget and
 *    more than one attempt, and says which daemon it could not reach;
 * 2. a connect that becomes possible DURING the budget lands — the recovery
 *    that is the whole point, and the half a faster failure would not buy;
 * 3. a remote base is left exactly as it was, because a deadline that is
 *    generous here would refuse a slow link that was working.
 *
 * The listener is a child that listens with a backlog of one and is then
 * STOPPED, so the kernel completes the handshakes it can and the rest wait or
 * drop — the seventh witness's shape, made on demand. It is the same rig as
 * `test/connect-deadline.test.ts`, which asserts the same property for the
 * suite's client; this file is about the product's.
 *
 * **Why the third claim is the one that can fail, and the trap it closes.**
 * Inside this suite `globalThis.fetch` IS the bounded, retrying one —
 * `test/setup.ts` replaced it — so a product path that had no deadline of its
 * own would still be fast here, and a duration alone cannot tell the two
 * apart. Reverting the client's override and running this file proves the
 * decomposition: the first claim survives only on its SENTENCE, which nothing
 * but the product's own fetch writes, and the third fails outright. So the
 * first two say what the bounded fetch does, and the third says the product
 * is the thing using it.
 */

const spawned: ChildProcess[] = [];
const opened: net.Socket[] = [];
const homes: string[] = [];

afterEach(async () => {
  for (const socket of opened.splice(0)) socket.destroy();
  for (const child of spawned.splice(0)) {
    child.kill("SIGCONT");
    child.kill("SIGKILL");
  }
  // `maxRetries` because a daemon-shaped test can still be writing into the
  // directory as it goes (test/teardown.test.ts holds this at every call site).
  for (const home of homes.splice(0)) {
    await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

/** A real HTTP listener with a backlog of one, stopped before it can accept. */
async function stoppedDaemon(): Promise<number> {
  const child = spawn(process.execPath, [
    "-e",
    "const h=require('http').createServer((q,s)=>{s.setHeader('content-type','application/json');s.end('{}')});" +
      "h.listen(0,'127.0.0.1',1,()=>console.log(h.address().port));",
  ]);
  spawned.push(child);
  const port = await new Promise<number>((resolve, reject) => {
    child.stdout!.once("data", (chunk: Buffer) => resolve(Number(String(chunk).trim())));
    child.once("exit", () => reject(new Error("the listener died before saying its port")));
  });
  child.kill("SIGSTOP");
  return port;
}

/** Fill the stopped listener's queue: connects the kernel completes without
 *  the process ever accepting. Each is left open so its slot stays taken. */
function occupy(port: number, n: number): void {
  for (let i = 0; i < n; i++) {
    const socket = net.connect({ port, host: "127.0.0.1" });
    socket.on("error", () => {});
    opened.push(socket);
  }
}

async function tempHome(): Promise<string> {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-connect-"));
  homes.push(home);
  return home;
}

const darwinOrLinux = process.platform === "darwin" || process.platform === "linux";

describe.skipIf(!darwinOrLinux)("the CLI's connect deadline", () => {
  it("gives up on an unreachable daemon inside the budget, after more than one attempt, naming it", async () => {
    const port = await stoppedDaemon();
    occupy(port, 16);
    // Let the kernel finish what it will finish before the SYN that matters.
    await new Promise((r) => setTimeout(r, 300));
    const client = new DaemonClient(`http://127.0.0.1:${port}`, await tempHome());
    const started = Date.now();
    let failure: Error | null = null;
    try {
      await client.claimActor({ type: "actor.claim", sessionKey: "k", as: "act_x" });
    } catch (err) {
      failure = err as Error;
    }
    const took = Date.now() - started;

    expect(failure, "a stopped listener with a full queue cannot answer").not.toBeNull();
    // The kernel's retransmit ladder, measured at ~7.8s on loopback, is what
    // this replaces. A run where the kernel completed the handshake anyway
    // has no connect to bound and is covered by the shape of the assertions
    // below, not by a looser number here.
    expect(took, "the retransmit ladder's eight seconds are gone").toBeLessThan(6_500);
    if (/UND_ERR_CONNECT_TIMEOUT/.test(failure!.message)) {
      // The sentence that replaces `fetch failed`: which daemon, what
      // happened to the connection, and that it was tried more than once.
      expect(failure!.message).toContain(`could not reach the daemon at http://127.0.0.1:${port}`);
      expect(failure!.message).toContain("the connection was never made");
      expect(failure!.message).toMatch(/[2-9] attempts/);
      // Why a person may re-run the command without wondering: the licence
      // the whole retry rests on, said out loud.
      expect(failure!.message).toContain("Nothing was sent");
    }
  }, 20_000);

  it("lands the request when the connect becomes possible inside the budget", async () => {
    const port = await stoppedDaemon();
    occupy(port, 16);
    await new Promise((r) => setTimeout(r, 300));
    const client = new DaemonClient(`http://127.0.0.1:${port}`, await tempHome());
    // Release the listener mid-budget: the first attempt's SYN is lost, the
    // second lands. Today this request fails outright at ~7.8s.
    setTimeout(() => {
      for (const socket of opened.splice(0)) socket.destroy();
      for (const child of spawned) child.kill("SIGCONT");
    }, 1_200);
    const started = Date.now();
    await client.claimActor({ type: "actor.claim", sessionKey: "k", as: "act_x" });
    expect(Date.now() - started, "a retried connect answers in about the release").toBeLessThan(6_500);
  }, 20_000);

  it("leaves a remote home on the platform's own fetch", async () => {
    // The address decides, not the class: the same `DaemonClient` bounds a
    // connect to this machine and does not bound one over a network, because
    // a remote handshake is an ordinary RTT away and seconds on a bad link.
    // Asserted structurally rather than by timing a real slow link, which is
    // the one thing a test cannot stage honestly.
    const home = await tempHome();
    const reach = (client: DaemonClient) =>
      (client as unknown as { fetcher: typeof fetch }).fetcher;
    expect(reach(new DaemonClient("https://isocan.io", home))).toBe(platformFetch);
    expect(reach(new DaemonClient("http://127.0.0.1:4441", home))).not.toBe(platformFetch);
    expect(reach(new DaemonClient("http://localhost:4441", home))).not.toBe(platformFetch);
  });
});
