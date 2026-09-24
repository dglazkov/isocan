import { describe, expect, it } from "vitest";
import type { Item } from "../src/model.ts";
import { TEXT_STYLE_LABEL, textStyleFrom } from "../src/textnode.ts";
import {
  TEXT_COLUMN,
  TEXT_COLUMN_MAX,
  TEXT_FACES,
  TEXT_FACE_STACK,
  TEXT_KIND,
  TEXT_MARK_MAX,
  TEXT_MIME,
  TEXT_SIZE,
  TEXT_STYLES,
  TEXT_STYLE_SIZE,
  TEXT_WIDTH,
  TEXT_HEADING_EM,
  TEXT_HEADING_LINE,
  isTextItem,
  textBox,
  type TextStyle,
  textFaceOf,
  textIsLegible,
  textMarkSize,
  textNodeFit,
  textNodeRefit,
  textRefit,
  textSizeOf,
  textStyleOf,
  textTitle,
} from "../src/textnode.ts";

const actor = { id: "usr_a", name: "A" };
const item = (properties: Record<string, string>): Item => ({
  id: "itm_1",
  x: 0,
  y: 0,
  width: 100,
  height: 80,
  title: "t",
  description: "",
  properties,
  versions: [],
  currentVersionId: "",
  createdAt: "",
  createdBy: actor,
  updatedAt: "",
  updatedBy: actor,
});

describe("what makes a text node a text node", () => {
  it("is the property, not the mime", () => {
    // Markdown somebody uploaded is a note; markdown the Text tool made is a
    // node. Stripping the property leaves an ordinary, still-valid item
    // rather than something broken — which is the point of marking it this
    // way rather than inventing a type.
    expect(isTextItem(item({ kind: TEXT_KIND }))).toBe(true);
    expect(isTextItem(item({}))).toBe(false);
    expect(isTextItem(item({ kind: "drawing" }))).toBe(false);
    expect(TEXT_MIME).toBe("text/markdown");
  });
});

describe("the name a text node goes by", () => {
  it("is its first line, because that is what tells two notes apart", () => {
    expect(textTitle("Ship on Friday")).toBe("Ship on Friday");
    expect(textTitle("Ship on Friday\nand tell the team")).toBe("Ship on Friday");
  });

  it("keeps the words and drops markdown's furniture", () => {
    expect(textTitle("## Ship on Friday")).toBe("Ship on Friday");
    expect(textTitle("- Ship on Friday")).toBe("Ship on Friday");
    expect(textTitle("> Ship on Friday")).toBe("Ship on Friday");
    expect(textTitle("**Ship** on `Friday`")).toBe("Ship on Friday");
  });

  it("skips leading blank lines rather than titling a node 'Text'", () => {
    expect(textTitle("\n\n  Ship on Friday")).toBe("Ship on Friday");
  });

  it("caps a long line, and says it capped it", () => {
    const long = "a".repeat(80);
    const title = textTitle(long);
    expect(title).toHaveLength(48);
    expect(title.endsWith("…")).toBe(true);
  });

  it("falls back only when there are no words at all", () => {
    expect(textTitle("")).toBe("Text");
    expect(textTitle("   \n  ")).toBe("Text");
    expect(textTitle("###")).toBe("Text");
    expect(textTitle("---")).toBe("Text");
  });

  it("skips a line of furniture to reach the words under it", () => {
    // A node opening with a rule or a bare `###` is opening with furniture,
    // and titling it after the furniture names nothing.
    expect(textTitle("###\nShip on Friday")).toBe("Ship on Friday");
    expect(textTitle("---\n\nShip on Friday")).toBe("Ship on Friday");
  });

  it("leaves an item reference alone — `#Roadmap` names a thing here", () => {
    // Stripping the mark would rename the item the line points at.
    expect(textTitle("#Roadmap needs work")).toBe("#Roadmap needs work");
  });
});

describe("the box it starts in", () => {
  it("is the width the words need — prose fills the column, a word does not", () => {
    // What the app's composer commits, guessed: a three-word title gets a
    // three-word box, a paragraph settles at the step's column.
    expect(textBox("hello").width).toBeLessThan(TEXT_WIDTH);
    expect(textBox("word ".repeat(60)).width).toBe(TEXT_WIDTH);
  });

  it("grows with the text, and never collapses", () => {
    const one = textBox("one line");
    const many = textBox("one line\ntwo\nthree\nfour\nfive");
    expect(many.height).toBeGreaterThan(one.height);
    expect(one.height).toBeGreaterThan(0);
    // An empty node is still a box somebody can see and click.
    expect(textBox("").height).toBeGreaterThan(0);
  });

  it("counts a wrapped line as the rows it will wrap into", () => {
    const short = textBox("short");
    const wrapped = textBox("word ".repeat(60));
    expect(wrapped.height).toBeGreaterThan(short.height * 2);
  });

  /**
   * **Never a line short.** The estimate is the box for every node an agent
   * writes from the terminal, where nothing measures — and a chromeless box
   * with room to spare is invisible while a box a line short crops the
   * words. These pin the ways the first estimate came up short.
   */
  it("wraps by word, not by character — a long word is never split across the count", () => {
    // Eleven characters that cannot break: the box widens to hold them.
    const title = textBox("Onboarding", "display");
    expect(title.width).toBeGreaterThan(128 * 0.55 * 10);
    // Two long words that will not share a line at the column are two rows.
    const two = textBox("Internationalization Internationalization", "title");
    expect(two.height).toBeGreaterThan(textBox("Internationalization", "title").height * 1.8);
  });

  it("knows a capital is wider than an i, and mono is one width", () => {
    expect(textBox("MMMMMMMMMM").width).toBeGreaterThan(textBox("iiiiiiiiii").width * 2);
    expect(textBox("iiiiiiiiii", "body", "mono").width).toBeGreaterThan(textBox("iiiiiiiiii", "body", "sans").width);
  });

  it("draws the hand face larger, the way the app does, so its box is taller too", () => {
    expect(textBox("a note", "body", "hand").height).toBeGreaterThan(textBox("a note", "body", "sans").height);
  });

  it("pays a paragraph's margin, and reads markdown's furniture as no width", () => {
    const flowing = textBox("one\ntwo");
    const paragraphs = textBox("one\n\ntwo");
    expect(paragraphs.height).toBeGreaterThan(flowing.height);
    // The marker takes no width; the heading itself is drawn at 1.5em, so
    // it is half again as wide as the word — and no wider.
    expect(textBox("# Title").width).toBeGreaterThan(textBox("Title").width * 1.3);
    expect(textBox("# Title").width).toBeLessThan(textBox("Title").width * 1.6);
    // A list is indented by the browser's own 40px and keeps its margins,
    // so it is wider and a little taller than the same lines bare.
    expect(textBox("- a\n- b").width).toBeGreaterThan(textBox("a\nb").width + 30);
    expect(textBox("- a\n- b").height).toBeGreaterThan(textBox("a\nb").height);
  });

  it("caps a word longer than the hard limit at the limit — the stylesheet breaks it there", () => {
    const w = textBox("x".repeat(400), "display").width;
    expect(w).toBeLessThanOrEqual(TEXT_COLUMN_MAX.display);
  });
});

/**
 * **A heading is bigger than its words at every step** (24 Sep 2026).
 *
 * The stylesheet drew a text node's `#` at the card renderer's fixed 18px —
 * larger than body's 16, a seventh of display's 128. Now it is 1.5em, and
 * the estimate has to know it or the box crops the heading (lessons #94).
 * These numbers are the stylesheet's model of a heading, written out here so
 * the test does not ask the estimate what the estimate should be:
 * `.item.textnode .md-view h1 { font-size: 1.5em }`, `line-height: 1.25`,
 * `margin: 0.4em 0 0.3em`, and the node's 4px padding top and bottom.
 */
describe("a heading in a text node, at its em size", () => {
  const H1 = 1.5;
  const drawn = (style: TextStyle, lines = 1) => {
    const h = TEXT_STYLE_SIZE[style] * H1;
    return lines * h * 1.25 + h * 0.7 + 8;
  };

  it("gets a box tall enough for the heading at the smallest and largest steps", () => {
    for (const style of ["body", "display"] as const) {
      expect(textBox("# Acme", style).height, style).toBeGreaterThanOrEqual(drawn(style));
    }
  });

  it("gets a box as wide as the heading draws, not as wide as the words at body size", () => {
    for (const style of ["body", "display"] as const) {
      // Minus the padding, the heading's words need 1.5 times the bare words'
      // (less a unit, for the two boxes each being rounded).
      const bare = textBox("Acme", style).width - 12;
      expect(textBox("# Acme", style).width - 12, style).toBeGreaterThanOrEqual(bare * H1 - 1);
    }
  });

  it("counts the heading AND the paragraph under it at the largest step", () => {
    const size = TEXT_STYLE_SIZE.display;
    expect(textBox("# Acme\n\nGo", "display").height).toBeGreaterThanOrEqual(drawn("display") + size * 1.5);
  });

  it("gives every level h1's room — erring large, never small", () => {
    // The stylesheet draws h2 and h3 smaller than h1; the estimate does not
    // tell them apart, because a box too roomy is invisible on a caption and
    // one too tight crops it.
    for (const marks of ["#", "##", "###", "######"]) {
      expect(textBox(`${marks} Acme`, "title"), marks).toEqual(textBox("# Acme", "title"));
    }
    expect(TEXT_HEADING_EM).toBe(H1);
  });

  it("knows a heading line, in one line or a whole body", () => {
    expect(TEXT_HEADING_LINE.test("Acme\n## Plan")).toBe(true);
    expect(TEXT_HEADING_LINE.test("#Roadmap is a reference, not a heading")).toBe(false);
    expect(TEXT_HEADING_LINE.test("plain words")).toBe(false);
  });
});

/**
 * **The box after the node changed** (23 Sep 2026). A note measured at body
 * and then restyled to heading drew 32px type in a 16px box — the second line
 * cut in half — because nothing asked what the box should be once the look
 * changed. `textNodeRefit` is that question, and both surfaces ask it.
 */
describe("the box after its words or its look change", () => {
  const sentence = "Acme step 2 · the review side — and status notes too: step 1 waits on step 2";
  const paragraphs = `## ${sentence}\n\n${sentence}\n\n- one\n- ${sentence}`;
  const caption = (properties: Record<string, string>, box: { width: number; height: number }): Item => ({
    ...item({ kind: TEXT_KIND, ...properties }),
    ...box,
  });

  it("grows a body-sized box to hold the words at every larger step and face", () => {
    for (const body of [sentence, paragraphs]) {
      const born = caption({}, textBox(body));
      for (const style of TEXT_STYLES.slice(1)) {
        for (const face of TEXT_FACES) {
          const next = textNodeRefit(born, body, { properties: { textStyle: style, textFace: face } });
          const need = textBox(body, style, face);
          expect(next, `${style}/${face}`).not.toBeNull();
          expect(next!.width).toBeGreaterThanOrEqual(need.width);
          expect(next!.height).toBeGreaterThanOrEqual(need.height);
        }
      }
    }
  });

  it("grows a label's box when new words wrap onto more lines", () => {
    const label = caption({ textStyle: "heading" }, textBox("Acme", "heading"));
    const next = textNodeRefit(label, paragraphs)!;
    expect(next.height).toBeGreaterThanOrEqual(textBox(paragraphs, "heading").height);
    expect(next.height).toBeGreaterThan(label.height * 4);
  });

  it("only grows: a box dragged wider keeps its width, and a step down changes nothing", () => {
    const wide = caption({ textStyle: "title" }, { width: 1200, height: 40 });
    expect(textNodeRefit(wide, sentence)!.width).toBe(1200);
    const big = caption({ textStyle: "title" }, textBox(sentence, "title"));
    expect(textNodeRefit(big, sentence, { removeProperties: ["textStyle"] })).toBeNull();
    expect(textRefit(textBox(sentence, "title"), sentence, "title", "sans")).toBeNull();
  });

  it("leaves paper and anything that is not a caption alone", () => {
    const small = { width: 40, height: 20 };
    expect(textNodeRefit(caption({ paper: "yellow" }, small), sentence, { properties: { textStyle: "display" } })).toBeNull();
    expect(textNodeRefit(caption({}, small), sentence, { properties: { paper: "pink" } })).toBeNull();
    expect(textNodeRefit({ ...item({}), ...small }, sentence)).toBeNull();
    // Taking paper OFF makes it a caption again, which must hold its words.
    expect(textNodeRefit(caption({ paper: "yellow" }, small), sentence, { removeProperties: ["paper"] })).not.toBeNull();
  });

  it("fits a caption from scratch — which may shrink — and not paper", () => {
    const stretched = caption({ textStyle: "heading" }, { width: 2000, height: 2000 });
    expect(textNodeFit(stretched, sentence)).toEqual(textBox(sentence, "heading"));
    expect(textNodeFit(caption({ paper: "blue" }, { width: 9, height: 9 }), sentence)).toBeNull();
  });
});

describe("the size ladder", () => {
  it("doubles at every step, which is what makes it a zoom rule", () => {
    // The ladder's whole claim is that a step survives twice as far out as
    // the one below. That is only true while the sizes double, so it is the
    // relationship that is pinned, not four magic numbers.
    const sizes = TEXT_STYLES.map((s) => TEXT_STYLE_SIZE[s]);
    expect(sizes[0]).toBe(TEXT_SIZE);
    for (let i = 1; i < sizes.length; i++) expect(sizes[i]).toBe(sizes[i - 1]! * 2);
  });

  it("reads as body when nothing says otherwise, forever", () => {
    // Every text node made before the ladder existed has no property at all,
    // and must keep rendering exactly as it always did.
    expect(textStyleOf(item({}))).toBe("body");
    expect(textSizeOf(item({}))).toBe(TEXT_SIZE);
    // And an unknown step — a newer client's, or a typo from the CLI — falls
    // back rather than rendering at NaN pixels.
    expect(textStyleOf(item({ textStyle: "gigantic" }))).toBe("body");
    expect(textStyleOf(item({ textStyle: "title" }))).toBe("title");
  });

  it("gives each step the zoom it claims to survive", () => {
    // The tooltip promises "readable down to N%". This is that promise as a
    // test: 8px is where a word becomes readable at all.
    const floor = (style: (typeof TEXT_STYLES)[number], zoom: number) =>
      TEXT_STYLE_SIZE[style] * zoom;
    expect(floor("body", 0.5)).toBeGreaterThanOrEqual(8);
    expect(floor("heading", 0.25)).toBeGreaterThanOrEqual(8);
    expect(floor("title", 0.125)).toBeGreaterThanOrEqual(8);
    expect(floor("display", 0.0625)).toBeGreaterThanOrEqual(8);
  });

  it("widens the column gently, because big text is labels and small text is prose", () => {
    // The first cut scaled the column WITH the size, which gave a title four
    // times the width and a display eight — a 2560-wide box holding three
    // words, which is what this asserts against. Each step is wider than the
    // one below, and every one of them is far narrower than proportional.
    const widths = TEXT_STYLES.map((s) => TEXT_COLUMN[s]);
    for (let i = 1; i < widths.length; i++) {
      expect(widths[i]).toBeGreaterThan(widths[i - 1]!);
      expect(widths[i], "the column must not scale with the type").toBeLessThan(widths[i - 1]! * 2);
    }
    const body = textBox("a sentence that runs on for a little while", "body");
    const title = textBox("a sentence that runs on for a little while", "title");
    expect(title.height).toBeGreaterThan(body.height);
  });
});

describe("the faces", () => {
  it("holds only stacks that exist on every machine", () => {
    // The rule this guards is the one the repo already made once and wrote
    // down in styles.css: no webfont, because a canvas on 127.0.0.1 must not
    // need somebody else's server to look right — and because a face that
    // resolves locally renders one person's canvas differently from another's.
    for (const face of TEXT_FACES) {
      const stack = TEXT_FACE_STACK[face];
      // Every stack ends in a generic family, so there is always something to
      // draw with — including offline, and including `hand`, whose named face
      // is fetched (see `index.html`) and may simply not arrive.
      expect(stack, `${face} must name a generic family to fall back on`).toMatch(
        /(sans-serif|monospace|serif|cursive)\s*$/,
      );
      // A stack never carries a URL. `hand`'s file is linked from the document
      // — one place, reviewable, with its costs written beside it — rather
      // than smuggled into a font stack where nobody would look for it.
      expect(stack, `${face} must not fetch a font itself`).not.toMatch(/url\(|http/);
    }
  });

  it("reads as sans when nothing says otherwise", () => {
    expect(textFaceOf(item({}))).toBe("sans");
    expect(textFaceOf(item({ textFace: "comic" }))).toBe("sans");
    expect(textFaceOf(item({ textFace: "mono" }))).toBe("mono");
  });
});

describe("when words stop being words", () => {
  it("draws the mark below five screen pixels, and the words above it", () => {
    // A body node at 10% zoom renders at 1.6px — forty shapes of grey smear
    // competing with the screens it annotates.
    expect(textIsLegible(TEXT_SIZE, 0.1)).toBe(false);
    expect(textIsLegible(TEXT_SIZE, 0.3125)).toBe(true); // exactly 5px
    expect(textIsLegible(TEXT_SIZE, 0.31)).toBe(false);
  });

  it("keeps a big label readable at the zoom where a note has become a mark", () => {
    // This is the ladder and the cut working as one thing: at the whole-board
    // view the titles survive and the notes step aside, which is the entire
    // point of having both.
    const board = 0.1;
    expect(textIsLegible(TEXT_STYLE_SIZE.body, board)).toBe(false);
    expect(textIsLegible(TEXT_STYLE_SIZE.title, board)).toBe(true);
    expect(textIsLegible(TEXT_STYLE_SIZE.display, board)).toBe(true);
  });

  it("never draws a mark bigger than the node it stands for", () => {
    // A mark larger than its own node would lie about the canvas's shape,
    // and forty oversized glyphs are the smear again in a different hat.
    const size = textMarkSize(320, 80, 0.05); // 16x4 on screen
    expect(size).toBeLessThanOrEqual(4);
    expect(size).toBeGreaterThan(0);
    // …and never so big it reads as a letter somebody typed.
    expect(textMarkSize(4000, 4000, 1)).toBe(TEXT_MARK_MAX);
  });
});

/**
 * The bar says S / M / L / XL and the property says body / heading / title /
 * display. One map, and a resolver that takes either spelling, so what a
 * person reads on the screen is a word the terminal accepts.
 */
describe("a step from its name or its size label", () => {
  it("labels every step, and no two the same", () => {
    const labels = TEXT_STYLES.map((s) => TEXT_STYLE_LABEL[s]);
    expect(new Set(labels).size).toBe(TEXT_STYLES.length);
    expect(labels).toEqual(["S", "M", "L", "XL"]);
  });

  it("resolves a name, a label, and either case", () => {
    expect(textStyleFrom("heading")).toBe("heading");
    expect(textStyleFrom("M")).toBe("heading");
    expect(textStyleFrom("xl")).toBe("display");
    expect(textStyleFrom(" Body ")).toBe("body");
  });

  it("refuses rather than guesses", () => {
    expect(textStyleFrom("XXL")).toBeNull();
    expect(textStyleFrom("")).toBeNull();
  });
});
