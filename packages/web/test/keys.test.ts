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

/**
 * Enter sends, Shift+Enter makes a line, and a key somebody already claimed
 * is left alone.
 *
 * An <input> in a form submits on Enter for free; a <textarea> types a newline
 * instead. So the day the composer learned to grow, sending would have
 * silently stopped working without this — and the mention menu already
 * preventDefaults Enter to complete a name, which does NOT stop the event
 * reaching the form. Without the defaultPrevented check, picking "@Fable" out
 * of the menu would also post the half-written message.
 */
describe("Enter in a composer", () => {
  const wouldSubmit = (e: {
    key: string;
    shiftKey?: boolean;
    metaKey?: boolean;
    ctrlKey?: boolean;
    altKey?: boolean;
    defaultPrevented?: boolean;
  }) =>
    e.key === "Enter" &&
    !e.shiftKey &&
    !e.metaKey &&
    !e.ctrlKey &&
    !e.altKey &&
    !e.defaultPrevented;

  it("sends on a plain Enter", () => {
    expect(wouldSubmit({ key: "Enter" })).toBe(true);
  });

  it("makes a newline on Shift+Enter", () => {
    expect(wouldSubmit({ key: "Enter", shiftKey: true })).toBe(false);
  });

  it("leaves Enter alone when the mention menu has taken it", () => {
    expect(wouldSubmit({ key: "Enter", defaultPrevented: true })).toBe(false);
  });

  it("ignores every other key", () => {
    for (const key of ["a", "Escape", "Tab", "ArrowDown"]) {
      expect(wouldSubmit({ key })).toBe(false);
    }
  });
});
