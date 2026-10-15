import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  sayInChat
} from "./chunk-JBZFLSNG.mjs";
import "./chunk-HWNAJDWE.mjs";
import {
  CanvasHandle
} from "./chunk-ILQQGD5C.mjs";
import "./chunk-EJ2TF764.mjs";
import "./chunk-PHCZTV3P.mjs";
import "./chunk-3RI4CEIP.mjs";
import "./chunk-DEPDUI3U.mjs";
import "./chunk-JNV7IFSE.mjs";
import "./chunk-HPFTKOB6.mjs";
import "./chunk-BW3SAZCE.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-SQGYEDW5.mjs";
import "./chunk-L53WM2YB.mjs";
import "./chunk-7IQJCBGY.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-DUIOTTIJ.mjs";
import "./chunk-FYZDNGZ4.mjs";
import {
  BRIEF_MODES,
  briefCard,
  briefChanges,
  briefEditPatch,
  briefReread,
  briefScreens,
  critiqueCannot,
  findBriefLine,
  newOpId,
  newVersionId,
  nightLead,
  parseDesignBrief,
  rereadAnswer,
  rereadAsk,
  rereadAsked,
  rereadBody,
  rereadQuestionRefusal
} from "./chunk-L3EVJHHR.mjs";
import "./chunk-GUY4UN4O.mjs";
import "./chunk-K4TDP4L5.mjs";
import "./chunk-JYOOXWJZ.mjs";

// packages/cli/src/brief-card.ts
async function leadFor(ctx, canvas, snapshot) {
  const [answering, sessions] = await Promise.all([ctx.client.rcAnswering(canvas.id).catch(() => null), ctx.client.listSessions(canvas.id).catch(() => [])]);
  const seen = { answering, sessions, ...snapshot.joined ? { joined: snapshot.joined } : {} };
  const lead = nightLead(snapshot.canvas, canvas.properties ?? {}, seen);
  return { lead: lead.agent?.actor ?? null, cannot: critiqueCannot(lead, ctx.actor.id, seen) ?? (lead.agent ? null : "no lead") };
}
function pick(rows, request) {
  if (request) {
    const row = rows.find((r) => r.brief.requestId === request);
    if (!row) throw new Error(`no design request "${request}" here \u2014 \`isocan design brief\` lists them`);
    return row;
  }
  const active = rows.filter((r) => r.brief.progress === "active");
  const one = active.length === 1 ? active[0] : rows.length === 1 ? rows[0] : void 0;
  if (one) return one;
  if (!rows.length) throw new Error("no design brief on this canvas yet \u2014 a design request starts one (`isocan design start`)");
  throw new Error(`${rows.length} design requests here; name one: ${rows.map((r) => r.brief.requestId).join(", ")}`);
}
async function previous(ctx, canvasId, snapshot, row) {
  const versions = snapshot.canvas.items[row.ref.itemId]?.versions ?? [];
  const at = versions.findIndex((v) => v.id === row.ref.versionId);
  const before = at > 0 ? versions[at - 1] : void 0;
  if (!before?.designRecord) return null;
  return parseDesignBrief(JSON.parse(Buffer.from(await ctx.client.downloadBlob(canvasId, before.blobHash)).toString("utf8")));
}
async function rereadOf(ctx, canvasId, snapshot, row, whyNot) {
  const before = await previous(ctx, canvasId, snapshot, row);
  if (!before) return null;
  const changes = briefChanges(before, row.brief);
  if (!changes.length) return null;
  const at = { itemId: row.ref.itemId, versionId: row.ref.versionId };
  const answer = rereadAnswer(snapshot.canvas, at);
  const asked = rereadAsked(snapshot.canvas, at);
  const receipts = row.receipts.map((r) => ({ outputItemId: r.receipt.output.kind === "canvas" ? r.receipt.output.artifact.itemId : null, briefVersionId: r.receipt.brief.versionId }));
  const sorted = briefReread(snapshot.canvas, row.brief, changes, { afterVersionId: row.ref.versionId, receipts, matters: answer?.matters ?? [] });
  const version = snapshot.canvas.items[row.ref.itemId]?.versions.find((v) => v.id === row.ref.versionId);
  const waits = answer || asked ? null : await whyNot() ?? "nobody has asked the lead yet";
  return { ...sorted, at, by: version?.createdBy.name ?? "somebody", answer, asked, waits };
}
function cardText(row, card) {
  const out = [`Brief \u201C${row.brief.primaryTask || "a design request"}\u201D (${row.brief.requestId} \xB7 ${row.ref.itemId}@${row.ref.versionId})`];
  const width = Math.max(...card.lines.map((l) => l.label.length));
  for (const l of card.lines) {
    const rule = l.value === null ? " " : l.said ? "\u2501" : "\u2504";
    const how = l.value === null ? "not said yet" : l.said ? "said" : l.origin === "sensed" ? `sensed from the canvas \u2014 the request: ${card.intent}` : l.origin === "context" ? "read from context" : "assumed";
    out.push(`  ${rule} ${l.label.padEnd(width)}  ${l.value ?? "\u2014"} \xB7 ${how}${l.value !== null && !l.said ? ` \xB7 Right / Wrong: --right ${l.cite} | --wrong ${l.cite}` : ""}`);
  }
  if (card.quiet) out.push(`  (${card.quiet} more inferred line${card.quiet === 1 ? "" : "s"} wait unshown: four at a time)`);
  out.push(`A proposal answering a line cites it: --cites brief:${card.lines.map((l) => l.cite).join("|")}`);
  return out.join("\n");
}
function rereadText(r) {
  const names = (rows) => rows.map((x) => `\u201C${x.title}\u201D${x.because ? ` \u2014 ${x.because}` : ""}`).join("; ") || "none";
  return [
    `Re-read after ${r.by} changed ${r.changes.map((c) => `\u201C${c.label}\u201D: ${c.before === null ? "nothing" : `\u201C${c.before}\u201D`} \u2192 ${c.after === null ? "nothing" : `\u201C${c.after}\u201D`}`).join("; ")}`,
    "  Nothing on the canvas changed.",
    `  Assumed the old line: ${names(r.old)}`,
    `  Matters more now: ${r.answer ? names(r.more) : "the lead's call \u2014 not yet made"}`,
    `  Still holds: ${names(r.holds)}`,
    r.answer ? `  ${r.answer.by.name} asks: ${r.answer.question}` : r.asked ? "  Asked the lead; the re-read's question has not come yet." : `  The re-read waits: ${r.waits}`
  ].join("\n");
}
async function designCard(ctx, deps, request, opts) {
  const { canvas: p, snapshot } = await deps.canvasAndSnapshot(ctx);
  const handle = new CanvasHandle(ctx, p);
  const row = pick((await handle.designBrief(request ? { requestId: request } : {})).requests, request);
  const whyNot = async () => (await leadFor(ctx, p, snapshot)).cannot;
  const acts = ["right", "wrong", "set"].filter((a) => opts[a] !== void 0);
  if (acts.length > 1 || acts.length && opts.reread) throw new Error("one edit at a time: --right, --wrong or --set, or the lead's --reread");
  if (opts.reread) {
    const reread2 = await rereadOf(ctx, p.id, snapshot, row, whyNot);
    if (!reread2) throw new Error("nothing to re-read: the brief's latest version changed no line");
    const refused = rereadQuestionRefusal(opts.question ?? "");
    if (refused) throw new Error(refused);
    const screens = new Set(briefScreens(snapshot.canvas, row.brief).map((s) => s.id));
    const matters = (opts.matters ?? []).map((ref) => {
      const item = deps.resolveItem(snapshot, ref);
      if (!screens.has(item.id)) throw new Error(`\u201C${item.title}\u201D is not one of the brief's screens \u2014 matters more now names screens`);
      return item;
    });
    const posted = await sayInChat(ctx, deps, p.id, snapshot, rereadBody(reread2.at, matters, opts.question), { record: true, items: [row.ref.itemId, ...matters.map((m) => m.id)] });
    if (ctx.json) return deps.printJson({ commentId: posted.commentId, at: reread2.at, matters: matters.map((m) => m.id) });
    console.log(`the re-read is in the Chat (${posted.commentId}): ${matters.length ? `${matters.map((m) => `\u201C${m.title}\u201D`).join(", ")} matter${matters.length === 1 ? "s" : ""} more now; ` : ""}asked: ${opts.question.trim()}`);
    return;
  }
  if (acts.length) {
    const act = acts[0];
    const card2 = briefCard(row.brief, snapshot.canvas);
    const name = opts[act];
    const line = findBriefLine(card2, name);
    if (!line) throw new Error(`no line "${name}" on the card \u2014 making, for, feel, never, constraints, now, or a fact's name`);
    if (act === "set" && opts.value === void 0) throw new Error(`--set says the new words with --value "\u2026"${line.key === "now" ? ` (${BRIEF_MODES.join(", ")})` : ""}`);
    const edit = act === "right" ? { act } : act === "wrong" ? { act, ...opts.value !== void 0 ? { value: opts.value } : {} } : { act, value: opts.value };
    const patch = briefEditPatch(row.brief, line, edit);
    if ("refused" in patch) throw new Error(patch.refused);
    if (!row.allowedActions.includes("update")) throw new Error(`the brief cannot be edited now${row.reasons.length ? `: ${row.reasons.join(" ")}` : ` (${row.brief.progress})`}`);
    const result = await handle.designChange({ action: { kind: "update", brief: row.ref, epoch: row.brief.epoch, versionId: newVersionId(), patch }, opId: newOpId() });
    if (result.status !== "accepted") throw new Error(result.reason ?? `the edit was ${result.status}`);
    const fresh = await deps.canvasAndSnapshot(ctx);
    const after = pick((await handle.designBrief({ requestId: row.brief.requestId })).requests, row.brief.requestId);
    const found = await leadFor(ctx, p, fresh.snapshot);
    let reread2 = await rereadOf(ctx, p.id, fresh.snapshot, after, async () => found.cannot);
    let asked = null;
    if (reread2 && !reread2.answer && !reread2.asked && found.lead && !found.cannot) {
      await sayInChat(ctx, deps, p.id, fresh.snapshot, rereadAsk(found.lead, reread2.at, reread2), { items: [after.ref.itemId] });
      asked = found.lead.name;
      reread2 = { ...reread2, asked: true, waits: null };
    }
    const shown = briefCard(after.brief, fresh.snapshot.canvas);
    if (ctx.json) return deps.printJson({ ref: after.ref, card: shown, reread: reread2, asked });
    console.log(`${line.label}: ${act === "right" ? "now the person's word" : act === "wrong" ? opts.value ? `now \u201C${opts.value.trim()}\u201D` : "removed" : `now \u201C${opts.value.trim()}\u201D`} (brief ${after.ref.versionId})`);
    console.log(cardText(after, shown));
    if (reread2) console.log(`
${rereadText(reread2)}${asked ? `
  (asked ${asked} in the Chat)` : ""}`);
    else if (act === "right") console.log("\nRight changes no words, so nothing re-reads.");
    return;
  }
  const card = briefCard(row.brief, snapshot.canvas);
  const reread = await rereadOf(ctx, p.id, snapshot, row, whyNot);
  if (ctx.json) return deps.printJson({ request: row.brief.requestId, ref: row.ref, card, reread });
  console.log(cardText(row, card));
  if (reread) console.log(`
${rereadText(reread)}`);
}
export {
  designCard
};
