import { describe, expect, it } from "vitest";
import type { CanvasContents } from "@isocan/core";
import { designGovernsNotes, designReleasedNotes, designScopeNotes } from "../src/design-scope-notes.ts";

/**
 * **Moving a design system into a group says what it now governs**
 * (wireframes phase 8 — Porchlight's #7: `isocan mv <DESIGN.md> --in Brand`
 * silently left forty-eight wires governed by nothing). Synthetic canvas.
 */
describe("designScopeNotes", () => {
  const group = { id: "grp_brand", title: "Brand", description: "", properties: { kind: "group" }, x: -50, y: -50, width: 500, height: 500, updatedAt: "2026-09-23", currentVersionId: "", versions: [] };
  const design = { id: "itm_design", title: "DESIGN.md", description: "", properties: { role: "design-system" }, x: 0, y: 0, width: 100, height: 100, updatedAt: "2026-09-23", currentVersionId: "", versions: [] };

  it("names the group it now governs alone, and that nothing governs the rest of the canvas", () => {
    const canvas = { items: { itm_design: { ...design, containerId: "grp_brand" }, grp_brand: group }, threads: {}, trash: [] } as unknown as CanvasContents;
    expect(designScopeNotes(canvas, [{ itemId: "itm_design", parentBefore: null, parentAfter: "grp_brand" }])).toEqual([
      "“DESIGN.md” is a design system: it governed the whole canvas, and now governs only the group “Brand”. Nothing governs the rest of the canvas now — moving it back out of the group restores that.",
    ]);
  });

  it("names the system still governing the rest, when there is one", () => {
    const other = { ...design, id: "itm_other", title: "Acme DESIGN.md" };
    const canvas = { items: { itm_design: { ...design, containerId: "grp_brand" }, grp_brand: group, itm_other: other }, threads: {}, trash: [] } as unknown as CanvasContents;
    expect(designScopeNotes(canvas, [{ itemId: "itm_design", parentBefore: null, parentAfter: "grp_brand" }])[0]).toMatch(/The rest of the canvas is governed by “Acme DESIGN\.md”\.$/);
  });

  it("says moving it out makes it the canvas's again; an ordinary item moving says nothing", () => {
    const canvas = { items: { itm_design: design, grp_brand: group }, threads: {}, trash: [] } as unknown as CanvasContents;
    expect(designScopeNotes(canvas, [{ itemId: "itm_design", parentBefore: "grp_brand", parentAfter: null }])).toEqual([
      "“DESIGN.md” is a design system: it governed only the group “Brand”, and now governs the whole canvas.",
    ]);
    expect(designScopeNotes(canvas, [{ itemId: "grp_brand", parentBefore: null, parentAfter: "grp_x" }])).toEqual([]);
  });
});

/**
 * **Writing or choosing a system says what it governs too** — `design set`,
 * `import` and `use` print these, the sentence a move already printed.
 */
describe("designGovernsNotes and designReleasedNotes", () => {
  const group = { id: "grp_brand", title: "Brand", description: "", properties: { kind: "group" }, x: -50, y: -50, width: 500, height: 500, updatedAt: "2026-09-23", currentVersionId: "", versions: [] };
  const design = { id: "itm_design", title: "DESIGN.md", description: "", properties: { role: "design-system" }, x: 0, y: 0, width: 100, height: 100, updatedAt: "2026-09-23", currentVersionId: "", versions: [] };
  const canvasOf = (items: Record<string, unknown>) => ({ items, threads: {}, trash: [] }) as unknown as CanvasContents;

  it("a system at the root governs the whole canvas, and names the groups that keep their own", () => {
    const lane = { ...design, id: "itm_lane", title: "Brand DESIGN.md", containerId: "grp_brand" };
    expect(designGovernsNotes(canvasOf({ itm_design: design, grp_brand: group, itm_lane: lane }), "itm_design")).toEqual([
      "“DESIGN.md” is a design system: it governs the whole canvas. The group “Brand” keeps its own.",
    ]);
  });

  it("a system in a group governs it alone, and says what governs the rest", () => {
    const lane = { ...design, containerId: "grp_brand" };
    expect(designGovernsNotes(canvasOf({ itm_design: lane, grp_brand: group }), "itm_design")).toEqual([
      "“DESIGN.md” is a design system: it governs only the group “Brand”. Nothing governs the rest of the canvas.",
    ]);
  });

  it("two at one level say which one wins", () => {
    const older = { ...design, id: "itm_old", title: "Old DESIGN.md", updatedAt: "2026-09-01" };
    expect(designGovernsNotes(canvasOf({ itm_design: design, itm_old: older }), "itm_design")[0]).toMatch(/2 systems sit at this level; the newest wins, which is “DESIGN\.md”\.$/);
  });

  it("an ordinary item says nothing", () => {
    expect(designGovernsNotes(canvasOf({ grp_brand: group }), "grp_brand")).toEqual([]);
  });

  it("a released system says what governs its scope now, or that nothing does", () => {
    const plain = { ...design, properties: {} };
    const other = { ...design, id: "itm_other", title: "Acme DESIGN.md" };
    expect(designReleasedNotes(canvasOf({ itm_design: plain, itm_other: other }), "itm_design", null)).toEqual([
      "“DESIGN.md” no longer governs the whole canvas. The canvas is governed by “Acme DESIGN.md” now.",
    ]);
    expect(designReleasedNotes(canvasOf({ itm_design: { ...plain, containerId: "grp_brand" }, grp_brand: group }), "itm_design", "grp_brand")).toEqual([
      "“DESIGN.md” no longer governs only the group “Brand”. Nothing governs “Brand” now — `isocan design use itm_design` puts it back.",
    ]);
  });
});
