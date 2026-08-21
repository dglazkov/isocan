import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

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
    const raw = declarations().filter(({ value }) => {
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
    for (const owner of [".toolbar", ".tool-rail", ".zoom-controls", ".edge-radar"]) {
      expect(layerOf(owner), `${owner} owns a popover, so it belongs on --z-bar`).toBe(
        "var(--z-bar)",
      );
    }
    for (const dock of [".main-panel", ".files-panel", ".trash-panel"]) {
      expect(layerOf(dock)).toBe("var(--z-dock)");
    }
  });
});
