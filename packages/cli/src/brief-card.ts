import {
  critiqueCannot,
  newOpId,
  newVersionId,
  nightLead,
  type Actor,
  type CanvasSnapshotResponse,
  type DesignBrief,
  type NightSeen,
} from "@isocan/core";
import {
  BRIEF_MODES,
  briefCard,
  briefChanges,
  briefEditPatch,
  briefReread,
  briefScreens,
  findBriefLine,
  rereadAnswer,
  rereadAsk,
  rereadAsked,
  rereadBody,
  rereadQuestionRefusal,
  type BriefCard,
  type BriefEdit,
  type BriefReread,
  type RereadAt,
} from "@isocan/core/brief-card";
import { parseDesignBrief } from "@isocan/core/design-brief";
import { CanvasHandle, type DesignRequestView } from "@isocan/api";
import type { Ctx } from "./ctx.ts";
import { sayInChat, type ExplainDeps } from "./explain.ts";

/**
 * **`isocan design card [request]`** (proactive-agent phase 5, design §7) —
 * the brief as a card, from a terminal: the same six lines the canvas draws
 * (core `briefCard`), said ones solid and inferred ones in pencil, and the
 * same three edits through the same door the card uses (`design brief
 * --update`):
 *
 * - `--right <line>`: an inferred line becomes the person's;
 * - `--wrong <line> [--value …]`: it goes, and the right value takes its place;
 * - `--set <line> --value …`: the person's own words for a line.
 *
 * An edit changes nothing on the canvas; it re-reads. The card prints which
 * screens assumed the old line and which still hold, and asks the canvas's
 * lead, in the Chat, for the ones that matter more now and ONE clarifying
 * question — which the lead answers with `--reread --matters … --question …`.
 * With nobody to answer, the edit still lands and the re-read says it waits.
 *
 * Loaded on this verb only, with main's helpers handed in (`propose.ts`'s reason).
 */
export interface BriefCardOpts {
  right?: string;
  wrong?: string;
  set?: string;
  value?: string;
  reread?: boolean;
  matters?: string[];
  question?: string;
}

/** The re-read of the brief's latest version, with where the lead's half stands. */
interface CardReread extends BriefReread {
  at: RereadAt;
  by: string;
  answer: ReturnType<typeof rereadAnswer>;
  asked: boolean;
  waits: string | null;
}

/** The canvas's lead, and why it cannot answer this person — or null when it can. */
async function leadFor(ctx: Ctx, canvas: { id: string; properties?: Record<string, string> }, snapshot: CanvasSnapshotResponse): Promise<{ lead: Actor | null; cannot: string | null }> {
  const [answering, sessions] = await Promise.all([ctx.client.rcAnswering(canvas.id).catch(() => null), ctx.client.listSessions(canvas.id).catch(() => [])]);
  const seen: NightSeen = { answering, sessions, ...(snapshot.joined ? { joined: snapshot.joined } : {}) };
  const lead = nightLead(snapshot.canvas, canvas.properties ?? {}, seen);
  return { lead: lead.agent?.actor ?? null, cannot: critiqueCannot(lead, ctx.actor.id, seen) ?? (lead.agent ? null : "no lead") };
}

/** The brief this verb is about: the one named, else the canvas's one active request. */
function pick(rows: DesignRequestView[], request: string | undefined): DesignRequestView {
  if (request) {
    const row = rows.find((r) => r.brief.requestId === request);
    if (!row) throw new Error(`no design request "${request}" here — \`isocan design brief\` lists them`);
    return row;
  }
  const active = rows.filter((r) => r.brief.progress === "active");
  const one = active.length === 1 ? active[0] : rows.length === 1 ? rows[0] : undefined;
  if (one) return one;
  if (!rows.length) throw new Error("no design brief on this canvas yet — a design request starts one (`isocan design start`)");
  throw new Error(`${rows.length} design requests here; name one: ${rows.map((r) => r.brief.requestId).join(", ")}`);
}

/** The brief as it stood one version before this one, when there is one. */
async function previous(ctx: Ctx, canvasId: string, snapshot: CanvasSnapshotResponse, row: DesignRequestView): Promise<DesignBrief | null> {
  const versions = snapshot.canvas.items[row.ref.itemId]?.versions ?? [];
  const at = versions.findIndex((v) => v.id === row.ref.versionId);
  const before = at > 0 ? versions[at - 1] : undefined;
  if (!before?.designRecord) return null;
  return parseDesignBrief(JSON.parse(Buffer.from(await ctx.client.downloadBlob(canvasId, before.blobHash)).toString("utf8")));
}

/** The re-read of the brief's latest version — null when that version changed no line. */
async function rereadOf(ctx: Ctx, canvasId: string, snapshot: CanvasSnapshotResponse, row: DesignRequestView, whyNot: () => Promise<string | null>): Promise<CardReread | null> {
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
  const waits = answer || asked ? null : (await whyNot()) ?? "nobody has asked the lead yet";
  return { ...sorted, at, by: version?.createdBy.name ?? "somebody", answer, asked, waits };
}

function cardText(row: DesignRequestView, card: BriefCard): string {
  const out = [`Brief “${row.brief.primaryTask || "a design request"}” (${row.brief.requestId} · ${row.ref.itemId}@${row.ref.versionId})`];
  const width = Math.max(...card.lines.map((l) => l.label.length));
  for (const l of card.lines) {
    const rule = l.value === null ? " " : l.said ? "━" : "┄";
    const how = l.value === null ? "not said yet" : l.said ? "said" : l.origin === "sensed" ? `sensed from the canvas — the request: ${card.intent}` : l.origin === "context" ? "read from context" : "assumed";
    out.push(`  ${rule} ${l.label.padEnd(width)}  ${l.value ?? "—"} · ${how}${l.value !== null && !l.said ? ` · Right / Wrong: --right ${l.cite} | --wrong ${l.cite}` : ""}`);
  }
  if (card.quiet) out.push(`  (${card.quiet} more inferred line${card.quiet === 1 ? "" : "s"} wait unshown: four at a time)`);
  out.push(`A proposal answering a line cites it: --cites brief:${card.lines.map((l) => l.cite).join("|")}`);
  return out.join("\n");
}

function rereadText(r: CardReread): string {
  const names = (rows: { title: string; because?: string }[]) => rows.map((x) => `“${x.title}”${x.because ? ` — ${x.because}` : ""}`).join("; ") || "none";
  return [
    `Re-read after ${r.by} changed ${r.changes.map((c) => `“${c.label}”: ${c.before === null ? "nothing" : `“${c.before}”`} → ${c.after === null ? "nothing" : `“${c.after}”`}`).join("; ")}`,
    "  Nothing on the canvas changed.",
    `  Assumed the old line: ${names(r.old)}`,
    `  Matters more now: ${r.answer ? names(r.more) : "the lead's call — not yet made"}`,
    `  Still holds: ${names(r.holds)}`,
    r.answer ? `  ${r.answer.by.name} asks: ${r.answer.question}` : r.asked ? "  Asked the lead; the re-read's question has not come yet." : `  The re-read waits: ${r.waits}`,
  ].join("\n");
}

/** `isocan design card [request] [--right|--wrong|--set <line> [--value …] | --reread --matters … --question …]`. */
export async function designCard(ctx: Ctx, deps: ExplainDeps, request: string | undefined, opts: BriefCardOpts): Promise<void> {
  const { canvas: p, snapshot } = await deps.canvasAndSnapshot(ctx);
  const handle = new CanvasHandle(ctx, p);
  const row = pick((await handle.designBrief(request ? { requestId: request } : {})).requests, request);
  const whyNot = async () => (await leadFor(ctx, p, snapshot)).cannot;
  const acts = (["right", "wrong", "set"] as const).filter((a) => opts[a] !== undefined);
  if (acts.length > 1 || (acts.length && opts.reread)) throw new Error("one edit at a time: --right, --wrong or --set, or the lead's --reread");

  if (opts.reread) {
    const reread = await rereadOf(ctx, p.id, snapshot, row, whyNot);
    if (!reread) throw new Error("nothing to re-read: the brief's latest version changed no line");
    const refused = rereadQuestionRefusal(opts.question ?? "");
    if (refused) throw new Error(refused);
    const screens = new Set(briefScreens(snapshot.canvas, row.brief).map((s) => s.id));
    const matters = (opts.matters ?? []).map((ref) => {
      const item = deps.resolveItem(snapshot, ref);
      if (!screens.has(item.id)) throw new Error(`“${item.title}” is not one of the brief's screens — matters more now names screens`);
      return item;
    });
    const posted = await sayInChat(ctx, deps, p.id, snapshot, rereadBody(reread.at, matters, opts.question!), { record: true, items: [row.ref.itemId, ...matters.map((m) => m.id)] });
    if (ctx.json) return deps.printJson({ commentId: posted.commentId, at: reread.at, matters: matters.map((m) => m.id) });
    console.log(`the re-read is in the Chat (${posted.commentId}): ${matters.length ? `${matters.map((m) => `“${m.title}”`).join(", ")} matter${matters.length === 1 ? "s" : ""} more now; ` : ""}asked: ${opts.question!.trim()}`);
    return;
  }

  if (acts.length) {
    const act = acts[0]!;
    const card = briefCard(row.brief, snapshot.canvas);
    const name = opts[act]!;
    const line = findBriefLine(card, name);
    if (!line) throw new Error(`no line "${name}" on the card — making, for, feel, never, constraints, now, or a fact's name`);
    if (act === "set" && opts.value === undefined) throw new Error(`--set says the new words with --value "…"${line.key === "now" ? ` (${BRIEF_MODES.join(", ")})` : ""}`);
    const edit: BriefEdit = act === "right" ? { act } : act === "wrong" ? { act, ...(opts.value !== undefined ? { value: opts.value } : {}) } : { act, value: opts.value! };
    const patch = briefEditPatch(row.brief, line, edit);
    if ("refused" in patch) throw new Error(patch.refused);
    if (!row.allowedActions.includes("update")) throw new Error(`the brief cannot be edited now${row.reasons.length ? `: ${row.reasons.join(" ")}` : ` (${row.brief.progress})`}`);
    const result = await handle.designChange({ action: { kind: "update", brief: row.ref, epoch: row.brief.epoch, versionId: newVersionId(), patch }, opId: newOpId() });
    if (result.status !== "accepted") throw new Error(result.reason ?? `the edit was ${result.status}`);
    // Read the canvas again: the edit made a new version of the brief, and only that.
    const fresh = await deps.canvasAndSnapshot(ctx);
    const after = pick((await handle.designBrief({ requestId: row.brief.requestId })).requests, row.brief.requestId);
    const found = await leadFor(ctx, p, fresh.snapshot);
    let reread = await rereadOf(ctx, p.id, fresh.snapshot, after, async () => found.cannot);
    let asked: string | null = null;
    if (reread && !reread.answer && !reread.asked && found.lead && !found.cannot) {
      await sayInChat(ctx, deps, p.id, fresh.snapshot, rereadAsk(found.lead, reread.at, reread), { items: [after.ref.itemId] });
      asked = found.lead.name;
      reread = { ...reread, asked: true, waits: null };
    }
    const shown = briefCard(after.brief, fresh.snapshot.canvas);
    if (ctx.json) return deps.printJson({ ref: after.ref, card: shown, reread, asked });
    console.log(`${line.label}: ${act === "right" ? "now the person's word" : act === "wrong" ? (opts.value ? `now “${opts.value.trim()}”` : "removed") : `now “${opts.value!.trim()}”`} (brief ${after.ref.versionId})`);
    console.log(cardText(after, shown));
    if (reread) console.log(`\n${rereadText(reread)}${asked ? `\n  (asked ${asked} in the Chat)` : ""}`);
    else if (act === "right") console.log("\nRight changes no words, so nothing re-reads.");
    return;
  }

  const card = briefCard(row.brief, snapshot.canvas);
  const reread = await rereadOf(ctx, p.id, snapshot, row, whyNot);
  if (ctx.json) return deps.printJson({ request: row.brief.requestId, ref: row.ref, card, reread });
  console.log(cardText(row, card));
  if (reread) console.log(`\n${rereadText(reread)}`);
}
