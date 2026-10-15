/**
 * **Design words: the small glossary behind every dotted underline**
 * (proactive-agent design §2.4, phase 1).
 *
 * A proposal's why is said in design words so the person learns the language
 * by seeing their own work described in it — never by a tutorial. That only
 * teaches if a term can be asked about where it stands, so every surface that
 * shows a why underlines the terms it knows and defines each in place. This
 * table is the one list: term, a one-line definition, and the plain phrases a
 * person types that mean it (which §12 will read for the composer).
 *
 * Deterministic and small on purpose: a model is not needed to underline a
 * word, and a glossary nobody can read in one sitting is not a glossary.
 */
interface DesignWord {
  /** The term as a designer says it, lower case. */
  term: string;
  /** One line, plain, that a person reads under a pointer. */
  means: string;
  /** What a person types when they mean this — for the composer's readings (§12). */
  plain: readonly string[];
}

/** The terms the grammar and its first moments name. */
const DESIGN_WORDS: readonly DesignWord[] = [
  { term: "summary before detail", means: "Put what the person must check or decide first; the supporting detail follows.", plain: ["show the important bit first", "put that at the top"] },
  { term: "visual hierarchy", means: "The order the eye takes through a screen, set by size, weight, colour and position.", plain: ["make it more obvious", "it gets lost"] },
  { term: "proximity", means: "Things placed close together read as belonging together; space between them says they do not.", plain: ["group these", "it feels scattered"] },
  { term: "contrast", means: "How far apart two things are in lightness, size or colour — what makes one stand out from another.", plain: ["make it pop", "it's hard to see"] },
  { term: "primary action", means: "The one thing a screen most wants the person to do next, drawn so it is found first.", plain: ["the main button", "what should I press"] },
  { term: "type scale", means: "A small fixed set of text sizes, each a step from the last, used everywhere instead of one-off sizes.", plain: ["the fonts are all different sizes", "tidy the text sizes"] },
  { term: "progressive disclosure", means: "Show what is needed now and reveal the rest when it is asked for.", plain: ["too much at once", "hide the advanced stuff"] },
  { term: "gate before value", means: "Asking for something (a sign-up, a permission) before the person has seen what they get for it.", plain: ["make them sign up first"] },
  { term: "scan line", means: "The path the eye runs down a list; breaking its alignment makes a list slow to read.", plain: ["hard to skim", "the list is messy"] },
  { term: "density", means: "How much sits in a given space — tight for experts scanning, loose for people reading.", plain: ["it feels cramped", "too empty"] },
  { term: "affordance", means: "What a thing looks like it lets you do: a button that looks pressable, a field that looks typeable.", plain: ["I didn't know I could click it"] },
  { term: "fidelity", means: "How finished a drawing looks — a rough wireframe invites change; a polished screen invites approval.", plain: ["just a sketch", "make it look real"] },
];

/** One run of a sentence: plain words, or a known term with its definition. */
type WordSpan = { text: string; word?: DesignWord };

/**
 * **A sentence split at the terms it uses** — the underline's data. Longest
 * term first, case-insensitive, whole words only, each occurrence its own
 * span; everything else is plain text. Concatenating the spans' text gives
 * the sentence back exactly.
 */
export function designWordSpans(text: string): WordSpan[] {
  const terms = [...DESIGN_WORDS].sort((a, b) => b.term.length - a.term.length);
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`\\b(${terms.map((w) => escape(w.term)).join("|")})\\b`, "gi");
  const spans: WordSpan[] = [];
  let at = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > at) spans.push({ text: text.slice(at, start) });
    const word = terms.find((w) => w.term === match[0].toLowerCase());
    spans.push(word ? { text: match[0], word } : { text: match[0] });
    at = start + match[0].length;
  }
  if (at < text.length) spans.push({ text: text.slice(at) });
  return spans;
}

/**
 * **The plain phrases a sentence uses, each beside the term that means it**
 * — Explain's *speak design* (proactive-agent phase 4): "make it more
 * obvious" → *visual hierarchy*. Case-insensitive, whole words, the phrase
 * as it was typed; one reading per phrase, in the order they appear.
 */
export function plainReadings(text: string): { said: string; term: string; means: string }[] {
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const found: { at: number; said: string; term: string; means: string }[] = [];
  for (const word of DESIGN_WORDS) {
    for (const phrase of word.plain) {
      const m = new RegExp(`\\b${escape(phrase)}\\b`, "i").exec(text);
      if (m) found.push({ at: m.index, said: m[0], term: word.term, means: word.means });
    }
  }
  return found.sort((a, b) => a.at - b.at).map(({ said, term, means }) => ({ said, term, means }));
}

/** **Every term the glossary defines** — what the vocabulary panel (§12) counts as a design word. */
export function glossaryTerms(): string[] {
  return DESIGN_WORDS.map((w) => w.term);
}
