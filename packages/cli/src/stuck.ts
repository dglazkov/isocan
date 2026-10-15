import { critiqueCannot, nightLead, type Actor, type CanvasSnapshotResponse, type NightSeen } from "@isocan/core";
import {
  STUCK_AXES,
  stuckAll,
  stuckAnswerBody,
  stuckAnswered,
  stuckAxis,
  stuckQuestionBody,
  stuckQuestionOf,
  stuckQuestionRefusal,
  stuckSections,
  type Stuck,
  type StuckAnswer,
  type StuckTile,
} from "@isocan/core/stuck";
import type { Ctx } from "./ctx.ts";
import { sayInChat, type ExplainDeps } from "./explain.ts";

/**
 * **`isocan stuck [item]`** (proactive-agent phase 7, design §10) — stuck
 * detection, from a terminal. A top-level verb, as `ripple` and `explain`
 * are: it is about an exchange between a person and the agent answering them
 * on one item, not about the design system, and its question is not a design
 * request's (`design questions` needs an active brief; a person asking for a
 * fourth header usually has none).
 *
 * - `isocan stuck [item]`: whether anybody is stuck on the item (or on
 *   anything, with no item) — the tries that missed and what the behaviour
 *   says — and the lead's question with its guesses, or why it waits. Reads only.
 * - The lead's answer to a stuck ask: `--question --observe "…" (1–3)
 *   --tile "<axis> | <now> | <instead> | <now|instead>" (×4)` — a `record` in
 *   the Chat, instead of another take.
 * - The person's answer: `--answer <axis>=now|instead` (repeatable),
 *   `--extremes`, or `--product "<name>"` — an ordinary comment to the lead,
 *   which summons it and starts the count again.
 *
 * Loaded on this verb only, with main's helpers handed in (`propose.ts`'s reason).
 */
export interface StuckOpts {
  question?: boolean;
  observe?: string[];
  tile?: string[];
  answer?: string[];
  extremes?: boolean;
  product?: string;
}

/** The canvas's lead, and why it cannot answer this person — null when it can. */
async function leadFor(ctx: Ctx, canvas: { id: string; properties?: Record<string, string> }, snapshot: CanvasSnapshotResponse): Promise<{ lead: Actor | null; cannot: string | null }> {
  const [answering, sessions] = await Promise.all([ctx.client.rcAnswering(canvas.id).catch(() => null), ctx.client.listSessions(canvas.id).catch(() => [])]);
  const seen: NightSeen = { answering, sessions, ...(snapshot.joined ? { joined: snapshot.joined } : {}) };
  const lead = nightLead(snapshot.canvas, canvas.properties ?? {}, seen);
  return { lead: lead.agent?.actor ?? null, cannot: critiqueCannot(lead, ctx.actor.id, seen) ?? (lead.agent ? null : "no lead") };
}

/** The tries a stuck reading needs fall within fifteen minutes: the log's recent tail holds them. */
const LOOKBACK = 2000;

function tileOf(raw: string): StuckTile {
  const parts = raw.split("|").map((s) => s.trim());
  const axis = stuckAxis(parts[0] ?? "");
  if (parts.length !== 4 || !axis) throw new Error(`a tile is "<axis> | <now> | <instead> | <your guess: now or instead>", the axis one of ${STUCK_AXES.map((a) => a.id).join(", ")} — not "${raw}"`);
  if (parts[3] !== "now" && parts[3] !== "instead") throw new Error(`a tile's last part is your guess, now or instead — not "${parts[3]}"`);
  return { axis, now: parts[1]!, instead: parts[2]!, guess: parts[3] };
}

/** `isocan stuck [item] [--question … | --answer … | --extremes | --product …]`. */
export async function stuck(ctx: Ctx, deps: ExplainDeps, ref: string | undefined, opts: StuckOpts): Promise<void> {
  const { canvas: p, snapshot } = await deps.canvasAndSnapshot(ctx);
  const item = ref ? deps.resolveItem(snapshot, ref) : null;
  const log = await ctx.client.getLog(p.id, Math.max(0, snapshot.lastSeq - LOOKBACK));
  const all = stuckAll(log, Date.now());
  const found: Stuck | null = (item ? all.find((s) => s.itemId === item.id) : all[0]) ?? null;
  const titleOf = (s: Stuck | null) => (s ? snapshot.canvas.items[s.itemId]?.title : item?.title) || "Untitled";
  const title = titleOf(found);
  const acts = [opts.question, (opts.answer?.length ?? 0) > 0 || opts.extremes || opts.product !== undefined].filter(Boolean).length;
  if (acts > 1) throw new Error("one act at a time: the lead's --question, or the person's --answer / --extremes / --product");

  if (opts.question) {
    if (!item) throw new Error("the question is about one item: isocan stuck <item> --question …");
    const q = { observations: (opts.observe ?? []).map((o) => o.trim()).filter(Boolean), tiles: (opts.tile ?? []).map(tileOf) };
    const refused = stuckQuestionRefusal(found, title, q);
    if (refused) throw new Error(refused);
    if (stuckQuestionOf(snapshot.canvas, found!.at)) throw new Error(`the question for this ask is already in the Chat — \`isocan stuck ${item.id}\` shows it`);
    const posted = await sayInChat(ctx, deps, p.id, snapshot, stuckQuestionBody(found!, title, q), { record: true, items: [item.id] });
    if (ctx.json) return deps.printJson({ commentId: posted.commentId, at: found!.at });
    console.log(`asked ${found!.person.name} instead of guessing again at “${title}” (${posted.commentId}): what you noticed, and four pairs with your guesses`);
    return;
  }

  if ((opts.answer?.length ?? 0) > 0 || opts.extremes || opts.product !== undefined) {
    if (!found) throw new Error(`nobody is stuck on “${title}” — there is no question to answer`);
    const ways = [(opts.answer?.length ?? 0) > 0, opts.extremes, opts.product !== undefined].filter(Boolean).length;
    if (ways > 1) throw new Error("answer one way: the pairs (--answer), --extremes, or --product");
    let answer: StuckAnswer;
    if (opts.extremes) answer = { kind: "extremes" };
    else if (opts.product !== undefined) {
      if (!opts.product.trim()) throw new Error("--product names a product that gets it right");
      answer = { kind: "product", name: opts.product };
    } else {
      answer = {
        kind: "tiles",
        picks: opts.answer!.map((raw) => {
          const [k, side] = raw.split("=").map((s) => s.trim());
          const axis = stuckAxis(k ?? "");
          if (!axis || (side !== "now" && side !== "instead")) throw new Error(`an answer is <axis>=now|instead, the axis one of ${STUCK_AXES.map((a) => a.id).join(", ")} — not "${raw}"`);
          return { axis, side };
        }),
      };
    }
    if (stuckAnswered(snapshot.canvas, found.at)) throw new Error("this question was already answered");
    const { lead, cannot } = await leadFor(ctx, p, snapshot);
    if (cannot || !lead) throw new Error(`nothing can take the answer here: ${cannot ?? "no lead"}. The question waits.`);
    const posted = await sayInChat(ctx, deps, p.id, snapshot, stuckAnswerBody(lead, found.at, stuckQuestionOf(snapshot.canvas, found.at), answer), { items: [found.itemId] });
    if (ctx.json) return deps.printJson({ commentId: posted.commentId, lead, at: found.at });
    console.log(`told ${lead.name} (${posted.commentId}); the next take starts from your answer`);
    return;
  }

  if (!found) {
    if (ctx.json) return deps.printJson({ stuck: null });
    console.log(item ? `Nobody is stuck on “${item.title || "Untitled"}”: the agent asks instead of guessing once three tries in a row have missed.` : "Nobody is stuck on anything here.");
    return;
  }
  const q = stuckQuestionOf(snapshot.canvas, found.at);
  const { lead, cannot } = q ? { lead: q.by, cannot: null } : await leadFor(ctx, p, snapshot);
  const answered = stuckAnswered(snapshot.canvas, found.at);
  const waits = q ? null : found.pending ? cannot : `nothing has been asked since the last try — the next ask about “${title}” gets a question`;
  const sections = stuckSections(found, title, q, lead?.name ?? null, waits);
  if (ctx.json) return deps.printJson({ stuck: found, question: q, waits, answered, sections });
  console.log(`Stuck on “${title}” (${found.at}) · ${found.person.name}'s asks, ${found.tries.length} tries${answered ? " · answered" : ""}`);
  for (const s of sections) {
    console.log(`\n${s.heading}`);
    for (const l of s.lines) console.log(`  ${l.axis ? `${l.text.replace(/ · my guess: (now|instead)$/, "")}  ← my guess: ${l.guess}` : l.text}`);
  }
}
