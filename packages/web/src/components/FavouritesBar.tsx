import type { Item } from "@isocan/core";
import { starredItems } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { glideToBox } from "../lib/zoomactions.ts";
import { ItemThumb } from "./ItemThumb.tsx";

/**
 * The shortlist: whatever has been starred, as a strip you can jump from.
 *
 * It docks on the RIGHT, opposite the main thread and the files, because those
 * two are places you read and this is a place you leave from — and because a
 * canvas with a conversation open should still be able to show its shortlist.
 */

export const FAVOURITES_WIDTH = 232;

const openKey = (projectId: string) => `isocan.favourites.${projectId}`;

export function openFavourites(projectId: string, open: boolean): void {
  try {
    localStorage.setItem(openKey(projectId), open ? "open" : "closed");
  } catch {
    // Private mode: it still opens, it just forgets.
  }
  useUiStore.getState().setFavouritesOpen(open);
}

export function restoreFavourites(projectId: string): void {
  try {
    useUiStore.getState().setFavouritesOpen(localStorage.getItem(openKey(projectId)) === "open");
  } catch {
    useUiStore.getState().setFavouritesOpen(false);
  }
}

export function FavouritesBar({ projectId }: { projectId: string }) {
  const open = useUiStore((s) => s.favouritesOpen);
  const canvas = useCanvasStore((s) => s.canvas);
  const selected = useUiStore((s) => s.selectedItemIds);
  if (!open || !canvas) return null;
  const starred = starredItems(canvas);

  function goTo(item: Item) {
    useUiStore.getState().select(item.id);
    // Fit into the canvas this bar leaves visible, so the thing you asked for
    // does not land underneath the list you asked from.
    glideToBox({ minX: item.x, minY: item.y, maxX: item.x + item.width, maxY: item.y + item.height });
  }

  return (
    <aside className="favourites" aria-label="Favourites">
      <header>
        <span className="favourites-glyph">★</span>
        <b>Favourites</b>
        <span className="spacer" />
        <button
          className="main-close"
          title="Close"
          aria-label="Close the favourites bar"
          onClick={() => openFavourites(projectId, false)}
        >
          ✕
        </button>
      </header>
      {starred.length === 0 ? (
        <p className="favourites-empty">
          Nothing starred yet. The star sits at the end of an item's name — point at
          one to see it.
        </p>
      ) : (
        <div className="favourites-list">
          {starred.map((item) => (
            <button
              key={item.id}
              className={`favourite${selected.includes(item.id) ? " active" : ""}`}
              onClick={() => goTo(item)}
              onPointerEnter={() => useUiStore.getState().setPeeked(item.id)}
              onPointerLeave={() => useUiStore.getState().setPeeked(null)}
              title={`Go to ${item.title}`}
            >
              <span className="favourite-shot">
                <ItemThumb projectId={projectId} itemId={item.id} width={200} height={92} />
              </span>
              <span className="favourite-name">
                <b>★</b>
                {item.title}
              </span>
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}
