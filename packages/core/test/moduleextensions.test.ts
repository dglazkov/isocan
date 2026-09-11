import { afterEach, describe, expect, it } from "vitest";
import {
  ASSET_MAX_BYTES,
  askTemplate,
  assetProblems,
  contributions,
  designStanding,
  designSystem,
  designSystemProperties,
  dispatchReason,
  governingDesign,
  isDataOnly,
  manifestRecord,
  moduleAsset,
  opTouchesAreas,
  refusedContributions,
  registerModule,
  registerModuleBase,
  roundRunning,
  roundsOn,
  rulesOf,
  scopedDesignSystems,
  unregisterModule,
  type CanvasContents,
  type CoreModule,
  type Item,
  type Operation,
} from "../src/index.ts";

/**
 * **What the design competition asked of the platform** (11 Sep 2026,
 * `docs/projects/design-competition/module-gaps.md`). Each section is one gap,
 * held by what it must do for EVERY module — not by the competition, which
 * has its own tests in its own directory.
 */

const ACTOR = { id: "usr_1", name: "Di" };
const item = (id: string, box: { x: number; y: number; w: number; h: number }, props: Record<string, string> = {}, updatedAt = "2026-09-11T10:00:00.000Z"): Item => ({
  id, x: box.x, y: box.y, width: box.w, height: box.h, title: id, description: "", properties: props,
  versions: [{ id: `v_${id}`, blobHash: "h", mimeType: "text/markdown", filename: `${id}.md`, size: 1, createdAt: updatedAt, createdBy: ACTOR }],
  currentVersionId: `v_${id}`, createdAt: updatedAt, createdBy: ACTOR, updatedAt, updatedBy: ACTOR,
});
const area = (id: string, box: { x: number; y: number; w: number; h: number }) => item(id, box, { kind: "area" });
const canvasOf = (items: Item[]): CanvasContents => ({
  items: Object.fromEntries(items.map((i) => [i.id, i])), threads: {}, trash: [],
});

describe("a design system scoped to an area (gap 4)", () => {
  const laneA = area("laneA", { x: 0, y: 0, w: 1000, h: 1000 });
  const laneB = area("laneB", { x: 2000, y: 0, w: 1000, h: 1000 });
  const inA = item("dsA", { x: 100, y: 100, w: 200, h: 200 }, designSystemProperties(), "2026-09-11T12:00:00.000Z");
  const inB = item("dsB", { x: 2100, y: 100, w: 200, h: 200 }, designSystemProperties(), "2026-09-11T13:00:00.000Z");
  const canvasOwn = item("ds", { x: 5000, y: 0, w: 200, h: 200 }, designSystemProperties(), "2026-09-01T10:00:00.000Z");

  it("no longer lets a lane's DESIGN.md hijack the canvas's own — the bug it fixes", () => {
    // Before: newest wins across the canvas, so dsB (13:00) would have been
    // the canvas's design system. It governs laneB and nothing else.
    const c = canvasOf([laneA, laneB, inA, inB, canvasOwn]);
    expect(designSystem(c)?.id).toBe("ds");
  });

  it("answers per place: the lane's own inside the lane, the canvas's outside", () => {
    const c = canvasOf([laneA, laneB, inA, inB, canvasOwn]);
    expect(designSystem(c, { at: { x: 500, y: 500 } })?.id).toBe("dsA");
    expect(designSystem(c, { at: laneB })?.id).toBe("dsB");
    expect(designSystem(c, { at: { x: 9000, y: 9000 } })?.id).toBe("ds");
  });

  it("falls back to the canvas's own in a lane that has none", () => {
    const empty = area("laneC", { x: 4000, y: 2000, w: 500, h: 500 });
    const c = canvasOf([laneA, inA, canvasOwn, empty]);
    expect(designSystem(c, { at: empty })?.id).toBe("ds");
  });

  it("is null on the canvas when every system is scoped — and the canvas is still not 'owed' one", () => {
    const c = canvasOf([laneA, laneB, inA, inB]);
    expect(designSystem(c)).toBeNull();
    expect(scopedDesignSystems(c).map((s) => s.area.id).sort()).toEqual(["laneA", "laneB"]);
    // A canvas whose lanes all wrote their style down has written it down.
    expect(designStanding(c, 12)).toBe("fine");
  });

  it("governs in the order area → canvas → linked", () => {
    const c = canvasOf([laneA, inA]);
    const linked = [{ canvasId: "prj_x", title: "Brand", canvas: canvasOf([canvasOwn]) }];
    expect(governingDesign(c, linked, { at: laneA })?.item.id).toBe("dsA");
    const outside = governingDesign(c, linked, { at: { x: 9000, y: 9000 } });
    expect(outside?.item.id).toBe("ds");
    expect(outside?.from?.title).toBe("Brand");
  });
});

describe("wait --in: a rule that narrows by where (gap 6)", () => {
  const lane = area("lane", { x: 0, y: 0, w: 1000, h: 1000 });
  const inside = item("screen", { x: 100, y: 100, w: 300, h: 300 });
  const outside = item("elsewhere", { x: 3000, y: 0, w: 300, h: 300 });
  const c = canvasOf([lane, inside, outside]);
  const agent = { actorId: "agt_1", names: [{ id: "agt_1", name: "Road Signs" }], rules: { areas: ["lane"] } };
  const move = (itemId: string): Operation => ({ type: "item.move", itemId, x: 0, y: 0 });

  it("wakes on a change to something in the area, and not elsewhere", () => {
    expect(opTouchesAreas(move("screen"), ["lane"], c)).toBe(true);
    expect(opTouchesAreas(move("elsewhere"), ["lane"], c)).toBe(false);
    expect(dispatchReason(move("screen"), "usr_2", agent, c)).toBe("change");
    expect(dispatchReason(move("elsewhere"), "usr_2", agent, c)).toBeNull();
  });

  it("never wakes on the area itself being moved — it is not in itself", () => {
    expect(opTouchesAreas(move("lane"), ["lane"], c)).toBe(false);
  });

  it("composes with --op: both must hold", () => {
    const rules = { areas: ["lane"], ops: ["thread.*"] };
    expect(dispatchReason(move("screen"), "usr_2", { ...agent, rules }, c)).toBeNull();
  });

  it("is kept when the stored rules are read back — an unread key would silently widen nothing", () => {
    expect(rulesOf({ areas: ["lane"], ops: ["item.*"] })).toEqual({ areas: ["lane"], ops: ["item.*"] });
  });
});

describe("vote rounds a module contributes to the curtain (gap 6)", () => {
  afterEach(() => unregisterModule("@acme/vote"));
  const board = area("board", { x: 0, y: 0, w: 1000, h: 1000 });
  const entry = item("entry", { x: 10, y: 10, w: 100, h: 100 });
  const outsider = item("outsider", { x: 5000, y: 5000, w: 100, h: 100 });

  it("covers what is in its area, running until the bell and not after", () => {
    registerModule({
      name: "@acme/vote",
      rounds: () => [{ areaId: "board", marks: ["🥇", "🔴"], until: "2026-09-11T10:20:00.000Z" }],
    });
    const c = canvasOf([board, entry, outsider]);
    expect(roundsOn(c, entry)).toHaveLength(1);
    expect(roundsOn(c, outsider)).toHaveLength(0);
    const [round] = roundsOn(c, entry);
    expect(roundRunning(round!, Date.parse("2026-09-11T10:19:59.000Z"))).toBe(true);
    expect(roundRunning(round!, Date.parse("2026-09-11T10:20:01.000Z"))).toBe(false);
  });
});

describe("contribution points (gap 2)", () => {
  afterEach(() => {
    for (const name of ["@acme/host", "@acme/pack", "@acme/stray"]) unregisterModule(name);
  });
  const host: CoreModule = {
    name: "@acme/host",
    points: [{ id: "acme.things", describe: "things", validate: (v) => (typeof v === "string" && v.length > 0 ? [] : ["a thing is a non-empty string"]) }],
    contributes: { "acme.things": ["own"] },
  };

  it("reads every accepted value, tagged with the module that gave it", () => {
    registerModule(host);
    registerModule({ name: "@acme/pack", contributes: { "acme.things": ["theirs", ""] } });
    expect(contributions<string>("acme.things")).toEqual([
      { module: "@acme/host", value: "own" },
      { module: "@acme/pack", value: "theirs" },
    ]);
    expect(refusedContributions()).toEqual([{ module: "@acme/pack", point: "acme.things", problems: ["#2: a thing is a non-empty string"] }]);
  });

  it("has nothing to offer when the module that declares the point is gone — removal means removal", () => {
    registerModule({ name: "@acme/stray", contributes: { "acme.things": ["orphan"] } });
    expect(contributions("acme.things")).toEqual([]);
    expect(refusedContributions()[0]?.problems[0]).toMatch(/orphaned, not an error/);
  });

  it("rides the manifest, so a data-only module is known before any code runs", () => {
    const manifest = { name: "@acme/pack", version: "1.0.0", contributes: { "acme.things": ["x"] } };
    expect(isDataOnly(manifest)).toBe(true);
    expect(manifestRecord(manifest).contributes).toEqual({ "acme.things": ["x"] });
    expect(isDataOnly({ ...manifest, web: "dist/web.js" })).toBe(false);
  });
});

describe("what crosses from a canvas to a machine: a template id and some strings (gap 5)", () => {
  it("is nothing at all when the ask names no template", () => {
    expect(askTemplate({})).toEqual({});
  });
  it("takes an id in the template shape and plain string args", () => {
    expect(askTemplate({ template: "design-competition.fighter", args: { pack: "kare", bout: "itm_1" } })).toEqual({
      template: "design-competition.fighter",
      args: { pack: "kare", bout: "itm_1" },
    });
  });
  it("refuses anything shaped like a path, a command or a structure", () => {
    for (const template of ["../../bin/sh", "fighter", "Design.Competition", "a b.c"]) {
      expect(askTemplate({ template }), template).toHaveProperty("error");
    }
    expect(askTemplate({ template: "a.b", args: { pack: { nested: true } } })).toHaveProperty("error");
    expect(askTemplate({ template: "a.b", args: { "../x": "y" } })).toHaveProperty("error");
    expect(askTemplate({ template: "a.b", args: { k: "x".repeat(513) } })).toHaveProperty("error");
  });
});

describe("module assets (gap 1)", () => {
  it("bounds one file and the whole, and keeps every path inside assets/", () => {
    expect(assetProblems([{ path: "assets/a.svg", size: 10 }])).toEqual([]);
    expect(assetProblems([{ path: "assets/big.png", size: ASSET_MAX_BYTES + 1 }])[0]).toMatch(/over the/);
    expect(assetProblems([{ path: "dist/web.js", size: 10 }])[0]).toMatch(/not inside assets/);
    expect(assetProblems([{ path: "assets/../manifest.json", size: 10 }])[0]).toMatch(/not inside assets/);
  });
  it("resolves another module's relative path against where that module lives, and never upward", () => {
    registerModuleBase("@acme/pack", "/modules/pack");
    expect(moduleAsset("@acme/pack", "assets/avatar.svg")).toBe("/modules/pack/assets/avatar.svg");
    expect(moduleAsset("@acme/pack", "../other/secret")).toBeNull();
    expect(moduleAsset("@acme/unknown", "assets/a.svg")).toBeNull();
  });
});
