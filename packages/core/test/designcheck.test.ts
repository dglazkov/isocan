import { describe, expect, it } from "vitest";
import { bySeverity, checkDesign, parseDesign, serializeDesign } from "../src/index.ts";

const check = (text: string) => checkDesign(parseDesign(text));
const found = (text: string, where: string) => check(text).filter((f) => f.where === where);

const GOOD = `---
name: Acme Field Notes
colors:
  primary: "#1A1C1E"
  neutral: "#F7F5F2"
  tertiary: "#B8422E"
typography:
  body-md:
    fontFamily: Public Sans
    fontSize: 16px
components:
  button:
    background: "{colors.tertiary}"
---

## Overview

Quiet chrome, photographs carry it.

## Colors

Ink on limestone.

## Typography

One face, two weights.
`;

describe("checking a design system", () => {
  it("passes one that is complete and legible", () => {
    expect(check(GOOD)).toEqual([]);
  });

  it("catches a reference to a token nobody kept", () => {
    const text = GOOD.replace("{colors.tertiary}", "{colors.brand}");
    expect(found(text, "components.button.background")[0]).toMatchObject({ severity: "error" });
  });

  it("catches a value that is not a colour", () => {
    const text = GOOD.replace('"#B8422E"', '"nearly red"');
    expect(found(text, "colors.tertiary")[0]?.what).toMatch(/not a CSS colour/);
  });

  it("allows the colour formats the spec allows", () => {
    for (const value of ["oklch(0.7 0.1 200)", "rgb(20 20 20)", "rebeccapurple", "#abc"]) {
      const text = GOOD.replace('"#B8422E"', `"${value}"`);
      expect(found(text, "colors.tertiary"), value).toEqual([]);
    }
  });

  it("does the arithmetic nobody does by eye", () => {
    // Mid grey on limestone: looks fine, fails at 2.6:1.
    const text = GOOD.replace('primary: "#1A1C1E"', 'primary: "#9AA0A7"');
    const finding = found(text, "colors.primary")[0];
    expect(finding?.severity).toBe("error");
    expect(finding?.what).toMatch(/against the ground/);
  });

  it("says when a typography level cannot be applied", () => {
    const text = GOOD.replace("    fontSize: 16px\n", "");
    expect(found(text, "typography.body-md")[0]?.what).toMatch(/no fontSize/);
  });

  it("asks for the sections that carry the reasoning", () => {
    const bare = `---\nname: X\ncolors:\n  primary: "#000000"\n---\n\nnothing here\n`;
    const missing = check(bare).filter((f) => f.what === "section missing").map((f) => f.where);
    expect(missing).toEqual(["Overview", "Colors", "Typography"]);
  });

  it("stays quiet about a section that was left out ON PURPOSE", () => {
    const bare = `---\nname: X\ncolors:\n  primary: "#000000"\nomitted:\n  - overview\n  - section: typography\n    reason: "one face, no scale"\n---\n\n## Colors\n\nInk.\n`;
    const missing = check(bare).filter((f) => f.what === "section missing").map((f) => f.where);
    expect(missing).toEqual(["Typography"].filter(() => false));
  });

  it("insists on a colour palette, because prose cannot be graded", () => {
    const noTokens = "## Colors\n\nBlues, mostly.\n";
    expect(check(noTokens).some((f) => f.severity === "error" && f.where === "colors")).toBe(true);
  });

  it("reports the file it could not parse rather than pretending it read it", () => {
    const broken = "---\ncolors:\n\tprimary: red\n---\n\n## Colors\n";
    expect(check(broken).some((f) => f.where === "front matter" && f.severity === "error")).toBe(true);
  });

  it("puts the worst first", () => {
    const messy = `---\ncolors:\n  primary: "not a colour"\n---\n\n## Colors\n`;
    const ordered = bySeverity(check(messy)).map((f) => f.severity);
    expect(ordered).toEqual([...ordered].sort());
    expect(ordered[0]).toBe("error");
  });
});

describe("checking governing contract support", () => {
  it("checks known policy, then exposes unknown versions and fields as document findings", () => {
    const tokens = parseDesign(GOOD).tokens;
    const report = (lint: unknown) => checkDesign(parseDesign(serializeDesign({ ...tokens, isocan: { lint } }, parseDesign(GOOD).body)));
    expect(report({ version: 1, literals: "allow" })).toEqual([]);
    expect(report({ version: 9, future: [true, null] })).toEqual(expect.arrayContaining([
      expect.objectContaining({ severity: "error", where: "isocan.lint.version" }),
    ]));
    expect(report({ version: 1, future: true })).toEqual(expect.arrayContaining([
      expect.objectContaining({ severity: "error", where: "isocan.lint.future" }),
    ]));
    expect(report({ version: 1, recipes: { Button: { owns: { opacity: "1" } } } })).toEqual(expect.arrayContaining([
      expect.objectContaining({ severity: "error", where: "isocan.lint.recipes.Button.owns.opacity" }),
    ]));
  });

  it("preserves a quoted reason while rejecting an exception without one", () => {
    const tokens = parseDesign(GOOD).tokens;
    const lint = { version: 1, recipes: { Title: { owns: { "font-weight": "600" }, allow: ["font-size"] } }, exceptions: {
      "acme-title": { recipe: "Title", properties: ["font-weight"], reason: 'Acme #1 uses the "compact" title.' },
    } };
    const good = parseDesign(serializeDesign({ ...tokens, isocan: { lint } }, parseDesign(GOOD).body));
    expect(checkDesign(good)).toEqual([]);
    lint.exceptions["acme-title"].reason = "";
    const bad = parseDesign(serializeDesign({ ...tokens, isocan: { lint } }, good.body));
    expect(checkDesign(bad)).toEqual(expect.arrayContaining([
      expect.objectContaining({ severity: "error", where: "isocan.lint.exceptions.acme-title", what: expect.stringContaining("nonempty reason") }),
    ]));
  });
});
