// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import type { PluggableList, Processor } from "unified";
import MarkdownBody from "../src/lib/markdown-body.tsx";
import { cachedParse } from "../src/lib/markdown-parse.ts";

/** More texts than the cache holds (600, in markdown-parse.ts). */
const PAST_FULL = 650;

/**
 * **A note is parsed once, not once per mount** (27 Sep 2026) — and a kept
 * tree is never the tree a render changes.
 *
 * The zoom census's worst frames were notes remounting together as the
 * camera came back in, each parsed again from scratch. The cache sits where
 * remark-parse's parser was; these hold it to three things: it says what the
 * uncached renderer says, it parses a text once however often it mounts, and
 * a transform after the parse (remark-breaks edits the tree in place) never
 * reaches the next render of the same text.
 */

const SAMPLES = [
  "# Acme plan\n\nSome **bold** and _soft_ words, and `code`.",
  "| a | b |\n| --- | --- |\n| 1 | 2 |\n\n- [x] done\n- [ ] not yet\n\n~~gone~~",
  "Visit https://example.com/acme or www.example.org and mail acme@example.com.",
  "Line one\nline two\n\nA [link](#section) and ![a picture](acme.png).\n\n## Section\n\n## Section",
  "<b>raw html</b> stays text\n\n> quoted\n\n```ts\nconst acme = 1;\n```",
  "",
];

/** What react-markdown draws with the renderer's own plugins, cached or not. */
const draw = (text: string, breaks: boolean, cached: boolean, before: PluggableList = []) =>
  renderToStaticMarkup(createElement(ReactMarkdown, { remarkPlugins: [remarkGfm, ...(breaks ? [remarkBreaks] : []), ...before, ...(cached ? [cachedParse] : [])] }, text));

/** Counts the parses that reach the parser beneath the cache. */
function counting() {
  const seen = { parses: 0 };
  const plugin = function (this: Processor) {
    const parse = this.parser!;
    this.parser = (doc, file) => { seen.parses++; return parse(doc, file); };
  };
  return { seen, plugin };
}

describe("the markdown parse cache", () => {
  it("draws what the uncached renderer draws — first time and from the cache", () => {
    for (const text of SAMPLES) for (const breaks of [false, true]) {
      const plain = draw(text, breaks, false);
      expect(draw(text, breaks, true), text).toBe(plain);
      expect(draw(text, breaks, true), `${text} (cached)`).toBe(plain);
    }
  });

  it("parses a text once, however many times it mounts", () => {
    const { seen, plugin } = counting();
    const text = "# Acme once\n\nParsed a single time, drawn five.";
    for (let i = 0; i < 5; i++) draw(text, false, true, [plugin]);
    expect(seen.parses).toBe(1);
    // A different text is its own parse.
    draw(`${text}!`, false, true, [plugin]);
    expect(seen.parses).toBe(2);
  });

  it("hands every render its own tree: remark-breaks changing one never reaches the next", () => {
    const text = "Acme first line\nAcme second line";
    // The same text, cached, drawn with breaks — which rewrites the newline into a <br> in place…
    expect(draw(text, true, true)).toContain("<br/>");
    // …and then without: a shared tree would still carry the break.
    expect(draw(text, false, true)).not.toContain("<br/>");
    expect(draw(text, false, true)).toBe(draw(text, false, false));
  });

  it("forgets the least recently used text once full, and keeps what is still in use", () => {
    const { seen, plugin } = counting();
    const kept = "Acme kept in use";
    draw(kept, false, true, [plugin]);
    for (let i = 0; i < PAST_FULL; i++) {
      draw(`Acme filler ${i}`, false, true, [plugin]);
      if (i % 100 === 0) draw(kept, false, true, [plugin]);
    }
    const before = seen.parses;
    draw(kept, false, true, [plugin]);
    expect(seen.parses).toBe(before);
    draw("Acme filler 0", false, true, [plugin]);
    expect(seen.parses).toBe(before + 1);
  });

  it("is what the note renderer uses", () => {
    const out = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(MarkdownBody, { breaks: true, children: "Acme a\nAcme b" })));
    expect(out).toContain("<br/>");
    expect(renderToStaticMarkup(createElement(MemoryRouter, null, createElement(MarkdownBody, { children: "Acme a\nAcme b" })))).not.toContain("<br/>");
  });
});
