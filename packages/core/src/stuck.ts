import type { Actor, CanvasContents, Comment } from "./model.ts";
import type { LogEntry, NewComment } from "./ops.ts";
// Through the index, not the files: the CLI loads this module lazily while
// every command loads the index, and a direct import would split `lineage.ts`
// and `undone.ts` into chunks of their own that `--version` then loads
// (`test/cli-bundle.test.ts` counts them).
import { PARENT_PROP, undoneSeqs } from "./index.ts";

/**
 * **Stuck detection** (proactive-agent phase 7, design §10).
 *
 * A person asks for a new header four times in ten minutes, each ask shorter
 * ("again", "no"), and each take is set aside within a minute. A fourth take
 * would be a fourth guess. The agent should stop, say it has been guessing,
 * and ask with pictures instead.
 *
 * This is the deterministic half: **whether the last tries at one item, by
 * one person, all missed** (`stuckOn`), read from the oplog the way
 * `evals.ts` reads it — asks, the results that followed them, and which of
 * those were taken back (`undoneSeqs`, never `LogEntry.undoneBy`, which does
 * not travel). It writes nothing and calls no model. The other half is the
 * lead's, through the ordinary summons: what it noticed in the takes ("you
 * kept the photo every time") and the four tiles' words, posted as one
 * record (`stuckQuestionBody`) that both surfaces draw (`stuckSections`).
 *
 * **What counts** — chosen 14 Oct 2026, Dion to confirm:
 *
 * - **An ask about the item**: the person's comment that summons somebody (an
 *   @-mention, or anything in the Chat) and is about the item — its thread is
 *   anchored there, or it names the item (`#ref` or the selection), or it
 *   names nothing and the person's previous ask in the same thread was about
 *   it ("again", "no").
 * - **A try**: an ask answered by somebody else's work on the item before the
 *   person's next ask about it — a new version of it, or a new item made from
 *   it (`parent=`).
 * - **A miss**: every result of the try was undone, set aside (the item's
 *   current version moved off it) or deleted; or the person asked again
 *   within `STUCK_QUICK_MS` of it; or asked again with fewer words than the
 *   try's own ask (asks getting shorter). Anything else is a **keep**, and a
 *   keep starts the count again — so does an answer to the stuck question.
 * - **Stuck**: the last `STUCK_TRIES` tries were all misses, from the first
 *   of them to the newest ask within `STUCK_WINDOW_MS`, and not longer ago
 *   than that.
 *
 * Its own export path (`@isocan/core/stuck`), so none of this reaches the
 * web's entry chunk: the stuck card loads it, the CLI loads it on
 * `isocan stuck`, and the rc on a summons.
 */

/** Tries in a row that all missed before the agent stops guessing. */
export const STUCK_TRIES = 3;
/** The tries and the ask after them fall within this, and the newest is no older (ms). */
export const STUCK_WINDOW_MS = 15 * 60_000;
/** Asked again this soon after a take, the take did not land (ms). */
export const STUCK_QUICK_MS = 2 * 60_000;

/** The four now-and-instead pairs (design §10), fixed for now — chosen 14 Oct 2026, Dion to confirm. */
export const STUCK_AXES = [
  { id: "density", name: "Density" },
  { id: "brand", name: "Brand expression" },
  { id: "layout", name: "Layout" },
  { id: "tone", name: "Tone of voice" },
] as const;

type AxisId = (typeof STUCK_AXES)[number]["id"];

/** How a try missed. */
type Fate = "undone" | "set aside" | "deleted" | "asked again" | "asked shorter";

/** One try: an ask, and what became of the work that answered it. */
interface StuckTry {
  askId: string;
  ask: string;
  at: string;
  /** Who answered it with work. */
  by: Actor;
  /** The versions of the item it made, and the items it made from it. */
  versionIds: string[];
  childIds: string[];
  fate: Fate;
  /** From the take to its fate (ms). */
  afterMs: number;
}

/** A person, stuck on one item: the tries that missed, the ask waiting, and what a person can read in them. */
export interface Stuck {
  itemId: string;
  person: Actor;
  /** The misses in a row, oldest first (at least `STUCK_TRIES`). */
  tries: StuckTry[];
  /** The ask after the last miss that nothing has answered yet — the one that should get a question, not a take. */
  pending: { commentId: string; at: string; ask: string } | null;
  /** No ask had more words than the one before it, and the last had fewer than the first. */
  shorter: boolean;
  /** The question's address: `<item> · <ask>` — the ask it answers. */
  at: string;
  /** What the behaviour says, in words — not what the takes held; that is the lead's to notice. */
  facts: string[];
}

interface Ask {
  seq: number;
  commentId: string;
  ts: number;
  at: string;
  body: string;
  person: Actor;
  items: Set<string>;
  answer: boolean;
}

interface Result {
  seq: number;
  ts: number;
  itemId: string;
  by: Actor;
  versionId?: string;
  childId?: string;
}

const STUCK_MARK = "Stuck question";
const ANSWER_MARK = "Stuck answer";

/** What an ask says, without its mentions and references. */
function words(body: string): string[] {
  return body
    .replace(/@[\w'’.-]+/g, " ")
    .replace(/#[\w'’.-]+/g, " ")
    .replace(/[^\p{L}\p{N}']+/gu, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

/** Every ask by a person in the log, with the items it is about. */
function asksIn(entries: readonly LogEntry[], undone: Map<number, number>): Ask[] {
  const anchor = new Map<string, string | null>();
  const main = new Map<string, boolean>();
  const last = new Map<string, Set<string>>();
  const out: Ask[] = [];
  for (const entry of entries) {
    const op = entry.envelope.op;
    if (op.type === "thread.setAnchor") anchor.set(op.threadId, op.anchorItemId ?? null);
    if (op.type === "thread.setMain" && op.threadId) main.set(op.threadId, true);
    if (op.type !== "thread.create" && op.type !== "thread.reply") continue;
    if (op.type === "thread.create") {
      anchor.set(op.threadId, op.anchorItemId);
      if (op.main) main.set(op.threadId, true);
    }
    if (entry.cause || undone.has(entry.seq)) continue;
    const comment: NewComment = op.comment;
    if (comment.record || comment.click || comment.deleted || comment.goodnight) continue;
    const inMain = main.get(op.threadId);
    const summons = (comment.mentions?.length ?? 0) > 0 || inMain === true || (inMain === undefined && (comment.items?.length ?? 0) > 0);
    if (!summons) continue;
    const person = entry.envelope.actor;
    const key = `${person.id} ${op.threadId}`;
    const named = new Set([...(comment.items ?? []), ...(anchor.get(op.threadId) ? [anchor.get(op.threadId)!] : [])]);
    const items = named.size ? named : new Set(last.get(key) ?? []);
    if (named.size) last.set(key, named);
    out.push({ seq: entry.seq, commentId: comment.id, ts: Date.parse(entry.envelope.ts), at: entry.envelope.ts, body: comment.body, person, items, answer: comment.body.includes(`${ANSWER_MARK} (`) });
  }
  return out;
}

/** Somebody's work on the item: a new version of it, or an item made from it. */
function resultOf(entry: LogEntry, itemId: string): Result | null {
  const op = entry.envelope.op;
  const base = { seq: entry.seq, ts: Date.parse(entry.envelope.ts), itemId, by: entry.envelope.actor };
  if ((op.type === "item.addVersion" || op.type === "item.edit") && op.itemId === itemId) return { ...base, versionId: op.version.id };
  if (op.type === "item.add" && op.properties?.[PARENT_PROP] === itemId) return { ...base, childId: op.itemId };
  return null;
}

/** When a result went — undone, set aside or deleted — before the next take replaced it (`horizon`, a seq), or null. */
function goneAt(entries: readonly LogEntry[], undone: Map<number, number>, r: Result, horizon: number): { fate: Fate; ts: number } | null {
  const undo = undone.get(r.seq);
  let best: { fate: Fate; ts: number } | null = null;
  const take = (fate: Fate, ts: number) => {
    if (!best || ts < best.ts) best = { fate, ts };
  };
  if (undo !== undefined) {
    const e = entries.find((x) => x.seq === undo);
    if (e) take("undone", Date.parse(e.envelope.ts));
  }
  for (const e of entries) {
    if (e.seq <= r.seq || e.seq >= horizon || e.cause || undone.has(e.seq)) continue;
    const op = e.envelope.op;
    if (r.versionId && op.type === "item.setCurrentVersion" && op.itemId === r.itemId && op.versionId !== r.versionId) take("set aside", Date.parse(e.envelope.ts));
    if (r.childId && ((op.type === "item.delete" && op.itemId === r.childId) || (op.type === "items.delete" && op.itemIds.includes(r.childId)))) take("deleted", Date.parse(e.envelope.ts));
  }
  return best;
}

const FATE_WORDS: Record<Fate, string> = {
  undone: "undone",
  "set aside": "set aside",
  deleted: "deleted",
  "asked again": "asked for again within two minutes",
  "asked shorter": "asked for again in fewer words",
};
const minutes = (ms: number) => Math.max(1, Math.round(ms / 60_000));
const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;
const quote = (s: string) => `“${s.replace(/\s+/g, " ").trim().slice(0, 60)}${s.trim().length > 60 ? "…" : ""}”`;
const COUNT = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
const count = (n: number) => COUNT[n] ?? String(n);

/** The person's tries at one item, each with its fate, oldest first; and the asks themselves. */
type Counted = StuckTry & { askSeq: number; kept: boolean; answer: boolean };

function triesAt(entries: readonly LogEntry[], itemId: string, actorId: string): { tries: Counted[]; asks: Ask[] } {
  const undone = undoneSeqs(entries);
  const asks = asksIn(entries, undone).filter((a) => a.person.id === actorId && a.items.has(itemId));
  const tries: Counted[] = [];
  // Each ask's results first: a take's fate is read only until the next take replaces it.
  const answered = asks.map((ask, i) => {
    const next = asks[i + 1];
    const results: Result[] = [];
    for (const e of entries) {
      if (e.seq <= ask.seq || (next && e.seq >= next.seq)) continue;
      if (e.cause || e.envelope.actor.id === actorId) continue;
      const r = resultOf(e, itemId);
      if (r) results.push(r);
    }
    return results;
  });
  for (const [i, ask] of asks.entries()) {
    const next = asks[i + 1];
    const results = answered[i]!;
    if (!results.length) continue;
    const horizon = answered.slice(i + 1).find((r) => r.length)?.[0]?.seq ?? Infinity;
    const lastTs = Math.max(...results.map((r) => r.ts));
    const gone = results.map((r) => goneAt(entries, undone, r, horizon));
    let fate: Fate | null = null;
    let afterMs = 0;
    if (gone.every((g) => g !== null)) {
      const latest = gone.reduce((a, b) => (b!.ts > a!.ts ? b : a))!;
      fate = latest.fate;
      afterMs = Math.max(0, latest.ts - lastTs);
    } else if (next && next.ts - lastTs <= STUCK_QUICK_MS) {
      fate = "asked again";
      afterMs = Math.max(0, next.ts - lastTs);
    } else if (next && !next.answer && words(next.body).length < words(ask.body).length) {
      fate = "asked shorter";
      afterMs = Math.max(0, next.ts - lastTs);
    }
    tries.push({
      askId: ask.commentId,
      askSeq: ask.seq,
      ask: ask.body,
      at: ask.at,
      by: results[0]!.by,
      versionIds: results.flatMap((r) => (r.versionId ? [r.versionId] : [])),
      childIds: results.flatMap((r) => (r.childId ? [r.childId] : [])),
      fate: fate ?? "asked again",
      afterMs,
      kept: fate === null,
      answer: ask.answer,
    });
  }
  return { tries, asks };
}

/**
 * **Is this person stuck on this item?** The misses in a row, the ask that
 * waits after them, and what the behaviour says — or null. Deterministic over
 * the log: the same entries give the same answer on every surface. `now`
 * (ms, default the newest entry's time) decides "not longer ago than the
 * window": a person who comes back tomorrow is not stuck from yesterday.
 */
export function stuckOn(entries: readonly LogEntry[], itemId: string, actorId: string, now?: number): Stuck | null {
  const { tries, asks } = triesAt(entries, itemId, actorId);
  // The trailing run of misses. A keep ends it; an answer to the stuck question starts a new one.
  let start = tries.length;
  while (start > 0) {
    const t = tries[start - 1]!;
    if (t.kept) break;
    start -= 1;
    if (t.answer) break;
  }
  const run = tries.slice(start);
  if (run.length < STUCK_TRIES) return null;
  const lastTry = run.at(-1)!;
  const after = asks.filter((a) => a.seq > lastTry.askSeq);
  // An answer to the stuck question is the way out, not another ask.
  if (after.some((a) => a.answer)) return null;
  const pendingAsk = after.find((a) => !tries.some((t) => t.askSeq === a.seq)) ?? null;
  const counted = run.slice(-STUCK_TRIES);
  const first = Date.parse(counted[0]!.at);
  const newest = pendingAsk ? pendingAsk.ts : Date.parse(lastTry.at) + lastTry.afterMs;
  if (newest - first > STUCK_WINDOW_MS) return null;
  const clock = now ?? Date.parse(entries.at(-1)?.envelope.ts ?? new Date(0).toISOString());
  if (clock - newest > STUCK_WINDOW_MS) return null;
  const said = [...run.map((t) => t.ask), ...(pendingAsk ? [pendingAsk.body] : [])].map((b) => words(b).length);
  const shorter = said.length > 1 && said.every((n, i) => i === 0 || n <= said[i - 1]!) && said.at(-1)! < said[0]!;
  const person = asks[0]!.person;
  const fates = new Map<Fate, number>();
  for (const t of run) fates.set(t.fate, (fates.get(t.fate) ?? 0) + 1);
  const how = [...fates].map(([f, n]) => `${count(n)} ${FATE_WORDS[f]}`).join(", ");
  const quickest = Math.min(...run.map((t) => t.afterMs));
  const facts = [
    `${count(run.length).replace(/^./, (c) => c.toUpperCase())} tries in ${plural(minutes(newest - Date.parse(run[0]!.at)), "minute")}, and none of them landed: ${how}.`,
    `The quickest went after ${quickest < 60_000 ? plural(Math.max(1, Math.round(quickest / 1000)), "second") : plural(minutes(quickest), "minute")}.`,
    ...(shorter ? [`The asks got shorter: ${[...run.map((t) => t.ask), ...(pendingAsk ? [pendingAsk.body] : [])].map((b) => quote(words(b).join(" ") || b)).join(" → ")}.`] : []),
  ];
  return {
    itemId,
    person,
    tries: run.map(({ askSeq: _s, kept: _k, answer: _a, ...t }) => t),
    pending: pendingAsk ? { commentId: pendingAsk.commentId, at: pendingAsk.at, ask: pendingAsk.body } : null,
    shorter,
    at: `${itemId} · ${(pendingAsk?.commentId ?? lastTry.askId)}`,
    facts,
  };
}

/**
 * **Everyone stuck, on anything** — one reading per person and item, newest
 * first. What a surface reads when it has no item in hand: the person's own
 * card, `isocan stuck` with no item, and the rc finding the item a Chat ask
 * was about.
 */
export function stuckAll(entries: readonly LogEntry[], now?: number): Stuck[] {
  const undone = undoneSeqs(entries);
  const pairs = new Map<string, { itemId: string; actorId: string }>();
  for (const ask of asksIn(entries, undone)) for (const itemId of ask.items) pairs.set(`${ask.person.id} ${itemId}`, { itemId, actorId: ask.person.id });
  return [...pairs.values()]
    .flatMap(({ itemId, actorId }) => {
      const s = stuckOn(entries, itemId, actorId, now);
      return s ? [s] : [];
    })
    .sort((a, b) => Date.parse(b.pending?.at ?? b.tries.at(-1)!.at) - Date.parse(a.pending?.at ?? a.tries.at(-1)!.at));
}

// ---------- the lead's question, and the person's answer

/** One now-and-instead pair, and which side the lead would bet on. */
export interface StuckTile {
  axis: AxisId;
  now: string;
  instead: string;
  guess: "now" | "instead";
}

/** The lead's question: what it noticed, and the four tiles. */
export interface StuckQuestion {
  observations: string[];
  tiles: StuckTile[];
}

const axisName = (id: AxisId) => STUCK_AXES.find((a) => a.id === id)!.name;

/** `density`, `Brand expression`, `tone of voice` → the axis, or null. */
export function stuckAxis(raw: string): AxisId | null {
  const k = raw.trim().toLowerCase();
  return STUCK_AXES.find((a) => a.id === k || a.name.toLowerCase() === k || a.name.toLowerCase().split(" ")[0] === k)?.id ?? null;
}

/**
 * Why the question may not be posted, or null: the person must be stuck on
 * the item (the agent asks instead of guessing, not instead of working); one
 * to three observations, each one sentence, none saying the person is stuck
 * (the agent owns the miss); the four axes, each once, both sides said, and a
 * guess on every one.
 */
export function stuckQuestionRefusal(stuck: Stuck | null, title: string, q: StuckQuestion): string | null {
  if (!stuck) return `nobody is stuck on “${title}”: ask a question when ${STUCK_TRIES} tries in a row have missed — until then, answer the ask with a take`;
  if (!q.observations.length) return "say what you noticed in what they kept and undid: --observe \"You kept the photo every time.\" (one to three)";
  if (q.observations.length > 3) return "three observations at most — what you noticed, not everything that happened";
  for (const o of q.observations) {
    if (o.length > 160 || (o.match(/[.!?](\s|$)/g) ?? []).length > 1) return "an observation is one sentence";
    if (/\b(you|you're|you are|they|they're)\b[^.!?]*\bstuck\b/i.test(o)) return "never say the person is stuck — you have been guessing; say what you noticed";
  }
  const seen = new Set<AxisId>();
  for (const t of q.tiles) {
    if (seen.has(t.axis)) return `“${axisName(t.axis)}” is asked twice`;
    seen.add(t.axis);
    if (!t.now.trim() || !t.instead.trim()) return `“${axisName(t.axis)}” says both sides: now and instead`;
    if (t.now.length > 80 || t.instead.length > 80) return `“${axisName(t.axis)}” is a tile, not a paragraph — eighty characters a side`;
    if ([t.now, t.instead].some((s) => s.includes(" · ") || s.includes("\n"))) return "a tile's words are one line, without “ · ”";
  }
  const missing = STUCK_AXES.filter((a) => !seen.has(a.id));
  if (missing.length) return `the question has four pairs — ${missing.map((a) => a.name).join(", ")} ${missing.length === 1 ? "is" : "are"} missing: --tile "${missing[0]!.id} | now | instead" --guess ${missing[0]!.id}=now|instead`;
  return null;
}

/** The question, as its `record` comment says it — the shape `stuckQuestionOf` reads back. */
export function stuckQuestionBody(stuck: Stuck, title: string, q: StuckQuestion): string {
  const one = (s: string) => s.replace(/\s+/g, " ").trim();
  const tiles = STUCK_AXES.map((a) => q.tiles.find((t) => t.axis === a.id)!);
  return [
    `${STUCK_MARK} (${stuck.at})`,
    `I've been guessing at “${one(title)}”, so I've stopped making new takes. Here is what I noticed, and a question instead.`,
    ...q.observations.map((o) => `Noticed: ${one(o)}`),
    ...tiles.map((t) => `${axisName(t.axis)} — now: ${one(t.now)} · instead: ${one(t.instead)} · my guess: ${t.guess}`),
    "Or: show me extremes · name a product that gets it right",
  ].join("\n");
}

function comments(canvas: CanvasContents): Comment[] {
  return Object.values(canvas.threads).flatMap((t) => t.comments).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** The lead's question for this stuck reading (`Stuck.at`), if it has come. */
export function stuckQuestionOf(canvas: CanvasContents, at: string): (StuckQuestion & { by: Actor; commentId: string }) | null {
  const head = `${STUCK_MARK} (${at})`;
  const c = comments(canvas).filter((one) => one.record && one.body.startsWith(head)).at(-1);
  if (!c) return null;
  const lines = c.body.split("\n");
  const tiles: StuckTile[] = [];
  for (const l of lines) {
    const m = /^(.+?) — now: (.*) · instead: (.*) · my guess: (now|instead)$/.exec(l);
    const axis = m && STUCK_AXES.find((a) => a.name === m[1])?.id;
    if (m && axis) tiles.push({ axis, now: m[2]!, instead: m[3]!, guess: m[4] as "now" | "instead" });
  }
  return { by: c.author, commentId: c.id, observations: lines.filter((l) => l.startsWith("Noticed: ")).map((l) => l.slice(9)), tiles };
}

/** How the person answers: a side per tile, or one of the two ways out. */
export type StuckAnswer =
  | { kind: "tiles"; picks: Array<{ axis: AxisId; side: "now" | "instead" }> }
  | { kind: "extremes" }
  | { kind: "product"; name: string };

/** The person's answer, as an ordinary comment to the lead: it summons, and it resets the count. */
export function stuckAnswerBody(lead: Pick<Actor, "name">, at: string, q: StuckQuestion | null, a: StuckAnswer): string {
  const head = `@${lead.name} ${ANSWER_MARK} (${at}):`;
  if (a.kind === "extremes") return `${head} show me extremes — one take at each end of every pair, side by side, so I can point.`;
  if (a.kind === "product") return `${head} a product that gets it right — ${a.name.replace(/\s+/g, " ").trim()}. Work from what it does, not from my last asks.`;
  const said = a.picks.map((p) => {
    const tile = q?.tiles.find((t) => t.axis === p.axis);
    return `${axisName(p.axis)}: ${p.side}${tile ? ` (${p.side === "now" ? tile.now : tile.instead})` : ""}`;
  });
  return `${head} ${said.join("; ")}. Make one take from these.`;
}

/** Whether this stuck reading has been answered — by anybody's `Stuck answer (…)` comment. */
export function stuckAnswered(canvas: CanvasContents, at: string): boolean {
  return comments(canvas).some((c) => c.body.includes(`${ANSWER_MARK} (${at})`));
}

// ---------- one reading, for the card and the terminal

/** One section as both surfaces show it. */
interface StuckSection {
  key: "guessing" | "noticed" | "tiles" | "ways" | "waits";
  heading: string;
  lines: Array<{ text: string; axis?: AxisId; now?: string; instead?: string; guess?: "now" | "instead" }>;
}

/**
 * **The stuck reading, in sections** — the card draws them and `isocan stuck`
 * prints them, so the two say the same. The heading names who made the
 * takes; `lead` is who was asked, `waits` why the question has not come
 * (null once it has).
 */
export function stuckSections(stuck: Stuck, title: string, q: StuckQuestion | null, lead: string | null, waits: string | null): StuckSection[] {
  const who = q ? "I've" : `${stuck.tries.at(-1)!.by.name} has`;
  const out: StuckSection[] = [{ key: "guessing", heading: `${who} been guessing at “${title}”`, lines: stuck.facts.map((text) => ({ text })) }];
  if (!q) {
    out.push({ key: "waits", heading: "The question", lines: [{ text: waits ? `The question waits: ${waits}` : `Asked ${lead ?? "the lead"}: a question instead of another take, on its way.` }] });
    return out;
  }
  out.push({ key: "noticed", heading: "What I noticed — say if I'm wrong", lines: q.observations.map((text) => ({ text })) });
  out.push({
    key: "tiles",
    heading: "Now, or instead?",
    lines: STUCK_AXES.flatMap((a) => {
      const t = q.tiles.find((x) => x.axis === a.id);
      return t ? [{ text: `${a.name} — now: ${t.now} · instead: ${t.instead} · my guess: ${t.guess}`, axis: a.id, now: t.now, instead: t.instead, guess: t.guess }] : [];
    }),
  });
  out.push({ key: "ways", heading: "Or", lines: [{ text: "Show me extremes" }, { text: "Name a product that gets it right" }] });
  return out;
}
