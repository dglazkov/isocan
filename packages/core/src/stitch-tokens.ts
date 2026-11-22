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

import type { UiTweaks } from "./ui-tweaks.ts";

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
export const STITCH_PALETTE = {
  light: {
    floor: "#f1f3f4",
    dot: "#dadce0",
    surface: "#ffffff",
    surfaceMuted: "#f8f9fa",
    accent: "#6056f0",
    ink: "#202124",
    inkMuted: "#5f6368",
    solidNodeFrame: true,
  },
  dark: {
    floor: "#202124",
    dot: "#3c4043",
    surface: "#292a2d",
    surfaceMuted: "#303134",
    accent: "#6056f0",
    ink: "#e8eaed",
    inkMuted: "#9aa0a6",
    solidNodeFrame: true,
  },
} as const;

/** Ordered catalog of the four Stitch design token groups. */
export const STITCH_GROUPS: readonly StitchGroupDef[] = [
  {
    id: "surface",
    label: "Surface",
    hint: "Floating chrome, panels and pills (40px blur, solid node frames per ADR 0253).",
  },
  {
    id: "outline",
    label: "Outline, edges & shadow",
    hint: "Shared hairline borders, optional highlight/shadow (0 by default), and frame radius.",
  },
  {
    id: "typography",
    label: "Typography",
    hint: "Font stack, base size, text scale (3xs..xl), and surface-specific text sizes.",
  },
  {
    id: "layout",
    label: "Spacing & sizing",
    hint: "Base spacing unit and button geometry.",
  },
];

/** The 33 editable Stitch surface tokens across the four groups. */
export const STITCH_TOKENS: readonly StitchTokenDef[] = [
  // --- Surface (7) ---
  { id: "surface-alpha", group: "surface", label: "Fill opacity", cssVar: "--stitch-surface-alpha", kind: "color-alpha", default: { dark: 50, light: 50 }, min: 0, max: 100, step: 1, unit: "%", description: "Container fill opacity (Stitch default: 50%)." },
  { id: "surface-lightness", group: "surface", label: "Fill lightness", cssVar: "--stitch-surface-l", kind: "number", default: { dark: 0.204, light: 0.894 }, min: 0, max: 1, step: 0.01, description: "oklch lightness of chrome fill." },
  { id: "tint-chroma", group: "surface", label: "Fill tint chroma", cssVar: "--stitch-tint-c", kind: "number", default: { dark: 0.003, light: 0.006 }, min: 0, max: 0.1, step: 0.001, description: "oklch chroma of chrome tint." },
  { id: "tint-hue", group: "surface", label: "Fill tint hue", cssVar: "--stitch-tint-h", kind: "number", default: 264, min: 0, max: 360, step: 1, description: "oklch hue of cool Google Grey cast (264)." },
  { id: "surface-blur", group: "surface", label: "Backdrop blur", cssVar: "--stitch-blur", kind: "px", default: 40, min: 0, max: 60, step: 1, unit: "px", description: "Backdrop blur radius (Stitch: 40px) for floating chrome; object frames stay solid." },
  { id: "surface-saturate", group: "surface", label: "Backdrop saturation", cssVar: "--stitch-saturate", kind: "number", default: 100, min: 0, max: 300, step: 5, unit: "%", description: "Backdrop saturate percentage (100% is neutral)." },
  { id: "surface-brightness", group: "surface", label: "Backdrop brightness", cssVar: "--stitch-brightness", kind: "number", default: { dark: 1, light: 1 }, min: 0.8, max: 1.2, step: 0.01, description: "Backdrop brightness multiplier (1 is neutral)." },
  // --- Outline, edges & shadow (9) ---
  { id: "border-alpha", group: "outline", label: "Outline opacity", cssVar: "--stitch-border-alpha", kind: "color-alpha", default: { dark: 15, light: 15 }, min: 0, max: 100, step: 1, unit: "%", description: "Hairline outline opacity (Stitch default: 15%)." },
  { id: "border-lightness", group: "outline", label: "Outline lightness", cssVar: "--stitch-border-l", kind: "number", default: { dark: 0.894, light: 0.204 }, min: 0, max: 1, step: 0.01, description: "oklch lightness of the outline colour." },
  { id: "border-width", group: "outline", label: "Outline width", cssVar: "--stitch-border-width", kind: "px", default: 1, min: 0, max: 4, step: 0.5, unit: "px", description: "Border width of floating containers." },
  { id: "border-outer-alpha", group: "outline", label: "Outer ring opacity", cssVar: "--stitch-border-outer-alpha", kind: "color-alpha", default: { dark: 0, light: 0 }, min: 0, max: 30, step: 1, unit: "%", description: "Optional 1px dark outer ring." },
  { id: "highlight-alpha", group: "outline", label: "Top highlight", cssVar: "--stitch-highlight-alpha", kind: "color-alpha", default: { dark: 0, light: 0 }, min: 0, max: 100, step: 1, unit: "%", description: "Top inner sheen opacity (0 by default per ADR 0253)." },
  { id: "shadow-y", group: "outline", label: "Shadow offset", cssVar: "--stitch-shadow-y", kind: "px", default: 8, min: 0, max: 32, step: 1, unit: "px", description: "Vertical offset of optional resting shadow." },
  { id: "shadow-blur", group: "outline", label: "Shadow blur", cssVar: "--stitch-shadow-blur", kind: "px", default: 14, min: 0, max: 80, step: 1, unit: "px", description: "Blur radius of optional resting shadow." },
  { id: "shadow-alpha", group: "outline", label: "Shadow opacity", cssVar: "--stitch-shadow-alpha", kind: "color-alpha", default: { dark: 0, light: 0 }, min: 0, max: 100, step: 1, unit: "%", description: "Resting shadow opacity (0 by default: Stitch surfaces rest flat)." },
  { id: "radius", group: "outline", label: "Corner radius", cssVar: "--stitch-radius", kind: "px", default: 16, min: 0, max: 24, step: 1, unit: "px", description: "Canvas frame radius (Stitch tier 2: 16px)." },
  // --- Typography (14) ---
  { id: "font-sans", group: "typography", label: "Font family", cssVar: "--stitch-font-sans", kind: "font", default: "'Google Sans Variable', system-ui, -apple-system, sans-serif", description: "UI sans-serif font stack." },
  { id: "base-font-size", group: "typography", label: "Base font size", cssVar: "--stitch-fs-base", kind: "px", default: 16, min: 12, max: 22, step: 1, unit: "px", description: "Root font size." },
  { id: "text-3xs", group: "typography", label: "Text 3xs", cssVar: "--stitch-text-3xs", kind: "px", default: 10, min: 8, max: 40, step: 0.5, unit: "px" },
  { id: "text-2xs", group: "typography", label: "Text 2xs", cssVar: "--stitch-text-2xs", kind: "px", default: 11, min: 8, max: 40, step: 0.5, unit: "px" },
  { id: "text-xs", group: "typography", label: "Text xs", cssVar: "--stitch-text-xs", kind: "px", default: 12, min: 8, max: 40, step: 0.5, unit: "px" },
  { id: "text-sm", group: "typography", label: "Text sm", cssVar: "--stitch-text-sm", kind: "px", default: 14, min: 8, max: 40, step: 0.5, unit: "px" },
  { id: "text-base", group: "typography", label: "Text base", cssVar: "--stitch-text-base", kind: "px", default: 16, min: 8, max: 40, step: 0.5, unit: "px" },
  { id: "text-lg", group: "typography", label: "Text lg", cssVar: "--stitch-text-lg", kind: "px", default: 18, min: 8, max: 40, step: 0.5, unit: "px" },
  { id: "text-xl", group: "typography", label: "Text xl", cssVar: "--stitch-text-xl", kind: "px", default: 20, min: 8, max: 40, step: 0.5, unit: "px" },
  { id: "prompt-font-size", group: "typography", label: "Prompt input text", cssVar: "--stitch-fs-prompt", kind: "px", default: 14, min: 10, max: 28, step: 1, unit: "px" },
  { id: "panel-font-size", group: "typography", label: "Chat conversation text", cssVar: "--stitch-fs-panel", kind: "px", default: 14, min: 10, max: 24, step: 1, unit: "px" },
  { id: "agent-body-size", group: "typography", label: "Agent message text", cssVar: "--stitch-fs-agent", kind: "px", default: 18, min: 12, max: 24, step: 1, unit: "px" },
  { id: "node-title-size", group: "typography", label: "Object title text", cssVar: "--stitch-fs-node-title", kind: "px", default: 14, min: 10, max: 24, step: 1, unit: "px" },
  { id: "node-body-size", group: "typography", label: "Document body text", cssVar: "--stitch-fs-node-body", kind: "px", default: 15, min: 10, max: 28, step: 1, unit: "px" },
  // --- Layout (3) ---
  { id: "spacing-unit", group: "layout", label: "Spacing unit", cssVar: "--stitch-spacing", kind: "px", default: 6, min: 2, max: 6, step: 0.25, unit: "px" },
  { id: "button-height", group: "layout", label: "Button height", cssVar: "--stitch-btn-h", kind: "px", default: 32, min: 24, max: 48, step: 1, unit: "px" },
  { id: "button-padding", group: "layout", label: "Button padding", cssVar: "--stitch-btn-px", kind: "px", default: 10, min: 4, max: 24, step: 1, unit: "px" },
];

/** The four Stitch chrome material presets (`clear`, `frosted`, `subtle`, `dense`). */
export const STITCH_PRESETS: readonly StitchPreset[] = [
  {
    id: "clear",
    label: "Clear",
    description: "Thinner fill (30%) with a slightly crisper hairline (20%) over 40px blur.",
    values: {
      light: { "surface-alpha": 30, "surface-blur": 40, "surface-saturate": 100, "surface-brightness": 1, "border-alpha": 20, "highlight-alpha": 0 },
      dark: { "surface-alpha": 30, "surface-blur": 40, "surface-saturate": 100, "surface-brightness": 1, "border-alpha": 20, "highlight-alpha": 0 },
    },
  },
  {
    id: "frosted",
    label: "Frosted",
    description: "Stitch default: 50% neutral grey fill, 40px blur, 15% hairline outline, no sheen.",
    values: {
      light: { "surface-alpha": 50, "surface-blur": 40, "surface-saturate": 100, "surface-brightness": 1, "border-alpha": 15, "highlight-alpha": 0 },
      dark: { "surface-alpha": 50, "surface-blur": 40, "surface-saturate": 100, "surface-brightness": 1, "border-alpha": 15, "highlight-alpha": 0 },
    },
  },
  {
    id: "subtle",
    label: "Subtle",
    description: "Heavier fill (65%) and a quieter hairline (10%) so the canvas content leads.",
    values: {
      light: { "surface-alpha": 65, "surface-blur": 40, "surface-saturate": 100, "surface-brightness": 1, "border-alpha": 10, "highlight-alpha": 0 },
      dark: { "surface-alpha": 65, "surface-blur": 40, "surface-saturate": 100, "surface-brightness": 1, "border-alpha": 10, "highlight-alpha": 0 },
    },
  },
  {
    id: "dense",
    label: "Dense",
    description: "Nearly opaque chrome (96% light, 92% dark) over 40px blur for maximum legibility.",
    values: {
      light: { "surface-alpha": 96, "surface-blur": 40, "surface-saturate": 100, "surface-brightness": 1, "border-alpha": 15, "highlight-alpha": 0 },
      dark: { "surface-alpha": 92, "surface-blur": 40, "surface-saturate": 100, "surface-brightness": 1, "border-alpha": 15, "highlight-alpha": 0 },
    },
  },
];

/** Ordered preset ids. */
export const STITCH_PRESET_IDS: readonly StitchPresetId[] = ["clear", "frosted", "subtle", "dense"];

/** True when `value` is one of the four Stitch surface preset ids. */
export function isStitchPresetId(value: unknown): value is StitchPresetId {
  return value === "clear" || value === "frosted" || value === "subtle" || value === "dense";
}

/** Look up a Stitch surface preset by id. */
export function findStitchPreset(id: string): StitchPreset | undefined {
  return STITCH_PRESETS.find((preset) => preset.id === id);
}

/** Look up a Stitch token descriptor by id. */
export function findStitchToken(id: string): StitchTokenDef | undefined {
  return STITCH_TOKENS.find((token) => token.id === id);
}

/** Return the tokens belonging to one Stitch group. */
export function stitchTokensInGroup(group: StitchGroupId): StitchTokenDef[] {
  return STITCH_TOKENS.filter((token) => token.group === group);
}

/** Return the default value of `def` for `mode`. */
function stitchTokenDefault(def: StitchTokenDef, mode: StitchThemeMode): StitchTokenValue {
  return typeof def.default === "object" && def.default !== null ? def.default[mode] : def.default;
}

/** Format a Stitch token value into its CSS string (e.g. `40px`, `50%`). */
function formatStitchTokenValue(def: StitchTokenDef, value: StitchTokenValue): string {
  if (typeof value === "string") return value;
  const rounded = def.step && def.step < 1 ? Number(value.toFixed(3)) : Math.round(value * 100) / 100;
  return `${rounded}${def.unit ?? ""}`;
}

/** Clamp and validate a raw override value against a Stitch token descriptor. */
export function coerceStitchTokenValue(def: StitchTokenDef, raw: unknown): StitchTokenValue | null {
  if (def.kind === "font" || def.kind === "text") {
    if (typeof raw !== "string" || raw.trim() === "") return null;
    return raw.trim();
  }
  const parsed = typeof raw === "number" ? raw : typeof raw === "string" ? Number.parseFloat(raw.trim()) : Number.NaN;
  if (!Number.isFinite(parsed)) return null;
  const min = def.min ?? Number.NEGATIVE_INFINITY;
  const max = def.max ?? Number.POSITIVE_INFINITY;
  return Math.min(max, Math.max(min, parsed));
}

/**
 * Compile a Stitch surface preset and optional token overrides into a pure CSS
 * stylesheet declaring light and dark custom properties.
 */
export function compileStitchTokensCss(
  presetId: StitchPresetId,
  overrides?: Readonly<Record<string, StitchTokenValue>>,
): string {
  const preset = findStitchPreset(presetId) ?? STITCH_PRESETS[1]!;

  const blockFor = (mode: StitchThemeMode): string[] => {
    const palette = STITCH_PALETTE[mode];
    const presetValues = preset.values[mode];
    const lines: string[] = [
      `  --stitch-floor: ${palette.floor};`,
      `  --stitch-dot: ${palette.dot};`,
      `  --stitch-surface: ${palette.surface};`,
      `  --stitch-surface-muted: ${palette.surfaceMuted};`,
      `  --stitch-accent: ${palette.accent};`,
      `  --stitch-ink: ${palette.ink};`,
      `  --stitch-ink-muted: ${palette.inkMuted};`,
    ];

    for (const def of STITCH_TOKENS) {
      let value: StitchTokenValue = stitchTokenDefault(def, mode);
      if (presetValues[def.id] !== undefined) {
        value = presetValues[def.id]!;
      }
      if (overrides && overrides[def.id] !== undefined) {
        const coerced = coerceStitchTokenValue(def, overrides[def.id]);
        if (coerced !== null) value = coerced;
      }
      lines.push(`  ${def.cssVar}: ${formatStitchTokenValue(def, value)};`);
    }
    return lines;
  };

  return [
    `:root, :root[data-theme="light"] {\n${blockFor("light").join("\n")}\n}`,
    `:root[data-theme="dark"] {\n${blockFor("dark").join("\n")}\n}`,
  ].join("\n");
}

/**
 * Map one of the four Stitch surface presets onto isocan's existing `UiTweaks`
 * glass knobs so UI Devtools can apply presets with zero new ops.
 */
export function stitchPresetToUiTweaks(presetId: StitchPresetId, mode: StitchThemeMode = "light"): UiTweaks {
  const preset = findStitchPreset(presetId) ?? STITCH_PRESETS[1]!;
  const values = preset.values[mode];
  const alpha = (values["surface-alpha"] ?? 50) / 100;
  const blur = values["surface-blur"] ?? 40;
  const saturate = (values["surface-saturate"] ?? 100) / 100;
  const borderOpacity = (values["border-alpha"] ?? 15) / 100;
  return {
    "glass.opacity": Number(alpha.toFixed(2)),
    "glass.blur": blur,
    "glass.saturate": Number(saturate.toFixed(2)),
    "glass.borderOpacity": Number(borderOpacity.toFixed(2)),
  };
}
