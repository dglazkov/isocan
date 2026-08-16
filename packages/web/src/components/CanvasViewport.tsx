import { useEffect, useRef, useState } from "react";
import type { Actor } from "@isocan/core";
import { parseUriList } from "@isocan/core";
import { publishCursor, useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { pan, screenToWorld, worldToScreen, zoomAt } from "../lib/viewport.ts";
import { addFiles } from "../lib/upload.ts";
import { ItemView } from "./ItemView.tsx";
import { VersionFanOut } from "./VersionFanOut.tsx";
import { CommentLayer } from "./CommentLayer.tsx";
import { CursorLayer } from "./CursorLayer.tsx";

export function CanvasViewport({ projectId, actor }: { projectId: string; actor: Actor }) {
  const canvas = useCanvasStore((s) => s.canvas);
  const viewport = useUiStore((s) => s.viewport);
  const commentMode = useUiStore((s) => s.commentMode);
  const fannedItemId = useUiStore((s) => s.fannedItemId);
  const ref = useRef<HTMLDivElement>(null);
  const [dropping, setDropping] = useState(false);
  const [panning, setPanning] = useState(false);
  const spaceDown = useRef(false);

  // Wheel must be non-passive to preventDefault; React's synthetic wheel is
  // passive, so attach by hand.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      // A wheel inside a popover scrolls its own content instead of panning.
      if ((e.target as HTMLElement).closest?.(".thread-popover")) return;
      e.preventDefault();
      const ui = useUiStore.getState();
      if (e.ctrlKey || e.metaKey) {
        // Pinch (macOS trackpads report ctrlKey) or ctrl+wheel: zoom at cursor.
        const factor = Math.exp(-e.deltaY * 0.0022);
        ui.setViewport(zoomAt(ui.viewport, e.clientX, e.clientY, factor));
      } else {
        ui.setViewport(pan(ui.viewport, -e.deltaX, -e.deltaY));
      }
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Track spacebar for space-drag panning.
  useEffect(() => {
    function down(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      if (e.code === "Space") spaceDown.current = true;
    }
    function up(e: KeyboardEvent) {
      if (e.code === "Space") spaceDown.current = false;
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
    const wantsPan = e.button === 1 || (spaceDown.current && e.button === 0);

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
      className={`canvas-viewport${panning ? " panning" : ""}${commentMode ? " comment-mode" : ""}`}
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

