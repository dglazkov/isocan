import type { DesignTokens, DesignTypography } from "./designmd.ts";

/**
 * Design tokens, in and out.
 *
 * DESIGN.md's front matter is the canonical form here because it keeps the
 * numbers next to the reasoning. But nobody else speaks it: Figma, Style
 * Dictionary and half the ecosystem speak the W3C Design Tokens format, and a
 * browser speaks CSS. So this converts, in both directions where that makes
 * sense, and the conversions are the feature — a design system nobody can
 * export is a design system that stops at the edge of this canvas.
 *
 * CSS is the one that changes an agent's day: `isocan style --css` gives it
 * something to paste into the screen it is building, so "use the design system"
 * stops meaning "read the prose and try".
 */

/** The W3C shape: every leaf is `$value` plus a `$type`, groups nest. */
interface DtcgNode {
  $value?: unknown;
  $type?: string;
  $description?: string;
  [key: string]: unknown;
}

const TYPE_OF_GROUP: Record<string, string> = {
  colors: "color",
  typography: "typography",
  rounded: "dimension",
  spacing: "dimension",
};

/** DESIGN.md front matter → W3C design tokens. */
export function toDtcg(tokens: DesignTokens): Record<string, DtcgNode> {
  const out: Record<string, DtcgNode> = {};
  for (const [group, type] of Object.entries(TYPE_OF_GROUP)) {
    const values = tokens[group as keyof DesignTokens] as Record<string, unknown> | undefined;
    if (!values || Object.keys(values).length === 0) continue;
    const node: DtcgNode = { $type: type };
    for (const [name, value] of Object.entries(values)) {
      node[name] = { $value: dtcgValue(value) };
    }
    out[group] = node;
  }
  if (tokens.components) {
    const node: DtcgNode = {};
    for (const [name, props] of Object.entries(tokens.components)) {
      const component: DtcgNode = {};
      for (const [prop, value] of Object.entries(props)) component[prop] = { $value: dtcgValue(value) };
      node[name] = component;
    }
    out.components = node;
  }
  return out;
}

/** `{colors.primary}` is the same idea in both formats — DESIGN.md's braces,
 * W3C's braces — so a reference passes straight through. */
function dtcgValue(value: unknown): unknown {
  return value;
}

/** W3C design tokens → DESIGN.md front matter, as far as the shapes line up. */
export function fromDtcg(dtcg: Record<string, unknown>): DesignTokens {
  const tokens: DesignTokens = {};
  for (const [group, type] of Object.entries(TYPE_OF_GROUP)) {
    const node = dtcg[group];
    if (!node || typeof node !== "object") continue;
    const values: Record<string, unknown> = {};
    for (const [name, leaf] of Object.entries(node as Record<string, unknown>)) {
      if (name.startsWith("$")) continue;
      const value = leaf && typeof leaf === "object" ? (leaf as DtcgNode).$value : leaf;
      if (value !== undefined) values[name] = value;
    }
    if (Object.keys(values).length > 0) {
      if (type === "typography") tokens.typography = values as Record<string, DesignTypography>;
      else if (group === "colors") tokens.colors = values as Record<string, string>;
      else if (group === "rounded") tokens.rounded = values as Record<string, string>;
      else if (group === "spacing") tokens.spacing = values as Record<string, string | number>;
    }
  }
  return tokens;
}

/** Custom properties, ready to paste into the page being built. */
export function toCss(tokens: DesignTokens): string {
  const lines: string[] = [":root {"];
  const put = (name: string, value: unknown) => lines.push(`  --${name}: ${String(value)};`);
  for (const [name, value] of Object.entries(tokens.colors ?? {})) put(`color-${kebab(name)}`, deref(value));
  for (const [name, value] of Object.entries(tokens.spacing ?? {})) put(`space-${kebab(name)}`, deref(value));
  for (const [name, value] of Object.entries(tokens.rounded ?? {})) put(`radius-${kebab(name)}`, deref(value));
  for (const [name, type] of Object.entries(tokens.typography ?? {})) {
    const key = kebab(name);
    if (type.fontFamily) put(`font-${key}`, type.fontFamily);
    if (type.fontSize) put(`size-${key}`, type.fontSize);
    if (type.fontWeight !== undefined) put(`weight-${key}`, type.fontWeight);
    if (type.lineHeight !== undefined) put(`leading-${key}`, type.lineHeight);
    if (type.letterSpacing) put(`tracking-${key}`, type.letterSpacing);
  }
  lines.push("}");
  // A typography level is several properties at once; a class is how a screen
  // uses one without restating four declarations every time.
  for (const [name] of Object.entries(tokens.typography ?? {})) {
    const key = kebab(name);
    const parts = [`font-family: var(--font-${key});`, `font-size: var(--size-${key});`];
    if (tokens.typography![name]!.fontWeight !== undefined) parts.push(`font-weight: var(--weight-${key});`);
    if (tokens.typography![name]!.lineHeight !== undefined) parts.push(`line-height: var(--leading-${key});`);
    if (tokens.typography![name]!.letterSpacing) parts.push(`letter-spacing: var(--tracking-${key});`);
    lines.push("", `.${key} { ${parts.join(" ")} }`);
  }
  return `${lines.join("\n")}\n`;
}

/** A reference in a CSS value has to become a var(), not stay in braces. */
function deref(value: unknown): unknown {
  const ref = /^\{([^}]+)\}$/.exec(String(value));
  if (!ref) return value;
  const path = ref[1]!.split(".");
  const group = path[0] === "colors" ? "color" : path[0] === "spacing" ? "space" : path[0] === "rounded" ? "radius" : path[0]!;
  return `var(--${group}-${kebab(path.slice(1).join("-"))})`;
}

function kebab(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[_\s.]+/g, "-")
    .toLowerCase();
}
