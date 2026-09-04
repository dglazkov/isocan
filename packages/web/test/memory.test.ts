import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const panel = read("../src/components/ContextPanel.tsx");
const popover = read("../src/components/AddPopover.tsx");
const upload = read("../src/lib/upload.ts");
const css = read("../src/styles.css");
const cli = read("../../cli/src/main.ts");

/**
 * **Memory in layers, phases 0–1** (`docs/projects/memory/design.md`). The
 * Context panel reads in layers through the same `contextLayers` the CLI
 * prints; a linked canvas is pulled the way the inception card pulls one,
 * with the same refusals in words; the tick that makes a link lives in the
 * Add popover; and the terminal has every gesture the app has.
 */
describe("the Context panel reads in layers", () => {
  it("renders through core's contextLayers with a heading per source and a from chip per borrowed piece", () => {
    expect(panel).toContain("const layers = contextLayers(canvas, linked);");
    expect(panel).toContain('className="ctx-heading"');
    expect(panel).toContain('{piece.from && <span className="ctx-from">from {piece.from.title}</span>}');
    expect(css).toContain(".ctx-heading {");
    expect(css).toContain(".ctx-from {");
  });

  it("shows an overridden design system struck, saying this canvas's wins, rather than hiding it", () => {
    expect(panel).toContain('${piece.overridden ? " overridden" : ""}');
    expect(panel).toContain("{piece.overridden && <div className=\"ctx-why\">{piece.overridden}</div>}");
    expect(css).toContain(".ctx-row.overridden .ctx-name");
  });

  it("pulls linked canvases with the card's refusals in words — not admitted, or lives elsewhere", () => {
    expect(panel).toContain("const snapshot = await getSnapshot(id);");
    expect(panel).toContain("You are not admitted to this canvas — open it to ask at its door.");
    expect(panel).toContain("not read from here");
    // A heading stands even when nothing could be read under it.
    expect(panel).toContain("{layer.refused && <div className=\"ctx-why\">{layer.refused}</div>}");
  });
});

describe("the link is one property on the card, set where the card is placed", () => {
  it("the Add popover offers the tick when a canvas is what is being added, and passes it through", () => {
    expect(popover).toContain('className="add-inherit"');
    expect(popover).toContain("Inherit its memory here");
    expect(popover).toContain('inherit ? "inherit" : null');
    expect(upload).toContain('memory: "inherit" | null = null,');
    expect(upload).toContain("...(memory ? { [MEMORY_PROP]: memory } : {})");
  });

  it("the terminal has the same gestures, and context prints the layers", () => {
    expect(cli).toContain('.option("--inherit"');
    expect(cli).toContain('.command(`${name} <item>`)');
    expect(cli).toContain('inheritVerb("inherit", "inherit"');
    expect(cli).toContain('inheritVerb("uninherit", null');
    expect(cli).toContain("layersReport(layers, (pieces) => contextReport(pieces))");
    expect(cli).toContain("governingDesign(snapshot.canvas, await linkedCanvasesOf(ctx, p.id, snapshot))");
  });
});
