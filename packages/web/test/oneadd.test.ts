import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const popover = read("../src/components/AddPopover.tsx");
const tools = read("../src/components/CanvasTools.tsx");
const actions = read("../src/lib/actions.ts");
const store = read("../src/stores/uiStore.ts");
const css = read("../src/styles.css");
const cli = read("../../cli/src/main.ts");

/**
 * **One Add** (4 September 2026). The rail's three add buttons and the doc
 * that hid inside the site one became one door: one field that reads what
 * you give it, a line that says what Enter will do, four rows that only
 * narrow the reading. The terminal's `add <thing>` reads the same way through
 * the same classifier, so the two surfaces cannot drift on what a pasted
 * thing is.
 */
describe("the rail has one Add door", () => {
  it("mounts the popover once and no separate upload, site or canvas button", () => {
    expect(tools).toContain("<AddPopover canvasId={canvasId} actor={actor} onFiles=");
    expect(tools).not.toContain("ProjectSite");
    expect(tools).not.toContain("PlaceCanvas");
    expect(tools).not.toContain("UPLOAD");
  });

  it("is one shared state — the rail and ⌘K open the same popover", () => {
    expect(store).toContain('adding: AddKind | "any" | null');
    expect(actions).toContain('id: "add"');
    expect(actions).toContain('setAdding("any")');
    expect(popover).toContain("useUiStore((s) => s.adding)");
  });
});

describe("one field reads what you give it", () => {
  it("classifies through core, previews the reading, and offers four rows as a radio group", () => {
    expect(popover).toContain("classifyAddable(query, canvases ?? [], canvasId)");
    expect(popover).toContain('className="add-preview" aria-live="polite"');
    expect(popover).toContain('role="radiogroup" aria-label="What to add"');
    for (const kind of ['"file"', '"site"', '"doc"', '"canvas"']) expect(popover).toContain(`kind: ${kind}`);
  });

  it("dispatches each kind to the item.add that surface already made", () => {
    expect(popover).toContain('if (what.kind === "doc") {');
    expect(popover).toContain("addDocumentItem(");
    expect(popover).toContain('if (what.kind === "site") {');
    expect(popover).toContain("addBrowserItem(");
    expect(popover).toContain('if (what.kind === "canvas") {');
    expect(popover).toContain("addCanvasItem(");
  });

  it("is styled as a door, and the active row reads as chosen in both themes", () => {
    expect(css).toContain(".add-door");
    expect(css).toContain(".add-kind.active");
    expect(css).not.toContain(".place-canvas");
  });
});

describe("the terminal's add reads the same way", () => {
  it("takes anything, with --as to say which, and routes through the same classifier", () => {
    expect(cli).toContain('.command("add <thing>")');
    expect(cli).toContain('.option("--as <kind>"');
    expect(cli).toContain("classifyAddable(file, canvases, here?.id)");
    expect(cli).toContain("return addGoogleDocItem(ctx, id, opts);");
    expect(cli).toContain("addSiteItem(ctx, ");
    expect(cli).toContain("placeCanvasItem(ctx, ");
  });

  it("keeps browse, gdoc add and canvas place as the same acts, kind already said", () => {
    expect(cli).toContain('.command("browse <url>")');
    expect(cli).toContain("addSiteItem(await ctxOf(cmd), url, opts)");
    expect(cli).toContain("placeCanvasItem(await ctxOf(cmd), ref, opts)");
  });
});
