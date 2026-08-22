import { describe, expect, it } from "vitest";
import {
  canonicalSection,
  parseDesign,
  parseFrontMatter,
  resolveToken,
  serializeDesign,
} from "../src/index.ts";

const SAMPLE = `---
version: alpha
name: Daylight Prestige
colors:
  primary: "#1A1C1E"
  tertiary: "#B8422E"
typography:
  h1:
    fontFamily: Public Sans
    fontSize: 48px
    fontWeight: 600
    lineHeight: 1.1
spacing:
  md: 16px
components:
  button:
    background: "{colors.tertiary}"
omitted:
  - spacing
  - section: rounded
    reason: "No rounded corners in the brand book"
---

# Daylight Prestige

## Overview

High-contrast neutrals and one evocative accent.

## Colors

- **Primary (#1A1C1E):** deep ink for headlines.
`;

describe("reading a DESIGN.md", () => {
  const doc = parseDesign(SAMPLE);

  it("reads the tokens out of the front matter", () => {
    expect(doc.tokens.name).toBe("Daylight Prestige");
    expect(doc.tokens.colors).toEqual({ primary: "#1A1C1E", tertiary: "#B8422E" });
    expect(doc.tokens.spacing).toEqual({ md: "16px" });
  });

  it("reads nested typography, keeping numbers as numbers", () => {
    expect(doc.tokens.typography?.h1).toEqual({
      fontFamily: "Public Sans",
      fontSize: "48px",
      fontWeight: 600,
      lineHeight: 1.1,
    });
  });

  it("reads a list of strings and of small maps", () => {
    expect(doc.tokens.omitted).toEqual([
      "spacing",
      { section: "rounded", reason: "No rounded corners in the brand book" },
    ]);
  });

  it("keeps the prose, split by section", () => {
    expect(doc.sections.map((s) => s.title)).toEqual(["Overview", "Colors"]);
    expect(doc.sections[0]!.body).toContain("one evocative accent");
  });

  it("reports nothing wrong with a well-formed file", () => {
    expect(doc.problems).toEqual([]);
  });

  it("takes a file with no front matter as all prose", () => {
    const plain = parseDesign("## Colors\n\nJust words.\n");
    expect(plain.tokens).toEqual({});
    expect(plain.sections[0]!.title).toBe("Colors");
  });

  it("says what it could not read instead of guessing", () => {
    const bad = parseDesign("---\ncolors:\n\tprimary: red\nname Daylight\n---\n\n## Colors\n");
    expect(bad.problems.length).toBeGreaterThan(0);
    expect(bad.problems.join(" ")).toMatch(/tab|expected/i);
  });
});

describe("the spec's section names", () => {
  it("takes the documented aliases", () => {
    expect(canonicalSection("Brand & Style")).toBe("Overview");
    expect(canonicalSection("Layout & Spacing")).toBe("Layout");
    expect(canonicalSection("Elevation")).toBe("Elevation & Depth");
  });

  it("leaves a heading it does not know alone", () => {
    expect(canonicalSection("Motion")).toBe("Motion");
  });
});

describe("token references", () => {
  const { tokens } = parseDesign(SAMPLE);

  it("resolves {path.to.token}", () => {
    expect(resolveToken(tokens, "{colors.tertiary}")).toBe("#B8422E");
    expect(resolveToken(tokens, "{typography.h1}")).toMatchObject({ fontSize: "48px" });
  });

  it("returns null for a reference to nothing, and for plain text", () => {
    expect(resolveToken(tokens, "{colors.nope}")).toBeNull();
    expect(resolveToken(tokens, "#B8422E")).toBeNull();
  });
});

describe("writing one back out", () => {
  it("round-trips through its own serializer", () => {
    const doc = parseDesign(SAMPLE);
    const again = parseDesign(serializeDesign(doc.tokens, doc.body));
    expect(again.tokens).toEqual(doc.tokens);
    expect(again.sections.map((s) => s.title)).toEqual(doc.sections.map((s) => s.title));
  });

  it("quotes what YAML would otherwise eat", () => {
    // "#1A1C1E" unquoted is a comment; "{colors.primary}" is a flow mapping.
    const text = serializeDesign(
      { colors: { primary: "#1A1C1E" }, components: { button: { background: "{colors.primary}" } } },
      "## Colors\n",
    );
    expect(text).toContain('primary: "#1A1C1E"');
    expect(text).toContain('background: "{colors.primary}"');
    expect(parseFrontMatter(text.split("---")[1]!).data).toMatchObject({
      colors: { primary: "#1A1C1E" },
    });
  });
});
