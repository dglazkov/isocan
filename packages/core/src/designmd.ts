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
 * reads, and anything outside it is reported rather than guessed at.
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

/** A scalar as written: quotes stripped, numbers left as numbers. */
function scalar(raw: string): string | number {
  const value = raw.trim();
  if (
    (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
    (value.startsWith("'") && value.endsWith("'") && value.length > 1)
  ) {
    return value.slice(1, -1);
  }
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  return value;
}

function readLines(yaml: string, problems: string[]): Line[] {
  const out: Line[] = [];
  yaml.split(/\r?\n/).forEach((raw, i) => {
    const withoutComment = raw.replace(/(^|\s)#.*$/, "$1");
    if (withoutComment.trim() === "") return;
    if (withoutComment.includes("\t")) {
      problems.push(`line ${i + 1}: tabs are not valid YAML indentation`);
      return;
    }
    out.push({ indent: withoutComment.length - withoutComment.trimStart().length, text: withoutComment.trim(), n: i + 1 });
  });
  return out;
}

/** One `key: value` / `key:` / `- item` block at a given indent. */
function readBlock(lines: Line[], at: number, indent: number, problems: string[]): [unknown, number] {
  // A list.
  if (lines[at] && lines[at]!.indent === indent && lines[at]!.text.startsWith("- ")) {
    const items: unknown[] = [];
    let i = at;
    while (i < lines.length && lines[i]!.indent === indent && lines[i]!.text.startsWith("- ")) {
      const rest = lines[i]!.text.slice(2).trim();
      // `- section: rounded` opens a map whose remaining keys are indented.
      if (/^[A-Za-z0-9_-]+:/.test(rest)) {
        const map: Record<string, unknown> = {};
        const [key, ...tail] = rest.split(":");
        map[key!.trim()] = scalar(tail.join(":"));
        i += 1;
        while (i < lines.length && lines[i]!.indent > indent && !lines[i]!.text.startsWith("- ")) {
          const [k, ...v] = lines[i]!.text.split(":");
          map[k!.trim()] = scalar(v.join(":"));
          i += 1;
        }
        items.push(map);
        continue;
      }
      items.push(scalar(rest));
      i += 1;
    }
    return [items, i];
  }

  const map: Record<string, unknown> = {};
  let i = at;
  while (i < lines.length && lines[i]!.indent >= indent) {
    const line = lines[i]!;
    if (line.indent > indent) {
      problems.push(`line ${line.n}: unexpected indentation`);
      i += 1;
      continue;
    }
    const colon = line.text.indexOf(":");
    if (colon === -1) {
      problems.push(`line ${line.n}: expected "key: value"`);
      i += 1;
      continue;
    }
    const key = line.text.slice(0, colon).trim();
    const rest = line.text.slice(colon + 1).trim();
    // A block scalar — `description: |` or `>` — takes every deeper line as
    // its text: `|` keeps the line breaks, `>` folds them into spaces. A
    // real file's description is often a paragraph, and reading it as
    // "unexpected indentation" threw away the whole front matter (43 of a
    // 74-file corpus's errors were this one line).
    if (/^[|>][+-]?$/.test(rest)) {
      const folded = rest.startsWith(">");
      const parts: string[] = [];
      i += 1;
      while (i < lines.length && lines[i]!.indent > indent) {
        parts.push(lines[i]!.text);
        i += 1;
      }
      map[key] = parts.join(folded ? " " : "\n");
      continue;
    }
    if (rest !== "") {
      map[key] = scalar(rest);
      i += 1;
      continue;
    }
    // A nested block: whatever is indented under it.
    const next = lines[i + 1];
    if (!next || next.indent <= indent) {
      map[key] = {};
      i += 1;
      continue;
    }
    const [value, after] = readBlock(lines, i + 1, next.indent, problems);
    map[key] = value;
    i = after;
  }
  return [map, i];
}

/** The subset parser. Exported for its own tests — it is the part most likely
 * to meet something it was not built for. */
export function parseFrontMatter(yaml: string): { data: Record<string, unknown>; problems: string[] } {
  const problems: string[] = [];
  const lines = readLines(yaml, problems);
  if (lines.length === 0) return { data: {}, problems };
  const [data] = readBlock(lines, 0, lines[0]!.indent, problems);
  return { data: (data as Record<string, unknown>) ?? {}, problems };
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
  const yaml = toYaml(tokens as Record<string, unknown>, 0).trimEnd();
  return `---\n${yaml}\n---\n\n${body.trim()}\n`;
}

function toYaml(value: Record<string, unknown>, depth: number): string {
  const pad = "  ".repeat(depth);
  let out = "";
  for (const [key, item] of Object.entries(value)) {
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
  if (typeof value === "number") return String(value);
  const text = String(value);
  return /^[A-Za-z0-9 ._/-]+$/.test(text) && text.trim() === text ? text : `"${text.replace(/"/g, '\\"')}"`;
}
