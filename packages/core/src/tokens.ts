import type { DesignTokens, DesignTypography } from "./designmd.ts";
import { parseHex } from "./contrast.ts";

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
 * **The W3C half is DTCG 2025.10, for real** (research note
 * `2026-08-24-design-systems-and-tokens.md`, §4). The first version emitted
 * hex strings and `"16px"` under a group-level `$type`, which the published
 * schema passes only because it does not implement group inheritance — valid
 * by accident, invalid to every consumer that reads the spec. Now: a colour is
 * `{colorSpace, components, hex}`, a dimension is `{value, unit}`, typography
 * carries its `$type` on the leaf and keeps `lineHeight` (the reference
 * exporter drops it and fails its own schema), `$schema` says which version
 * this is, and what has no DTCG home — `fontFeature`, `fontVariation`, the
 * components — rides in `$extensions` under a vendor key rather than being
 * dropped. Unitless spacing, which DESIGN.md permits as a ratio, is emitted as
 * a `number` token with a note, because guessing a unit would be a lie.
 *
 * CSS is the one that changes an agent's day: `isocan style --css` gives it
 * something to paste into the screen it is building, so "use the design system"
 * stops meaning "read the prose and try".
 */

export const DTCG_SCHEMA = "https://www.designtokens.org/schemas/2025.10/format.json";
/** The vendor key for what DTCG has no home for. */
export const DTCG_EXTENSION = "io.isocan";

/** The W3C shape: every leaf is `$value` plus a `$type`, groups nest. */
export interface DtcgNode {
  $value?: unknown;
  $type?: string;
  $description?: string;
  $extensions?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface DtcgColor {
  colorSpace: "srgb";
  components: [number, number, number];
  alpha?: number;
  hex?: string;
}

export interface DtcgDimension {
  value: number;
  unit: "px" | "rem";
}

/** DESIGN.md front matter → W3C design tokens (DTCG 2025.10). */
export function toDtcg(tokens: DesignTokens): Record<string, unknown> {
  const out: Record<string, unknown> = { $schema: DTCG_SCHEMA };
  /** What DTCG cannot say: kept, with the reason, never dropped in silence. */
  const unexported: Record<string, { value: unknown; why: string }> = {};

  if (tokens.colors && Object.keys(tokens.colors).length > 0) {
    const group: DtcgNode = {};
    for (const [name, value] of Object.entries(tokens.colors)) {
      const leaf = colorLeaf(String(value));
      if (leaf) group[name] = leaf;
      else unexported[`colors.${name}`] = { value, why: "not a colour sRGB can state exactly — oklch(), color-mix(), a name" };
    }
    if (Object.keys(group).length > 0) out.color = group;
  }
  for (const key of ["spacing", "rounded"] as const) {
    const values = tokens[key];
    if (!values || Object.keys(values).length === 0) continue;
    const group: DtcgNode = {};
    for (const [name, value] of Object.entries(values)) {
      const leaf = dimensionLeaf(value);
      if (leaf) group[name] = leaf;
      else unexported[`${key}.${name}`] = { value, why: "not a px or rem length, and not a bare number" };
    }
    if (Object.keys(group).length > 0) out[key] = group;
  }
  if (tokens.typography && Object.keys(tokens.typography).length > 0) {
    const group: DtcgNode = {};
    for (const [name, level] of Object.entries(tokens.typography)) {
      const made = typographyLeaf(level);
      if (made.ok) group[name] = made.leaf;
      else unexported[`typography.${name}`] = { value: level, why: made.why };
    }
    if (Object.keys(group).length > 0) out.typography = group;
  }
  const ours: Record<string, unknown> = {};
  if (tokens.components && Object.keys(tokens.components).length > 0) {
    // No DTCG type for "a component's properties", so the whole map rides in
    // the file's extensions rather than being dropped the way the reference
    // exporter drops it: a design system that loses its components on
    // export is not exported.
    ours.components = tokens.components;
  }
  if (Object.keys(unexported).length > 0) ours.unexported = unexported;
  if (Object.keys(ours).length > 0) out.$extensions = { [DTCG_EXTENSION]: ours };
  return out;
}

/** A reference passes through in both formats' braces; a hex, rgb() or hsl()
 *  colour becomes the object the spec wants, with the hex kept beside it for
 *  readers. Null when the colour cannot be said in sRGB without guessing —
 *  oklch(), color-mix(), a named colour — and the caller records it. */
function colorLeaf(value: string): DtcgNode | null {
  if (isReference(value)) return { $type: "color", $value: value };
  const srgb = parseSrgb(value);
  if (!srgb) return null;
  const color: DtcgColor = {
    colorSpace: "srgb",
    components: [round(srgb.r / 255), round(srgb.g / 255), round(srgb.b / 255)],
    hex: `#${[srgb.r, srgb.g, srgb.b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`,
  };
  if (srgb.alpha !== undefined && srgb.alpha < 1) color.alpha = round(srgb.alpha);
  return { $type: "color", $value: color };
}

/** Hex, `rgb()`/`rgba()` and `hsl()`/`hsla()` to sRGB channels — the CSS
 *  colours whose arithmetic is exact. Anything else is null. */
export function parseSrgb(value: string): { r: number; g: number; b: number; alpha?: number } | null {
  const text = value.trim();
  const hex = parseHex(text);
  if (hex) return hex;
  const long = /^#([0-9a-f]{6})([0-9a-f]{2})$/i.exec(text);
  if (long) {
    const rgb = parseHex(`#${long[1]}`)!;
    return { ...rgb, alpha: parseInt(long[2]!, 16) / 255 };
  }
  const fn = /^(rgba?|hsla?)\(\s*([^)]*)\)$/i.exec(text);
  if (!fn) return null;
  const parts = fn[2]!.split(/\s*[,/]\s*|\s+/).filter((p) => p.length > 0);
  if (parts.length < 3) return null;
  const num = (p: string, scale: number) => (p.endsWith("%") ? (Number(p.slice(0, -1)) / 100) * scale : Number(p));
  const alphaRaw = parts[3];
  const alpha = alphaRaw === undefined ? undefined : alphaRaw.endsWith("%") ? Number(alphaRaw.slice(0, -1)) / 100 : Number(alphaRaw);
  if (alpha !== undefined && Number.isNaN(alpha)) return null;
  if (fn[1]!.toLowerCase().startsWith("rgb")) {
    const [r, g, b] = [num(parts[0]!, 255), num(parts[1]!, 255), num(parts[2]!, 255)];
    if ([r, g, b].some((c) => Number.isNaN(c))) return null;
    return { r, g, b, ...(alpha === undefined ? {} : { alpha }) };
  }
  const h = Number(parts[0]!.replace(/deg$/i, ""));
  const s = num(parts[1]!, 1);
  const l = num(parts[2]!, 1);
  if ([h, s, l].some((c) => Number.isNaN(c))) return null;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const sector = Math.floor((((h % 360) + 360) % 360) / 60);
  const [r1, g1, b1] = [
    [c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x],
  ][sector]!;
  return { r: (r1! + m) * 255, g: (g1! + m) * 255, b: (b1! + m) * 255, ...(alpha === undefined ? {} : { alpha }) };
}

function dimensionLeaf(value: string | number): DtcgNode | null {
  if (typeof value === "string" && isReference(value)) return { $type: "dimension", $value: value };
  const dim = dimensionOrZero(value);
  if (dim) return { $type: "dimension", $value: dim };
  if (typeof value === "number") {
    return { $type: "number", $value: value, $description: "unitless in DESIGN.md — a ratio, not a length" };
  }
  return null;
}

/** The weight keywords the spec admits; anything else numeric is a number. */
const WEIGHT_WORDS = new Set([
  "thin", "hairline", "extra-light", "ultra-light", "light", "normal", "regular", "book", "medium",
  "semi-bold", "demi-bold", "bold", "extra-bold", "ultra-bold", "black", "heavy", "extra-black", "ultra-black",
]);

/**
 * A typography composite is all-or-nothing in DTCG: the schema requires
 * fontFamily, fontSize, fontWeight, letterSpacing and lineHeight together. A
 * DESIGN.md level often states three of them. The export fills the rest
 * with CSS's own initial values — weight `normal` (400), letter-spacing 0,
 * line-height `normal` (≈1.2) — and SAYS which in `$description`, so a
 * reader can tell a value the file stated from one the format demanded.
 * `lineHeight` is kept when stated: the reference exporter drops it and
 * fails its own schema for exactly that.
 */
function typographyLeaf(level: DesignTypography): { ok: true; leaf: DtcgNode } | { ok: false; why: string } {
  const value: Record<string, unknown> = {};
  const filled: string[] = [];
  if (level.fontFamily === undefined) return { ok: false as const, why: "no fontFamily — the composite requires one and there is nothing honest to fill it with" };
  value.fontFamily = /^\{[^{}]+\}$/.test(level.fontFamily.trim()) ? level.fontFamily : level.fontFamily.split(",").map((f) => f.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
  if ((value.fontFamily as string[]).length === 1) value.fontFamily = (value.fontFamily as string[])[0];
  const size = dimensionOrZero(level.fontSize) ?? (typeof level.fontSize === "string" && isReference(level.fontSize) ? level.fontSize : null);
  if (!size) return { ok: false as const, why: `fontSize "${String(level.fontSize)}" is not a px or rem length` };
  value.fontSize = size;
  if (level.fontWeight !== undefined) {
    const weight = level.fontWeight;
    const numeric = typeof weight === "number" ? weight : /^\d+$/.test(String(weight).trim()) ? Number(weight) : null;
    const word = String(weight).trim().toLowerCase();
    if (numeric !== null && numeric >= 1 && numeric <= 1000) value.fontWeight = numeric;
    else if (WEIGHT_WORDS.has(word)) value.fontWeight = word;
    else return { ok: false as const, why: `fontWeight "${String(weight)}" is neither 1–1000 nor a weight the spec names` };
  } else {
    value.fontWeight = 400;
    filled.push("fontWeight");
  }
  if (level.lineHeight !== undefined) {
    // The composite takes a ratio. A bare number is one; a px line-height
    // over a px font size is one too, by exact division (70.4px on 64px is
    // 1.1) — arithmetic, not a guess. Anything else cannot be said.
    const raw = level.lineHeight;
    const lhPx = parseDimension(raw);
    const lh =
      typeof raw === "number"
        ? raw
        : /^\d+(\.\d+)?$/.test(String(raw).trim())
          ? Number(raw)
          : lhPx && lhPx.unit === "px" && typeof size === "object" && size.unit === "px" && size.value > 0
            ? round(lhPx.value / size.value)
            : null;
    if (lh === null) return { ok: false as const, why: `lineHeight "${String(raw)}" is not a ratio, and not a px length over a px size` };
    value.lineHeight = lh;
  } else {
    value.lineHeight = 1.2;
    filled.push("lineHeight");
  }
  if (level.letterSpacing !== undefined) {
    const tracking = dimensionOrZero(level.letterSpacing);
    if (!tracking) return { ok: false as const, why: `letterSpacing "${String(level.letterSpacing)}" is not a px or rem length` };
    value.letterSpacing = tracking;
  } else {
    value.letterSpacing = { value: 0, unit: "px" };
    filled.push("letterSpacing");
  }
  const extra: Record<string, unknown> = {};
  if (level.fontFeature !== undefined) extra.fontFeature = level.fontFeature;
  if (level.fontVariation !== undefined) extra.fontVariation = level.fontVariation;
  const leaf: DtcgNode = { $type: "typography", $value: value };
  if (filled.length > 0) leaf.$description = `${filled.join(", ")}: not in DESIGN.md — CSS initial value${filled.length === 1 ? "" : "s"}, which the composite requires`;
  if (Object.keys(extra).length > 0) leaf.$extensions = { [DTCG_EXTENSION]: extra };
  return { ok: true, leaf };
}

/** `0` is a length in CSS whatever its unit, so a bare zero is `0px`. */
function dimensionOrZero(value: unknown): DtcgDimension | null {
  if (value === 0 || value === "0") return { value: 0, unit: "px" };
  return parseDimension(value);
}

/** W3C design tokens → DESIGN.md front matter, as far as the shapes line up.
 *  Reads both this exporter's output and the legacy string shape, both group
 *  names (`color` and `colors`), and the reference exporter's files. */
export function fromDtcg(dtcg: Record<string, unknown>): DesignTokens {
  const tokens: DesignTokens = {};

  const colorGroup = (dtcg.color ?? dtcg.colors) as Record<string, unknown> | undefined;
  const colors = leaves(colorGroup, (value) => dtcgColorString(value));
  if (colors) tokens.colors = colors as Record<string, string>;

  const spacing = leaves(dtcg.spacing as Record<string, unknown> | undefined, (value) => dtcgDimensionString(value));
  if (spacing) tokens.spacing = spacing as Record<string, string | number>;

  const rounded = leaves(dtcg.rounded as Record<string, unknown> | undefined, (value) => dtcgDimensionString(value));
  if (rounded) tokens.rounded = rounded as Record<string, string>;

  const typography = leaves(dtcg.typography as Record<string, unknown> | undefined, (value, leaf) => typographyLevel(value, leaf));
  if (typography) tokens.typography = typography as Record<string, DesignTypography>;

  const ours = (dtcg.$extensions as Record<string, unknown> | undefined)?.[DTCG_EXTENSION] as { components?: unknown } | undefined;
  if (ours?.components && typeof ours.components === "object") {
    tokens.components = ours.components as Record<string, Record<string, string>>;
  }
  return tokens;
}

function leaves(
  group: Record<string, unknown> | undefined,
  read: (value: unknown, leaf: DtcgNode) => unknown,
): Record<string, unknown> | null {
  if (!group || typeof group !== "object") return null;
  const values: Record<string, unknown> = {};
  for (const [name, node] of Object.entries(group)) {
    if (name.startsWith("$")) continue;
    const leaf = (node && typeof node === "object" ? node : { $value: node }) as DtcgNode;
    const value = leaf.$value !== undefined ? read(leaf.$value, leaf) : undefined;
    if (value !== undefined) values[name] = value;
  }
  return Object.keys(values).length > 0 ? values : null;
}

/** A colour object back to hex; a string stays what it was. */
export function dtcgColorString(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const color = value as Partial<DtcgColor>;
    if (typeof color.hex === "string") return color.hex;
    if (Array.isArray(color.components) && color.components.length >= 3) {
      const [r, g, b] = color.components;
      return `#${[r, g, b].map((c) => Math.round(Math.max(0, Math.min(1, Number(c))) * 255).toString(16).padStart(2, "0")).join("")}`;
    }
  }
  return undefined;
}

/** A dimension object back to the string DESIGN.md writes; the legacy shape
 *  passes through. This is the object that once reached `toCss` as
 *  `[object Object]`. */
export function dtcgDimensionString(value: unknown): string | number | undefined {
  if (typeof value === "string" || typeof value === "number") return value;
  if (value && typeof value === "object") {
    const dim = value as Partial<DtcgDimension>;
    if (typeof dim.value === "number" && typeof dim.unit === "string") return `${dim.value}${dim.unit}`;
  }
  return undefined;
}

function typographyLevel(value: unknown, leaf: DtcgNode): DesignTypography | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const level: DesignTypography = {};
  if (typeof raw.fontFamily === "string") level.fontFamily = raw.fontFamily;
  else if (Array.isArray(raw.fontFamily)) level.fontFamily = raw.fontFamily.map(String).join(", ");
  const size = dtcgDimensionString(raw.fontSize);
  if (size !== undefined) level.fontSize = String(size);
  if (typeof raw.fontWeight === "number" || typeof raw.fontWeight === "string") level.fontWeight = raw.fontWeight;
  if (typeof raw.lineHeight === "number" || typeof raw.lineHeight === "string") level.lineHeight = raw.lineHeight;
  const tracking = dtcgDimensionString(raw.letterSpacing);
  if (tracking !== undefined) level.letterSpacing = String(tracking);
  const extra = (leaf.$extensions as Record<string, unknown> | undefined)?.[DTCG_EXTENSION] as Record<string, unknown> | undefined;
  if (typeof extra?.fontFeature === "string") level.fontFeature = extra.fontFeature;
  if (typeof extra?.fontVariation === "string") level.fontVariation = extra.fontVariation;
  return level;
}

function isReference(value: unknown): boolean {
  return typeof value === "string" && /^\{[^{}]+\}$/.test(value.trim());
}

/** `16px` / `0.5rem` → the object; anything else (a percentage, `auto`, a
 *  ratio) → null, so the caller says what it is rather than inventing a unit. */
export function parseDimension(value: unknown): DtcgDimension | null {
  if (typeof value !== "string") return null;
  const m = /^(-?\d+(?:\.\d+)?)(px|rem)$/.exec(value.trim());
  return m ? { value: Number(m[1]), unit: m[2] as "px" | "rem" } : null;
}

function round(n: number): number {
  return Math.round(n * 10000) / 10000;
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
