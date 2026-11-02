import { describe, expect, it } from "vitest";
import { auditScreen } from "../src/designaudit.ts";
import { compileDesignContract } from "../src/design-contract.ts";
import type { DesignTokens } from "../src/designmd.ts";

const lint = (literals = "allow") => ({ version: 1, literals,
  recipes: {
    Button: { owns: { padding: "{spacing.md}", "border-radius": "{rounded.control}" }, allow: ["margin", "align-self"], treatments: { compact: { padding: "{spacing.sm}" } } },
    Title: { owns: { "font-weight": "{typography.title.fontWeight}" }, allow: ["font-size"] },
  },
  exceptions: { hero: { recipe: "Button", properties: ["padding"], reason: "Acme #1 needs room." } },
});
const tokens = (policy: unknown = lint()): DesignTokens => ({ colors: { ink: "#112233", accent: "#445566" }, spacing: { md: "16px", sm: "8px" }, rounded: { control: "8px", small: "4px" }, typography: { body: { fontSize: "16px" }, title: { fontSize: "32px", fontWeight: 700 } }, isocan: { lint: policy } });
const css = '<style>:root{--color-ink:#112233;--color-accent:#445566;--space-md:16px;--space-sm:8px;--radius-control:8px;--radius-small:4px;--weight-title:700;--size-title:32px;--size-body:16px}</style>';
const check = (html: string, policy: unknown = lint()) => auditScreen(css + html, tokens(policy));
const codes = (html: string, policy: unknown = lint()) => check(html, policy).diagnostics.map(finding => finding.code);
const good = '<button data-isocan-recipe="Button" style="padding:16px;border-radius:8px;margin:8px;align-self:center">Acme</button>';

describe("declarative version-one validation", () => {
  it("keeps exact-literal defaults when there is no contract and retains unknown extension metadata", () => {
    expect(compileDesignContract({ colors: { ink: "#112233" }, isocan: { future: [null, false, "Acme #1"] } })).toMatchObject({ status: "default", effective: { literals: "allow" }, original: { future: [null, false, "Acme #1"] }, problems: [] });
  });
  it.each([2, "1", null])("unknown version %j leaves marker semantics unexamined", version => {
    const result = check(good, { ...lint(), version });
    expect(result.policy.status).toBe("unsupported");
    expect(result.policy.effective).toBeNull();
    expect(result.coverage.complete).toBe(false);
    expect(result.diagnostics).toEqual([]);
  });
  it.each([
    { ...lint(), unknown: true }, { ...lint(), literals: "anything" },
    { ...lint(), recipes: { Bad: { owns: { width: "16px" } } } },
    { ...lint(), recipes: { Bad: { owns: { padding: "{spacing.missing}" } } } },
    { ...lint(), recipes: { Bad: { owns: { padding: "{typography.title}" } } } },
    { ...lint(), recipes: { Bad: { owns: { padding: "calc(8px * 2)" } } } },
    { ...lint(), recipes: { Bad: { owns: { padding: "16px" }, treatments: { extra: { "border-radius": "8px" } } } } },
  ])("unsupported fields and values produce policy problems: %j", policy => {
    const result = check("<p>Acme</p>", policy);
    expect(result.policy.status).toBe("partial");
    expect(result.policy.problems.length).toBeGreaterThan(0);
    expect(result.coverage.complete).toBe(false);
  });
  it.each(["constructor", "__proto__", "toString"])("prototype name %s is never a policy grant or a crash", name => {
    const policy = { ...lint(), exceptions: { bad: { recipe: name, properties: ["padding"], reason: "Acme" } } };
    expect(compileDesignContract(tokens(policy)).status).toBe("partial");
    expect(codes(`<p data-isocan-recipe="${name}">Acme</p>`)).toContain("design/unknown-recipe");
    expect(codes(good.replace('style=', `data-isocan-treatment="${name}" data-isocan-exception="${name}" style=`))).toEqual(expect.arrayContaining(["design/unknown-treatment", "design/unknown-exception"]));
  });
});

describe("explicit ownership stays separate from token membership", () => {
  it("allows Button placement without relinquishing padding/radius", () => {
    expect(check(good)).toMatchObject({ diagnostics: [], coverage: { complete: true }, policy: { status: "supported" } });
  });
  it("rejects a different declared spacing token and physical corner override", () => {
    const result = check(good.replace('padding:16px', 'padding:16px;padding-top:8px').replace('border-radius:8px', 'border-radius:8px;border-top-right-radius:4px'));
    expect(result.offSystem).toEqual([]);
    expect(result.diagnostics.filter(f => f.code === "design/owned-value").map(f => f.property)).toEqual(["padding-top", "border-top-right-radius"]);
  });
  it("normalizes physical longhands and both elliptical corner axes", () => {
    const longhand = good.replace('padding:16px;border-radius:8px', 'padding-top:16px;padding-right:16px;padding-bottom:16px;padding-left:16px;border-top-left-radius:8px 8px;border-top-right-radius:8px;border-bottom-left-radius:8px;border-bottom-right-radius:8px');
    expect(check(longhand).diagnostics).toEqual([]);
    expect(codes(longhand.replace('border-top-left-radius:8px 8px', 'border-top-left-radius:8px 4px'))).toContain("design/owned-value");
  });
  it("checks simple and compound static selectors with an inline winning override", () => {
    const result = check('<style>button.control#primary[data-isocan-recipe="Button"]{padding:16px;border-radius:8px}</style><button class="control" id="primary" data-isocan-recipe="Button" style="padding-top:8px">Acme</button>');
    expect(result.coverage.complete).toBe(true);
    expect(result.offSystem).toEqual([]);
    expect(result.diagnostics).toMatchObject([{ code: "design/owned-value", property: "padding-top", actual: "8px" }]);
  });
  it("orders direct selector rules and important declarations instead of ignoring the cascade", () => {
    const result = check('<style>.control{padding:8px;border-radius:8px}#primary{padding:16px!important}</style><button class="control" id="primary" data-isocan-recipe="Button" style="padding:8px">Acme</button>');
    expect(result.diagnostics).toEqual([]);
    expect(result.coverage.complete).toBe(true);
  });
  it("reports missing owned declarations and unapproved explicit caller controls", () => {
    const result = check('<button data-isocan-recipe="Button" style="width:100px">Acme</button>');
    expect(result.diagnostics.some(f => f.code === "design/unapproved-property" && f.property === "width")).toBe(true);
    expect(result.diagnostics.filter(f => f.code === "design/missing-owned-property")).toHaveLength(8);
  });
  it("generic classes do not select recipes", () => {
    expect(check('<button class="Button" style="padding:8px">Acme</button>').diagnostics).toEqual([]);
  });
  it("Title permits another declared size but keeps weight", () => {
    expect(check('<h1 data-isocan-recipe="Title" style="font-size:16px;font-weight:700">Acme</h1>').diagnostics).toEqual([]);
    expect(codes('<h1 data-isocan-recipe="Title" style="font-size:16px;font-weight:400">Acme</h1>')).toContain("design/owned-value");
  });
});

describe("treatments, reasoned exceptions and strict references", () => {
  it("explicit compact treatment changes only its owned padding", () => {
    const result = check(good.replace('style=', 'data-isocan-treatment="compact" style=').replace('padding:16px', 'padding:8px'));
    expect(result.diagnostics).toEqual([]);
    expect(result.policy.appliedTreatments).toMatchObject([{ recipe: "Button", name: "compact" }]);
  });
  it("a reasoned exception relaxes only named ownership/reference checks, never token membership", () => {
    const html = '<button data-isocan-recipe="Button" data-isocan-exception="hero" style="padding:8px;border-radius:var(--radius-control)">Acme</button>';
    const result = check(html, lint("require-references"));
    expect(result.diagnostics).toEqual([]);
    expect(result.policy.appliedExceptions).toMatchObject([{ name: "hero", recipe: "Button", properties: ["padding"], reason: "Acme #1 needs room." }]);
    expect(codes(html.replace('padding:8px', 'padding:13px'), lint("require-references"))).toContain("design/off-scale-spacing");
    expect(codes(html.replace('var(--radius-control)', '4px'), lint("require-references"))).toContain("design/owned-value");
  });
  it("does not grant an exception with an empty reason or another recipe", () => {
    const policy = lint(); policy.exceptions.hero.reason = " ";
    expect(check(good.replace('style=', 'data-isocan-exception="hero" style='), policy).policy.appliedExceptions).toEqual([]);
    expect(codes('<h1 data-isocan-recipe="Title" data-isocan-exception="hero" style="font-weight:400">Acme</h1>')).toContain("design/unknown-exception");
  });
  it.each([
    ['color:#112233', true], ['--local:#112233;color:var(--local)', true],
    ['--local:var(--color-ink);color:var(--local)', false], ['color:var(--color-ink)', false],
    ['--color-ink:#445566;color:var(--color-ink)', true],
  ])("strict reference tracing distinguishes %s", (style, fails) => {
    const result = check(`<p style="${style}">Acme</p>`, lint("require-references"));
    expect(result.diagnostics.some(f => f.code === "design/reference-required")).toBe(fails);
    expect(result.offSystem).toEqual([]);
  });
  it("strict owned weight uses the actual declared export and rejects literal aliases", () => {
    expect(codes('<h1 data-isocan-recipe="Title" style="font-weight:var(--weight-title)">Acme</h1>', lint("require-references"))).toEqual([]);
    expect(codes('<h1 data-isocan-recipe="Title" style="--weight:700;font-weight:var(--weight)">Acme</h1>', lint("require-references"))).toContain("design/reference-required");
  });
});

describe("unsupported paths never claim full ownership coverage", () => {
  it.each([
    '<link rel="stylesheet" href="acme.css">',
    '<style>button:hover{padding:8px}</style>',
    '<style>@media print{button{padding:8px}}</style>',
    '<style>section button{padding:8px}</style>',
    '<script>document.body.dataset.example="Acme"</script>',
  ])("unknown styling %s prevents a clean ownership conclusion", prefix => {
    const result = check(prefix + good);
    expect(result.coverage.complete).toBe(false);
    expect(result.coverage.unexamined.some(one => one.code === "unsupported-contract-cascade")).toBe(true);
  });
  it("font shorthand cannot bypass owned font weight", () => {
    const result = check('<h1 data-isocan-recipe="Title" style="font:400 16px sans-serif">Acme</h1>');
    expect(result.coverage.complete).toBe(false);
    expect(result.coverage.unexamined.some(one => one.code === "unsupported-contract-property")).toBe(true);
  });
  it("an unresolved value is coverage, not a definite owned-value comparison", () => {
    const result = check(good.replace('padding:16px', 'padding:calc(8px * 2)'));
    expect(result.coverage.complete).toBe(false);
    expect(result.diagnostics.filter(f => f.code === "design/owned-value")).toEqual([]);
  });
});

describe("the conductor's independent ownership boundaries", () => {
  it("allowing border-radius does not allow border-color", () => {
    const policy = { version: 1, recipes: { Acme: { owns: { "font-weight": "600" }, allow: ["border-radius"] } } };
    const result = check('<p data-isocan-recipe="Acme" style="font-weight:600;border-color:#112233">Acme</p>', policy);
    expect(result.diagnostics).toMatchObject([{ code: "design/unapproved-property", property: "border-color" }]);
  });
  it("owning one side does not approve a shorthand's other sides", () => {
    const policy = { version: 1, recipes: { Acme: { owns: { "padding-top": "16px" } } } };
    const result = check('<p data-isocan-recipe="Acme" style="padding:16px 8px">Acme</p>', policy);
    expect(result.diagnostics).toMatchObject([{ code: "design/unapproved-property", property: "padding" }]);
    expect(result.offSystem).toEqual([]);
  });
  it("matches HTML attribute selector names without case sensitivity", () => {
    const policy = { version: 1, recipes: { Acme: { owns: { padding: "16px" } } } };
    const result = check('<style>[DATA-KIND="action"]{padding:8px!important}</style><p data-kind="action" data-isocan-recipe="Acme" style="padding:16px">Acme</p>', policy);
    expect(result.coverage.complete).toBe(true);
    expect(result.diagnostics.filter(f => f.code === "design/owned-value")).toHaveLength(4);
  });
  it("strict reference repairs identify matching exported names and CSS prerequisites", () => {
    const result = auditScreen('<p style="border-radius:8px">Acme</p>', tokens(lint("require-references")));
    expect(result.diagnostics).toMatchObject([{ code: "design/reference-required", candidates: [{ token: "--radius-control", value: "var(--radius-control)", prerequisites: [expect.stringContaining("isocan design --css")] }] }]);
  });
});

it("inherited authored weight is unexamined rather than falsely absent", () => {
  const result = check('<div style="font-weight:700"><h1 data-isocan-recipe="Title">Acme</h1></div>');
  expect(result.diagnostics.some(f => f.code === "design/missing-owned-property")).toBe(false);
  expect(result.coverage.unexamined.some(f => f.code === "unsupported-contract-inheritance")).toBe(true);
});

it("strict references keep the native supported color equivalence", () => {
  const result = auditScreen('<style>:root{--color-ink:rgb(17,34,51)}</style><p style="color:var(--color-ink)">Acme</p>', tokens(lint("require-references")));
  expect(result.diagnostics).toEqual([]);
  expect(result.coverage.complete).toBe(true);
});

describe("escaped selectors cannot hide a winning ownership override", () => {
  const policy = { version: 1, recipes: { Button: { owns: { padding: "16px" }, allow: [] } } };
  it.each([
    [String.raw`.acme\:control`, 'class="acme:control"'],
    [String.raw`#acme\:control`, 'id="acme:control"'],
    [String.raw`[data-kind=acme\:control]`, 'data-kind="acme:control"'],
    [String.raw`[data\-kind="control"]`, 'data-kind="control"'],
    [String.raw`.acme\3a control`, 'class="acme:control"'],
  ])("retained identifier escapes in %s make coverage incomplete", (selector, attrs) => {
    const result = check(`<style>${selector}{padding:8px!important}</style><button ${attrs} data-isocan-recipe="Button" style="padding:16px">Acme</button>`, policy);
    expect(result.coverage.complete).toBe(false);
    expect(result.coverage.unexamined.some(one => one.code === "unsupported-contract-cascade")).toBe(true);
    expect(result.offSystem).toEqual([]);
  });
  it.each([String.raw`[data-kind="acme\:control"]`, String.raw`[data-kind="acme\3a control"]`])("uses the parser's decoded quoted value in %s", selector => {
    const result = check(`<style>${selector}{padding:8px!important}</style><button data-kind="acme:control" data-isocan-recipe="Button" style="padding:16px">Acme</button>`, policy);
    expect(result.coverage.complete).toBe(true);
    expect(result.diagnostics.filter(one => one.code === "design/owned-value")).toHaveLength(4);
    expect(result.offSystem).toEqual([]);
  });
});
