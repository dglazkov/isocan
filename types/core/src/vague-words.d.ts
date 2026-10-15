import type { CanvasContents } from "./model.js";
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
export declare function vagueWords(text: string): VagueSpan[];
/**
 * **The sentence a designer would say** — the person's sentence with each
 * vague word's clause said as its reading: "make the header pop more, it
 * feels cramped" → "raise the header's contrast and add space between its
 * parts". `picks` names a reading per word (`{ pop: "scale" }`); a word with
 * no pick takes its first, the best guess. Null when nothing in it is vague —
 * there is nothing to offer.
 */
export declare function designerSentence(text: string, picks?: Readonly<Record<string, string>>): string | null;
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
export declare function learnedWords(taste: string | null): LearnedWord[];
/**
 * **The vocabulary panel** (design §12): the design words you now use in
 * your own messages; the ones you have seen here — in an agent's message or a
 * proposal's why — and not used; and your own words the agent has learned.
 * Lists, never a score. `sharp` (asks that needed no translation) is only
 * shown to a person who opted in.
 */
export declare function vocabulary(canvas: CanvasContents, actorId: string, taste: string | null, glossary: readonly string[]): {
    use: string[];
    seen: string[];
    learned: LearnedWord[];
    sharp: {
        asks: number;
        plain: number;
    };
};
/** When to offer readings and the designer's sentence — the *when I am vague* setting. */
type OfferWhen = "fading" | "always" | "never";
/**
 * **Whether to offer at all** (*when I am vague*). `always` offers on every
 * vague word; `never` underlines nothing; `fading`, the default, offers until
 * the person's asks here are sharp — eight of their last ten needed no
 * translation — and then stops, so offers grow rarer as asks get sharper.
 */
export declare function offerVague(when: OfferWhen, canvas: CanvasContents, actorId: string): boolean;
/**
 * **A picked reading, as it travels with a message** (`Comment.readings`):
 * the word and the reading's name. Refused in a sentence when it does not
 * name one of the word's three readings — the reducer has its own shape
 * check; this one knows the list.
 */
export declare function readingRefusal(pick: {
    word: string;
    reading: string;
}): string | null;
export {};
