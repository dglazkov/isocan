/**
 * The emoji a picker offers, and the words that find them.
 *
 * **Curated, not complete, and that is the design.** Unicode has ~1,900
 * emoji. Shipping all of them means shipping a keyword index for all of them —
 * the standard datasets are 200–800KB — into a bundle that is already over its
 * warning threshold, to answer a question a canvas of screens does not ask.
 * What gets asked here is a small set of things: is this the one, does it need
 * work, is it done, is it funny, who owns it. This set is built for that, wide
 * enough that nobody feels fenced in and small enough to load with the picker.
 *
 * **Nothing on first paint imports this file, and that is load-bearing.** The
 * set is ~23KB minified, and the only reader is `EmojiPicker`, which the web
 * app fetches behind `import()` when somebody presses `+`. The one constant
 * the eager half needs — `QUICK_REACTIONS`, the recents fallback — lives in
 * `reactions.ts` for that reason: a bundler places a module, not an export,
 * so one eager reader of a constant here would pin the whole set back into the
 * entry chunk (the `arrow.ts` lesson). So would the one top-level call in the
 * file losing its `@__PURE__` — see `ALL_EMOJI`.
 *
 * The set is ~580 marks across fourteen groups, each with the words somebody
 * would actually type to find it. Keywords are lowercase and matched as
 * PREFIXES of whole words, so "fi" finds 🔥 (fire) and "re" finds ❤️ (red
 * heart) without "ire" matching either — substring search on a set this size
 * returns noise that reads as a broken search.
 *
 * **Why it grew, and where the line still is.** The first eight groups
 * answer *what do I think of this* — the reaction question. But a mark is
 * also how somebody is drawn on every face in the app, and *who am I* draws
 * on a different vocabulary: where you are from, what you sail, what you
 * keep. Reported as "I wanted an anchor, and a UK flag" — neither of which
 * is a verdict on anything. So the later six groups are the identity half:
 * Nature, Food, Travel, Activity, Symbols and Flags. Flags carry both the
 * country name and its two-letter code, because somebody reaching for theirs
 * types either one.
 *
 * It is still curation, not completeness — ~580 of Unicode's ~1,900, chosen
 * so that every one of them has words worth searching. A full dataset is the
 * 200–800KB this file exists not to ship.
 *
 * There is no lock-in: `item.react` takes any string, so the CLI can wear a
 * mark this file has never heard of and it renders, groups and counts exactly
 * like the rest. This is what the picker OFFERS, never what the canvas allows.
 */
export interface EmojiEntry {
    emoji: string;
    /** What it is called. Shown as the title, and searched. */
    name: string;
    /** Other words that should find it. `name` is searched too — these are the
     * ones that are not in it. */
    keywords: readonly string[];
}
interface EmojiGroup {
    /** The tab label. Short: these sit in a row across a narrow panel. */
    name: string;
    entries: readonly EmojiEntry[];
}
/**
 * The groups, in the order a picker shows them.
 *
 * "Verdicts" leads deliberately. It is not a standard emoji category — the
 * standard first category is smileys — but it is the one that answers the
 * question this picker exists for, and a picker whose first row is the answer
 * is a picker most people never scroll.
 */
export declare const EMOJI_GROUPS: readonly EmojiGroup[];
/**
 * Every entry, flattened — the search corpus.
 *
 * **The `@__PURE__` is what lets this file leave the entry chunk.** Rollup
 * cannot prove a method call on a module-level value is free of side effects,
 * so without it this one line made the whole module "effectful" — and an
 * effectful module is kept wherever it is statically reachable, which through
 * core's `export *` barrel is every first visit, picker or no picker. Measured:
 * with the annotation, `emoji.ts` builds into its own chunk beside the picker;
 * without it, 23.5KB of it stays in the entry however lazily the picker loads.
 */
export declare const ALL_EMOJI: readonly EmojiEntry[];
/**
 * Emoji whose name or keywords have a word STARTING with each term typed.
 *
 * Prefix-per-word rather than substring, and the difference is the difference
 * between a search that works and one that looks broken: "ok" as a substring
 * hits "broken", "bookmark" and "looking" before it reaches 🆗. Every term
 * must match (AND), so "green heart" narrows instead of widening.
 *
 * Ranked by how exactly the match landed. A word matched WHOLE beats a word
 * merely started, and the name beats a keyword: "star" puts ⭐ above 🤩,
 * "fire" puts 🔥 first, "uk" puts 🇬🇧 above 🇺🇦 — which it did not when a
 * name prefix outranked every keyword, because Ukraine begins with the two
 * letters somebody meant as a whole word. Ties keep the curated order, which
 * is deliberate: it is the order somebody chose.
 */
export declare function searchEmoji(query: string, limit?: number): EmojiEntry[];
/** What one emoji is called, for a tooltip. Unknown marks — anything the CLI
 * wore that this file has never heard of — answer with themselves rather than
 * with nothing, so a title is never empty. */
export declare function emojiName(emoji: string): string;
export {};
