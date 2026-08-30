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

  it("no test asks the kernel for one instead", () => {
    /**
     * The guard, and the reason it is a grep rather than a type: `port: 0` is
     * a perfectly ordinary thing to write, it reads as "you pick", and it is
     * wrong here for a reason nothing in the call site suggests. Seventy-five
     * of them were converted at once; one written tomorrow would put the
     * family back and look completely reasonable doing it.
     */
    /**
     * `git grep` exits 1 when it finds NOTHING, which here is the pass — so a
     * bare `execFileSync` throws on success. The first version of this guard
     * did exactly that and failed green, which would have been the fifth
     * instrument this week to report the opposite of the truth.
     */
    let found = "";
    try {
      found = execFileSync(
        "git",
        // Pathspecs, and NOT `packages/*/test` — which matches nothing here and
        // made this guard pass on a file that had `port: 0` in it. Found by
        // mutation-testing the guard; a pathspec that quietly matches no files
        // is a search that always succeeds.
        ["grep", "-n", "--", "port: 0", "--", "packages", "test", ":!*/src/*"],
        { cwd: repo, encoding: "utf8" },
      ).trim();
    } catch (err) {
      const status = (err as { status?: number }).status;
      // 1 is "no matches". Anything else is git failing, which must not read
      // as a clean tree.
      if (status !== 1) throw err;
    }
    expect(found, "use `port: await reservePort()` — see test/ports.ts").toBe("");
  }, 30_000);
});
