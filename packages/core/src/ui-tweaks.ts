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
export const UI_TWEAKS_PROP = "ui.tweaks";

/** Identifier for a customizable UI piece in Devtools and `isocan tweak`. */
export type UiPieceId =
  | "glass"
  | "toolbar"
  | "rail"
  | "zoom"
  | "minimap"
  | "dock"
  | "items"
  | "layers"
  | "colors";

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
export const UI_PIECES: readonly UiPiece[] = [
  {
    id: "glass",
    name: "Floating Glass",
    summary: "Frosted background opacity, blur, saturation, rim border, corner radius, and screen inset.",
    selector: ".floats, .sketch-bar, .ink-well, .react-picker, .identity-popover, .hover-card, .modal-card, .context-menu, .thread-popover, .palette",
  },
  {
    id: "toolbar",
    name: "Top Bar",
    summary: "Header pill height, button inset, cluster gap, font size, opacity, and z-index.",
    selector: ".toolbar, .bar-cluster",
  },
  {
    id: "rail",
    name: "Tool Rail",
    summary: "Right-edge tool button size, icon scale, rail gap, padding, corner radii, opacity, and z-index.",
    selector: ".tool-rail",
  },
  {
    id: "zoom",
    name: "Zoom & Undo",
    summary: "Bottom-right navigation row height, horizontal padding, gap, corner radius, font size, opacity, and z-index.",
    selector: ".zoom-controls",
  },
  {
    id: "minimap",
    name: "Minimap",
    summary: "Bottom-left canvas map scale, corner radius, opacity, and z-index.",
    selector: ".minimap-dock, .minimap",
  },
  {
    id: "dock",
    name: "Chat & Docks",
    summary: "Left and right docked panels (Chat, Files, Agents, Marks): font size, corner radius, opacity, and z-index.",
    selector: ".dock-panel, .rail-strip, .marks, .trash-panel",
  },
  {
    id: "items",
    name: "Canvas Items",
    summary: "Item card corner radius, border width, selection ring thickness, drop-shadow depth, title size, and pin scale.",
    selector: ".item, .pin",
  },
  {
    id: "layers",
    name: "Z-Index & Ground",
    summary: "Every stacking context layer (--z-*), top-edge ground fade height, and dot-grid contrast.",
    selector: ".top-fade, .canvas-viewport",
  },
  {
    id: "colors",
    name: "Theme Colors",
    summary: "Live overrides for accent, canvas ground, card surface, and ink colors.",
    selector: ":root",
  },
];

/** Full catalog of UI knobs across all pieces, in display and CSS emission order. */
export const UI_KNOBS: readonly UiKnob[] = [
  // 1. Floating Glass
  {
    key: "glass.opacity",
    piece: "glass",
    label: "Background opacity",
    hint: "Alpha of frosted floating chrome (--glass). Higher blocks busy canvas work behind controls.",
    kind: "number",
    defaultValue: 0.78,
    min: 0.2,
    max: 1,
    step: 0.01,
  },
  {
    key: "glass.blur",
    piece: "glass",
    label: "Backdrop blur",
    hint: "Frosted glass blur radius across floating bars, rails, and popovers.",
    kind: "number",
    defaultValue: 6,
    min: 0,
    max: 48,
    step: 1,
    unit: "px",
  },
  {
    key: "glass.saturate",
    piece: "glass",
    label: "Backdrop saturate",
    hint: "Color richness behind frosted glass.",
    kind: "number",
    defaultValue: 1.45,
    min: 0.5,
    max: 2.5,
    step: 0.05,
  },
  {
    key: "glass.borderOpacity",
    piece: "glass",
    label: "Border opacity",
    hint: "Hairline rim contrast around floating slabs (--glass-border).",
    kind: "number",
    defaultValue: 0.11,
    min: 0,
    max: 0.5,
    step: 0.01,
  },
  {
    key: "glass.radius",
    piece: "glass",
    label: "Corner radius",
    hint: "Shared corner roundness for floating chrome (--r-float).",
    kind: "number",
    defaultValue: 18,
    min: 0,
    max: 32,
    step: 1,
    unit: "px",
  },
  {
    key: "glass.panelOpacity",
    piece: "glass",
    label: "Menu & header opacity",
    hint: "Opacity of context menus and sticky headers (--panel).",
    kind: "number",
    defaultValue: 0.92,
    min: 0.5,
    max: 1,
    step: 0.01,
  },
  {
    key: "glass.edge",
    piece: "glass",
    label: "Screen inset",
    hint: "Distance between floating chrome and the window edges (--edge).",
    kind: "number",
    defaultValue: 20,
    min: 4,
    max: 48,
    step: 1,
    unit: "px",
  },

  // 2. Top Bar
  {
    key: "toolbar.height",
    piece: "toolbar",
    label: "Pill height",
    hint: "Height of the top bar clusters (--pill-h).",
    kind: "number",
    defaultValue: 34,
    min: 24,
    max: 56,
    step: 1,
    unit: "px",
  },
  {
    key: "toolbar.inset",
    piece: "toolbar",
    label: "Inner inset",
    hint: "Padding between a top-bar pill and the buttons inside it (--pill-inset).",
    kind: "number",
    defaultValue: 4,
    min: 0,
    max: 12,
    step: 1,
    unit: "px",
  },
  {
    key: "toolbar.gap",
    piece: "toolbar",
    label: "Cluster gap",
    hint: "Space between top-bar clusters.",
    kind: "number",
    defaultValue: 8,
    min: 2,
    max: 24,
    step: 1,
    unit: "px",
  },
  {
    key: "toolbar.fontSize",
    piece: "toolbar",
    label: "Font size",
    hint: "Text size in top-bar controls and canvas title.",
    kind: "number",
    defaultValue: 14,
    min: 10,
    max: 18,
    step: 0.5,
    unit: "px",
  },
  {
    key: "toolbar.opacity",
    piece: "toolbar",
    label: "Bar opacity",
    hint: "Overall opacity of the top bar.",
    kind: "number",
    defaultValue: 1,
    min: 0.1,
    max: 1,
    step: 0.02,
  },
  {
    key: "toolbar.zIndex",
    piece: "toolbar",
    label: "Z-index",
    hint: "Stacking layer of the top bar.",
    kind: "number",
    defaultValue: 30,
    min: 1,
    max: 200,
    step: 1,
  },

  // 3. Tool Rail
  {
    key: "rail.btnSize",
    piece: "rail",
    label: "Button size",
    hint: "Width and height of each square tool button.",
    kind: "number",
    defaultValue: 38,
    min: 24,
    max: 64,
    step: 1,
    unit: "px",
  },
  {
    key: "rail.iconScale",
    piece: "rail",
    label: "Icon scale",
    hint: "Multiplier for tool glyphs inside rail buttons.",
    kind: "number",
    defaultValue: 1,
    min: 0.6,
    max: 1.6,
    step: 0.05,
  },
  {
    key: "rail.gap",
    piece: "rail",
    label: "Button gap",
    hint: "Vertical space between buttons in the tool rail.",
    kind: "number",
    defaultValue: 4,
    min: 0,
    max: 16,
    step: 1,
    unit: "px",
  },
  {
    key: "rail.padding",
    piece: "rail",
    label: "Rail padding",
    hint: "Inset around the buttons inside the tool rail.",
    kind: "number",
    defaultValue: 6,
    min: 2,
    max: 16,
    step: 1,
    unit: "px",
  },
  {
    key: "rail.radius",
    piece: "rail",
    label: "Rail radius",
    hint: "Outer corner roundness of the tool rail.",
    kind: "number",
    defaultValue: 16,
    min: 0,
    max: 32,
    step: 1,
    unit: "px",
  },
  {
    key: "rail.btnRadius",
    piece: "rail",
    label: "Button radius",
    hint: "Corner roundness of individual tool buttons.",
    kind: "number",
    defaultValue: 11,
    min: 0,
    max: 24,
    step: 1,
    unit: "px",
  },
  {
    key: "rail.opacity",
    piece: "rail",
    label: "Rail opacity",
    hint: "Overall opacity of the right tool rail.",
    kind: "number",
    defaultValue: 1,
    min: 0.1,
    max: 1,
    step: 0.02,
  },
  {
    key: "rail.zIndex",
    piece: "rail",
    label: "Z-index",
    hint: "Stacking layer of the right tool rail.",
    kind: "number",
    defaultValue: 26,
    min: 1,
    max: 200,
    step: 1,
  },

  // 4. Zoom & Undo
  {
    key: "zoom.height",
    piece: "zoom",
    label: "Row height",
    hint: "Height of the zoom and undo cluster (--zoom-row).",
    kind: "number",
    defaultValue: 43,
    min: 28,
    max: 64,
    step: 1,
    unit: "px",
  },
  {
    key: "zoom.paddingX",
    piece: "zoom",
    label: "Horizontal padding",
    hint: "Left and right padding inside the zoom cluster.",
    kind: "number",
    defaultValue: 7,
    min: 2,
    max: 20,
    step: 1,
    unit: "px",
  },
  {
    key: "zoom.gap",
    piece: "zoom",
    label: "Control gap",
    hint: "Gap between undo, redo, and zoom buttons.",
    kind: "number",
    defaultValue: 5,
    min: 1,
    max: 16,
    step: 1,
    unit: "px",
  },
  {
    key: "zoom.radius",
    piece: "zoom",
    label: "Corner radius",
    hint: "Corner roundness of the zoom cluster.",
    kind: "number",
    defaultValue: 12,
    min: 0,
    max: 28,
    step: 1,
    unit: "px",
  },
  {
    key: "zoom.fontSize",
    piece: "zoom",
    label: "Percentage size",
    hint: "Font size of the zoom percentage readout.",
    kind: "number",
    defaultValue: 12,
    min: 10,
    max: 18,
    step: 0.5,
    unit: "px",
  },
  {
    key: "zoom.opacity",
    piece: "zoom",
    label: "Cluster opacity",
    hint: "Overall opacity of the zoom and undo cluster.",
    kind: "number",
    defaultValue: 1,
    min: 0.1,
    max: 1,
    step: 0.02,
  },
  {
    key: "zoom.zIndex",
    piece: "zoom",
    label: "Z-index",
    hint: "Stacking layer of the zoom cluster.",
    kind: "number",
    defaultValue: 26,
    min: 1,
    max: 200,
    step: 1,
  },

  // 5. Minimap
  {
    key: "minimap.scale",
    piece: "minimap",
    label: "Map scale",
    hint: "Size multiplier for the bottom-left minimap.",
    kind: "number",
    defaultValue: 1,
    min: 0.5,
    max: 2,
    step: 0.05,
  },
  {
    key: "minimap.radius",
    piece: "minimap",
    label: "Corner radius",
    hint: "Corner roundness of the minimap surface.",
    kind: "number",
    defaultValue: 6,
    min: 0,
    max: 24,
    step: 1,
    unit: "px",
  },
  {
    key: "minimap.opacity",
    piece: "minimap",
    label: "Map opacity",
    hint: "Overall opacity of the minimap dock.",
    kind: "number",
    defaultValue: 1,
    min: 0.1,
    max: 1,
    step: 0.02,
  },
  {
    key: "minimap.zIndex",
    piece: "minimap",
    label: "Z-index",
    hint: "Stacking layer of the minimap dock.",
    kind: "number",
    defaultValue: 26,
    min: 1,
    max: 200,
    step: 1,
  },

  // 6. Chat & Docks
  {
    key: "dock.fontSize",
    piece: "dock",
    label: "Panel font size",
    hint: "Base text size in Chat, Files, Agents, and Marks docks.",
    kind: "number",
    defaultValue: 12,
    min: 10,
    max: 18,
    step: 0.5,
    unit: "px",
  },
  {
    key: "dock.radius",
    piece: "dock",
    label: "Panel radius",
    hint: "Corner roundness of docked panels and the shut rail strip.",
    kind: "number",
    defaultValue: 18,
    min: 0,
    max: 32,
    step: 1,
    unit: "px",
  },
  {
    key: "dock.opacity",
    piece: "dock",
    label: "Panel opacity",
    hint: "Overall opacity of docked panels and the shut rail strip.",
    kind: "number",
    defaultValue: 1,
    min: 0.1,
    max: 1,
    step: 0.02,
  },
  {
    key: "dock.zIndex",
    piece: "dock",
    label: "Dock z-index",
    hint: "Stacking layer of docked panels (--z-dock).",
    kind: "number",
    defaultValue: 25,
    min: 1,
    max: 200,
    step: 1,
  },

  // 7. Canvas Items
  {
    key: "items.radius",
    piece: "items",
    label: "Card radius",
    hint: "Corner roundness of item cards on the canvas (--radius).",
    kind: "number",
    defaultValue: 8,
    min: 0,
    max: 32,
    step: 1,
    unit: "px",
  },
  {
    key: "items.borderWidth",
    piece: "items",
    label: "Card border width",
    hint: "Thickness of item card borders.",
    kind: "number",
    defaultValue: 1,
    min: 0,
    max: 4,
    step: 0.5,
    unit: "px",
  },
  {
    key: "items.selectWidth",
    piece: "items",
    label: "Selection outline",
    hint: "Screen-pixel thickness of the accent selection ring.",
    kind: "number",
    defaultValue: 2,
    min: 1,
    max: 6,
    step: 0.5,
    unit: "px",
  },
  {
    key: "items.shadowStrength",
    piece: "items",
    label: "Shadow depth",
    hint: "Multiplier for resting item drop shadows (--shadow-item).",
    kind: "number",
    defaultValue: 1,
    min: 0,
    max: 2.5,
    step: 0.05,
  },
  {
    key: "items.labelSize",
    piece: "items",
    label: "Title label size",
    hint: "Font size of the item titlebar above each card.",
    kind: "number",
    defaultValue: 11,
    min: 9,
    max: 18,
    step: 0.5,
    unit: "px",
  },
  {
    key: "items.pinScale",
    piece: "items",
    label: "Comment pin scale",
    hint: "Size multiplier for comment pins on the canvas.",
    kind: "number",
    defaultValue: 1,
    min: 0.6,
    max: 1.8,
    step: 0.05,
  },

  // 8. Z-Index & Ground
  {
    key: "layers.zCanvas",
    piece: "layers",
    label: "--z-canvas",
    hint: "Guides, marquee, and top fade over items.",
    kind: "number",
    defaultValue: 15,
    min: 1,
    max: 200,
    step: 1,
  },
  {
    key: "layers.zDock",
    piece: "layers",
    label: "--z-dock",
    hint: "Panels docked to an edge (Chat, Files, Agents, Trash).",
    kind: "number",
    defaultValue: 25,
    min: 1,
    max: 200,
    step: 1,
  },
  {
    key: "layers.zFloat",
    piece: "layers",
    label: "--z-float",
    hint: "Floating controls (tool rail, zoom cluster, minimap).",
    kind: "number",
    defaultValue: 26,
    min: 1,
    max: 200,
    step: 1,
  },
  {
    key: "layers.zBar",
    piece: "layers",
    label: "--z-bar",
    hint: "Top bar and chrome whose popovers hang across floating controls.",
    kind: "number",
    defaultValue: 30,
    min: 1,
    max: 200,
    step: 1,
  },
  {
    key: "layers.zPopover",
    piece: "layers",
    label: "--z-popover",
    hint: "Context menus, thread popovers, and peek cards.",
    kind: "number",
    defaultValue: 40,
    min: 1,
    max: 200,
    step: 1,
  },
  {
    key: "layers.zToast",
    piece: "layers",
    label: "--z-toast",
    hint: "Arriving comment and presence toasts.",
    kind: "number",
    defaultValue: 45,
    min: 1,
    max: 200,
    step: 1,
  },
  {
    key: "layers.zModal",
    piece: "layers",
    label: "--z-modal",
    hint: "Command palette (⌘K) and modal backdrops.",
    kind: "number",
    defaultValue: 90,
    min: 1,
    max: 200,
    step: 1,
  },
  {
    key: "layers.zDialog",
    piece: "layers",
    label: "--z-dialog",
    hint: "Identity dialog and top-most system notices.",
    kind: "number",
    defaultValue: 100,
    min: 1,
    max: 200,
    step: 1,
  },
  {
    key: "layers.topFadeHeight",
    piece: "layers",
    label: "Top fade height",
    hint: "Height of the ground gradient wash under the top bar.",
    kind: "number",
    defaultValue: 68,
    min: 0,
    max: 180,
    step: 2,
    unit: "px",
  },
  {
    key: "layers.dotOpacity",
    piece: "layers",
    label: "Dot grid contrast",
    hint: "Strength of the dot grid on the canvas ground (0 hides dots).",
    kind: "number",
    defaultValue: 1,
    min: 0,
    max: 1,
    step: 0.02,
  },

  // 9. Theme Colors
  {
    key: "colors.accent",
    piece: "colors",
    label: "Accent color",
    hint: "Selection, pins, focus rings, and primary buttons (--accent).",
    kind: "color",
    defaultValue: "",
    placeholder: "#1f3fd0",
  },
  {
    key: "colors.ground",
    piece: "colors",
    label: "Canvas ground",
    hint: "Page and canvas background surface (--ground).",
    kind: "color",
    defaultValue: "",
    placeholder: "#fbfbf9",
  },
  {
    key: "colors.card",
    piece: "colors",
    label: "Card surface",
    hint: "Background of item cards and popovers (--card).",
    kind: "color",
    defaultValue: "",
    placeholder: "#ffffff",
  },
  {
    key: "colors.ink",
    piece: "colors",
    label: "Primary ink",
    hint: "Main text and icon color (--ink).",
    kind: "color",
    defaultValue: "",
    placeholder: "#23262b",
  },
];

const KNOB_BY_KEY = new Map<string, UiKnob>(UI_KNOBS.map((knob) => [knob.key, knob]));
const PIECE_BY_ID = new Map<string, UiPiece>(UI_PIECES.map((piece) => [piece.id, piece]));

/** Look up a UI knob definition by its dotted key (`"glass.opacity"`). */
export function findUiKnob(key: string): UiKnob | undefined {
  return KNOB_BY_KEY.get(key);
}

/** Look up a UI piece definition by its piece id (`"glass"`). */
export function findUiPiece(id: string): UiPiece | undefined {
  return PIECE_BY_ID.get(id);
}

/** Return every knob belonging to a given UI piece, in display order. */
export function knobsForPiece(piece: UiPieceId): readonly UiKnob[] {
  return UI_KNOBS.filter((knob) => knob.piece === piece);
}

const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * Normalize and clamp a raw value for a given knob. Returns `null` when the
 * input cannot be parsed as a valid value for that knob.
 */
export function normalizeUiTweakValue(
  knob: UiKnob,
  raw: string | number | null | undefined,
): number | string | null {
  if (raw === null || raw === undefined) return knob.defaultValue;
  if (knob.kind === "color") {
    const trimmed = String(raw).trim().toLowerCase();
    if (trimmed === "" || trimmed === "default" || trimmed === "reset") return "";
    if (!HEX_COLOR_RE.test(trimmed)) return null;
    if (trimmed.length === 4) {
      const r = trimmed[1]!;
      const g = trimmed[2]!;
      const b = trimmed[3]!;
      return `#${r}${r}${g}${g}${b}${b}`;
    }
    return trimmed;
  }

  if (typeof raw === "string" && (raw.trim() === "default" || raw.trim() === "reset")) {
    return knob.defaultValue;
  }
  const num = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (!Number.isFinite(num)) return null;
  let clamped = num;
  if (knob.min !== undefined) clamped = Math.max(knob.min, clamped);
  if (knob.max !== undefined) clamped = Math.min(knob.max, clamped);
  // Round to 3 decimal places to avoid float drift like 0.9000000000000001.
  return Math.round(clamped * 1000) / 1000;
}

/** Whether a knob's value matches its shipped default (within float epsilon). */
export function isDefaultUiTweak(knob: UiKnob, value: number | string | undefined): boolean {
  if (value === undefined) return true;
  if (knob.kind === "number" && typeof value === "number" && typeof knob.defaultValue === "number") {
    return Math.abs(value - knob.defaultValue) < 1e-6;
  }
  return value === knob.defaultValue;
}

/**
 * Parse a JSON string (from `localStorage` or `canvas.properties["ui.tweaks"]`)
 * into validated, non-default tweak overrides. Invalid keys or values are
 * dropped rather than throwing.
 */
export function parseUiTweaks(raw: string | null | undefined): UiTweaks {
  if (!raw || typeof raw !== "string") return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const out: UiTweaks = {};
  for (const [key, val] of Object.entries(parsed as Record<string, unknown>)) {
    const knob = KNOB_BY_KEY.get(key);
    if (!knob) continue;
    if (typeof val !== "number" && typeof val !== "string") continue;
    const normalized = normalizeUiTweakValue(knob, val);
    if (normalized === null || isDefaultUiTweak(knob, normalized)) continue;
    out[key] = normalized;
  }
  return out;
}

/**
 * Clean a `UiTweaks` record in memory so only valid non-default keys remain in
 * canonical `UI_KNOBS` order.
 */
export function cleanUiTweaks(tweaks: UiTweaks): UiTweaks {
  const out: UiTweaks = {};
  for (const knob of UI_KNOBS) {
    const raw = tweaks[knob.key];
    if (raw === undefined) continue;
    const normalized = normalizeUiTweakValue(knob, raw);
    if (normalized === null || isDefaultUiTweak(knob, normalized)) continue;
    out[knob.key] = normalized;
  }
  return out;
}

/**
 * Serialize non-default tweaks to canonical JSON, or `null` when everything is
 * at its default (so `project.update` removes `ui.tweaks` from the canvas).
 */
export function serializeUiTweaks(tweaks: UiTweaks): string | null {
  const cleaned = cleanUiTweaks(tweaks);
  if (Object.keys(cleaned).length === 0) return null;
  return JSON.stringify(cleaned);
}

/**
 * Set or reset one knob in `tweaks`, returning the updated map or an error
 * message naming the expected range/format.
 */
export function setUiTweak(
  tweaks: UiTweaks,
  key: string,
  raw: string | number | null,
): { tweaks: UiTweaks; error?: string } {
  const knob = KNOB_BY_KEY.get(key);
  if (!knob) {
    return {
      tweaks,
      error: `Unknown UI knob "${key}". Run \`isocan tweak\` to list all pieces and keys.`,
    };
  }
  const normalized = normalizeUiTweakValue(knob, raw);
  if (normalized === null) {
    const expected =
      knob.kind === "color"
        ? "a hex color like #1f3fd0 (or 'reset')"
        : `a number between ${knob.min ?? "-∞"} and ${knob.max ?? "∞"}${knob.unit ? knob.unit : ""}`;
    return {
      tweaks,
      error: `Invalid value "${String(raw)}" for ${key}: expected ${expected}.`,
    };
  }
  const next: UiTweaks = { ...tweaks };
  if (isDefaultUiTweak(knob, normalized)) {
    delete next[key];
  } else {
    next[key] = normalized;
  }
  return { tweaks: cleanUiTweaks(next) };
}

/**
 * Reset all tweaks, every knob in one piece (`"rail"`), or one knob
 * (`"rail.btnSize"`).
 */
export function resetUiTweaks(tweaks: UiTweaks, target?: string): UiTweaks {
  if (!target || target === "all") return {};
  const next: UiTweaks = { ...tweaks };
  if (PIECE_BY_ID.has(target)) {
    for (const knob of UI_KNOBS) {
      if (knob.piece === target) delete next[knob.key];
    }
    return cleanUiTweaks(next);
  }
  delete next[target];
  return cleanUiTweaks(next);
}

function num(tweaks: UiTweaks, key: string): number | undefined {
  const val = tweaks[key];
  return typeof val === "number" ? val : undefined;
}

function str(tweaks: UiTweaks, key: string): string | undefined {
  const val = tweaks[key];
  return typeof val === "string" && val.length > 0 ? val : undefined;
}

function clamp01(n: number): number {
  return Math.round(Math.max(0, Math.min(1, n)) * 1000) / 1000;
}

/**
 * Compile non-default UI tweaks into a complete CSS stylesheet string.
 * Returns `""` when no tweaks are active.
 */
export function compileUiTweaksCss(input: UiTweaks): string {
  const tweaks = cleanUiTweaks(input);
  if (Object.keys(tweaks).length === 0) return "";

  const rootVars: string[] = [];
  const darkVars: string[] = [];
  const rules: string[] = [];

  // 1. Floating Glass
  const glassOpacity = num(tweaks, "glass.opacity");
  if (glassOpacity !== undefined) {
    const topA = clamp01(glassOpacity + 0.04);
    const botA = clamp01(glassOpacity - 0.04);
    rootVars.push(
      `--glass: linear-gradient(180deg, rgba(255, 255, 255, ${topA}) 0%, rgba(250, 250, 248, ${botA}) 100%);`,
    );
    darkVars.push(
      `--glass: linear-gradient(180deg, rgba(36, 40, 48, ${topA}) 0%, rgba(23, 26, 31, ${botA}) 100%);`,
    );
  }

  const glassBlur = num(tweaks, "glass.blur");
  const glassSaturate = num(tweaks, "glass.saturate");
  if (glassBlur !== undefined || glassSaturate !== undefined) {
    const b = glassBlur ?? 6;
    const s = glassSaturate ?? 1.45;
    rootVars.push(`--glass-filter: blur(${b}px) saturate(${s});`);
    rules.push(
      `.floats, .minimap, .marks, .sketch-bar, .ink-well, .react-picker { -webkit-backdrop-filter: blur(${b}px) saturate(${s}); backdrop-filter: blur(${b}px) saturate(${s}); }`,
    );
  }

  const glassBorderOpacity = num(tweaks, "glass.borderOpacity");
  if (glassBorderOpacity !== undefined) {
    const lightA = clamp01(glassBorderOpacity);
    const darkA = clamp01(glassBorderOpacity + 0.01);
    rootVars.push(`--glass-border: rgba(30, 34, 40, ${lightA});`);
    darkVars.push(`--glass-border: rgba(255, 255, 255, ${darkA});`);
  }

  const glassRadius = num(tweaks, "glass.radius");
  if (glassRadius !== undefined) {
    rootVars.push(`--r-float: ${glassRadius}px;`);
  }

  const panelOpacity = num(tweaks, "glass.panelOpacity");
  if (panelOpacity !== undefined) {
    const lightA = clamp01(panelOpacity);
    const darkA = clamp01(Math.max(0.5, panelOpacity - 0.02));
    rootVars.push(`--panel: rgba(255, 255, 255, ${lightA});`);
    darkVars.push(`--panel: rgba(23, 26, 31, ${darkA});`);
  }

  const glassEdge = num(tweaks, "glass.edge");
  if (glassEdge !== undefined) {
    rootVars.push(`--edge: ${glassEdge}px;`);
  }

  // 2. Top Bar
  const toolbarHeight = num(tweaks, "toolbar.height");
  if (toolbarHeight !== undefined) {
    rootVars.push(`--pill-h: ${toolbarHeight}px;`);
    rootVars.push(`--topbar: calc(var(--edge) + ${toolbarHeight}px);`);
    rules.push(`.toolbar { height: ${toolbarHeight}px; }`);
  }

  const toolbarInset = num(tweaks, "toolbar.inset");
  if (toolbarInset !== undefined) {
    rootVars.push(`--pill-inset: ${toolbarInset}px;`);
  }

  const toolbarGap = num(tweaks, "toolbar.gap");
  const toolbarOpacity = num(tweaks, "toolbar.opacity");
  const toolbarZ = num(tweaks, "toolbar.zIndex");
  const toolbarFont = num(tweaks, "toolbar.fontSize");
  {
    const decls: string[] = [];
    if (toolbarGap !== undefined) decls.push(`gap: ${toolbarGap}px;`);
    if (toolbarOpacity !== undefined) decls.push(`opacity: ${toolbarOpacity};`);
    if (toolbarZ !== undefined) decls.push(`z-index: ${toolbarZ};`);
    if (toolbarFont !== undefined) decls.push(`font-size: ${toolbarFont}px;`);
    if (decls.length > 0) rules.push(`.toolbar { ${decls.join(" ")} }`);
  }
  if (toolbarFont !== undefined) {
    rules.push(`.toolbar .canvas-name .title, .toolbar .btn { font-size: ${toolbarFont}px; }`);
  }

  // 3. Tool Rail
  const railBtnSize = num(tweaks, "rail.btnSize");
  const railBtnRadius = num(tweaks, "rail.btnRadius");
  const railIconScale = num(tweaks, "rail.iconScale");
  const railGap = num(tweaks, "rail.gap");
  const railPadding = num(tweaks, "rail.padding");
  const railRadius = num(tweaks, "rail.radius");
  const railOpacity = num(tweaks, "rail.opacity");
  const railZ = num(tweaks, "rail.zIndex");
  {
    const railDecls: string[] = [];
    if (railGap !== undefined) railDecls.push(`gap: ${railGap}px;`);
    if (railPadding !== undefined) railDecls.push(`padding: ${railPadding}px;`);
    if (railRadius !== undefined) railDecls.push(`border-radius: ${railRadius}px;`);
    if (railOpacity !== undefined) railDecls.push(`opacity: ${railOpacity};`);
    if (railZ !== undefined) railDecls.push(`z-index: ${railZ};`);
    if (railDecls.length > 0) rules.push(`.tool-rail { ${railDecls.join(" ")} }`);

    const btnDecls: string[] = [];
    if (railBtnSize !== undefined) btnDecls.push(`width: ${railBtnSize}px; height: ${railBtnSize}px;`);
    if (railBtnRadius !== undefined) btnDecls.push(`border-radius: ${railBtnRadius}px;`);
    if (btnDecls.length > 0) rules.push(`.tool-rail .tool-btn { ${btnDecls.join(" ")} }`);

    if (railIconScale !== undefined) {
      rules.push(`.tool-rail .tool-btn > svg { transform: scale(${railIconScale}); }`);
    }
  }

  // 4. Zoom & Undo
  const zoomHeight = num(tweaks, "zoom.height");
  const zoomPadX = num(tweaks, "zoom.paddingX");
  const zoomGap = num(tweaks, "zoom.gap");
  const zoomRadius = num(tweaks, "zoom.radius");
  const zoomFont = num(tweaks, "zoom.fontSize");
  const zoomOpacity = num(tweaks, "zoom.opacity");
  const zoomZ = num(tweaks, "zoom.zIndex");
  if (zoomHeight !== undefined) {
    rootVars.push(`--zoom-row: ${zoomHeight}px;`);
  }
  {
    const decls: string[] = [];
    if (zoomHeight !== undefined) decls.push(`min-height: ${zoomHeight}px;`);
    if (zoomPadX !== undefined) decls.push(`padding-left: ${zoomPadX}px; padding-right: ${zoomPadX}px;`);
    if (zoomGap !== undefined) decls.push(`gap: ${zoomGap}px;`);
    if (zoomRadius !== undefined) decls.push(`border-radius: ${zoomRadius}px;`);
    if (zoomOpacity !== undefined) decls.push(`opacity: ${zoomOpacity};`);
    if (zoomZ !== undefined) decls.push(`z-index: ${zoomZ};`);
    if (decls.length > 0) rules.push(`.zoom-controls { ${decls.join(" ")} }`);
  }
  if (zoomFont !== undefined) {
    rules.push(`.zoom-controls .zoom-pct { font-size: ${zoomFont}px; }`);
  }

  // 5. Minimap
  const minimapScale = num(tweaks, "minimap.scale");
  const minimapRadius = num(tweaks, "minimap.radius");
  const minimapOpacity = num(tweaks, "minimap.opacity");
  const minimapZ = num(tweaks, "minimap.zIndex");
  {
    const dockDecls: string[] = [];
    if (minimapScale !== undefined) {
      dockDecls.push(`transform: scale(${minimapScale}); transform-origin: 0 100%;`);
    }
    if (minimapOpacity !== undefined) dockDecls.push(`opacity: ${minimapOpacity};`);
    if (minimapZ !== undefined) dockDecls.push(`z-index: ${minimapZ};`);
    if (dockDecls.length > 0) rules.push(`.minimap-dock { ${dockDecls.join(" ")} }`);
    if (minimapRadius !== undefined) rules.push(`.minimap { border-radius: ${minimapRadius}px; }`);
  }

  // 6. Chat & Docks
  const dockFont = num(tweaks, "dock.fontSize");
  const dockRadius = num(tweaks, "dock.radius");
  const dockOpacity = num(tweaks, "dock.opacity");
  const dockZ = num(tweaks, "dock.zIndex");
  if (dockZ !== undefined) {
    rootVars.push(`--z-dock: ${dockZ};`);
  }
  {
    const decls: string[] = [];
    if (dockFont !== undefined) decls.push(`font-size: ${dockFont}px;`);
    if (dockRadius !== undefined) decls.push(`border-radius: ${dockRadius}px;`);
    if (dockOpacity !== undefined) decls.push(`opacity: ${dockOpacity};`);
    if (decls.length > 0) rules.push(`.dock-panel { ${decls.join(" ")} }`);
    if (dockRadius !== undefined || dockOpacity !== undefined) {
      const stripDecls: string[] = [];
      if (dockRadius !== undefined) stripDecls.push(`border-radius: ${dockRadius}px;`);
      if (dockOpacity !== undefined) stripDecls.push(`opacity: ${dockOpacity};`);
      rules.push(`.rail-strip, .marks { ${stripDecls.join(" ")} }`);
    }
  }

  // 7. Canvas Items
  const itemsRadius = num(tweaks, "items.radius");
  const itemsBorderWidth = num(tweaks, "items.borderWidth");
  const itemsSelectWidth = num(tweaks, "items.selectWidth");
  const itemsShadow = num(tweaks, "items.shadowStrength");
  const itemsLabelSize = num(tweaks, "items.labelSize");
  const itemsPinScale = num(tweaks, "items.pinScale");
  if (itemsRadius !== undefined) {
    rootVars.push(`--radius: ${itemsRadius}px;`);
  }
  if (itemsBorderWidth !== undefined) {
    rules.push(`.item { border-width: ${itemsBorderWidth}px; }`);
  }
  if (itemsSelectWidth !== undefined) {
    rules.push(
      `.item.selected, .canvas-viewport:not(.pen) .item.selected.hover-target { outline-width: calc(${itemsSelectWidth}px / var(--scale, 1)); }`,
    );
  }
  if (itemsShadow !== undefined) {
    const s1 = clamp01(0.06 * itemsShadow);
    const s2 = clamp01(0.08 * itemsShadow);
    const s3 = clamp01(0.13 * itemsShadow);
    const d1 = clamp01(0.05 * itemsShadow);
    const d2 = clamp01(0.4 * itemsShadow);
    const d3 = clamp01(0.55 * itemsShadow);
    rootVars.push(
      `--shadow-item: 0 1px 3px rgba(30, 34, 40, ${s1}), 0 8px 24px rgba(30, 34, 40, ${s2}), 0 24px 64px rgba(30, 34, 40, ${s3});`,
    );
    darkVars.push(
      `--shadow-item: 0 0 0 1px rgba(255, 255, 255, ${d1}), 0 8px 24px rgba(0, 0, 0, ${d2}), 0 24px 64px rgba(0, 0, 0, ${d3});`,
    );
  }
  if (itemsLabelSize !== undefined) {
    rules.push(`.item-titlebar { font-size: ${itemsLabelSize}px; }`);
  }
  if (itemsPinScale !== undefined) {
    rules.push(`.pin { zoom: ${itemsPinScale}; }`);
  }

  // 8. Z-Index & Ground
  const zMap: readonly [string, string][] = [
    ["layers.zCanvas", "--z-canvas"],
    ["layers.zDock", "--z-dock"],
    ["layers.zFloat", "--z-float"],
    ["layers.zBar", "--z-bar"],
    ["layers.zPopover", "--z-popover"],
    ["layers.zToast", "--z-toast"],
    ["layers.zModal", "--z-modal"],
    ["layers.zDialog", "--z-dialog"],
  ];
  for (const [key, cssVar] of zMap) {
    const val = num(tweaks, key);
    if (val !== undefined) rootVars.push(`${cssVar}: ${val};`);
  }

  const topFadeHeight = num(tweaks, "layers.topFadeHeight");
  if (topFadeHeight !== undefined) {
    if (topFadeHeight <= 0) {
      rules.push(`.top-fade { display: none; }`);
    } else {
      rules.push(`.top-fade { height: ${topFadeHeight}px; }`);
    }
  }

  const dotOpacity = num(tweaks, "layers.dotOpacity");
  if (dotOpacity !== undefined) {
    const pct = Math.round(clamp01(dotOpacity) * 100);
    rootVars.push(`--dot: color-mix(in srgb, #c9ccc4 ${pct}%, var(--ground));`);
    darkVars.push(`--dot: color-mix(in srgb, #2b2f36 ${pct}%, var(--ground));`);
  }

  // 9. Theme Colors
  const accent = str(tweaks, "colors.accent");
  if (accent !== undefined) {
    rootVars.push(`--accent: ${accent};`);
    rootVars.push(`--focus: ${accent};`);
    rootVars.push(`--accent-text: ${accent};`);
    rootVars.push(`--accent-hover: color-mix(in srgb, ${accent} 88%, #000000);`);
    rootVars.push(`--accent-wash: color-mix(in srgb, ${accent} 10%, transparent);`);
    rootVars.push(`--accent-glow: color-mix(in srgb, ${accent} 20%, transparent);`);
    rootVars.push(`--accent-shadow: color-mix(in srgb, ${accent} 48%, transparent);`);
    darkVars.push(`--accent: ${accent};`);
    darkVars.push(`--focus: color-mix(in srgb, ${accent} 70%, #ffffff);`);
    darkVars.push(`--accent-text: color-mix(in srgb, ${accent} 70%, #ffffff);`);
    darkVars.push(`--accent-hover: color-mix(in srgb, ${accent} 85%, #ffffff);`);
  }

  const ground = str(tweaks, "colors.ground");
  if (ground !== undefined) {
    rootVars.push(`--ground: ${ground};`);
    darkVars.push(`--ground: ${ground};`);
  }

  const card = str(tweaks, "colors.card");
  if (card !== undefined) {
    rootVars.push(`--card: ${card};`);
    darkVars.push(`--card: ${card};`);
  }

  const ink = str(tweaks, "colors.ink");
  if (ink !== undefined) {
    rootVars.push(`--ink: ${ink};`);
    darkVars.push(`--ink: ${ink};`);
  }

  const blocks: string[] = [];
  if (rootVars.length > 0) {
    blocks.push(`:root, :root[data-theme="light"], :root[data-theme="dark"] {\n  ${rootVars.join("\n  ")}\n}`);
  }
  if (darkVars.length > 0) {
    blocks.push(`:root[data-theme="dark"] {\n  ${darkVars.join("\n  ")}\n}`);
  }
  blocks.push(...rules);
  return blocks.join("\n");
}
