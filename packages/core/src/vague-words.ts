import type { CanvasContents, Comment } from "./model.ts";

/**
 * **Say it like a designer: the words an agent can read more than one way**
 * (proactive-agent phase 10, design §12).
 *
 * `design-words.ts` is the glossary every surface underlines in an agent's
 * why. This is its other half, for what a PERSON types: a short list of vague
 * words ("pop", "cramped", "busy"), each with three named readings a designer
 * would tell apart, and the sentence a designer would say for each. The
 * composer underlines only these words, shows their readings while the
 * message is written, offers the designer's sentence on Tab, and sends the
 * person's own words on Enter, untouched. `isocan words read` prints the
 * same thing for a sentence an agent is about to act on.
 *
 * A separate module from the glossary because the glossary is on every
 * canvas's first paint (a proposal's why) and this is not: the composer loads
 * it on the first keystroke, so the list can grow without the entry paying.
 *
 * **Deterministic, and quiet by default.** A word is underlined only where
 * its context says it is about how something looks — "make the header pop",
 * "it feels cramped" — and never in "add a pop-up", "clean up the old
 * screens", "I'm too busy" or "warm up the cache". `vague-words.test.ts`
 * holds the list to a corpus of ordinary asks with no false positives.
 * Nothing is graded: keeping your own words is always fine, and offers fade
 * as a person's asks sharpen (`offerVague`).
 */

/** One way a vague word can be read, named as a designer would name it. */
interface Reading {
  /** The header the composer shows: "contrast". */
  name: string;
  /** One plain line under it. */
  means: string;
  /** The clause a designer would say, with `{what}` (the thing) and `{its}` (its possessive). */
  say: string;
  /** The word's stand-in when no clause around it can be read: "needs more pop" → "needs more contrast". */
  bare: string;
}

interface Vague {
  /** The word as the underline names it, lower case. */
  word: string;
  /** Where it counts: a global regex whose match is exactly the underlined word. */
  match: RegExp;
  /** Exactly three readings; the first is the best guess when nothing is picked. */
  readings: readonly [Reading, Reading, Reading];
}

// ---------- context, written once

/** Words that only intensify: "a bit", "too", "really", "visually". */
const INT = String.raw`(?:(?:a\s+(?:bit|little|lot|touch)|too|so|really|very|kind\s+of|kinda|quite|pretty|rather|super|way|overly|more|less|much|even|still|just|bit|somewhat|slightly|visually)\s+)*`;
/** The things a screen is made of — a subject that makes "is busy" about looks, not a person or a server. */
const NOUNS = String.raw`(?:screen|screens|page|layout|header|footer|menu|design|card|cards|hero|section|sidebar|nav|navigation|homepage|home\s+page|form|list|dashboard|ui|view|background|palette|colou?rs?|type|typography|font|fonts|button|buttons|banner|grid|modal|dialog|panel|checkout|logo|icon|icons|illustration|landing\s+page|onboarding|copy|text|title|headline|tile|tiles|table|chart)`;
/**
 * A subject a look is said of: "this looks", "the header is", or a clause
 * that opens on "feels" or "looks". Never "it's" or "this is" alone — "it's
 * busy right now" is a server, and "this task is boring" is a person.
 */
const SUBJECT = String.raw`(?:\b(?:it|this|that|everything)\s+(?:feels|looks|seems)|\b(?:the|this|that|our|my)\s+(?:[a-z]+\s+)?${NOUNS}\s+(?:is|are|feels?|looks?|seems?|gets)|(?:^|[,.;:!?(]\s*|\b(?:and|but|so|still|also|now|just|really|all|think|kinda)\s+)(?:feels?|looks?|seems?|feeling|looking))\s+`;
/** Things that are code, not looks: "make the code cleaner" is about the code. */
const NOT_LOOKS = String.raw`(?![^,.;:!?\n]{0,40}?\b(?:code|api|build|tests?|function|logic|diff|implementation|repo|script|module|query|data|commit|history|schema|cache|server|pipeline|sql|config|branch|refactor)\b)`;
/** "make X", "make X look", "make X feel" — a request about how X comes across (never "make sure"). */
const MAKE = String.raw`\b(?:make|making|let)\s+(?!sure\b)${NOT_LOOKS}[^,.;:!?\n]{1,40}?\s+(?:look\s+|feel\s+)?`;
/** "cramped and busy": a look word coordinated with another look word. */
const COORD = String.raw`\b(?:cramped|busy|heavy|bland|boring|dull|crowded|cluttered|dark|flat|cold|clean|modern|soft|warm)\s*(?:,|and|but|yet|or)\s+`;
/** A word said of how something looks: after a subject, after "make X", or beside another look word. */
const stated = (word: string, after = "") => new RegExp(String.raw`(?<=(?:${SUBJECT}|${MAKE}|${COORD})${INT})(?:${word})\b${after}`, "gi");

/** Clause frames the designer's sentence replaces whole; `what` is the thing it is said of. */
const STATE_FRAME = (word: string) => new RegExp(String.raw`(?:\b(?<what>it|this|that|everything|(?:the|this|that|our|my)\s+(?:[a-z]+\s+)?${NOUNS})(?:'s|’s|\s+(?:is|feels|looks|seems|gets))|\b(?:feels?|looks?|seems?))\s+${INT}(?:${word})\b`, "i");
const MAKE_FRAME = (word: string) => new RegExp(String.raw`\b(?:make|let|have|get)\s+(?<what>[^,.;:!?\n]{1,40}?)\s+(?:look\s+|feel\s+)?${INT}(?:${word})(?:\s+out)?(?:\s+(?:a\s+(?:bit|little|lot)|more))*\b`, "i");

const VAGUE: readonly Vague[] = [
  {
    word: "pop",
    // Not a pop-up, a popover, a stack's pop() or pop music.
    match: /(?<![.\w/-])pop(?:s|py)?\b(?![-‐]|\s*\(|\s+(?:up|ups|over|overs|in|into|onto|under|open|back|by|round|off|out\s+of|the|a|an|it\s+(?:off|in|into)|music|art|culture|songs?|stars?|quiz)\b)/gi,
    readings: [
      { name: "contrast", means: "How far it stands apart from what is around it in lightness — what is seen first.", say: "raise {its} contrast", bare: "contrast" },
      { name: "scale", means: "How big it is beside its neighbours — size says what matters most.", say: "make {what} larger", bare: "size" },
      { name: "colour", means: "A stronger, brighter hue — standing out by colour rather than by light or size.", say: "give {what} a stronger colour", bare: "colour" },
    ],
  },
  {
    word: "cramped",
    match: /\bcramped\b/gi,
    readings: [
      { name: "spacing", means: "The empty space between things, which separates groups so each reads on its own.", say: "add space between {its} parts", bare: "tightly spaced" },
      { name: "density", means: "How much sits in one space; less at once reads calmer.", say: "show less in {what} at once", bare: "too dense" },
      { name: "size", means: "The container itself: a bigger box gives the same things room.", say: "give {what} more room", bare: "too small" },
    ],
  },
  {
    word: "busy",
    match: stated("busy"),
    readings: [
      { name: "density", means: "How much sits in one space; fewer things at once read calmer.", say: "show fewer things in {what} at once", bare: "too dense" },
      { name: "noise", means: "Decoration competing for attention: borders, colours, weights and icons.", say: "quiet {its} decoration: fewer colours, borders and weights", bare: "noisy" },
      { name: "hierarchy", means: "The order the eye takes; one thing leads and the rest step back.", say: "let one thing in {what} lead and the rest step back", bare: "without a clear lead" },
    ],
  },
  {
    word: "clean",
    match: new RegExp(String.raw`(?:${stated("clean(?:er)?", String.raw`(?!\s+(?:up|out|build|install|code|slate|copy|exit|state|tree))`).source})|\bclean(?=\s+(?:look|feel|design|layout|style|aesthetic|lines)\b)`, "gi"),
    readings: [
      { name: "alignment", means: "Edges and centres on one grid, so nothing looks placed by accident.", say: "align {what} to one grid", bare: "aligned" },
      { name: "reduction", means: "Fewer elements, each earning its place.", say: "remove what in {what} does not earn its place", bare: "simpler" },
      { name: "white space", means: "Empty space used on purpose, around and between groups.", say: "give {what} more white space", bare: "more spacious" },
    ],
  },
  {
    word: "modern",
    match: new RegExp(String.raw`(?:${stated("modern", String.raw`(?!\s+(?:browsers?|javascript|js|css|apis?|syntax|tooling|standards?|devices?|hardware|versions?|stack|frameworks?))`).source})|\bmodern(?=\s+(?:look|feel|design|style|aesthetic|vibe)\b)`, "gi"),
    readings: [
      { name: "type", means: "The typeface and the steps between sizes — what most dates a screen.", say: "give {what} a current typeface and a tighter type scale", bare: "current in its type" },
      { name: "shape", means: "Surfaces, corners and borders: flatter, softer and fewer reads as recent.", say: "flatten {its} surfaces, soften the corners and drop the borders", bare: "flatter" },
      { name: "colour", means: "A brighter palette with one confident accent.", say: "give {what} a brighter palette with one confident accent", bare: "brighter" },
    ],
  },
  {
    word: "punchy",
    match: /\bpunch(?:y|ier)\b|(?<=\b(?:more|some|extra|less|no|bit\s+of|little)\s+)punch\b/gi,
    readings: [
      { name: "copy", means: "The words: shorter, more direct, verbs first.", say: "make {its} words shorter and more direct", bare: "more direct" },
      { name: "weight", means: "Type weight — heavier strokes carry more force.", say: "set {its} type heavier", bare: "heavier" },
      { name: "contrast", means: "How far it stands apart from what is around it in lightness — what is seen first.", say: "raise {its} contrast", bare: "contrast" },
    ],
  },
  {
    word: "heavy",
    match: stated("heavy", String.raw`(?!\s+(?:lifting|load|use|traffic))`),
    readings: [
      { name: "weight", means: "Type weight: lighter strokes read lighter.", say: "set {its} type lighter", bare: "heavy in its type" },
      { name: "colour", means: "Dark, saturated fills weigh more than light ones.", say: "lighten {its} fills and colours", bare: "dark in its fills" },
      { name: "density", means: "How much sits in one space; room between things lifts it.", say: "give {what} more white space", bare: "dense" },
    ],
  },
  {
    word: "warm",
    match: new RegExp(String.raw`(?:${stated("warm(?:er)?", String.raw`(?!\s+(?:up|start|cache|pool|standby|restart))`).source})|(?<=\b(?:more|some|bit\s+of|little|add|needs?|lacks?|no)\s+)warmth\b`, "gi"),
    readings: [
      { name: "colour", means: "Colour temperature: reds, oranges and yellows read warm; blues and greys read cool.", say: "shift {its} palette toward reds and yellows", bare: "warmer colour" },
      { name: "tone of voice", means: "The words: friendlier, more personal, said to one person.", say: "make {its} words friendlier and more personal", bare: "a friendlier tone" },
      { name: "shape", means: "Rounder corners and softer edges read gentler.", say: "round {its} corners and soften its edges", bare: "softer shapes" },
    ],
  },
  {
    word: "bland",
    match: stated("bland|boring|dull"),
    readings: [
      { name: "colour", means: "One accent colour gives a quiet screen a point of interest.", say: "bring one accent colour into {what}", bare: "without colour" },
      { name: "type", means: "Contrast between type sizes and weights gives a page rhythm.", say: "give {its} type more contrast in size and weight", bare: "flat in its type" },
      { name: "imagery", means: "Pictures, illustration or icons that carry character.", say: "add an image or illustration to {what}", bare: "without imagery" },
    ],
  },
  {
    word: "soft",
    match: stated("soft(?:er)?", String.raw`(?!\s+(?:delete|launch|limit|wrap|reset|lock|cap|deadline|skills?))`),
    readings: [
      { name: "shape", means: "Rounder corners read gentler than square ones.", say: "round {its} corners", bare: "rounder" },
      { name: "contrast", means: "Less distance between light and dark reads quieter.", say: "lower {its} contrast", bare: "lower in contrast" },
      { name: "colour", means: "Paler, less saturated colours read softer.", say: "move {its} colours toward pastels", bare: "paler" },
    ],
  },
];

/** The frames each word's clause can be read in, beyond its bare self. */
const FRAMES: Record<string, readonly RegExp[]> = {
  pop: [MAKE_FRAME("pop")],
  cramped: [STATE_FRAME("cramped"), MAKE_FRAME("cramped")],
  busy: [STATE_FRAME("busy"), MAKE_FRAME("busy")],
  clean: [MAKE_FRAME("clean(?:er)?"), STATE_FRAME("clean(?:er)?")],
  modern: [MAKE_FRAME("modern"), STATE_FRAME("modern")],
  punchy: [MAKE_FRAME("punch(?:y|ier)"), STATE_FRAME("punch(?:y|ier)")],
  heavy: [STATE_FRAME("heavy"), MAKE_FRAME("heavy")],
  warm: [MAKE_FRAME("warm(?:er)?"), STATE_FRAME("warm(?:er)?")],
  bland: [STATE_FRAME("bland|boring|dull"), MAKE_FRAME("bland|boring|dull")],
  soft: [MAKE_FRAME("soft(?:er)?"), STATE_FRAME("soft(?:er)?")],
};

/** A vague word found in a sentence: where it is, and its three readings. */
interface VagueSpan {
  /** Offsets into the sentence: `text.slice(start, end)` is the word as typed. */
  start: number;
  end: number;
  /** The word as typed. */
  said: string;
  /** The list's word ("pop" for "poppy"). */
  word: string;
  readings: readonly Reading[];
}

/**
 * **The words in a sentence an agent could read more than one way** — the
 * underline's data. Only the list's words, only in a context about how
 * something looks, in the order they appear, never overlapping.
 */
export function vagueWords(text: string): VagueSpan[] {
  const found: VagueSpan[] = [];
  for (const v of VAGUE) {
    for (const m of text.matchAll(new RegExp(v.match.source, v.match.flags))) {
      const start = m.index ?? 0;
      if (found.some((f) => start < f.end && start + m[0].length > f.start)) continue;
      found.push({ start, end: start + m[0].length, said: m[0], word: v.word, readings: v.readings });
    }
  }
  return found.sort((a, b) => a.start - b.start);
}

/** "it" → "its", "the header" → "the header's": the possessive a reading's clause needs. */
function possessive(what: string): string {
  const w = what.trim();
  if (/^(?:it|this|that|everything)$/i.test(w)) return "its";
  if (/^(?:them|these|those)$/i.test(w)) return "their";
  return /s$/i.test(w) ? `${w}'` : `${w}'s`;
}

/**
 * **The sentence a designer would say** — the person's sentence with each
 * vague word's clause said as its reading: "make the header pop more, it
 * feels cramped" → "raise the header's contrast and add space between its
 * parts". `picks` names a reading per word (`{ pop: "scale" }`); a word with
 * no pick takes its first, the best guess. Null when nothing in it is vague —
 * there is nothing to offer.
 */
export function designerSentence(text: string, picks: Readonly<Record<string, string>> = {}): string | null {
  const spans = vagueWords(text);
  if (spans.length === 0) return null;
  // Each span's replacement over the text it covers: its clause when a frame
  // holds it, else the word alone. Right to left, so offsets stay true.
  const edits: { start: number; end: number; with: string; clause: boolean }[] = [];
  for (const span of spans) {
    const reading = span.readings.find((r) => r.name === picks[span.word]) ?? span.readings[0]!;
    let edit = { start: span.start, end: span.end, with: reading.bare, clause: false };
    for (const frame of FRAMES[span.word] ?? []) {
      for (const m of text.matchAll(new RegExp(frame.source, "gi"))) {
        const start = m.index ?? 0;
        const end = start + m[0].length;
        if (start > span.start || end < span.end) continue;
        if (edits.some((e) => start < e.end && end > e.start)) continue;
        const what = (m.groups?.["what"] ?? "it").trim();
        edit = { start, end, with: reading.say.replaceAll("{what}", what).replaceAll("{its}", possessive(what)), clause: true };
        break;
      }
      if (edit.clause) break;
    }
    edits.push(edit);
  }
  let out = text;
  for (const e of [...edits].sort((a, b) => b.start - a.start)) {
    let start = e.start;
    let said = e.with;
    // A clause after a comma joins the one before it: ", it feels cramped" → " and add space…".
    const before = out.slice(0, start);
    if (e.clause && /,\s*$/.test(before) && edits.some((x) => x.clause && x.end <= e.start)) {
      start = before.replace(/,\s*$/, "").length;
      said = ` and ${said}`;
    }
    // A sentence that began with a capital still does.
    if (e.clause && /^\s*$|[.!?]\s+$/.test(out.slice(0, start)) && /[A-Z]/.test(text[e.start] ?? "")) said = said[0]!.toUpperCase() + said.slice(1);
    out = out.slice(0, start) + said + out.slice(e.end);
  }
  return out;
}

// ---------- the vocabulary panel

/** One of your words the agent has learned: a taste-note line `"the thumb button" means …`. */
interface LearnedWord {
  said: string;
  means: string;
}

/**
 * **Your words the agent has learned** — the taste note's lines that define a
 * word of the person's own (`isocan taste '"the thumb button" means the main
 * action, within thumb reach'`). The taste note is where a delete's lesson
 * already lands (phase 1); a coinage is one more kind of line in it.
 */
export function learnedWords(taste: string | null): LearnedWord[] {
  const out: LearnedWord[] = [];
  for (const line of (taste ?? "").split("\n")) {
    const m = /^\s*(?:[-*]\s+)?["“'‘]([^"”'’]{1,60})["”'’]\s+(?:means|is|=|→)\s+(.{2,200})$/.exec(line);
    if (m) out.push({ said: m[1]!.trim(), means: m[2]!.trim().replace(/\.$/, "") });
  }
  return out;
}

/**
 * The words the panel counts: the glossary's terms (`glossaryTerms()`, passed
 * in — importing `design-words.ts` here would split it out of the CLI's main
 * chunk into one more module for every command) and every reading's name.
 */
function vocabularyTerms(glossary: readonly string[]): string[] {
  return [...new Set([...glossary, ...VAGUE.flatMap((v) => v.readings.map((r) => r.name))])].sort((a, b) => b.length - a.length);
}

/** What one person typed, oldest first: their own comments, records left out. */
function asksBy(canvas: CanvasContents, actorId: string): Comment[] {
  return Object.values(canvas.threads ?? {})
    .flatMap((t) => t.comments)
    .filter((c) => c.author.id === actorId && !c.record)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/**
 * **The vocabulary panel** (design §12): the design words you now use in
 * your own messages; the ones you have seen here — in an agent's message or a
 * proposal's why — and not used; and your own words the agent has learned.
 * Lists, never a score. `sharp` (asks that needed no translation) is only
 * shown to a person who opted in.
 */
export function vocabulary(canvas: CanvasContents, actorId: string, taste: string | null, glossary: readonly string[]): {
  use: string[];
  seen: string[];
  learned: LearnedWord[];
  sharp: { asks: number; plain: number };
} {
  const terms = vocabularyTerms(glossary);
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Longest first, each match taken out of the text, so "type scale" is not also "type" and "scale".
  const termsIn = (text: string) => {
    let rest = text;
    return terms.filter((t) => {
      const pattern = new RegExp(`\\b${escape(t)}\\b`, "gi");
      const hit = pattern.test(rest);
      if (hit) rest = rest.replace(pattern, " ");
      return hit;
    });
  };
  const mine = asksBy(canvas, actorId);
  const use = new Set(mine.flatMap((c) => termsIn(c.body)));
  const theirs = [
    ...Object.values(canvas.threads ?? {}).flatMap((t) => t.comments).filter((c) => c.author.id !== actorId).map((c) => c.body),
    ...Object.values(canvas.items).map((i) => i.properties?.["proposalWhy"] ?? ""),
  ];
  const seen = new Set(theirs.flatMap(termsIn).filter((t) => !use.has(t)));
  const recent = mine.slice(-20);
  return {
    use: [...use].sort(),
    seen: [...seen].sort(),
    learned: learnedWords(taste),
    sharp: { asks: recent.length, plain: recent.filter((c) => vagueWords(c.body).length === 0).length },
  };
}

/** When to offer readings and the designer's sentence — the *when I am vague* setting. */
type OfferWhen = "fading" | "always" | "never";

/**
 * **Whether to offer at all** (*when I am vague*). `always` offers on every
 * vague word; `never` underlines nothing; `fading`, the default, offers until
 * the person's asks here are sharp — eight of their last ten needed no
 * translation — and then stops, so offers grow rarer as asks get sharper.
 */
export function offerVague(when: OfferWhen, canvas: CanvasContents, actorId: string): boolean {
  if (when === "never") return false;
  if (when === "always") return true;
  const last = asksBy(canvas, actorId).slice(-10);
  return !(last.length >= 10 && last.filter((c) => vagueWords(c.body).length === 0).length >= 8);
}

/**
 * **A picked reading, as it travels with a message** (`Comment.readings`):
 * the word and the reading's name. Refused in a sentence when it does not
 * name one of the word's three readings — the reducer has its own shape
 * check; this one knows the list.
 */
export function readingRefusal(pick: { word: string; reading: string }): string | null {
  const v = VAGUE.find((x) => x.word === pick.word);
  if (!v) return `"${pick.word}" is not one of the words with readings (${VAGUE.map((x) => x.word).join(", ")})`;
  if (!v.readings.some((r) => r.name === pick.reading)) return `"${pick.word}" reads as ${v.readings.map((r) => r.name).join(", ")} — not "${pick.reading}"`;
  return null;
}
