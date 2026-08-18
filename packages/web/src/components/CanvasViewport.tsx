import { useEffect, useRef, useState } from "react";
import type { Actor } from "@isocan/core";
import { parseUriList } from "@isocan/core";
import { publishCursor, useCanvasStore } from "../stores/canvasStore.ts";
import { type Tool, useUiStore } from "../stores/uiStore.ts";
import { pan, screenToWorld, worldToScreen, zoomAt } from "../lib/viewport.ts";
import { zoomToBox, zoomToItem } from "../lib/zoomactions.ts";
import { addFiles } from "../lib/upload.ts";
import { ItemView } from "./ItemView.tsx";
import { VersionFanOut } from "./VersionFanOut.tsx";
import { CommentLayer } from "./CommentLayer.tsx";
import { CursorLayer } from "./CursorLayer.tsx";

// WebKit-only trackpad pinch event; not in the standard TS DOM lib.
interface GestureEvent extends UIEvent {
  readonly scale: number;
  readonly clientX: number;
  readonly clientY: number;
}

export function CanvasViewport({ projectId, actor }: { projectId: string; actor: Actor }) {
  const canvas = useCanvasStore((s) => s.canvas);
  const viewport = useUiStore((s) => s.viewport);
  const commentMode = useUiStore((s) => s.commentMode);
  const activeTool = useUiStore((s) => s.activeTool);
  const fannedItemId = useUiStore((s) => s.fannedItemId);
  const ref = useRef<HTMLDivElement>(null);
  const [dropping, setDropping] = useState(false);
  const [panning, setPanning] = useState(false);
  // The tool to restore when a momentary Space-grab ends (null when not held).
  const spacePrevTool = useRef<Tool | null>(null);
  // Zoom tool via Z: the tool it interrupted (to restore on a hold-release),
  // and when Z went down (to tell a quick tap from a hold).
  const zoomPrevTool = useRef<Tool | null>(null);
  const zoomDownAt = useRef(0);

  // A macOS trackpad pinch is a wheel event with ctrlKey set (Chrome/Firefox)
  // or a gesture event (Safari). Left alone, the browser zooms the whole page —
  // the toolbar, minimap, and shelf scale and scroll off. We must preventDefault
  // to suppress that, which needs a NON-passive listener (React's synthetic
  // wheel is passive, so we attach by hand). And we listen on `window` in the
  // capture phase, not on the canvas element: the toolbar/minimap/shelf sit on
  // top of the canvas as siblings, so a pinch whose cursor is over one of them
  // would never reach a canvas-scoped listener and the page would zoom anyway.
  useEffect(() => {
    function onWheel(e: WheelEvent) {
      const target = e.target as HTMLElement;
      if (e.ctrlKey || e.metaKey) {
        // Pinch (or ctrl+wheel): always own it, wherever the cursor is, so the
        // browser never page-zooms. Zoom the canvas at the cursor instead.
        e.preventDefault();
        const factor = Math.exp(-e.deltaY * 0.0022);
        const ui = useUiStore.getState();
        ui.setViewport(zoomAt(ui.viewport, e.clientX, e.clientY, factor));
        return;
      }
      // Plain two-finger scroll pans the canvas — but only over the canvas
      // itself, and never over something that scrolls its own content: a thread
      // popover, or the content of an entered item (`.inert` marks content not
      // handed over yet). Elsewhere (toolbar, panels) let the scroll be.
      if (!target.closest?.(".canvas-viewport")) return;
      if (target.closest?.(".thread-popover, .item-content:not(.inert)")) return;
      e.preventDefault();
      const ui = useUiStore.getState();
      ui.setViewport(pan(ui.viewport, -e.deltaX, -e.deltaY));
    }
    window.addEventListener("wheel", onWheel, { passive: false, capture: true });

    // Safari/WebKit trackpad pinch does NOT synthesize a ctrlKey wheel (that is
    // Chrome's behavior, handled above) — it fires gesture events instead.
    // `e.scale` is cumulative from gesturestart, so we zoom by the delta since
    // the last event.
    let gestureScale = 1;
    function onGestureStart(e: GestureEvent) {
      e.preventDefault();
      gestureScale = e.scale;
    }
    function onGestureChange(e: GestureEvent) {
      e.preventDefault();
      const factor = e.scale / gestureScale;
      gestureScale = e.scale;
      const ui = useUiStore.getState();
      ui.setViewport(zoomAt(ui.viewport, e.clientX, e.clientY, factor));
    }
    function onGestureEnd(e: GestureEvent) {
      e.preventDefault();
    }
    const opts = { passive: false, capture: true } as const;
    window.addEventListener("gesturestart", onGestureStart as EventListener, opts);
    window.addEventListener("gesturechange", onGestureChange as EventListener, opts);
    window.addEventListener("gestureend", onGestureEnd as EventListener, opts);

    return () => {
      window.removeEventListener("wheel", onWheel, true);
      window.removeEventListener("gesturestart", onGestureStart as EventListener, true);
      window.removeEventListener("gesturechange", onGestureChange as EventListener, true);
      window.removeEventListener("gestureend", onGestureEnd as EventListener, true);
    };
  }, []);

  // Hold-to-mode keys. Space: a momentary Hand grab — switch to Hand while held,
  // restore the previous tool on release. Z: the Zoom tool — a quick TAP latches
  // it (magnifier stays until you use it or press Esc); a HOLD is momentary
  // (release returns to the previous tool). Either way the pointer becomes a
  // magnifier: hover an item to focus it and click to fit it, or drag a region
  // to zoom into it. Actual pointer work happens in onPointerDown.
  useEffect(() => {
    function down(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }
      if (e.code === "Space" && spacePrevTool.current === null) {
        const ui = useUiStore.getState();
        spacePrevTool.current = ui.activeTool; // capture once; keydown repeats while held
        ui.setActiveTool("hand");
      }
      if (e.code === "KeyZ" && !e.metaKey && !e.ctrlKey) {
        const ui = useUiStore.getState();
        if (ui.activeTool !== "zoom") {
          zoomPrevTool.current = ui.activeTool;
          zoomDownAt.current = Date.now();
          ui.setActiveTool("zoom");
        }
      }
    }
    function up(e: KeyboardEvent) {
      if (e.code === "Space" && spacePrevTool.current !== null) {
        useUiStore.getState().setActiveTool(spacePrevTool.current);
        spacePrevTool.current = null;
      }
      if (e.code === "KeyZ") {
        const ui = useUiStore.getState();
        // Held long enough to be a hold (not a tap): momentary — leave zoom.
        if (ui.activeTool === "zoom" && zoomDownAt.current && Date.now() - zoomDownAt.current > 250) {
          ui.setActiveTool(zoomPrevTool.current ?? "select");
          zoomPrevTool.current = null;
        }
        zoomDownAt.current = 0;
      }
    }
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  function onPointerDown(e: React.PointerEvent) {
    const isBackground = e.target === ref.current || (e.target as HTMLElement).classList.contains("world");
    // Middle-drag or the Hand tool pan. (Space is momentary Hand, so it flows
    // through activeTool too.) The Hand tool pans from anywhere — an item
    // yields its pointer when it is active — so it is not gated on background.
    const wantsPan = e.button === 1 || (activeTool === "hand" && e.button === 0);

    if (activeTool === "zoom" && e.button === 0) {
      // Click an item → fit it; drag the background → zoom into that region.
      const itemId = (e.target as HTMLElement).closest?.("[data-item-id]")?.getAttribute("data-item-id");
      if (itemId) {
        zoomToItem(itemId); // sticky tap stays in zoom; a hold reverts on keyup
        return;
      }
      startZoomRegion(e);
      return;
    }

    if (isBackground && commentMode && e.button === 0 && !wantsPan) {
      const ui = useUiStore.getState();
      const world = screenToWorld(ui.viewport, e.clientX, e.clientY);
      ui.setPendingComment({ x: world.x, y: world.y, anchorItemId: null });
      ui.setCommentMode(false);
      return;
    }

    if (wantsPan) {
      startPan(e);
    } else if (isBackground && e.button === 0) {
      startMarquee(e);
    }
  }

  function startPan(e: React.PointerEvent) {
    e.preventDefault();
    const el = ref.current!;
    el.setPointerCapture(e.pointerId);
    setPanning(true);
    let last = { x: e.clientX, y: e.clientY };

    function onMove(ev: PointerEvent) {
      const dx = ev.clientX - last.x;
      const dy = ev.clientY - last.y;
      last = { x: ev.clientX, y: ev.clientY };
      const ui = useUiStore.getState();
      ui.setViewport(pan(ui.viewport, dx, dy));
    }
    function onUp(ev: PointerEvent) {
      el.releasePointerCapture(ev.pointerId);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      setPanning(false);
    }
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
  }

  /** The Zoom tool's drag: rubber-band a region, then fit it and hand the
   * pointer back to Select. A no-move click does nothing (stays in zoom). */
  function startZoomRegion(e: React.PointerEvent) {
    e.preventDefault();
    const el = ref.current!;
    el.setPointerCapture(e.pointerId);
    const startScreen = { x: e.clientX, y: e.clientY };
    const startWorld = screenToWorld(useUiStore.getState().viewport, e.clientX, e.clientY);
    let moved = false;

    function onMove(ev: PointerEvent) {
      if (!moved && Math.hypot(ev.clientX - startScreen.x, ev.clientY - startScreen.y) < 4) return;
      moved = true;
      const cur = screenToWorld(useUiStore.getState().viewport, ev.clientX, ev.clientY);
      useUiStore.getState().setMarquee({ x1: startWorld.x, y1: startWorld.y, x2: cur.x, y2: cur.y });
    }
    function onUp(ev: PointerEvent) {
      el.releasePointerCapture(ev.pointerId);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      const ui = useUiStore.getState();
      ui.setMarquee(null);
      if (moved) {
        const end = screenToWorld(ui.viewport, ev.clientX, ev.clientY);
        zoomToBox({
          minX: Math.min(startWorld.x, end.x),
          minY: Math.min(startWorld.y, end.y),
          maxX: Math.max(startWorld.x, end.x),
          maxY: Math.max(startWorld.y, end.y),
        });
        ui.setActiveTool("select"); // a region zoom returns you to Select
        zoomPrevTool.current = null;
      }
    }
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
  }

  /** Figma-style rubber-band: live intersection hit-test; shift adds to the
   * selection present when the gesture started; a no-move click clears. */
  function startMarquee(e: React.PointerEvent) {
    e.preventDefault();
    const el = ref.current!;
    el.setPointerCapture(e.pointerId);
    const ui = useUiStore.getState();
    const additive = e.shiftKey;
    const baseSelection = additive ? ui.selectedItemIds : [];
    const startWorld = screenToWorld(ui.viewport, e.clientX, e.clientY);
    let moved = false;

    function onMove(ev: PointerEvent) {
      if (!moved && Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < 4) return;
      moved = true;
      const state = useUiStore.getState();
      const current = screenToWorld(state.viewport, ev.clientX, ev.clientY);
      state.setMarquee({ x1: startWorld.x, y1: startWorld.y, x2: current.x, y2: current.y });

      const minX = Math.min(startWorld.x, current.x);
      const maxX = Math.max(startWorld.x, current.x);
      const minY = Math.min(startWorld.y, current.y);
      const maxY = Math.max(startWorld.y, current.y);
      const items = useCanvasStore.getState().canvas?.items ?? {};
      const hit = Object.values(items)
        .filter(
          (item) =>
            item.x < maxX && item.x + item.width > minX && item.y < maxY && item.y + item.height > minY,
        )
        .map((item) => item.id);
      state.setSelection([...new Set([...baseSelection, ...hit])]);
    }
    function onUp(ev: PointerEvent) {
      el.releasePointerCapture(ev.pointerId);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      const state = useUiStore.getState();
      state.setMarquee(null);
      if (!moved && !additive) {
        // Plain background click: clear selection / close things.
        state.select(null);
        state.setOpenThread(null);
        state.setPendingComment(null);
      }
    }
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
  }

  async function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDropping(false);
    const files = Array.from(e.dataTransfer.files);
    const ui = useUiStore.getState();
    const world = screenToWorld(ui.viewport, e.clientX, e.clientY);

    // A dragged link or tab arrives as text/uri-list — the same type a
    // browser item's blob stores — and lands as a projected site (#40).
    if (files.length === 0) {
      const link = parseUriList(e.dataTransfer.getData("text/uri-list"));
      if (link) {
        const { addBrowserItem } = await import("../lib/upload.ts");
        try {
          ui.select(await addBrowserItem(projectId, actor, link, world));
        } catch {
          // Not http(s) — nothing to project.
        }
      }
      return;
    }

    // Dropping a single file onto an existing item = new version of that item.
    const targetItem = (e.target as HTMLElement).closest?.("[data-item-id]");
    if (targetItem && files.length === 1) {
      const { addVersionFromFile } = await import("../lib/upload.ts");
      await addVersionFromFile(projectId, actor, targetItem.getAttribute("data-item-id")!, files[0]!);
      return;
    }
    const ids = await addFiles(projectId, actor, files, world);
    const last = ids[ids.length - 1];
    if (last) ui.select(last);
  }

  const items = canvas ? Object.values(canvas.items) : [];

  return (
    <div
      ref={ref}
      className={`canvas-viewport${panning ? " panning" : ""}${commentMode ? " comment-mode" : ""}${activeTool === "hand" ? " hand" : ""}${activeTool === "zoom" ? " zoom" : ""}`}
      style={{
        backgroundSize: `${22 * viewport.scale}px ${22 * viewport.scale}px`,
        backgroundPosition: `${viewport.tx}px ${viewport.ty}px`,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={(e) => {
        const ui = useUiStore.getState();
        publishCursor(screenToWorld(ui.viewport, e.clientX, e.clientY));
      }}
      onPointerLeave={() => publishCursor(null)}
      onDragOver={(e) => {
        e.preventDefault();
        setDropping(true);
      }}
      onDragLeave={(e) => {
        if (e.target === ref.current) setDropping(false);
      }}
      onDrop={onDrop}
    >
      <div
        className="world"
        style={{
          transform: `translate(${viewport.tx}px, ${viewport.ty}px) scale(${viewport.scale})`,
        }}
      >
        {items.map((item) => (
          <ItemView key={item.id} item={item} projectId={projectId} actor={actor} />
        ))}
        {fannedItemId && canvas?.items[fannedItemId] && (
          <VersionFanOut item={canvas.items[fannedItemId]!} projectId={projectId} actor={actor} />
        )}
      </div>
      <CommentLayer projectId={projectId} actor={actor} />
      <CursorLayer />
      <MarqueeRect />
      {dropping && <div className="drop-overlay">Drop to add to the canvas</div>}
    </div>
  );
}

function MarqueeRect() {
  const marquee = useUiStore((s) => s.marquee);
  const viewport = useUiStore((s) => s.viewport);
  if (!marquee) return null;
  const a = worldToScreen(viewport, marquee.x1, marquee.y1);
  const b = worldToScreen(viewport, marquee.x2, marquee.y2);
  return (
    <div
      className="marquee"
      style={{
        left: Math.min(a.x, b.x),
        top: Math.min(a.y, b.y),
        width: Math.abs(b.x - a.x),
        height: Math.abs(b.y - a.y),
      }}
    />
  );
}

