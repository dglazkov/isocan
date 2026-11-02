import type { AuditRange } from "./designaudit.ts";
import type { DesignTokens } from "./designmd.ts";
import { resolveToken } from "./designmd.ts";

/** A supported recipe separates fixed visual declarations from documented caller controls. */
export interface DesignRecipeContract { owns: Record<string, string>; allow: string[]; treatments: Record<string, Record<string, string>> }
/** Exceptions require a named recipe, explicit owned properties and a visible reason. */
export interface DesignContractException { recipe: string; properties: string[]; reason: string }
/** The normalized version-one contract retains authored token references for both clients to display. */
export interface EffectiveDesignContract { version: 1; literals: "allow" | "require-references"; recipes: Record<string, DesignRecipeContract>; exceptions: Record<string, DesignContractException> }
/** Invalid or unsupported policy data stays attributable to its path in the governing document. */
export interface DesignPolicyProblem { code: string; path: string; message: string }
/** Policy evidence travels with the actual HTML report, while governing document identity stays in its envelope. */
export interface DesignContractPolicy {
  status: "default" | "supported" | "partial" | "unsupported";
  original: unknown | null;
  effective: EffectiveDesignContract | null;
  problems: DesignPolicyProblem[];
  boundary: string;
  appliedTreatments: { recipe: string; name: string; range: AuditRange }[];
  appliedExceptions: { recipe: string; name: string; properties: string[]; reason: string; range: AuditRange }[];
}

const own = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const identifier = /^[A-Za-z_][A-Za-z0-9_-]*$/;
const propertyName = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const sides = ["top", "right", "bottom", "left"];
const corners = ["top-left", "top-right", "bottom-right", "bottom-left"];
const ownedProperties = new Set(["padding", ...sides.map(side => `padding-${side}`), "border-radius", ...corners.map(corner => `border-${corner}-radius`), "font-size", "font-weight"]);
const length = /^(?:0|(?:\d*\.)?\d+(?:px|em|rem|ex|rex|cap|rcap|ch|rch|ic|ric|lh|rlh|vw|vh|vi|vb|vmin|vmax|svw|svh|svi|svb|svmin|svmax|lvw|lvh|lvi|lvb|lvmin|lvmax|dvw|dvh|dvi|dvb|dvmin|dvmax|cqw|cqh|cqi|cqb|cqmin|cqmax|cm|mm|q|in|pt|pc|%))$/i;

/** Resolve scalar DESIGN.md references recursively; cycles and structured tokens cannot become CSS rules. */
export function resolveContractValue(tokens: DesignTokens, value: string, seen: string[] = []): string | null {
  if (seen.length > 32) return null;
  let failed = false;
  const resolved = value.replace(/\{([^{}]+)\}/g, (reference: string) => {
    if (seen.includes(reference)) { failed = true; return ""; }
    const token = resolveToken(tokens, reference);
    if (typeof token !== "string" && !(typeof token === "number" && Number.isFinite(token))) { failed = true; return ""; }
    const next = resolveContractValue(tokens, String(token), [...seen, reference]);
    if (next === null) { failed = true; return ""; }
    return next;
  });
  return failed || /[{}]/.test(resolved) ? null : resolved.trim();
}

/** Expand supported physical shorthands so longhand overrides cannot evade an owned family. */
export function contractLonghands(property: string): string[] {
  return property === "padding" ? sides.map(side => `padding-${side}`) : property === "border-radius" ? corners.map(corner => `border-${corner}-radius`) : [property];
}

function supportedValue(property: string, value: string): boolean {
  // The analyzer resolves exported CSS variables before matching. The schema
  // accepts only this bounded expression form, never arbitrary CSS functions.
  const scalar = value.replace(/var\(\s*--[\w-]+\s*\)/g, property === "font-weight" ? "400" : "1px");
  if (property === "font-weight") return /^(?:normal|bold|[1-9]\d{0,2}|1000)$/.test(scalar);
  if (property === "font-size") return length.test(scalar) || /^(?:xx-small|x-small|small|medium|large|x-large|xx-large|xxx-large)$/.test(scalar);
  const axes = scalar.split("/");
  const radius = property.includes("radius");
  if (axes.length > (radius ? 2 : 1)) return false;
  if (radius && property !== "border-radius") return axes.length === 1 && scalar.trim().split(/\s+/).length <= 2 && scalar.trim().split(/\s+/).every(one => length.test(one));
  return axes.every(axis => { const values = axis.trim().split(/\s+/); return values.length <= (property === "padding" || property === "border-radius" ? 4 : 1) && values.every(one => length.test(one)); });
}

/** Validate the declarative boundary without importing HTML/CSS parsers into normal document operations. */
export function compileDesignContract(tokens: DesignTokens): DesignContractPolicy {
  const extension = (tokens as DesignTokens & { isocan?: unknown }).isocan;
  const report: DesignContractPolicy = {
    status: "default", original: extension ?? null,
    effective: { version: 1, literals: "allow", recipes: {}, exceptions: {} }, problems: [],
    boundary: "Version 1 checks inline declarations and direct static type, class, ID and exact attribute selectors. Padding, physical radius corners, font size and weight are supported; external, dynamic and unresolved cascade paths remain unexamined.",
    appliedTreatments: [], appliedExceptions: [],
  };
  const problem = (path: string, message: string, code = "unsupported-policy") => { report.problems.push({ code, path, message }); };
  const unknown = (value: Record<string, unknown>, allowed: string[], path: string) => {
    for (const key of Object.keys(value)) if (!allowed.includes(key)) problem(`${path}.${key}`, `Unknown contract field ${key}.`);
  };
  if (extension === undefined) return report;
  if (!object(extension)) { problem("isocan", "The isocan extension must be an object."); report.status = "unsupported"; report.effective = null; return report; }
  if (!own(extension, "lint")) return report;
  const lint = extension.lint;
  if (!object(lint) || lint.version !== 1) {
    problem("isocan.lint.version", "Only integer contract version 1 is supported; marker semantics are unexamined."); report.status = "unsupported"; report.effective = null; return report;
  }
  report.status = "supported";
  const effective = report.effective!;
  unknown(lint, ["version", "literals", "recipes", "exceptions"], "isocan.lint");
  if (lint.literals !== undefined) {
    if (lint.literals === "allow" || lint.literals === "require-references") effective.literals = lint.literals;
    else problem("isocan.lint.literals", "literals must be allow or require-references.");
  }
  const mapping = (value: unknown, path: string): Record<string, unknown> => {
    if (value === undefined) return {};
    if (object(value)) return value;
    problem(path, "Expected a map."); return {};
  };
  const names = (value: unknown, path: string): string[] => {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.some(one => typeof one !== "string" || !propertyName.test(one))) { problem(path, "Expected a list of lowercase CSS property names."); return []; }
    return [...new Set(value as string[])];
  };
  const values = (value: unknown, path: string, only?: Set<string>): Record<string, string> => {
    const result: Record<string, string> = {};
    for (const [property, raw] of Object.entries(mapping(value, path))) {
      if (!ownedProperties.has(property)) { problem(`${path}.${property}`, `Ownership of ${property} is unsupported in version 1.`); continue; }
      if (only && !only.has(property)) { problem(`${path}.${property}`, "A treatment may replace only a property explicitly named in owns."); continue; }
      if (typeof raw !== "string" || !raw.trim()) { problem(`${path}.${property}`, "An owned value must be a nonempty CSS value or token reference string."); continue; }
      const resolved = resolveContractValue(tokens, raw);
      if (resolved === null || !supportedValue(property, resolved)) { problem(`${path}.${property}`, "The value or its token references cannot be resolved within the supported static property grammar."); continue; }
      result[property] = raw.trim();
    }
    return result;
  };
  for (const [name, raw] of Object.entries(mapping(lint.recipes, "isocan.lint.recipes"))) {
    const path = `isocan.lint.recipes.${name}`;
    if (!identifier.test(name) || ["__proto__", "constructor", "prototype"].includes(name)) { problem(path, "Recipe names must be safe plain identifiers."); continue; }
    if (!object(raw)) { problem(path, "A recipe must be an object."); continue; }
    unknown(raw, ["owns", "allow", "treatments"], path);
    const recipe: DesignRecipeContract = { owns: values(raw.owns, `${path}.owns`), allow: names(raw.allow, `${path}.allow`), treatments: {} };
    effective.recipes[name] = recipe;
    for (const [treatment, overrides] of Object.entries(mapping(raw.treatments, `${path}.treatments`))) {
      if (!identifier.test(treatment) || ["__proto__", "constructor", "prototype"].includes(treatment)) { problem(`${path}.treatments.${treatment}`, "Treatment names must be safe plain identifiers."); continue; }
      recipe.treatments[treatment] = values(overrides, `${path}.treatments.${treatment}`, new Set(Object.keys(recipe.owns)));
    }
  }
  for (const [name, raw] of Object.entries(mapping(lint.exceptions, "isocan.lint.exceptions"))) {
    const path = `isocan.lint.exceptions.${name}`;
    if (!identifier.test(name) || ["__proto__", "constructor", "prototype"].includes(name)) { problem(path, "Exception names must be safe plain identifiers."); continue; }
    if (!object(raw)) { problem(path, "An exception must be an object."); continue; }
    unknown(raw, ["recipe", "properties", "reason"], path);
    const props = names(raw.properties, `${path}.properties`);
    const recipe = typeof raw.recipe === "string" && own(effective.recipes, raw.recipe) ? effective.recipes[raw.recipe] : undefined;
    if (!recipe || !props.length || props.some(property => !own(recipe.owns, property)) || typeof raw.reason !== "string" || !raw.reason.trim()) {
      problem(path, "An exception needs a known recipe, its explicit owned properties and a nonempty reason."); continue;
    }
    effective.exceptions[name] = { recipe: raw.recipe as string, properties: props, reason: raw.reason.trim() };
  }
  if (report.problems.length) report.status = "partial";
  return report;
}
