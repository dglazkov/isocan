import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const css = read("../src/styles.css");
const view = read("../src/components/ItemView.tsx");
const viewport = read("../src/components/CanvasViewport.tsx");
const cli = read("../../cli/src/main.ts");

/**
 * **Areas, on both surfaces** (`core/area.ts`, sprint phase 0).
 *
 * A titled sheet things are placed on. What these pin is the part that
 * makes a sheet a sheet rather than a big card: it lies behind everything,
 * it lets tools through to the canvas, it is grabbed by its name and
 * carries what is on it, and every verb the app has for it the terminal
 * has too.
 */
describe("an area lies behind everything", () => {
  it("is rendered first, so items placed on it paint over it", () => {
    expect(viewport).toContain("sort((a, b) => Number(isArea(b)) - Number(isArea(a)))");
  });

  it("wears no shadow and only a dashed hairline — a sheet, not a card", () => {
    const rule = css.slice(css.indexOf(".item.area {"));
    const body = rule.slice(0, rule.indexOf("}"));
    expect(body).toContain("box-shadow: none");
    expect(body).toContain("dashed");
  });
});

describe("an area lets tools through, and is grabbed by its name", () => {
  it("is transparent to the pointer except for its title strip and handles", () => {
    const rule = css.slice(css.indexOf(".item.area {"));
    const body = rule.slice(0, rule.indexOf("}"));
    expect(body).toContain("pointer-events: none");
    expect(css).toMatch(/\.item\.area \.area-title,\s*\.item\.area \.item-titlebar,\s*\.item\.area \.resize-handle,[\s\S]{0,80}pointer-events: auto/);
  });

  it("draws the title strip as the handle, sized in world units from core", () => {
    const strip = view.slice(view.indexOf('className="area-title"'), view.indexOf('className="area-title"') + 200);
    expect(strip).toContain("height: AREA_TITLE_HEIGHT");
    // The label's size comes from the same constant, per item — never a
    // step in the stylesheet's type scale (scale.test.ts holds the count).
    expect(strip).toContain("fontSize: Math.round(AREA_TITLE_HEIGHT * 0.6)");
    expect(css).not.toMatch(/\.area-title \{[^}]*font-size/);
  });

  it("carries what is on it when dragged, read off geometry at the grab", () => {
    const drag = view.slice(view.indexOf("const dragIds"), view.indexOf("if (!wasInSelection)"));
    expect(drag).toContain("isArea(one) ? itemsIn(canvasNow, one)");
  });
});

describe("every area verb is on the terminal too", () => {
  it("lays, lists, and places into an area", () => {
    expect(cli).toContain('.command("area")');
    expect(cli).toContain('.command("new <title...>")');
    expect(cli).toMatch(/areaCmd\s*\.command\("ls", \{ isDefault: true \}\)/);
  });

  it("takes --in on text, add, mv, ls and format", () => {
    expect(cli.match(/\.option\("--in <area>"/g)?.length).toBeGreaterThanOrEqual(5);
    expect(cli).toContain("placementFor(snapshot, opts, { width, height })");
    expect(cli).toContain("freeSpotIn(without, into, item.width, item.height)");
    expect(cli).toContain("formatMoves(scope, {");
  });

  it("places into an area as a CHOSEN spot, so the daemon never tidies it out", () => {
    expect(cli).toContain("return { ...freeSpotIn(snapshot.canvas, area, want.width, want.height), chosen: true };");
  });
});
