import {
  contributions,
  firstWordClashes,
  fractionOfAnchor,
  homageNameProblems,
  parsePersona,
  titleSlug,
  type CanvasContents,
  type CommentThread,
  type ContributionPoint,
  type CoreModule,
  type Item,
  type Persona,
  type SlashCommand,
} from "@isocan/core";

/**
 * **Critique** (`docs/projects/critique/`) — critics on the canvas. A critic
 * points and explains; it never touches.
 *
 * Phase 0 is the critic itself: **a markdown item in the persona format**,
 * read by core's `parsePersona` and nothing else, with four keys a critic
 * adds (`critic`, `agentName`, `credit`, `color`) and the persona's own
 * `budget`. Seeded from a roster (`critique.critics`, a point this module
 * declares and design-competition's nine packs are contributed to) or written
 * by hand. From then on the item is the critic: a person's edit changes the
 * next critique, because there is no second copy to disagree with.
 *
 * It adds no operation. A critic is an item, marked with one property so it
 * can be found without reading every item's bytes; take the module away and
 * every critic is a markdown note with some front matter.
 */

/** The property that marks a critic item — its `name`, so a search can say
 *  which. The text stays the source of truth for everything else. */
export const CRITIC_PROP = "critique.critic";

/** The point a roster is contributed to. */
export const CRITICS_POINT = "critique.critics";

/** What one critique may spend, for the shipped roster and a skeleton:
 *  six turns and $0.40 (`design.md` §6). */
export const DEFAULT_BUDGET = { usdPerRun: 0.4, turnsPerRun: 6 } as const;

/** How the naming rule words a critic's refusal. */
const CRITIC_WORDS = { noun: "critic", subject: "the critic", line: "the credit line" };

/**
 * **A roster entry** — the part of a design-competition pack a critic needs,
 * read from the same records rather than a copy of them. Its lens is the
 * `critique.md` beside it (`dir`, or `assets/packs/<id>/`), relative to the
 * module that contributed it.
 */
export interface RosterCritic {
  id: string;
  title: string;
  agentName: string;
  /** "after Jony Ive & Apple". */
  credit: string;
  /** Who it is after. */
  name: string;
  /** The line that says it is not affiliated. */
  homage: string;
  colour: string;
  /** The three questions, used when the lens file is not there. */
  critique: readonly string[];
  dir?: string;
  self?: boolean;
}

const nonEmpty = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

/** What is wrong with a roster entry, in sentences — empty when it may be offered. */
export function rosterProblems(value: unknown): string[] {
  if (!value || typeof value !== "object") return ["a critic is an object"];
  const p = value as Partial<RosterCritic>;
  const problems: string[] = [];
  for (const key of ["id", "title", "agentName", "credit", "name", "homage", "colour"] as const) {
    if (!nonEmpty(p[key])) problems.push(`${key} is missing`);
  }
  if (problems.length > 0) return problems;
  if (!/^[a-z][a-z0-9-]{1,31}$/.test(p.id!)) problems.push(`id "${p.id}" is not a short lowercase slug`);
  if (!/^#[0-9a-fA-F]{6}$/.test(p.colour!)) problems.push(`colour "${p.colour}" is not #rrggbb`);
  if (!Array.isArray(p.critique) || p.critique.length !== 3 || !p.critique.every(nonEmpty)) problems.push("critique is three questions");
  problems.push(...homageNameProblems(
    { agentName: p.agentName!, person: p.name!, affiliation: p.homage!, ...(p.self ? { self: true } : {}) },
    { noun: "critic", subject: "the pack", line: "the homage line" },
  ));
  return problems;
}

/** The point, declared here and validated by the function above. */
const CRITICS: ContributionPoint = {
  id: CRITICS_POINT,
  describe: "critics a canvas can add — data: a pack record (id, agentName, credit, colour, three questions) and a critique.md beside it",
  validate: rosterProblems,
};

/** One roster entry and the module whose files it names. */
export interface RosterEntry {
  module: string;
  critic: RosterCritic;
}

/** **The roster**: every accepted contribution, first-word clashes refused.
 *  Empty when nothing contributes — `critic new` still works then. */
export function roster(): RosterEntry[] {
  return rosterFrom(contributions<RosterCritic>(CRITICS_POINT));
}

/**
 * **The roster from contributions read somewhere else** — the browser's, off
 * the daemon's registry (`/api/points/critique.critics`), which is the one
 * `roster()` reads in the terminal. Each is checked again here, and the
 * first-word clashes refused the same way.
 */
export function rosterFrom(found: readonly { module: string; value: unknown }[]): RosterEntry[] {
  const all = found.filter(({ value }) => rosterProblems(value).length === 0).map(({ module, value }) => ({ module, critic: value as RosterCritic }));
  const clashes = new Set(firstWordClashes(all.map(({ critic }) => critic)).map((c) => c.id));
  return all.filter(({ critic }) => !clashes.has(critic.id));
}

/** `Form Follows Emotion` → `form-follows-emotion`: a critic's `name`. */
export function criticSlug(agentName: string): string {
  // ASCII, because a critic's name is also its filename and its mention.
  return titleSlug(agentName, { max: 32, ascii: true }) || "critic";
}

/** A roster entry by what somebody types: its id, its slug, its agent name or its title. */
export function findInRoster(list: readonly RosterEntry[], ref: string): RosterEntry | null {
  const q = ref.trim().toLowerCase();
  if (!q) return null;
  return list.find(({ critic }) => critic.id === q || criticSlug(critic.agentName) === q || critic.agentName.toLowerCase() === q || critic.title.toLowerCase() === q) ?? null;
}

/**
 * **The canvas's critic by what somebody types** — the one resolver every
 * verb that names a critic on a canvas uses (`critique --by`, `critic
 * release`). A card answers to its id (`name`), its agent name, and the
 * first word a mention finds it by; and, because the card does not carry
 * the roster id it was added under, a roster ref (`ive`, `Inevitable`, the
 * title) is read through `findInRoster` — the matcher `critic add` uses —
 * to the card wearing that entry's agent name.
 */
export function findCritic<T extends { critic: { name: string; agentName: string } }>(
  on: readonly T[],
  ref: string,
  list: readonly RosterEntry[] = roster(),
): T | undefined {
  const q = ref.trim().replace(/^@/, "").toLowerCase();
  if (!q) return undefined;
  const named = (agentName: string) => on.find(({ critic }) => critic.agentName.toLowerCase() === agentName.toLowerCase());
  const direct = on.find(({ critic }) => critic.name.toLowerCase() === q || critic.agentName.toLowerCase() === q || mentionWord(critic.agentName).toLowerCase() === q);
  if (direct) return direct;
  const entry = findInRoster(list, q);
  return entry ? named(entry.critic.agentName) : undefined;
}

/** Where a roster entry's lens is, relative to the module that contributed it. */
export function lensPath(critic: RosterCritic): string {
  return `${(critic.dir ?? `assets/packs/${critic.id}`).replace(/\/+$/, "")}/critique.md`;
}

/** The three parts of a lens a critic carries. */
export interface Lens {
  questions: string[];
  looksFor: string;
  ranks: string;
}

const LOOKS_FOR = "What it looks for first";
const RANKS = "How it ranks";

/** One `## Heading`'s prose, trimmed — "" when the heading is not there. */
function section(body: string, heading: string): string {
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim().toLowerCase() === `## ${heading}`.toLowerCase());
  if (start < 0) return "";
  const end = lines.findIndex((l, i) => i > start && /^#{1,2}\s/.test(l));
  return lines.slice(start + 1, end < 0 ? undefined : end).join("\n").trim();
}

/**
 * **A lens, read off markdown**: the numbered lines before the first `##`
 * are the questions — empty ones included, so a skeleton reads as three
 * unwritten questions rather than none — and the two headings' prose. The
 * same reader for a pack's `critique.md` and a critic item's body.
 */
export function readLens(markdown: string): Lens {
  const head = markdown.split(/^##\s/m)[0] ?? "";
  const questions = [...head.matchAll(/^\s*\d+\.[ \t]*(.*)$/gm)].map((m) => m[1]!.trim());
  return { questions, looksFor: section(markdown, LOOKS_FOR), ranks: section(markdown, RANKS) };
}

/** What a critic item says, as one record. */
export interface Critic {
  /** Its id on this canvas — the persona's `name`. */
  name: string;
  agentName: string;
  credit: string;
  color?: string;
  self: boolean;
  budget?: Persona["budget"];
  questions: string[];
  looksFor: string;
  ranks: string;
}

const unquote = (s: string | undefined) => (s ?? "").replace(/^["']|["']$/g, "").trim();

/**
 * **Read a critic item** — through `parsePersona`, the one reader of the
 * format; null when the text is not a persona marked `critic: true`.
 */
export function readCritic(text: string, filename = "critic.md"): Critic | null {
  const persona = parsePersona(text, filename);
  if (!persona || unquote(persona.extra["critic"]).toLowerCase() !== "true") return null;
  const lens = readLens(persona.body);
  const agentName = unquote(persona.extra["agentName"]);
  return {
    name: persona.name,
    agentName,
    credit: unquote(persona.extra["credit"]),
    ...(persona.color ? { color: persona.color } : {}),
    self: unquote(persona.extra["self"]).toLowerCase() === "true",
    ...(persona.budget ? { budget: persona.budget } : {}),
    ...lens,
  };
}

/**
 * **Who a credit line is after**: "after Jony Ive & Apple; not affiliated" →
 * "Jony Ive & Apple". The first clause — up to a semicolon or a comma —
 * without its leading "after" or a trailing "'s work". Read whether or not
 * it says "after", so a credit of just "Jony Ive; not affiliated" still
 * keeps "Jony" out of the agent's name.
 */
export function creditPerson(credit: string): string {
  return (credit.split(/[;,]/)[0] ?? "")
    .replace(/^\s*after\s+/i, "")
    .replace(/[’']s\s+work\s*$/i, "")
    .trim();
}

/** What the naming rule reads off a critic or a draft of one. */
type Named = { agentName: string; credit: string; self?: boolean };

/** What is wrong with one critic, alone — the competition's naming rule. */
export function criticProblems(critic: Named): string[] {
  if (!nonEmpty(critic.agentName)) return ["agentName is missing — it is what a mention finds the critic by"];
  if (!nonEmpty(critic.credit)) return ["credit is missing — a critic says who it is after, and that it is not affiliated"];
  return homageNameProblems(
    { agentName: critic.agentName, person: creditPerson(critic.credit), affiliation: critic.credit, ...(critic.self ? { self: true } : {}) },
    CRITIC_WORDS,
  );
}

/** One critic on a canvas, with the item it lives in. */
export interface CanvasCritic {
  itemId: string;
  critic: Critic;
}

/**
 * **Why a new critic may not join these**, in words — or null. A second copy
 * of one critic is refused first (edit the card instead), then a first-word
 * clash, then the naming rule.
 */
export function refuseJoin(on: readonly CanvasCritic[], next: Named & { name: string }): string | null {
  const same = on.find(({ critic }) => critic.name === next.name || critic.agentName.toLowerCase() === next.agentName.toLowerCase());
  if (same) return `${same.critic.agentName} is already on this canvas (${same.itemId}) — edit that card rather than adding a second`;
  const clash = firstWordClashes([...on.map(({ critic }) => ({ id: critic.name, agentName: critic.agentName })), { id: next.name, agentName: next.agentName }])
    .find((c) => c.id === next.name);
  if (clash) return clash.problem;
  const problems = criticProblems(next);
  return problems.length ? problems.join("; ") : null;
}

/** Every first-word clash among a canvas's critics — `critic ls` says so. */
export function canvasClashes(on: readonly CanvasCritic[]): { id: string; problem: string }[] {
  return firstWordClashes(on.map(({ critic }) => ({ id: critic.name, agentName: critic.agentName })));
}

/** The items marked as critics. */
export function criticItems(items: Readonly<Record<string, Item>>): Item[] {
  return Object.values(items).filter((item) => item.properties[CRITIC_PROP] !== undefined);
}

/** What a critic item is written from. */
export interface CriticDraft {
  name: string;
  agentName: string;
  credit: string;
  color?: string;
  self?: boolean;
  lens: Lens;
}

/**
 * **A critic item's text** — front matter in the persona's shape, then the
 * lens: the questions, numbered, and the two headings. `readCritic` of this
 * returns the draft back, which the test holds.
 */
export function criticMarkdown(draft: CriticDraft): string {
  const q = draft.lens.questions.length ? draft.lens.questions : ["", "", ""];
  return [
    "---",
    `name: ${draft.name}`,
    `description: A critic — ${draft.credit}. It points and explains; it never edits.`,
    "critic: true",
    `agentName: ${draft.agentName}`,
    `credit: ${draft.credit}`,
    ...(draft.color ? [`color: "${draft.color}"`] : []),
    ...(draft.self ? ["self: true"] : []),
    "budget:",
    `  usd per run: ${DEFAULT_BUDGET.usdPerRun.toFixed(2)}`,
    `  turns per run: ${DEFAULT_BUDGET.turnsPerRun}`,
    "---",
    "",
    `# ${draft.agentName}`,
    "",
    ...q.map((line, i) => `${i + 1}. ${line}`.trimEnd()),
    "",
    `## ${LOOKS_FOR}`,
    "",
    ...(draft.lens.looksFor ? [draft.lens.looksFor, ""] : []),
    `## ${RANKS}`,
    "",
    ...(draft.lens.ranks ? [draft.lens.ranks, ""] : []),
  ].join("\n");
}

/** A roster entry as a draft: the pack's credit with "not affiliated" said
 *  outright, its colour, and its lens. */
export function draftFromRoster(critic: RosterCritic, lens: Lens): CriticDraft {
  return {
    name: criticSlug(critic.agentName),
    agentName: critic.agentName,
    credit: critic.self ? critic.credit : `${critic.credit}; not affiliated`,
    color: critic.colour,
    ...(critic.self ? { self: true } : {}),
    lens,
  };
}

/**
 * **A skeleton** for `critic new`: three empty questions and the two
 * headings. `after` names who it is after; `self` says the author made it of
 * themselves and may carry their own name. With neither, it is after nobody.
 */
export function skeletonDraft(agentName: string, opts: { after?: string; self?: boolean } = {}): CriticDraft {
  const after = opts.after?.trim();
  const credit = after
    ? opts.self ? `after ${after}, by ${after}` : `after ${after}; not affiliated`
    : opts.self ? "by its author" : "original; not affiliated with anyone";
  return { name: criticSlug(agentName), agentName: agentName.trim(), credit, ...(opts.self ? { self: true } : {}), lens: { questions: ["", "", ""], looksFor: "", ranks: "" } };
}

/* ---- Phase 1: asking, and the note ------------------------------------ */

/** The template a critic's working directory is written from. */
export const CRITIC_TEMPLATE = "critique.critic";

/** What a note says the critic found. *Working* is a finding as much as
 *  *risk*: "leave it" is advice. */
export const NOTE_KINDS = ["working", "risk", "blocker"] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];

const KIND_WORD: Record<NoteKind, string> = { working: "Working", risk: "Risk", blocker: "Blocker" };

/** The word a mention finds a critic by — the first of its agent name
 *  (`rosterClashes` keeps two critics from sharing one). */
export function mentionWord(agentName: string): string {
  return agentName.trim().split(/\s+/)[0] ?? agentName;
}

/**
 * **A note's text**: the first line is the verb's — `**Risk** · question 2 ·
 * *What could go…?*` — and the rest is the critic's. The kind and the
 * question are written here and never by the model, so a critic's prose
 * cannot promote itself to a blocker.
 */
export function noteBody(note: { kind: NoteKind; question: number; questionText?: string; text: string }): string {
  const asked = note.questionText?.trim() ? ` · *${note.questionText.trim().replace(/\*/g, "")}*` : "";
  return `**${KIND_WORD[note.kind]}** · question ${note.question}${asked}\n${note.text.trim()}`;
}

const FIRST_LINE = /^\*\*(Working|Risk|Blocker)\*\* · question (\d+)(?: · \*(.*)\*)?$/;

/** A note's text read back — null when its first line is not the verb's. */
export function readNoteBody(body: string): { kind: NoteKind; question: number; questionText: string; text: string } | null {
  const [first = "", ...rest] = body.split("\n");
  const m = FIRST_LINE.exec(first.trim());
  if (!m) return null;
  return { kind: m[1]!.toLowerCase() as NoteKind, question: Number(m[2]), questionText: m[3] ?? "", text: rest.join("\n").trim() };
}

/** One critic's note, as the read (phase 3's fold) will take it. */
export interface CritiqueNote {
  threadId: string;
  /** Who wrote it, by name and id: the thread's author. */
  critic: string;
  criticId: string;
  item: string;
  /** Where on the item, as fractions of its size. */
  at: { x: number; y: number };
  kind: NoteKind;
  question: number;
  text: string;
  createdAt: string;
}

/** A thread read as a note — null when it is not one: not anchored to a live
 *  item, or its first comment not in the note's shape. */
export function readNote(thread: CommentThread, items: Readonly<Record<string, Item>>): CritiqueNote | null {
  const item = thread.anchorItemId ? items[thread.anchorItemId] : undefined;
  const first = thread.comments[0];
  if (!item || !first || thread.main) return null;
  const note = readNoteBody(first.body);
  if (!note) return null;
  return {
    threadId: thread.id,
    critic: first.author.name,
    criticId: first.author.id,
    item: item.id,
    at: fractionOfAnchor(item, thread),
    kind: note.kind,
    question: note.question,
    text: note.text,
    createdAt: thread.createdAt,
  };
}

/** The words of a request, as `isocan critique` writes them: each critic by
 *  its mention word, the screen by its title, so the thread reads as a
 *  person asking and the Chat's own syntax would say the same. Two or more
 *  are told they answer alone — independence is arranged, not hoped for. */
export function requestBody(agentNames: string | readonly string[], itemTitle: string): string {
  const names = (typeof agentNames === "string" ? [agentNames] : [...agentNames]).map((n) => `@${mentionWord(n)}`);
  if (names.length === 1) return `${names[0]} what do you make of #${itemTitle}? Pin your notes on it; change nothing.`;
  const who = `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  return `${who} — what do you make of #${itemTitle}? Each of you on your own: pin your notes on it; change nothing.`;
}

/** Where a critique was asked for: the newest comment that mentions this
 *  critic and is about this item — anchored to it, or naming it with `#`. */
export function findRequest(canvas: Pick<CanvasContents, "threads">, criticId: string, itemId: string): { threadId: string; commentId: string; createdAt: string } | null {
  let best: { threadId: string; commentId: string; createdAt: string } | null = null;
  for (const thread of Object.values(canvas.threads)) {
    for (const c of thread.comments) {
      if (!(c.mentions ?? []).includes(criticId)) continue;
      if (thread.anchorItemId !== itemId && !(c.items ?? []).includes(itemId)) continue;
      if (!best || c.createdAt > best.createdAt) best = { threadId: thread.id, commentId: c.id, createdAt: c.createdAt };
    }
  }
  return best;
}

/**
 * **What a critic's enrolment carries to the template** — the card's bytes,
 * the canvas, and the card item. An ask from the browser crosses the home as
 * strings of at most 512 characters (`askTemplate`), and a card is longer, so
 * the card goes in pieces — `card`, `card-2`, … — and `cardOf` joins them.
 * The terminal sends the same pieces, so the template reads one shape.
 */
export function enrolArgs(card: string, canvasId: string, cardItem: string): Record<string, string> {
  const pieces = card.match(/[\s\S]{1,500}/g) ?? [""];
  if (pieces.length > 13) throw new Error(`this critic's card is ${card.length} characters, and a critic carries at most ${13 * 500} — shorten it`);
  return { canvas: canvasId, "card-item": cardItem, ...Object.fromEntries(pieces.map((p, i) => [i === 0 ? "card" : `card-${i + 1}`, p])) };
}

/** The card's bytes back from `enrolArgs`' pieces. */
export function cardOf(args: Readonly<Record<string, string>>): string {
  let text = args["card"] ?? "";
  for (let i = 2; args[`card-${i}`] !== undefined; i++) text += args[`card-${i}`];
  return text;
}

/** The critic's last word in the request thread: how many notes, of what. */
export function doneLine(notes: readonly CritiqueNote[], itemTitle: string): string {
  if (notes.length === 0) return `Done — no notes on #${itemTitle}.`;
  const counts = NOTE_KINDS.map((k) => [k, notes.filter((n) => n.kind === k).length] as const).filter(([, n]) => n > 0);
  return `Done — ${notes.length} ${notes.length === 1 ? "note" : "notes"} on #${itemTitle}: ${counts.map(([k, n]) => `${n} ${k}`).join(", ")}.`;
}

/* ---- Phase 3: two critics, and the read -------------------------------- */

/**
 * **The property a Build-both variation carries**: the note thread it
 * answers. `parent=` says what screen it is a variation of; this says which
 * critic's move it is, so the two can be told apart without reading them.
 */
export const ANSWERS_PROP = "critique.answers";

/**
 * **One region of a screen**: two pins are in the same region when they are
 * at most this far apart, measured in fractions of the screen's width and
 * height (Euclidean). 0.15 is roughly "the same block" on a phone-shaped
 * screen — two notes about one button agree; a note on the header and one on
 * the footer do not. One constant, so the read and its test say one thing.
 */
export const REGION = 0.15;

/** How far apart two pins are, in fractions of the screen. */
export function pinDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * **A note's move, by its verb** — the one concrete change a note ends in,
 * sorted into a family without a model. The vocabulary is this one
 * constant: each family is a list of patterns tried against the move (the
 * note's last sentence), lower-cased, in this order — KEEP first, because
 * "Leave it." is the whole of a keep; then ADD, because "replace it with a
 * photograph" contains no removal verb but would read as one; then REMOVE.
 * Anything unmatched is OTHER, and OTHER never opposes anything.
 *
 * What it misses, on purpose: verbs not listed ("tone it down", "quiet it",
 * "swap", "move it above the fold" — OTHER); negation ("don't remove it");
 * a move whose object is not the thing pinned (two notes in one region about
 * different elements, read as one); and "make it smaller", which is a
 * shrink and is counted with REMOVE, as is "reduce".
 */
export const MOVE_VOCABULARY = {
  keep: [/^(leave|keep) (it|this|that|them)( alone| as it is| as is| exactly as it is)?$/, /^no change( here)?$/],
  add: [
    /^(add|enlarge|increase|bring in|bring back|introduce|expand|amplify|grow|give it\b)/,
    /^replace\b.*\bwith\b/,
    /^(set|make)\b.*\b(larger|bigger|braver|bolder|warmer|louder|heavier|more prominent)\b/,
    /^give\b.*\b(weight|room|presence|more)\b/,
  ],
  remove: [
    /^(remove|cut|drop|delete|lose|hide|strip|get rid of|take out|eliminate|reduce|shrink|shorten|trim)\b/,
    /^(set|make)\b.*\b(smaller|quieter|lighter|less prominent)\b/,
  ],
} as const;

export type MoveFamily = "keep" | "add" | "remove" | "other";

/** A note's move: its last sentence, without the closing stop. */
export function moveOf(text: string): string {
  const sentences = text.trim().split(/(?<=[.!?])\s+/).filter(Boolean);
  return (sentences.at(-1) ?? "").replace(/[.!?]+$/, "").trim();
}

/** Which family a note's move falls in (`MOVE_VOCABULARY`). */
export function moveFamily(text: string): MoveFamily {
  const move = moveOf(text).toLowerCase();
  for (const family of ["keep", "add", "remove"] as const) {
    if (MOVE_VOCABULARY[family].some((p) => p.test(move))) return family;
  }
  return "other";
}

/**
 * **Which way a note leans**: `keep` (working, or a move that is a keep) or
 * `change` (risk or blocker with any other move).
 */
export function stance(note: Pick<CritiqueNote, "kind" | "text">): "keep" | "change" {
  if (note.kind === "working") return "keep";
  return moveFamily(note.text) === "keep" ? "keep" : "change";
}

/**
 * **Why two notes oppose**, or null: one keeps what the other would change
 * (`keep-change`), or one would remove what the other would add or enlarge
 * (`remove-add`). Same family, or OTHER on either side, is no opposition.
 */
export function opposition(a: Pick<CritiqueNote, "kind" | "text">, b: Pick<CritiqueNote, "kind" | "text">): "keep-change" | "remove-add" | null {
  if (stance(a) !== stance(b)) return "keep-change";
  const fam = new Set([moveFamily(a.text), moveFamily(b.text)]);
  return fam.has("remove") && fam.has("add") ? "remove-add" : null;
}

/** Notes that two critics agree on: same kind, one region, moves not opposed. */
export interface AgreeGroup {
  kind: NoteKind;
  critics: string[];
  notes: CritiqueNote[];
  at: { x: number; y: number };
}

/** Where two critics split, in one region: one keeps what another would
 *  change, or one removes what another would add. `sides[0]` is the keep
 *  (or the remove) side. */
export interface SplitGroup {
  at: { x: number; y: number };
  why: "keep-change" | "remove-add";
  sides: [CritiqueNote[], CritiqueNote[]];
  /** `<side 0 note>+<side 1 note>` — what `critique both` takes. */
  ref: string;
}

/** The fold: agree, split and blocker, each citing its notes; the rest alone. */
export interface CritiqueRead {
  agree: AgreeGroup[];
  split: SplitGroup[];
  blocker: CritiqueNote[];
  /** Notes in no agree, split or blocker group — said, not dropped. */
  alone: CritiqueNote[];
}

const centre = (notes: readonly CritiqueNote[]) => {
  const r = (v: number) => Math.round(v * 100) / 100;
  return { x: r(notes.reduce((s, n) => s + n.at.x, 0) / notes.length), y: r(notes.reduce((s, n) => s + n.at.y, 0) / notes.length) };
};

const ordered = (notes: readonly CritiqueNote[]) =>
  [...notes].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.threadId.localeCompare(b.threadId));

/** Connected components of the notes over one kind of edge. */
function components(notes: readonly CritiqueNote[], edge: (a: CritiqueNote, b: CritiqueNote) => boolean): CritiqueNote[][] {
  const parent = notes.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  const linked = new Set<number>();
  for (let i = 0; i < notes.length; i++) {
    for (let j = i + 1; j < notes.length; j++) {
      if (!edge(notes[i]!, notes[j]!)) continue;
      parent[find(j)] = find(i);
      linked.add(i).add(j);
    }
  }
  const groups = new Map<number, CritiqueNote[]>();
  for (const i of linked) groups.set(find(i), [...(groups.get(find(i)) ?? []), notes[i]!]);
  return [...groups.values()].map(ordered).sort((a, b) => a[0]!.createdAt.localeCompare(b[0]!.createdAt) || a[0]!.threadId.localeCompare(b[0]!.threadId));
}

/**
 * **The read** (design §5): a pure fold over parsed notes.
 *
 * - **agree** — notes from two or more critics, the same kind, pins within
 *   one `REGION` of each other (chained: a third note near either joins);
 * - **split** — notes from different critics within one region where one
 *   keeps (`stance`) and another would change;
 * - **blocker** — every blocker note, by anyone.
 *
 * A note may sit in an agree group and a split at once — two critics agree a
 * thing is a risk and a third says leave it — because both are true. Notes
 * by one critic never agree or split with each other. Deterministic: the
 * same notes in any order give the same read.
 */
export function critiqueRead(input: readonly CritiqueNote[]): CritiqueRead {
  const notes = ordered(input);
  const near = (a: CritiqueNote, b: CritiqueNote) => a.criticId !== b.criticId && pinDistance(a.at, b.at) <= REGION;
  const agree = components(notes, (a, b) => near(a, b) && a.kind === b.kind && opposition(a, b) === null).map((group) => ({
    kind: group[0]!.kind,
    critics: [...new Set(group.map((n) => n.critic))],
    notes: group,
    at: centre(group),
  }));
  const splitOf = (why: "keep-change" | "remove-add", first: (n: CritiqueNote) => boolean) =>
    components(notes, (a, b) => near(a, b) && opposition(a, b) === why).map((group): SplitGroup => {
      const sides: [CritiqueNote[], CritiqueNote[]] = [group.filter(first), group.filter((n) => !first(n))];
      return { at: centre(group), why, sides, ref: `${sides[0][0]!.threadId}+${sides[1][0]!.threadId}` };
    });
  const split = [
    ...splitOf("keep-change", (n) => stance(n) === "keep"),
    ...splitOf("remove-add", (n) => moveFamily(n.text) === "remove"),
  ];
  const blocker = notes.filter((n) => n.kind === "blocker");
  const grouped = new Set([...agree.flatMap((g) => g.notes), ...split.flatMap((g) => g.sides.flat()), ...blocker].map((n) => n.threadId));
  return { agree, split, blocker, alone: notes.filter((n) => !grouped.has(n.threadId)) };
}

/** A note's first sentence, short enough to quote in a line. */
export function gist(text: string, max = 90): string {
  const first = (text.trim().split(/(?<=[.!?])\s/)[0] ?? "").trim();
  return first.length <= max ? first : `${first.slice(0, max - 1).trimEnd()}…`;
}

const where = (at: { x: number; y: number }) => `near ${at.x},${at.y}`;

/**
 * **The fold, in words** — the grouping and nothing more. Every line cites
 * its notes by critic and quotes them; a split carries the `critique both`
 * that would build it. Naming the tension in design words is the lead's,
 * written above this, never here.
 */
export function readWords(read: CritiqueRead): string {
  const lines: string[] = [];
  for (const g of read.agree) {
    lines.push(`**They agree** (${g.notes.length} ${g.kind} notes ${where(g.at)}): ${g.notes.map((n) => `${n.critic} — “${gist(n.text)}”`).join("; ")}`);
  }
  for (const s of read.split) {
    const side = (ns: readonly CritiqueNote[]) =>
      ns.map((n) => {
        const said = gist(n.text);
        const move = moveOf(n.text);
        return `${n.critic} (${n.kind}) — “${said}”${move && !said.startsWith(move) ? ` → “${move}.”` : ""}`;
      }).join("; ");
    lines.push(`**They split** ${where(s.at)}${s.why === "remove-add" ? " (remove against add)" : ""}: ${side(s.sides[0])} against ${side(s.sides[1])} — build both: \`isocan critique both ${s.ref}\``);
  }
  lines.push(read.blocker.length ? `**Blocker:** ${read.blocker.map((n) => `${n.critic} — “${gist(n.text)}”`).join("; ")}` : "**Blocker:** none.");
  if (read.alone.length) lines.push(`On their own: ${read.alone.map((n) => `${n.critic} (${n.kind}) — “${gist(n.text)}”`).join("; ")}`);
  return lines.join("\n");
}

/** A critic on this canvas, as an actor. */
export interface CriticActor {
  id: string;
  name: string;
}

/** Where one asked critic stands in a request thread. */
export interface AskedCritic extends CriticActor {
  /** `done`: its `critique done` line; `capped`: the rc's budget line; null: still working. */
  state: "done" | "capped" | null;
}

/** A request thread, read: who asked, whom, and who has finished. */
export interface CritiqueStatus {
  threadId: string;
  commentId: string;
  asker: { id: string; name: string };
  createdAt: string;
  asked: AskedCritic[];
  pending: AskedCritic[];
}

/** Whether a comment is a critic's last word — `critique done`'s line. */
export const isDoneLine = (body: string) => body.startsWith("Done — ");

/** Whether a system comment is the rc stopping this critic at its budget
 *  (`capLine` in `packages/rc/src/budget.ts`) — a stop counts as done. */
export const isCapLine = (body: string, name: string) => body.startsWith(`${name} stopped at its budget`);

/**
 * **Where a critique stands** — read off its request thread alone. The
 * request is the first comment that mentions a critic; the asked are the
 * critics it mentions; each is done when it has posted its done line in the
 * thread, or the rc has said there that it stopped it at its budget. Null
 * when the thread asks no critic anything.
 */
export function critiqueStatus(thread: CommentThread, critics: readonly CriticActor[], isSystem: (actorId: string) => boolean): CritiqueStatus | null {
  const byId = new Map(critics.map((c) => [c.id, c]));
  const request = thread.comments.find((c) => (c.mentions ?? []).some((id) => byId.has(id)));
  if (!request) return null;
  const later = thread.comments.slice(thread.comments.indexOf(request) + 1);
  const asked: AskedCritic[] = [...new Set((request.mentions ?? []).filter((id) => byId.has(id)))].map((id) => {
    const c = byId.get(id)!;
    const done = later.some((x) => x.author.id === id && isDoneLine(x.body));
    const capped = !done && later.some((x) => isSystem(x.author.id) && isCapLine(x.body, c.name));
    return { ...c, state: done ? "done" : capped ? "capped" : null };
  });
  return {
    threadId: thread.id,
    commentId: request.id,
    asker: { id: request.author.id, name: request.author.name },
    createdAt: request.createdAt,
    asked,
    pending: asked.filter((a) => a.state === null),
  };
}

/** The line the LAST of two or more critics adds to its done: the asker, by
 *  mention, told the read is ready — the one wake the read needs. */
export function readyLine(askerName: string, threadId: string): string {
  return `@${mentionWord(askerName)} every critic asked here is done — the read: \`isocan critique read ${threadId}\``;
}

/** The notes the asked critics left on the screen since they were asked —
 *  what a read folds, from the terminal and the browser alike. */
export function requestNotes(canvas: Pick<CanvasContents, "threads" | "items">, itemId: string, status: CritiqueStatus): CritiqueNote[] {
  const who = new Set(status.asked.map((a) => a.id));
  return Object.values(canvas.threads)
    .map((t) => readNote(t, canvas.items))
    .filter((n): n is CritiqueNote => n !== null && n.item === itemId && who.has(n.criticId) && n.createdAt >= status.createdAt);
}

/** The screen a request thread is about: the item it is pinned to, or the first it names. */
export function requestScreen(thread: CommentThread, status: CritiqueStatus): string | undefined {
  return thread.anchorItemId ?? thread.comments.find((c) => c.id === status.commentId)?.items?.[0];
}

/** A critic card's size on the canvas: a column of questions, not a page. */
export const CRITIC_CARD = { width: 360, height: 440 } as const;

/** Whether a comment is the last critic's ready line (`readyLine`). */
export const isReadyLine = (body: string) => /every critic asked here is done — the read: `isocan critique read [^`]+`/.test(body);

/** The read's own blocker line — every posted read ends its grouping with it (`readWords`). */
const BLOCKER_LINE = /^\*\*Blocker:\*\*/m;

/** Whether a comment is a posted read (`critique read --post`). */
export const isPostedRead = (body: string) => BLOCKER_LINE.test(body);

/** The split refs a posted read carries — what each of its *Build both* buttons asks for. */
export function postedSplits(body: string): string[] {
  if (!isPostedRead(body)) return [];
  return [...body.matchAll(/`isocan critique both ([^`\s]+\+[^`\s]+)`/g)].map((m) => m[1]!);
}

/** An agent on this canvas, as the builder question reads it. */
interface Standing {
  actor: { id: string; name: string };
  ceiling?: string;
}

/**
 * **Who may build both sides of a split**: an agent standing on this canvas
 * and not capped at notes — never a critic. The asker first when the asker is
 * one of them (the lead), so `critique both` with no `--to` and the browser's
 * preselection name the same agent.
 */
export function buildersFor(agents: Readonly<Record<string, Standing>> | undefined, askerId: string): Standing[] {
  const may = Object.values(agents ?? {}).filter((a) => a.ceiling !== "note");
  return [...may.filter((a) => a.actor.id === askerId), ...may.filter((a) => a.actor.id !== askerId)];
}

/**
 * **The ask `critique both` posts** — one per side, each citing the note it
 * answers, and the `/variation` procedure for two. One text for the terminal
 * and the browser's *Build both*, so the builder reads the same brief
 * whichever surface pressed it.
 */
export function bothBrief(builderName: string, item: { id: string; title: string }, a: CritiqueNote, b: CritiqueNote): string {
  const side = (n: CritiqueNote, i: number) =>
    `${i}. Answering ${n.critic}'s note (${n.threadId}, ${n.kind}): “${gist(n.text, 240)}”\n` +
    `   \`isocan add <file> --title "${item.title} — <the idea>" --prop parent=${item.id} --prop ${ANSWERS_PROP}=${n.threadId}\``;
  return [
    `@${mentionWord(builderName)} build both sides of this split: two variations of #${item.title}, one per critic, each doing what its note asks and nothing else.`,
    side(a, 1),
    side(b, 2),
    `This is /variation's procedure for two (\`isocan command show variation\`): real alternatives, named for the idea; then \`isocan format\` and one reply here saying what each tried. Leave ${item.title} itself as it is.`,
  ].join("\n");
}

/** The slash command: an agent reading it from the Chat asks, and later leads. */
const CRITIQUE_COMMAND: SlashCommand = {
  name: "critique",
  description: "Ask critics what they make of a screen — they pin notes, change nothing, and you write the one reply",
  usage: "#Item with <critic> [and <critic>]",
  source: "module",
  body: `Ask the named critics for a critique of one screen, then write the one reply.

1. WHICH SCREEN: the item #-referenced in the message (or attached). WHICH
   CRITICS: the names after "with", split on "and" and commas — each is a
   critic card on this canvas (\`isocan critic ls\`). If a named critic is not
   here, \`isocan critic add <name>\` adds it from the roster; if it is not in
   the roster either, say so in one line and stop.
2. \`isocan critique "#<Item>" --by <a>,<b>\` — ONE thread on the screen that
   mentions every critic. It refuses with a sentence when no runner is
   parked; say that sentence to the person and stop. Then end your turn: the
   critics work on their own and must not see each other's notes, so you do
   not wait, read or comment.
3. You are woken again when the last critic is done (its done line mentions
   you). Run \`isocan critique read <thread>\`: the fold groups the notes into
   agree, split and blocker, each citing its notes.
4. Write the reply: \`isocan critique read <thread> --post --say "<your words>"\`.
   Your words name each tension in design words — what the two critics value
   that pulls the screen two ways (reduction against warmth, density against
   calm) — in two or three sentences. Do not average a split and do not pick a
   side; the person chooses. The grouping below your words is the fold's.
5. Build nothing unless asked. If the person asks for both sides of a split,
   \`isocan critique both <ref> --to <you>\` posts the brief, and you build the
   two variations it names.`,
};

/** The record. */
export const critiqueCore: CoreModule = {
  name: "@isocan/critique",
  propertyKeys: [CRITIC_PROP, ANSWERS_PROP],
  points: [CRITICS],
  commands: [CRITIQUE_COMMAND],
};

/** The runtime loader reads `mod.default`; a named export alone builds and
 *  loads nothing. */
export default critiqueCore;
