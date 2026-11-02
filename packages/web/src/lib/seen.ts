import type { PriorVisit } from "./visitdigest.ts";
import { mergeSeen, type SeenMark, type SeenMarks } from "@isocan/core";
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
const cached = new Map<string, SeenMarks>();
interface SeenRead {
  controller: AbortController;
  promise: Promise<SeenMarks | null>;
  users: number;
  settled: boolean;
}
const asking = new Map<string, SeenRead>();
const loaded = new Map<string, SeenMarks>();
/** Preparation is a nicety, so a stalled home cannot hold navigation forever. */
const SEEN_READ_TIMEOUT_MS = 8000;
const visits = new Set<(actorId: string, canvasId: string, mark: SeenMark) => void>();

/** Navigation can clear its count when THIS tab's visit was accepted, without
 * another poll. Optimistic local timestamps and plain reads never announce. */
export function onSeenVisit(received: (actorId: string, canvasId: string, mark: SeenMark) => void): () => void {
  visits.add(received);
  return () => { visits.delete(received); };
}


/** Inbox reads refresh the shared ledger; only noteVisit writes it. */
export function rememberSeen(actorId: string, marks: SeenMarks): void {
  cached.set(actorId, mergeSeen(cached.get(actorId) ?? {}, marks));
}

/** What the home last told us, and an empty ledger until it has. */
export function seenMarks(actorId: string): SeenMarks {
  return cached.get(actorId) ?? {};
}

/** Share an authoritative read, preserving claim-healing order. A refresh
 * asks again after an earlier success; a failed read can always be retried.
 * Each caller owns its wait. Only the last cancellation aborts shared HTTP
 * work, so a hidden navigation cannot cancel an actual canvas visit. */
export function loadSeen(
  actorId: string,
  options: { signal?: AbortSignal; refresh?: boolean; canvasId?: string } = {},
): Promise<boolean> {
  return readSeenResponse(actorId, options).then((marks) => marks !== null);
}

/** Keep each read's exact answer separate from the merged recents ledger. */
function readSeenResponse(
  actorId: string,
  options: { signal?: AbortSignal; refresh?: boolean; canvasId?: string },
): Promise<SeenMarks | null> {
  options.signal?.throwIfAborted();
  const key = JSON.stringify([actorId, options.canvasId ?? null]);
  if (!options.refresh && loaded.has(key)) return Promise.resolve(loaded.get(key)!);
  let pending = asking.get(key);
  if (!pending || pending.controller.signal.aborted) {
    const controller = new AbortController();
    const read: SeenRead = { controller, users: 0, settled: false, promise: Promise.resolve(null) };
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(SEEN_READ_TIMEOUT_MS)]);
    read.promise = untilAborted(fetchSeen(actorId, signal, options.canvasId), signal)
      .then(({ marks }) => {
        controller.signal.throwIfAborted();
        rememberSeen(actorId, marks);
        loaded.set(key, marks);
        return marks;
      }, () => {
        controller.signal.throwIfAborted();
        return null;
      })
      .finally(() => {
        read.settled = true;
        if (asking.get(key) === read) asking.delete(key);
      });
    asking.set(key, read);
    pending = read;
  }
  const read = pending;
  read.users++;
  return new Promise((resolve, reject) => {
    let done = false;
    const leave = () => {
      done = true;
      options.signal?.removeEventListener("abort", cancel);
      if (--read.users === 0 && !read.settled) read.controller.abort();
    };
    const cancel = () => { if (!done) { leave(); reject(options.signal!.reason); } };
    options.signal?.addEventListener("abort", cancel, { once: true });
    read.promise.then((marks) => {
      if (done) return;
      leave(); resolve(marks);
    }, (error) => {
      if (done) return;
      leave(); reject(error);
    });
  });
}

/** Capture one canvas's prior mark from a fresh read, with unavailable kept
 * distinct from an authoritative first visit. */
async function readSeenMark(actorId: string, canvasId: string, signal?: AbortSignal): Promise<{ available: boolean; mark: SeenMark | null }> {
  const marks = await readSeenResponse(actorId, { refresh: true, canvasId, ...(signal ? { signal } : {}) });
  const mark = marks?.[canvasId];
  return { available: marks !== null, mark: mark ? { ...mark } : null };
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
export async function noteVisit(canvasId: string, seq: number, actorId: string): Promise<PriorVisit> {
  // A fresh read captures what the home knew BEFORE this arrival. A cached
  // optimistic timestamp would describe the visit we are about to record.
  // Read before write also preserves the badge's one-at-a-time claim healing.
  // Use the scoped response itself: recents merge monotonically, and an old
  // local mark must not overrule this canvas home’s lower or absent mark.
  const { available, mark } = await readSeenMark(actorId, canvasId);
  const prior: PriorVisit = { canvasId, actorId, head: seq, available, mark: available && mark ? { ...mark } : null };
  void putSeen(canvasId, seq, actorId).then(({ mark: accepted }) => {
    rememberSeen(actorId, { [canvasId]: accepted });
    for (const received of visits) received(actorId, canvasId, accepted);
  }, () => {});
  return prior;
}

/** A caller can leave shared claim recovery even if its callback cannot be
 * cancelled. The owned seen HTTP request receives the same signal. */
function untilAborted<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const cancel = () => reject(signal.reason);
    if (signal.aborted) cancel();
    else signal.addEventListener("abort", cancel, { once: true });
    work.then(resolve, reject).finally(() => signal.removeEventListener("abort", cancel));
  });
}
