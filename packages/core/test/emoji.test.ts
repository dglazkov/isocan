import { describe, expect, it } from "vitest";

import {
  ALL_EMOJI,
  EMOJI_GROUPS,
  QUICK_REACTIONS,
  emojiName,
  searchEmoji,
} from "../src/index.ts";

/**
 * The picker's set and the search that reaches into it.
 *
 * The set is curated rather than complete on purpose (see `emoji.ts`), so
 * these guard the two things a curated set can get wrong: a mark that cannot
 * be found by the word somebody would type for it, and a search loose enough
 * that the right answer is buried under near-misses.
 */
describe("the emoji a picker offers", () => {
  it("is one set, with no mark listed twice", () => {
    // Two groups both claiming 🔥 puts it on screen twice and makes "recent"
    // ambiguous about which one you pressed.
    const seen = ALL_EMOJI.map((entry) => entry.emoji);
    expect(new Set(seen).size).toBe(seen.length);
  });

  it("offers the starter set from within the set", () => {
    // QUICK_REACTIONS is the empty-recents fallback, so every one of them has
    // to be a mark the picker can also show a name for.
    for (const emoji of QUICK_REACTIONS) {
      expect(seen(emoji), `${emoji} is offered but not in any group`).toBe(true);
    }
  });

  const seen = (emoji: string) => ALL_EMOJI.some((entry) => entry.emoji === emoji);

  it("leads with the group that answers the question this picker is for", () => {
    expect(EMOJI_GROUPS[0]!.name).toBe("Verdicts");
  });

  it("carries the identity half as well as the verdict half", () => {
    // A mark is worn on every face in the app, not just pressed onto an item.
    const names = EMOJI_GROUPS.map((group) => group.name);
    for (const group of ["Nature", "Food", "Travel", "Activity", "Symbols", "Flags"]) {
      expect(names, `no ${group} group`).toContain(group);
    }
  });

  it("gives every mark at least one word that is not its own name", () => {
    for (const entry of ALL_EMOJI) {
      expect(entry.keywords.length, `${entry.emoji} has no keywords`).toBeGreaterThan(0);
    }
  });
});

describe("finding a mark by typing", () => {
  const top = (query: string) => searchEmoji(query)[0]?.emoji;

  it("puts the obvious answer first", () => {
    expect(top("fire")).toBe("🔥");
    expect(top("star")).toBe("⭐");
    expect(top("bug")).toBe("🐛");
    expect(top("rocket")).toBe("🚀");
  });

  it("finds a mark by a word that is not its name", () => {
    // The whole reason keywords exist: nobody searches "construction" for the
    // thing they mean by "wip".
    expect(searchEmoji("wip").map((e) => e.emoji)).toContain("🚧");
    expect(searchEmoji("lol").map((e) => e.emoji)).toContain("😂");
    expect(searchEmoji("approve").map((e) => e.emoji)).toContain("👍");
    expect(searchEmoji("regression").map((e) => e.emoji)).toContain("📉");
  });

  it("matches word PREFIXES, not substrings anywhere", () => {
    // Substring search is what makes a small set feel broken: "ok" inside
    // "broken", "bookmark" and "looking" buries 🆗 under three wrong answers.
    const results = searchEmoji("ok").map((e) => e.emoji);
    expect(results).toContain("🆗");
    expect(results).not.toContain("💔"); // "broken heart"
    expect(results).not.toContain("🔖"); // "bookmark"
  });

  it("narrows on a second word instead of widening", () => {
    // Every term must match. "green heart" is one mark, not everything green
    // plus every heart.
    const both = searchEmoji("green heart");
    expect(both.map((e) => e.emoji)).toEqual(["💚"]);
  });

  it("says nothing for an empty query, rather than everything", () => {
    // The picker shows groups when there is no query; a search that answered
    // with the whole set would render the group tabs meaningless.
    expect(searchEmoji("")).toEqual([]);
    expect(searchEmoji("   ")).toEqual([]);
  });

  it("comes back empty on a miss, and does not throw", () => {
    expect(searchEmoji("zzzznotathing")).toEqual([]);
  });

  it("prefers a word matched whole over one merely started", () => {
    // Reported the other way round: the picker had no flags at all, and when
    // it got them "uk" answered 🇺🇦 — Ukraine's name simply begins with the
    // two letters somebody meant as the whole name of a country. Exactness
    // has to outrank prefix-ness or every short query lands on a near-miss.
    expect(top("uk")).toBe("🇬🇧");
    expect(top("japan")).toBe("🇯🇵");
    expect(top("plane")).toBe("✈️");
  });

  it("finds a mark whose name is a proper noun", () => {
    // Every curated name was lowercase until the flags arrived, so search
    // compared a lowercased query against a capital "U" and matched nothing.
    // "united kingdom" returned an empty panel for the one entry named it.
    expect(top("united kingdom")).toBe("🇬🇧");
    expect(top("new zealand")).toBe("🇳🇿");
  });

  it("finds a country by its two-letter code as well as its name", () => {
    // Somebody reaching for their own flag types either one.
    expect(top("gb")).toBe("🇬🇧");
    expect(top("nz")).toBe("🇳🇿");
    expect(top("br")).toBe("🇧🇷");
  });

  it("reaches the marks that are about who you are, not what you think", () => {
    // The set was eight groups of verdicts, which is the reaction question.
    // A mark is also a face, and "I wanted an anchor, and a UK flag" is the
    // other question — neither is a verdict on anything.
    expect(top("anchor")).toBe("⚓");
    expect(top("pizza")).toBe("🍕");
    expect(top("guitar")).toBe("🎸");
    expect(top("mountain")).toBe("🏔️");
  });

  it("honours the limit", () => {
    // "e" prefixes a great many words; the panel is a fixed size.
    expect(searchEmoji("a", 5).length).toBeLessThanOrEqual(5);
  });
});

describe("naming a mark", () => {
  it("answers with the curated name", () => {
    expect(emojiName("🚧")).toBe("construction");
  });

  it("answers with the mark itself when it has never heard of it", () => {
    // `item.react` takes any string, so the CLI can wear a mark this file does
    // not know. A tooltip must not come back empty for it.
    expect(emojiName("🫏")).toBe("🫏");
  });
});
