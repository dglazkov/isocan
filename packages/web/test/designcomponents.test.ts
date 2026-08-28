import { describe, expect, it } from "vitest";
import { parseDesign, resolveToken } from "@isocan/core";
import { componentCss, componentShape } from "../src/lib/designview.ts";

/**
 * **A component drawn as itself, not listed as properties.**
 *
 * Everything else in the design-system view already draws a token AS the
 * thing it describes — a colour is a swatch, a type style is set in its own
 * family. Components alone stayed a property list, which is the difference
 * between reading a specification and seeing a design system: a list says
 * `background: #00F598`, a drawn button says whether you would press it.
 *
 * Two things have to be right for that to work, and neither is obvious.
 */

const DOC = `---
colors:
  primary: "#00F598"
  on-primary: "#04170E"
  surface-container: "#121826"
  outline: "#334155"
typography:
  label-lg:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: 600
rounded:
  md: 10px
  full: 999px
components:
  button-primary:
    background: "{colors.primary}"
    color: "{colors.on-primary}"
    radius: "{rounded.md}"
    font: "{typography.label-lg}"
  chip-gain:
    bg: "{colors.primary}"
    ink: "{colors.on-primary}"
    rounded: "{rounded.full}"
  card-net-worth:
    surface: "{colors.surface-container}"
    text: "#F8FAFC"
    stroke: "{colors.outline}"
---

## Overview
`;

const doc = parseDesign(DOC);
const css = (name: string) =>
  componentCss((v) => resolveToken(doc.tokens, v), doc.tokens.components![name]!);

describe("what a component is, read from what it is called", () => {
  it("recognises the shapes a design system actually names", () => {
    expect(componentShape("button-primary")).toBe("button");
    expect(componentShape("cta-large")).toBe("button");
    expect(componentShape("chip-gain")).toBe("chip");
    expect(componentShape("badge-tier")).toBe("chip");
    expect(componentShape("input-search")).toBe("input");
    expect(componentShape("card-net-worth")).toBe("card");
  });

  it("falls back to a plain block rather than to nothing", () => {
    // Guessing is allowed to be wrong. What it must not do is refuse to draw:
    // an unrecognised component still gets its colours and its corner, it
    // just does not pretend to know the shape it wanted to be.
    expect(componentShape("bezel-treatment")).toBe("block");
  });
});

describe("the properties, as CSS that can actually be applied", () => {
  it("resolves references so the preview is the colour it will be", () => {
    // The whole reason this is worth drawing: `{colors.primary}` has to
    // become #00F598 through the same resolver the CLI uses, or the preview
    // is a picture of something else.
    expect(css("button-primary").background).toBe("#00F598");
    expect(css("button-primary").color).toBe("#04170E");
    expect(css("button-primary").borderRadius).toBe("10px");
  });

  it("unpacks a typography reference, which resolves to a style not a string", () => {
    // `{typography.label-lg}` is an OBJECT. Treating every reference as a
    // string would put "[object Object]" in the font slot.
    const button = css("button-primary");
    expect(button.fontFamily).toBe("Inter");
    expect(button.fontSize).toBe("13px");
    expect(button.fontWeight).toBe("600");
  });

  it("is tolerant about what the author called things", () => {
    // The spec fixes neither the property names nor a type, so a system that
    // only understood `background` would draw a colourless box for everybody
    // who wrote `bg` or `surface` — and would look broken rather than
    // unsupported. These spellings all appear in real systems.
    expect(css("chip-gain").background).toBe("#00F598");
    expect(css("chip-gain").color).toBe("#04170E");
    expect(css("chip-gain").borderRadius).toBe("999px");
    expect(css("card-net-worth").background).toBe("#121826");
    expect(css("card-net-worth").color).toBe("#F8FAFC");
    expect(css("card-net-worth").border).toBe("1px solid #334155");
  });

  it("leaves alone what it does not understand", () => {
    // Not silently dropped from the SPEC — the value list beside the preview
    // still prints every property verbatim. This only says the preview does
    // not invent CSS out of a property it cannot read.
    const odd = componentCss(() => null, { "bezel-angle": "42deg", background: "#fff" });
    expect(odd.background).toBe("#fff");
    expect(Object.keys(odd)).toEqual(["background"]);
  });
});
