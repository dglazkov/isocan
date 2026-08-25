import { createPortal } from "react-dom";
import { itemKind } from "@isocan/core";
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
 * marks dock.
 */
export function ItemThumb({
  canvasId,
  itemId,
  width = 34,
  height = 34,
}: {
  canvasId: string;
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
        src={blobUrl(canvasId, current.blobHash)}
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
          canvasId={canvasId}
          blobHash={current.blobHash}
          mimeType={current.mimeType}
          filename={current.filename}
          entered={false}
        />
      </span>
    </span>
  );
}

/**
 * A look at an item before you go to it: the thing itself, big, with its name
 * and what it is. The same card the edge radar opens off a beacon and the
 * files panel opens off a row — one question ("what is this?") deserves one
 * answer, in one voice, wherever it is asked.
 *
 * The caller places it, because only the caller knows what it is hanging off.
 *
 * It is PORTALLED to the body, and that is not a detail. This card hangs
 * outside the panel that opens it, and a panel is a stacking context: inside
 * one, no z-index can lift the card above chrome that outranks the panel —
 * the minimap simply painted over it. Leaving the panel is the only fix; the
 * card is position: fixed, so its placement does not change.
 */
export function ItemPeek({
  canvasId,
  itemId,
  style,
}: {
  canvasId: string;
  itemId: string;
  style: React.CSSProperties;
}) {
  const item = useCanvasStore((s) => s.canvas?.items[itemId]);
  if (!item) return null;
  const filename = item.versions.find((v) => v.id === item.currentVersionId)?.filename;
  return createPortal(
    <div className="hover-card item-peek" style={style}>
      <ItemThumb canvasId={canvasId} itemId={itemId} width={240} height={150} />
      <b>{item.title}</b>
      <i>
        {/* The filename says what it is more precisely than the kind word
            does, and says it in the vocabulary the file list uses. */}
        {filename ?? itemKind(item)}
        {item.versions.length > 1 ? ` · v${item.versions.length}` : ""}
      </i>
    </div>,
    document.body,
  );
}
