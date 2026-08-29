import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SHORTCUTS } from "@isocan/core";

/**
 * **Full screen is a slideshow, and this is what that costs the chrome.**
 *
 * The canvas gets used as a presentation tool: ⌘← and ⌘→ walk from item to
 * item with each one filling the window. A permanent bar across the top of
 * every slide is the one thing a slideshow must not have — so the chrome
 * floats, and it bows out while nothing is moving.
 */
const view = readFileSync(
  fileURLToPath(new URL("../src/components/FullScreen.tsx", import.meta.url)),
  "utf8",
);
const css = readFileSync(fileURLToPath(new URL("../src/styles.css", import.meta.url)), "utf8");

describe("full screen presents", () => {
  it("still walks the canvas with the arrows it always did", () => {
    // The reason this file exists. The chrome may change shape as often as
    // the design likes; the slideshow may not stop working because of it.
    const row = SHORTCUTS.find((s) => s.keys.includes("⌘←"));
    expect(row, "the jump keys must stay registered").toBeTruthy();
    expect(row!.does).toMatch(/Jump to the nearest item/);
    expect(view, "and full screen must still handle them").toMatch(/findNextItem\(/);
    expect(view).toMatch(/navigate\(itemPath\(canvasId, next\.id\)\)/);
  });

  it("gives the slide the whole window", () => {
    // The bar used to take a slice off the top of every slide. Its own comment
    // argued against that — "every pixel this takes is one the thing you are
    // reading does not get" — and floating is that argument finished.
    expect(css).toMatch(/\.fullscreen > \.fullscreen-stage \{ position: absolute; inset: 0; \}/);
    expect(css).toMatch(/\.fs-bar \{[^}]*position: absolute/);
  });

  it("rests the chrome when nothing is moving, and a pointer brings it back", () => {
    expect(view).toMatch(/setResting\(true\), REST_AFTER_MS/);
    expect(view).toMatch(/addEventListener\("pointermove", wake/);
    expect(css).toMatch(/\.fullscreen\.resting \.fs-bar \{ opacity: 0/);
  });

  it("does NOT wake on a key, because flipping slides is presenting", () => {
    /**
     * If ⌘→ revealed the chrome it would blink into view on every slide,
     * which is worse than leaving it up. The wake listeners are pointer and
     * focus only — and focus IS there, because somebody arriving at
     * "← Canvas" by keyboard must be able to see where they have landed.
     */
    const rest = view.slice(view.indexOf("const [resting"), view.indexOf("return (", view.indexOf("const [resting")));
    expect(rest).toMatch(/addEventListener\("focusin", wake\)/);
    expect(rest, "a key press must not un-rest the chrome").not.toMatch(/"keydown", wake/);
  });

  it("fades rather than unmounting, so nothing reflows under the slide", () => {
    // `display: none` would relayout the stage as the chrome came and went,
    // which on a projector reads as the slide twitching every few seconds.
    const rule = /\.fullscreen\.resting \.fs-bar \{[^}]*\}/.exec(css)?.[0] ?? "";
    expect(rule).toMatch(/opacity: 0/);
    expect(rule).not.toMatch(/display: none/);
  });

  it("respects reduced motion", () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{ \.fs-bar \{ transition: none; \} \}/);
  });
});
