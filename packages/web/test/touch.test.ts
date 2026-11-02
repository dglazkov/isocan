import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { rules, withoutComments } from "./cssrules.ts";

/**
 * **A finger on the canvas** (#182 stage 0).
 *
 * Measured 5 Sep 2026 on a 375×812 viewport under Android Chrome emulation:
 * `wantsPan = e.button === 1 || (activeTool === "hand" && e.button === 0)`, so
 * a one-finger drag on empty canvas started a MARQUEE — **the canvas could not
 * be moved with a finger** unless the Hand tool was up, and the Hand tool is a
 * 24px button on a rail. Two fingers did nothing at all: zoom was a `ctrlKey`
 * wheel, WebKit's `gesturestart`, and the +/− buttons, none of which a phone
 * has.
 *
 * The arithmetic is `pinch` in `lib/viewport.ts` and is tested there, where a
 * transform can be asserted. What these hold is the WIRING, which is where the
 * two-pointer bugs live: a gesture that is extended rather than replaced, and
 * a finger that goes down without coming back up.
 */
const viewport = readFileSync(
  fileURLToPath(new URL("../src/components/CanvasViewport.tsx", import.meta.url)),
  "utf8",
);
const bare = viewport
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
  .replace(/\/\/.*$/gm, "");

describe("one finger moves the canvas", () => {
  it("gives a touch on empty canvas a pan, and leaves the mouse its marquee", () => {
    /* Replaced, not shared. A marquee needs a pointer you can place precisely
       and Shift to add to it; what a phone wants from a blank patch of canvas
       is to go somewhere else. */
    expect(bare).toMatch(/if \(e\.pointerType === "touch"\) startPan\(e, \{ tapClears: true \}\);\s*else startMarquee\(e\);/);
  });

  it("still clears the selection when the pan turns out to be a tap", () => {
    /* The marquee's answer to "I pressed nothing" came with the gesture the
       touch pan replaced, so it has to be carried over — otherwise on a phone
       there is no way to deselect. One function, called from both, so a tap
       and a click cannot drift apart. */
    expect(bare).toContain("function clearBackgroundFocus()");
    // A cancelled touch is not a tap. A completed tap first applies the
    // same group boundary as mouse selection, then shares the deselection.
    expect(bare).toMatch(/if \(!moved && opts\.tapClears && ev\.type !== "pointercancel"\) \{\s*leaveGroupAtPoint\(screenToWorld\(useUiStore\.getState\(\)\.viewport, ev\.clientX, ev\.clientY\)\);\s*clearBackgroundFocus\(\);\s*\}/);
    const marquee = bare.slice(bare.indexOf("function startMarquee"));
    expect(marquee.indexOf("leaveGroupAtPoint(startWorld)")).toBeGreaterThanOrEqual(0);
    expect(marquee.indexOf("leaveGroupAtPoint(startWorld)")).toBeLessThan(marquee.indexOf("const baseSelection"));
    expect(bare).toMatch(/if \(!moved && !additive\) clearBackgroundFocus\(\);/);
  });

  it("does not believe a resting finger is a drag", () => {
    // A finger on glass reports movement. The pan uses the same 4px the
    // marquee has always used before it calls a press a drag — otherwise
    // every tap is a two-pixel pan that never clears anything.
    expect(bare).toMatch(/if \(!moved && Math\.hypot\(ev\.clientX - from\.x, ev\.clientY - from\.y\) >= 4\) moved = true;/);
  });
});

describe("two fingers zoom", () => {
  it("starts a pinch before any tool gets the press", () => {
    /* A pinch is not a tool. Spreading two fingers while the Pen is up should
       zoom, not draw a line between them — so the two-finger test sits above
       every branch in `onPointerDown`, and returns rather than falling
       through. */
    const down = bare.slice(bare.indexOf("function onPointerDown"));
    const pinchAt = down.indexOf("startPinch()");
    for (const branch of ['activeTool === "zoom"', 'activeTool === "pen"', 'activeTool === "text"', "startMarquee(e)"]) {
      expect(down.indexOf(branch), `${branch} is decided after the pinch`).toBeGreaterThan(pinchAt);
    }
  });

  it("replaces the gesture in flight instead of running both", () => {
    /**
     * The line-between-the-fingers bug: a pan that keeps running while a
     * pinch zooms makes the canvas both follow one finger and scale about
     * both. It is what happens when a second pointer is treated as an
     * addition rather than as a different gesture, and it is the reason this
     * is a ref that gestures hand each other rather than a flag.
     */
    expect(bare).toContain("abandonGesture.current?.();");
    expect(bare).toMatch(/abandonGesture\.current = \(\) => stop\(e\.pointerId\);/);
    expect(bare).toMatch(/abandonGesture\.current = stop;/);
    // And each gesture drops its own claim when it ends, or the next second
    // finger abandons something that is no longer running.
    expect((bare.match(/abandonGesture\.current = null;/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("ignores a third finger rather than folding it in", () => {
    // A palm, or a hand steadying the phone. Neither is a gesture, and a
    // pinch that re-reads its pair on every extra contact jumps.
    expect(bare).toMatch(/if \(fingers\.current\.size > 2\) return;/);
  });

  it("forgets every finger, including the ones no gesture owned", () => {
    /**
     * The bug this exists for: `startPan` and the pinch each forget their own
     * pointer, but a touch that started something ELSE — a stroke, an item
     * drag, a tap on a card — reaches neither. The map then holds a finger
     * nobody is touching, and the NEXT single touch counts as the second and
     * pinches against a ghost. Driven with two synthetic touches in a row on
     * 7 Sep before this line existed.
     */
    expect(bare).toContain("onPointerUp={(e) => fingers.current.delete(e.pointerId)}");
    expect(bare).toContain("onPointerCancel={(e) => fingers.current.delete(e.pointerId)}");
  });
});

describe("the browser's own gestures stay off", () => {
  it("keeps touch-action none, which is what makes all of this ours", () => {
    /* `touch-action: none` switches the browser's pan and pinch off. That is
       correct for a canvas that handles touch itself and was a trap for one
       that did not — for two days the page could not be moved by any means on
       a phone. Asserted so nobody "fixes" the symptom by handing the gesture
       back, which would scroll the PAGE rather than the canvas. */
    const sheet = rules(withoutComments());
    const surface = sheet.find((r) => r.selector === ".canvas-viewport");
    expect(surface?.body).toContain("touch-action: none");
  });
});

/**
 * **The chrome at 375** (#182 stage 0, the other half).
 *
 * Measured 7 Sep on a 375×812 Android emulation, and both were live:
 *
 * - The front page's header row was 428px of content in a 327px box, so the
 *   page scrolled sideways and the identity button — the way to see who you
 *   are and to leave — sat off the right edge of the phone.
 * - The minimap (x 20–188) and the zoom row (x 161–355) overlapped by
 *   **27 pixels**, one drawn over the other, on every phone.
 *
 * Held here rather than by a screenshot because both are one declaration each,
 * and a declaration is the thing that goes missing in a refactor.
 */
describe("the chrome fits a phone", () => {
  const sheet = rules(withoutComments());
  const rule = (selector: string) => sheet.find((r) => r.selector === selector);

  it("wraps the front page's header instead of scrolling the page sideways", () => {
    /* `flex-wrap`, not a breakpoint: the row already knows when it has run
       out, and a breakpoint would be a second opinion about the same fact in
       pixels that stop being true when somebody adds a button. */
    expect(rule(".canvases-head")?.body).toContain("flex-wrap: wrap");
  });

  it("lifts an unfolded minimap clear of the zoom row on a narrow window", () => {
    /* Below 460 the map starts folded by the width (`minimapnarrow.test.ts`),
       and its handle sits in the corner clear of the row. The lift is for a
       map somebody tapped open there, so it applies to the unfolded dock
       only — a lifted handle would float for no reason. */
    const lifted = sheet.find(
      (r) => r.selector === ".minimap-dock:not(.folded)" && r.body.includes("var(--zoom-row)"),
    );
    expect(lifted, "a narrow-window rule stacks an open map").toBeTruthy();
    expect(lifted!.at.join(" "), "and only on a narrow window").toMatch(/max-width/);
  });

  it("reads the zoom row's height from the row itself", () => {
    /**
     * The two are one number with two homes, which is the shape this codebase
     * keeps writing lessons about. `--zoom-row` is declared once, the row is
     * held to it with `min-height`, and the minimap's offset is computed from
     * it — so a taller zoom row cannot start overlapping the map again while
     * both declarations stay individually correct.
     */
    expect(rule(".zoom-controls")?.body).toContain("min-height: var(--zoom-row)");
    // `box-sizing` or the min-height is about the content box and the padding
    // pushes it past the number the minimap was told.
    expect(rule(".zoom-controls")?.body).toContain("box-sizing: border-box");
  });
});
