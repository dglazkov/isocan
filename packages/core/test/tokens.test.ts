import { describe, expect, it } from "vitest";
import {
  CONTRAST_BODY,
  type DtcgNode,
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
  it("emits DTCG 2025.10: typed leaves, colour and dimension objects, $schema", () => {
    const dtcg = toDtcg(TOKENS) as Record<string, Record<string, DtcgNode>>;
    expect(dtcg.$schema).toBe("https://www.designtokens.org/schemas/2025.10/format.json");
    // `color`, the spec's group name — not `colors`; the value an object, not a hex string.
    expect(dtcg.color!.primary).toEqual({
      $type: "color",
      $value: { colorSpace: "srgb", components: [0.102, 0.1098, 0.1176], hex: "#1a1c1e" },
    });
    expect(dtcg.spacing!.md).toEqual({ $type: "dimension", $value: { value: 16, unit: "px" } });
    expect(dtcg.rounded!.sm).toEqual({ $type: "dimension", $value: { value: 4, unit: "px" } });
    // $type on the typography LEAF, and lineHeight kept — the reference
    // exporter drops it and fails its own schema for exactly that.
    // The composite is all-or-nothing, so a missing letterSpacing is filled
    // with CSS's initial value — and the leaf SAYS which fields were filled.
    expect(dtcg.typography!.bodyMd).toEqual({
      $type: "typography",
      $value: { fontFamily: "Public Sans", fontSize: { value: 16, unit: "px" }, fontWeight: 400, lineHeight: 1.6, letterSpacing: { value: 0, unit: "px" } },
      $description: "letterSpacing: not in DESIGN.md — CSS initial value, which the composite requires",
    });
  });

  it("says a px line-height over a px size as the ratio it is, and rgb()/hsl() as sRGB with alpha", () => {
    const dtcg = toDtcg({
      colors: { veil: "rgba(255,255,255,0.7)", sky: "hsl(210 100% 50%)" },
      typography: { display: { fontFamily: "Inter", fontSize: "64px", fontWeight: 500, lineHeight: "70.4px", letterSpacing: "-1.92px" } },
    }) as Record<string, Record<string, DtcgNode>>;
    expect((dtcg.typography!.display!.$value as { lineHeight: number }).lineHeight).toBe(1.1);
    expect(dtcg.color!.veil!.$value).toEqual({ colorSpace: "srgb", components: [1, 1, 1], hex: "#ffffff", alpha: 0.7 });
    expect((dtcg.color!.sky!.$value as { hex: string }).hex).toBe("#0080ff");
  });

  it("keeps what it cannot say, with the reason, instead of dropping it", () => {
    const dtcg = toDtcg({
      colors: { glow: "oklch(0.7 0.1 200)" },
      typography: { fluid: { fontFamily: "Inter", fontSize: "clamp(1rem, 2vw, 2rem)" } },
    }) as { color?: unknown; typography?: unknown; $extensions: Record<string, { unexported: Record<string, { why: string }> }> };
    expect(dtcg.color).toBeUndefined();
    expect(dtcg.typography).toBeUndefined();
    expect(Object.keys(dtcg.$extensions["io.isocan"]!.unexported)).toEqual(["colors.glow", "typography.fluid"]);
    expect(dtcg.$extensions["io.isocan"]!.unexported["typography.fluid"]!.why).toContain("fontSize");
  });

  it("puts what DTCG has no home for in $extensions rather than dropping it", () => {
    const dtcg = toDtcg(TOKENS) as { $extensions: Record<string, { components: unknown }> };
    expect(dtcg.$extensions["io.isocan"]!.components).toEqual({ button: { background: "{colors.accent}" } });
    const withFeature = toDtcg({ typography: { h1: { fontFamily: "Inter", fontSize: "32px", fontFeature: '"ss01"' } } }) as Record<string, Record<string, DtcgNode>>;
    expect(withFeature.typography!.h1!.$extensions).toEqual({ "io.isocan": { fontFeature: '"ss01"' } });
  });

  it("does not invent a unit: a unitless ratio is a number token that says so", () => {
    const dtcg = toDtcg({ spacing: { unit: 4 } }) as Record<string, Record<string, DtcgNode>>;
    expect(dtcg.spacing!.unit!.$type).toBe("number");
    expect(dtcg.spacing!.unit!.$value).toBe(4);
    expect(String(dtcg.spacing!.unit!.$description)).toContain("unitless");
  });

  it("keeps a reference a reference — both formats spell it the same way", () => {
    const dtcg = toDtcg({ colors: { accent: "#B8422E", link: "{colors.accent}" } }) as Record<string, Record<string, DtcgNode>>;
    expect(dtcg.color!.link).toEqual({ $type: "color", $value: "{colors.accent}" });
  });

  it("comes back from W3C to the front-matter shape, round-tripping the export", () => {
    const back = fromDtcg(toDtcg(TOKENS) as Record<string, unknown>);
    expect(back.colors).toEqual({ primary: "#1a1c1e", accent: "#b8422e" });
    expect(back.spacing).toEqual(TOKENS.spacing);
    expect(back.rounded).toEqual(TOKENS.rounded);
    // The one asymmetry, on purpose: the composite required a letterSpacing
    // the file never stated, so the round trip comes back with the CSS
    // initial value written down — a stated 0px, not a silent one.
    expect(back.typography).toEqual({ bodyMd: { ...TOKENS.typography!.bodyMd, letterSpacing: "0px" } });
    expect(back.components).toEqual(TOKENS.components);
  });

  it("reads the reference exporter's shape — `color` group, objects — and never hands toCss an object", () => {
    const back = fromDtcg({
      color: { brand: { $type: "color", $value: { colorSpace: "srgb", components: [0.325, 0.227, 0.992], hex: "#533afd" } } },
      spacing: { xxs: { $type: "dimension", $value: { value: 2, unit: "px" } } },
      typography: { body: { $type: "typography", $value: { fontFamily: "Inter", fontSize: { value: 16, unit: "px" }, fontWeight: 400, lineHeight: 1.5 } } },
    });
    expect(back.colors).toEqual({ brand: "#533afd" });
    expect(back.spacing).toEqual({ xxs: "2px" });
    expect(back.typography).toEqual({ body: { fontFamily: "Inter", fontSize: "16px", fontWeight: 400, lineHeight: 1.5 } });
    expect(toCss(back)).toContain("--space-xxs: 2px;");
    expect(toCss(back)).not.toContain("[object Object]");
    // A triple with no hex still comes back as one.
    expect(fromDtcg({ color: { x: { $value: { colorSpace: "srgb", components: [1, 0, 0] } } } }).colors).toEqual({ x: "#ff0000" });
  });

  it("still reads the legacy string shape this exporter used to write — `colors`, hex strings, `16px`", () => {
    const back = fromDtcg({
      colors: { $type: "color", brand: { $value: "#123456" } },
      spacing: { $type: "dimension", md: { $value: "16px" } },
      typography: { $type: "typography", body: { $value: { fontFamily: "Inter", fontSize: "16px", lineHeight: 1.5 } } },
    });
    expect(back.colors).toEqual({ brand: "#123456" });
    expect(back.spacing).toEqual({ md: "16px" });
    expect(back.typography).toEqual({ body: { fontFamily: "Inter", fontSize: "16px", lineHeight: 1.5 } });
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
