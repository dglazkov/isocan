import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { workbenchItemPath, workbenchPath, workbenchUrl } from "@isocan/core";


const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

/**
 * The workbench's standing constraints, held as tests rather than as
 * sentences in the design doc.
 *
 * The doc's headline finding was that the agent room costs ZERO new
 * operations — everything in it is a projection of presence, canvas state
 * and the one main thread, and its only write path is the composer, which is
 * the same component the canvas docks. These tests are what keep that
 * finding true after the doc stops being read.
 */
describe("the workbench writes only where the design says it may", () => {
  const workbench = read("../src/components/Workbench.tsx");
  const stage = read("../src/components/ArtifactStage.tsx");
  const editor = read("../src/components/StageEditor.tsx");

  it("sends no operations from the room or the stage frame", () => {
    // The composer writes — through MainThreadBody, the same component the
    // canvas docks. The editor writes — one op, below. Everything else in
    // the workbench is a projection and must stay one.
    expect(workbench).not.toContain("sendOp");
    expect(workbench).not.toContain("applyLocalEcho");
    expect(stage).not.toContain("sendOp");
  });

  it("lets the editor send exactly one kind of op: a version", () => {
    // ⌘S is `item.addVersion` — the identical op `isocan edit` sends, which
    // is the whole isomorphism of the editor. A second op type appearing
    // here is a product decision that belongs in the design doc first.
    const ops = [...editor.matchAll(/type:\s*"([a-z]+\.[a-zA-Z]+)"/g)].map((m) => m[1]);
    expect(ops).toEqual(["item.addVersion"]);
  });

  it("keeps the draft preview sandboxed to the one flag item frames get", () => {
    // srcdoc inherits nothing: `allow-scripts` alone is an opaque origin —
    // no cookie, no API, nothing to exfiltrate to (content-origin.md). Any
    // second token here is the loosening that doc exists to prevent.
    expect(editor).toMatch(/sandbox="allow-scripts"/);
    expect(editor).not.toMatch(/allow-same-origin/);
  });

  it("renders the main thread through the shared component, never a copy", () => {
    expect(workbench).toContain("MainThreadBody");
    expect(workbench).not.toContain("postToMain");
  });

  it("builds every address from core's one spelling", () => {
    // address.test.ts sweeps the whole source for hand-spelled paths; this
    // asserts the positive half — the workbench actually imports the
    // builders it navigates with.
    for (const name of ["workbenchPath", "workbenchItemPath", "workbenchUrl"]) {
      expect(workbench).toContain(name);
    }
  });

  it("shares the stage with full screen — one renderer, two addresses", () => {
    // The two-products tell: the same artifact rendering differently at
    // /i/:itemId and /w/:itemId. Both frames must mount ArtifactStage.
    expect(workbench).toContain("<ArtifactStage");
    expect(read("../src/components/FullScreen.tsx")).toContain("<ArtifactStage");
  });

  it("never classifies a status string into a semantic badge", () => {
    // The design doc bans string-matching lifecycle copy ("waiting for
    // you…") into a PARKED state until statusSource crosses the wire. The
    // verbatim string is honest; a badge built from it is a lie waiting for
    // the day the copy changes.
    expect(workbench).not.toContain("waiting for you");
  });
});

describe("the workbench address family", () => {
  it("builds both levels, and the url form takes the item optionally", () => {
    expect(workbenchPath("prj_1")).toBe("/p/prj_1/w");
    expect(workbenchItemPath("prj_1", "itm_2")).toBe("/p/prj_1/w/itm_2");
    expect(workbenchUrl("https://isocan.io", "prj_1")).toBe("https://isocan.io/p/prj_1/w");
    expect(workbenchUrl("https://isocan.io/", "prj_1", "itm_2")).toBe(
      "https://isocan.io/p/prj_1/w/itm_2",
    );
  });

  it("escapes an id the way the item route does", () => {
    expect(workbenchItemPath("prj_1", "itm/odd")).toBe("/p/prj_1/w/itm%2Fodd");
  });
});

/**
 * The stage's two panes — toggles, not tabs.
 *
 * It shipped as Preview/Edit/Split tabs and they lasted a day: three names
 * for the states of two switches, with a default that hid the editor. The
 * rules that replaced them, frozen here: an editable artifact opens with
 * BOTH panes; each collapses from its own control, which stays put as the
 * way back; and the stage never shows nothing — the sole open pane's toggle
 * goes inert rather than leaving a blank.
 */
describe("the stage's panes", () => {
  const stage = read("../src/components/ArtifactStage.tsx");

  it("defaults to both panes open", () => {
    expect(stage).toContain("return { preview: true, edit: true };");
  });

  it("refuses the empty stage", () => {
    expect(stage).toMatch(/if \(!next\.preview && !next\.edit\) return;/);
  });

  it("keeps the way back where the way out was", () => {
    // Toggles with pressed state, never a tab strip: the control that
    // collapsed a pane is the control that reopens it.
    expect(stage).toContain("aria-pressed={showPreview}");
    expect(stage).toContain("aria-pressed={showEdit}");
    expect(stage).not.toMatch(/role="tablist"/);
  });
});
