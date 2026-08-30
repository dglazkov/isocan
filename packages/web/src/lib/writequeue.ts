import type { Actor, CanvasContents, Operation, CanvasState } from "@isocan/core";
import { applyOperation, itemsTouchedBy } from "@isocan/core";
import type { StoredWrite } from "./replica.ts";

/**
 * **Ops made with nobody to send them to** (phase 10).
 *
 * The model, kept away from the socket and the store so it can be reasoned
 * about — and tested — on its own. Three rules carry the whole design:
 *
 * 1. **The confirmed state is the truth; the queue is a view on top of it.**
 *    `canvasStore` holds what the home said at `lastSeq` and folds the queue
 *    over it for rendering. Nothing ever writes an optimistic result into the
 *    confirmed state, which is what makes the next rule possible at all.
 * 2. **On reconnect the queue is flushed BEFORE the tail is applied**, and the
 *    tail is applied to the confirmed state — not to the optimistic view. So
 *    the home's order is what the tab ends up holding, whatever order the tab
 *    happened to make its changes in. Getting this backwards (applying a tail
 *    computed before the queued ops landed) is silent divergence, and it is
 *    the failure the phase's Proof is pointed at.
 * 3. **A write retires when the cursor reaches it, not when it is sent.** The
 *    home's answer sets `seq`; the write leaves the queue only once
 *    `lastSeq >= seq`, which is the moment the same op arrives down the socket
 *    as confirmed history. Retiring on the POST answer instead would rewind
 *    the item for the few frames until the tail caught up — a visible flinch
 *    for a correctness reason nobody can see.
 *
 * **Rebase, not skip.** It is tempting, on reconnect, to skip the tail entries
 * this tab already applied optimistically. It is also wrong: the home may have
 * ordered somebody ELSE's op after ours. Offline you move a card to (10,10);
 * meanwhile Bob moves it to (50,50) at seq 12; your flush lands at seq 13. Skip
 * 13 and the card ends at Bob's position while the home says yours. Fold the
 * whole tail onto the confirmed state and the card ends where the home put it,
 * which is the only answer that converges.
 */

/** A write this tab made, as the queue holds it. */
export interface QueuedWrite extends StoredWrite {
  /** The home would not take it. The optimistic effect is dropped and the
   * person is told — see `canvasStore`'s refusal banner. */
  refused?: { message: string; code?: string };
  /**
   * **Sent, and waiting for the history that carries it.**
   *
   * The gesture commits people make — dropping a dragged item, letting go of
   * a resize, wearing a mark — are posted the instant they happen, so calling
   * them "not synced" for the length of a round trip would be a lie. But they
   * still have to be FOLDED, because rule 3 above is about the view and the
   * view is recomputed from `confirmed + queue` every time anything lands: a
   * commit that is only written into the view is erased by the next op to
   * arrive from anyone, and the item rewinds to where it was until its own op
   * comes down the socket. That is the flinch rule 3 exists to prevent,
   * arriving through the one door that was not using the queue.
   *
   * So: folded like any other write, never counted as unsynced, never
   * re-posted by a flush, and retired by `seq` exactly like the rest. If the
   * post fails the flag comes off and it becomes ordinary offline work, which
   * is the moment "not synced" starts being true.
   */
  inflight?: boolean;
}

/** What a refusal is shown as. */
export interface RefusedWrite {
  opId: string;
  opType: Operation["type"];
  message: string;
  code?: string;
  at: number;
}

/** Writes still waiting for the home: not yet answered, not refused. */
export function pendingWrites(queue: QueuedWrite[]): QueuedWrite[] {
  return queue.filter((write) => write.seq === undefined && !write.refused && !write.inflight);
}

/** How many changes a person is carrying that the home has not got. The
 * number in the banner, and it deliberately counts sent-but-unconfirmed too:
 * until the tail says so, they are still only in this tab. */
export function unsyncedCount(queue: QueuedWrite[]): number {
  // An in-flight commit is on its way to the home, not stranded here.
  return queue.filter((write) => !write.refused && !write.inflight).length;
}

/**
 * **How long a change may be in flight before it is worth mentioning.**
 *
 * Not zero, and that is the whole design of the settling treatment. Under a
 * healthy connection the round trip is tens of milliseconds, so marking every
 * change the instant it is made would put a flicker on every gesture — and a
 * signal that fires constantly is one people stop seeing, which means it
 * cannot work on the day it matters.
 *
 * At this threshold the mark means something specific and useful: **this is
 * taking longer than it should.** Under a good connection nobody ever sees it.
 * Under a sick one it appears exactly where the work is stuck, which is the
 * question somebody is actually asking when a canvas stops responding.
 */
export const SETTLING_MS = 600;

/**
 * The items carrying a change the home has not confirmed yet, and has had
 * longer than `SETTLING_MS` to.
 *
 * Pure, and takes `now` rather than reading the clock, so a test can stand at
 * any moment without waiting — the same reason `retire` takes `lastSeq`.
 *
 * A REFUSED write is not settling: it is over, it failed, and the person is
 * being told so by the refusal banner. Leaving it marked would say "still
 * working on it" about something that has already stopped.
 */
export function settlingItems(
  queue: QueuedWrite[],
  now: number,
  canvas?: CanvasContents | null,
): Set<string> {
  const settling = new Set<string>();
  for (const write of queue) {
    if (write.seq !== undefined || write.refused) continue;
    if (now - write.at < SETTLING_MS) continue;
    for (const id of itemsTouchedBy(write.op, canvas)) settling.add(id);
  }
  return settling;
}

/**
 * Drop the writes the home's own history has now caught up with.
 *
 * `seq <= lastSeq` is the whole test, and it works because the seq came from
 * the home: the write is in the confirmed state by the time the cursor passes
 * it, so folding it again would be applying the same op twice to a state that
 * already has it — which for a create-shaped op throws, and for a valued op is
 * merely a lie about who is holding what.
 */
export function retire(queue: QueuedWrite[], lastSeq: number): QueuedWrite[] {
  return queue.filter((write) => write.seq === undefined || write.seq > lastSeq);
}

/**
 * The confirmed state with this tab's un-landed work folded over it — what a
 * person actually looks at while offline.
 *
 * A write whose op the reducer refuses HERE is dropped from the render and
 * left in the queue: the local state may simply have raced ahead (the same
 * reasoning `applyLocalEcho` has always carried), and the home is the one
 * whose refusal counts. Nothing is decided on a client-side validation.
 */
export function foldQueue(
  confirmed: CanvasState | null,
  queue: QueuedWrite[],
): CanvasState | null {
  if (!confirmed) return null;
  let state: CanvasState = confirmed;
  for (const write of queue) {
    if (write.refused) continue;
    try {
      const next = applyOperation(state, {
        id: write.opId,
        canvasId: confirmed.project.id,
        actor: write.actor,
        ts: new Date(write.at).toISOString(),
        op: write.op,
      });
      if (next) state = next;
    } catch {
      // Locally inapplicable. Kept in the queue: the home decides.
    }
  }
  return state;
}

/**
 * Can this op wait in a queue at all?
 *
 * Two families cannot, and both refusals are deliberate rather than
 * unimplemented:
 *
 * - **Home-scoped ops** (`canvasId: null` — `project.create`, `actor.claim`,
 *   `actor.setColor`). A canvas born with no network is offline BIRTH, which
 *   is a whole design of its own (`docs/projects/multiuser/offline-birth.md`) and phase
 *   13's work: it needs a promise written at birth, an adoption path from seq
 *   1, and a first-writer rule for twins. Half-building it inside a browser
 *   queue is exactly the almost-working machinery that doc exists to prevent.
 *   Naming yourself offline is refused for a sharper reason still: a claim is
 *   judged against a namespace this tab cannot see.
 * - **Ops for a canvas this tab does not have open.** The queue lives beside
 *   one canvas's confirmed state, because that state is what an op is folded
 *   over; an op about somewhere else has nothing to be optimistic against.
 */
export function queueable(canvasId: string | null, openCanvasId: string | null): boolean {
  return canvasId !== null && canvasId === openCanvasId;
}

/** Mint the queue's record of one gesture. */
export function newWrite(
  opId: string,
  actor: Actor,
  op: Operation,
  group?: string,
): QueuedWrite {
  return { opId, actor, op, at: Date.now(), ...(group !== undefined ? { group } : {}) };
}

/**
 * A restored queue, made honest again.
 *
 * `inflight` means "posted, waiting for the tail" — a claim only the tab that
 * posted it can make. A tab that reloaded cannot know whether the post landed,
 * so every stored in-flight write becomes ordinary pending work and is posted
 * again; the idempotency key makes that a no-op at the home if it already
 * arrived. Without this a stored in-flight write would fold forever and never
 * retire, because nothing would ever give it a seq.
 */
export function adopt(queue: QueuedWrite[]): QueuedWrite[] {
  return queue.map(({ inflight: _inflight, ...write }) => write);
}
