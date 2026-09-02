import { describe, expect, it } from "vitest";
import type { CanvasContents, CommentThread, Item } from "../src/model.ts";
import { AREA_KIND } from "../src/area.ts";
import {
  BOARD_GAP,
  BOARD_PROP,
  BRIEF_PROP,
  PHASES,
  SPRINT_BOARD,
  boardArea,
  boardAreaFor,
  boardLayout,
  boardOf,
  briefCard,
  briefItem,
  sprintState,
} from "../src/sprint.ts";

/**
 * **The board** (sprint phase 1, `docs/projects/sprint/journey.md` Scene 0):
 * one sheet per stretch of the week, as data both surfaces lay identically;
 * every phase knows its sheet; the brief is one card with a history.
 */

const item = (id: string, props: Record<string, string> = {}, box = { x: 0, y: 0, width: 100, height: 100 }, title = id): Item =>
  ({ id, title, ...box, properties: props, reactions: {}, versions: [], currentVersionId: "v" }) as unknown as Item;

const chat = (bodies: string[]): CommentThread =>
  ({
    id: "thr_chat",
    x: 0,
    y: 0,
    anchorItemId: null,
    main: true,
    comments: bodies.map((body, i) => ({
      id: `c${i}`,
      author: { id: "kit", name: "Kit" },
      body,
      createdAt: "2026-09-02T10:00:00.000Z",
    })),
  }) as unknown as CommentThread;

const canvasOf = (items: Item[], thread?: CommentThread): CanvasContents =>
  ({
    items: Object.fromEntries(items.map((i) => [i.id, i])),
    threads: thread ? { [thread.id]: thread } : {},
    trash: [],
    agents: {},
  }) as unknown as CanvasContents;

describe("the board is the week, in order", () => {
  it("has a sheet for every phase, and every sheet is some phase's", () => {
    const keys = new Set(SPRINT_BOARD.map((one) => one.key));
    for (const phase of PHASES) expect(keys.has(phase.area), `${phase.name} has no sheet`).toBe(true);
    // Every sheet but one is some phase's. The Brief is done before the
    // first bell, so no phase happens on it — it is the one sheet with no
    // clock, on purpose.
    const used = new Set(PHASES.map((phase) => phase.area));
    for (const sheet of SPRINT_BOARD) {
      if (sheet.key === "brief") continue;
      expect(used.has(sheet.key), `${sheet.title} is nobody's sheet`).toBe(true);
    }
    expect(used.has("brief")).toBe(false);
  });

  it("reads as a story: brief first, wrap last, sketches before the vote", () => {
    const order = SPRINT_BOARD.map((one) => one.key);
    expect(order[0]).toBe("brief");
    expect(order[order.length - 1]).toBe("wrap");
    expect(order.indexOf("sketches")).toBeLessThan(order.indexOf("vote"));
    expect(order.indexOf("vote")).toBeLessThan(order.indexOf("storyboard"));
  });

  it("every sheet carries a card that says what happens there", () => {
    for (const sheet of SPRINT_BOARD) {
      expect(sheet.card.length, `${sheet.title}'s card`).toBeGreaterThan(40);
      expect(sheet.title.length).toBeGreaterThan(0);
    }
    expect(boardArea("vote").title).toBe("Vote");
  });

  it("lays out one row, top-aligned, a gap between, from the origin", () => {
    const laid = boardLayout({ x: 1000, y: 500 });
    expect(laid[0]).toMatchObject({ key: "brief", x: 1000, y: 500 });
    for (let i = 1; i < laid.length; i++) {
      const prev = laid[i - 1]!;
      expect(laid[i]!.x).toBe(prev.x + prev.width + BOARD_GAP);
      expect(laid[i]!.y).toBe(500);
    }
  });
});

describe("a phase knows its sheet", () => {
  const sheets = boardLayout({ x: 0, y: 0 }).map((one) =>
    item(`area_${one.key}`, { kind: AREA_KIND, [BOARD_PROP]: one.key }, { x: one.x, y: one.y, width: one.width, height: one.height }, one.title),
  );

  it("finds a sheet by its board key, not its title — a renamed sheet is still the sheet", () => {
    const renamed = { ...sheets[6]!, title: "The wall" };
    const canvas = canvasOf([...sheets.slice(0, 6), renamed, ...sheets.slice(7)]);
    expect(boardAreaFor(canvas, "vote")?.title).toBe("The wall");
    expect(boardOf(canvas).map((one) => one.properties[BOARD_PROP])).toEqual(SPRINT_BOARD.map((one) => one.key));
  });

  it("is carried in the sprint's state, and is null with no board", () => {
    const withBoard = canvasOf(sheets, chat(["/sprint hmw 10m"]));
    expect(sprintState(withBoard)?.area?.title).toBe("Experts & HMW");
    const noBoard = canvasOf([], chat(["/sprint hmw 10m"]));
    expect(sprintState(noBoard)?.area).toBeNull();
  });

  it("ignores a plain item wearing the key — only an area is a sheet", () => {
    const impostor = item("note", { kind: "text", [BOARD_PROP]: "vote" });
    expect(boardAreaFor(canvasOf([impostor]), "vote")).toBeNull();
  });
});

describe("the brief is one card", () => {
  it("writes what was answered and leaves out what was not", () => {
    const card = briefCard({ goal: "Sign-up feels like ten seconds", questions: ["Can we skip the password?"], decider: "Maya" });
    expect(card).toContain("**Goal.** Sign-up feels like ten seconds");
    expect(card).toContain("- Can we skip the password?");
    expect(card).toContain("**Decider.** Maya");
    expect(card).not.toContain("Sketching");
    expect(card).not.toContain("TBD");
  });

  it("is found by its property, so the next write is a version and not a second card", () => {
    const brief = item("b", { kind: "text", [BRIEF_PROP]: "1" }, undefined, "Brief");
    expect(briefItem(canvasOf([brief, item("other", { kind: "text" })]))?.id).toBe("b");
    expect(briefItem(canvasOf([item("other", { kind: "text" })]))).toBeNull();
  });
});
