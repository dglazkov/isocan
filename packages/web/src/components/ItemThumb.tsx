import { blobUrl } from "../lib/api.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";

/**
 * What an item looks like, small: a picture if it is one, otherwise the letter
 * it starts with. Shared by everything that peeks at an item without going to
 * it — the edge radar's card and the files panel's — so a peek looks the same
 * wherever you do it.
 */
export function ItemThumb({ projectId, itemId }: { projectId: string; itemId: string }) {
  const item = useCanvasStore((s) => s.canvas?.items[itemId]);
  if (!item) return null;
  const current = item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions[0];
  if (current?.mimeType.startsWith("image/")) {
    return <img className="item-thumb" src={blobUrl(projectId, current.blobHash)} alt="" />;
  }
  return <span className="item-thumb item-thumb-glyph">{item.title.charAt(0).toUpperCase()}</span>;
}
