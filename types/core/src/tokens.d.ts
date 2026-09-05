import type { DesignTokens } from "./designmd.js";
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
export declare const DTCG_SCHEMA = "https://www.designtokens.org/schemas/2025.10/format.json";
/** The vendor key for what DTCG has no home for. */
export declare const DTCG_EXTENSION = "io.isocan";
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
export declare function toDtcg(tokens: DesignTokens): Record<string, unknown>;
/** Hex, `rgb()`/`rgba()` and `hsl()`/`hsla()` to sRGB channels — the CSS
 *  colours whose arithmetic is exact. Anything else is null. */
export declare function parseSrgb(value: string): {
    r: number;
    g: number;
    b: number;
    alpha?: number;
} | null;
/** W3C design tokens → DESIGN.md front matter, as far as the shapes line up.
 *  Reads both this exporter's output and the legacy string shape, both group
 *  names (`color` and `colors`), and the reference exporter's files. */
export declare function fromDtcg(dtcg: Record<string, unknown>): DesignTokens;
/** A colour object back to hex; a string stays what it was. */
export declare function dtcgColorString(value: unknown): string | undefined;
/** A dimension object back to the string DESIGN.md writes; the legacy shape
 *  passes through. This is the object that once reached `toCss` as
 *  `[object Object]`. */
export declare function dtcgDimensionString(value: unknown): string | number | undefined;
/** `16px` / `0.5rem` → the object; anything else (a percentage, `auto`, a
 *  ratio) → null, so the caller says what it is rather than inventing a unit. */
export declare function parseDimension(value: unknown): DtcgDimension | null;
/** Custom properties, ready to paste into the page being built. */
export declare function toCss(tokens: DesignTokens): string;
