/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * **Stitch surface tokens & presets (`@isocan/core/stitch-tokens`).**
 *
 * Pure, dependency-free design-system schema and CSS compiler implementing
 * Stitch surfaces (ADR 0253): solid node frames, Stitch greys (`#f1f3f4` light
 * / `#202124` dark floor), `#6056f0` selection accent, 40px blur on floating
 * chrome, 33 editable tokens across 4 groups (`surface`, `outline`,
 * `typography`, `layout`), and 4 surface presets (`clear`, `frosted`, `subtle`,
 * `dense`).
 */
import type { UiTweaks } from "./ui-tweaks.js";
/** Colour scheme mode for Stitch tokens. */
type StitchThemeMode = "light" | "dark";
/** Per-mode value pair for theme-dependent tokens. */
interface StitchThemed<T> {
    readonly light: T;
    readonly dark: T;
}
/** Value kind of an editable Stitch token. */
type StitchTokenKind = "color-alpha" | "px" | "number" | "font" | "text";
/** The four editable token groups shown in UI Devtools. */
type StitchGroupId = "surface" | "outline" | "typography" | "layout";
/** The four named Stitch chrome surface presets. */
export type StitchPresetId = "clear" | "frosted" | "subtle" | "dense";
/** Primitive value held by a Stitch token. */
type StitchTokenValue = number | string;
/** Metadata for one group of Stitch tokens. */
interface StitchGroupDef {
    readonly id: StitchGroupId;
    readonly label: string;
    readonly hint: string;
}
/** Descriptor for one editable Stitch surface token. */
interface StitchTokenDef {
    readonly id: string;
    readonly group: StitchGroupId;
    readonly label: string;
    readonly cssVar: string;
    readonly kind: StitchTokenKind;
    readonly default: StitchTokenValue | StitchThemed<StitchTokenValue>;
    readonly min?: number;
    readonly max?: number;
    readonly step?: number;
    readonly unit?: "px" | "%";
    readonly description?: string;
}
/** One named Stitch chrome surface preset. */
interface StitchPreset {
    readonly id: StitchPresetId;
    readonly label: string;
    readonly description: string;
    readonly values: StitchThemed<Readonly<Record<string, number>>>;
}
/** Core Stitch palette values for light and dark surfaces (ADR 0253). */
export declare const STITCH_PALETTE: {
    readonly light: {
        readonly floor: "#f1f3f4";
        readonly dot: "#dadce0";
        readonly surface: "#ffffff";
        readonly surfaceMuted: "#f8f9fa";
        readonly accent: "#6056f0";
        readonly ink: "#202124";
        readonly inkMuted: "#5f6368";
        readonly solidNodeFrame: true;
    };
    readonly dark: {
        readonly floor: "#202124";
        readonly dot: "#3c4043";
        readonly surface: "#292a2d";
        readonly surfaceMuted: "#303134";
        readonly accent: "#6056f0";
        readonly ink: "#e8eaed";
        readonly inkMuted: "#9aa0a6";
        readonly solidNodeFrame: true;
    };
};
/** Ordered catalog of the four Stitch design token groups. */
export declare const STITCH_GROUPS: readonly StitchGroupDef[];
/** The 33 editable Stitch surface tokens across the four groups. */
export declare const STITCH_TOKENS: readonly StitchTokenDef[];
/** The four Stitch chrome material presets (`clear`, `frosted`, `subtle`, `dense`). */
export declare const STITCH_PRESETS: readonly StitchPreset[];
/** Ordered preset ids. */
export declare const STITCH_PRESET_IDS: readonly StitchPresetId[];
/** True when `value` is one of the four Stitch surface preset ids. */
export declare function isStitchPresetId(value: unknown): value is StitchPresetId;
/** Look up a Stitch surface preset by id. */
export declare function findStitchPreset(id: string): StitchPreset | undefined;
/** Look up a Stitch token descriptor by id. */
export declare function findStitchToken(id: string): StitchTokenDef | undefined;
/** Return the tokens belonging to one Stitch group. */
export declare function stitchTokensInGroup(group: StitchGroupId): StitchTokenDef[];
/** Clamp and validate a raw override value against a Stitch token descriptor. */
export declare function coerceStitchTokenValue(def: StitchTokenDef, raw: unknown): StitchTokenValue | null;
/**
 * Compile a Stitch surface preset and optional token overrides into a pure CSS
 * stylesheet declaring light and dark custom properties.
 */
export declare function compileStitchTokensCss(presetId: StitchPresetId, overrides?: Readonly<Record<string, StitchTokenValue>>): string;
/**
 * Map one of the four Stitch surface presets onto isocan's existing `UiTweaks`
 * glass knobs so UI Devtools can apply presets with zero new ops.
 */
export declare function stitchPresetToUiTweaks(presetId: StitchPresetId, mode?: StitchThemeMode): UiTweaks;
export {};
