import { describe, expect, it } from "vitest";
import { applyOperation, glossaryTerms, OpValidationError, type CanvasContents, type Comment } from "../src/index.ts";
import { envelope } from "./helpers.ts";
import { designerSentence, learnedWords, offerVague, readingRefusal, vagueWords, vocabulary } from "../src/vague-words.ts";

/**
 * **Say it like a designer** (proactive-agent phase 10, design §12): the
 * words an agent could read more than one way are underlined, and nothing
 * else is. The second half matters more than the first — an underline on an
 * ordinary ask is a composer correcting somebody who was clear — so the list
 * is held to a corpus of real-looking asks, the kind typed into a Chat on a
 * canvas every day, with tricky neighbours on purpose ("pop-up", "clean up",
 * "too busy", "warm up the cache", "modern browsers", "make sure").
 */

/** Asks that say what they mean. None may be underlined. */
const PRECISE = [
  "Add a pop-up when the order fails to go through",
  "Show a popover with the pickup time on hover",
  "pop the last screen off the flow, we don't need it",
  "The dialog should pop up after the second visit",
  "Clean up the unused screens on the left",
  "Can you clean up the old variations before Friday?",
  "I'm busy tomorrow, park the checkout work",
  "The server is busy, try the export again later",
  "It's busy right now, I'll look after lunch",
  "Warm up the cache before the demo",
  "We can rely on modern browsers supporting :has()",
  "Make sure the build is clean before you share it",
  "Make the code cleaner in the export script",
  "The diff looks clean, go ahead and choose it",
  "Tests look clean on my machine",
  "Make the title bold and 24px",
  "Raise the contrast of the total to 4.5:1",
  "Move the pickup time above the total",
  "Use the accent colour from DESIGN.md for the primary button",
  "Set the spacing between cards to 16px",
  "Align the prices to the right edge",
  "Swap the hero image for the sourdough photo",
  "Rename the Basket screen to Cart",
  "Add a third variation with the photo on the left",
  "Make the header 64px tall",
  "Make the button full width on mobile",
  "Increase the body text to 17px and the line height to 1.5",
  "Use Inter for headings and system-ui for body",
  "Show the opening hours in the footer",
  "Can you add an empty state for the basket?",
  "Compare the two checkout screens and keep the one with the pickup first",
  "Replace 'Submit' with 'Place order'",
  "The menu should list today's bakes first",
  "Group the pastries and the breads under two headings",
  "Make the total sticky at the bottom of the screen",
  "Delete the old onboarding flow",
  "Tidy the canvas into a grid",
  "Walk the checkout flow as a one-handed user",
  "What did the critics say about the menu?",
  "Explain why the header changed yesterday",
  "Draw a wireframe of the order history screen",
  "Use a 4px radius on all cards",
  "Make the logo smaller, 32px",
  "Put the sign-up after the first order, not before the menu",
  "Translate the menu into French",
  "Export the checkout screen as a PNG",
  "The pickup slot is hard to find, put it above the fold",
  "Reduce the number of fonts to two",
  "Hide the advanced filters behind a 'More' link",
  "Use the soft delete for removed items so we can restore them",
  "We're doing a soft launch next week, prepare the share link",
  "That was heavy lifting, thanks for the refactor",
  "The heavy load on the server made the import slow",
  "Fresh install of the CLI fixed it",
  "Make the background #f4ede4",
  "Make the card shadows lighter: 0 1px 2px at 10%",
  "Add 24px of padding around the hero",
  "I'm too busy to review this today",
  "This task is boring but needs doing: rename every screen",
  "Pop into the Chat when you're done",
  "Make the list scannable: one line per item with the price on the right",
  "The pickup time and the total should sit together",
  "Set the primary button to the brand red",
  "Can you make a version without the photo?",
  "Undo the last change to the footer",
  "Make the CTA say 'Order for pickup'",
  "Let the cache warm before measuring",
  "Swap the order of the tabs: Menu, Basket, Orders",
  "Use sentence case for every button label",
  "Make the error message say what went wrong and what to do",
  "Make 3 variations of the empty basket",
  "Show me the history of the menu screen",
  "Keep the proposal and fold it into the checkout",
  "Add the allergen icons beside each item",
  "Is the contrast of the grey text AA?",
  "Move the logo into the header's left corner",
  "Make the modern browsers path the default, drop the polyfill",
  "Turn the price into a number with two decimals",
  "Let me know when the night's work is ready",
  "Put the soft limit at 5 proposals",
];

/** Asks a designer would ask back about. Each must be underlined at the word named. */
const VAGUE: Array<[string, string[]]> = [
  ["make the header pop more, it feels cramped", ["pop", "cramped"]],
  ["Make it pop", ["pop"]],
  ["the total needs more pop", ["pop"]],
  ["this looks too busy", ["busy"]],
  ["The menu is busy, can you fix it?", ["busy"]],
  ["make the checkout cleaner", ["clean"]],
  ["I want a clean look for the menu", ["clean"]],
  ["make it look more modern", ["modern"]],
  ["the hero feels heavy", ["heavy"]],
  ["make the copy punchier", ["punchy"]],
  ["can it have a bit more punch?", ["punchy"]],
  ["make the welcome screen warmer", ["warm"]],
  ["it needs more warmth", ["warm"]],
  ["the homepage looks boring", ["bland"]],
  ["it feels a bit bland", ["bland"]],
  ["make the buttons softer", ["soft"]],
  ["the cards feel cramped and busy", ["cramped", "busy"]],
  ["Looks cramped on mobile", ["cramped"]],
  ["the layout is cramped", ["cramped"]],
  ["make the banner pop out a bit", ["pop"]],
];

describe("the underline", () => {
  it("finds pop and cramped, and only them, in the journey's sentence", () => {
    const text = "make the header pop more, it feels cramped";
    const spans = vagueWords(text);
    expect(spans.map((s) => [s.word, text.slice(s.start, s.end)])).toEqual([["pop", "pop"], ["cramped", "cramped"]]);
    expect(spans[0]!.readings.map((r) => r.name)).toEqual(["contrast", "scale", "colour"]);
    expect(spans[1]!.readings).toHaveLength(3);
  });

  it.each(VAGUE)("underlines %j", (text, words) => {
    expect(vagueWords(text).map((s) => s.word)).toEqual(words);
  });

  it("underlines nothing in the corpus of precise asks — no false positives", () => {
    const flagged = PRECISE.filter((ask) => vagueWords(ask).length > 0).map((ask) => `${ask} → ${vagueWords(ask).map((s) => s.said).join(", ")}`);
    expect(flagged).toEqual([]);
    // The measure the phase reports: 0 of the corpus.
    expect(PRECISE.length).toBeGreaterThanOrEqual(80);
  });

  it("finds every vague ask in the corpus", () => {
    const missed = VAGUE.filter(([text]) => vagueWords(text).length === 0);
    expect(missed).toEqual([]);
  });

  it("gives every word exactly three readings, each with a clause and a stand-in", () => {
    for (const [text] of VAGUE) {
      for (const span of vagueWords(text)) {
        expect(span.readings).toHaveLength(3);
        expect(new Set(span.readings.map((r) => r.name)).size).toBe(3);
        for (const r of span.readings) {
          expect(r.say.length).toBeGreaterThan(5);
          expect(r.bare.length).toBeGreaterThan(2);
          expect(r.means.length).toBeGreaterThan(20);
        }
      }
    }
  });
});

describe("the sentence a designer would say", () => {
  it("says the journey's sentence in design words, best guess first", () => {
    expect(designerSentence("make the header pop more, it feels cramped")).toBe("raise the header's contrast and add space between its parts");
  });

  it("follows a picked reading", () => {
    expect(designerSentence("make the header pop more, it feels cramped", { pop: "scale", cramped: "density" })).toBe("make the header larger and show less in it at once");
    expect(designerSentence("Make the checkout cleaner", { clean: "white space" })).toBe("Give the checkout more white space");
  });

  it("replaces the word alone when no clause around it can be read", () => {
    expect(designerSentence("the total needs more pop")).toBe("the total needs more contrast");
  });

  it("offers nothing for a sentence that is already clear", () => {
    expect(designerSentence("Move the pickup time above the total")).toBeNull();
  });

  it("keeps everything around the vague clause as it was typed", () => {
    expect(designerSentence("On Checkout, make the total pop. Thanks!")).toBe("On Checkout, raise the total's contrast. Thanks!");
  });
});

describe("a picked reading", () => {
  it("travels with the message as data, and the words stay as typed", () => {
    let s = applyOperation(null, envelope({ type: "project.create", canvasId: "prj_test", title: "Acme Bakery", description: "" }));
    const body = "make the header pop more, it feels cramped";
    s = applyOperation(s, envelope({ type: "thread.create", threadId: "thr_m", x: 0, y: 0, anchorItemId: null, main: true, comment: { id: "cmt_m", body, readings: [{ word: "pop", reading: "contrast" }] } }));
    const sent = s!.canvas.threads.thr_m!.comments[0]!;
    expect(sent.body).toBe(body);
    expect(sent.readings).toEqual([{ word: "pop", reading: "contrast" }]);
    const bad = (readings: unknown) => () => applyOperation(s, envelope({ type: "thread.reply", threadId: "thr_m", comment: { id: "cmt_x", body: "x", readings: readings as never } }));
    expect(bad([{ word: "<b>", reading: "contrast" }])).toThrow(OpValidationError);
    expect(bad("contrast")).toThrow(OpValidationError);
    expect(bad(Array.from({ length: 9 }, () => ({ word: "pop", reading: "scale" })))).toThrow(OpValidationError);
  });

  it("is one of the word's three", () => {
    expect(readingRefusal({ word: "pop", reading: "contrast" })).toBeNull();
    expect(readingRefusal({ word: "pop", reading: "loudness" })).toMatch(/reads as contrast, scale, colour/);
    expect(readingRefusal({ word: "nice", reading: "contrast" })).toMatch(/not one of the words/);
  });
});

const at = (n: number) => new Date(Date.UTC(2026, 9, 14, 9, n)).toISOString();
function comment(id: string, author: string, body: string, n: number, extra: Partial<Comment> = {}): Comment {
  return { id, author: { id: author, name: author }, body, createdAt: at(n), ...extra };
}
function canvasWith(comments: Comment[], whys: string[] = []): CanvasContents {
  const items = Object.fromEntries(whys.map((why, i) => [`itm_p${i}`, { id: `itm_p${i}`, properties: { proposalWhy: why } }]));
  return { threads: { thr_main: { id: "thr_main", comments } }, items } as unknown as CanvasContents;
}

describe("the vocabulary panel", () => {
  const canvas = canvasWith(
    [
      comment("c1", "usr_maya", "make the header pop more", 1),
      comment("c2", "agt_kit", "Raised its contrast; the visual hierarchy now leads with the total.", 2),
      comment("c3", "usr_maya", "good — keep that contrast, and tighten the type scale", 3),
      comment("c4", "usr_maya", "Kit said hello", 4, { record: true }),
    ],
    ["Proximity: the pickup time sits with the total."],
  );
  const taste = "# What your deletes taught\n- No gates before value.\n- “the thumb button” means the main action, within thumb reach\n";

  it("lists the words you now use, those seen and not used, and those the agent learned", () => {
    const v = vocabulary(canvas, "usr_maya", taste, glossaryTerms());
    expect(v.use).toEqual(["contrast", "type scale"]);
    expect(v.seen).toEqual(["proximity", "visual hierarchy"]);
    expect(v.learned).toEqual([{ said: "the thumb button", means: "the main action, within thumb reach" }]);
  });

  it("counts asks that needed no translation, for a person who opts in to see it", () => {
    expect(vocabulary(canvas, "usr_maya", null, glossaryTerms()).sharp).toEqual({ asks: 2, plain: 1 });
  });

  it("reads a learned word in any of the quotes a person types", () => {
    expect(learnedWords(`- "the shelf" is the horizontal list of today's bakes`)).toEqual([{ said: "the shelf", means: "the horizontal list of today's bakes" }]);
    expect(learnedWords("- No gates before value.")).toEqual([]);
    expect(learnedWords(null)).toEqual([]);
  });
});

describe("when I am vague", () => {
  const asks = (vague: number, plain: number) =>
    canvasWith([
      ...Array.from({ length: vague }, (_, i) => comment(`v${i}`, "usr_maya", "make it pop", i)),
      ...Array.from({ length: plain }, (_, i) => comment(`p${i}`, "usr_maya", "Move the total above the button", 20 + i)),
    ]);
  it("offers by default until the asks are sharp, then fades", () => {
    expect(offerVague("fading", asks(0, 3), "usr_maya")).toBe(true);
    expect(offerVague("fading", asks(3, 7), "usr_maya")).toBe(true);
    expect(offerVague("fading", asks(2, 8), "usr_maya")).toBe(false);
    // Only the last ten count: early vagueness is forgiven as the asks sharpen.
    expect(offerVague("fading", asks(6, 9), "usr_maya")).toBe(false);
    expect(offerVague("always", asks(0, 20), "usr_maya")).toBe(true);
    expect(offerVague("never", asks(5, 0), "usr_maya")).toBe(false);
  });
});
