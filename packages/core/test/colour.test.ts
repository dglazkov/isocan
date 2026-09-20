import { describe, expect, it } from "vitest";
import {
  AREA_TINT_PROP,
  PAPER_PROP,
  SPOKEN_COLOURS,
  inkColour,
  itemColour,
  spokenColour,
  type ColouredItem,
  type InkStroke,
  type SpokenColour,
} from "../src/index.ts";

/**
 * **What the canvas is allowed to say about colour**, and — the half that
 * matters more — what it must refuse to say.
 *
 * `docs/research/2026-09-19-move-the-red-one.md`: "move the red one next to
 * the blue one" is impossible today because nothing the model is shown says
 * what colour anything is. The fix is only worth having if it never lies, so
 * most of what is asserted here is a `null`.
 */

const stroke = (color: string, points: { x: number; y: number }[], width = 3): InkStroke => ({
  color,
  points,
  width,
});

/** A straight horizontal run of a given length, so "dominant" is arithmetic
 *  a reader can check rather than a shape they have to imagine. */
const run = (color: string, length: number): InkStroke =>
  stroke(color, [
    { x: 0, y: 0 },
    { x: length, y: 0 },
  ]);

describe("a hex as the word somebody would say", () => {
  it("names the primaries", () => {
    expect(spokenColour("#ff0000")).toBe("red");
    expect(spokenColour("#00ff00")).toBe("green");
    expect(spokenColour("#0000ff")).toBe("blue");
    expect(spokenColour("#ffff00")).toBe("yellow");
    expect(spokenColour("#ffa500")).toBe("orange");
    expect(spokenColour("#8000ff")).toBe("purple");
  });

  it("takes the three-digit form, because a person writes #f00", () => {
    expect(spokenColour("#f00")).toBe("red");
    expect(spokenColour("f00")).toBe("red");
    expect(spokenColour("  #F00  ")).toBe("red");
  });

  it("calls a low-saturation colour black, grey or white by its lightness", () => {
    expect(spokenColour("#000000")).toBe("black");
    expect(spokenColour("#222222")).toBe("black");
    expect(spokenColour("#808080")).toBe("grey");
    expect(spokenColour("#cccccc")).toBe("grey");
    expect(spokenColour("#ffffff")).toBe("white");
    // The ink default: near-black with a faint blue cast, and every eye in
    // the room calls it black.
    expect(spokenColour("#23262b")).toBe("black");
  });

  it("does not find a hue in something too dark or too light to have one", () => {
    // Fully saturated green by the maths, and black to anybody looking.
    expect(spokenColour("#001100")).toBe("black");
    expect(spokenColour("#fffff8")).toBe("white");
  });

  it("knows brown is a dark orange and pink is a light red", () => {
    expect(spokenColour("#8b4513")).toBe("brown");
    expect(spokenColour("#964b00")).toBe("brown");
    // Bright, and therefore not brown.
    expect(spokenColour("#ffa500")).toBe("orange");
    expect(spokenColour("#ffc0cb")).toBe("pink");
    expect(spokenColour("#ff69b4")).toBe("pink");
    // Dark red stays red — the brown rule is fenced to the orange arc so it
    // cannot swallow this.
    expect(spokenColour("#8b0000")).toBe("red");
  });

  it("puts the words with no name in the set into the nearest one that has", () => {
    // There is no "cyan" or "teal" to say, and inventing one is how a closed
    // set stops being closed.
    expect(spokenColour("#00ffff")).toBe("blue");
    expect(spokenColour("#008080")).toBe("blue");
    expect(spokenColour("#32cd32")).toBe("green");
  });

  it("answers null for anything that is not a hex colour", () => {
    expect(spokenColour("rebeccapurple")).toBeNull();
    expect(spokenColour("oklch(0.7 0.1 250)")).toBeNull();
    expect(spokenColour("#12345")).toBeNull();
    expect(spokenColour("")).toBeNull();
    expect(spokenColour("#xyzxyz")).toBeNull();
  });

  it("only ever answers with a word from the closed set", () => {
    for (const hex of ["#ff0000", "#123456", "#abcdef", "#010203", "#fedcba", "#777777"]) {
      // Typed as the closed set, so a twelfth word could not be returned
      // without the compiler saying so — and checked at runtime too, because
      // the buckets are arithmetic and arithmetic can fall through.
      const word: SpokenColour | null = spokenColour(hex);
      expect(word === null || (SPOKEN_COLOURS as readonly string[]).includes(word)).toBe(true);
    }
  });
});

describe("a drawing's dominant ink", () => {
  it("is the colour with the most total stroke length, not the most strokes", () => {
    // Four short black ticks against one long red line: a person calls this
    // the red one, and a count of strokes would call it black.
    const strokes = [
      run("#ff0000", 400),
      run("#000000", 10),
      run("#000000", 10),
      run("#000000", 10),
      run("#000000", 10),
    ];
    expect(inkColour(strokes)).toBe("red");
  });

  it("groups by the spoken word, so two near-identical reds are one answer", () => {
    // Neither red alone beats the blue; together they are the drawing.
    expect(inkColour([run("#ff0000", 60), run("#fe0201", 60), run("#0000ff", 100)])).toBe("red");
  });

  it("counts a dot as ink, so a canvas of dots is not colourless", () => {
    expect(inkColour([stroke("#0000ff", [{ x: 5, y: 5 }], 8)])).toBe("blue");
  });

  it("ignores a stroke whose colour is not a hex, and answers null when none is", () => {
    expect(inkColour([run("currentColor", 500), run("#00ff00", 20)])).toBe("green");
    expect(inkColour([run("currentColor", 500)])).toBeNull();
    expect(inkColour([])).toBeNull();
  });
});

describe("what an item will admit about its own colour", () => {
  /** The shape a caller can honestly hand over, and nothing wider: a property
   *  bag both surfaces hold, and ink for whoever has it. */
  const asked = (item: ColouredItem) => itemColour(item);

  it("reads a note's paper, which is already a spoken word", () => {
    expect(asked({ properties: { [PAPER_PROP]: "green" } })).toBe("green");
    expect(itemColour({ properties: { kind: "text", [PAPER_PROP]: "yellow" } })).toBe("yellow");
    expect(itemColour({ properties: { [PAPER_PROP]: "pink" } })).toBe("pink");
  });

  it("reads an area's tint, which is the same palette", () => {
    expect(itemColour({ properties: { kind: "area", [AREA_TINT_PROP]: "blue" } })).toBe("blue");
  });

  it("does not believe a property that is not a paper", () => {
    expect(itemColour({ properties: { [PAPER_PROP]: "chartreuse" } })).toBeNull();
    expect(itemColour({ properties: { [AREA_TINT_PROP]: "#ff0000" } })).toBeNull();
  });

  it("prefers the ink when the caller has it", () => {
    expect(
      itemColour({ properties: { [PAPER_PROP]: "yellow" }, ink: [run("#ff0000", 100)] }),
    ).toBe("red");
  });

  it("answers null rather than guessing, for an item with no colour at all", () => {
    // The common case, and the whole reason this returns a nullable: a
    // screenshot that is obviously red in the room is silent in the data.
    expect(itemColour({ properties: {} })).toBeNull();
    expect(itemColour({})).toBeNull();
    expect(itemColour({ properties: { kind: "screen" } })).toBeNull();
  });

  it("never infers a colour from the title", () => {
    // "Red team retro" is not a red item, and an item called "Blue" that is a
    // spreadsheet would make a model move the wrong thing confidently.
    expect(itemColour({ properties: { title: "Red team retro" } })).toBeNull();
    expect(itemColour({ properties: { kind: "made", name: "Acme blue banner" } })).toBeNull();
  });
});
