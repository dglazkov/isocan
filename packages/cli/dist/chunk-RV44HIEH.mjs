import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  propose
} from "./chunk-IWLL6566.mjs";
import {
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
  textLookProperties
} from "./chunk-SQGHMD6B.mjs";

// packages/cli/src/explain.ts
async function sayInChat(ctx, deps, canvasId, snapshot, body, extra) {
  const comment = { ...await deps.newComment(ctx, canvasId, snapshot, body), ...extra };
  const main = mainThread(snapshot.canvas);
  if (main) {
    await deps.sendOp(ctx, canvasId, { type: "thread.reply", threadId: main.id, comment });
    return { threadId: main.id, commentId: comment.id };
  }
  const threadId = newThreadId();
  await deps.sendOp(ctx, canvasId, { type: "thread.create", threadId, x: 0, y: 0, anchorItemId: null, main: true, comment });
  return { threadId, commentId: comment.id };
}
async function explain(ctx, deps, ref, opts) {
  const { canvas: p, snapshot } = await deps.canvasAndSnapshot(ctx);
  const item = deps.resolveItem(snapshot, ref);
  const story = explainStory(snapshot.canvas, item.id);
  if ("refused" in story) throw new Error(story.refused);
  if (opts.critique) {
    const missing = ["working", "risk", "try"].filter((k) => !opts[k]?.trim());
    if (missing.length) throw new Error(`a critique says all three: ${missing.map((k) => `--${k}`).join(", ")} ${missing.length === 1 ? "is" : "are"} missing`);
    const speak = (opts.speak ?? []).map((s) => {
      const pair = parseSpeak(s);
      if ("refused" in pair) throw new Error(pair.refused);
      return pair;
    });
    const body = critiqueBody(item, { working: opts.working, risk: opts.risk, tryThis: opts.try, speak });
    const posted = await sayInChat(ctx, deps, p.id, snapshot, body, { record: true, items: [item.id] });
    const made = opts.propose ? await propose(ctx, deps, item.id, opts.propose, { cites: [`explain:${posted.commentId}`], why: opts.try, ...opts.hunch ? { hunch: true } : {} }, true) : void 0;
    if (ctx.json) return deps.printJson({ commentId: posted.commentId, threadId: posted.threadId, proposal: made ? made.itemId : null });
    console.log(`critique of "${item.title}" posted in the Chat (${posted.commentId})${made ? `; the thing to try is a proposal beneath it (${made.itemId}), citing explain:${posted.commentId}` : " \u2014 the thing to try can go beneath it: `isocan propose " + item.id + " <file> --cites explain:" + posted.commentId + "`"}`);
    return;
  }
  if (opts.ask) {
    const [answering, sessions] = await Promise.all([ctx.client.rcAnswering(p.id).catch(() => null), ctx.client.listSessions(p.id).catch(() => [])]);
    const seen = { answering, sessions, ...snapshot.joined ? { joined: snapshot.joined } : {} };
    const lead = nightLead(snapshot.canvas, p.properties ?? {}, seen);
    const cannot = critiqueCannot(lead, ctx.actor.id, seen);
    if (cannot || !lead.agent) throw new Error(`nothing can critique here: ${cannot ?? "no lead"}. The explanation stands without one \u2014 \`isocan explain ${item.id}\``);
    const posted = await sayInChat(ctx, deps, p.id, snapshot, critiqueAsk(lead.agent.actor, item), { items: [item.id] });
    if (ctx.json) return deps.printJson({ commentId: posted.commentId, lead: lead.agent.actor });
    console.log(`asked ${lead.agent.actor.name} for a critique of "${item.title}" in the Chat (${posted.commentId}) \u2014 \`isocan explain ${item.id}\` shows it when it arrives`);
    return;
  }
  if (opts.rationale) {
    const body = rationaleText(story, Date.now());
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
      title: `Why \u201C${item.title || "Untitled"}\u201D looks like this`,
      properties: textLookProperties({ style: "body", face: "sans", paper: null, colour: null, font: null })
    });
    if (ctx.json) return deps.printJson({ itemId, text: body });
    console.log(`the rationale is a note beside "${item.title}" (${itemId})`);
    return;
  }
  if (ctx.json) return deps.printJson({ story, sections: explainSections(story) });
  console.log(explainText(story));
}

export {
  sayInChat,
  explain
};
