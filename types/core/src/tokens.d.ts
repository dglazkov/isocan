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
 * CSS is the one that changes an agent's day: `isocan style --css` gives it
 * something to paste into the screen it is building, so "use the design system"
 * stops meaning "read the prose and try".
 */
/** The W3C shape: every leaf is `$value` plus a `$type`, groups nest. */
export interface DtcgNode {
    $value?: unknown;
    $type?: string;
    $description?: string;
    [key: string]: unknown;
}
/** DESIGN.md front matter → W3C design tokens. */
export declare function toDtcg(tokens: DesignTokens): Record<string, DtcgNode>;
/** W3C design tokens → DESIGN.md front matter, as far as the shapes line up. */
export declare function fromDtcg(dtcg: Record<string, unknown>): DesignTokens;
/** Custom properties, ready to paste into the page being built. */
export declare function toCss(tokens: DesignTokens): string;
