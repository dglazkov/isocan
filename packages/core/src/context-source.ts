import type { CanvasContents, Item } from "./model.ts";
import { normalizeHomeUrl } from "./address.ts";
import { ambientContextItems } from "./canvas-group-context.ts";

/** Saved copy provenance is metadata, never permission or a live source reference. */
export interface ContextSource {
  home: string;
  canvasId: string;
  canvasTitle: string;
  itemId: string;
  itemTitle: string;
  versionId: string;
}

/** Ignore malformed copy metadata instead of granting it authority or following it. */
export function contextSourceOf(item: Pick<Item, "properties">): ContextSource | null {
  try {
    const value = JSON.parse(item.properties.contextSource ?? "null") as Record<string, unknown> | null;
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const keys = ["home", "canvasId", "canvasTitle", "itemId", "itemTitle", "versionId"] as const;
    if (Object.keys(value).length !== keys.length || keys.some((key) => typeof value[key] !== "string")) return null;
    if (![value.canvasId, value.itemId, value.versionId].every((id) => typeof id === "string" && /^[A-Za-z0-9_-]+$/.test(id))) return null;
    const home = new URL(value.home as string);
    if (!["http:", "https:"].includes(home.protocol) || home.username || home.password || home.search || home.hash) return null;
    return { home: normalizeHomeUrl(home.toString()), canvasId: value.canvasId as string, canvasTitle: value.canvasTitle as string,
      itemId: value.itemId as string, itemTitle: value.itemTitle as string, versionId: value.versionId as string };
  } catch { return null; }
}

/** Both surfaces identify the immediate saved source without implying a continuing link. */
export function formatContextSource(source: ContextSource): string {
  return `Copied from ${source.canvasTitle} / ${source.itemTitle}`;
}

/** Context alone reports saved copy sources; automatic preview reads do no new work. */
export function contextCopySources(canvas: CanvasContents): Array<{ itemId: string; title: string; source: ContextSource }> {
  return ambientContextItems(canvas).flatMap((item) => {
    const source = contextSourceOf(item);
    return source ? [{ itemId: item.id, title: item.title, source }] : [];
  });
}
