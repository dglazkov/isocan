import { describe, expect, it } from "vitest";
import { auditScreen, type ScreenAudit } from "../src/designaudit.ts";
import type { DesignTokens } from "../src/designmd.ts";

const tokens: DesignTokens = { name: "Acme", colors: { ink: "#112233", paper: "#fff" }, spacing: { mediumGap: "16px" }, rounded: { card: "8px" }, typography: { body: { fontSize: "16px" } } };
const codes = (report: ScreenAudit) => report.diagnostics.map(d => d.code);
const unexamined = (report: ScreenAudit) => report.coverage.unexamined.map(d => d.code);
const audit = (source: string) => auditScreen(source, tokens);

describe("the seven recorded native HTML probes", () => {
  it.each([
    ['<p style="color:#112233">Acme</p>', 1, [], []],
    ['<p style="color:#ff0000">Acme</p>', 0, ["#ff0000"], ["design/off-scale-color"]],
    ['<p style="color:var(--missing)">Acme</p>', 0, [], ["design/missing-variable"]],
    ['<p style="color:var(--missing,#ff0000)">Acme</p>', 0, ["#ff0000"], ["design/missing-variable", "design/off-scale-color"]],
    ['<p style="padding:13px">Acme</p>', 0, ["13px"], ["design/off-scale-spacing"]],
    ['<p style="font:13px sans-serif">Acme</p>', 0, ["13px"], ["design/off-scale-font-size"]],
    ['<p>#ff0000</p>', 0, [], []],
  ] as const)("classifies %s", (source, onSystem, off, expectedCodes) => {
    const report = audit(source);
    expect(report.onSystem).toBe(onSystem);
    expect(report.offSystem.map(v => v.value)).toEqual(off);
    expect(codes(report)).toEqual(expectedCodes);
    expect(report.ruleVersion).toBe("1.0.0");
  });
});

describe("references resolve their values and never earn credit from their names", () => {
  it("uses the exporter's actual names and excludes an unused fallback", () => {
    const report = audit('<style>:root{--color-ink:#112233;--space-medium-gap:16px}</style><p style="color:var(--color-ink,#ff0000);padding:var(--space-medium-gap)">Acme</p>');
    expect(report.onSystem).toBe(2);
    expect(report.diagnostics).toEqual([]);
  });
  it.each(['<style>:root{--local:var(--color-ink)}p{color:var(--local)}</style>', '<p style="--local:var(--color-ink);color:var(--local)">Acme</p>', '<style>p{--local:var(--color-ink);color:var(--local)}</style>'])("resolves an unambiguous local alias: %s", source => {
    expect(audit(`<style>:root{--color-ink:#112233}</style>${source}`)).toMatchObject({ onSystem: 1, diagnostics: [], coverage: { complete: true } });
  });
  it("does not pretend DESIGN.md injected runtime CSS into the artifact", () => {
    const report = audit('<p style="color:var(--color-ink)">Acme</p>');
    expect(report.onSystem).toBe(0);
    expect(codes(report)).toEqual(["design/missing-token-declaration"]);
    expect(report.diagnostics[0]?.candidates[0]?.prerequisites[0]).toContain("isocan design --css");
  });
  it("makes token declaration prerequisites explicit on literal repair candidates", () => {
    const missing = audit('<p style="padding:13px">Acme</p>').diagnostics[0]!.candidates[0]!;
    const declared = audit('<p style="--space-medium-gap:16px;padding:13px">Acme</p>').diagnostics[0]!.candidates[0]!;
    expect(missing.prerequisites).toHaveLength(1);
    expect(declared.prerequisites).toEqual([]);
  });
  it("checks the value of a locally redefined exported variable", () => {
    const source = '<style>:root{--color-ink:#ff0000}p{color:var(--color-ink)}</style>';
    const report = audit(source);
    expect(report.onSystem).toBe(0);
    expect(report.offSystem[0]?.value).toBe("#ff0000");
    const finding = report.diagnostics[0]!;
    expect(source.slice(finding.range.start.offset, finding.range.end.offset)).toBe("#ff0000");
    expect(finding.candidates.some(c => c.token === "--color-ink")).toBe(false); // would create a self-cycle
  });
  it("checks nested fallbacks", () => {
    const report = audit('<p style="color:var(--a,var(--b,#ff0000))">Acme</p>');
    expect(codes(report)).toEqual(["design/missing-variable", "design/missing-variable", "design/off-scale-color"]);
    expect(report.onSystem).toBe(0);
  });
  it.each([
    ':root{--a:var(--a,#112233)}',
    ':root{--a:var(--b,#112233);--b:var(--a)}',
    ':root{--a:var(--color-ink,var(--a))}', // even an unused fallback participates in CSS's dependency cycle
  ])("never lets a variable rescue its own cycle: %s", declarations => {
    const report = audit(`<style>${declarations}p{color:var(--a,#ff0000)}</style>`);
    expect(codes(report)).toContain("design/cyclic-variable");
    expect(report.offSystem.map(v => v.value)).toEqual(["#ff0000"]);
    expect(report.onSystem).toBe(0);
  });
  it("uses the consumer fallback when a declared variable is invalid", () => {
    const report = audit('<style>:root{--a:var(--missing)}p{color:var(--a,#ff0000)}</style>');
    expect(codes(report)).toContain("design/missing-variable");
    expect(codes(report)).toContain("design/invalid-variable");
    expect(report.offSystem.map(v => v.value)).toEqual(["#ff0000"]);
  });
  it("does not recompute a root alias under an element's local override", () => {
    const report = audit('<style>:root{--a:#ff0000;--b:var(--a)}p{--a:#112233;color:var(--b)}</style>');
    expect(report.onSystem).toBe(0);
    expect(unexamined(report)).toContain("ambiguous-cascade");
  });
  it("can use a conforming fallback outside a cyclic variable", () => {
    const report = audit('<style>:root{--a:var(--a);--b:var(--a,#112233)}p{color:var(--b)}</style>');
    expect(report.onSystem).toBe(1);
    expect(codes(report)).toContain("design/cyclic-variable");
  });
  it.each([
    '<style>.other{--local:#112233}p{color:var(--local)}</style>',
    '<style>:root{--local:#112233}:root{--local:#ff0000}p{color:var(--local)}</style>',
    '<style>@media (min-width:1px){:root{--local:#112233}}p{color:var(--local)}</style>',
    '<style media="print">:root{--local:#112233}</style><p style="color:var(--local)">Acme</p>',
  ])("does not pretend to resolve selector-dependent cascade: %s", source => {
    const report = audit(source);
    expect(report.onSystem).toBe(0);
    expect(unexamined(report)).toContain("ambiguous-cascade");
    expect(report.coverage.complete).toBe(false);
  });
  it("reports registered properties as unexamined", () => {
    const report = audit('<style>@property --local{syntax:"<color>";inherits:false;initial-value:#112233}p{color:var(--local)}</style>');
    expect(report.onSystem).toBe(0);
    expect(unexamined(report)).toContain("unsupported-registration");
    expect(codes(report)).not.toContain("design/missing-variable");
  });
});

describe("CSS boundaries and useful source selections", () => {
  it("ignores prose, comments, strings and URL fragments", () => {
    const report = audit('<p>#ff0000</p><!-- color:#ff0000 --><style>/* color:#ff0000 */p{background-image:url("icon.svg#ff0000");content:"color:#ff0000"}</style>');
    expect(report.diagnostics).toEqual([]);
    expect(report.onSystem).toBe(0);
  });
  it("maps every repeated inline/SVG/style finding to its original source value", () => {
    const source = '<style>\np { color:#ff0000 }\n</style>\n<p style="padding:13px">Acme</p>\n<svg><path fill="#ff0000"/></svg>';
    const report = audit(source);
    expect(report.diagnostics.map(d => source.slice(d.range.start.offset, d.range.end.offset))).toEqual(["#ff0000", "13px", "#ff0000"]);
    expect(report.diagnostics.map(d => d.range.start.line)).toEqual([2, 4, 5]);
    expect(report.offSystem[0]).toMatchObject({ value: "#ff0000", count: 2, line: 2 });
    expect(report.diagnostics[1]?.candidates[0]?.value).toBe("var(--space-medium-gap)");
    expect(report.diagnostics.every(d => d.candidates.every(c => c.requiresReview))).toBe(true);
  });
  it.each(['&#35;ff0000', '&#x23;ff0000'])('maps decoded HTML character references: %s', encoded => {
    const source = `<p style="color:${encoded};padding:13px">Acme</p>`;
    const report = audit(source);
    expect(report.diagnostics[0]?.actual).toBe("#ff0000");
    expect(report.diagnostics.map(d => source.slice(d.range.start.offset, d.range.end.offset))).toEqual([encoded, "13px"]);
  });
  it("checks logical spacing and shorthands without calling geometry spacing", () => {
    const report = audit('<p style="padding-inline:13px 16px;margin:0 auto;gap:13px;width:13px;height:13px;top:13px;border-radius:8px 3px/8px 0;font:italic bold 13px/1.3 sans-serif">Acme</p>');
    expect(report.offSystem).toEqual([
      { value: "13px", kind: "spacing", count: 2, line: 1 },
      { value: "3px", kind: "radius", count: 1, line: 1 },
      { value: "13px", kind: "type size", count: 1, line: 1 },
    ]);
    expect(report.diagnostics.every(d => !["width", "height", "top"].includes(d.property!))).toBe(true);
  });
  it("keeps numeric trailing zeroes (10px is not 1px)", () => {
    expect(auditScreen('<p style="padding:10px">Acme</p>', { spacing: { small: "1px" } }).offSystem[0]?.value).toBe("10px");
  });
});

describe("coverage prevents a zero from impersonating a complete check", () => {
  it.each([
    ['<script>const color="#ff0000"</script>', 'dynamic-style'],
    ['<p onclick="this.style.color=\'#ff0000\'">Acme</p>', 'dynamic-style'],
    ['<link rel="stylesheet" href="https://example.invalid/acme.css">', 'external-style'],
    ['<style>@import "https://example.invalid/acme.css";</style>', 'external-style'],
    ['<p style="padding:calc(8px * 2)">Acme</p>', 'unsupported-expression'],
    ['<p style="font-size:16widgets">Acme</p>', 'unsupported-expression'],
    ['<p style="color:color-mix(in srgb,#112233,#fff)">Acme</p>', 'unsupported-expression'],
    ['<p style="color:white">Acme</p>', 'unsupported-color-equivalence'],
    ['<p style="color:oklch(1 0 0)">Acme</p>', 'unsupported-color-equivalence'],
    ['<style>p{color:rgb(1,2,3</style>', 'malformed-css'],
    ['<p style="color:var(--color-ink">Acme</p>', 'malformed-css'],
    ['<p style="color:#112233" style="color:#ff0000">Acme</p>', 'malformed-html'],
    ['<template><style>:root{--local:#112233}</style></template><p style="color:var(--local)">Acme</p>', 'dynamic-style'],
  ])('classifies %s as %s', (source, code) => {
    const report = audit(source);
    expect(unexamined(report)).toContain(code);
    expect(report.coverage.complete).toBe(false);
    expect(report.offSystem).toEqual([]);
  });
  it("recovers useful declarations around malformed source", () => {
    const report = audit('<style>p{color:#ff0000;broken;padding:13px}</style>');
    expect(report.offSystem.map(v => v.value)).toEqual(["#ff0000", "13px"]);
    expect(unexamined(report)).toContain("malformed-css");
  });
  it("reports omitted categories without inventing a rule", () => {
    const report = auditScreen('<p style="padding:13px;border-radius:3px">Acme</p>', { colors: { ink: "#112233" } });
    expect(report.offSystem).toEqual([]);
    expect(report.coverage.omittedCategories).toEqual(["type size", "radius", "spacing"]);
  });
  it.each([{ spacing: { md: "calc(8px * 2)" } }, { spacing: { md: "{spacing.missing}" } }, { spacing: { md: "{spacing.md}" } }])("cannot assert nonmembership against unresolved system values: %j", system => {
    const report = auditScreen('<p style="padding:16px">Acme</p>', system);
    expect(report.offSystem).toEqual([]);
    expect(unexamined(report)).toContain("unsupported-system-token");
    expect(report.coverage.omittedCategories).not.toContain("spacing");
  });
  it("attributes an invalid exported token reference to its use, not generated CSS offset zero", () => {
    const source = '<p style="padding:var(--space-md)">Acme</p>';
    const report = auditScreen(source, { spacing: { md: "{spacing.missing}" } });
    expect(report.onSystem).toBe(0);
    const finding = report.diagnostics[0]!;
    expect(source.slice(finding.range.start.offset, finding.range.end.offset)).toBe("var(--space-md)");
  });
  it("accepts exact named or non-sRGB tokens without inventing color conversion", () => {
    expect(auditScreen('<p style="color:white;background:oklch(1 0 0)">Acme</p>', { colors: { paper: "white", snow: "oklch(1 0 0)" } }).onSystem).toBe(2);
  });
});
