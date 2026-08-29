import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **One language for everything that floats.**
 *
 * Chat, Files, the shut rail's strip and the header's clusters are the same
 * kind of thing — chrome sitting ON the canvas rather than beside it — and
 * they wear one ground, one hairline, one radius, one shadow.
 *
 * The class exists because the discipline failed once already. Chat and Files
 * had those five properties written out twice, and restyling one left the
 * other looking like a different product; by the time the header dissolved
 * into clusters there would have been four copies drifting apart. This is the
 * phase-1 lesson applied a second time, as a rule instead of a resolution.
 */
const css = readFileSync(fileURLToPath(new URL("../src/styles.css", import.meta.url), ), "utf8");
const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(`../src/${rel}`, import.meta.url)), "utf8");

const FLOATING = [
  ["components/MainThreadPanel.tsx", "main-panel dock-panel floats"],
  ["components/FilesPanel.tsx", "files-panel dock-panel floats"],
  ["components/RailStrip.tsx", "rail-strip floats"],
  ["components/Toolbar.tsx", "bar-cluster floats"],
] as const;

describe("everything that floats wears the same slab", () => {
  it("defines the slab exactly once", () => {
    const rule = /\.floats\s*\{[^}]*\}/.exec(css)?.[0] ?? "";
    expect(rule, ".floats must exist").not.toBe("");
    for (const property of ["background:", "backdrop-filter:", "border:", "border-radius:", "box-shadow:"]) {
      expect(rule, `the slab must own its ${property}`).toContain(property);
    }
    expect(css.match(/\.floats\s*\{/g)?.length, "one canonical block").toBe(1);
  });

  it("is worn by every floating surface", () => {
    for (const [file, className] of FLOATING) {
      expect(read(file), `${file} must wear the shared slab`).toContain(className);
    }
  });

  it("leaves each surface only its own layout", () => {
    // The point of the class is that a surface's own rule says where it is
    // and how big, and nothing about what floating LOOKS like. A background
    // creeping back into one of these is the drift this prevents.
    for (const selector of [".dock-panel", ".rail-strip", ".bar-cluster"]) {
      const rule = new RegExp(`\\${selector}\\s*\\{[^}]*\\}`).exec(css)?.[0] ?? "";
      expect(rule, `${selector} must have a rule`).not.toBe("");
      expect(rule, `${selector} must not restate the slab`).not.toMatch(/backdrop-filter:|box-shadow:/);
    }
  });

  it("keeps the bar itself a layout rather than a surface", () => {
    /**
     * The header had its own ground and a hairline under it, which cut the
     * canvas off at 48px and handed the top of the surface to something else.
     * It paints nothing now — the clusters are the floating things and the
     * canvas runs edge to edge behind them.
     */
    const rule = /\.toolbar\s*\{[^}]*\}/.exec(css)?.[0] ?? "";
    expect(rule).not.toMatch(/background: var\(--panel\)/);
    expect(rule).not.toMatch(/border-bottom:/);
    // …and it still lets clicks through to the canvas between the clusters.
    expect(rule).toMatch(/pointer-events: none/);
    expect(css).toMatch(/\.toolbar > \* \{ pointer-events: auto; \}/);
  });

  it("still reserves the space the clusters occupy", () => {
    /**
     * Floating changed what you can see through, not what is in the way.
     * `TOPBAR_HEIGHT` is what framing uses to refuse to park an item under
     * the chrome, and the clusters are centred inside it — 34px tall in a
     * 48px band, measured live at top 7, bottom 41.
     */
    const rule = /\.toolbar\s*\{[^}]*\}/.exec(css)?.[0] ?? "";
    expect(rule).toMatch(/height: 48px/);
    expect(read("lib/stage.ts")).toMatch(/TOPBAR_HEIGHT = 48/);
  });
});
