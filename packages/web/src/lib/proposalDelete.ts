import type { Actor, CanvasContents, Item, Operation } from "@isocan/core";
import { PROPOSAL_PROP, deletedBody, itemThread, listeners, newCommentId, newGroupId, newThreadId, proposalMarked } from "@isocan/core";
import { fetchRcAnswering } from "./api.ts";
import { sendEchoed, sendEchoedResult, useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { showProposalToast } from "../components/ProposalToast.tsx";

/**
 * **Delete, and a note that teaches** (proactive-agent phase 1, design §3).
 *
 * ⌫ on a proposal is the same delete as on anything — the selection to the
 * trash, at once, one op — and then one more thing: an ordinary comment on
 * the proposal's thread, carrying `{ deleted: itemId }` as data and
 * mentioning whoever made it, so the author is summoned by the road a
 * prototype click already travels (`prototype-click.ts`) and answers with
 * one line in the taste note (`isocan taste`).
 *
 * **One undo.** The comment shares the delete's group, so ⌘Z brings the
 * proposal back and takes the note with it — a delete you took back taught
 * nothing.
 *
 * **The reason is optional and typed in the toast.** The comment waits for
 * it: it is written when the toast closes — Enter, Escape, ×, or a few quiet
 * seconds — so the author is asked once, with the reason when there is one.
 * If nobody can answer for the author (no rc answering, no `wait` parked),
 * the delete still happens and the toast says the note was not taken; the
 * comment is still written, so the ask is there when somebody comes back.
 *
 * Loaded on the first delete of a proposal, never on first paint.
 */
export async function deleteProposals(canvasId: string, actor: Actor, ids: string[]): Promise<void> {
  const canvas = useCanvasStore.getState().canvas;
  if (!canvas || ids.length === 0) return;
  // A promised frame of your own goodnight is not a proposal you reject: ⌫
  // on it is "not tonight" — the line unticked on the note, the frame gone,
  // one undo, and no lesson asked of anybody (proactive-agent phase 2).
  const promised = ids.filter((id) => canvas.items[id]?.properties[PROPOSAL_PROP] === "promised");
  if (promised.length) {
    const { untickFrame } = await import("./goodnight.ts");
    for (const id of promised) await untickFrame(canvasId, actor, id);
    ids = ids.filter((id) => !promised.includes(id));
    if (ids.length === 0) return;
  }
  const proposals = ids.map((id) => canvas.items[id]).filter((item): item is Item => Boolean(item) && proposalMarked(item!));
  const group = newGroupId();
  const result = await sendEchoedResult(
    canvasId,
    actor,
    ids.length === 1 ? { type: "item.delete", itemId: ids[0]! } : { type: "items.delete", itemIds: ids },
    group,
  );
  if (result.status === "refused") return;
  if (useCanvasStore.getState().canvasId === canvasId) useUiStore.getState().select(null);

  for (const proposal of proposals) {
    const author = proposal.createdBy;
    // Your own proposal, deleted by you, asks nobody anything.
    if (author.id === actor.id) continue;
    const answerable = await canAnswer(canvasId, author.id);
    showProposalToast({
      title: proposal.title,
      author: author.name,
      answerable,
      onClose: (reason) => void sendEchoed(canvasId, actor, noteOp(canvas, proposal, reason), group),
    });
  }
}

/** Whether anything can answer for this author right now: an rc answering for it, or a `wait` it is parked on. */
async function canAnswer(canvasId: string, authorId: string): Promise<boolean> {
  if (listeners(useCanvasStore.getState().sessions).some((s) => s.actor.id === authorId)) return true;
  try {
    const answering = await fetchRcAnswering(canvasId);
    return answering.actorIds.includes(authorId);
  } catch {
    // Not knowing whether anybody is listening is not knowing: say not taken.
    return false;
  }
}

/** The comment a delete writes: a reply on the proposal's thread, or that thread's first message where the proposal stood. */
function noteOp(canvas: CanvasContents, proposal: Item, reason: string): Operation {
  const comment = { id: newCommentId(), body: deletedBody(proposal.title, reason), deleted: proposal.id, mentions: [proposal.createdBy.id] };
  const thread = itemThread(canvas, proposal.id);
  if (thread) return { type: "thread.reply", threadId: thread.id, comment };
  // The proposal is in the trash by now, and a thread cannot be born anchored
  // to something that is not on the canvas — so it stands where the
  // proposal's corner was, and a restore finds it beside it.
  return { type: "thread.create", threadId: newThreadId(), x: proposal.x + proposal.width, y: proposal.y, anchorItemId: null, comment };
}
