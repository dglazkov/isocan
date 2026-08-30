import net from "node:net";

/**
 * A port for a test that has to tell somebody else the number.
 *
 * Most tests here let the OS choose (`listen(0)`) and never learn the number,
 * which is safe because the socket is never let go. These are the other kind:
 * they spawn a daemon in another process, so the port has to be decided
 * BEFORE anything is listening on it, and there is a window between deciding
 * and binding.
 *
 * `listen(0) → read the port → close → hand it out` is the usual way to do
 * that and it is a guess: the number was free a moment ago. It is also a
 * guess that reaches across the run, because `stopDaemons` kills whoever
 * answers on the port it was given — a collision would not fail the test that
 * caused it, it would kill another worker's daemon and fail an unrelated file.
 *
 * Measured before replacing it, because the fix should follow the diagnosis:
 * 13 processes taking 300 ephemeral ports each, as fast as they could, produced
 * ZERO cross-process duplicates — the kernel hands them out from one rotating
 * counter, so the window is real but very rarely hit.
 *
 * **That measurement said this was rare, and it was read as saying it does not
 * happen.** It has now happened. On 2026-08-29 the suite was run six times over
 * and the fifth failed `packages/cli/test/upgrade-notice.test.ts` twice —
 * `listen EADDRINUSE 127.0.0.1:64787` and `:49177`, both above macOS's 49152
 * floor — in a file that had kept a local copy of the guess. The reason the
 * measurement missed it is worth keeping: it counted duplicates handed out
 * WITHIN the run, and the collision was with a process outside it. Ephemeral
 * ports are shared with the whole machine, so no experiment confined to the
 * suite can bound this. So it IS a fix for an observed failure, and the cost is
 * still one bind attempt.
 *
 * Each vitest worker gets its own slice of a private range, so two workers
 * CANNOT be handed the same number. The range sits below 32768, under the
 * ephemeral floor on Linux (32768) as well as macOS (49152), so nothing the
 * OS assigns can land in it either — which is the half that actually mattered
 * above, and the half a `listen(0)` guess cannot have.
 *
 * Use this rather than a local `listen(0) → read → close`, and if you find one
 * of those, move it. Three CLI test files had kept their own until the day
 * above, which is how one of them was still able to lose this race.
 *
 * `test/emulator.ts` still cannot use this — it runs in globalSetup, before
 * any worker exists, so there is no `VITEST_POOL_ID` to slice by — but it no
 * longer asks the kernel either. It scans its own band at 19000, below this
 * one, for the same reason: **nothing this suite listens on may sit in the
 * range the OS is handing to outgoing connections.** That was the whole of the
 * flake family's socket half.
 */

const FIRST = 20_000;
const SLICE = 100;
const SLOTS = 120; // 20000..32000, below every ephemeral floor we run on

const worker = Number(process.env.VITEST_POOL_ID ?? "1");
const base = FIRST + ((worker - 1) % SLOTS) * SLICE;
let offset = 0;

/** Can we actually bind it? A number in our slice can still be held by
 * something outside this run — a stray daemon, somebody's dev server. */
function bindable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once("error", () => resolve(false));
    probe.listen(port, "127.0.0.1", () => probe.close(() => resolve(true)));
  });
}

/** A port in this worker's slice that nothing is on. */
export async function reservePort(): Promise<number> {
  for (let tried = 0; tried < SLICE; tried += 1) {
    const port = base + (offset++ % SLICE);
    if (await bindable(port)) return port;
  }
  throw new Error(
    `no free port in ${base}..${base + SLICE - 1} (vitest worker ${worker}) — ` +
      "something outside this run is holding the whole slice",
  );
}
