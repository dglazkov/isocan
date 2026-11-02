/**
 * **A relay that has caught up with its home — the END of replication, not
 * its first step.**
 *
 * Redeeming a pass at a relay starts replication fire-and-forget
 * (`home-link.ts` `redeemPass` → `void this.sync()`), and nothing announces
 * that it finished: the sweep dials, the socket answers a cursor of 0 with a
 * snapshot, the engine adopts it. Three design tests waited on that with
 * `expect.poll(() => relay.store.canvasExists(id)).toBe(true)`, which had two
 * defects at once:
 *
 * - **The deadline was nobody's.** `expect.poll` gives up after vitest's
 *   default of one second. Adoption on an idle laptop takes milliseconds; on
 *   a loaded one, inside `npm run test:deep` beside hundreds of other
 *   daemons, it took longer, and the test failed with "Matcher did not
 *   succeed in time" (reproduced by holding adoption open for 1.5s in the
 *   engine). The replication tests already had the rule —
 *   `home-link.test.ts`: "every cross-daemon assertion polls", with a named
 *   deadline and a message — and these three had not inherited it.
 * - **"The canvas file exists" is the middle of adoption, not its end.** The
 *   meta file lands in `saveSnapshot`; the runtime and the relay's own grant
 *   row come after. Waiting for the relay to hold the home's `lastSeq` is
 *   waiting for what the tests go on to rely on: a replica that understands
 *   the current state.
 */
export interface ReplicaWaiter {
  store: { canvasExists(id: string): Promise<boolean> };
  engine: { getSnapshot(id: string): Promise<{ lastSeq: number }> };
}

/** The replication deadline `home-link.test.ts` uses, for the same reason. */
const REPLICATION_MS = 10_000;

export async function untilReplicaCurrent(
  relay: ReplicaWaiter,
  home: { getSnapshot(id: string): Promise<{ lastSeq: number }> },
  canvasId: string,
): Promise<void> {
  const want = (await home.getSnapshot(canvasId)).lastSeq;
  const deadline = Date.now() + REPLICATION_MS;
  let have: number | null = null;
  for (;;) {
    if (await relay.store.canvasExists(canvasId)) {
      have = await relay.engine.getSnapshot(canvasId).then((s) => s.lastSeq, () => null);
      if (have === want) return;
    }
    if (Date.now() > deadline) {
      throw new Error(`the relay did not catch up with its home on ${canvasId}: holds ${have ?? "nothing"}, the home is at ${want}`);
    }
    await new Promise((r) => setTimeout(r, 20));
  }
}
