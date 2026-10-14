import {
  contributions,
  firstWordClashes,
  homageNameProblems,
  parsePersona,
  titleSlug,
  type ContributionPoint,
  type CoreModule,
  type Item,
  type Persona,
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
  const all = contributions<RosterCritic>(CRITICS_POINT).map(({ module, value }) => ({ module, critic: value }));
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

/** The record. */
export const critiqueCore: CoreModule = {
  name: "@isocan/critique",
  propertyKeys: [CRITIC_PROP],
  points: [CRITICS],
};

/** The runtime loader reads `mod.default`; a named export alone builds and
 *  loads nothing. */
export default critiqueCore;
