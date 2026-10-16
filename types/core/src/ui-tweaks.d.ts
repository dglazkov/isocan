/**
 * **Live UI customization (`@isocan/core/ui-tweaks`).**
 *
 * One schema and one CSS compiler for tweaking every surface of isocan on the
 * fly — shared by the web app's per-piece Devtools and the `isocan tweak` CLI.
 *
 * Why a runtime `<style data-ui-tweaks>` sheet instead of mutating static CSS:
 * - Static guards (`tokens.test.ts`, `scale.test.ts`, `floats.test.ts`,
 *   `layers.test.ts`, `menuground.test.ts`) audit `packages/web/src/styles.css`
 *   to keep the default design system disciplined.
 * - Compiling non-default knob values into a dedicated runtime `<style>` sheet
 *   lets any person or agent bend sizes, frosted-glass opacity, blur, radii,
 *   z-index layers, spacing, and colors live at 60fps while leaving the shipped
 *   defaults untouched when reset.
 *
 * Persistence has two layers:
 * 1. **Per-browser (`localStorage["isocan.uiTweaks"]`):** instant sandbox for
 *    this machine; changes paint immediately without touching the oplog.
 * 2. **Per-canvas (`canvas.properties["ui.tweaks"]`):** saved via `project.update`
 *    (`isocan tweak set ...` or "Save to canvas" in Devtools) so a canvas can
 *    carry its own look across collaborators and sessions, with one-step undo.
 */
/** Canvas property key storing shared UI tweak overrides (`project.update`). */
export declare const UI_TWEAKS_PROP = "ui.tweaks";
/** Identifier for a customizable UI piece in Devtools and `isocan tweak`. */
export type UiPieceId = "glass" | "toolbar" | "rail" | "zoom" | "minimap" | "dock" | "items" | "layers" | "colors";
/** Metadata and DOM selector for one customizable UI piece. */
export interface UiPiece {
    id: UiPieceId;
    name: string;
    summary: string;
    /** CSS selector matching this piece in the live DOM (for the element picker). */
    selector: string;
}
/** Value kind accepted by a UI tweak knob. */
export type UiKnobKind = "number" | "color";
/** Definition of one customizable UI knob, its bounds, and its shipped default. */
export interface UiKnob {
    key: string;
    piece: UiPieceId;
    label: string;
    hint: string;
    kind: UiKnobKind;
    defaultValue: number | string;
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
    placeholder?: string;
}
/** Active non-default UI tweak values keyed by `UiKnob.key`. */
export type UiTweaks = Record<string, number | string>;
/** Ordered catalog of every customizable UI piece on the canvas. */
export declare const UI_PIECES: readonly UiPiece[];
/** Full catalog of UI knobs across all pieces, in display and CSS emission order. */
export declare const UI_KNOBS: readonly UiKnob[];
/** Look up a UI knob definition by its dotted key (`"glass.opacity"`). */
export declare function findUiKnob(key: string): UiKnob | undefined;
/** Look up a UI piece definition by its piece id (`"glass"`). */
export declare function findUiPiece(id: string): UiPiece | undefined;
/** Return every knob belonging to a given UI piece, in display order. */
export declare function knobsForPiece(piece: UiPieceId): readonly UiKnob[];
/**
 * Normalize and clamp a raw value for a given knob. Returns `null` when the
 * input cannot be parsed as a valid value for that knob.
 */
export declare function normalizeUiTweakValue(knob: UiKnob, raw: string | number | null | undefined): number | string | null;
/** Whether a knob's value matches its shipped default (within float epsilon). */
export declare function isDefaultUiTweak(knob: UiKnob, value: number | string | undefined): boolean;
/**
 * Parse a JSON string (from `localStorage` or `canvas.properties["ui.tweaks"]`)
 * into validated, non-default tweak overrides. Invalid keys or values are
 * dropped rather than throwing.
 */
export declare function parseUiTweaks(raw: string | null | undefined): UiTweaks;
/**
 * Clean a `UiTweaks` record in memory so only valid non-default keys remain in
 * canonical `UI_KNOBS` order.
 */
export declare function cleanUiTweaks(tweaks: UiTweaks): UiTweaks;
/**
 * Serialize non-default tweaks to canonical JSON, or `null` when everything is
 * at its default (so `project.update` removes `ui.tweaks` from the canvas).
 */
export declare function serializeUiTweaks(tweaks: UiTweaks): string | null;
/**
 * Set or reset one knob in `tweaks`, returning the updated map or an error
 * message naming the expected range/format.
 */
export declare function setUiTweak(tweaks: UiTweaks, key: string, raw: string | number | null): {
    tweaks: UiTweaks;
    error?: string;
};
/**
 * Reset all tweaks, every knob in one piece (`"rail"`), or one knob
 * (`"rail.btnSize"`).
 */
export declare function resetUiTweaks(tweaks: UiTweaks, target?: string): UiTweaks;
/**
 * Compile non-default UI tweaks into a complete CSS stylesheet string.
 * Returns `""` when no tweaks are active.
 */
export declare function compileUiTweaksCss(input: UiTweaks): string;
