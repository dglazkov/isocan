import { describe, expect, it } from "vitest";
import type { CanvasContents, Item } from "../src/index.ts";
import {
  deniedIn,
  findMoodBoard,
  IMAGE_MODEL_DEFAULT,
  imageModel,
  isMoodBoardItem,
  isMoodDial,
  MOOD_AXES,
  MOOD_BOARD_TITLE,
  MOOD_DIALS,
  MOOD_MORE_N,
  MOOD_PROPS,
  MOOD_TILE,
  moodCostLine,
  moodDropOps,
  moodKeepPlan,
  moodPrompt,
  moodPushPrompt,
  moodTray,
  moodTrays,
  moodWordsFromPrompt,
  spreadAxes,
} from "../src/mood.ts";

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

describe("the push dials and word extraction", () => {
  it("recognises the eight dials and refuses everything else", () => {
    expect(MOOD_DIALS).toEqual(["warmer", "cooler", "quieter", "louder", "older", "newer", "rougher", "finer"]);
    expect(MOOD_MORE_N).toBe(4);
    for (const dial of MOOD_DIALS) expect(isMoodDial(dial)).toBe(true);
    for (const bad of ["", "brighter", "warmer ", null, 7]) expect(isMoodDial(bad)).toBe(false);
  });

  it("wraps push directions with concrete visual terms and keeps the non-UI safety rules", () => {
    for (const dial of MOOD_DIALS) {
      const prompt = moodPushPrompt("a quiet bakery at dawn", dial, "the quality of the light");
      expect(prompt).toContain("about: a quiet bakery at dawn.");
      expect(prompt).toContain(`Push the look ${dial}:`);
      expect(prompt).toContain("Reach for the quality of the light.");
      expect(prompt).toContain("not a user interface, not a screen, no text overlays");
      expect(prompt).toContain("No logos, no brands, no recognisable people");
      expect(moodWordsFromPrompt(prompt)).toBe("a quiet bakery at dawn");
    }
    expect(moodWordsFromPrompt(moodPrompt("brushed steel watch workshop", "texture, seen up close"))).toBe("brushed steel watch workshop");
    expect(moodWordsFromPrompt(undefined, "Acme studio photo — reference")).toBe("Acme studio photo");
    expect(moodWordsFromPrompt("", "")).toBe("reference study");
  });
});

describe("the Mood board, keep, drop, and tray runs", () => {
  const maya = { id: "act_maya", name: "Acme Maya" };
  const makeItem = (id: string, x: number, y: number, properties: Record<string, string> = {}, extra: Partial<Item> = {}): Item =>
    ({
      id,
      title: `Tile ${id}`,
      description: "",
      x,
      y,
      width: 320,
      height: 320,
      properties,
      versions: [{ id: `ver_${id}`, blobHash: `hash_${id}`, mimeType: "image/png", filename: `${id}.png`, size: 100, createdAt: "2026-10-17T10:00:00.000Z", createdBy: maya }],
      currentVersionId: `ver_${id}`,
      createdAt: "2026-10-17T10:00:00.000Z",
      createdBy: maya,
      updatedAt: "2026-10-17T10:00:00.000Z",
      updatedBy: maya,
      ...extra,
    }) as Item;
  const makeCanvas = (items: Item[]): CanvasContents =>
    ({ items: Object.fromEntries(items.map((i) => [i.id, i])), threads: {}, trash: [], marks: {} }) as unknown as CanvasContents;

  it("finds a Mood board on both legacy areas and group-mode groups", () => {
    const legacyBoard = makeItem("itm_board_a", 0, 0, { kind: "area", [MOOD_PROPS.board]: "true" });
    const groupBoard = makeItem("itm_board_g", 0, 0, { kind: "group", [MOOD_PROPS.board]: "true" });
    const ordinary = makeItem("itm_plain", 0, 0, { kind: "area" });
    expect(isMoodBoardItem(legacyBoard)).toBe(true);
    expect(isMoodBoardItem(groupBoard)).toBe(true);
    expect(isMoodBoardItem(ordinary)).toBe(false);
    expect(findMoodBoard(makeCanvas([ordinary, legacyBoard]))?.id).toBe("itm_board_a");
    expect(findMoodBoard(makeCanvas([ordinary]))).toBeNull();
  });

  it("creates the Mood board on first Keep and reuses it on later Keeps (legacy and group mode)", () => {
    const tile1 = makeItem("itm_t1", 100, 100, { [MOOD_PROPS.mood]: "candidate", [MOOD_PROPS.run]: "mood_1" });
    const tile2 = makeItem("itm_t2", 460, 100, { [MOOD_PROPS.mood]: "candidate", [MOOD_PROPS.run]: "mood_1" });
    const legacy = moodKeepPlan({
      canvas: makeCanvas([tile1, tile2]),
      groupMode: "legacy",
      itemIds: ["itm_t1", "itm_t2"],
      boardBlob: { blobHash: "hash_board", size: 1 },
      newBoardId: "itm_mood_board",
    });
    expect(legacy.createdBoard).toBe(true);
    expect(legacy.boardId).toBe("itm_mood_board");
    expect(legacy.ops[0]).toMatchObject({
      type: "item.add",
      itemId: "itm_mood_board",
      title: MOOD_BOARD_TITLE,
      properties: { kind: "area", [MOOD_PROPS.board]: "true" },
    });
    expect(legacy.ops.filter((op) => op.type === "item.update")).toEqual([
      { type: "item.update", itemId: "itm_t1", patch: { properties: { [MOOD_PROPS.mood]: "kept" } } },
      { type: "item.update", itemId: "itm_t2", patch: { properties: { [MOOD_PROPS.mood]: "kept" } } },
    ]);

    const grouped = moodKeepPlan({
      canvas: makeCanvas([tile1, tile2]),
      groupMode: "groups",
      itemIds: ["itm_t1", "itm_t2"],
      boardBlob: { blobHash: "hash_board", size: 1 },
      newBoardId: "itm_group_board",
    });
    expect(grouped.createdBoard).toBe(true);
    expect(grouped.ops[0]).toMatchObject({
      type: "group.change",
      action: { kind: "create", group: { id: "itm_group_board", title: MOOD_BOARD_TITLE, properties: { [MOOD_PROPS.board]: "true" } } },
    });
    expect(grouped.ops[1]).toMatchObject({
      type: "group.change",
      action: { kind: "reparent", containerId: "itm_group_board", itemIds: ["itm_t1", "itm_t2"], place: true },
    });

    const board = makeItem("itm_group_board", 900, 100, { kind: "group", [MOOD_PROPS.board]: "true" }, { width: 1200, height: 840 });
    const reused = moodKeepPlan({
      canvas: makeCanvas([board, tile1]),
      groupMode: "groups",
      itemIds: ["itm_t1"],
    });
    expect(reused.createdBoard).toBe(false);
    expect(reused.boardId).toBe("itm_group_board");
    expect(reused.ops.some((op) => op.type === "group.change" && op.action.kind === "create")).toBe(false);
  });

  it("drops named tiles or all remaining candidates in a run, leaving kept tiles untouched", () => {
    const c1 = makeItem("itm_c1", 0, 0, { [MOOD_PROPS.mood]: "candidate", [MOOD_PROPS.run]: "mood_1" });
    const c2 = makeItem("itm_c2", 340, 0, { [MOOD_PROPS.mood]: "candidate", [MOOD_PROPS.run]: "mood_1" });
    const k1 = makeItem("itm_k1", 680, 0, { [MOOD_PROPS.mood]: "kept", [MOOD_PROPS.run]: "mood_1" });
    const other = makeItem("itm_c3", 0, 400, { [MOOD_PROPS.mood]: "candidate", [MOOD_PROPS.run]: "mood_2" });
    const canvas = makeCanvas([c1, c2, k1, other]);

    const byRun = moodDropOps(canvas, { run: "mood_1" });
    expect(byRun.droppedIds).toEqual(["itm_c1", "itm_c2"]);
    expect(byRun.ops).toEqual([{ type: "items.delete", itemIds: ["itm_c1", "itm_c2"] }]);

    const single = moodDropOps(canvas, { itemIds: ["itm_c3"] });
    expect(single.droppedIds).toEqual(["itm_c3"]);
    expect(single.ops).toEqual([{ type: "item.delete", itemId: "itm_c3" }]);

    const trays = moodTrays(canvas);
    expect(trays.map((t) => ({ run: t.run, candidates: t.candidates.length, kept: t.kept.length }))).toEqual([
      { run: "mood_1", candidates: 2, kept: 1 },
      { run: "mood_2", candidates: 1, kept: 0 },
    ]);
  });
});
