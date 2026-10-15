import {
  EXPLAIN_DEPTHS,
  TEXT_FILENAME,
  TEXT_MIME,
  critiqueAsk,
  critiqueBody,
  critiqueCannot,
  explainSections,
  explainStory,
  explainText,
  mainThread,
  newItemId,
  newThreadId,
  newVersionId,
  nightLead,
  parseSpeak,
  rationaleSpot,
  rationaleText,
  textLookProperties,
  type CanvasSnapshotResponse,
  type ExplainDepth,
  type NewComment,
  type NightSeen,
} from "@isocan/core";
import type { Ctx } from "./ctx.ts";
import { propose, type ProposeDeps } from "./propose.ts";

/**
 * **`isocan explain <item>`** (proactive-agent phase 4, design §6) — how an
 * item got here, from a terminal: the same derived story the Explain panel
 * draws (`explainSections` in core), at a depth, and the three acts beside
 * it, each only when asked:
 *
 * - `--rationale`: Copy as rationale — the explanation as a note beside the item;
 * - `--ask`: Critique — an ordinary summons to the canvas's lead agent;
 * - `--critique --working --risk --try [--speak] [--propose <file>]`: the
 *   lead's answer, a `record` in the Chat, and the thing to try as a proposal
 *   beneath the item citing `explain:<that comment>`.
 *
 * Loaded on this verb only, with main's helpers handed in (`propose.ts`'s reason).
 */
export interface ExplainDeps extends ProposeDeps {
  /** A comment as main writes one: mentions and #-references resolved. */
  newComment: (ctx: Ctx, canvasId: string, snapshot: CanvasSnapshotResponse, body: string) => Promise<NewComment>;
}

/** What `explain` takes. */
export interface ExplainOpts {
  depth?: string;
  rationale?: boolean;
  ask?: boolean;
  critique?: boolean;
  working?: string;
  risk?: string;
  try?: string;
  speak?: string[];
  propose?: string;
  hunch?: boolean;
}

/** Say something in the Chat, about one item; the thread is born if this is the first word. Shared with `design card`'s re-read. */
export async function sayInChat(ctx: Ctx, deps: ExplainDeps, canvasId: string, snapshot: CanvasSnapshotResponse, body: string, extra: Partial<NewComment>) {
  const comment = { ...(await deps.newComment(ctx, canvasId, snapshot, body)), ...extra };
  const main = mainThread(snapshot.canvas);
  if (main) {
    await deps.sendOp(ctx, canvasId, { type: "thread.reply", threadId: main.id, comment });
    return { threadId: main.id, commentId: comment.id };
  }
  const threadId = newThreadId();
  await deps.sendOp(ctx, canvasId, { type: "thread.create", threadId, x: 0, y: 0, anchorItemId: null, main: true, comment });
  return { threadId, commentId: comment.id };
}

/** `isocan explain <item> [--depth plain|designer|deep] [--rationale | --ask | --critique …]`. */
export async function explain(ctx: Ctx, deps: ExplainDeps, ref: string, opts: ExplainOpts): Promise<void> {
  const depth = (opts.depth ?? "plain") as ExplainDepth;
  if (!EXPLAIN_DEPTHS.includes(depth)) throw new Error(`--depth is ${EXPLAIN_DEPTHS.join(", ")} — not "${opts.depth}"`);
  const { canvas: p, snapshot } = await deps.canvasAndSnapshot(ctx);
  const item = deps.resolveItem(snapshot, ref);
  const story = explainStory(snapshot.canvas, item.id);
  if ("refused" in story) throw new Error(story.refused);

  if (opts.critique) {
    const missing = (["working", "risk", "try"] as const).filter((k) => !opts[k]?.trim());
    if (missing.length) throw new Error(`a critique says all three: ${missing.map((k) => `--${k}`).join(", ")} ${missing.length === 1 ? "is" : "are"} missing`);
    const speak = (opts.speak ?? []).map((s) => {
      const pair = parseSpeak(s);
      if ("refused" in pair) throw new Error(pair.refused);
      return pair;
    });
    const body = critiqueBody(item, { working: opts.working!, risk: opts.risk!, tryThis: opts.try!, speak });
    const posted = await sayInChat(ctx, deps, p.id, snapshot, body, { record: true, items: [item.id] });
    const made = opts.propose
      ? await propose(ctx, deps, item.id, opts.propose, { cites: [`explain:${posted.commentId}`], why: opts.try!, ...(opts.hunch ? { hunch: true } : {}) }, true)
      : undefined;
    if (ctx.json) return deps.printJson({ commentId: posted.commentId, threadId: posted.threadId, proposal: made ? made.itemId : null });
    console.log(`critique of "${item.title}" posted in the Chat (${posted.commentId})${made ? `; the thing to try is a proposal beneath it (${made.itemId}), citing explain:${posted.commentId}` : " — the thing to try can go beneath it: `isocan propose " + item.id + " <file> --cites explain:" + posted.commentId + "`"}`);
    return;
  }

  if (opts.ask) {
    const [answering, sessions] = await Promise.all([ctx.client.rcAnswering(p.id).catch(() => null), ctx.client.listSessions(p.id).catch(() => [])]);
    const seen: NightSeen = { answering, sessions, ...(snapshot.joined ? { joined: snapshot.joined } : {}) };
    const lead = nightLead(snapshot.canvas, p.properties ?? {}, seen);
    const cannot = critiqueCannot(lead, ctx.actor.id, seen);
    if (cannot || !lead.agent) throw new Error(`nothing can critique here: ${cannot ?? "no lead"}. The explanation stands without one — \`isocan explain ${item.id}\``);
    const posted = await sayInChat(ctx, deps, p.id, snapshot, critiqueAsk(lead.agent.actor, item), { items: [item.id] });
    if (ctx.json) return deps.printJson({ commentId: posted.commentId, lead: lead.agent.actor });
    console.log(`asked ${lead.agent.actor.name} for a critique of "${item.title}" in the Chat (${posted.commentId}) — \`isocan explain ${item.id}\` shows it when it arrives`);
    return;
  }

  if (opts.rationale) {
    const body = rationaleText(story, depth, Date.now());
    const spot = rationaleSpot(snapshot.canvas, item, body);
    const upload = await ctx.client.uploadBlob(p.id, Buffer.from(body, "utf8"), TEXT_MIME, TEXT_FILENAME);
    const itemId = newItemId();
    await deps.sendOp(ctx, p.id, {
      type: "item.add",
      itemId,
      version: { id: newVersionId(), blobHash: upload.blobHash, mimeType: TEXT_MIME, filename: TEXT_FILENAME, size: upload.size },
      width: spot.width,
      height: spot.height,
      placement: { x: spot.x, y: spot.y, chosen: true },
      title: `Why “${item.title || "Untitled"}” looks like this`,
      properties: textLookProperties({ style: "body", face: "sans", paper: null, colour: null, font: null }),
    });
    if (ctx.json) return deps.printJson({ itemId, text: body });
    console.log(`the rationale is a note beside "${item.title}" (${itemId})`);
    return;
  }

  if (ctx.json) return deps.printJson({ depth, story, sections: explainSections(story, depth) });
  console.log(explainText(story, depth));
}
