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
 *  loop behind somebody's back. */
export function loadSeen(actorId: string): void {
  if (cached?.actorId === actorId || asking) return;
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
  void putSeen(canvasId, seq, actorId).then(
    ({ mark }) => {
      // The home may be AHEAD — another machine of yours got further — and
      // its answer is the one that stands.
      if (cached?.actorId === actorId) cached.marks[canvasId] = mark;
    },
    () => {},
  );
}
