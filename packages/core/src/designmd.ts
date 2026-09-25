/**
 * DESIGN.md — a design system both a person and an agent can read.
 *
 * The format is Google Labs' (github.com/google-labs-code/design.md,
 * Apache-2.0): YAML front matter carrying typed design tokens, then markdown
 * sections carrying the reasoning. The tokens are normative and the prose says
 * how to apply them, which is exactly the split this canvas needs — an agent
 * grading a screen wants numbers, and a person deciding what to build wants
 * sentences.
 *
 * Adopting somebody's format rather than inventing one is the whole point: the
 * same file works in other tools, converts to and from `tokens.json` and
 * Figma variables, and does not need this canvas to be present to be useful.
 *
 * THE YAML HERE IS A SUBSET, deliberately. Core has one dependency and a YAML
 * library would land in every install of isocan to serve the canvases that
 * have a design system. What the schema actually uses is maps up to three deep,
 * scalar values, and one list of strings-or-small-maps — so that is what this
 * reads, and anything outside it is reported rather than guessed at. The
 * isocan extension also accepts canonical JSON flow values for lossless,
 * opaque storage of future policy data without a general YAML runtime.
 */

export interface DesignTypography {
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: number | string;
  lineHeight?: string | number;
  letterSpacing?: string;
  fontFeature?: string;
  fontVariation?: string;
}

export interface DesignTokens {
  /** Opaque JSON-compatible vendor data; policy validation is separate. */
  isocan?: unknown;
  version?: string;
  name?: string;
  description?: string;
  /** Sections left out on purpose, so a linter stays quiet about them. */
  omitted?: (string | { section: string; reason?: string })[];
  colors?: Record<string, string>;
  typography?: Record<string, DesignTypography>;
  rounded?: Record<string, string>;
  spacing?: Record<string, string | number>;
  components?: Record<string, Record<string, string>>;
  /**
   * **How the system's surfaces are drawn** — isocan's addition to the format
   * (24 Sep 2026, wire styles): `flat`, `raised`, `glass` or `bold`. A colour
   * token cannot say "cards float on a shadow" or "panes are frosted glass",
   * and those are the difference between Material and Fluent more than any
   * hex is. Optional, and read tolerantly: absent or unknown is `flat`
   * (`designSurface`), and `design check` warns on a value it does not know.
   */
  surface?: string;
}

/**
 * The surface treatments a DESIGN.md may name, in its `surface:` token.
 *
 * - `flat` — borders and grey steps separate things; the default.
 * - `raised` — elevation: cards, bars, sheets and dialogs sit on soft shadows.
 * - `glass` — translucent panes, blurred over a gradient ground drawn from
 *   the system's own colours.
 * - `bold` — thick ink borders and hard offset shadows.
 */
export const DESIGN_SURFACES = ["flat", "raised", "glass", "bold"] as const;
/** One of `DESIGN_SURFACES`. */
export type DesignSurface = (typeof DESIGN_SURFACES)[number];

/** The surface a system asks for — `flat` when it names none, or one this canvas does not know. */
export function designSurface(tokens: DesignTokens): DesignSurface {
  const named = typeof tokens.surface === "string" ? tokens.surface.trim().toLowerCase() : "";
  return (DESIGN_SURFACES as readonly string[]).includes(named) ? named as DesignSurface : "flat";
}

export interface DesignDoc {
  tokens: DesignTokens;
  /** Everything after the front matter, verbatim. */
  body: string;
  /** `## Heading` → its prose, in the order they appear. */
  sections: { title: string; body: string }[];
  /** What could not be read, said rather than swallowed. */
  problems: string[];
}

/** The section order the spec asks for. */
export const DESIGN_SECTIONS = [
  "Overview",
  "Colors",
  "Typography",
  "Layout",
  "Elevation & Depth",
  "Shapes",
  "Components",
  "Do's and Don'ts",
];

/** Headings the spec allows as another name for the same section. */
const SECTION_ALIASES: Record<string, string> = {
  "brand & style": "Overview",
  "layout & spacing": "Layout",
  elevation: "Elevation & Depth",
  "dos and don'ts": "Do's and Don'ts",
  "do's and don'ts": "Do's and Don'ts",
};

/** The canonical name of a heading, or the heading itself when it is not one
 * of the spec's sections. */
export function canonicalSection(heading: string): string {
  const key = heading.trim().toLowerCase();
  if (SECTION_ALIASES[key]) return SECTION_ALIASES[key]!;
  const match = DESIGN_SECTIONS.find((section) => section.toLowerCase() === key);
  return match ?? heading.trim();
}

// ---- the YAML subset ----

interface Line {
  indent: number;
  text: string;
  n: number;
}

const UNSAFE_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const parsedProblems = new WeakMap<object, string[]>();

/** Reject values JSON would silently drop, execute, or change. Shared by the
 * native and interchange writers; this does not interpret contract rules. */
export function assertJsonCompatible(value: unknown, path = "isocan", ancestors = new Set<object>()): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number" && Number.isFinite(value) && !Object.is(value, -0)) return;
  if (typeof value !== "object") throw new Error(`${path}: ${typeof value} value is not losslessly JSON-compatible`);
  if (ancestors.has(value)) throw new Error(`${path}: cyclic data is not JSON-compatible`);
  const array = Array.isArray(value);
  if (!array && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
    throw new Error(`${path}: only plain JSON objects and arrays are supported`);
  }
  ancestors.add(value);
  if (array && Object.keys(value).length !== value.length) throw new Error(`${path}: sparse arrays or extra array properties are not supported`);
  for (const key of Reflect.ownKeys(value)) {
    if (array && key === "length") continue;
    if (typeof key !== "string" || UNSAFE_KEYS.has(key)) throw new Error(`${path}: unsafe or symbol key ${String(key)} is not supported`);
    if (array && !/^(0|[1-9]\d*)$/.test(key)) throw new Error(`${path}: extra array key ${key} is not supported`);
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (!("value" in descriptor) || !descriptor.enumerable) throw new Error(`${path}.${key}: accessors and non-enumerable data are not supported`);
    assertJsonCompatible(descriptor.value, `${path}.${key}`, ancestors);
  }
  ancestors.delete(value);
}

/** JSON.parse itself erases duplicate members. Inspect its validated token
 * stream first so even unknown future contract data cannot lose a rule. */
export function parseDesignJson(text: string): unknown {
  const value: unknown = JSON.parse(text);
  const parts = text.match(/"(?:\\.|[^"\\])*"|[{}[\]:,]|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/g) ?? [];
  let at = 0;
  const inspect = (): void => {
    const next = parts[at++];
    if (next === "{") {
      const keys = new Set<string>();
      while (parts[at] !== "}") {
        const key = JSON.parse(parts[at++]!) as string;
        if (keys.has(key)) throw new Error(`duplicate key "${key}" is not supported`);
        if (UNSAFE_KEYS.has(key)) throw new Error(`unsafe key "${key}" is not supported`);
        keys.add(key);
        at += 1; // colon
        inspect();
        if (parts[at] !== ",") break;
        at += 1;
      }
      at += 1;
    } else if (next === "[") {
      while (parts[at] !== "]") {
        inspect();
        if (parts[at] !== ",") break;
        at += 1;
      }
      at += 1;
    }
  };
  inspect();
  assertJsonCompatible(value, "JSON");
  return value;
}

/** A failed parse remains attached to its tokens so an ordinary read followed
 * by export cannot silently turn a partial document into a weaker policy. */
export function assertDesignConvertible(tokens: DesignTokens): void {
  const problems = parsedProblems.get(tokens);
  if (problems?.length) throw new Error(`Cannot convert DESIGN.md with front matter problems: ${problems.join("; ")}`);
  const extension = Object.getOwnPropertyDescriptor(tokens, "isocan");
  if (extension) {
    if (!("value" in extension) || !extension.enumerable) throw new Error("isocan: accessors and non-enumerable data are not supported");
    assertJsonCompatible(extension.value);
  }
}

function scalar(raw: string): unknown {
  const value = raw.trim();
  if (value.startsWith('"') || value.startsWith("{") || value.startsWith("[")) return parseDesignJson(value);
  if (value.startsWith("'")) {
    if (!/^'(?:[^']|'')*'$/.test(value)) throw new Error("unsupported or unterminated single-quoted scalar");
    return value.slice(1, -1).replace(/''/g, "'");
  }
  if (/^(?:true|false|null)$/.test(value) || /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(value)) return parseDesignJson(value);
  if (/^(?:true|false|null)$/i.test(value)) return JSON.parse(value.toLowerCase());
  if (value === "~") return null;
  if (/^[+-]?(?:\d[\d_]*(?:\.[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?[\d_]+)?$|^[+-]?0[xob][\da-f_]+$/i.test(value)) {
    throw new Error("unsupported YAML number; use JSON numeric syntax or quote the value");
  }
  if (/^[&*!%@`]|^[|>]|^(?:[-?]\s)|:\s|^[+-]?\.(?:inf|nan)$/i.test(value)) throw new Error("unsupported YAML scalar; use a quoted string or JSON flow value");
  return value;
}

/** A comment starts only outside a quoted scalar. JSON escaping and YAML's
 * doubled apostrophe both matter for exception reasons. */
function withoutComment(raw: string): string {
  let quote = "";
  for (let i = 0; i < raw.length; i += 1) {
    const c = raw[i]!;
    if (quote === '"' && c === "\\") { i += 1; continue; }
    if (quote === "'" && c === "'" && raw[i + 1] === "'") { i += 1; continue; }
    if (quote) { if (c === quote) quote = ""; continue; }
    if ((c === '"' || c === "'") && (i === 0 || /[\s:[{,]/.test(raw[i - 1]!))) quote = c;
    if (c === "#" && (i === 0 || /\s/.test(raw[i - 1]!))) return raw.slice(0, i);
  }
  return raw;
}

function readLines(yaml: string, problems: string[]): Line[] {
  const out: Line[] = [];
  yaml.split(/\r?\n/).forEach((raw, i) => {
    const clean = withoutComment(raw);
    if (clean.trim() === "") return;
    if (/^\s*\t/.test(clean)) {
      problems.push(`line ${i + 1}: tabs are not valid YAML indentation`);
      return;
    }
    out.push({ indent: clean.length - clean.trimStart().length, text: clean.trim(), n: i + 1 });
  });
  return out;
}

function mapPair(text: string): [string, string] | null {
  const match = /^("(?:\\.|[^"\\])*"|'(?:[^']|'')*'|[A-Za-z0-9_.-]+):(?:\s+(.*)|$)/.exec(text);
  if (!match) return null;
  const rawKey = match[1]!.trim();
  if (!/^[A-Za-z0-9_.-]+$/.test(rawKey) && !/^["']/.test(rawKey)) throw new Error("unsupported YAML key; use a plain key or JSON flow value");
  const key = /^["']/.test(rawKey) ? scalar(rawKey) : rawKey;
  if (typeof key !== "string" || !key) throw new Error("map keys must be nonempty strings");
  if (UNSAFE_KEYS.has(key)) throw new Error(`unsafe key "${key}" is not supported`);
  return [key, match[2]?.trim() ?? ""];
}

const isList = (text: string): boolean => text === "-" || text.startsWith("- ");

/** Recursive block maps/lists. JSON flow scalars provide the complete opaque
 * data path; the block subset intentionally rejects unsupported YAML forms. */
function readBlock(lines: Line[], at: number, indent: number, problems: string[], path: string[] = []): [unknown, number] {
  if (isList(lines[at]!.text)) {
    const items: unknown[] = [];
    let i = at;
    while (i < lines.length && lines[i]!.indent === indent && isList(lines[i]!.text)) {
      const line = lines[i]!;
      const rest = line.text.slice(1).trim();
      try {
        if (!rest) {
          const next = lines[i + 1];
          if (!next || next.indent <= indent) { items.push(null); i += 1; continue; }
          const [value, after] = readBlock(lines, i + 1, next.indent, problems, path);
          items.push(value); i = after; continue;
        }
        if (mapPair(rest)) {
          // Parse a list map by giving its first key the same indentation as
          // the remaining keys; nested values now follow ordinary map rules.
          const changed = [...lines];
          changed[i] = { ...line, indent: indent + 2, text: rest };
          const [value, after] = readBlock(changed, i, indent + 2, problems, path);
          items.push(value); i = after; continue;
        }
        items.push(scalar(rest));
      } catch (error) { problems.push(`line ${line.n}: ${(error as Error).message}`); }
      i += 1;
    }
    return [items, i];
  }
  const map: Record<string, unknown> = {};
  let i = at;
  while (i < lines.length && lines[i]!.indent >= indent) {
    const line = lines[i]!;
    if (line.indent > indent) { problems.push(`line ${line.n}: unexpected indentation`); i += 1; continue; }
    let pair: [string, string] | null;
    try { pair = mapPair(line.text); }
    catch (error) { problems.push(`line ${line.n}: ${(error as Error).message}`); i += 1; continue; }
    if (!pair) { problems.push(`line ${line.n}: expected "key: value"`); i += 1; continue; }
    const [key, rest] = pair;
    const duplicate = Object.hasOwn(map, key);
    if (duplicate) problems.push(`line ${line.n}: duplicate key "${key}" is not supported`);
    let value: unknown;
    if (/^[|>][+-]?$/.test(rest)) {
      if (path[0] === "isocan" || key === "isocan") problems.push(`line ${line.n}: block scalars in isocan are unsupported; use a quoted string or JSON flow value`);
      const parts: string[] = [];
      i += 1;
      while (i < lines.length && lines[i]!.indent > indent) { parts.push(lines[i]!.text); i += 1; }
      value = parts.join(rest.startsWith(">") ? " " : "\n");
    } else if (rest) {
      try { value = scalar(rest); }
      catch (error) { problems.push(`line ${line.n}: ${(error as Error).message}`); i += 1; continue; }
      i += 1;
    } else {
      const next = lines[i + 1];
      if (!next || next.indent <= indent) { value = {}; i += 1; }
      else { const result = readBlock(lines, i + 1, next.indent, problems, [...path, key]); value = result[0]; i = result[1]; }
    }
    if (!duplicate) map[key] = value;
  }
  return [map, i];
}

/** The supported YAML subset, including canonical JSON flow values. */
export function parseFrontMatter(yaml: string): { data: Record<string, unknown>; problems: string[] } {
  const problems: string[] = [];
  const lines = readLines(yaml, problems);
  if (lines.length === 0) {
    const data = {};
    if (problems.length) parsedProblems.set(data, [...problems]);
    return { data, problems };
  }
  const [value, after] = readBlock(lines, 0, lines[0]!.indent, problems);
  if (after < lines.length) problems.push(`line ${lines[after]!.n}: unexpected trailing block`);
  const data = value && !Array.isArray(value) && typeof value === "object" ? value as Record<string, unknown> : {};
  if (data !== value) problems.push("front matter must be a map");
  if (problems.length) parsedProblems.set(data, [...problems]);
  return { data, problems };
}

/** Read a DESIGN.md: its tokens, its prose, and what it could not read. */
export function parseDesign(text: string): DesignDoc {
  const problems: string[] = [];
  let tokens: DesignTokens = {};
  let body = text;

  const front = /^﻿?---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
  if (front) {
    body = text.slice(front[0].length);
    const { data, problems: yamlProblems } = parseFrontMatter(front[1]!);
    problems.push(...yamlProblems);
    tokens = data as DesignTokens;
  }

  const sections: { title: string; body: string }[] = [];
  const lines = body.split(/\r?\n/);
  let current: { title: string; lines: string[] } | null = null;
  for (const line of lines) {
    const heading = /^##\s+(.+?)\s*$/.exec(line);
    if (heading) {
      if (current) sections.push({ title: current.title, body: current.lines.join("\n").trim() });
      current = { title: canonicalSection(heading[1]!), lines: [] };
      continue;
    }
    current?.lines.push(line);
  }
  if (current) sections.push({ title: current.title, body: current.lines.join("\n").trim() });

  return { tokens, body: body.trim(), sections, problems };
}

/**
 * Every `{path}` in a value, resolved by substitution — a value may hold
 * several (`{spacing.md} {spacing.lg}` is a padding, `{spacing.xs} 0` a
 * shorthand). Whole-string matching called 214 of a 74-file corpus's 308
 * errors "not in this file" when every path was; this reads each one.
 */
export function referencesIn(value: string): string[] {
  return [...value.matchAll(/\{([^{}]+)\}/g)].map((m) => `{${m[1]!.trim()}}`);
}

/** The references in a value that do not resolve — empty when it is sound. */
export function unresolvedReferences(tokens: DesignTokens, value: string): string[] {
  return referencesIn(value).filter((ref) => resolveToken(tokens, ref) === null);
}

/** `{colors.primary}` → the value it points at, or null. */
export function resolveToken(tokens: DesignTokens, reference: string): unknown {
  const path = /^\{([^}]+)\}$/.exec(reference.trim());
  if (!path) return null;
  let node: unknown = tokens;
  for (const step of path[1]!.split(".")) {
    if (typeof node !== "object" || node === null) return null;
    node = (node as Record<string, unknown>)[step];
  }
  return node ?? null;
}

/** Write it back out: front matter, then the prose. */
export function serializeDesign(tokens: DesignTokens, body: string): string {
  assertDesignConvertible(tokens);
  const yaml = toYaml(tokens as Record<string, unknown>, 0).trimEnd();
  return `---\n${yaml}\n---\n\n${body.trim()}\n`;
}

function toYaml(value: Record<string, unknown>, depth: number): string {
  const pad = "  ".repeat(depth);
  let out = "";
  for (const [key, item] of Object.entries(value)) {
    if (UNSAFE_KEYS.has(key)) throw new Error(`unsafe key "${key}" is not supported`);
    if (depth === 0 && key === "isocan") {
      out += `${pad}isocan: ${JSON.stringify(item)}\n`;
      continue;
    }
    if (item === undefined) continue;
    if (Array.isArray(item)) {
      out += `${pad}${key}:\n`;
      for (const entry of item) {
        if (entry && typeof entry === "object") {
          const pairs = Object.entries(entry as Record<string, unknown>);
          const [first, ...rest] = pairs;
          if (!first) continue;
          out += `${pad}  - ${first[0]}: ${quote(first[1])}\n`;
          for (const [k, v] of rest) out += `${pad}    ${k}: ${quote(v)}\n`;
        } else {
          out += `${pad}  - ${quote(entry)}\n`;
        }
      }
      continue;
    }
    if (item && typeof item === "object") {
      out += `${pad}${key}:\n${toYaml(item as Record<string, unknown>, depth + 1)}`;
      continue;
    }
    out += `${pad}${key}: ${quote(item)}\n`;
  }
  return out;
}

/** Quote what YAML would otherwise read as something else — a hex colour is a
 * comment, and `{colors.primary}` is a flow mapping. */
function quote(value: unknown): string {
  if (value === null || typeof value === "number" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value !== "string") throw new Error("unsupported YAML scalar; use JSON-compatible isocan extension data");
  const plain = /^[A-Za-z0-9 ._/-]+$/.test(value) && value.trim() === value;
  return plain && !/^(?:true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[+-]?\.(?:inf|nan))$/i.test(value) ? value : JSON.stringify(value);
}
