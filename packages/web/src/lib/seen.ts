import type { SeenMarks } from "@isocan/core";
import { fetchSeen, putSeen } from "./api.ts";

/**
 * **What this person has already seen, as the home keeps it** (#147, #134) —
 * `docs/research/2026-09-12-seen-marks.md`.
 *
 * The browser has had read state since the beginning, in `localStorage`:
 * per-thread watermarks (`stores/unreadStore.ts`) and the switcher's recents
 * (`lib/recents.ts`). Both are per BROWSER, and that is the thing this
 * replaces one half of. The durable mark is coarse — one row per canvas, the
 * head you had in front of you and when — and it crosses machines, which is
 * the half localStorage structurally could not do. The per-thread watermarks
 * stay exactly where they are, doing the fine-grained job they already do.
 *
 * **Only a visit writes.** The mark means both "I was here" and "I had seen
 * everything up to here", which is what lets the inbox and the switcher read
 * one fact. Marking canvases nobody opened would fill somebody's "lately"
 * with places they never went.
 *
 * Nothing here fails loudly. A mark is a nicety; a home that cannot answer
 * costs an ordering, never a canvas.
 */

/** The marks this tab has read, once per identity. A module-level cache
 *  rather than a store: it is asked for by two surfaces, changes at most once
 *  per visit, and nothing re-renders when it lands. */
let cached: { actorId: string; marks: SeenMarks } | null = null;
let asking: Promise<void> | null = null;

/** What the home last told us, and an empty ledger until it has. */
export function seenMarks(actorId: string): SeenMarks {
  return cached?.actorId === actorId ? cached.marks : {};
}

/** Ask once per identity. Safe to call on every render; it is a no-op after
 *  the first, and a failure leaves the marks empty rather than retrying in a
 *  loop behind somebody's back. Awaitable, which `noteVisit` depends on. */
export function loadSeen(actorId: string): Promise<void> {
  if (cached?.actorId === actorId) return Promise.resolve();
  if (asking) return asking;
  asking = fetchSeen(actorId)
    .then(
      ({ marks }) => {
        cached = { actorId, marks };
      },
      () => {
        cached = { actorId, marks: {} };
      },
    )
    .finally(() => {
      asking = null;
    });
  return asking;
}

/**
 * **You opened a canvas.** Moves the mark to the head this tab has in front
 * of it, and keeps the local copy in step so "lately" is right before the
 * answer lands.
 *
 * Once per arrival rather than per op: a write per op would be the per-thread
 * mistake wearing a different hat — the whole argument for a high-water mark
 * is that a glance costs at most one write. A canvas whose head has not moved
 * since the mark is still written, because a REVISIT is the fact "lately"
 * needs and the merge takes the later instant on its own.
 */
export function noteVisit(canvasId: string, seq: number, actorId: string): void {
  const at = new Date().toISOString();
  if (cached?.actorId === actorId) cached.marks[canvasId] = { seq, at };
  /**
   * **After the read, never beside it** — and this is a bug that only a real
   * browser found.
   *
   * A fresh page load holds a badge whose CLAIM on this persona the home may
   * have forgotten, so the first request asserting an actor comes back
   * `not-your-actor`. `lib/api.ts` heals exactly that, once, by re-claiming
   * and replaying — but the healing is guarded by a single `reclaiming` flag,
   * so of two requests fired in the same tick only one gets to heal and the
   * other fails for good. Fired together, the read healed and the WRITE was
   * the one that died: marks stopped being written on every load after the
   * first, silently, because a mark is deliberately allowed to fail quietly.
   *
   * Sequencing is the whole fix. The read goes first, heals the claim if it
   * needs healing, and the write follows a claim that is already good. It
   * costs a round trip on a nicety and buys a feature that works on the
   * second page load.
   */
  void loadSeen(actorId)
    .then(() => putSeen(canvasId, seq, actorId))
    .then(
      ({ mark }) => {
        // The home may be AHEAD — another machine of yours got further — and
        // its answer is the one that stands.
        if (cached?.actorId === actorId) cached.marks[canvasId] = mark;
      },
      () => {},
    );
}
