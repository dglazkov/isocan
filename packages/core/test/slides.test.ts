import { describe, expect, it } from "vitest";
import type { CanvasContents, Item } from "../src/model.ts";
import {
  SLIDE_PROP,
  deck,
  deckStep,
  isSlide,
  readingOrder,
  slideIntent,
  slidePatch,
  slides,
} from "../src/slides.ts";

/**
 * The deck (#87): a property, not an operation — `item.update` carries it —
 * and an order that is geometry rather than a number to maintain.
 */
const item = (
  id: string,
  box: { x: number; y: number; width?: number; height?: number } = { x: 0, y: 0 },
  props: Record<string, string> = {},
): Item =>
  ({
    id,
    title: id.toUpperCase(),
    x: box.x,
    y: box.y,
    width: box.width ?? 100,
    height: box.height ?? 100,
    properties: props,
    reactions: {},
    versions: [],
    currentVersionId: "v",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  }) as unknown as Item;

const canvasOf = (items: Item[]) =>
  ({ items: Object.fromEntries(items.map((i) => [i.id, i])), threads: {} }) as unknown as CanvasContents;

const asSlide = { [SLIDE_PROP]: "yes" };

describe("a slide is a property", () => {
  it("presence is the mark, whatever the value says", () => {
    // A later version may put an ordering or a note in the value; that must
    // not un-mark every deck made before it.
    expect(isSlide(item("a", { x: 0, y: 0 }, asSlide))).toBe(true);
    expect(isSlide(item("b", { x: 0, y: 0 }, { [SLIDE_PROP]: "3" }))).toBe(true);
    expect(isSlide(item("c"))).toBe(false);
  });

  it("clearing uses removeProperties, because properties merges", () => {
    expect(slidePatch(true)).toEqual({ properties: { [SLIDE_PROP]: "yes" } });
    expect(slidePatch(false)).toEqual({ removeProperties: [SLIDE_PROP] });
  });
});

describe("reading order is rows, top to bottom, left to right", () => {
  it("walks a grid the way a page is read", () => {
    const ordered = readingOrder([
      item("d", { x: 0, y: 200 }),
      item("b", { x: 150, y: 0 }),
      item("a", { x: 0, y: 0 }),
      item("c", { x: 150, y: 200 }),
    ]);
    expect(ordered.map((i) => i.id)).toEqual(["a", "b", "d", "c"]);
  });

  it("neighbours at slightly different heights stay one row", () => {
    // Two screens side by side, dropped by hand: 10 units of vertical drift
    // must not read as two rows with one slide each.
    const ordered = readingOrder([
      item("b", { x: 150, y: 10 }),
      item("a", { x: 0, y: 0 }),
    ]);
    expect(ordered.map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("breaks ties by id, so the deck cannot reorder itself when nothing changed", () => {
    const ordered = readingOrder([item("b", { x: 0, y: 0 }), item("a", { x: 0, y: 0 })]);
    expect(ordered.map((i) => i.id)).toEqual(["a", "b"]);
  });
});

describe("the deck is the marked slides, or everything", () => {
  const marked = canvasOf([
    item("a", { x: 0, y: 0 }, asSlide),
    item("b", { x: 150, y: 0 }),
    item("c", { x: 300, y: 0 }, asSlide),
  ]);

  it("marking narrows the walk", () => {
    expect(slides(marked).map((i) => i.id)).toEqual(["a", "c"]);
    expect(deck(marked).map((i) => i.id)).toEqual(["a", "c"]);
  });

  it("with nothing marked, every item is a slide — the feature works before setup", () => {
    const bare = canvasOf([item("b", { x: 150, y: 0 }), item("a", { x: 0, y: 0 })]);
    expect(slides(bare)).toEqual([]);
    expect(deck(bare).map((i) => i.id)).toEqual(["a", "b"]);
  });
});

describe("flipping", () => {
  const canvas = canvasOf([
    item("a", { x: 0, y: 0 }, asSlide),
    item("b", { x: 150, y: 0 }),
    item("c", { x: 300, y: 0 }, asSlide),
  ]);

  it("steps forward and back through the deck, skipping the unmarked", () => {
    expect(deckStep(canvas, "a", 1)?.id).toBe("c");
    expect(deckStep(canvas, "c", -1)?.id).toBe("a");
  });

  it("stays put at the edge rather than wrapping", () => {
    // The same answer the spatial walk gives at the canvas's edge — a talk
    // that loops back to slide one on an extra click is a talk restarted.
    expect(deckStep(canvas, "c", 1)).toBeNull();
    expect(deckStep(canvas, "a", -1)).toBeNull();
  });

  it("standing outside the deck, a flip steps into it", () => {
    // An unmarked item opened full screen while slides exist: forward lands
    // on the first slide, back on the last, rather than doing nothing.
    expect(deckStep(canvas, "b", 1)?.id).toBe("a");
    expect(deckStep(canvas, "b", -1)?.id).toBe("c");
  });

  it("an empty canvas has nowhere to go", () => {
    expect(deckStep(canvasOf([]), "a", 1)).toBeNull();
  });
});

/**
 * **A gesture on a SELECTION, where the wrong answer loses work.**
 *
 * Reported from the app: ten screens selected, "make a slide" refused —
 * the menu entry was `disabled` for anything over one, so a deck had to be
 * marked one item at a time. `isocan slides add <items...>` had taken many
 * since the day it shipped and skipped the ones already marked, so this was
 * a rule the CLI enforced that the app did not know: a habit, not a rule.
 *
 * The half that needs care is MIXED. Reading "some are on" as "turn them all
 * off" throws away marks somebody deliberately made, so mixed turns ON — the
 * answer a tri-state checkbox gives, and the one the CLI already gave.
 */
describe("marking a whole selection", () => {
  const on = (id: string) => item(id, { x: 0, y: 0 }, asSlide);
  const off = (id: string) => item(id, { x: 0, y: 0 });

  it("turns a selection of none-marked ON", () => {
    const intent = slideIntent([off("a"), off("b")]);
    expect(intent.on).toBe(true);
    expect(intent.changing.map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("turns a MIXED selection on, and moves only the ones that need it", () => {
    // The case that decides the design: six already slides, four not.
    const intent = slideIntent([on("a"), off("b"), on("c"), off("d")]);
    expect(intent.on).toBe(true);
    expect(intent.changing.map((i) => i.id)).toEqual(["b", "d"]);
  });

  it("turns off only when every one of them is already a slide", () => {
    const intent = slideIntent([on("a"), on("b")]);
    expect(intent.on).toBe(false);
    expect(intent.changing.map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("moves the single item it is given, in whichever direction it is not", () => {
    // A selection of one is a plain toggle, both ways — which is the entry
    // people already had, unchanged.
    expect(slideIntent([off("a")])).toMatchObject({ on: true });
    expect(slideIntent([off("a")]).changing.map((i) => i.id)).toEqual(["a"]);
    expect(slideIntent([on("a")])).toMatchObject({ on: false });
    expect(slideIntent([on("a")]).changing.map((i) => i.id)).toEqual(["a"]);
  });

  it("has nothing to do with an empty selection, and says so rather than turning on", () => {
    // `every` on an empty array is true, so a naive rule would read "all are
    // slides" and answer "turn them all off" — of nothing. The caller checks
    // `changing` before it writes; this keeps that check from being the only
    // thing standing between a stray gesture and a pile of no-op ops.
    expect(slideIntent([]).changing).toEqual([]);
  });

  it("agrees with the CLI, which skips what is already right", () => {
    // `slides add` prints "is already a slide" and continues. The app must
    // reach the same end state from the same selection.
    const selection = [on("a"), off("b")];
    const { on: turningOn, changing } = slideIntent(selection);
    expect(turningOn).toBe(true);
    expect(changing.every((i) => !isSlide(i))).toBe(true);
  });
});
