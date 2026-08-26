import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { crossesCover } from "../src/lib/keys.ts";

/**
 * Canvas shortcuts must not fire under a cover.
 *
 * `/p/:id/i/:itemId` covers the canvas with one item, and Enter navigates
 * there WITHOUT clearing the selection — so the item on screen is also the
 * item every selection shortcut acts on. Before the gate, Delete under full
 * screen deleted the thing being viewed and landed on "that item is not on
 * this canvas any more"; arrows nudged it, S fanned it, ⌘Z undid ops nobody
 * could see. The rule lives in ONE home (`crossesCover` in lib/keys.ts) and
 * this file asks lessons.md #16's two questions of it: does the rule do its
 * job, and is the handler actually wired through it.
 */

const source = readFileSync(
  fileURLToPath(new URL("../src/pages/CanvasPage.tsx", import.meta.url)),
  "utf8",
);

describe("what crosses a cover", () => {
  it("lets ⌘K through — the command bar is deliberately global", () => {
    expect(crossesCover({ key: "k", metaKey: true })).toBe(true);
    expect(crossesCover({ key: "K", metaKey: true })).toBe(true); // shift held
    expect(crossesCover({ key: "k", ctrlKey: true })).toBe(true);
  });

  it("stops the keys that made the bug", () => {
    // Each of these fired under FullScreen before the gate. Delete is the one
    // that hurt; the rest acted on the same invisible selection.
    const keys = ["Delete", "Backspace", "Enter", "F2", "Escape",
      "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
      "s", "c", "f", "h", "v", "0", "?"];
    for (const key of keys) {
      expect(crossesCover({ key }), key).toBe(false);
    }
  });

  it("stops the modified keys too — undo and zoom act on what you cannot see", () => {
    expect(crossesCover({ key: "z", metaKey: true })).toBe(false);
    expect(crossesCover({ key: "z", ctrlKey: true })).toBe(false);
    expect(crossesCover({ key: "=", metaKey: true })).toBe(false);
    expect(crossesCover({ key: "-", metaKey: true })).toBe(false);
    expect(crossesCover({ key: "0", metaKey: true })).toBe(false);
    expect(crossesCover({ key: "ArrowLeft", metaKey: true })).toBe(false);
  });

  it("stops a bare k — that is a keystroke, not the command bar", () => {
    expect(crossesCover({ key: "k" })).toBe(false);
  });
});

describe("the handler is wired through the rule", () => {
  // The keydown effect, from the handler's definition to its dependency
  // array. Every wiring claim below is asserted inside this slice, so a
  // match elsewhere in the file cannot answer on its behalf.
  const start = source.indexOf("function onKeyDown");
  const registered = source.indexOf('window.addEventListener("keydown", onKeyDown)', start);
  const deps = source.indexOf("}, [", registered);
  const effect = source.slice(start, source.indexOf(");", deps) + 2);

  it("found the handler at all (the slice below would otherwise assert on nothing)", () => {
    expect(start).toBeGreaterThan(-1);
    expect(registered).toBeGreaterThan(-1);
    expect(effect).toContain('"item.delete"'); // the branch the gate protects
  });

  it("imports the rule from its one home rather than restating it", () => {
    // Lesson #5: a guard that restates the rule can only test itself — and so
    // can a handler. The gate must be THE crossesCover, from lib/keys.ts.
    expect(source).toMatch(/import \{[^}]*\bcrossesCover\b[^}]*\} from "\.\.\/lib\/keys\.ts"/);
  });

  it("gates on the cover route before anything else — ⌘K's branch included", () => {
    // BOTH covers: full screen's itemId and the workbench. The workbench
    // shipped second, and the design doc's instruction was to extend this
    // gate rather than grow a second policy in the handler — so the guard
    // asserts the one gate names the pair.
    const gate = effect.search(
      /if\s*\(\(itemId \|\| onWorkbench\)\s*&&\s*!crossesCover\(e\)\)\s*return/,
    );
    expect(gate, "no route gate in onKeyDown").toBeGreaterThan(-1);
    // FIRST, not merely present: a gate that lets one dispatch run before it
    // is half a gate. The rule itself decides what crosses, so nothing in the
    // handler may be consulted earlier.
    for (const later of ['"k"', "isTyping(", '"item.delete"', "NUDGES[", '"F2"', "setFanned("]) {
      const at = effect.indexOf(later);
      expect(at, `${later} missing from the handler`).toBeGreaterThan(-1);
      expect(gate, `gate must come before ${later}`).toBeLessThan(at);
    }
  });

  it("re-registers when the route changes, so the gate sees the CURRENT itemId", () => {
    // The handler closes over itemId from useParams. Without it in the
    // dependency array, the listener registered on the canvas route keeps a
    // stale undefined forever — and the gate never turns on.
    // onWorkbench rides the same array for the same reason itemId does.
    expect(effect).toMatch(/\}, \[canvasId, actor, itemId, onWorkbench\]\);$/);
  });
});
