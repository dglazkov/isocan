import { describe, expect, it } from "vitest";
import {
  DECK_TRANSITIONS,
  DECK_TRANSITION_PROP,
  DEFAULT_DECK_TRANSITION,
  deckTransitionHint,
  deckTransitionLabel,
  deckTransitionOf,
  deckTransitionPatch,
  isDeckTransition,
  isDeckTransition3d,
} from "../src/slides.ts";

/**
 * The deck's transition: a canvas property, so zero new ops, and a closed
 * list so neither surface can name a motion the other cannot draw.
 */
const wearing = (properties: Record<string, string>) => ({ properties });

describe("the deck transition", () => {
  it("defaults to push, so every canvas from before it flips as it did", () => {
    expect(DEFAULT_DECK_TRANSITION).toBe("push");
    expect(deckTransitionOf(wearing({}))).toBe("push");
    expect(deckTransitionOf({})).toBe("push");
  });

  it("reads a chosen motion, and reads a name it cannot draw as the default", () => {
    expect(deckTransitionOf(wearing({ [DECK_TRANSITION_PROP]: "depth" }))).toBe("depth");
    expect(deckTransitionOf(wearing({ [DECK_TRANSITION_PROP]: "star-wipe" }))).toBe("push");
  });

  it("stores the default as an absence", () => {
    expect(deckTransitionPatch("push")).toEqual({ removeProperties: [DECK_TRANSITION_PROP] });
    expect(deckTransitionPatch("cube")).toEqual({ properties: { [DECK_TRANSITION_PROP]: "cube" } });
  });

  it("names, describes and parses every motion it lists", () => {
    for (const t of DECK_TRANSITIONS) {
      expect(isDeckTransition(t)).toBe(true);
      expect(deckTransitionLabel(t).length).toBeGreaterThan(0);
      expect(deckTransitionHint(t).length).toBeGreaterThan(0);
    }
    expect(isDeckTransition("star-wipe")).toBe(false);
    expect(new Set(DECK_TRANSITIONS.map(deckTransitionLabel)).size).toBe(DECK_TRANSITIONS.length);
  });

  it("knows which ones leave the flat plane", () => {
    expect(DECK_TRANSITIONS.filter(isDeckTransition3d)).toEqual(["morph", "depth", "cube", "flip"]);
  });
});
