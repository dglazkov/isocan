import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Item, ItemVersion } from "@isocan/core";
import { diffVersions, markSource } from "@isocan/core/diff";
import { compareVersions } from "../src/lib/compare.ts";
import { itemMenu } from "../src/lib/menuentries.tsx";
import { useCanvasStore } from "../src/stores/canvasStore.ts";
import type { MenuAction, MenuEntry } from "../src/components/ContextMenu.tsx";

/**
 * **The Compare inspector draws core's diff, and only reads**
 * (docs/projects/version-diff/design.md).
 *
 * The sentence the inspector shows must be the sentence `isocan diff`
 * prints, so its data comes from core's `diffVersions` through
 * `lib/compare.ts` and nothing in the web computes a diff of its own. Each
 * HTML side is core's `markSource` output as a `srcdoc` — the only way a
 * highlight reaches inside an opaque-origin frame. And the inspector loads on
 * the click: nothing on the first paint imports it.
 *
 * The browser half — that the marks are readable at the scale the panes
 * draw — was checked by driving headless Chrome, and is said so in the
 * commit, not asserted here.
 *
 * Synthetic: Acme's pricing page.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const src = (rel: string) => readFileSync(path.join(here, "../src", rel), "utf8");

const version = (id: string, blobHash: string, mimeType = "text/html"): ItemVersion => ({
  id, blobHash, mimeType, filename: "acme.html", size: 10, createdAt: "2026-09-26T00:00:00Z", createdBy: { id: "usr_acme", name: "Acme" },
});

const TEXTS: Record<string, string> = {
  h1: `<!doctype html><html><body><h1>Pricing</h1><p class="card">Basic</p></body></html>`,
  h2: `<!doctype html><html><body><h1>Plans</h1><p class="card">Basic</p><p class="card">Team</p></body></html>`,
};
const read = async (_canvas: string, hash: string) => TEXTS[hash]!;

describe("the Compare inspector", () => {
  it("draws core's diff, and core's marks as each side's srcdoc", async () => {
    const compared = await compareVersions("cnv_acme", version("ver_1", "h1"), version("ver_2", "h2"), read);
    const side = (hash: string) => ({ mimeType: "text/html", filename: "acme.html", size: 10, blobHash: hash, text: TEXTS[hash]! });
    const core = diffVersions(side("h1"), side("h2"));
    expect(compared.diff).toEqual(core);
    expect(compared.diff.summary).toBe("1 element added, 1 changed: the “Pricing” heading: “Pricing” → “Plans”; added a “Team” paragraph");
    expect(compared.before).toEqual({ kind: "frame", srcdoc: markSource(TEXTS.h1!, core, "before") });
    expect(compared.after).toEqual({ kind: "frame", srcdoc: markSource(TEXTS.h2!, core, "after") });
  });

  it("never fetches an image to compare it, and draws it by its URL", async () => {
    const fetched: string[] = [];
    const compared = await compareVersions("cnv_acme", version("ver_1", "p1", "image/png"), version("ver_2", "p2", "image/png"), async (_c, h) => (fetched.push(h), ""));
    expect(fetched).toEqual([]);
    expect(compared.diff.kind).toBe("image");
    expect(compared.after).toMatchObject({ kind: "image", url: expect.stringContaining("p2") });
  });

  it("computes nothing itself and can write nothing but the two existing decisions", () => {
    const inspector = src("components/VersionCompare.tsx");
    const lib = src("lib/compare.ts");
    // One engine: the web imports core's, and never grows a second.
    expect(lib).toContain('from "@isocan/core/diff"');
    expect(inspector).not.toMatch(/\bdiffVersions\(/);
    // Its only writes are the version stack's own op and choose's door.
    const sends = [...inspector.matchAll(/type: "([\w.]+)"/g)].map((m) => m[1]);
    expect(sends).toEqual(["item.setCurrentVersion"]);
    expect(inspector).toContain('import("../lib/choose.ts")');
    expect(lib).not.toMatch(/sendEchoed|sendOp/);
  });

  it("loads on the click, from the menu and from the fan", () => {
    for (const file of ["lib/menuentries.tsx", "components/VersionFanOut.tsx"]) {
      const code = src(file);
      expect(code).toMatch(/import\("\.{1,2}\/(components\/)?VersionCompare\.tsx"\)/);
      expect(code).not.toMatch(/^import .*VersionCompare/m);
      expect(code).not.toMatch(/^import .*@isocan\/core\/diff/m);
    }
  });

  it("is offered on an item with a history, and on a variation", () => {
    const item = (id: string, versions: number, properties: Record<string, string> = {}): Item =>
      ({ id, title: id, x: 0, y: 0, width: 100, height: 100, properties, versions: Array.from({ length: versions }, (_, i) => version(`ver_${id}_${i}`, "h1")), currentVersionId: `ver_${id}_0` }) as unknown as Item;
    const items = { a: item("a", 2), b: item("b", 1), c: item("c", 1, { parent: "a" }) };
    useCanvasStore.setState({ canvas: { items, threads: {}, areas: {} } as never });
    const ctx = { canvasId: "cnv_acme", actor: { id: "usr_acme", name: "Acme" }, world: { x: 0, y: 0 }, navigate: () => {} };
    const entry = (it: Item) => itemMenu([it], ctx).find((e): e is MenuAction => !("separator" in e) && (e as MenuEntry & { label?: string }).label === "Compare versions");
    expect(entry(items.a)?.disabled).toBeFalsy();
    expect(entry(items.b)?.disabled).toBe(true);
    expect(entry(items.c)?.disabled).toBeFalsy();
  });
});
