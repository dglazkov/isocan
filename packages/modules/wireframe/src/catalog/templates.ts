import { ARCHETYPE_IDS } from "./archetypes.ts";
import type { Platform } from "./types.ts";

/**
 * **Multi-region layout templates and density** (design §11).
 *
 * Wave 1 stacked every `main.*` slot in a single column inside `<div class="main">`.
 * On desktop (`web`) and marketing (`site`) screens, real interfaces arrange
 * `main` into side-by-side panes, master-detail splits, card grids, bento boxes,
 * or KPI-over-columns dashboards. Each template is a small, fixed vocabulary of
 * sub-regions inside `.main` that collapses back to a single vertical column
 * below `640px` (`@container (min-width: 640px)`).
 */

/** Every layout template id in the catalog. */
export const TEMPLATE_IDS = [
  "single",
  "split",
  "master_detail",
  "grid",
  "bento",
  "hero_then_grid",
  "dashboard",
] as const;

/** A layout template id from `TEMPLATE_IDS`. */
export type TemplateId = (typeof TEMPLATE_IDS)[number];

/** Every spacing density level a wireframe screen can declare. */
export const DENSITY_LEVELS = ["compact", "default", "spacious"] as const;

/** A spacing density level (`compact` → `8px`, `default` → `12px`, `spacious` → `16px`). */
export type DensityLevel = (typeof DENSITY_LEVELS)[number];

/** The `--w-space` CSS length corresponding to each density level. */
export const DENSITY_SPACE: Record<DensityLevel, string> = {
  compact: "8px",
  default: "12px",
  spacious: "16px",
};

/**
 * Map a 1–3 Jev score answer (`"1"`, `"2"`, `"3"` or `1..3`) onto a `DensityLevel`.
 * Out-of-range values clamp to `compact` (≤ 1) or `spacious` (≥ 3); `NaN` falls back to `default`.
 */
export function densityFromScore(score: number | string): DensityLevel {
  const n = typeof score === "number" ? score : Number(score);
  if (!Number.isFinite(n)) return "default";
  if (n <= 1) return "compact";
  if (n >= 3) return "spacious";
  return "default";
}

/** A layout template's definition in the catalog. */
export interface LayoutTemplate {
  /** Stable identifier stored on `WireSpec.template`. */
  id: TemplateId;
  /** Human-readable name for captions and question criteria. */
  label: string;
  /** Short description passed to Jev in round 2's `template` choice criteria. */
  description: string;
  /** Platforms on which this template is valid (`app` only allows single-column or full-bleed hero stacks). */
  platforms: readonly Platform[];
  /** Archetype ids that may select this template in round 2. */
  archetypes: readonly string[];
  /** Ordered sub-regions inside `<div class="main">`. */
  regions: readonly string[];
}

/** The 7 layout templates in the wireframe catalog. */
export const TEMPLATES: readonly LayoutTemplate[] = [
  {
    id: "single",
    label: "Single column",
    description: "One vertical column of sections in reading order",
    platforms: ["app", "web", "site"],
    archetypes: ARCHETYPE_IDS,
    regions: ["main"],
  },
  {
    id: "split",
    label: "Two-column split",
    description: "Primary content on the left (60%) and secondary context or summary on the right (40%)",
    platforms: ["web", "site"],
    archetypes: ["home", "detail", "form", "settings", "profile", "checkout", "pricing"],
    regions: ["primary", "secondary"],
  },
  {
    id: "master_detail",
    label: "Master / detail",
    description: "Selectable list or index on the left (40%) with an inline detail or preview pane on the right (60%)",
    platforms: ["web", "site"],
    archetypes: ["list", "search", "feed", "detail", "master-detail"],
    regions: ["master", "detail"],
  },
  {
    id: "grid",
    label: "Responsive grid",
    description: "Multi-column responsive grid of peer sections or cards",
    platforms: ["web", "site"],
    archetypes: ["list", "gallery", "search", "home", "pricing", "feed", "storefront"],
    regions: ["grid"],
  },
  {
    id: "bento",
    label: "Bento grid",
    description: "Asymmetric multi-span bento grid highlighting the lead section alongside compact peers",
    platforms: ["web", "site"],
    archetypes: ["home", "profile", "pricing", "gallery"],
    regions: ["bento"],
  },
  {
    id: "hero_then_grid",
    label: "Hero then grid",
    description: "Full-width lead banner or hero section above a multi-column grid below",
    platforms: ["app", "web", "site"],
    archetypes: ["home", "welcome", "pricing", "search", "list", "gallery", "landing", "storefront"],
    regions: ["hero", "grid"],
  },
  {
    id: "dashboard",
    label: "KPI + 2-column dashboard",
    description: "Full-width KPI summary row across the top above a 2:1 primary and secondary column split",
    platforms: ["web", "site"],
    archetypes: ["home", "profile", "detail"],
    regions: ["kpi", "primary", "secondary"],
  },
];

/** Fast lookup from `TemplateId` to its `LayoutTemplate` definition. */
export const TEMPLATE_BY_ID: ReadonlyMap<TemplateId, LayoutTemplate> = new Map(
  TEMPLATES.map((t) => [t.id, t]),
);

/** Look up a layout template by id, or throw if it is not in the catalog. */
export function template(id: string): LayoutTemplate {
  const found = TEMPLATE_BY_ID.get(id as TemplateId);
  if (!found) throw new Error(`no layout template "${id}" in the wireframe catalog`);
  return found;
}

/**
 * Candidate layout templates valid for an `(archetype, platform)` pair.
 * Always includes `single` first so a single-column fallback is always available.
 */
export function templatesFor(archetype: string, platform: Platform): readonly LayoutTemplate[] {
  return TEMPLATES.filter(
    (t) => t.platforms.includes(platform) && t.archetypes.includes(archetype),
  );
}

/**
 * Deterministic sub-region assignment for a `main.*` slot when `slot.region`
 * is omitted or does not name a sub-region of `templateId`.
 */
export function defaultSlotRegion(
  templateId: TemplateId,
  slot: { slot: string; block: string | null },
  index: number,
  totalMain: number,
): string {
  switch (templateId) {
    case "single":
      return "main";
    case "grid":
      return "grid";
    case "bento":
      return "bento";
    case "hero_then_grid":
      return index === 0 ? "hero" : "grid";
    case "split":
      return index < Math.ceil(totalMain / 2) ? "primary" : "secondary";
    case "master_detail":
      return index === 0 ? "master" : "detail";
    case "dashboard":
      if (slot.block === "stat-row" || (index === 0 && totalMain >= 3)) return "kpi";
      return index < Math.ceil((totalMain + 1) / 2) ? "primary" : "secondary";
  }
}
