import { useEffect, useMemo, useState } from "react";
import type { Actor, Canvas } from "@isocan/core";
import { CANVAS_ITEM_SIZE, ago, opWords, parseCanvasAddress } from "@isocan/core";
import { listCanvases } from "../lib/api.ts";
import { addCanvasItem } from "../lib/upload.ts";
import { placeableArea, spotInView } from "../lib/spot.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { KindIcon } from "./KindIcon.tsx";

/**
 * **Place a canvas** (`docs/projects/inception/design.md`, phase 1): one
 * popover with two doors. Type, and the list narrows over your canvases —
 * the ones the home screen shows, most recent first, each with its title and
 * its last act; pick one and it lands where there is room in view. Or paste
 * an address: `/p/<id>` at any origin is recognised and offered as the one
 * row to place, with the title the home knows for it or the id until the
 * card can ask. Two doors, one gesture, one item — the same item
 * `isocan canvas place` makes, through the same contract.
 *
 * The popover is opened by the rail's button OR by ⌘K, which is why the open
 * state lives in the ui store rather than here: two doors to one dialog is
 * the whole point, and a dialog that only its own button could open would
 * be one the palette could not name.
 */
export function PlaceCanvas({ canvasId, actor }: { canvasId: string; actor: Actor }) {
  const open = useUiStore((s) => s.placingCanvas);
  const setOpen = (on: boolean) => useUiStore.getState().setPlacingCanvas(on);
  const [query, setQuery] = useState("");
  const [canvases, setCanvases] = useState<Canvas[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canvas = useCanvasStore((s) => s.canvas);
  const nowMs = Date.now();

  // Read the list when the popover opens, not when the rail mounts: a person
  // who never places a canvas pays nothing for the option.
  useEffect(() => {
    if (!open) return;
    let live = true;
    setCanvases(null);
    listCanvases()
      .then((all) => {
        if (live) setCanvases(all);
      })
      .catch(() => {
        if (live) setCanvases([]);
      });
    return () => {
      live = false;
    };
  }, [open]);

  /** The address door: a pasted `/p/<id>` at any origin. */
  const address = useMemo(() => parseCanvasAddress(query), [query]);
  const needle = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!canvases) return [];
    return canvases
      .filter((one) => one.id !== canvasId)
      .filter((one) => needle === "" || one.title.toLowerCase().includes(needle) || one.id === needle)
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      .slice(0, 8);
  }, [canvases, canvasId, needle]);

  async function place(target: { id: string; title: string; origin?: string }) {
    if (busy) return;
    setBusy(true);
    try {
      // Where there is room in view: the spot is found for the card, so it
      // is not `chosen` and the daemon may tidy it clear.
      const at = spotInView(
        useUiStore.getState().viewport,
        Object.values(canvas?.items ?? {}),
        CANVAS_ITEM_SIZE.width,
        CANVAS_ITEM_SIZE.height,
        placeableArea(),
      );
      const itemId = await addCanvasItem(canvasId, actor, target.origin ?? window.location.origin, target.id, target.title, at);
      setOpen(false);
      setQuery("");
      setError(null);
      useUiStore.getState().select(itemId);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /** The row the address names: the home's title for it when known, the id
   *  until the card can ask the other home. */
  const addressed = address
    ? {
        id: address.canvasId,
        title: canvases?.find((one) => one.id === address.canvasId)?.title ?? address.canvasId,
        origin: address.origin,
      }
    : null;
  const first = addressed ?? matches[0];

  return (
    <div className="place-canvas">
      <button
        className={`tool-btn${open ? " active" : ""}`}
        title="Place a canvas here — search yours, or paste an address"
        aria-label="Place a canvas"
        aria-pressed={open}
        onClick={() => {
          setOpen(!open);
          setError(null);
        }}
      >
        <KindIcon kind="canvas" />
      </button>
      {open && (
        <form
          className="site-popover canvas-picker"
          onSubmit={(e) => {
            e.preventDefault();
            if (first) void place(first);
          }}
        >
          <input
            className="text-input"
            autoFocus
            placeholder="Search your canvases, or paste an address"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
            }}
          />
          <div className="canvas-picker-list" role="listbox" aria-label="Canvases">
            {addressed && (
              <button type="button" className="canvas-picker-row" role="option" onClick={() => void place(addressed)}>
                <span className="canvas-picker-title">{addressed.title}</span>
                <span className="canvas-picker-meta">{addressed.origin.replace(/^https?:\/\//, "")} · Place</span>
              </button>
            )}
            {!addressed && canvases === null && <div className="canvas-picker-note">Looking…</div>}
            {!addressed && canvases !== null && matches.length === 0 && (
              <div className="canvas-picker-note">{needle ? "No canvas by that name — paste its address instead." : "No other canvases here yet."}</div>
            )}
            {!addressed &&
              matches.map((one) => (
                <button key={one.id} type="button" className="canvas-picker-row" role="option" onClick={() => void place({ id: one.id, title: one.title })}>
                  <span className="canvas-picker-title">{one.title}</span>
                  <span className="canvas-picker-meta">
                    {one.updatedBy.name} {opWords(one.lastOp) ?? "did something"} · {ago(one.updatedAt, nowMs) || "just now"}
                  </span>
                </button>
              ))}
          </div>
          {error && <div className="site-error">{error}</div>}
        </form>
      )}
    </div>
  );
}
