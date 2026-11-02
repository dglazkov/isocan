import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyOperation, groupAncestors, groupScopeRoots, isGroupItem, resolveGroupOperation } from "@isocan/core";
import type { CanvasState, GroupBox, Operation } from "@isocan/core";
import { presentedCanvas, type PresentationFrame } from "../src/lib/presentation.ts";

/**
 * **Two answers to one question, and which one wins.**
 *
 * Canvas groups and a module's presentation both decide *where an item is and
 * whether it is shown*. Groups lay a member out in a grid; a presentation
 * hands every geometry consumer a disposable view of the same canvas, with
 * items moved and optionally filtered. Neither feature knows the other exists
 * — anatomy's module has no reference to groups anywhere, and the group code
 * has none to presentation — so nothing stops somebody dropping an Anatomy
 * concept into a group tomorrow.
 *
 * When anatomy was rebased onto canvas groups on 13 September the two collided
 * in the same lines of four files, and the merge chose a precedence at each
 * `??`. A precedence decided four times in four places and asserted in none is
 * the shape `docs/reviews/lessons.md` #5 is about: a rule with no home, green
 * whatever the app does. This file is the home.
 *
 * **The rule, stated once.** A presentation transforms the canvas; groups
 * scope within what it shows. Where both would place the same item, the
 * group's laid-out box wins and the presentation does not move it — which is a
 * deliberate answer and not an obviously correct one, because it means a fluid
 * exploration silently skips whatever happens to live in a group. It is
 * written down here so that changing it is a decision somebody makes rather
 * than a line somebody edits.
 */
const actor = { id: "usr_test", name: "Test" };
const ts = "2026-09-13T12:00:00.000Z";
let seq = 0;

const version = (id: string) => ({ id: `ver_${id}`, blobHash: `hash_${id}`, mimeType: "text/markdown", filename: `${id}.md`, size: 12 });
const apply = (state: CanvasState | null, op: Operation): CanvasState =>
  applyOperation(state, { id: `op_${++seq}`, canvasId: state?.project.id ?? "can_test", actor, ts, op })!;

function canvasWithAGroup(): CanvasState {
  let state = apply(null, { type: "project.create", canvasId: "can_test", title: "Acme", groupMode: "groups" });
  for (const [id, box] of [["inside", { x: 100, y: 100, width: 200, height: 200 }], ["outside", { x: 900, y: 900, width: 200, height: 200 }]] as [string, GroupBox][]) {
    state = apply(state, { type: "item.add", itemId: id, ...box, placement: { x: box.x, y: box.y, chosen: true }, version: version(id), properties: {} });
  }
  const op = resolveGroupOperation(state, { type: "group.change", action: { kind: "create", group: { id: "grp", title: "Acme group", version: version("grp") }, itemIds: ["inside"] } }, { actor, ts, opId: `op_${++seq}` });
  return apply(state, op);
}

/** A presentation that would move both items somewhere else entirely. */
const moveBoth = (state: CanvasState): PresentationFrame => ({
  items: {
    inside: { x: 5000, y: 5000, width: 50, height: 50, detail: "full" },
    outside: { x: 6000, y: 6000, width: 60, height: 60, detail: "full" },
  },
  origins: Object.fromEntries(Object.values(state.canvas.items).map((item) => [item.id, { x: item.x, y: item.y }])),
});

describe("a presentation and a group on one canvas", () => {
  it("moves an ungrouped item, which is the ordinary case", () => {
    const state = canvasWithAGroup();
    const view = presentedCanvas(state.canvas, moveBoth(state));
    expect(view.items["outside"]?.x, "nothing about this item is a group's business").toBe(6000);
  });

  it("leaves group membership alone — a view is not a move", () => {
    const state = canvasWithAGroup();
    const view = presentedCanvas(state.canvas, moveBoth(state));
    expect(view.items["inside"]?.containerId, "presentation hands back a view, never an edit").toBe("grp");
    expect(groupAncestors(view, "inside").map((one) => one.id)).toEqual(["grp"]);
  });

  it("scopes within what the presentation shows, in that order", () => {
    // The order CanvasPage and CanvasViewport both use: presentedCanvas first,
    // groupScopeRoots on the result. Reversing it would scope the stored
    // layout and then transform the answer, which is a different canvas.
    const state = canvasWithAGroup();
    const view = presentedCanvas(state.canvas, moveBoth(state));
    expect(groupScopeRoots(view, null).map((one) => one.id).sort()).toEqual(["grp", "outside"]);
    expect(groupScopeRoots(view, "grp").map((one) => one.id)).toEqual(["inside"]);
  });

  it("survives an isolate that drops a group's container", () => {
    /* `isolate` filters the view down to the items a workspace is showing. If
       it keeps a member and drops its group, the scope walk is looking at a
       tree with a hole in it — which must degrade rather than throw, because
       a module chooses what to isolate and the shell cannot vet it. */
    const state = canvasWithAGroup();
    const orphaned: PresentationFrame = {
      isolate: true,
      items: { inside: { x: 10, y: 10, width: 50, height: 50, detail: "full" } },
      origins: { inside: { x: 100, y: 100 } },
    };
    const view = presentedCanvas(state.canvas, orphaned);
    expect(Object.keys(view.items)).toEqual(["inside"]);
    expect(() => groupScopeRoots(view, null), "a hole in the tree is not a crash").not.toThrow();
    expect(() => groupAncestors(view, "inside")).not.toThrow();
  });

  it("gives the group's box the last word, at every site that decides", () => {
    /* Asserted as source because this is where the two features actually meet:
       a `??` in a render path, four times over. If somebody flips one of them,
       the app disagrees with itself about where an item is depending on which
       consumer is asking — and no behavioural test sees that, because each
       half is correct on its own. */
    const here = path.dirname(fileURLToPath(import.meta.url));
    const itemView = readFileSync(path.join(here, "../src/components/ItemView.tsx"), "utf8");
    for (const axis of ["x", "y"]) {
      expect(
        itemView,
        `the group box must precede the presented position on ${axis} — see this file's header for why`,
      ).toContain(`groupBox?.${axis} ?? display.${axis}`);
    }
    for (const size of ["width", "height"]) {
      expect(itemView).toContain(`groupBox?.${size} ?? resize?.${size} ?? display.${size}`);
    }
    for (const file of ["../src/pages/CanvasPage.tsx", "../src/components/CanvasViewport.tsx"]) {
      const source = readFileSync(path.join(here, file), "utf8");
      expect(source, `${file} must present before it scopes`).toMatch(
        /presentedCanvas\([^)]*\)[\s\S]{0,400}groupScopeRoots\(/,
      );
    }
  });

  it("keeps a group item a group item under a presentation", () => {
    const state = canvasWithAGroup();
    const view = presentedCanvas(state.canvas, moveBoth(state));
    expect(isGroupItem(view.items["grp"]!), "a view never changes what a thing IS").toBe(true);
  });
});
