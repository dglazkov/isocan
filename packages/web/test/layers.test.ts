import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { rules, selectorsOf } from "./cssrules.ts";

/**
 * The layer scale, enforced.
 *
 * A popover that hangs off the top bar has to cover the panel below it, and
 * the way that breaks is silent: z-index only competes inside the nearest
 * stacking context, so a menu at 40 inside a bar at 20 still loses to a panel
 * at 25 — the panel never sees the menu, only the bar. The bug does not look
 * like a bug in the CSS; it looks like two reasonable numbers.
 *
 * So there is one scale in :root, and this test says the app uses it. A local
 * number (under LOCAL_MAX) is still fine: those live inside a component's own
 * stacking context, where they cannot reach across the app to lose an argument
 * with a panel.
 */

const css = readFileSync(fileURLToPath(new URL("../src/styles.css", import.meta.url)), "utf8");

/** Below this, a z-index is a local ordering — plies, a badge, a pin. */
const LOCAL_MAX = 10;

function declarations(): { value: string; line: number }[] {
  const out: { value: string; line: number }[] = [];
  css.split("\n").forEach((text, i) => {
    const match = text.match(/z-index:\s*([^;]+);/);
    if (match) out.push({ value: match[1]!.trim(), line: i + 1 });
  });
  return out;
}

describe("the layer scale", () => {
  it("defines every layer the app names", () => {
    for (const token of [
      "--z-canvas",
      "--z-dock",
      "--z-float",
      "--z-bar",
      "--z-popover",
      "--z-toast",
      "--z-overlay",
      "--z-modal",
      "--z-dialog",
    ]) {
      expect(css, `${token} is missing from :root`).toContain(`${token}:`);
    }
  });

  it("keeps the scale in order: docked < floating < bars < popovers < modals", () => {
    const value = (token: string): number => {
      const match = css.match(new RegExp(`${token}:\\s*(\\d+)`));
      expect(match, `${token} has no number`).toBeTruthy();
      return Number(match![1]);
    };
    const order = [
      "--z-canvas",
      "--z-dock",
      "--z-float",
      "--z-bar",
      "--z-popover",
      "--z-toast",
      "--z-overlay",
      "--z-modal",
      "--z-dialog",
    ].map(value);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(new Set(order).size, "two layers claiming the same number").toBe(order.length);
  });

  it("uses the scale for anything that can meet another component", () => {
    const all = declarations();
    // Same reason as oneblock's: this test's answer for "no declarations
    // found" is identical to its answer for "every declaration is fine". A
    // z-index written across two lines, or the regex losing its semicolon,
    // and the whole scale stops being enforced with the suite green.
    expect(all.length, "no z-index declarations found — the parser is wrong").toBeGreaterThan(10);
    const raw = all.filter(({ value }) => {
      if (value.includes("var(--z-")) return false;
      const n = Number(value);
      return !Number.isFinite(n) || Math.abs(n) >= LOCAL_MAX;
    });
    expect(
      raw,
      `these z-indexes are outside the scale — use var(--z-…) from :root, or keep it under ${LOCAL_MAX} if it is local to one component`,
    ).toEqual([]);
  });

  it("puts what a click opens above what is docked", () => {
    // The reported bug: the bar OWNS its popovers, so the bar is what has to
    // outrank the docks. Reading the popover's own z-index proves nothing.
    const layerOf = (selector: string): string => {
      const rule = css.match(new RegExp(`\\${selector}\\s*\\{[^}]*\\}`, "s"));
      expect(rule, `${selector} has no rule`).toBeTruthy();
      const z = rule![0].match(/z-index:\s*([^;]+);/);
      expect(z, `${selector} has no z-index`).toBeTruthy();
      return z![1]!.trim();
    };
    // The top bar's menus fall PAST the floating rails on their way down, and
    // the rim's peek cards open across the shortlist, so both outrank them.
    for (const owner of [".toolbar", ".edge-radar"]) {
      expect(layerOf(owner), `${owner}'s popovers cross other chrome`).toBe("var(--z-bar)");
    }
    // The rails' own menus open into empty canvas: clearing a dock is enough,
    // and putting them level with the bar is what buried the identity menu.
    for (const owner of [".tool-rail", ".zoom-controls"]) {
      expect(layerOf(owner), `${owner} floats; its menus only clear a dock`).toBe(
        "var(--z-float)",
      );
    }
    for (const dock of [".main-panel", ".files-panel", ".trash-panel"]) {
      expect(layerOf(dock)).toBe("var(--z-dock)");
    }
  });
});

/**
 * A floating container yields its clicks; the things drawn inside claim back.
 *
 * The bug this freezes: `.minimap-dock` is a positioning box holding a 138×89
 * map, or a 32×32 handle once folded. It painted nothing itself, but at
 * `--z-float` its own 168×108 rectangle sat over the canvas and ate every
 * click that landed in the gap — a person could see the item underneath and
 * could not touch it. Folding made it worse, not better: folding hides the
 * panel and leaves the box.
 *
 * It stayed invisible for as long as nothing needed that corner. Then item
 * reaction chips arrived under the item, flying to an item centres it, and
 * every "go to item" from the marks dock parked the chips right there.
 *
 * z-index is not the question here — the dock is SUPPOSED to float above the
 * canvas. What is wrong is claiming a hit area for pixels you did not paint.
 */
describe("floating chrome does not eat clicks it cannot see", () => {
  const bodyOf = (selector: string): string => {
    const rule = rules().find((r) => selectorsOf(r).includes(selector) && r.at.length === 0);
    expect(rule, `${selector} has no top-level rule`).toBeTruthy();
    return rule!.body;
  };

  it("makes the minimap's positioning box transparent to the pointer", () => {
    expect(bodyOf(".minimap-dock")).toMatch(/pointer-events:\s*none/);
  });

  it("gives the map itself back, so it is still clickable", () => {
    // Yielding is only safe when what is DRAWN claims back. The map is a
    // control — clicking it recenters — and the handle is the way back.
    expect(bodyOf(".minimap-panel")).toMatch(/pointer-events:\s*auto/);
    expect(css).toMatch(/\.minimap-dock\.folded \.minimap-handle[^}]*pointer-events:\s*auto/);
  });

  it("still takes the map's clicks away while it is folded", () => {
    // The folded panel is transparent and scaled down but still laid out.
    expect(css).toMatch(/\.minimap-dock\.folded \.minimap-panel[^}]*pointer-events:\s*none/);
  });
});

/**
 * Two things in one corner, and only one of them floats.
 *
 * The marks dock is anchored `bottom`-to-`top` down the right side and the
 * zoom bar floats in the same corner at `--z-float`. The dock stopped at
 * `bottom: 16px` — the bar's own offset — so its last rows sat behind the
 * bar. Those rows are the ones past the fold, which are exactly the ones
 * somebody scrolling is trying to reach.
 *
 * Guarded as arithmetic against the BAR's rule rather than as a literal, so
 * moving or resizing the bar fails here instead of silently re-covering the
 * dock.
 */
describe("the marks dock clears the zoom bar", () => {
  /** Measured on the rendered bar: 5px padding, a 31px control row, 5px. */
  const ZOOM_BAR_HEIGHT = 43;
  const bottomOf = (selector: string): number => {
    const rule = rules().find((r) => selectorsOf(r).includes(selector) && r.at.length === 0);
    expect(rule, `${selector} has no top-level rule`).toBeTruthy();
    const bottom = rule!.body.match(/bottom:\s*(\d+)px/);
    expect(bottom, `${selector} sets no plain px bottom`).toBeTruthy();
    return Number(bottom![1]);
  };

  it("starts above where the bar reaches", () => {
    const bar = bottomOf(".zoom-controls");
    expect(bottomOf(".marks")).toBeGreaterThanOrEqual(bar + ZOOM_BAR_HEIGHT);
  });

  it("does not float above it instead, which would cover the bar", () => {
    // The other way to "fix" an overlap. The dock is a DOCK: it yields to the
    // floating control, it does not outrank it.
    const dock = rules().find((r) => selectorsOf(r).includes(".marks") && r.at.length === 0)!;
    expect(dock.body).toMatch(/z-index:\s*calc\(var\(--z-dock\) - 1\)/);
  });
});
