import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const viewport = read("../src/components/CanvasViewport.tsx");
const page = read("../src/pages/CanvasPage.tsx");

/**
 * **Holding a tool key must not flip back and forth.**
 *
 * `keydown` repeats while a key is held. A handler that TOGGLES on keydown
 * therefore toggles many times a second, and Dion found it exactly: *"if I
 * hold down H for hand, it jumps between the V/select and the H tool... P
 * works correctly. T does the bouncing."*
 *
 * The cause was not the toggle by itself — it was that tool keys were handled
 * in TWO files with two different shapes. Space, P and Z had hold machinery in
 * `CanvasViewport`; H and T were bare toggles in `CanvasPage` with no
 * `e.repeat` guard and no hold at all. One of those files knew about holding
 * and the other did not, so which tools worked was an accident of where their
 * key happened to be handled.
 */
describe("tool keys are handled in one place, with one shape", () => {
  it("keeps every tool key out of the page's handler", () => {
    /* The negative half, and the one that matters: a tool key added back to
       `CanvasPage` would work, would look right in review, and would bounce
       when held — which is precisely how this arrived. */
    for (const [key, tool] of [["h", "hand"], ["t", "text"]] as const) {
      expect(
        page.includes(`setActiveTool(ui.activeTool === "${tool}"`),
        `${key.toUpperCase()} must not toggle in CanvasPage`,
      ).toBe(false);
    }
  });

  it("gives the borrowed tools a hold, in the viewport with the others", () => {
    expect(viewport).toContain('const momentary: Record<string, Tool> = { KeyH: "hand", KeyT: "text" }');
    // The repeat guard is the fix for the bouncing on its own; the hold is the
    // fix for what was actually wanted, which is Space's behaviour.
    expect(viewport).toMatch(/!e\.repeat && holdTool\.current === null/);
    expect(viewport).toContain("wasHeld(held.downAt");
  });

  it("hands the tool back when the window goes away", () => {
    /* A keyup that lands in another window never arrives. The pen was fixed
       for this when it cost a lost drawing; Space and Z were fixed on 6 Sep;
       these are released by the same handler rather than by a fourth copy of
       the idea. */
    const onBlur = viewport.slice(viewport.indexOf("function onBlur()"));
    expect(onBlur.slice(0, onBlur.indexOf("\n    }"))).toContain("holdTool.current");
  });

  it("guards every other toggle in the page's handler", () => {
    /**
     * The sweep Dion asked for — "can you check for others too". Two more
     * toggles had the identical bug: C (comment mode) and ? (the help sheet).
     * Neither becomes a hold-to-borrow tool, because a mode you WORK IN is not
     * a tool you borrow for one gesture, and holding C to place one comment
     * would fight the click that places it. They just stop repeating.
     *
     * A blanket `if (e.repeat) return` at the top of the handler would have
     * been tidier and wrong: the arrow keys nudge a selection and SHOULD
     * repeat while held.
     */
    for (const [line, what] of [
      ["ui.setCommentMode(!ui.commentMode)", "C"],
      ["ui.setHelpOpen(!ui.helpOpen)", "?"],
    ] as const) {
      const at = page.indexOf(line);
      expect(at, `${what} is still here`).toBeGreaterThan(-1);
      const branch = page.lastIndexOf("} else if", at);
      expect(page.slice(branch, at), `${what} ignores key repeat`).toContain("!e.repeat");
    }
  });

  it("does not guard the keys that are meant to repeat", () => {
    // Arrows nudge a selection: holding one should keep nudging. This is why
    // the guard is per-branch rather than one line at the top of the handler.
    expect(page).not.toMatch(/function onKeyDown\(e: KeyboardEvent\) \{\s*if \(e\.repeat\) return/);
  });

  it("leaves Select alone, because setting it twice is not a toggle", () => {
    // V is idempotent and was never part of this: pressing it while held does
    // nothing, which is why it never bounced and needs no hold.
    expect(page).toContain('ui.setActiveTool("select"); // V is Select');
  });
});
