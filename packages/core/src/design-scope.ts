import type { CanvasContents, Item } from "./model.ts";
import { canvasScopes } from "./canvas-scope.ts";
import { designSkipped, designTargetScopes, DESIGN_SYSTEM_AFTER, DESIGN_SYSTEM_LIMIT, type DesignScopeOptions } from "./designsystem.ts";
import { selectGoverningDesign, type LinkedCanvas } from "./memory.ts";

/** Actual screen membership determines coverage; a new lane never inherits another lane's missing-system count. */
export function designScopeStanding(canvas: CanvasContents, screenItems: readonly Item[], project?: { properties?: Record<string, string> }, opts: DesignScopeOptions & { linked?: LinkedCanvas[] } = {}) {
  const target = designTargetScopes(canvas, opts), scoped = opts.at !== undefined || opts.groupId !== undefined;
  const scopeId = target.scopes[0]?.id ?? null, linked = opts.linked ?? [];
  const selection = selectGoverningDesign(canvas, linked, { ...opts, ...(project ? { project } : {}) });
  const screens = [...new Set(screenItems.map((item) => item.id))].flatMap((id) => { const item = canvas.items[id]; return item && (!scoped || (canvasScopes(canvas, item)[0]?.id ?? null) === scopeId) ? [item] : []; });
  const uncoveredIds = screens.filter((item) => !selectGoverningDesign(canvas, linked, { at: item }).item).map((item) => item.id);
  const count = scoped ? screens.length : uncoveredIds.length;
  const standing = designSkipped(project ?? {}) || scoped && selection.item || !uncoveredIds.length ? "fine" as const : count >= DESIGN_SYSTEM_LIMIT ? "overdue" as const : count >= DESIGN_SYSTEM_AFTER ? "owed" as const : "fine" as const;
  return { standing, screenCount: screens.length, uncoveredIds, scopeId, selection };
}
