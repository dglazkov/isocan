import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { placeCards } from "../src/components/ProposalMarks.tsx";
import { UNDER_ROW_PAD } from "../src/lib/chrome.ts";

/**
 * **A proposal's note never covers another item, its frame, or another
 * note — at any zoom** (the night-watch screenshot at 33%, 14 Oct 2026).
 *
 * Each note was drawn beside its frame's top-right corner, always, and
 * counter-scaled: 254 screen pixels whatever the zoom. Frames hang beneath
 * screens that stand side by side, so "beside" was the next screen's column —
 * 770 world units across an 80-unit gutter at 33%, and still 174 at 100%.
 * Every note in a row of three covered its neighbour's frame.
 *
 * `placeCards` is where each note goes, and the component draws exactly the
 * boxes it returns (the same offsets, through the anchor's inline tokens), so
 * holding its boxes apart holds the drawn notes apart. The journeys hold the
 * drawn ones too, by bounding box, in headless Chrome.
 */

type Box = { x: number; y: number; width: number; height: number };
const overlaps = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** The night-watch layout: three 390×520 screens 470 apart, and a frame hanging beneath each. */
const screens: Box[] = [0, 470, 940].map((x) => ({ x, y: 0, width: 390, height: 520 }));
const frames: Box[] = [0, 470, 940].map((x) => ({ x, y: 616, width: 390, height: 520 }));
const items = [...screens, ...frames];
const asks = frames.map((frame, i) => ({ id: `p${i}`, frame, guess: 150 }));

describe("three frames side by side", () => {
  for (const scale of [1, 0.5, 0.33]) {
    it(`no note touches a neighbour's frame, any item, or another note at ${Math.round(scale * 100)}%`, () => {
      const placed = placeCards(asks, items, scale);
      expect(placed).toHaveLength(3);
      for (const card of placed) {
        for (const item of items) expect(overlaps(card.box, item), `${card.id} (${card.mode}, ${card.slot}) over an item at ${scale}`).toBe(false);
        for (const other of placed) if (other !== card) expect(overlaps(card.box, other.box), `${card.id} over ${other.id} at ${scale}`).toBe(false);
      }
    });
  }

  it("puts the whole note in its own frame's column when the frame is wide enough to hold it", () => {
    for (const scale of [1, 0.5]) {
      const placed = placeCards(asks, items, scale);
      expect(placed.map((p) => [p.mode, p.slot])).toEqual([["full", "beneath"], ["full", "beneath"], ["full", "beneath"]]);
      for (const [i, card] of placed.entries()) {
        // Never wider on screen than the frame it belongs to.
        expect(card.width).toBeLessThanOrEqual(frames[i]!.width * scale);
        expect(card.box.x).toBe(frames[i]!.x);
        expect(card.box.y).toBeGreaterThan(frames[i]!.y + frames[i]!.height);
      }
    }
  });

  it("steps down to the chip alone, no wider than the frame looks, when the column is too narrow to read", () => {
    const placed = placeCards(asks, items, 0.33);
    for (const [i, card] of placed.entries()) {
      expect(card.mode).toBe("chip");
      expect(card.width).toBeLessThanOrEqual(frames[i]!.width * 0.33);
    }
  });

  it("goes beside the frame only when nothing is there", () => {
    // One frame, stacked so closely above another that its column is taken.
    const lone = { x: 0, y: 0, width: 390, height: 520 };
    const below = { x: 0, y: 616, width: 390, height: 520 };
    const [beside] = placeCards([{ id: "a", frame: lone, guess: 150 }], [lone, below], 1);
    expect([beside!.mode, beside!.slot]).toEqual(["full", "right"]);
    // A neighbour 80 units to the right takes that too: the chip, beneath.
    const neighbour = { x: 470, y: 0, width: 390, height: 520 };
    const [squeezed] = placeCards([{ id: "a", frame: lone, guess: 150 }], [lone, below, neighbour], 1);
    expect(squeezed!.mode).toBe("chip");
    for (const item of [lone, below, neighbour]) expect(overlaps(squeezed!.box, item)).toBe(false);
  });

  it("shows nothing but the outline when not even the chip has room", () => {
    const lone = { x: 0, y: 0, width: 390, height: 520 };
    const below = { x: 0, y: 560, width: 390, height: 520 };
    const neighbour = { x: 430, y: 0, width: 390, height: 520 };
    const [none] = placeCards([{ id: "a", frame: lone, guess: 150 }], [lone, below, neighbour], 0.2);
    expect(none!.mode).toBe("none");
  });

  it("does not count an area the frame stands in as a neighbour", () => {
    const area = { x: -100, y: -100, width: 2000, height: 2000 };
    const placed = placeCards(asks, [area, ...items], 1);
    expect(placed.every((p) => p.mode === "full")).toBe(true);
  });

  it("re-flows the words with a measured height rather than a guess", () => {
    const tall = placeCards([{ id: "a", frame: frames[0]!, guess: 150, measured: { w: 240, h: 400 } }], items, 1)[0]!;
    const short = placeCards([{ id: "a", frame: frames[0]!, guess: 150, measured: { w: 240, h: 100 } }], items, 1)[0]!;
    expect(tall.height).toBeGreaterThan(short.height);
  });
});

describe("the stylesheet draws what the placement decided", () => {
  it("keeps clear of the row under every item by the row's own pad", () => {
    // Written out in the component rather than imported, so the entry chunk
    // need not export it to a lazy one; held to the same number here.
    const source = readFileSync(fileURLToPath(new URL("../src/components/ProposalMarks.tsx", import.meta.url)), "utf8");
    expect(source).toContain(`const UNDER_ROOM = ${UNDER_ROW_PAD} + 22;`);
  });
  const css = readFileSync(fileURLToPath(new URL("../src/components/proposal-marks.css", import.meta.url)), "utf8");
  it("positions and sizes the note only through the anchor's tokens", () => {
    const note = /\.proposal-note \{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(note).toMatch(/left: var\(--card-x\)/);
    expect(note).toMatch(/top: var\(--card-y\)/);
    expect(note).toMatch(/width: var\(--card-w\)/);
    expect(note).toMatch(/box-sizing: border-box/);
  });
  it("opens a stepped-down note on hover, focus and selection, lifted over the items", () => {
    expect(css).toMatch(/\[data-card="chip"\]:not\(:hover, :focus-within, \[data-open\]\)/);
    expect(css).toMatch(/:not\(\[data-card="full"\]\):is\(:hover, :focus-within, \[data-open\]\) \{ z-index: 1; \}/);
  });
});
