import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const view = read("../src/components/ItemView.tsx");
const css = read("../src/styles.css");
const cli = read("../../cli/src/main.ts");

/**
 * **Grids** (sprint phase 5): guides the app draws from the same four
 * properties the CLI writes, names per row and column, no pointer.
 */
describe("a grid on a sheet is drawn from core's reading of it", () => {
  it("draws guides between cells from areaGrid and areaInner", () => {
    expect(view).toContain("const grid = isAreaItem ? areaGrid(item) : null;");
    const block = view.slice(view.indexOf('<div className="area-grid"'), view.indexOf('{isAreaItem && ('));
    expect(block).toContain("grid.cols - 1");
    expect(block).toContain("grid.rows - 1");
    expect(block).toContain("grid.colNames.map");
    expect(block).toContain("grid.rowNames.map");
  });

  it("takes no pointer — a cell is geometry", () => {
    const rule = css.slice(css.indexOf(".area-grid {"));
    expect(rule.slice(0, rule.indexOf("}"))).toContain("pointer-events: none");
  });
});

describe("the terminal addresses cells and builds the deck from a sheet", () => {
  it("lays and clears a grid", () => {
    expect(cli).toContain('.command("grid <area> [size]")');
    expect(cli).toContain("gridPatch(null)");
    expect(cli).toContain("gridPatch(grid)");
  });

  it("places into a cell with --in and --cell, on text, add and mv", () => {
    expect(cli.match(/\.option\("--cell <row,col>"/g)?.length).toBeGreaterThanOrEqual(3);
    expect(cli).toContain("cellSpot(snapshot.canvas, area, row, col, want.width, want.height)");
    expect(cli).toContain("cellSpot(without, into, cell[0]!, cell[1]!, item.width, item.height)");
  });

  it("makes the deck from every item on a sheet, in reading order", () => {
    expect(cli).toContain('.option("--in <area>", "every item on this sheet, in reading order');
    expect(cli).toContain("...(sheet ? itemsIn(snapshot.canvas, sheet) : [])");
  });
});
