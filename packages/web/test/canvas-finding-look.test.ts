import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { rules, selectorsOf } from "./cssrules.ts";

describe("the arrival screen's look (19 Oct 2026)", () => {
  const body = (selector: string) => {
    const rule = rules().find((r) => selectorsOf(r).includes(selector));
    expect(rule, `${selector} must have a rule`).toBeTruthy();
    return rule!.body;
  };

  it("makes the canvas name the headline and measures the rest from it", () => {
    // The inner box's font-size IS the title's, so every other piece is in em.
    expect(body(".canvas-finding-inner")).toMatch(/font-size:\s*clamp\(/);
    expect(body(".canvas-finding-title")).toMatch(/font-size:\s*1em/);
    for (const piece of [".canvas-finding-eyebrow", ".canvas-finding-sub"]) {
      expect(body(piece), `${piece} scales with the title`).toMatch(/font-size:\s*max\(\d+px,\s*0?\.\d+em\)/);
    }
  });

  it("wears Snow in light and Night in dark, as stills that exist", () => {
    expect(body(".canvas-finding")).toContain("url(/grounds/snow.jpg)");
    expect(body(':root[data-theme="dark"] .canvas-finding')).toContain("url(/grounds/night.jpg)");
    for (const still of ["snow", "night"]) {
      expect(existsSync(fileURLToPath(new URL(`../public/grounds/${still}.jpg`, import.meta.url)))).toBe(true);
    }
  });

  it("leaves the presence feed to the board's own ground", () => {
    // The veil's living ground answers this viewer's pointer only; the
    // `groundCursors.feed` singleton is the canvas's ground's.
    const source = readFileSync(fileURLToPath(new URL("../src/components/CanvasFinding.tsx", import.meta.url)), "utf8");
    const mounts = source.split("\n").filter((line) => line.includes("<Living "));
    expect(mounts.length).toBeGreaterThan(0);
    for (const line of mounts) expect(line).toContain("cursors={false}");
  });
});
