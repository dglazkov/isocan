import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "@isocan/core";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const css = read("../src/styles.css");
const item = read("../src/components/ItemView.tsx");

const tokenIn = (block: string, name: string): string => {
  const at = css.indexOf(block);
  const found = css.slice(at).match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!found) throw new Error(`no --${name} after ${block}`);
  return found[1]!;
};

/**
 * **A slide says so on the canvas, in a colour nothing else here speaks.**
 *
 * The 🎬 in the title bar is read one item at a time; the question this
 * answers is "which of these forty is in the deck", asked at a glance. So it
 * is the edge that carries it.
 *
 * The hue is the interesting decision. Four colours here already mean a
 * STATE — warn, accent, good, danger — and seven more belong to PEOPLE
 * (`IDENTITY_COLORS`), whose outlines land on items during remote selection.
 * A slide is neither: it is a role, so it needed a hue nothing else claims,
 * and magenta is the widest gap left on the wheel.
 */
describe("the mark a slide wears on the canvas", () => {
  it("is a hue no state and no person already owns", () => {
    const hue = (hex: string): number => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
      const max = Math.max(r, g, b);
      const d = max - Math.min(r, g, b);
      if (d === 0) return 0;
      const raw = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      return (Math.round(raw * 60) + 360) % 360;
    };
    const taken = ["#a06000", "#1f3fd0", "#2e8540", "#b3261e", "#0f8a80", "#c93a55", "#7a3fd0", "#b26a00", "#3a7d2c", "#3d63dd", "#6b7280"];
    for (const theme of ["--warn: #a06000;", "--good: #56b06a;"]) {
      const slide = tokenIn(theme, "slide");
      const nearest = Math.min(
        ...taken.map((t) => {
          const gap = Math.abs(hue(t) - hue(slide));
          return Math.min(gap, 360 - gap);
        }),
      );
      // Comfortably clear of every colour that already means something.
      expect(nearest, `--slide ${slide} sits ${nearest}° from a colour already in use`).toBeGreaterThan(25);
    }
  });

  it("is legible on the ground of the theme it belongs to", () => {
    // A border is non-text UI: 3:1 is the bar, and both clear it with room.
    expect(contrastRatio(tokenIn("--warn: #a06000;", "slide"), "#ffffff")!).toBeGreaterThan(3);
    expect(contrastRatio(tokenIn("--good: #56b06a;", "slide"), "#0e0f12")!).toBeGreaterThan(3);
  });

  it("is worn by the item, and firmer under the pointer", () => {
    expect(item).toContain('${isSlide(item) ? " slide" : ""}');
    expect(css).toContain(".item.slide { border-color: var(--slide); }");
    expect(css).toContain(".item.slide:hover");
  });

  it("does not outrank selection, which is about right now", () => {
    // Selection is an OUTLINE and the deck mark is a BORDER, so a selected
    // slide shows both rather than one hiding the other.
    expect(css).toMatch(/\.item\.selected \{ outline:/);
  });
});

/**
 * **The dissolve between slides**, and the two ways it went wrong first.
 */
describe("moving from one slide to the next", () => {
  it("never reorders the frames, because moving one cancels its transition", () => {
    // Measured: re-inserting the moved node left BOTH frames at opacity 0 for
    // a beat — a hole in the picture exactly where this removes one.
    expect(item).toContain("Append-only, and that is load-bearing");
    expect(item).toContain("style={{ zIndex: one === visible ? 2 : 1 }}");
  });

  it("keeps a frame that has been seen painted underneath", () => {
    // So the incoming slide fades in over a finished picture rather than over
    // the ground: the two of them never add up to less than one slide.
    expect(item).toContain('className={`html-view${shown.has(one) ? "" : " arriving"}`}');
  });

  it("fades rather than cutting, and respects reduced motion", () => {
    expect(css).toMatch(/\.html-view \{[^}]*transition: opacity/);
    expect(css).toContain("@media (prefers-reduced-motion: reduce) { .html-view { transition: none; } }");
  });
});
