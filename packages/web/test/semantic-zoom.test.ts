import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TEXT_PICTURES_ROUTE } from "@isocan/core/text";
import { EXPERIMENTS } from "../src/lib/experiments.ts";

/**
 * **Semantic Zoom is off until a person turns it on, and off costs nothing**
 * (phase 1; `docs/projects/semantic-zoom/phases.md`, "Behind the flag").
 *
 * With `semantic.zoom` off no request is made, no model is called and no new
 * chunk loads. That is a property of where the code sits, so it is read off
 * the source, the way this package pins what a first visit carries: the only
 * way into the experiment's chunk is one `lazy(import(…))` in CanvasPage,
 * mounted under the flag; nothing eager names the chunk, the summaries route
 * or core's semantic-zoom subpath; and the experiment list's sentences live
 * only in the lazy Settings chunk. The journey `semantic-zoom-text` proves the
 * same in a browser, by counting requests.
 */
const src = fileURLToPath(new URL("../src/", import.meta.url));
const read = (file: string) => readFileSync(path.join(src, file), "utf8");
const files = (dir: string): string[] =>
  readdirSync(path.join(src, dir)).flatMap((name) => {
    const rel = path.join(dir, name);
    return statSync(path.join(src, rel)).isDirectory() ? files(rel) : /\.(ts|tsx)$/.test(name) ? [rel] : [];
  });

describe("the experiment", () => {
  it("is a row Settings lists, named for a person", () => {
    const row = EXPERIMENTS.find((one) => one.id === "semantic.zoom");
    expect(row?.name).toBe("Semantic Zoom");
    expect(row?.what).toMatch(/summary/);
  });

  it("looking at pictures is a second row, shown only under Semantic Zoom, offered only where the home's model takes pictures", () => {
    const row = EXPERIMENTS.find((one) => one.id === "semantic.zoom.vision");
    expect(row).toMatchObject({ name: "Semantic Zoom: look at pictures", under: "semantic.zoom", needsPictures: true });
    const menu = read("components/IdentityMenu.tsx");
    expect(menu).toContain("EXPERIMENTS.filter((entry) => !entry.under || experiments.includes(entry.under))");
    expect(menu).toContain("fetchTextPictures()");
    expect(read("lib/api.ts")).toContain(`request<TextPictures>("GET", ${JSON.stringify(TEXT_PICTURES_ROUTE)})`);
    expect(menu).toMatch(/checked=\{!refused && experiments\.includes\(entry\.id\)\}/);
    expect(menu).toContain("disabled={refused}");
  });

  it("with the setting off the chunk never asks for a vision summary nor reads one: vision rides only on looking()", () => {
    const zoom = read("components/SemanticZoom.tsx");
    expect(zoom).toContain(`const looking = () => !visionRefused && useUiStore.getState().experiments.includes(VISION);`);
    expect(zoom).toContain(`const vision = looking() ? "&vision=1" : "";`);
    expect(zoom).toContain("...(looks && !plainOnly ? { vision: true } : {})");
  });
});

describe("off costs nothing", () => {
  it("loads the chunk from exactly one place, lazily, under the flag", () => {
    const page = read("pages/CanvasPage.tsx");
    expect(page).toContain(`const SemanticZoom = lazy(() => import("../components/SemanticZoom.tsx"));`);
    expect(page).toContain(`const semanticZoom = useUiStore((s) => s.experiments).includes("semantic.zoom");`);
    expect(page).toMatch(/\{semanticZoom && <Suspense fallback=\{null\}><SemanticZoom canvasId=/);
    const naming = files(".").filter((file) => file !== path.join("components", "SemanticZoom.tsx") && /SemanticZoom\.tsx|semantic-zoom/.test(read(file)));
    expect(naming).toEqual([path.join("pages", "CanvasPage.tsx")]);
  });

  it("asks the home for nothing outside the chunk: the route and the key are only there", () => {
    for (const file of files(".")) {
      if (file === path.join("components", "SemanticZoom.tsx")) continue;
      expect(read(file), file).not.toMatch(/summariesRoute|textSummaryKey|\/summaries/);
    }
  });

  it("draws nothing new without it: ItemView only reads what the chunk wrote, and the store starts empty", () => {
    expect(read("stores/gistStore.ts")).toContain("create<Record<string, { node: ReactNode; px?: number }>>(() => ({}))");
    const item = read("components/ItemView.tsx");
    expect(item).toContain("const gistEntry = useGistStore((s) => s[item.id]);");
    expect(item).toContain("const gist = textLegible ? null : gistEntry?.node;");
    expect(item).toMatch(/gist \?\? <span className="text-mark"/);
    // A group's or an area's card shows only where the zoom says its members cannot be read.
    expect(item).toContain("zoomDecisions(item, width, height, s.viewport.scale, held, gistEntry?.px)");
    expect(item).toContain("{gisted && gistEntry!.node}");
  });

  it("keeps the experiment list's sentences out of the first visit: only Settings imports it", () => {
    const importers = files(".").filter((file) => /from "(\.\.?\/)+(lib\/)?experiments\.ts"/.test(read(file)));
    expect(importers).toEqual([path.join("components", "IdentityMenu.tsx")]);
    expect(read("components/CanvasCrumb.tsx")).toMatch(/lazy\(\(\) => import\("\.\/IdentityMenu\.tsx"\)/);
    expect(read("pages/CanvasListPage.tsx")).toMatch(/lazy\(\(\) => import\("\.\.\/components\/IdentityMenu\.tsx"\)/);
  });

  it("the summary is marked as one: ≈, and an accessible name that says Summary of", () => {
    const zoom = read("components/SemanticZoom.tsx");
    expect(zoom).toContain(`aria-label={\`Summary of \${title}`);
    expect(zoom).toContain(`aria-label={\`Summary of \${item.title}`);
    expect(zoom).toContain("≈");
    expect(zoom).toContain("sz-updating");
  });
});
