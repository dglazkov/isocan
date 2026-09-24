import { describe, expect, it } from "vitest";
import type { CanvasContents } from "@isocan/core";
import { designScopeNotes } from "../src/design-scope-notes.ts";

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
