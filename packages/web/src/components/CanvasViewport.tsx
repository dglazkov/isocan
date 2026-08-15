import { useEffect, useRef, useState } from "react";
import type { Actor } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { pan, screenToWorld, zoomAt } from "../lib/viewport.ts";
import { addFiles } from "../lib/upload.ts";
import { ItemView } from "./ItemView.tsx";
import { VersionFanOut } from "./VersionFanOut.tsx";
import { CommentLayer } from "./CommentLayer.tsx";

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
    const wantsPan = e.button === 1 || spaceDown.current || (isBackground && !commentMode);

    if (isBackground && commentMode && e.button === 0) {
      const ui = useUiStore.getState();
      const world = screenToWorld(ui.viewport, e.clientX, e.clientY);
      ui.setPendingComment({ x: world.x, y: world.y, anchorItemId: null });
      ui.setCommentMode(false);
      return;
    }
    if (!wantsPan) return;

    e.preventDefault();
    const el = ref.current!;
    el.setPointerCapture(e.pointerId);
    setPanning(true);
    let last = { x: e.clientX, y: e.clientY };
    let moved = false;

    function onMove(ev: PointerEvent) {
      const dx = ev.clientX - last.x;
      const dy = ev.clientY - last.y;
      if (Math.abs(ev.clientX - last.x) + Math.abs(ev.clientY - last.y) > 0) moved = true;
      last = { x: ev.clientX, y: ev.clientY };
      const ui = useUiStore.getState();
      ui.setViewport(pan(ui.viewport, dx, dy));
    }
    function onUp(ev: PointerEvent) {
      el.releasePointerCapture(ev.pointerId);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      setPanning(false);
      if (!moved && isBackground && ev.button === 0) {
        // Plain background click: clear selection / close things.
        const ui = useUiStore.getState();
        ui.select(null);
        ui.setOpenThread(null);
        ui.setPendingComment(null);
      }
    }
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
  }

  async function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDropping(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    const ui = useUiStore.getState();
    const world = screenToWorld(ui.viewport, e.clientX, e.clientY);

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
      {dropping && <div className="drop-overlay">Drop to add to the canvas</div>}
      <ZoomChip />
    </div>
  );
}

function ZoomChip() {
  const viewport = useUiStore((s) => s.viewport);
  const setViewport = useUiStore((s) => s.setViewport);
  const center = () => ({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  return (
    <div className="zoom-chip">
      <button onClick={() => setViewport(zoomAt(viewport, center().x, center().y, 1 / 1.25))}>
        −
      </button>
      <span>{Math.round(viewport.scale * 100)}%</span>
      <button onClick={() => setViewport(zoomAt(viewport, center().x, center().y, 1.25))}>+</button>
    </div>
  );
}
