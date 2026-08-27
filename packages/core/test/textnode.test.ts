import { describe, expect, it } from "vitest";
import type { Item } from "../src/model.ts";
import {
  TEXT_COLUMN,
  TEXT_FACES,
  TEXT_FACE_STACK,
  TEXT_KIND,
  TEXT_MARK_MAX,
  TEXT_MIME,
  TEXT_SIZE,
  TEXT_STYLES,
  TEXT_STYLE_SIZE,
  TEXT_WIDTH,
  isTextItem,
  textBox,
  textFaceOf,
  textIsLegible,
  textMarkSize,
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
  it("is one width, so the CLI and the app agree before anything measures", () => {
    expect(textBox("hello").width).toBe(TEXT_WIDTH);
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
