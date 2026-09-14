import { describe, expect, it } from "vitest";
import {
  canonicalSection,
  parseDesign,
  parseFrontMatter,
  resolveToken,
  serializeDesign,
} from "../src/index.ts";
import { parseDesignJson } from "../src/designmd.ts";

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

describe("opaque isocan extension preservation", () => {
  const extension = {
    lint: {
      version: 2,
      future: [true, false, null, 1.25, "1", [], {}, {
        name: "Acme #1",
        reason: 'Keep the "Acme" label, C:\\Acme\\notes and a\nsecond line.',
        rules: { allow: ["margin", { unknown: [null, false, { "nested key": "value" }] }] },
      }],
    },
    unknown: { "escaped\"key": "# retained", "": "empty JSON keys are data" },
  };

  it("preserves recursively structured unknown data as one canonical JSON flow value", () => {
    const text = serializeDesign({ name: "Acme", isocan: extension }, "## Overview\n\nSynthetic.");
    expect(text).toContain(`isocan: ${JSON.stringify(extension)}\n`);
    const doc = parseDesign(text);
    expect(doc.problems).toEqual([]);
    expect(doc.tokens.isocan).toEqual(extension);
    expect(parseDesign(serializeDesign(doc.tokens, doc.body)).tokens).toEqual(doc.tokens);
  });

  it("reads documented block maps, string lists and reasons with quotes, escapes and comments", () => {
    const front = String.raw`isocan:
  lint:
    version: 1
    literals: require-references
    recipes:
      Button:
        owns:
          padding: "{spacing.md}"
          border-radius: "{rounded.control}"
        allow:
          - margin
          - align-self
        treatments:
          compact:
            padding: "{spacing.sm}"
    exceptions:
      hero-spacing:
        recipe: Button
        properties:
          - padding
        reason: "Acme #1 keeps the \"Acme\" label." # outside comment
      other:
        reason: 'Acme''s #2 label has "quotes".' # another comment`;
    const doc = parseDesign(`---\n${front}\n---\n`);
    expect(doc.problems).toEqual([]);
    expect(doc.tokens.isocan).toMatchObject({ lint: { version: 1, recipes: {
      Button: { owns: { padding: "{spacing.md}" }, allow: ["margin", "align-self"], treatments: { compact: { padding: "{spacing.sm}" } } },
    }, exceptions: { "hero-spacing": { reason: 'Acme #1 keeps the "Acme" label.' }, other: { reason: 'Acme\'s #2 label has "quotes".' } } } });
    expect(parseDesign(serializeDesign(doc.tokens, "")).tokens).toEqual(doc.tokens);
  });

  it("preserves supported nested block list maps and JSON scalar types", () => {
    const { data, problems } = parseFrontMatter(`isocan:
  lint:
    version: 2
    enabled: true
    empty: null
    future:
      - name: Acme
        rules:
          allow:
            - margin
            - "reason: # stays a string"
            - 'why: because'
            - {"a": 1, "b": true}
          enabled: false
      - [true, null, {"next": [1, 2]}]`);
    expect(problems).toEqual([]);
    expect(data).toEqual({ isocan: { lint: { version: 2, enabled: true, empty: null, future: [
      { name: "Acme", rules: { allow: ["margin", "reason: # stays a string", "why: because", { a: 1, b: true }], enabled: false } },
      [true, null, { next: [1, 2] }],
    ] } } });
  });

  it.each([
    ["anchors", "isocan: &policy\n  lint: {}"],
    ["aliases", "isocan: *policy"],
    ["tags", "isocan: !!map {}"],
    ["YAML flow maps", "isocan: {lint: {version: 1}}"],
    ["block scalars", "isocan:\n  reason: |\n    Acme #1"],
    ["unterminated quotes", 'isocan:\n  reason: "Acme #1'],
    ["duplicate block keys", "isocan:\n  lint:\n    version: 1\n    version: 2"],
    ["duplicate JSON keys", 'isocan: {"lint":{"version":1,"version":2}}'],
    ["unsafe block keys", "isocan:\n  __proto__:\n    polluted: true"],
    ["unsafe JSON keys", 'isocan: {"future":{"constructor":{}}}'],
    ["noncanonical numbers", "isocan:\n  future: 01"],
  ])("reports and refuses to serialize unsupported %s", (_label, front) => {
    const doc = parseDesign(`---\n${front}\n---\n`);
    expect(doc.problems.length).toBeGreaterThan(0);
    expect(() => serializeDesign(doc.tokens, doc.body)).toThrow(/front matter problems/);
  });

  it("rejects escaped duplicate JSON keys and reads unrelated identical keys independently", () => {
    expect(() => parseDesignJson(String.raw`{"lint":{"version":1,"\u0076ersion":2}}`)).toThrow(/duplicate key/);
    expect(parseDesignJson('{"first":{"key":1},"next":{"key":2}}')).toEqual({ first: { key: 1 }, next: { key: 2 } });
  });

  it.each([
    ["undefined", { missing: undefined }], ["infinite number", { value: Infinity }],
    ["NaN", { value: NaN }], ["negative zero", { value: -0 }],
    ["bigint", { value: 1n }], ["function", { value: () => 1 }],
    ["Date", { value: new Date("2026-01-01") }], ["sparse array", { value: [, "x"] }],
    ["symbol", { [Symbol("x")]: true }],
  ])("refuses non-JSON runtime data: %s", (_label, isocan) => {
    expect(() => serializeDesign({ isocan }, "")).toThrow(/JSON|supported/);
  });

  it("refuses cycles and accessors without invoking them", () => {
    const cycle: Record<string, unknown> = {};
    cycle.next = cycle;
    expect(() => serializeDesign({ isocan: cycle }, "")).toThrow(/cyclic/);
    let reads = 0;
    const accessor = { get lint() { reads += 1; return { version: 1 }; } };
    expect(() => serializeDesign({ isocan: accessor }, "")).toThrow(/accessors/);
    expect(reads).toBe(0);
  });
});
