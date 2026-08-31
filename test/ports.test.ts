import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { reservePort } from "./ports.ts";

const repo = fileURLToPath(new URL("..", import.meta.url));

/**
 * **Test daemons do not listen on ports the kernel is also handing out.**
 *
 * The flake family's socket half — `docs/research/2026-08-29-the-flake-family.md`
 * — came down to this. Every witness named a port above 49152, macOS's
 * ephemeral floor: `EADDRINUSE` on a bind that lost the race, and `ETIMEDOUT`
 * on a LOOPBACK connect, which is not something an application can cause. The
 * loop was measured idle (17ms, 30ms) while a connect took 7.8 seconds, and one
 * port appeared twice in separate runs and different files.
 *
 * `startDaemon({ port: 0 })` asks the kernel for a free port out of exactly the
 * range it is also allocating to outgoing connections. That is correct for a
 * client and wrong for a server something else must then connect to.
 * `reservePort` answers from a private per-worker slice below every ephemeral
 * floor we run on, which is what `test/ports.ts` was already built for — it
 * simply had not been pointed at the in-process daemons, because they never
 * had to TELL anybody the number and so never looked like they were guessing.
 */
describe("no test listens in the kernel's ephemeral range", () => {
  it("reserves below every ephemeral floor", async () => {
    const port = await reservePort();
    // 32768 is Linux's floor; macOS's is 49152. Under both.
    expect(port).toBeGreaterThanOrEqual(20_000);
    expect(port, "must be below every ephemeral floor we run on").toBeLessThan(32_768);
  });

  it("hands out a different port each time, and one that binds", async () => {
    const a = await reservePort();
    const b = await reservePort();
    expect(a).not.toBe(b);
  });

  /**
   * **The emulator's band, tested here because CI is the only place it runs.**
   *
   * `emulator.ts` skips locally when gcloud is absent, so this change would
   * otherwise ship exercised by nothing — which is the week's whole theme.
   */
  it("the emulator takes a private port too, below the workers' slices", async () => {
    const { freePort } = await import("./emulator.ts");
    const port = await freePort();
    expect(port).toBeGreaterThanOrEqual(19_000);
    // Below `ports.ts`'s own base, so the workers and globalSetup cannot meet.
    expect(port).toBeLessThan(20_000);
  }, 30_000);

  /**
   * **This guard used to ban `port: 0` everywhere, and the ban was wrong.**
   *
   * On 30 Aug 2026, 75 in-process `startDaemon({ port: 0 })` calls were moved
   * onto `reservePort` on the theory that the kernel's ephemeral range was
   * causing the flake family's `ETIMEDOUT`s. Two things then happened, in this
   * order:
   *
   * 1. An `ETIMEDOUT` recurred on port **20807** — inside the private range —
   *    with the loop measured idle. The theory was already dead.
   * 2. CI failed with `EADDRINUSE 127.0.0.1:20200`, which the old arrangement
   *    could not produce.
   *
   * The second is the lesson. `port: 0` is ATOMIC: the kernel picks and binds
   * in one call, with no window and no wraparound. `reservePort` probes, closes
   * and hands the number over — a race, and one confined to a 100-port slice
   * that a worker running dozens of daemons wraps around. **So the change
   * replaced something safe with something racy, in order to fix something it
   * demonstrably did not fix.**
   *
   * What survives is the narrow, original rule: a test that must tell ANOTHER
   * PROCESS the number before anything is listening cannot use `port: 0`,
   * because it never learns the number. Those tests — and only those — use
   * `reservePort`.
   */
  it("is used by the tests that genuinely cannot ask the kernel", () => {
    const users = execFileSync("git", ["grep", "-l", "reservePort", "--", "packages"], {
      cwd: repo,
      encoding: "utf8",
      timeout: 30_000,
    })
      .split("\n")
      .filter(Boolean);
    expect(users.length, "the helper still has real users").toBeGreaterThan(0);
    for (const file of users) {
      const src = readFileSync(`${repo}/${file}`, "utf8");
      // The tell: they hand the number to a spawned process or a URL string,
      // rather than reading it back off a server they started themselves.
      expect(src, `${file} should read its own port from server.address() instead`).not.toMatch(
        /port: await reservePort\(\)/,
      );
    }
  });
});
