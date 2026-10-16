import { describe, expect, it } from "vitest";
import type { CanvasContents, Item } from "../src/index.ts";
import { deniedIn, IMAGE_MODEL_DEFAULT, imageModel, MOOD_AXES, MOOD_TILE, moodCostLine, moodPrompt, moodTray, spreadAxes } from "../src/mood.ts";

/**
 * **The mood board's pure half** (moodboard phase 0; design §3, §6): the
 * template never drops the not-UI clause, a spread reaches along every axis
 * before any twice, the deny-list refuses the obvious and leaves innocent
 * words alone, the cost is said in dollars, and a tray lands clear of the
 * canvas's content. Synthetic words throughout.
 */

describe("the template", () => {
  it("never omits the not-UI clause or the refusals, whatever the words", () => {
    for (const words of ["", "a quiet bakery at dawn", "an app screen for a checkout flow", "UI, dashboard, buttons"]) {
      for (const { reach } of MOOD_AXES) {
        const prompt = moodPrompt(words, reach);
        expect(prompt).toContain("not a user interface, not a screen, no text overlays");
        expect(prompt).toContain("No logos, no brands, no recognisable people");
        expect(prompt).toContain(`Reach for ${reach}.`);
      }
    }
  });

  it("carries the person's words as they typed them, trimmed", () => {
    expect(moodPrompt("  a quiet bakery at dawn ", "the quality of the light")).toContain("about: a quiet bakery at dawn. Reach for");
  });
});

describe("a spread", () => {
  it("reaches along every axis once before any twice", () => {
    const nine = spreadAxes(9).map((a) => a.axis);
    expect(new Set(nine.slice(0, 8)).size).toBe(8);
    expect(nine[8]).toBe(nine[0]);
    expect(spreadAxes(3).map((a) => a.axis)).toEqual(MOOD_AXES.slice(0, 3).map((a) => a.axis));
    expect(spreadAxes(12)).toHaveLength(12);
  });

  it("includes lettering as an object, not a font", () => {
    expect(MOOD_AXES.find((a) => a.axis === "lettering")?.reach).toMatch(/a sign, a stamp, a label/);
  });
});

describe("the deny-list", () => {
  it("refuses a brand, a logo, a living artist, a style-of and a real person — in words", () => {
    for (const words of ["a Nike store at night", "our logo on a wall", "like Banksy on brick", "in the style of anyone", "Taylor Swift on stage"]) {
      const why = deniedIn(words);
      expect(why, words).toMatch(/refused before anything is spent/);
    }
  });

  it("leaves innocent words alone, including the ones a brand shares", () => {
    for (const words of ["a quiet bakery at dawn", "an apple orchard in October", "a target on a barn door", "shells on a cold beach", "an old stamp on a parcel"]) {
      expect(deniedIn(words), words).toBeNull();
    }
  });
});

describe("the cost", () => {
  it("is said in dollars for the default model", () => {
    expect(moodCostLine(9, IMAGE_MODEL_DEFAULT)).toBe(`9 images ≈ $0.30 (${IMAGE_MODEL_DEFAULT}, $0.0336 each)`);
    expect(moodCostLine(1, IMAGE_MODEL_DEFAULT)).toMatch(/^1 image ≈ \$0\.03/);
  });

  it("says when this build has no price rather than guessing", () => {
    expect(moodCostLine(9, "gemini-acme-image")).toBe("9 images with gemini-acme-image — this build has no price for that model");
  });

  it("reads the model from ISOCAN_IMAGE_MODEL, else the default", () => {
    expect(imageModel({})).toBe(IMAGE_MODEL_DEFAULT);
    expect(imageModel({ ISOCAN_IMAGE_MODEL: " gemini-3-pro-image " })).toBe("gemini-3-pro-image");
  });
});

describe("the tray", () => {
  const item = (id: string, x: number, y: number, width = 400, height = 300) => ({ id, x, y, width, height }) as unknown as Item;
  const canvas = (items: Item[]) => ({ items: Object.fromEntries(items.map((i) => [i.id, i])) }) as unknown as CanvasContents;
  const overlaps = (a: { x: number; y: number }, b: Item) =>
    a.x < b.x + b.width && b.x < a.x + MOOD_TILE.width && a.y < b.y + b.height && b.y < a.y + MOOD_TILE.height;

  it("starts at the origin on an empty canvas, in rows of three", () => {
    const spots = moodTray(canvas([]), 9);
    expect(spots[0]).toEqual({ x: 0, y: 0 });
    expect(new Set(spots.map((s) => s.y)).size).toBe(3);
    expect(new Set(spots.map((s) => s.x)).size).toBe(3);
  });

  it("sits to the right of the content, top-aligned, landing on nothing", () => {
    const items = [item("itm_a", 0, 100), item("itm_b", 500, 400)];
    const spots = moodTray(canvas(items), 9);
    expect(spots[0]!.x).toBeGreaterThan(900);
    expect(spots[0]!.y).toBe(100);
    for (const spot of spots) for (const it of items) expect(overlaps(spot, it)).toBe(false);
    const keys = spots.map((s) => `${s.x},${s.y}`);
    expect(new Set(keys).size).toBe(9);
  });
});
