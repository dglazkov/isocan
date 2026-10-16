import type { ChildProcess } from "node:child_process";

/**
 * **The gathering half of `cli.ts`**, in a module of its own so it can be
 * tested without the binary: `cli.ts` re-exports it, and every test keeps
 * importing `collect` from there.
 */

export interface Run {
  code: number;
  stdout: string;
  stderr: string;
}

/**
 * **Everything a child printed, and how it ended.**
 *
 * `setEncoding` on both streams, always. `stdout += chunk` on a raw stream
 * decodes each buffer on its own, so a UTF-8 character that straddles a chunk
 * boundary lands as two broken halves; the encoding puts a `StringDecoder` in
 * the way, which holds a partial character back until the rest arrives.
 * `agent-help.test.ts` failed exactly so on CI and never on a laptop — where
 * the OS splits a stream depends on how loaded the machine is — with one
 * em-dash of the guide mangled and every other intact.
 *
 * A child killed by a signal has no exit code; it reads as 1 here, never 0,
 * so a timeout cannot pass for success. A spawn that fails rejects rather than
 * leaving the test waiting for a `close` that will not come. `timeoutMs`
 * kills a child still running then, and says so on its stderr — for the tests
 * that would rather fail with what the child printed than on vitest's
 * anonymous deadline.
 *
 * **Call it when you spawn, not when you want the answer.** A child that has
 * already exited has said everything it will say to nobody: node resumes the
 * pipes nobody was reading when the child exits, so the output is discarded,
 * and `close` has fired or is about to with no listener to hear it. Waiting
 * for it was a hang with no name. `goodnight.test.ts` and `explain.test.ts`
 * each spawned a parked `isocan wait`, did the act that woke it, and only then
 * called this — and on a loaded CI runner the woken park exited before the
 * acting command had, so the test sat until vitest's deadline (120 s and
 * 30 s, on eight of the nine release runs from dbd408b32 to b094cd436, 14 Oct
 * 2026). So a child that has exited is refused here, at once and by name;
 * the shape that works is `const run = collect(spawnCli(…))`, then
 * `await run` later.
 */
export function collect(child: ChildProcess, timeoutMs?: number): Promise<Run> {
  if (child.exitCode !== null || child.signalCode !== null) {
    const how = child.exitCode !== null ? `exit ${child.exitCode}` : child.signalCode;
    return Promise.reject(
      new Error(
        `collect() was handed a child that had already exited (${how}): its output went to nobody ` +
          "and its close has come and gone. Collect when you spawn — `const run = collect(spawnCli(…))` — and await the run later.",
      ),
    );
  }
  let stdout = "";
  let stderr = "";
  child.stdout?.setEncoding("utf8");
  child.stdout?.on("data", (chunk: string) => (stdout += chunk));
  child.stderr?.setEncoding("utf8");
  child.stderr?.on("data", (chunk: string) => (stderr += chunk));
  const timer =
    timeoutMs === undefined
      ? undefined
      : setTimeout(() => {
          stderr += `\n(killed: still running after ${timeoutMs} ms)`;
          child.kill("SIGKILL");
        }, timeoutMs);
  timer?.unref();
  return new Promise((resolve, reject) => {
    child.once("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}
