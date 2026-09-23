import type { CanvasContents, Item } from "./model.ts";
import { canvasScopes } from "./canvas-scope.ts";
import { designSkipped, designTargetScopes, DESIGN_SYSTEM_AFTER, DESIGN_SYSTEM_LIMIT, type DesignScopeOptions } from "./designsystem.ts";
import { selectGoverningDesign, type LinkedCanvas } from "./memory.ts";

/** The item property that says what fidelity a screen was drawn at — `DesignFidelity`'s own words. */
export const FIDELITY_PROP = "fidelity";

/**
 * **A wireframe is not an undesigned screen.** It is a sketch of structure,
 * drawn in grey on purpose, and a design system has nothing to govern in it —
 * so the design-system gate does not count it. Before this, six wireframes on
 * a canvas made the seventh real screen's `isocan add` a refusal (wireframes
 * phase 0's open, closed in phase 1). Read from the property rather than the
 * file, because the gate sees an item's metadata and never its bytes; the
 * wireframes module stamps it on every screen it draws.
 */
export function isWireframeScreen(item: Item): boolean {
  return item.properties?.[FIDELITY_PROP] === "wireframe";
}

/** Actual screen membership determines coverage; a new lane never inherits another lane's missing-system count. */
export function designScopeStanding(canvas: CanvasContents, screenItems: readonly Item[], project?: { properties?: Record<string, string> }, opts: DesignScopeOptions & { linked?: LinkedCanvas[] } = {}) {
  const target = designTargetScopes(canvas, opts), scoped = opts.at !== undefined || opts.groupId !== undefined;
  const scopeId = target.scopes[0]?.id ?? null, linked = opts.linked ?? [];
  const selection = selectGoverningDesign(canvas, linked, { ...opts, ...(project ? { project } : {}) });
  const screens = [...new Set(screenItems.map((item) => item.id))].flatMap((id) => { const item = canvas.items[id]; return item && !isWireframeScreen(item) && (!scoped || (canvasScopes(canvas, item)[0]?.id ?? null) === scopeId) ? [item] : []; });
  const uncoveredIds = screens.filter((item) => !selectGoverningDesign(canvas, linked, { at: item }).item).map((item) => item.id);
  const count = scoped ? screens.length : uncoveredIds.length;
  const standing = designSkipped(project ?? {}) || scoped && selection.item || !uncoveredIds.length ? "fine" as const : count >= DESIGN_SYSTEM_LIMIT ? "overdue" as const : count >= DESIGN_SYSTEM_AFTER ? "owed" as const : "fine" as const;
  return { standing, screenCount: screens.length, uncoveredIds, scopeId, selection };
}
