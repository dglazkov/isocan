import { describe, expect, it } from "vitest";
import type { CanvasContents, Item } from "../src/model.ts";
import { contextPieces, contextReport, markedItems } from "../src/context.ts";
import { designSystemProperties } from "../src/designsystem.ts";

/**
 * **"What will an agent actually read when it starts work here?"**
 *
 * Nobody could answer that, including the agents. What makes this stage worth
 * having first is that it STORES NOTHING — every number is counted from the
 * canvas at the moment you ask, so there is no context record that can fall
 * out of step with the thing it describes.
 *
 * These tests are mostly about the one claim that can be wrong in a way that
 * matters: `stale`.
 */
const actor = { id: "usr_1", name: "Di" };
const at = (iso: string) => iso;
const item = (over: Partial<Item> & { id: string }): Item =>
  ({
    x: 0, y: 0, width: 10, height: 10,
    title: over.id, description: "", properties: {},
    versions: [{ id: "v1" }], currentVersionId: "v1",
    createdAt: at("2026-01-01T00:00:00.000Z"), createdBy: actor,
    updatedAt: at("2026-01-01T00:00:00.000Z"), updatedBy: actor,
    ...over,
  }) as unknown as Item;

const canvasOf = (items: Item[], threads: Record<string, unknown> = {}): CanvasContents =>
  ({ items: Object.fromEntries(items.map((i) => [i.id, i])), threads }) as unknown as CanvasContents;

const NOW = Date.parse("2026-02-01T00:00:00.000Z");
const find = (canvas: CanvasContents, name: string, extras = {}) =>
  contextPieces(canvas, extras, NOW).find((p) => p.name === name)!;

describe("a design system is stale against the WORK, not the clock", () => {
  it("is current when nothing has been designed since", () => {
    /**
     * One written a year ago and untouched is perfectly current if nothing
     * has happened since. Ageing on wall-clock time would nag about a system
     * that is exactly right, and a warning that is usually wrong is one
     * people learn to dismiss.
     */
    const design = item({
      id: "itm_design",
      properties: designSystemProperties(),
      updatedAt: at("2025-01-01T00:00:00.000Z"),
    });
    expect(find(canvasOf([design]), "Design system").stale).toBeUndefined();
  });

  it("is stale when the work has moved past it", () => {
    const design = item({
      id: "itm_design",
      properties: designSystemProperties(),
      updatedAt: at("2026-01-01T00:00:00.000Z"),
    });
    const later = [1, 2, 3].map((n) =>
      item({ id: `itm_${n}`, updatedAt: at("2026-01-15T00:00:00.000Z") }),
    );
    const piece = find(canvasOf([design, ...later]), "Design system");
    // A reason, never a bare flag: "3 items have changed" is actionable and
    // "stale: true" is an accusation.
    expect(piece.stale).toContain("3 items have changed");
    expect(piece.fix).toBeTruthy();
  });

  it("does not nag about one or two changes", () => {
    const design = item({
      id: "itm_design",
      properties: designSystemProperties(),
      updatedAt: at("2026-01-01T00:00:00.000Z"),
    });
    const later = item({ id: "itm_1", updatedAt: at("2026-01-15T00:00:00.000Z") });
    expect(find(canvasOf([design, later]), "Design system").stale).toBeUndefined();
  });

  it("says when `design check` is unhappy, which outranks age", () => {
    const design = item({ id: "itm_design", properties: designSystemProperties() });
    const piece = find(canvasOf([design]), "Design system", { designProblems: 2 });
    expect(piece.stale).toContain("2 findings");
  });

  it("says a canvas with screens and no system is missing one", () => {
    const piece = find(canvasOf([item({ id: "a" }), item({ id: "b" })]), "Design system");
    expect(piece.present).toBe(false);
    expect(piece.stale).toContain("nothing says what they should look like");
  });

  it("does not nag an empty canvas about it", () => {
    // Nothing has been designed, so there is nothing to govern. A canvas
    // somebody just made should not open with a complaint.
    expect(find(canvasOf([]), "Design system").stale).toBeUndefined();
  });
});

describe("the rest of what is in context", () => {
  it("counts the Chat, and says when there is none", () => {
    const withChat = canvasOf([], {
      t: { id: "t", main: true, createdAt: at("2026-01-01T00:00:00.000Z"), comments: [{ id: "c", createdAt: at("2026-01-02T00:00:00.000Z") }] },
    });
    expect(find(withChat, "The Chat").size).toBe("1 message");
    expect(find(canvasOf([]), "The Chat").present).toBe(false);
  });

  it("counts the items somebody MARKED, which is the canvas's only 'this matters'", () => {
    const marked = item({ id: "a", reactions: { "👀": ["usr_1"] } });
    expect(markedItems(canvasOf([marked, item({ id: "b" })]))).toHaveLength(1);
    expect(find(canvasOf([marked]), "Marked items").size).toBe("1");
  });

  it("only mentions machine facts when the machine supplied them", () => {
    // The web has no bound directory and no oplog count. A view that listed
    // them as "not here" would be reporting the absence of something that
    // cannot exist on that surface.
    const names = contextPieces(canvasOf([]), {}, NOW).map((p) => p.name);
    expect(names).not.toContain("Bound directory");
    expect(contextPieces(canvasOf([]), { directory: null }, NOW).map((p) => p.name)).toContain(
      "Bound directory",
    );
  });
});

describe("the report a terminal prints", () => {
  it("marks what needs attention and says why underneath", () => {
    const design = item({
      id: "itm_design",
      properties: designSystemProperties(),
      updatedAt: at("2026-01-01T00:00:00.000Z"),
    });
    const later = [1, 2, 3].map((n) => item({ id: `itm_${n}`, updatedAt: at("2026-01-15T00:00:00.000Z") }));
    const text = contextReport(contextPieces(canvasOf([design, ...later]), {}, NOW), NOW);
    expect(text).toMatch(/^! Design system/m);
    expect(text).toContain("3 items have changed since it was last written");
    expect(text).toContain("→ ");
  });

  it("does not print a fix for something that is fine", () => {
    const text = contextReport(contextPieces(canvasOf([item({ id: "a" })]), {}, NOW), NOW);
    const canvasLine = text.split("\n").find((l) => l.includes("The canvas"))!;
    expect(canvasLine).not.toContain("→");
  });
});
