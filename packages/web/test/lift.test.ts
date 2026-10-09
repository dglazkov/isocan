import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { css, rules } from "./cssrules.ts";

/**
 * **The lift** (groups-by-hand phase 1): what the hand is holding wears a
 * deeper shadow, and nothing else about it changes.
 *
 * The rule that matters is the negative one. A picked-up card would look
 * bigger in the world, but then you could not see where it is about to land —
 * and an item's position under the hand is a fact, not decoration
 * (docs/research/2026-08-28-motion.md). So the lift is depth only: no
 * transform, no scale, no offset, and the old `opacity: 0.92` comes off,
 * because a translucent card is hardest to read exactly when you are placing
 * it. The journey `lift` (scripts/journeys.mjs) proves the same thing in a
 * real browser; this holds the sheet to it on every run.
 */
const item = readFileSync(fileURLToPath(new URL("../src/components/ItemView.tsx", import.meta.url)), "utf8");
const all = rules();
const selects = (r: { selector: string }, cls: string) =>
  r.selector.split(",").some((s) => new RegExp(`\\.item(\\.[\\w-]+)*\\.${cls}(?![\\w-])`).test(s.trim()) && !/\s/.test(s.trim()));
const MOVES = /\b(transform|scale|translate|rotate|top|left|right|bottom|width|height|margin|inset)\s*:/;

describe("the lift", () => {
  it("has a shadow token in both themes", () => {
    const light = /:root,\s*:root\[data-theme="light"\]\s*\{(.*?)\n\}/s.exec(css)![1]!;
    const dark = /:root\[data-theme="dark"\]\s*\{(.*?)\n\}/s.exec(css)![1]!;
    // The resting halo (--shadow-item, 8 Oct 2026) and the lift, in both
    // themes; a card in the hand must reach further than one at rest, or you
    // cannot see what you are holding.
    const reach = (block: string, token: string) => {
      const value = new RegExp(`${token}:\\s*([^;]+);`).exec(block)?.[1] ?? "";
      return Math.max(0, ...[...value.matchAll(/(\d+)px\s+rgba/g)].map((m) => Number(m[1])));
    };
    for (const block of [light, dark]) {
      expect(reach(block, "--shadow-item")).toBeGreaterThan(0);
      expect(reach(block, "--shadow-lift")).toBeGreaterThan(reach(block, "--shadow-item"));
    }
  });

  it("leaves .item.dragging opaque and where it is", () => {
    const dragging = all.filter((r) => r.at.length === 0 && selects(r, "dragging"));
    expect(dragging.length).toBeGreaterThan(0);
    for (const r of dragging) {
      expect(r.body, r.selector).not.toMatch(/opacity\s*:/);
      expect(r.body, r.selector).not.toMatch(MOVES);
    }
  });

  it("is a shadow and only a shadow, on every kind that lifts", () => {
    const lifted = all.filter((r) => r.at.length === 0 && selects(r, "lifted"));
    // The card, a group or area frame (which lies flat at rest), and paper.
    expect(lifted.map((r) => r.selector)).toEqual(
      expect.arrayContaining([".item.lifted", ".item.area.lifted", ".item.textnode.paper.lifted"]),
    );
    for (const r of lifted) {
      expect(r.body, r.selector).toMatch(/box-shadow:\s*var\(--shadow-lift\)\s*;/);
      expect(r.body, r.selector).not.toMatch(MOVES);
      expect(r.body, r.selector).not.toMatch(/opacity\s*:/);
    }
  });

  it("eases in at 120ms, settles over 160ms, and swaps instantly under reduced motion", () => {
    const base = all.find((r) => r.at.length === 0 && r.selector === ".item" && /transition/.test(r.body));
    expect(base?.body).toMatch(/transition:\s*box-shadow 160ms/);
    expect(all.find((r) => r.at.length === 0 && r.selector === ".item.lifted")!.body).toMatch(/transition-duration:\s*120ms/);
    const reduced = all.filter((r) => r.at.some((a) => a.includes("prefers-reduced-motion: reduce")) && selects(r, "lifted"));
    expect(reduced.some((r) => /transition:\s*none/.test(r.body) && r.selector.split(",").map((s) => s.trim()).includes(".item"))).toBe(true);
  });

  it("is worn by what the hand holds, not by what it carries", () => {
    // `.dragging` is on every rider (an area's contents, an item's marks);
    // `.lifted` is on the drag's roots alone — so a dragged group lifts its
    // frame and not its twenty members.
    expect(item).toMatch(/\$\{lifted \? " lifted" : ""\}/);
    expect(item).toMatch(/s\.drag\?\.lift\?\.includes\(item\.id\)/);
    expect(item).toMatch(/s\.groupPreview\?\.lift\?\.includes\(item\.id\)/);
    // And only once the press has become a drag.
    expect(item).toMatch(/if \(!moved\) semantic\?\.lift\(\);\s*moved = true;/);
  });
});
