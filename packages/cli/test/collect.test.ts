import { describe, expect, it } from "vitest";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { collect } from "./collect.ts";

/**
 * **A listener attached after the event it waits for never hears it.**
 *
 * `collect` resolves on the child's `close`. Called after the child has
 * exited, there is no `close` left to come — node already resumed the pipes
 * nobody was reading and threw the output away — so it used to wait forever,
 * and the failure arrived as vitest's anonymous deadline: `goodnight.test.ts`
 * at 120 s and `explain.test.ts` at 30 s, on CI, whenever a woken
 * `isocan wait` exited before the command that woke it had. These hold both
 * halves: collecting at spawn hears everything, however soon the child
 * exits; collecting late is refused at once, by name.
 */
const quick = (script: string) => spawn(process.execPath, ["-e", script], { stdio: ["ignore", "pipe", "pipe"] });

describe("collect", () => {
  it("hears a child that exits at once, when it is collected at spawn", async () => {
    const run = collect(quick("process.stdout.write('woke'); process.stderr.write('bye'); process.exitCode = 2"));
    expect(await run).toEqual({ code: 2, stdout: "woke", stderr: "bye" });
  });

  // Two faces of one shape. Collected after `close`, the old helper waited
  // forever (CI's face); after `exit` but before `close`, it answered with the
  // output already thrown away — `stdout: ""` from a child that printed.
  it.each(["close", "exit"] as const)("refuses a child that has already exited (collected after its %s)", async (event) => {
    const child = quick("process.stdout.write('woke')");
    await once(child, event);
    const late = collect(child);
    // Raced against a deadline so the hang fails here with a reason instead
    // of on the suite's timeout.
    const outcome = await Promise.race([
      late.then((run) => `resolved with stdout ${JSON.stringify(run.stdout)}`, (error: Error) => error.message),
      new Promise<string>((resolve) => setTimeout(() => resolve("still waiting after 5 s"), 5_000).unref()),
    ]);
    expect(outcome).toMatch(/already exited \(exit 0\).*Collect when you spawn/);
  });
});
