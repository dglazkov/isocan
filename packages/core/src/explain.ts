import type { Actor, CanvasContents, Comment, CommentThread, Item, TrashEntry } from "./model.ts";
import { parentOf } from "./lineage.ts";
import { laneFor } from "./lane.ts";
import { PROPOSAL_PROP, PROPOSAL_WHY_PROP, proposalCites, proposalsOf } from "./proposal.ts";
import { preferredOver } from "./preference.ts";
import { designSystem } from "./designsystem.ts";
import { FIDELITY_PROP } from "./design-scope.ts";
import { designWordSpans, plainReadings } from "./design-words.ts";
import type { DesignDecisionRecord } from "./design-decision.ts";
import { nightAnswerable, type NightLead, type NightSeen } from "./goodnight.ts";
import { ITEM_CHROME, itemChrome } from "./tidy.ts";
import { PLACEMENT_GAP, nearestFreeSpot } from "./placement.ts";
import { textRefit } from "./textnode.ts";

/**
 * **Explain this item** (proactive-agent phase 4, design §6).
 *
 * Somebody joins late, selects a screen and asks how it got here. The answer
 * is DERIVED, never generated: the item's versions and who made each, the
 * comment that made a version (`lane.ts`), a `choose` read off the trash the
 * way `settledToday` reads it, a design decision's adoption, `prefer`. Fifty
 * versions become the few moves that mattered — a run of edits by one hand
 * with nothing said is one move, and a move with a reason outranks one
 * without — so the CLI and the panel print one story from one function.
 *
 * Around it: **the roads not taken** (the variations a `choose` sent to the
 * trash, proposals somebody deleted, comparison options nobody adopted, what
 * it was preferred over) and **what moved since** its current version (a
 * newer DESIGN.md, newer versions of its relatives and group-mates).
 *
 * Two things are NOT derived, and are the canvas's lead agent's to say,
 * through the ordinary summons: the **critique** (what is working, a risk,
 * one thing to try — the last becomes a proposal citing `explain:`), and the
 * lead's own **speak design** pairs beside the glossary's. Both arrive as a
 * `record` comment (`critiqueBody`), so nothing here calls a model and a
 * canvas with nobody to answer still explains itself.
 *
 * Nothing here writes. *Copy as rationale* (`rationaleText`, `rationaleSpot`)
 * and *Critique* (`critiqueAsk`) are the two writes, and only when asked.
 */

/** How many moves Explain shows; a fifty-version item still reads as its key seams. */
const SEAMS = 4;
/** How close a version and a trashing must be to be one `choose` (one op group, sent together). */
const CHOOSE_WINDOW_MS = 60_000;
/** How long after a comment a version may still be the one it announced ("saying it, then saving it"). */
const LANE_AFTER_MS = 120_000;

/** Why a move was made, as the canvas recorded it at the time. */
interface MoveReason {
  text: string;
  source: "comment" | "variation" | "proposal" | "decision";
  commentId?: string;
  threadId?: string;
}

/** One move in an item's history: a run of versions by one hand, or one decisive version. */
interface ExplainMove {
  /** `made`: the first run; `edited`: a later run; `chose`: a variation folded in; `kept`: a proposal kept; `decided`: a design comparison adopted. */
  kind: "made" | "edited" | "chose" | "kept" | "decided";
  /** 1-based version numbers, the item's own badge: v`from`–v`to`. */
  from: number;
  to: number;
  versionId: string;
  /** The version before the move began, when there was one — what Compare holds it against. */
  before: string | null;
  who: Actor;
  at: string;
  reason: MoveReason | null;
  /** On `chose` and `kept`: what was folded in (now in the trash), and on `kept` who proposed it. */
  chosen?: { itemId: string; title: string; by: Actor; siblings: number };
}

/** One road not taken. */
interface ExplainRoad {
  kind: "variation" | "proposal" | "option" | "preferred";
  title: string;
  itemId: string | null;
  by: Actor | null;
  /** Its own reason: the comment that made it, its why, a hypothesis and trade-off. */
  why: string | null;
  where: "trash" | "canvas" | "gone";
}

/** One thing that moved around the item after its current version. */
interface ExplainMoved {
  kind: "design" | "item" | "proposal";
  itemId: string;
  title: string;
  /** Versions made after this item's current one. */
  newer: number;
  /** The newest of them, 1-based, and who made it. */
  latest: number;
  by: Actor;
  at: string;
}

/** A phrase somebody typed about the item, beside how a designer would say it. */
interface ExplainSpeak {
  said: string;
  designer: string;
  means: string | null;
  /** `glossary`: `design-words.ts` matched it; `lead`: the lead agent's critique paired it. */
  from: "glossary" | "lead";
  commentId: string;
}

/** The lead agent's critique, as its `record` comment carries it. */
interface ExplainCritique {
  commentId: string;
  threadId: string;
  by: Actor;
  at: string;
  working: string;
  risk: string;
  tryThis: string;
  /** The proposal citing `explain:<commentId>`, while it hangs beneath the item. */
  proposal: { itemId: string; title: string } | null;
}

/** The whole derived story of one item. */
export interface ExplainStory {
  itemId: string;
  title: string;
  versions: number;
  /** Every move, oldest first; `seams` picks the ones that mattered. */
  moves: ExplainMove[];
  roads: ExplainRoad[];
  moved: ExplainMoved[];
  speak: ExplainSpeak[];
  critique: ExplainCritique | null;
  /** A critique was asked for after the latest one, and has not arrived. */
  asked: boolean;
  /** Drawn at wireframe fidelity — `isocan wire why` explains its slots. */
  wire: boolean;
}

const clip = (text: string, n: number) => {
  const one = text.replace(/\s+/g, " ").trim();
  return one.length > n ? `${one.slice(0, n - 1)}…` : one;
};

/**
 * A comment's words as a reason: a `#itm_…` reference to the item the reason
 * is about goes (it is what the line is already about), any other becomes
 * that item's title, so a line reads as a sentence and not as ids.
 */
function saying(canvas: CanvasContents, body: string, about: string): string {
  return body.replace(/\s*#(itm_[\w-]+)/g, (whole, id: string) => (id === about ? "" : canvas.items[id] ? ` “${canvas.items[id]!.title}”` : whole)).trim();
}

/** Every comment on the canvas with its thread, oldest first. */
function allComments(canvas: CanvasContents): { thread: CommentThread; comment: Comment }[] {
  return Object.values(canvas.threads)
    .flatMap((thread) => thread.comments.map((comment) => ({ thread, comment })))
    .sort((a, b) => a.comment.createdAt.localeCompare(b.comment.createdAt));
}

/** The canvas with its trash put back, so `laneFor` can find the comment that made a variation now trashed. */
function withTrash(canvas: CanvasContents): CanvasContents {
  const items = { ...canvas.items };
  for (const t of canvas.trash) items[t.item.id] ??= t.item;
  return { ...canvas, items };
}

/**
 * The comment that made `itemId`'s version `n` (1-based) — the last comment
 * whose lane claims it. `laneFor`'s span is open after an author's last
 * word, which a Chat lane wants ("everything since belongs to this message")
 * and a history does not: a remark from Monday would claim Friday's edit. So
 * each comment is read against the versions that existed by the end of its
 * own grace (`LANE_AFTER_MS`); versions are append-only, so the numbers hold.
 */
function laneReasons(canvas: CanvasContents, itemId: string): Map<number, MoveReason> {
  const out = new Map<number, MoveReason>();
  const full = withTrash(canvas);
  const item = full.items[itemId];
  if (!item) return out;
  for (const { thread, comment } of allComments(canvas)) {
    if (!comment.items?.includes(itemId)) continue;
    const cutoff = new Date(Date.parse(comment.createdAt) + LANE_AFTER_MS).toISOString();
    const view = { ...full, items: { ...full.items, [itemId]: { ...item, versions: item.versions.filter((v) => v.createdAt <= cutoff) } } };
    for (const entry of laneFor(view, thread, comment)) {
      if (entry.itemId !== itemId) continue;
      out.set(entry.version, { text: clip(saying(full, comment.body, itemId), 140), source: "comment", commentId: comment.id, threadId: thread.id });
    }
  }
  return out;
}

/** The comment that made a variation (its first version), or its description. */
function variationReason(canvas: CanvasContents, variation: Item): MoveReason | null {
  const lane = laneReasons(canvas, variation.id);
  const made = lane.get(1) ?? [...lane.values()].at(-1);
  if (made) return made;
  const why = variation.properties[PROPOSAL_WHY_PROP];
  if (why) return { text: clip(why, 140), source: "proposal" };
  return variation.description.trim() ? { text: clip(variation.description, 140), source: "variation" } : null;
}

/** Adoption decisions on the canvas, each with the comment that carries it. */
function adoptions(canvas: CanvasContents): { record: DesignDecisionRecord; comment: Comment; thread: CommentThread }[] {
  return allComments(canvas).flatMap(({ thread, comment }) => {
    const record = comment.designDecision?.record;
    return record && record.kind === "adoption-decision" ? [{ record, comment, thread }] : [];
  });
}

/** The trash entries a `choose` of version `at` made: the item's children deleted with it, by the chooser. */
function chooseCohort(canvas: CanvasContents, itemId: string, at: string, who: string): TrashEntry[] {
  const t0 = Date.parse(at);
  return canvas.trash.filter((t) => parentOf(t.item) === itemId && t.deletedBy.id === who && Math.abs(Date.parse(t.deletedAt) - t0) <= CHOOSE_WINDOW_MS);
}

function currentHash(item: Item): string | undefined {
  return (item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions.at(-1))?.blobHash;
}

/**
 * **Every move in an item's history**, oldest first. A version stands alone
 * when it folded something in (`chose`, `kept`) or adopted a decision; the
 * rest gather into runs — one hand, consecutive versions — and a run ends at
 * a version a comment announced, so "made the total bigger" closes the run
 * it describes.
 */
function movesOf(canvas: CanvasContents, item: Item): ExplainMove[] {
  const lane = laneReasons(canvas, item.id);
  const decided = adoptions(canvas).filter(({ record }) => record.input.basis.target.artifact.itemId === item.id);
  const moves: ExplainMove[] = [];
  let open: ExplainMove | null = null;
  item.versions.forEach((version, i) => {
    const n = i + 1;
    const who = version.createdBy;
    const cohort = chooseCohort(canvas, item.id, version.createdAt, who.id);
    const winner = n > 1 ? cohort.find((t) => currentHash(t.item) === version.blobHash) : undefined;
    const decision = decided.find(({ record }) => record.input.versionId === version.id);
    if (winner) {
      const proposal = Boolean(winner.item.properties[PROPOSAL_PROP]);
      moves.push({
        kind: proposal ? "kept" : "chose",
        from: n, to: n, versionId: version.id, before: item.versions[i - 1]?.id ?? null, who, at: version.createdAt,
        reason: variationReason(canvas, winner.item),
        chosen: { itemId: winner.item.id, title: winner.item.title, by: winner.item.createdBy, siblings: cohort.length - 1 },
      });
      open = null;
      return;
    }
    if (decision) {
      const a = decision.record.input.authority;
      const text = ("reason" in a && a.reason) || ("rationale" in a && a.rationale) || decision.record.comparison.recommendation;
      moves.push({ kind: "decided", from: n, to: n, versionId: version.id, before: item.versions[i - 1]?.id ?? null, who: decision.comment.author, at: version.createdAt, reason: { text: clip(text, 140), source: "decision", commentId: decision.comment.id, threadId: decision.thread.id } });
      open = null;
      return;
    }
    if (open && open.who.id === who.id) {
      open.to = n;
      open.versionId = version.id;
      open.at = version.createdAt;
    } else {
      open = { kind: moves.length === 0 ? "made" : "edited", from: n, to: n, versionId: version.id, before: item.versions[i - 1]?.id ?? null, who, at: version.createdAt, reason: null };
      moves.push(open);
    }
    const said = lane.get(n);
    if (said) {
      open.reason = said;
      open = null;
    }
  });
  return moves;
}

/** The roads not taken: losers of a `choose`, deleted proposals, unadopted options, what it was preferred over. */
function roadsOf(canvas: CanvasContents, item: Item, moves: readonly ExplainMove[]): ExplainRoad[] {
  const roads: ExplainRoad[] = [];
  const seen = new Set<string>();
  const where = (id: string): ExplainRoad["where"] => (canvas.items[id] ? "canvas" : canvas.trash.some((t) => t.item.id === id) ? "trash" : "gone");
  const find = (id: string) => canvas.items[id] ?? canvas.trash.find((t) => t.item.id === id)?.item;
  const winners = new Set(moves.flatMap((m) => (m.chosen ? [m.chosen.itemId] : [])));
  for (const move of moves) {
    if (move.kind !== "chose") continue;
    for (const t of chooseCohort(canvas, item.id, move.at, move.who.id)) {
      if (winners.has(t.item.id) || seen.has(t.item.id) || t.item.properties[PROPOSAL_PROP]) continue;
      seen.add(t.item.id);
      roads.push({ kind: "variation", title: t.item.title, itemId: t.item.id, by: t.item.createdBy, why: variationReason(canvas, t.item)?.text ?? null, where: "trash" });
    }
  }
  for (const t of canvas.trash) {
    if (parentOf(t.item) !== item.id || !t.item.properties[PROPOSAL_PROP] || winners.has(t.item.id) || seen.has(t.item.id)) continue;
    seen.add(t.item.id);
    roads.push({ kind: "proposal", title: t.item.title, itemId: t.item.id, by: t.item.createdBy, why: t.item.properties[PROPOSAL_WHY_PROP] ?? null, where: "trash" });
  }
  for (const { record } of adoptions(canvas)) {
    if (record.input.basis.target.artifact.itemId !== item.id) continue;
    for (const option of record.comparison.alternatives) {
      if (option.id === record.input.chosenAlternativeId) continue;
      const id = option.artifact.itemId;
      if (seen.has(id)) continue;
      seen.add(id);
      roads.push({ kind: "option", title: option.title, itemId: id, by: record.recommendationAuthor, why: clip(`${option.hypothesis} Trade-off: ${option.tradeoff}`, 200), where: where(id) });
    }
  }
  for (const loser of preferredOver(item)) {
    if (seen.has(loser)) continue;
    seen.add(loser);
    const other = find(loser);
    roads.push({ kind: "preferred", title: other?.title ?? loser, itemId: loser, by: other?.createdBy ?? null, why: null, where: where(loser) });
  }
  return roads;
}

/** What moved since this item's current version: its design system, its relatives and group-mates, proposals beside it. */
function movedOf(canvas: CanvasContents, item: Item): ExplainMoved[] {
  const since = (item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions.at(-1))?.createdAt ?? item.createdAt;
  const out: ExplainMoved[] = [];
  const add = (kind: ExplainMoved["kind"], other: Item) => {
    const newer = other.versions.filter((v) => v.createdAt > since);
    const last = newer.at(-1);
    if (!last || out.some((m) => m.itemId === other.id)) return;
    out.push({ kind, itemId: other.id, title: other.title, newer: newer.length, latest: other.versions.indexOf(last) + 1, by: last.createdBy, at: last.createdAt });
  };
  const system = designSystem(canvas, { at: item });
  if (system && system.id !== item.id) add("design", system);
  for (const p of proposalsOf(canvas, item.id)) add("proposal", p);
  const parent = parentOf(item);
  const related = Object.values(canvas.items).filter(
    (other) =>
      other.id !== item.id &&
      other.id !== system?.id &&
      !other.properties[PROPOSAL_PROP] &&
      (other.id === parent || parentOf(other) === item.id || (parent !== null && parentOf(other) === parent) || (item.containerId !== undefined && other.containerId === item.containerId)),
  );
  for (const other of related.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))) add("item", other);
  return out.slice(0, 8);
}

// ---------- the critique, the lead's half

const CRITIQUE_HEAD = "Critique of ";
const ASK_MARK = "Critique, please:";

/**
 * **What *Critique* posts** — an ordinary summons to the lead, naming the
 * item and how to answer. The comment carries the item in `items`, so it is
 * found again by what it is about.
 */
export function critiqueAsk(lead: Actor, item: Pick<Item, "id" | "title">): string {
  return `@${lead.name} ${ASK_MARK} “${item.title || "Untitled"}” (${item.id}) — what is working, one risk, and one thing to try. Answer with \`isocan explain ${item.id} --critique\`; the thing to try goes beneath it as a proposal citing explain:.`;
}

/** The lead's critique as its `record` comment says it — the shape `readCritique` reads back. */
export function critiqueBody(item: Pick<Item, "title">, c: { working: string; risk: string; tryThis: string; speak?: readonly { said: string; designer: string }[] }): string {
  const one = (s: string) => clip(s, 280);
  return [
    `${CRITIQUE_HEAD}“${item.title || "Untitled"}”`,
    `Working: ${one(c.working)}`,
    `A risk: ${one(c.risk)}`,
    `One thing to try: ${one(c.tryThis)}`,
    ...(c.speak ?? []).map((s) => `Speak design: “${clip(s.said, 80)}” → ${clip(s.designer, 80)}`),
  ].join("\n");
}

/** `--speak "make it pop => raise its contrast"` — a pair, or why it is not one. */
export function parseSpeak(text: string): { said: string; designer: string } | { refused: string } {
  const [said, designer] = text.split(/\s*(?:=>|→)\s*/);
  return said?.trim() && designer?.trim() ? { said: said.trim(), designer: designer.trim() } : { refused: `"${text}" is not a pair — write "what was said => how a designer says it"` };
}

function readCritique(body: string): { working: string; risk: string; tryThis: string; speak: { said: string; designer: string }[] } | null {
  if (!body.startsWith(CRITIQUE_HEAD)) return null;
  const line = (label: string) => body.split("\n").find((l) => l.startsWith(label))?.slice(label.length).trim() ?? "";
  const speak = body.split("\n").flatMap((l) => {
    const m = /^Speak design: “(.*)” → (.*)$/.exec(l);
    return m ? [{ said: m[1]!, designer: m[2]! }] : [];
  });
  const out = { working: line("Working:"), risk: line("A risk:"), tryThis: line("One thing to try:"), speak };
  return out.working || out.risk || out.tryThis ? out : null;
}

/**
 * **Why nothing can critique here**, or null when the lead can answer — the
 * night watch's own reading of who leads and who is listening, said without
 * the night in it.
 */
export function critiqueCannot(lead: NightLead, personId: string, seen: NightSeen): string | null {
  return nightAnswerable(lead, personId, seen)?.replace(" to work overnight", "") ?? null;
}

// ---------- the story

/** Phrases typed about the item — its threads, and comments that #-reference it — matched against the glossary. */
function glossaryPairs(canvas: CanvasContents, item: Item): ExplainSpeak[] {
  const out: ExplainSpeak[] = [];
  for (const { thread, comment } of allComments(canvas)) {
    if (comment.body.startsWith(CRITIQUE_HEAD) || comment.body.includes(ASK_MARK)) continue;
    if (thread.anchorItemId !== item.id && !comment.items?.includes(item.id)) continue;
    for (const r of plainReadings(comment.body)) out.push({ said: r.said, designer: r.term, means: r.means, from: "glossary", commentId: comment.id });
  }
  return out;
}

/**
 * **The story of one item**, or why there is none. Read off the canvas
 * alone — no log, no model — so the CLI, the panel and a test on a fixture
 * all get the same answer.
 */
export function explainStory(canvas: CanvasContents, itemId: string): ExplainStory | { refused: string } {
  const item = canvas.items[itemId];
  if (!item) return { refused: `no item ${itemId} on this canvas` };
  if (item.versions.length === 0) return { refused: `"${item.title}" has no versions to explain` };
  const moves = movesOf(canvas, item);
  const comments = allComments(canvas).filter(({ comment }) => comment.items?.includes(item.id));
  const last = comments.filter(({ comment }) => comment.record && readCritique(comment.body)).at(-1);
  const read = last ? readCritique(last.comment.body)! : null;
  const critique: ExplainCritique | null = last && read
    ? {
        commentId: last.comment.id,
        threadId: last.thread.id,
        by: last.comment.author,
        at: last.comment.createdAt,
        working: read.working,
        risk: read.risk,
        tryThis: read.tryThis,
        proposal: (() => {
          const p = proposalsOf(canvas, item.id).find((one) => proposalCites(one).some((c) => c.kind === "explain" && c.ref === last.comment.id));
          return p ? { itemId: p.id, title: p.title } : null;
        })(),
      }
    : null;
  const asked = comments.some(({ comment }) => comment.body.includes(ASK_MARK) && (!critique || comment.createdAt > critique.at));
  const speak = [
    ...(read?.speak ?? []).map((s): ExplainSpeak => ({ said: s.said, designer: s.designer, means: null, from: "lead", commentId: last!.comment.id })),
    ...glossaryPairs(canvas, item),
  ].filter((s, i, all) => all.findIndex((o) => o.said.toLowerCase() === s.said.toLowerCase()) === i);
  return {
    itemId: item.id,
    title: item.title,
    versions: item.versions.length,
    moves,
    roads: roadsOf(canvas, item, moves),
    // The critique's own proposal is said under the critique, not again here.
    moved: movedOf(canvas, item).filter((m) => m.itemId !== critique?.proposal?.itemId),
    speak,
    critique,
    asked,
    wire: item.properties[FIDELITY_PROP] === "wireframe" || Boolean(item.properties.wireMaybe),
  };
}

/**
 * **The moves that mattered**: at most four — the first and the latest always,
 * then the decisive ones (a `choose`, a kept proposal, an adopted decision),
 * then those with a reason, then the longest runs — in the order they
 * happened.
 */
export function seams(story: ExplainStory): { moves: ExplainMove[]; hidden: number } {
  const all = story.moves;
  if (all.length <= SEAMS) return { moves: all, hidden: 0 };
  const rank = (m: ExplainMove, i: number) =>
    i === 0 || i === all.length - 1 ? 0 : m.kind === "chose" || m.kind === "kept" || m.kind === "decided" ? 1 : m.reason ? 2 : 3;
  const picked = all
    .map((m, i) => ({ m, i, r: rank(m, i) }))
    .sort((a, b) => a.r - b.r || (b.m.to - b.m.from) - (a.m.to - a.m.from) || a.i - b.i)
    .slice(0, SEAMS)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.m);
  return { moves: picked, hidden: all.length - picked.length };
}

// ---------- the words

/** One line of an explanation, with what a surface may link it to. */
export interface ExplainLine {
  text: string;
  itemId?: string;
  threadId?: string;
  trash?: boolean;
  /** The two versions a Compare opens on a move: the one before it, and its last (version ids). */
  compare?: { itemId: string; from: string; to: string };
}

/** One section: a heading and its lines. */
interface ExplainSection {
  key: "how" | "roads" | "moved" | "speak" | "critique" | "wire";
  heading: string;
  lines: ExplainLine[];
}

const range = (m: ExplainMove) => (m.from === m.to ? `v${m.from}` : `v${m.from}–v${m.to}`);
const count = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/** The design words a reason uses. */
function termsIn(text: string): string[] {
  const named = designWordSpans(text).flatMap((s) => (s.word ? [s.word.term] : []));
  return [...new Set([...named, ...plainReadings(text).map((r) => r.term)])];
}

function moveLine(story: ExplainStory, m: ExplainMove): ExplainLine {
  const n = m.to - m.from + 1;
  const why = m.reason ? `“${m.reason.text}”` : null;
  const did =
    m.kind === "made" ? (n > 1 ? `drafted it over ${count(n, "version")}` : "drafted it") :
    m.kind === "edited" ? (n > 1 ? `iterated (${count(n, "version")})` : "revised it") :
    m.kind === "chose" ? `chose “${m.chosen!.title}”${m.chosen!.siblings ? ` over ${count(m.chosen!.siblings, "other take")}` : ""}` :
    m.kind === "kept" ? `kept ${m.chosen!.by.name}'s proposal “${m.chosen!.title}”` :
    "adopted an option from a design comparison";
  const terms = m.reason ? termsIn(m.reason.text) : [];
  const text = `${range(m)} · ${m.who.name} ${did} — ${why ?? "no reason recorded"}${terms.length ? ` (${terms.join(", ")})` : ""}`;
  return {
    text,
    ...(m.reason?.threadId ? { threadId: m.reason.threadId } : {}),
    ...(m.before ? { compare: { itemId: story.itemId, from: m.before, to: m.versionId } } : {}),
  };
}

const ROAD_KIND: Record<ExplainRoad["kind"], string> = { variation: "a variation", proposal: "a proposal, deleted", option: "an option not adopted", preferred: "passed over for this one" };
const WHERE: Record<ExplainRoad["where"], string> = { trash: "in the trash", canvas: "still on the canvas", gone: "no longer anywhere" };

/**
 * **The explanation, in sections** — what `isocan explain` prints and the
 * panel draws, so the two say one thing. Empty optional sections (roads not
 * taken, critique before one arrives) are omitted rather than shown as empty
 * placeholders.
 */
export function explainSections(story: ExplainStory): ExplainSection[] {
  const out: ExplainSection[] = [];
  const { moves, hidden } = seams(story);
  const how = moves.map((m) => moveLine(story, m));
  if (hidden) how.push({ text: `…and ${count(hidden, "smaller move")}.` });
  out.push({ key: "how", heading: `How it got here — ${count(story.versions, "version")}, ${count(story.moves.length, "move")}`, lines: how });

  if (story.roads.length) {
    const roads = story.roads.map((r): ExplainLine => {
      const by = r.by ? ` by ${r.by.name}` : "";
      const why = r.why ? ` — ${r.why}` : "";
      return { text: `“${r.title}”, ${ROAD_KIND[r.kind]}${by}, ${WHERE[r.where]}${why}`, ...(r.itemId && r.where !== "gone" ? { itemId: r.itemId } : {}), ...(r.where === "trash" ? { trash: true } : {}) };
    });
    out.push({ key: "roads", heading: "The roads not taken", lines: roads });
  }

  const moved = story.moved.map((m): ExplainLine => {
    const what = m.kind === "design" ? `the design system “${m.title}”` : m.kind === "proposal" ? `a proposal beside it, “${m.title}”` : `“${m.title}”`;
    const text = `${what}: ${count(m.newer, "newer version")} (now v${m.latest}, ${m.by.name})${m.kind === "design" ? " — this version may not reflect it" : ""}`;
    return { text, itemId: m.itemId };
  });
  out.push({ key: "moved", heading: "What moved around it since", lines: moved.length ? moved : [{ text: "Nothing: its design system and its neighbours are as they were." }] });

  const speak = story.speak.slice(0, 4).map((s): ExplainLine => ({
    text: `“${s.said}” → ${s.designer}${s.means ? ` — ${s.means}` : ""}`,
  }));
  out.push({ key: "speak", heading: "Speak design", lines: speak.length ? speak : [{ text: "Nothing typed about it yet that a designer would say differently." }] });

  const c = story.critique;
  if (c) {
    out.push({
      key: "critique",
      heading: `${c.by.name}'s critique`,
      lines: [
        { text: `Working: ${c.working}`, threadId: c.threadId },
        { text: `A risk: ${c.risk}` },
        { text: `One thing to try: ${c.tryThis}${c.proposal ? " — a proposal beneath it" : ""}`, ...(c.proposal ? { itemId: c.proposal.itemId } : {}) },
        ...(story.asked ? [{ text: "Another critique was asked for and has not arrived yet." }] : []),
      ],
    });
  }
  if (story.wire) out.push({ key: "wire", heading: "A wire", lines: [{ text: `Drawn at wireframe fidelity: \`isocan wire why ${story.itemId}\` gives each slot's recorded decision and its runner-up.` }] });
  return out;
}

/** `isocan explain`'s words: the sections, as a terminal prints them. */
export function explainText(story: ExplainStory): string {
  const out = [`Explain “${story.title}” (${story.itemId})`];
  for (const s of explainSections(story)) out.push("", s.heading, ...s.lines.map((l) => `  - ${l.text}`));
  return out.join("\n");
}

/**
 * **Copy as rationale**: the explanation as a note somebody outside the team
 * can read — the moves, the roads not taken, what moved, the critique when
 * there is one — in Markdown, dated, saying where it came from.
 */
export function rationaleText(story: ExplainStory, now: number): string {
  const out = [`# Why “${story.title}” looks like this`, ""];
  for (const s of explainSections(story)) {
    out.push(`## ${s.heading}`, ...s.lines.map((l) => `- ${l.text}`), "");
  }
  out.push(`Written from the canvas's own history by Explain, ${new Date(now).toISOString().slice(0, 10)}.`, "");
  return out.join("\n");
}

/**
 * **Where a rationale stands**: to the right of the item, top-aligned with
 * it, moved by core's free-spot search until its footprint lands on nobody's
 * — one answer for both surfaces. Returns the box and the top-left to send as
 * `chosen`.
 */
export function rationaleSpot(canvas: CanvasContents, item: Item, body: string): { width: number; height: number; x: number; y: number } {
  const fit = textRefit({ width: 420, height: 0 }, body, "body", "sans") ?? { width: 420, height: 0 };
  const box = { width: fit.width, height: Math.ceil(fit.height * 1.1) };
  const foot = (b: { x: number; y: number; width: number; height: number }, above: number, below: number) => ({ x: b.x, y: b.y - above, width: b.width, height: b.height + above + below });
  const want = foot({ x: item.x + item.width + PLACEMENT_GAP, y: item.y, ...box }, ITEM_CHROME.above, ITEM_CHROME.below);
  const spot = nearestFreeSpot(want, Object.values(canvas.items).map((i) => { const c = itemChrome(i); return foot(i, c.above, c.below); }));
  return { ...box, x: spot.x, y: spot.y + ITEM_CHROME.above };
}
