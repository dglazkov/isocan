import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  sayInChat
} from "./chunk-KQFUOKET.mjs";
import "./chunk-GVV2HBNT.mjs";
import {
  STUCK_AXES,
  stuckAll,
  stuckAnswerBody,
  stuckAnswered,
  stuckAxis,
  stuckQuestionBody,
  stuckQuestionOf,
  stuckQuestionRefusal,
  stuckSections
} from "./chunk-VPIWVXRV.mjs";
import {
  critiqueCannot,
  nightLead
} from "./chunk-NGNONKZX.mjs";
import "./chunk-GUY4UN4O.mjs";
import "./chunk-K4TDP4L5.mjs";
import "./chunk-JYOOXWJZ.mjs";

// packages/cli/src/stuck.ts
async function leadFor(ctx, canvas, snapshot) {
  const [answering, sessions] = await Promise.all([ctx.client.rcAnswering(canvas.id).catch(() => null), ctx.client.listSessions(canvas.id).catch(() => [])]);
  const seen = { answering, sessions, ...snapshot.joined ? { joined: snapshot.joined } : {} };
  const lead = nightLead(snapshot.canvas, canvas.properties ?? {}, seen);
  return { lead: lead.agent?.actor ?? null, cannot: critiqueCannot(lead, ctx.actor.id, seen) ?? (lead.agent ? null : "no lead") };
}
var LOOKBACK = 2e3;
function tileOf(raw) {
  const parts = raw.split("|").map((s) => s.trim());
  const axis = stuckAxis(parts[0] ?? "");
  if (parts.length !== 4 || !axis) throw new Error(`a tile is "<axis> | <now> | <instead> | <your guess: now or instead>", the axis one of ${STUCK_AXES.map((a) => a.id).join(", ")} \u2014 not "${raw}"`);
  if (parts[3] !== "now" && parts[3] !== "instead") throw new Error(`a tile's last part is your guess, now or instead \u2014 not "${parts[3]}"`);
  return { axis, now: parts[1], instead: parts[2], guess: parts[3] };
}
async function stuck(ctx, deps, ref, opts) {
  const { canvas: p, snapshot } = await deps.canvasAndSnapshot(ctx);
  const item = ref ? deps.resolveItem(snapshot, ref) : null;
  const log = await ctx.client.getLog(p.id, Math.max(0, snapshot.lastSeq - LOOKBACK));
  const all = stuckAll(log, Date.now());
  const found = (item ? all.find((s) => s.itemId === item.id) : all[0]) ?? null;
  const titleOf = (s) => (s ? snapshot.canvas.items[s.itemId]?.title : item?.title) || "Untitled";
  const title = titleOf(found);
  const acts = [opts.question, (opts.answer?.length ?? 0) > 0 || opts.extremes || opts.product !== void 0].filter(Boolean).length;
  if (acts > 1) throw new Error("one act at a time: the lead's --question, or the person's --answer / --extremes / --product");
  if (opts.question) {
    if (!item) throw new Error("the question is about one item: isocan stuck <item> --question \u2026");
    const q2 = { observations: (opts.observe ?? []).map((o) => o.trim()).filter(Boolean), tiles: (opts.tile ?? []).map(tileOf) };
    const refused = stuckQuestionRefusal(found, title, q2);
    if (refused) throw new Error(refused);
    if (stuckQuestionOf(snapshot.canvas, found.at)) throw new Error(`the question for this ask is already in the Chat \u2014 \`isocan stuck ${item.id}\` shows it`);
    const posted = await sayInChat(ctx, deps, p.id, snapshot, stuckQuestionBody(found, title, q2), { record: true, items: [item.id] });
    if (ctx.json) return deps.printJson({ commentId: posted.commentId, at: found.at });
    console.log(`asked ${found.person.name} instead of guessing again at \u201C${title}\u201D (${posted.commentId}): what you noticed, and four pairs with your guesses`);
    return;
  }
  if ((opts.answer?.length ?? 0) > 0 || opts.extremes || opts.product !== void 0) {
    if (!found) throw new Error(`nobody is stuck on \u201C${title}\u201D \u2014 there is no question to answer`);
    const ways = [(opts.answer?.length ?? 0) > 0, opts.extremes, opts.product !== void 0].filter(Boolean).length;
    if (ways > 1) throw new Error("answer one way: the pairs (--answer), --extremes, or --product");
    let answer;
    if (opts.extremes) answer = { kind: "extremes" };
    else if (opts.product !== void 0) {
      if (!opts.product.trim()) throw new Error("--product names a product that gets it right");
      answer = { kind: "product", name: opts.product };
    } else {
      answer = {
        kind: "tiles",
        picks: opts.answer.map((raw) => {
          const [k, side] = raw.split("=").map((s) => s.trim());
          const axis = stuckAxis(k ?? "");
          if (!axis || side !== "now" && side !== "instead") throw new Error(`an answer is <axis>=now|instead, the axis one of ${STUCK_AXES.map((a) => a.id).join(", ")} \u2014 not "${raw}"`);
          return { axis, side };
        })
      };
    }
    if (stuckAnswered(snapshot.canvas, found.at)) throw new Error("this question was already answered");
    const { lead: lead2, cannot: cannot2 } = await leadFor(ctx, p, snapshot);
    if (cannot2 || !lead2) throw new Error(`nothing can take the answer here: ${cannot2 ?? "no lead"}. The question waits.`);
    const posted = await sayInChat(ctx, deps, p.id, snapshot, stuckAnswerBody(lead2, found.at, stuckQuestionOf(snapshot.canvas, found.at), answer), { items: [found.itemId] });
    if (ctx.json) return deps.printJson({ commentId: posted.commentId, lead: lead2, at: found.at });
    console.log(`told ${lead2.name} (${posted.commentId}); the next take starts from your answer`);
    return;
  }
  if (!found) {
    if (ctx.json) return deps.printJson({ stuck: null });
    console.log(item ? `Nobody is stuck on \u201C${item.title || "Untitled"}\u201D: the agent asks instead of guessing once three tries in a row have missed.` : "Nobody is stuck on anything here.");
    return;
  }
  const q = stuckQuestionOf(snapshot.canvas, found.at);
  const { lead, cannot } = q ? { lead: q.by, cannot: null } : await leadFor(ctx, p, snapshot);
  const answered = stuckAnswered(snapshot.canvas, found.at);
  const waits = q ? null : found.pending ? cannot : `nothing has been asked since the last try \u2014 the next ask about \u201C${title}\u201D gets a question`;
  const sections = stuckSections(found, title, q, lead?.name ?? null, waits);
  if (ctx.json) return deps.printJson({ stuck: found, question: q, waits, answered, sections });
  console.log(`Stuck on \u201C${title}\u201D (${found.at}) \xB7 ${found.person.name}'s asks, ${found.tries.length} tries${answered ? " \xB7 answered" : ""}`);
  for (const s of sections) {
    console.log(`
${s.heading}`);
    for (const l of s.lines) console.log(`  ${l.axis ? `${l.text.replace(/ · my guess: (now|instead)$/, "")}  \u2190 my guess: ${l.guess}` : l.text}`);
  }
}
export {
  stuck
};
