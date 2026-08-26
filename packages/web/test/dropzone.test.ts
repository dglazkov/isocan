import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const viewport = readFileSync(
  fileURLToPath(new URL("../src/components/CanvasViewport.tsx", import.meta.url)),
  "utf8",
);

/**
 * The drop overlay dies of silence, never of bookkeeping.
 *
 * The recorded bug: `dragleave` cleared it only when the event's target was
 * the viewport element itself — but dragleave fires on whichever CHILD the
 * pointer was last over, so leaving the window over an item, Esc-ing a
 * drag, or releasing over a panel left the full-screen "Drop to add"
 * overlay standing over a drag nobody was making, until a reload. The
 * browser promises no enter/leave pairing, so no counter fixes this; what
 * IS promised is that `dragover` keeps firing (~350ms) while a drag is over
 * the window. The overlay lives on that signal and expires without it.
 */
describe("the drop overlay", () => {
  it("is kept alive by dragover and expires by timeout", () => {
    expect(viewport).toMatch(/setTimeout\(\(\) => setDropping\(false\), 700\)/);
    expect(viewport).toMatch(/onDragOver=\{[^}]*dragAlive/s);
  });

  it("never trusts a dragleave target equality again", () => {
    // The bug's exact spelling, banned: clearing on `e.target === ref` is
    // clearing on which child the pointer happened to cross last.
    expect(viewport).not.toContain("onDragLeave");
  });

  it("clears immediately on a real drop, not a timeout later", () => {
    expect(viewport).toMatch(
      /onDrop\(e: React\.DragEvent\) \{\s*e\.preventDefault\(\);\s*if \(droppingTimer\.current\) clearTimeout[\s\S]{0,80}setDropping\(false\);/,
    );
  });

  it("keeps the timeout above the dragover repeat interval", () => {
    // The spec's stationary-hover repeat is ~350ms; a timeout under it would
    // make the overlay flicker DURING a legitimate hover. Bracketed, per the
    // house rule for tuning constants.
    const ms = Number(viewport.match(/setDropping\(false\), (\d+)\)/)?.[1]);
    expect(ms).toBeGreaterThanOrEqual(500);
    expect(ms).toBeLessThanOrEqual(1500);
  });
});
