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
    expect(view).toContain("<CanvasCard");
    expect(view).toContain("canvasId={canvasOf}");
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

describe("the popup has two doors and one dialog", () => {
  const popup = read("../src/components/AddPopover.tsx");
  const actions = read("../src/lib/actions.ts");
  const rail = read("../src/components/CanvasTools.tsx");

  it("searches your canvases, most recent first, or takes an address", () => {
    expect(popup).toContain("listCanvases()");
    expect(popup).toContain("Date.parse(b.updatedAt) - Date.parse(a.updatedAt)");
    expect(popup).toContain("classifyAddable(query, canvases ?? [], canvasId)");
  });

  it("is opened by the rail and by ⌘K through one shared state — the one Add door", () => {
    expect(rail).toContain("<AddPopover canvasId={canvasId} actor={actor} onFiles=");
    expect(actions).toContain('id: "add"');
    expect(actions).toContain('setAdding("any")');
    expect(popup).toContain("useUiStore((s) => s.adding)");
  });

  it("places through the same contract the terminal uses", () => {
    const upload = read("../src/lib/upload.ts");
    expect(upload).toContain("const made = canvasItemOf(origin, targetCanvasId);");
    expect(popup).toContain("addCanvasItem(canvasId, actor,");
    // A spot found FOR the card is not chosen; the daemon may tidy it clear.
    expect(popup).toContain("not `chosen`");
  });
});

describe("the picture that survives, and a canvas at another home", () => {
  it("shows the screenshot version under the words when the pull is refused, never instead of live", () => {
    expect(view).toContain('picture={mimeType.startsWith("image/") ? url : null}');
    const refused = card.slice(card.indexOf('if (state.kind === "refused")'), card.indexOf("const items = Object.values"));
    expect(refused).toContain('{picture && <img className="canvas-embed-picture"');
    // Live wins: the picture is only in the refused branch.
    expect(card.slice(card.indexOf("const items = Object.values"))).not.toContain("canvas-embed-picture");
  });

  it("says a canvas at another home lives there rather than asking a door that will not answer", () => {
    expect(card).toContain("origin === window.location.origin ? null : origin");
    expect(card).toContain("if (elsewhere) return;");
    expect(card).toContain("Lives at ${elsewhere");
  });

  it("is drawn as its miniature wherever thumbnails are", () => {
    const thumb = read("../src/components/ItemThumb.tsx");
    expect(thumb).toContain("canvasOf={canvasIdOf(item)}");
  });

  it("has a screenshot verb that lands a version, through the graders' browser", () => {
    expect(cli).toContain('.command("shot <ref>")');
    expect(cli).toContain("scripts/canvas-shot.mjs");
    const shot = read("../../../scripts/canvas-shot.mjs");
    expect(shot).toContain("Page.captureScreenshot");
    expect(shot).toContain('throughTheDoor(b, origin, "Camera", "canvas-shot")');
    expect(shot).toContain('"edit", into, out');
    // The address arrives whole from the CLI, built by canvasUrl: the script
    // never spells /p/<id>, the one shape the repo refuses to write twice.
    expect(shot).toContain('const url = arg("--url");');
    expect(cli).toContain('"--url", canvasUrl(origin, target.id)');
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
