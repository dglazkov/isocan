import type { Actor, Operation, CanvasState } from "@isocan/core";
import { applyOperation } from "@isocan/core";
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
  return queue.filter((write) => write.seq === undefined && !write.refused);
}

/** How many changes a person is carrying that the home has not got. The
 * number in the banner, and it deliberately counts sent-but-unconfirmed too:
 * until the tail says so, they are still only in this tab. */
export function unsyncedCount(queue: QueuedWrite[]): number {
  return queue.filter((write) => !write.refused).length;
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
 *   is a whole design of its own (`docs/design/offline-birth.md`) and phase
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
export function newWrite(opId: string, actor: Actor, op: Operation): QueuedWrite {
  return { opId, actor, op, at: Date.now() };
}
