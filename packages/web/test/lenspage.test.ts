import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { rules, withoutComments } from "./cssrules.ts";

/**
 * **A lens is not a canvas, and this is the surface where that is easiest to
 * forget.**
 *
 * It shows things from many canvases on one page, which looks exactly like a
 * canvas — and an item's `x`/`y` belong to the canvas it is on, so there is no
 * true answer to a drag here. `docs/research/2026-08-30-standing-agents.md`
 * names the three ways out and only one is honest: derive the arrangement,
 * store nothing, refuse the drag.
 *
 * The failure this guards against is not a bug that exists today. It is the
 * very reasonable-looking change somebody makes in three months — a tile grid,
 * a saved position, a drag handle — each of which quietly turns this into a
 * second place an item's location is decided.
 */
const src = readFileSync(
  fileURLToPath(new URL("../src/pages/LensPage.tsx", import.meta.url)),
  "utf8",
);
const bare = src
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
  .replace(/\/\/.*$/gm, "");

describe("the lens page", () => {
  it("folds with core, so it cannot disagree with `isocan lens`", () => {
    expect(bare).toContain("lensEntries(");
    expect(bare).toContain("lensGroups(");
  });

  it("stores no position and offers no drag", () => {
    /* The physics, as a check somebody has to argue with rather than walk
       past: a position written here has nowhere true to land. */
    expect(bare).not.toMatch(/draggable|onDragStart|onPointerDown|style=\{\{ left:/);
    expect(bare).not.toMatch(/\bx:\s|\by:\s/);
  });

  it("says out loud that things live elsewhere", () => {
    /* Discovered by trying to drag is the worst way to learn this. The
       sentence is in core so both surfaces say the same one. */
    expect(bare).toContain("LENS_REFUSAL");
  });

  it("makes every row a link to where the thing really is", () => {
    /* A reference that cannot be followed is a list of things you cannot get
       to, which is the failure mode of every "virtual" view. */
    expect(bare).toMatch(/itemPath\(e\.canvasId, e\.itemId\)/);
  });

  it("reads through the api lib, not a hand-written route", () => {
    /* I wrote `/api/canvases` from memory and it 404s — `listCanvases` knows
       the route this build serves, carries the badge, and recovers at the
       door. */
    expect(bare).toContain("listCanvases()");
    /* This asked only about a DOUBLE-QUOTED route, which is not how anybody
       writes a route with an id in it. Three surfaces reached for the oplog
       with a template literal and all three walked past a guard written to
       stop exactly that. */
    expect(bare).not.toMatch(/fetch\(["'`]\/api\//);
  });

  it("survives one canvas it cannot read", () => {
    /* A lens over nine canvases should not go blank because one is shut. */
    expect(bare).toMatch(/getSnapshot\(canvas\.id\)\.catch/);
  });

  it("disambiguates two subjects with one name", () => {
    expect(bare).toContain("lensSubjectLabels");
  });
});

describe("the lens's stylesheet", () => {
  const sheet = rules(withoutComments()).filter((r) => /\.lens-/.test(r.selector));

  it("exists, and takes its colours from tokens", () => {
    expect(sheet.length).toBeGreaterThan(0);
    for (const r of sheet) expect(r.body).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("lays rows out as a list, never as a positioned surface", () => {
    /* A tile grid with coordinates is the shape that would make somebody
       reach for a drag. Rows cannot be mistaken for a canvas. */
    for (const r of sheet) {
      expect(r.body, r.selector).not.toMatch(/position:\s*absolute/);
    }
  });
});

/**
 * **Narrowing** (phase 2) — the gallery is the answer at thirty things and a
 * wall at three hundred.
 */
describe("the lens narrows", () => {
  it("filters with the shared function, so the CLI agrees", () => {
    /* `isocan lens --kind screen` and the app's chip have to mean one thing,
       or the surfaces disagree about what an agent has been doing. */
    expect(bare).toContain("filterLens(all, filter,");
  });

  it("offers only the kinds that are actually there", () => {
    /* A chooser listing kinds nobody has made is a menu of dead ends. */
    expect(bare).toContain("lensKinds(all)");
  });

  it("counts kinds BEFORE filtering", () => {
    /* Otherwise choosing a kind empties the list you chose it from, and the
       counts shrink to whatever you last picked. */
    expect(bare).toMatch(/lensKinds\(all\), \[all\]/);
  });

  it("shows the controls only when there are enough things to need them", () => {
    /* And counts what the subject HAS, not what is showing — otherwise a
       narrow filter removes the controls you narrowed with. */
    expect(bare).toMatch(/all\.length > NARROW_FROM/);
    expect(bare).not.toMatch(/entries\.length > NARROW_FROM/);
  });

  it("says so when a filter matches nothing", () => {
    /* A narrowed lens matching nothing looks exactly like an agent who has
       made nothing. */
    expect(bare).toMatch(/Nothing here matches that/);
  });

  it("turns a chip off by removing the key, not by nulling it", () => {
    /* A filter carrying a field that means nothing is a filter that will
       eventually be read as meaning something. */
    expect(bare).toMatch(/function toggle</);
    expect(bare).toMatch(/const \{ \[key\]: _gone, \.\.\.rest \} = filter/);
  });
});
