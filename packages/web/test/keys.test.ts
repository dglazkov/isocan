import { describe, expect, it } from "vitest";
import { isTyping } from "../src/lib/keys.ts";

/**
 * The canvas has single-letter shortcuts, so this one predicate is what stands
 * between typing a word and reaching for a tool.
 */
describe("is this keystroke going into text", () => {
  it("says yes for the fields people type in", () => {
    for (const tagName of ["INPUT", "TEXTAREA", "SELECT", "input", "textarea"]) {
      expect(isTyping({ tagName }), tagName).toBe(true);
    }
  });

  it("says yes for a contenteditable", () => {
    expect(isTyping({ tagName: "DIV", isContentEditable: true })).toBe(true);
  });

  it("says yes inside a contenteditable, where the target is a plain child", () => {
    // A caret in a rich-text editor sits in a <span> that is not itself
    // editable. Checking only the target is how a shortcut fires mid-sentence.
    expect(
      isTyping({ tagName: "SPAN", isContentEditable: false, closest: () => ({}) }),
    ).toBe(true);
  });

  it("says no for the canvas and its furniture", () => {
    expect(isTyping({ tagName: "DIV", closest: () => null })).toBe(false);
    expect(isTyping({ tagName: "BUTTON", closest: () => null })).toBe(false);
    expect(isTyping(null)).toBe(false);
    expect(isTyping(undefined)).toBe(false);
  });
});
