/**
 * **The product's voice, read from DESIGN.md** (copy-edit phase 4 —
 * `docs/projects/copy-edit/phases.md`, design point 5 of
 * `docs/research/2026-10-02-copy-edit.md`, journey scene 4).
 *
 * DESIGN.md had sections for colour, type, layout and shape and none for
 * words (`designmd.ts`'s `DESIGN_SECTIONS`), so "Sign in" on one screen and
 * "Log in" on the next was invisible, and a copy variant had nothing to keep
 * to. A `## Voice` section is that missing half, read the way a person writes
 * it:
 *
 * ```md
 * ## Voice
 *
 * Plain and direct, second person. Say what happens.
 *
 * Use: your canvas, sign in
 * Avoid: seamless, unlock, simply
 *
 * Glossary:
 * - sign in — never log in, login
 * - canvas, not board
 * - Sign up → create an account   (banned → preferred)
 * ```
 *
 * Prose is the TONE. `Use:` / `Avoid:` / `Glossary:` (or `### Use`,
 * `### Avoid`, `### Glossary`) take a comma-separated line or the list under
 * them. A glossary line names the preferred form and the banned ones after
 * `never`, `not`, `instead of` or `rather than` — or, with an arrow, the
 * banned form first. A line it cannot read is reported in `problems`, never
 * guessed at.
 *
 * It is read by everything that writes or judges words: the variants' prompt
 * (`voicePrompt`), the variants' check (`voiceSlips` — an avoided word in a
 * new string is refused, in words), and the copy lint (`copy-lint.ts`). Pure,
 * and it takes the parsed document's sections, so it imports nothing.
 */

/** One glossary entry: the form to use, and the forms that mean the same thing and are not. */
interface GlossaryTerm {
  term: string;
  banned: string[];
}

/** A Voice section, read. */
export interface CopyVoice {
  /** The prose: how the product sounds, in a sentence or two. */
  tone: string;
  use: string[];
  avoid: string[];
  glossary: GlossaryTerm[];
  /** What could not be read, said rather than swallowed. */
  problems: string[];
}

/** One place a string breaks the voice: a banned form of a glossary term, or a word the voice avoids. */
interface VoiceSlip {
  kind: "glossary" | "avoid";
  /** The words as the string says them. */
  said: string;
  /** For a glossary slip, the form the voice uses instead. */
  preferred?: string;
}

/** The headings a Voice section goes by. */
const VOICE_HEADING = /^(voice|tone|tone of voice|voice (?:&|and) tone|voice (?:&|and) words|words)$/i;

type Field = "tone" | "use" | "avoid" | "glossary";
const LABELS: Array<[RegExp, Field]> = [
  [/^tone$/i, "tone"],
  [/^(use|words to use|say|prefer|preferred)$/i, "use"],
  [/^(avoid|words to avoid|don'?t say|do not say|never say|banned)$/i, "avoid"],
  [/^(glossary|terms|terminology|names)$/i, "glossary"],
];

const fieldOf = (label: string): Field | undefined => LABELS.find(([re]) => re.test(label.trim()))?.[1];

/** Quotes, emphasis and code ticks around a term are how it was written, not the term. */
const bare = (s: string) => s.trim().replace(/^[\s"'“”‘’`*_]+|[\s"'“”‘’`*_.]+$/g, "").replace(/\s+/g, " ");

const listItem = /^\s*(?:[-*+]|\d+[.)])\s+(.*)$/;

/** Split a comma (or semicolon, slash, "or") list into its terms. */
const terms = (s: string) => s.split(/\s*(?:[,;/]|\bor\b)\s*/i).map(bare).filter(Boolean);

/**
 * One glossary line: `sign in — never log in, login`, `canvas, not board`,
 * `sign in (never log in)`, `log in → sign in`. Null when it names no banned form.
 */
function glossaryLine(raw: string): GlossaryTerm | null {
  const line = raw.trim();
  const arrow = /^(.+?)\s*(?:→|->|=>)\s*(.+)$/.exec(line);
  if (arrow) {
    const term = bare(arrow[2]!);
    const banned = terms(arrow[1]!);
    return term && banned.length ? { term, banned } : null;
  }
  const said = /^(.+?)\s*(?:[—–:(,]|\s-\s)?\s*\b(?:never|not|instead of|rather than)\b\s*:?\s*(.+?)\)?\s*$/i.exec(line);
  if (!said) return null;
  const term = bare(said[1]!.replace(/[—–:(,-]\s*$/, ""));
  const banned = terms(said[2]!);
  return term && banned.length ? { term, banned } : null;
}

/** Read a Voice section's body. */
export function parseVoiceSection(body: string): CopyVoice {
  const voice: CopyVoice = { tone: "", use: [], avoid: [], glossary: [], problems: [] };
  const tone: string[] = [];
  let field: Field = "tone";
  // A `### Glossary` holds everything under it; a `Glossary:` label holds only its list.
  let sticky = false;
  const take = (into: Field, text: string) => {
    if (into === "tone") tone.push(text.trim());
    else if (into === "glossary") {
      const g = glossaryLine(text);
      if (g) voice.glossary.push(g);
      else voice.problems.push(`glossary line ${JSON.stringify(text.trim())} names no banned form — write it "sign in — never log in"`);
    } else voice[into].push(...terms(text));
  };
  for (const line of body.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const sub = /^#{3,6}\s+(.+?)\s*$/.exec(line);
    if (sub) {
      const named = fieldOf(sub[1]!);
      if (named) {
        field = named;
        sticky = true;
      } else voice.problems.push(`"### ${sub[1]}" is not a part of a Voice section — use Tone, Use, Avoid or Glossary`);
      continue;
    }
    const item = listItem.exec(line);
    const text = item ? item[1]! : line;
    const labelled = /^\s*\**([A-Za-z' ]{2,24}?)\**\s*:\s*(.*)$/.exec(text);
    const named = labelled ? fieldOf(labelled[1]!) : undefined;
    if (labelled && named) {
      field = named;
      sticky = false;
      if (labelled[2]!.trim()) {
        if (named === "glossary") for (const one of labelled[2]!.split(/\s*;\s*/)) take("glossary", one);
        else take(named, labelled[2]!);
      }
      continue;
    }
    // Prose after a labelled list is tone again; only list items belong to the label.
    if (!item && !sticky) field = "tone";
    take(field, text);
  }
  voice.tone = tone.join(" ").replace(/\s+/g, " ").trim();

  // Each term once; and a form cannot be both the one to use and a banned one.
  voice.use = [...new Set(voice.use)];
  voice.avoid = [...new Set(voice.avoid)];
  const preferred = new Map(voice.glossary.map((g) => [g.term.toLowerCase(), g.term]));
  for (const g of voice.glossary) {
    for (const b of g.banned) {
      if (preferred.has(b.toLowerCase())) voice.problems.push(`"${b}" is both a glossary term and banned for "${g.term}" — say which`);
    }
  }
  for (const u of voice.use) {
    if (voice.avoid.some((a) => a.toLowerCase() === u.toLowerCase())) voice.problems.push(`"${u}" is under both Use and Avoid — say which`);
  }
  if (!voice.tone && !voice.use.length && !voice.avoid.length && !voice.glossary.length && !voice.problems.length) voice.problems.push("the Voice section says nothing yet — a tone in a sentence, words to use and avoid, a glossary");
  return voice;
}

/**
 * The Voice section of a DESIGN.md, read — `parseDesign(text).sections` in,
 * null when there is none. Takes the sections, not the text, so a caller that
 * already parsed the document (every design read does) does not parse twice.
 */
export function voiceOf(doc: { sections: ReadonlyArray<{ title: string; body: string }> }): CopyVoice | null {
  const section = doc.sections.find((s) => VOICE_HEADING.test(s.title.trim()));
  return section ? parseVoiceSection(section.body) : null;
}

/** The voice as a model should read it: one block, every part named. Empty for no voice. */
export function voicePrompt(voice: CopyVoice | null | undefined): string {
  if (!voice) return "";
  const parts = [
    voice.tone && `Tone: ${voice.tone}`,
    voice.use.length > 0 && `Words to use: ${voice.use.join(", ")}.`,
    voice.avoid.length > 0 && `Words to avoid — never write them: ${voice.avoid.join(", ")}.`,
    ...voice.glossary.map((g) => `Say "${g.term}", never ${g.banned.map((b) => `"${b}"`).join(" or ")}.`),
  ].filter(Boolean);
  return parts.join("\n");
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A phrase as a whole-word, any-case match: "log in" matches "Log in" and "log  in", never "login" or "catalog in". */
function phrase(p: string): RegExp {
  const body = p.trim().split(/\s+/).map(escape).join("[\\s\\u00a0]+");
  return new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, "giu");
}

/** Each place `text` says `p`, as it says it — whole words, any case. */
export function saysPhrase(text: string, p: string): string[] {
  return [...text.matchAll(phrase(p))].map((m) => m[0]);
}

/** Every place `text` breaks the voice: each banned glossary form and each avoided word it says, in the order the voice lists them. */
export function voiceSlips(voice: CopyVoice | null | undefined, text: string): VoiceSlip[] {
  if (!voice) return [];
  const out: VoiceSlip[] = [];
  for (const g of voice.glossary) {
    for (const b of g.banned) {
      for (const m of text.matchAll(phrase(b))) out.push({ kind: "glossary", said: m[0], preferred: g.term });
    }
  }
  for (const a of voice.avoid) {
    for (const m of text.matchAll(phrase(a))) out.push({ kind: "avoid", said: m[0] });
  }
  return out;
}

/** A slip in words: `says "Log in" — the voice says "sign in"`. */
export function voiceSlipText(slip: VoiceSlip): string {
  return slip.kind === "glossary"
    ? `says "${slip.said}" — the voice says "${slip.preferred}", never "${slip.said.toLowerCase()}"`
    : `says "${slip.said}" — the voice avoids it`;
}

/**
 * The slips a NEW string adds: those in `to` that `from` did not already
 * have. A variant that keeps the source's "Log in" did not write it; one that
 * writes "Log in" over "Continue" did.
 */
export function newVoiceSlips(voice: CopyVoice | null | undefined, from: string, to: string): VoiceSlip[] {
  const had = new Map<string, number>();
  for (const s of voiceSlips(voice, from)) had.set(s.said.toLowerCase(), (had.get(s.said.toLowerCase()) ?? 0) + 1);
  return voiceSlips(voice, to).filter((s) => {
    const k = s.said.toLowerCase();
    const n = had.get(k) ?? 0;
    if (n > 0) {
      had.set(k, n - 1);
      return false;
    }
    return true;
  });
}
