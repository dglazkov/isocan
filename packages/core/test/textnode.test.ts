import { describe, expect, it } from "vitest";
import type { Item } from "../src/model.ts";
import {
  TEXT_KIND,
  TEXT_MIME,
  TEXT_WIDTH,
  isTextItem,
  textBox,
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
