import { describe, expect, it } from "vitest";
import { copyDeck } from "../src/copy-deck.ts";
import { copyBudget, copyFit, copyFitByCount } from "../src/copy-fit.ts";
import { CHECKED_TELLS, UNCHECKED_TELLS, lintCopy } from "../src/copy-lint.ts";
import { parseVoiceSection } from "../src/copy-voice.ts";
import { SLOP_RULES } from "../src/slop.ts";

/**
 * **Fit and the copy lint** (copy-edit phase 4, journey scenes 3 and 4).
 * The fit RULE is pure — the renderer measures, this decides and says why;
 * the lint reads a flow's decks against the voice, one name per thing, and
 * `slop.ts`'s copy tells. Synthetic: Acme's sign-in flow.
 */

/** The lint as the CLI runs it: with slop.ts's rules handed in. */
const lint = (screens: Parameters<typeof lintCopy>[0], voice: Parameters<typeof lintCopy>[1] = null) => lintCopy(screens, voice, SLOP_RULES);
const screen = (itemId: string, title: string, body: string) => ({ itemId, title, deck: copyDeck(`<!doctype html><html><head><title>${title}</title></head><body>${body}</body></html>`) });

describe("copyFit — does a measured string fit its role", () => {
  it("marks a one-line role that wrapped, in the journey's words", () => {
    expect(copyFit("button", { lines: 2, overflow: false })).toEqual({ fits: false, why: "two lines in a one-line button" });
    expect(copyFit("heading", { lines: 3, overflow: false })).toEqual({ fits: false, why: "three lines in a two-line heading" });
    expect(copyFit("heading", { lines: 2, overflow: false })).toEqual({ fits: true });
  });

  it("marks an overflowing box whatever the lines, and leaves body copy unbounded", () => {
    expect(copyFit("label", { lines: 1, overflow: true })).toMatchObject({ fits: false, why: expect.stringContaining("overflows its box") });
    expect(copyFit("button", { lines: 2, overflow: true })).toEqual({ fits: false, why: "two lines in a one-line button, and it overflows its box" });
    expect(copyFit("body", { lines: 40, overflow: false })).toEqual({ fits: true });
    expect(copyBudget("something-new")).toEqual(copyBudget("body"));
  });

  it("by count, says it is a count", () => {
    expect(copyFitByCount("button", "Pay")).toEqual({ fits: true });
    expect(copyFitByCount("button", "Let's get you all set up and ready to pay today")).toMatchObject({ fits: false, why: expect.stringContaining("by character count") });
  });
});

describe("lintCopy — a flow's words", () => {
  const voice = parseVoiceSection("Plain.\n\nAvoid: seamless\n\nGlossary:\n- sign in — never log in");

  it("flags a banned glossary form and an avoided word, naming the screen and the string", () => {
    const flow = [screen("itm_a", "Acme welcome", "<h1>A seamless start</h1><button>Log in</button>")];
    const found = lint(flow, voice).filter((f) => f.kind === "glossary" || f.kind === "avoid");
    expect(found).toEqual([
      expect.objectContaining({ kind: "avoid", itemId: "itm_a", address: "t1", role: "heading", what: 'heading says "seamless" — the voice avoids it' }),
      expect.objectContaining({ kind: "glossary", itemId: "itm_a", role: "button", what: 'button says "Log in" — the voice says "sign in", never "log in"', fix: 'say "sign in"' }),
    ]);
  });

  it("flags one thing called two names across a flow when no glossary settles it — and not twice when one does", () => {
    const flow = [screen("itm_a", "Acme welcome", "<button>Sign in</button>"), screen("itm_b", "Acme help", "<a href='#'>Log in</a>")];
    const [one] = lint(flow).filter((f) => f.kind === "one-name");
    expect(one).toMatchObject({ kind: "one-name", itemId: "itm_a" });
    expect(one!.what).toBe('one thing, 2 names: "Sign in" on "Acme welcome" (t1), "Log in" on "Acme help" (t1)');
    expect(one!.fix).toContain("a glossary line in DESIGN.md's Voice");
    // With the voice, the glossary owns it: one glossary slip, no one-name finding.
    const governed = lint(flow, voice);
    expect(governed.filter((f) => f.kind === "one-name")).toEqual([]);
    expect(governed.filter((f) => f.kind === "glossary").map((f) => f.itemId)).toEqual(["itm_b"]);
    // One name, used everywhere: nothing.
    expect(lint([screen("itm_a", "A", "<button>Sign in</button>"), screen("itm_b", "B", "<p>Sign in to see orders</p>")]).filter((f) => f.kind === "one-name")).toEqual([]);
  });

  it("flags slop.ts's copy tells, quoting the rule", () => {
    const flow = [
      screen("itm_a", "Acme home", "<h1>Not just a parcel app — it's a way of life</h1><p>In today's fast-paced world, parcels matter.</p><button>Get Started</button><p role='alert'>Oops! Something went wrong.</p><p>Here you can manage your parcels.</p><p>Lorem ipsum dolor sit amet.</p>"),
      screen("itm_b", "Acme menu", "<h2>Your Recent Orders</h2><button>Track Every Parcel</button><label>Delivery Address Book</label>"),
    ];
    const tells = lint(flow).filter((f) => f.kind === "tell");
    const names = tells.map((f) => f.what.split(":")[0]);
    expect(names).toEqual(expect.arrayContaining(["Generic call to action", "Not just X — it's Y", "The opener that says nothing", "Apology as an error message", "Copy that narrates the interface", "Lorem or invented content", "Title Case On Everything"]));
    const cta = tells.find((f) => f.what.startsWith("Generic call to action"))!;
    expect(cta).toMatchObject({ itemId: "itm_a", role: "button", text: "Get Started" });
    expect(cta.fix).toBe(SLOP_RULES.find((r) => r.name === "Generic call to action")!.instead);
    // An apology WITH a cause and a next step is information, not a tell.
    expect(lint([screen("itm_c", "C", "<p role='alert'>Sorry, something broke: that file is over 24 MB, so try a smaller one.</p>")]).filter((f) => f.kind === "tell")).toEqual([]);
    // Sentence case on the same controls is not Title Case On Everything.
    expect(lint([screen("itm_d", "D", "<h2>Your recent orders</h2><button>Track every parcel</button><label>Delivery address book</label>")]).filter((f) => f.kind === "tell")).toEqual([]);
  });

  it("checks every copy rule in slop.ts or says why it cannot", () => {
    const copyRules = SLOP_RULES.filter((r) => r.kind === "copy").map((r) => r.name).sort();
    expect([...CHECKED_TELLS, ...Object.keys(UNCHECKED_TELLS)].sort()).toEqual(copyRules);
  });

  it("flags a string over its role's character budget, as a count", () => {
    const [long] = lint([screen("itm_a", "A", "<button>Let's get you all set up and ready to go today</button>")]).filter((f) => f.kind === "length");
    expect(long).toMatchObject({ kind: "length", role: "button", what: expect.stringContaining("by character count") });
  });

  it("reports the Voice section's own problems, once, after the screens", () => {
    const found = lint([], parseVoiceSection("Glossary:\n- sign in"));
    expect(found).toEqual([expect.objectContaining({ kind: "voice", what: expect.stringContaining("names no banned form") })]);
  });
});
