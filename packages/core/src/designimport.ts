import type { DesignTokens } from "./designmd.ts";

/**
 * **Bringing somebody else's theme onto this canvas.**
 *
 * The research that asked for this looked at seven component-library sites and
 * found the same thing at each: what they actually publish that survives the
 * trip is a set of TOKENS. Not components, which arrive with a build step and
 * a runtime, but the colours, radii and type a house has agreed on. This takes
 * those and lands them as this canvas's DESIGN.md, which is the one change
 * that makes all seven useful.
 *
 * Two shapes go in, because those are the two the world actually ships:
 *
 * - **CSS custom properties** — a `:root { --primary: … }` block. This is what
 *   a shadcn theme IS, what a Tailwind config compiles to, and what anybody
 *   can paste out of devtools.
 * - **W3C DTCG JSON** — the interchange format, `{ "$value": …, "$type": … }`,
 *   which is what a design tool exports when it exports anything.
 *
 * **Nothing is dropped in silence.** A property this cannot classify is
 * reported, not discarded: an import that quietly loses half a theme is worse
 * than one that says which half it could not read, because the first is
 * discovered weeks later by somebody wondering why a colour is missing.
 */
interface ImportedDesign {
  tokens: DesignTokens;
  /** What could not be read or placed, in the importer's own words. */
  problems: string[];
  /** Which shape it turned out to be, for the report. */
  format: "css" | "dtcg";
}

/**
 * **A shadcn theme's colours do not look like colours.**
 *
 * `--primary: 222.2 47.4% 11.2%` is three numbers. It is a colour because the
 * stylesheet wraps it — `hsl(var(--primary))` — and the wrapper is somewhere
 * this importer never sees. A value-only classifier reads that as spacing, or
 * as nothing, and loses the entire palette of the most popular theme format
 * there is.
 *
 * So names carry weight too. These are the words shadcn, Radix, Tailwind and
 * Material all use for colour roles; a property named one of them holding a
 * bare HSL triplet is a colour, and the triplet is wrapped on the way in so
 * what lands in DESIGN.md is a colour anybody can read.
 */
const COLOUR_WORDS = [
  "color", "colour", "background", "foreground", "primary", "secondary",
  "accent", "muted", "destructive", "danger", "warning", "success", "info",
  "border", "ring", "input", "card", "popover", "surface", "ink", "text",
  "fill", "stroke", "shadow", "overlay", "brand", "neutral", "gray", "grey",
];
const RADIUS_WORDS = ["radius", "rounded", "corner"];
const SPACING_WORDS = ["spacing", "space", "gap", "gutter", "inset", "size"];
const TYPE_WORDS = ["font", "text-size", "leading", "tracking", "type"];

const HSL_TRIPLET = /^-?[\d.]+\s+-?[\d.]+%\s+-?[\d.]+%$/;
const LOOKS_LIKE_COLOUR =
  /^(#[0-9a-f]{3,8}|rgba?\(|hsla?\(|oklch\(|oklab\(|lab\(|lch\(|color\(|transparent$|currentcolor$)/i;
const LOOKS_LIKE_LENGTH = /^-?[\d.]+(px|rem|em|%|vh|vw|ch|pt)$/;

function has(name: string, words: string[]): boolean {
  const flat = name.toLowerCase();
  return words.some((w) => flat.includes(w));
}

/** A bare HSL triplet becomes a real colour, because DESIGN.md is read by
 *  people and by a contrast checker, and neither can do anything with three
 *  numbers. */
function normaliseColour(value: string): string {
  return HSL_TRIPLET.test(value.trim()) ? `hsl(${value.trim().replace(/\s+/g, " ")})` : value.trim();
}

type Bucket = "colors" | "rounded" | "spacing" | "typography" | null;

/**
 * Where one token belongs. Value first, then the name — a `#ff0000` named
 * `--spacing-large` is a colour whatever it is called, because the value is a
 * fact and the name is somebody's habit.
 */
export function classifyToken(name: string, value: string): Bucket {
  const v = value.trim();
  if (LOOKS_LIKE_COLOUR.test(v)) return "colors";
  if (HSL_TRIPLET.test(v) && has(name, COLOUR_WORDS)) return "colors";
  if (has(name, RADIUS_WORDS)) return "rounded";
  if (has(name, TYPE_WORDS)) return "typography";
  if (LOOKS_LIKE_LENGTH.test(v)) return has(name, SPACING_WORDS) ? "spacing" : "spacing";
  if (has(name, COLOUR_WORDS)) return "colors";
  return null;
}

/** `--card-foreground` → `card-foreground`; a DTCG path → `card.foreground`. */
function tidyName(name: string): string {
  return name.replace(/^--/, "").trim();
}

/**
 * Every custom property in a stylesheet, wherever it is declared.
 *
 * **Not just `:root`.** A shadcn theme puts its light palette in `:root` and
 * its dark one in `.dark`, and an importer that read only the first would take
 * half a theme and say nothing. Later declarations win, which is what the
 * cascade would do — so pasting a file with both leaves the dark values, and
 * pasting only the block you want is how you choose.
 */
export function readCssTokens(css: string): Map<string, string> {
  const found = new Map<string, string>();
  // Comments first: a commented-out property is not a property, and `/* --x:
  // red */` would otherwise arrive as a token nobody declared.
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const match of clean.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)/g)) {
    found.set(match[1]!, match[2]!.trim());
  }
  return found;
}

/** DTCG is a tree; the leaves are the objects carrying `$value`. */
function walkDtcg(
  node: unknown,
  path: string[],
  out: Map<string, { value: string; type?: string }>,
): void {
  if (node === null || typeof node !== "object") return;
  const record = node as Record<string, unknown>;
  if ("$value" in record) {
    const value = record.$value;
    // A composite value (a shadow, a gradient) is not something DESIGN.md has
    // a home for yet. Said, not swallowed.
    if (typeof value === "string" || typeof value === "number") {
      const type = typeof record.$type === "string" ? record.$type : null;
      out.set(path.join("."), { value: String(value), ...(type ? { type } : {}) });
    } else {
      out.set(path.join("."), { value: "", type: "composite" });
    }
    return;
  }
  for (const [key, child] of Object.entries(record)) {
    if (key.startsWith("$")) continue;
    walkDtcg(child, [...path, key], out);
  }
}

/** Which shape this text is, decided by reading it rather than by a flag. */
export function detectFormat(text: string): "css" | "dtcg" {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return "dtcg";
  return "css";
}

/** A theme's name, from the file it came in. `shadcn-theme.css` → "shadcn
 *  theme" — enough that `design check` has something to cite and a person can
 *  see at a glance which import this is. */
function importedName(source: string): string {
  return source
    .replace(/\.[^.]+$/, "")
    .replace(/[-_.]+/g, " ")
    .trim();
}

export function importDesign(text: string, source?: string): ImportedDesign {
  const format = detectFormat(text);
  // Named from the file, because `design check`'s first complaint about an
  // unnamed system is one an import can answer for itself — and a system an
  // agent cannot cite by name is one it will not cite.
  const tokens: DesignTokens = source ? { name: importedName(source) } : {};
  const problems: string[] = [];
  const put = (bucket: Exclude<Bucket, null>, key: string, value: string): void => {
    if (bucket === "typography") {
      // Typography in DESIGN.md is a named ROLE with properties, not a flat
      // value. A bare `--font-sans` becomes the family of a role of its own
      // name, which is the honest reading of what was given.
      const roles = (tokens.typography ??= {});
      const role = (roles[key] ??= {});
      if (/family/i.test(key)) role.fontFamily = value;
      else if (/size/i.test(key)) role.fontSize = value;
      else if (/weight/i.test(key)) role.fontWeight = value;
      else if (/leading|line/i.test(key)) role.lineHeight = value;
      else if (/tracking|letter/i.test(key)) role.letterSpacing = value;
      else role.fontFamily = value;
      return;
    }
    const into = (tokens[bucket] ??= {}) as Record<string, string>;
    into[key] = value;
  };

  if (format === "dtcg") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      return { tokens, problems: [`not valid JSON: ${(err as Error).message}`], format };
    }
    const leaves = new Map<string, { value: string; type?: string }>();
    walkDtcg(parsed, [], leaves);
    if (leaves.size === 0) problems.push("no tokens found — expected objects carrying `$value`");
    for (const [path, leaf] of leaves) {
      if (leaf.type === "composite") {
        problems.push(`${path}: a composite value (shadow, gradient) has no home in DESIGN.md yet`);
        continue;
      }
      // `$type` is the author telling you what it is, and it outranks a guess.
      const declared: Bucket =
        leaf.type === "color"
          ? "colors"
          : leaf.type === "dimension"
            ? has(path, RADIUS_WORDS)
              ? "rounded"
              : "spacing"
            : leaf.type === "fontFamily" || leaf.type === "typography"
              ? "typography"
              : null;
      const bucket = declared ?? classifyToken(path, leaf.value);
      if (bucket === null) {
        problems.push(`${path}: could not tell what kind of token this is (${leaf.value})`);
        continue;
      }
      put(bucket, path, bucket === "colors" ? normaliseColour(leaf.value) : leaf.value);
    }
    return { tokens, problems, format };
  }

  const props = readCssTokens(text);
  if (props.size === 0) problems.push("no custom properties found — expected `--name: value` declarations");
  for (const [name, value] of props) {
    const key = tidyName(name);
    const bucket = classifyToken(key, value);
    if (bucket === null) {
      problems.push(`--${key}: could not tell what kind of token this is (${value})`);
      continue;
    }
    put(bucket, key, bucket === "colors" ? normaliseColour(value) : value);
  }
  return { tokens, problems, format };
}

/**
 * The prose that ships with an import.
 *
 * A DESIGN.md is a document an agent READS before it designs, so a file that
 * is nothing but a token table teaches nothing. This says where the tokens
 * came from and what the sections are for — and says plainly that the prose is
 * a starting point, because a house's actual rules are not in its colour
 * palette and pretending otherwise is how an imported theme becomes a lie
 * about what a team has agreed.
 */
export function importedBody(source: string, tokens: DesignTokens): string {
  const colours = Object.keys(tokens.colors ?? {}).length;
  const type = Object.keys(tokens.typography ?? {}).length;
  return `## Overview

Imported from \`${source}\`: ${colours} colour${colours === 1 ? "" : "s"}, ${type} type role${type === 1 ? "" : "s"}.

**The tokens are real; this prose is a starting point.** What a house has
actually agreed — when to use the accent, what a card may not do, which of
these colours is never a background — is not in a palette, and an import
cannot invent it. Replace these sections as the canvas learns its own rules.

## Colors

The imported palette. \`isocan design check\` reads contrast from here, so a
pair that fails is a pair to fix rather than one to work around.

## Typography

\`isocan design check\` will name what the theme did not carry — a type role
with no size, a pair whose contrast fails. Those are not import errors; they
are the parts of a design system that live in a house's head rather than in
its stylesheet, and they are the first things worth writing down here.

## Layout

## Components
`;
}
