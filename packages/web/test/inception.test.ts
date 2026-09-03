import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const view = read("../src/components/ItemView.tsx");
const card = read("../src/components/CanvasCard.tsx");
const css = read("../src/styles.css");
const cli = read("../../cli/src/main.ts");
const kinds = read("../src/lib/kinds.ts");

/**
 * **Canvas Inception, phase 0** (`docs/projects/inception/design.md`): a
 * canvas placed on a canvas is drawn live and small, opens in a tab, and the
 * terminal places one with one verb.
 */
describe("a canvas on a canvas is a picture of a place", () => {
  it("is drawn from the other canvas's snapshot, pulled while on screen, never framed", () => {
    expect(card).toContain("getSnapshot(canvasId)");
    expect(card).toContain("setInterval(() => void pull(), PULL_MS)");
    expect(view).toContain("if (canvasOf) {");
    expect(view).toContain("<CanvasCard canvasId={canvasOf}");
    // A canvas item is not a live frame, whatever its blob says.
    expect(view).toContain("const isBrowser = current.mimeType === BROWSER_MIME && !isCanvas;");
  });

  it("is one level deep — a canvas inside the picture is a block, not a picture", () => {
    expect(card).toContain('isCanvasItem(one) ? " nested" : ""');
    expect(card).not.toContain("<CanvasCard");
  });

  it("is never a blank rectangle: a refused pull says so in words", () => {
    expect(card).toContain("You are not admitted to this canvas");
    expect(card).toContain("This canvas could not be read right now.");
  });
});

describe("a canvas is a place you go", () => {
  it("opens in a new tab on double-click, never in place", () => {
    expect(view).toContain('window.open(source, "_blank", "noopener");');
    expect(view).not.toContain("setEntered(item.id)\n    }\n    if (isCanvas");
  });

  it("wears a ↗ on its strip, as anything with a source does", () => {
    expect(view).toContain('className="item-open-source"');
    expect(view).toContain("href={source}");
    expect(css).toContain(".item-open-source {");
  });
});

describe("the terminal places one with one verb", () => {
  it("has isocan canvas place, by ref or by address, through the shared contract", () => {
    expect(cli).toContain('.command("place <canvas>")');
    expect(cli).toContain("canvasItemOf(origin, target.id)");
    expect(cli).toContain("parseCanvasAddress(ref)");
  });

  it("names the kind on both surfaces", () => {
    expect(kinds).toContain('canvas: "Canvases"');
    expect(kinds).toContain('canvas: "canvas"');
  });
});
