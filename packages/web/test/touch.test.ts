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
    expect(bare).toMatch(/if \(!moved && opts\.tapClears\) clearBackgroundFocus\(\);/);
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
