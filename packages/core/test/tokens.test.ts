import { describe, expect, it } from "vitest";
import {
  CONTRAST_BODY,
  contrastRatio,
  fromDtcg,
  luminance,
  parseDesign,
  parseHex,
  passesContrast,
  toCss,
  toDtcg,
} from "../src/index.ts";

const TOKENS = parseDesign(`---
name: Test
colors:
  primary: "#1A1C1E"
  accent: "#B8422E"
typography:
  bodyMd:
    fontFamily: Public Sans
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.6
spacing:
  md: 16px
rounded:
  sm: 4px
components:
  button:
    background: "{colors.accent}"
---
## Colors
`).tokens;

describe("the W3C format, out and back", () => {
  it("wraps every leaf in $value and types the group", () => {
    const dtcg = toDtcg(TOKENS);
    expect(dtcg.colors).toMatchObject({ $type: "color", primary: { $value: "#1A1C1E" } });
    expect(dtcg.spacing).toMatchObject({ $type: "dimension", md: { $value: "16px" } });
    expect(dtcg.typography).toMatchObject({ $type: "typography" });
  });

  it("keeps a reference a reference — both formats spell it the same way", () => {
    expect(toDtcg(TOKENS).components).toMatchObject({
      button: { background: { $value: "{colors.accent}" } },
    });
  });

  it("comes back from W3C to the front-matter shape", () => {
    const back = fromDtcg(toDtcg(TOKENS) as Record<string, unknown>);
    expect(back.colors).toEqual(TOKENS.colors);
    expect(back.spacing).toEqual(TOKENS.spacing);
    expect(back.typography).toEqual(TOKENS.typography);
  });

  it("reads a plain W3C file that never came from here", () => {
    const back = fromDtcg({ colors: { $type: "color", brand: { $value: "#123456" } } });
    expect(back.colors).toEqual({ brand: "#123456" });
  });
});

describe("CSS a screen can actually use", () => {
  const css = toCss(TOKENS);

  it("emits custom properties under one :root", () => {
    expect(css).toContain("--color-primary: #1A1C1E;");
    expect(css).toContain("--space-md: 16px;");
    expect(css).toContain("--radius-sm: 4px;");
  });

  it("kebab-cases a camelCase level, because CSS is not JavaScript", () => {
    expect(css).toContain("--size-body-md: 16px;");
    expect(css).toContain("--weight-body-md: 400;");
  });

  it("gives each typography level a class, so a screen sets one thing", () => {
    expect(css).toMatch(/\.body-md \{[^}]*font-family: var\(--font-body-md\);/);
    expect(css).toMatch(/\.body-md \{[^}]*line-height: var\(--leading-body-md\);/);
  });

  it("turns a token reference into a var(), not a literal brace", () => {
    const withRef = toCss({ colors: { accent: "#B8422E", link: "{colors.accent}" } });
    expect(withRef).toContain("--color-link: var(--color-accent);");
  });
});

describe("contrast, computed", () => {
  it("agrees with the reference values", () => {
    // Black on white is the fixed point everyone knows.
    expect(contrastRatio("#000000", "#ffffff")).toBe(21);
    expect(contrastRatio("#ffffff", "#ffffff")).toBe(1);
    expect(luminance("#ffffff")).toBeCloseTo(1, 5);
    expect(luminance("#000000")).toBeCloseTo(0, 5);
  });

  it("catches the grey everyone reaches for", () => {
    // #999 on white is 2.85:1 — the single most common contrast failure.
    const ratio = contrastRatio("#999999", "#ffffff")!;
    expect(ratio).toBeGreaterThan(2.8);
    expect(ratio).toBeLessThan(2.9);
    expect(passesContrast("#999999", "#ffffff", CONTRAST_BODY)).toBe(false);
    expect(passesContrast("#595959", "#ffffff", CONTRAST_BODY)).toBe(true);
  });

  it("takes three-digit hex, and says null for what it cannot resolve", () => {
    expect(parseHex("#fff")).toEqual({ r: 255, g: 255, b: 255 });
    // Legal in DESIGN.md, not resolvable without a browser: an honest null
    // beats a guess that grades somebody's palette wrongly.
    for (const color of ["rebeccapurple", "oklch(0.7 0.1 200)", "var(--x)", ""]) {
      expect(contrastRatio(color, "#ffffff"), color).toBeNull();
    }
  });

  it("does not care which way round the pair is given", () => {
    expect(contrastRatio("#1A1C1E", "#F7F5F2")).toBe(contrastRatio("#F7F5F2", "#1A1C1E"));
  });
});
