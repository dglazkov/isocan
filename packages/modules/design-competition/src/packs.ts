import { contributions, type Contribution } from "@isocan/core";

/**
 * **A fighter pack** (`docs/projects/design-competition/packs.md`).
 *
 * What a fighter IS: a card a person can pick and a philosophy an agent can
 * adopt. The card half lives here, as data — the same shape a data-only module
 * contributes to `design-competition.fighters` — and the philosophy half is
 * files beside it (`DESIGN.md`, `critique.md`, `references.md`, `avatar.svg`),
 * relative to the module that contributed the pack.
 *
 * **The principle leads and the person is a credit** (decided 11 Sep 2026):
 * the card's headline is `title` — *Less, but better* — with `credit` beneath
 * it, and the agent on the canvas is `agentName` — *Less but Better* — never
 * the designer's name. All nine default designers are living people; the
 * validator below is where that stops being a promise.
 */
export interface PackReference {
  title: string;
  year: number | string;
  /** The one thing to learn from it — a line, not an essay. */
  learn: string;
  url: string;
  /** Recorded only where a picture of it may travel: CC0 or public domain. */
  image?: { source: string; licence: string };
}

export interface FighterPack {
  id: string;
  /** The principle — the card's headline. */
  title: string;
  /** What the agent is called on the canvas. Never the person's name. */
  agentName: string;
  /** "after Dieter Rams & Braun" — beneath the title. */
  credit: string;
  /** Who the pack is an homage to. */
  name: string;
  tagline: string;
  bio: string;
  /** The pack's signature accent — its cursor and its card. */
  colour: string;
  /** "An homage to … Not affiliated with or endorsed by …" */
  homage: string;
  /** Three lines of philosophy, for the back of the card. */
  beliefs: readonly string[];
  /** Three signature moves. */
  moves: readonly string[];
  /** The three questions its critic asks of a rival's entry. */
  critique: readonly string[];
  references: readonly PackReference[];
  quote: { text: string; source: string } | null;
  /** Where the pack's files are, relative to the module that contributed it.
   *  Unset: `assets/packs/<id>/`. */
  dir?: string;
  /** A pack somebody made of THEMSELVES may carry their own name: the rule
   *  protects people who did not choose to be a fighter. */
  self?: boolean;
}

/** The files a pack's directory holds, by what they are for. */
export type PackFile = "DESIGN.md" | "critique.md" | "references.md" | "avatar.svg";

/** A pack's file, relative to the module that contributed it. */
export function packPath(pack: FighterPack, file: PackFile): string {
  const dir = (pack.dir ?? `assets/packs/${pack.id}`).replace(/\/+$/, "");
  return `${dir}/${file}`;
}

/** Licences under which a picture of the work may travel into an MIT repo.
 *  CC BY-SA may not — share-alike cannot be relicensed — so it is linked. */
export const TRAVELLING_LICENCES = ["CC0-1.0", "public-domain", "CC-BY-4.0", "CC-BY-3.0", "CC-BY-2.0"] as const;

/** Words of a credit that are not a name — never counted against an agent's. */
const NOT_A_NAME = new Set(["and", "the", "design", "studio", "after"]);

const nonEmpty = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

/**
 * **What is wrong with a pack**, in sentences — empty when it may fight. Both
 * surfaces call this, through the contribution point, so a pack the terminal
 * refuses is a pack the picker never shows.
 */
export function packProblems(value: unknown): string[] {
  if (!value || typeof value !== "object") return ["a pack is an object"];
  const p = value as Partial<FighterPack>;
  const problems: string[] = [];
  for (const key of ["id", "title", "agentName", "credit", "name", "tagline", "bio", "colour", "homage"] as const) {
    if (!nonEmpty(p[key])) problems.push(`${key} is missing`);
  }
  if (problems.length > 0) return problems;
  if (!/^[a-z][a-z0-9-]{1,31}$/.test(p.id!)) problems.push(`id "${p.id}" is not a short lowercase slug`);
  if (!/^#[0-9a-fA-F]{6}$/.test(p.colour!)) problems.push(`colour "${p.colour}" is not #rrggbb`);
  for (const key of ["beliefs", "moves", "critique"] as const) {
    const list = p[key];
    if (!Array.isArray(list) || list.length !== 3 || !list.every(nonEmpty)) problems.push(`${key} is three lines`);
  }
  // The first word is how a mention finds the agent (`@Less` is *Less but
  // Better*), so it must be a word: letters, digits and spaces only.
  if (!/^[A-Za-z0-9][A-Za-z0-9 ]{0,40}$/.test(p.agentName!)) {
    problems.push(`agentName "${p.agentName}" must be words — letters, digits and spaces`);
  }
  if (!p.self) {
    const nameWords = p.name!.toLowerCase().split(/[^a-zà-ÿ0-9]+/).filter((w) => w.length >= 3 && !NOT_A_NAME.has(w));
    const agentWords = p.agentName!.toLowerCase().split(/\s+/);
    const shared = agentWords.filter((w) => nameWords.includes(w));
    if (shared.length > 0) {
      problems.push(`agentName "${p.agentName}" carries "${shared.join(" ")}" from "${p.name}" — a fighter is named for its principle, never its person`);
    }
    if (!/not affiliated/i.test(p.homage!)) problems.push("the homage line must say the pack is not affiliated with or endorsed by its person");
  }
  if (!Array.isArray(p.references) || p.references.length === 0) {
    problems.push("a pack studies at least one reference");
  } else {
    for (const ref of p.references) {
      if (!ref || !nonEmpty(ref.title) || !nonEmpty(ref.learn) || !/^https?:\/\//.test(ref.url ?? "")) {
        problems.push(`reference "${ref?.title ?? "?"}" needs a title, what to learn, and a link`);
        continue;
      }
      if (ref.image && !(TRAVELLING_LICENCES as readonly string[]).includes(ref.image.licence)) {
        problems.push(`reference "${ref.title}" has a picture under ${ref.image.licence}, which does not travel — link it instead`);
      }
    }
  }
  if (p.quote !== null && p.quote !== undefined) {
    if (!nonEmpty(p.quote.text) || !/^https?:\/\//.test(p.quote.source ?? "")) problems.push("a quote carries its text and its source");
    else if (p.quote.text.split(/\s+/).length > 15) problems.push("a quote is short — fifteen words at most");
  }
  return problems;
}

/** The point other modules add fighters to. */
export const FIGHTERS_POINT = "design-competition.fighters";

export interface Fighter {
  /** The module that contributed it — where its files are. */
  module: string;
  pack: FighterPack;
}

/** Every fighter this build can field, in module order: the nine the module
 *  ships first, then any a data-only module added. */
export function fighters(): Fighter[] {
  return contributions<FighterPack>(FIGHTERS_POINT).map(({ module, value }: Contribution<FighterPack>) => ({ module, pack: value }));
}

/**
 * **Roster problems a single pack cannot see**: two fighters whose names
 * begin with the same word. Mentions resolve by first word, so `@Road` must
 * mean one agent — the second pack is the one refused, and says so.
 */
export function rosterClashes(list: readonly Fighter[]): { id: string; problem: string }[] {
  const seen = new Map<string, string>();
  const out: { id: string; problem: string }[] = [];
  for (const { pack } of list) {
    const first = pack.agentName.split(/\s+/)[0]!.toLowerCase();
    const holder = seen.get(first);
    if (holder && holder !== pack.id) out.push({ id: pack.id, problem: `"${pack.agentName}" starts with the same word as ${holder}'s agent — @${first} would be ambiguous` });
    else seen.set(first, pack.id);
  }
  return out;
}

/** A fighter by what somebody types: id, agent name, title, or a word of the
 *  person's name (`kare`, `rams`, `linear`). */
export function findFighter(list: readonly Fighter[], ref: string): Fighter | null {
  const q = ref.trim().toLowerCase();
  if (!q) return null;
  return (
    list.find(({ pack }) => pack.id === q) ??
    list.find(({ pack }) => pack.agentName.toLowerCase() === q || pack.title.toLowerCase() === q) ??
    list.find(({ pack }) => pack.name.toLowerCase().split(/[^a-zà-ÿ0-9]+/).includes(q)) ??
    list.find(({ pack }) => pack.agentName.toLowerCase().startsWith(q)) ??
    null
  );
}
