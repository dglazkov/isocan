import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Actor, Item, Operation } from "@isocan/core";
import { sendOp, blobUrl } from "../lib/api.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { applyLocalEcho, useCanvasStore } from "../stores/canvasStore.ts";
import { actorColor } from "../lib/colors.ts";

const DRAG_SLOP = 4;
const MIN_W = 80;
const MIN_H = 60;

export function ItemView({
  item,
  projectId,
  actor,
}: {
  item: Item;
  projectId: string;
  actor: Actor;
}) {
  const selected = useUiStore((s) => s.selectedItemIds.includes(item.id));
  const soleSelection = useUiStore(
    (s) => s.selectedItemIds.length === 1 && s.selectedItemIds[0] === item.id,
  );
  const drag = useUiStore((s) => (s.drag?.itemIds.includes(item.id) ? s.drag : null));
  const resize = useUiStore((s) => (s.resize?.itemId === item.id ? s.resize : null));
  const entered = useUiStore((s) => s.enteredHtmlItemId === item.id);
  const commentMode = useUiStore((s) => s.commentMode);
  // A remote session holding this item shows as an outline in their color.
  const remoteHolder = useCanvasStore((s) => {
    const holder = s.sessions.find((session) => session.selection.includes(item.id));
    return holder ? holder.actor.id : null;
  });

  const x = drag ? item.x + drag.dx : item.x;
  const y = drag ? item.y + drag.dy : item.y;
  const width = resize?.width ?? item.width;
  const height = resize?.height ?? item.height;
  const current = item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions[0]!;
  const stackDepth = Math.min(item.versions.length - 1, 2);

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest(".resize-handle") || target.closest(".version-badge")) return;
    if (entered) return; // entered content owns the pointer

    const ui = useUiStore.getState();
    if (commentMode) {
      // Anchored comment: store the click as an offset from the item origin.
      const world = screenToWorldPoint(e.clientX, e.clientY);
      ui.setPendingComment({ x: world.x - item.x, y: world.y - item.y, anchorItemId: item.id });
      ui.setCommentMode(false);
      return;
    }

    e.stopPropagation();

    if (e.shiftKey) {
      // Shift-click toggles membership; no drag from a shift press.
      ui.toggleSelect(item.id);
      return;
    }

    // Dragging a selected item moves the whole selection; dragging an
    // unselected one selects it alone first.
    const wasInSelection = ui.selectedItemIds.includes(item.id);
    const dragIds = wasInSelection ? ui.selectedItemIds : [item.id];
    if (!wasInSelection) ui.select(item.id);

    const frame = e.currentTarget as HTMLElement;
    frame.setPointerCapture(e.pointerId);
    const start = { x: e.clientX, y: e.clientY };
    let moved = false;

    function onMove(ev: PointerEvent) {
      const scale = useUiStore.getState().viewport.scale;
      if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < DRAG_SLOP) return;
      moved = true;
      useUiStore.getState().setDrag({
        itemIds: dragIds,
        dx: (ev.clientX - start.x) / scale,
        dy: (ev.clientY - start.y) / scale,
        moved,
      });
    }
    function onUp(ev: PointerEvent) {
      frame.releasePointerCapture(ev.pointerId);
      frame.removeEventListener("pointermove", onMove);
      frame.removeEventListener("pointerup", onUp);
      const state = useUiStore.getState();
      const final = state.drag;
      if (!moved || !final) {
        state.setDrag(null);
        return;
      }
      // One op per gesture — a group drag is a single undo step.
      const canvas = useCanvasStore.getState().canvas;
      if (!canvas) {
        state.setDrag(null);
        return;
      }
      const moves = final.itemIds
        .map((itemId) => canvas.items[itemId])
        .filter((dragged) => dragged !== undefined)
        .map((dragged) => ({
          itemId: dragged.id,
          x: Math.round(dragged.x + final.dx),
          y: Math.round(dragged.y + final.dy),
        }));
      const op: Operation | null =
        moves.length === 1
          ? { type: "item.move", ...moves[0]! }
          : moves.length > 1
            ? { type: "items.move", moves }
            : null;
      if (op) {
        // Fold the final position into the replica BEFORE dropping the drag
        // override — otherwise the item flashes at its old position until the
        // WS echo lands.
        applyLocalEcho(op, actor);
        void sendOp(projectId, actor, op);
      }
      state.setDrag(null);
    }
    frame.addEventListener("pointermove", onMove);
    frame.addEventListener("pointerup", onUp);
  }

  function onResizeDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    e.stopPropagation();
    const handle = e.currentTarget as HTMLElement;
    handle.setPointerCapture(e.pointerId);
    const start = { x: e.clientX, y: e.clientY, width: item.width, height: item.height };

    function onMove(ev: PointerEvent) {
      const scale = useUiStore.getState().viewport.scale;
      useUiStore.getState().setResize({
        itemId: item.id,
        width: Math.max(MIN_W, Math.round(start.width + (ev.clientX - start.x) / scale)),
        height: Math.max(MIN_H, Math.round(start.height + (ev.clientY - start.y) / scale)),
      });
    }
    function onUp(ev: PointerEvent) {
      handle.releasePointerCapture(ev.pointerId);
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      const state = useUiStore.getState();
      const final = state.resize;
      if (final && (final.width !== item.width || final.height !== item.height)) {
        const op = {
          type: "item.resize",
          itemId: item.id,
          width: final.width,
          height: final.height,
        } as const;
        applyLocalEcho(op, actor);
        void sendOp(projectId, actor, op);
      }
      state.setResize(null);
    }
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
  }

  function onDoubleClick() {
    useUiStore.getState().setEnteredHtml(item.id);
  }

  return (
    <div
      className={`item${selected ? " selected" : ""}${drag ? " dragging" : ""}`}
      data-item-id={item.id}
      style={{
        left: x,
        top: y,
        width,
        height,
        ...(remoteHolder && !selected
          ? { outline: `2px dashed ${actorColor(remoteHolder)}`, outlineOffset: "1px" }
          : {}),
      }}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
    >
      {stackDepth >= 1 && <span className="ply" style={{ transform: "translate(5px, 5px)", opacity: 0.75 }} />}
      {stackDepth >= 2 && <span className="ply" style={{ transform: "translate(10px, 10px)", opacity: 0.45 }} />}
      {item.versions.length > 1 && (
        <button
          className="version-badge"
          title={`${item.versions.length} versions — fan out (V)`}
          onClick={(e) => {
            e.stopPropagation();
            const ui = useUiStore.getState();
            ui.select(item.id);
            ui.setFanned(ui.fannedItemId === item.id ? null : item.id);
          }}
        >
          ×{item.versions.length}
        </button>
      )}
      <div className="item-titlebar">
        <span className="name" title={`${item.title} — last edit by ${item.updatedBy.name}`}>
          {item.title}
        </span>
      </div>
      <div className={`item-content${entered ? "" : " inert"}`}>
        <VersionContent
          projectId={projectId}
          blobHash={current.blobHash}
          mimeType={current.mimeType}
          filename={current.filename}
          entered={entered}
        />
        {current.mimeType === "text/html" && !entered && (
          <div className="html-hint">double-click to interact</div>
        )}
      </div>
      {soleSelection && !entered && <span className="resize-handle" onPointerDown={onResizeDown} />}
    </div>
  );
}

function screenToWorldPoint(sx: number, sy: number): { x: number; y: number } {
  const { viewport } = useUiStore.getState();
  return { x: (sx - viewport.tx) / viewport.scale, y: (sy - viewport.ty) / viewport.scale };
}

// ---------------- renderers ----------------

const textCache = new Map<string, string>();

export function VersionContent({
  projectId,
  blobHash,
  mimeType,
  filename,
  entered,
}: {
  projectId: string;
  blobHash: string;
  mimeType: string;
  filename: string;
  entered: boolean;
}) {
  const url = blobUrl(projectId, blobHash);
  if (mimeType === "text/markdown" || mimeType === "text/plain") {
    return <MarkdownView url={url} plain={mimeType === "text/plain"} />;
  }
  if (mimeType.startsWith("image/")) {
    return <img className="img-view" src={url} alt={filename} draggable={false} />;
  }
  if (mimeType.startsWith("video/")) {
    return <video className="video-view" src={url} controls={entered} muted loop playsInline />;
  }
  if (mimeType === "text/html") {
    // Security boundary: allow-scripts WITHOUT allow-same-origin gives the
    // document an opaque origin — it cannot reach the daemon API, this app's
    // DOM, or its storage. The blob response additionally carries
    // `CSP: sandbox` and nosniff.
    return <iframe className="html-view" src={url} sandbox="allow-scripts" title={filename} />;
  }
  return (
    <div className="file-view">
      {filename}
      <br />({mimeType})
    </div>
  );
}

function MarkdownView({ url, plain }: { url: string; plain: boolean }) {
  const [text, setText] = useState(() => textCache.get(url) ?? null);

  useEffect(() => {
    if (textCache.has(url)) {
      setText(textCache.get(url)!);
      return;
    }
    let cancelled = false;
    fetch(url)
      .then((res) => res.text())
      .then((body) => {
        textCache.set(url, body);
        if (!cancelled) setText(body);
      })
      .catch(() => !cancelled && setText("(failed to load)"));
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (text === null) return <div className="file-view">…</div>;
  if (plain) return <div className="md-view" style={{ whiteSpace: "pre-wrap" }}>{text}</div>;
  return (
    <div className="md-view">
      {/* GFM: tables, strikethrough, task lists, autolinks */}
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}
