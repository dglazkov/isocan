import { blobUrl } from "../lib/api.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { VersionContent } from "./ItemView.tsx";

/**
 * What an item looks like, small — its own content, scaled down, not a letter
 * standing in for it. A canvas is a visual medium; "S" tells you nothing about
 * the screen you are trying to find, and the thing itself tells you everything.
 *
 * Images are drawn directly; everything else is the same renderer the canvas
 * uses, shrunk to fit and inert. Shared by everything that peeks at an item
 * without going to it: the edge radar's card, the files panel's, the
 * favourites bar.
 */
export function ItemThumb({
  projectId,
  itemId,
  width = 34,
  height = 34,
}: {
  projectId: string;
  itemId: string;
  width?: number;
  height?: number;
}) {
  const item = useCanvasStore((s) => s.canvas?.items[itemId]);
  if (!item) return null;
  const current = item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions[0];
  if (!current) return null;
  if (current.mimeType.startsWith("image/")) {
    return (
      <img
        className="item-thumb"
        style={{ width, height }}
        src={blobUrl(projectId, current.blobHash)}
        alt=""
      />
    );
  }
  // Fill the width and crop the tail, the way a screenshot of a page does:
  // letterboxing wastes the little space a thumbnail has, and the top of a
  // thing is the part you recognise it by.
  const fit = width / Math.max(item.width, 1);
  return (
    <span className="item-thumb item-thumb-live" style={{ width, height }}>
      <span
        className="item-thumb-page"
        style={{
          width: item.width,
          height: item.height,
          transform: `scale(${fit})`,
        }}
      >
        <VersionContent
          projectId={projectId}
          blobHash={current.blobHash}
          mimeType={current.mimeType}
          filename={current.filename}
          entered={false}
        />
      </span>
    </span>
  );
}
