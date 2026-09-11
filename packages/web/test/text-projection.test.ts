import { createElement } from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { parseFragment } from "parse5";
import MarkdownBody from "../src/lib/markdown-body.tsx";
import { markdownText } from "@isocan/core/markdown";
import { quoteRange } from "@isocan/core";

// Parse the actual renderer's output, not a hand-written HTML approximation.
function renderedText(source: string, breaks = false): string {
  const tree = parseFragment(renderToStaticMarkup(createElement(MarkdownBody, { breaks, children: source })));
  function fold(node: any): string { return node.nodeName === "#text" ? node.value : (node.childNodes ?? []).map(fold).join(""); }
  return fold(tree);
}

describe("one text space for the CLI and rendered Markdown", () => {
  const corpus = [
    "# Heading\n\nRead **this *nested* sentence** and [a link](https://example.com).",
    "A &amp; B; &#x1F40F; and escaped \\*marks\\*.",
    "# Repeated\n\n# Repeated\n\nRepeated words. Repeated words.",
    "Emoji 🐏 and e\u0301; العربية עברית.",
    "First line\nsecond line  \nhard break\n\nNext paragraph.",
    "- [x] Done\n- [ ] Not done\n  - nested\n\n> quoted **words**",
    "| A | B |\n| - | - |\n| one | two |",
    "```js\nconst x = 1;\n  // preserve spaces\n```\n\n`inline  code`",
    "<span>literal HTML</span>\n\n![image](https://example.com/image.png)",
  ];
  for (const source of corpus) for (const breaks of [false, true]) {
    it(`matches the rendered text (${breaks ? "text node" : "document"}): ${source.slice(0, 30)}`, () => {
      expect(markdownText(source, breaks ? "text-node" : "document")).toBe(renderedText(source, breaks));
    });
  }
  it("keeps plain text byte-for-byte and counts emoji as a code point", () => {
    expect(markdownText("**🐏**\n", "plain")).toBe("**🐏**\n");
    expect(quoteRange("🐏 then words", "words")).toEqual({ start: 7, end: 12 });
  });
  it("refuses an ambiguous or missing quote and permits an explicit occurrence", () => {
    expect(() => quoteRange("same same", "same")).toThrow("2 passages");
    expect(quoteRange("same same", "same", 2)).toEqual({ start: 5, end: 9 });
    expect(() => quoteRange("same", "missing")).toThrow("not found");
    expect(() => quoteRange("same", "same", 0)).toThrow("outside");
  });
});
