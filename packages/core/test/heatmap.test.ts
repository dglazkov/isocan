import { describe, expect, it } from "vitest";
import type { CanvasContents, CommentThread, Item } from "../src/model.ts";
import { OpValidationError, applyOperation, invertOperation } from "../src/index.ts";
import { AREA_KIND } from "../src/area.ts";
import { reactionPointsOf } from "../src/reactions.ts";
import { BOARD_PROP, sprintState, wallFor } from "../src/sprint.ts";
import { alice, apply, bob, envelope, seedState } from "./helpers.ts";

/**
 * **A vote that is also a picture** (sprint phase 4). A reaction may carry
 * a point on the item — the heat map's dot — as fractions of the box; the
 * wall a vote is about is the Vote sheet when a board is laid; and undo
 * puts a dot back without the inverter knowing whose it was.
 */
describe("a reaction placed on a part of the item", () => {
  it("keeps the point beside the set, per actor, as fractions of the box", () => {
    let s = seedState();
    s = apply(s, { type: "item.react", itemId: "itm_1", emoji: "🔴", on: true, at: { x: 0.25, y: 0.75 } }, alice)!;
    s = apply(s, { type: "item.react", itemId: "itm_1", emoji: "🔴", on: true }, bob)!;
    const item = s.canvas.items.itm_1!;
    expect(item.reactions?.["🔴"]).toEqual([alice.id, bob.id]);
    expect(reactionPointsOf(item, "🔴")).toEqual([{ actorId: alice.id, x: 0.25, y: 0.75 }]);
  });

  it("moves the dot on a second placement — one vote, wherever it was last put", () => {
    let s = seedState();
    s = apply(s, { type: "item.react", itemId: "itm_1", emoji: "🔴", on: true, at: { x: 0.2, y: 0.2 } }, alice)!;
    s = apply(s, { type: "item.react", itemId: "itm_1", emoji: "🔴", on: true, at: { x: 0.8, y: 0.8 } }, alice)!;
    const item = s.canvas.items.itm_1!;
    expect(item.reactions?.["🔴"]).toEqual([alice.id]);
    expect(reactionPointsOf(item, "🔴")).toEqual([{ actorId: alice.id, x: 0.8, y: 0.8 }]);
  });

  it("refuses a point off the item", () => {
    const s = seedState();
    expect(() =>
      applyOperation(s, envelope({ type: "item.react", itemId: "itm_1", emoji: "🔴", on: true, at: { x: 1.5, y: 0 } })),
    ).toThrow(OpValidationError);
  });

  it("is not a dot once the mark is off — and is again when undo puts the mark back", () => {
    let s = seedState();
    s = apply(s, { type: "item.react", itemId: "itm_1", emoji: "🔴", on: true, at: { x: 0.5, y: 0.5 } }, alice)!;
    const off = { type: "item.react", itemId: "itm_1", emoji: "🔴", on: false } as const;
    const inverse = invertOperation(s, off)!;
    s = apply(s, off, alice)!;
    expect(reactionPointsOf(s.canvas.items.itm_1!, "🔴")).toEqual([]);
    // The inverter never knew whose dot it was; the reducer kept the point.
    expect(inverse).toEqual({ type: "item.react", itemId: "itm_1", emoji: "🔴", on: true });
    s = apply(s, inverse, alice)!;
    expect(reactionPointsOf(s.canvas.items.itm_1!, "🔴")).toEqual([{ actorId: alice.id, x: 0.5, y: 0.5 }]);
  });
});

const item = (id: string, props: Record<string, string> = {}, box = { x: 0, y: 0, width: 100, height: 100 }): Item =>
  ({ id, title: id, ...box, properties: props, reactions: {}, versions: [], currentVersionId: "v" }) as unknown as Item;

const chat = (bodies: string[]): CommentThread =>
  ({
    id: "thr_chat",
    x: 0,
    y: 0,
    anchorItemId: null,
    main: true,
    comments: bodies.map((body, i) => ({ id: `c${i}`, author: { id: "kit", name: "Kit" }, body, createdAt: "2026-09-02T10:00:00.000Z" })),
  }) as unknown as CommentThread;

const canvasOf = (items: Item[], thread: CommentThread): CanvasContents =>
  ({ items: Object.fromEntries(items.map((i) => [i.id, i])), threads: { [thread.id]: thread }, trash: [], agents: {} }) as unknown as CanvasContents;

describe("the wall is the Vote sheet when a board is laid", () => {
  const vote = item("vote", { kind: AREA_KIND, [BOARD_PROP]: "vote" }, { x: 0, y: 0, width: 2000, height: 1000 });
  const onSheet = item("s1", { sprint: "sketch" }, { x: 100, y: 300, width: 200, height: 200 });
  const offSheet = item("s2", { sprint: "sketch" }, { x: 5000, y: 5000, width: 200, height: 200 });
  const brief = item("brief", {}, { x: 9000, y: 0, width: 200, height: 200 });
  const talk = chat(["/sprint sketch", "/sprint heatmap"]);

  it("counts what is on the sheet and nothing else — a note on the Brief is not on the wall", () => {
    const canvas = canvasOf([vote, onSheet, offSheet, brief], talk);
    expect(wallFor(canvas, sprintState(canvas)!).map((one) => one.id)).toEqual(["s1"]);
  });

  it("falls back to the hand-ins when the sheet is empty, and to everything without a board", () => {
    const empty = canvasOf([vote, offSheet, brief], talk);
    expect(wallFor(empty, sprintState(empty)!).map((one) => one.id)).toEqual(["s2"]);
    const noBoard = canvasOf([brief], chat(["/sprint heatmap"]));
    expect(wallFor(noBoard, sprintState(noBoard)!).map((one) => one.id)).toEqual(["brief"]);
  });
});
