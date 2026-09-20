import type { CanvasContents } from "./model.ts";
import { groupCopyAction, groupCopySource } from "./canvas-group-copy.ts";
import { excludedInAmbient } from "./canvas-group-context.ts";
import { automaticCanvasTarget, isCanvasItem, sourceOf } from "./canvasitem.ts";
import { isDesignSystem } from "./designsystem.ts";
import { personalContributions } from "./memory.ts";
import type { ContextSource } from "./context-source.ts";

/** Each current contribution explains whether its complete native copy closure is eligible. */
export function contextCopyPieces(canvasId: string, canvas: CanvasContents): Array<{
  itemId: string; title: string; kind: "design" | "pin"; versionId: string | null; itemCount: number; refused?: string;
}> {
  return personalContributions(canvas).map(({ kind, item, version }) => {
    const source = groupCopySource(canvasId, canvas, [item.id]);
    const excluded = source.items.find((one) => excludedInAmbient(canvas, one));
    const link = source.items.find((one) => isCanvasItem(one) || automaticCanvasTarget(one.properties.canvas ?? null, sourceOf(one)).kind !== "none");
    const missing = source.items.find((one) => !one.versions.some((current) => current.id === one.currentVersionId));
    const refused = excluded ? "This piece contains an excluded item; the complete copy is unavailable."
      : link ? "This piece contains a canvas link; canvas links cannot be copied into Context."
      : missing ? "This piece has a missing current version; the complete copy is unavailable." : undefined;
    return { itemId: item.id, title: item.title, kind, versionId: version?.id ?? null, itemCount: source.items.length, ...(refused ? { refused } : {}) };
  });
}

/** Preserve the native copy graph while pinning its root and recording each immediate source. */
export function contextCopyAction(source: ReturnType<typeof groupCopySource>, destinationCanvasId: string,
  provenance: { home: string; canvasTitle: string }, ids: { newItemId: () => string; newVersionId: () => string }): ReturnType<typeof groupCopyAction> {
  const action = groupCopyAction(source, destinationCanvasId, ids);
  for (const [index, item] of action.items.entries()) {
    const original = source.items[index]!;
    const from: ContextSource = { home: provenance.home, canvasId: source.canvasId, canvasTitle: provenance.canvasTitle,
      itemId: original.id, itemTitle: original.title, versionId: original.currentVersionId };
    const properties = item.properties ??= {};
    if (isDesignSystem(original)) delete properties.role;
    properties.contextSource = JSON.stringify(from);
    if (action.rootIds.includes(item.id)) properties.context = "pinned";
  }
  return action;
}
