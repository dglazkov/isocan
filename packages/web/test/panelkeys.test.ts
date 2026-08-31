import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { hasTextSelection } from "../src/lib/keys.ts";

const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

/**
 * **The canvas has single-letter shortcuts, and panels have words in them.**
 *
 * Two reports on the same day, both the same shape: a keystroke meant for a
 * panel was taken by the canvas underneath it.
 *
 *  - Selecting the text of a COMMENT and pressing ⌘C copied the selected
 *    ITEM. The guard asked `isTyping`, which means "is the caret in a field"
 *    — and a rendered comment is a `<p>`, so the answer was no and the
 *    canvas shortcut fired over the most familiar gesture in the browser.
 *  - Enter in a thread reply put the selected node full screen instead of
 *    doing anything to the reply.
 *
 * `isTyping` alone cannot answer either. The questions that can are "does
 * the browser already have something to copy" and "is the caret in a panel
 * even if this event's target is not".
 */
describe("a text selection belongs to the browser", () => {
  it("is a selection only when it actually holds words", () => {
    expect(hasTextSelection(null)).toBe(false);
    expect(hasTextSelection({ isCollapsed: true, toString: () => "" })).toBe(false);
    // A collapsed caret reports an empty string, but so does a selection of
    // pure whitespace, and neither is somebody meaning to copy something.
    expect(hasTextSelection({ isCollapsed: false, toString: () => "   " })).toBe(false);
    expect(hasTextSelection({ isCollapsed: false, toString: () => "wheels turning" })).toBe(true);
  });

  it("is what ⌘C asks before it copies an item", () => {
    const src = read("../src/pages/CanvasPage.tsx");
    const branch = src.slice(src.indexOf('e.key.toLowerCase() === "c"'));
    const condition = branch.slice(0, branch.indexOf("{"));
    expect(condition).toContain("!hasTextSelection()");
    expect(condition).toContain("!isTyping(e.target)");
  });
});

describe("a shortcut does not fire over somebody typing", () => {
  it("asks the focused element as well as the event's target", () => {
    // A field that re-renders under your hands can hand the keystroke to an
    // ancestor while the caret is still in the panel.
    const src = read("../src/pages/CanvasPage.tsx");
    expect(src).toContain("isTyping(e.target) || isTyping(document.activeElement)");
  });
});

describe("every composer takes the same two keys", () => {
  /**
   * The thread reply was a bare `<input>` while the Chat grows. An `<input>`
   * cannot hold a newline, so a reply could never be more than one line and
   * Enter had nowhere to go — reported as "I hit ENTER expecting to get a
   * newline". Both buttons already advertised ⌘⏎; only one field could
   * honour it.
   */
  it("grows, so a second line is possible at all", () => {
    const layer = read("../src/components/CommentLayer.tsx");
    const reply = layer.slice(layer.indexOf('placeholder="Reply…"'));
    expect(reply.slice(0, reply.indexOf("/>"))).toContain("grow");
  });

  it("sends on Enter and on ⌘Enter, the same as the Chat", () => {
    const layer = read("../src/components/CommentLayer.tsx");
    const chat = read("../src/components/MainThreadPanel.tsx");
    for (const [name, src] of [["reply", layer], ["chat", chat]] as const) {
      expect(src, `${name} lost submitOnEnter`).toContain("submitOnEnter(e);");
      expect(src, `${name} lost submitOnCmdEnter`).toContain("submitOnCmdEnter(e);");
    }
  });
});
