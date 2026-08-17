import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Actor, Item, Operation } from "@isocan/core";
import { BROWSER_MIME, parseUriList } from "@isocan/core";
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
  const entered = useUiStore((s) => s.enteredItemId === item.id);
  const commentMode = useUiStore((s) => s.commentMode);
  // A remote session holding this item shows as an outline in their color.
  const remoteHolder = useCanvasStore((s) => {
    const holder = s.sessions.find((session) => session.selection.includes(item.id));
    return holder ? holder.actor.id : null;
  });
  const worker = useWorkingSession(item.id);

  const x = drag ? item.x + drag.dx : item.x;
  const y = drag ? item.y + drag.dy : item.y;
  const width = resize?.width ?? item.width;
  const height = resize?.height ?? item.height;
  const current = item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions[0]!;
  const stackDepth = Math.min(item.versions.length - 1, 2);
  const isBrowser = current.mimeType === BROWSER_MIME;
  // Bumping this remounts a browser item's iframe — the reload button. Vite
  // sites refresh themselves over HMR; this is for everything that doesn't.
  const [reloadToken, setReloadToken] = useState(0);

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (
      target.closest(".resize-handle") ||
      target.closest(".version-badge") ||
      target.closest(".browser-reload")
    )
      return;
    if (entered) return; // entered content owns the pointer

    const ui = useUiStore.getState();
    // Hand and Zoom tools yield the pointer (no stopPropagation) so the gesture
    // bubbles to the viewport — Hand pans, Zoom fits this item — even though it
    // started here.
    if (ui.activeTool === "hand" || ui.activeTool === "zoom") return;
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
    useUiStore.getState().setEntered(item.id);
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
        ...(worker
          ? ({ "--work-color": actorColor(worker.actorId) } as React.CSSProperties)
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
        {isBrowser && (
          <button
            className="browser-reload"
            title="Reload the projected site"
            onClick={(e) => {
              e.stopPropagation();
              setReloadToken((n) => n + 1);
            }}
          >
            ⟳
          </button>
        )}
        {worker && (
          <span
            className="work-chip"
            title={`${worker.label} is working${worker.status ? ` — ${worker.status}` : ""}`}
          >
            <span className="work-dot" />
            <span className="work-name">{worker.label}</span>
            <i>.</i>
            <i>.</i>
            <i>.</i>
          </span>
        )}
      </div>
      <div className={`item-content${entered ? "" : " inert"}`}>
        <VersionContent
          projectId={projectId}
          blobHash={current.blobHash}
          mimeType={current.mimeType}
          filename={current.filename}
          entered={entered}
          reloadToken={reloadToken}
        />
        {(current.mimeType === "text/html" || isBrowser) && !entered && (
          <div className="html-hint">double-click to interact</div>
        )}
        {worker && <div className="work-sheen" />}
      </div>
      {soleSelection && !entered && <span className="resize-handle" onPointerDown={onResizeDown} />}
    </div>
  );
}

const WORK_LINGER_MS = 2500;

// The session working on this item, held through a short linger after the
// flag clears: the daemon drops `activity` the moment an op lands, so a long
// task would otherwise strobe work → op → work between edits.
function useWorkingSession(
  itemId: string,
): { actorId: string; label: string; status: string | null } | null {
  // Serialized to a scalar so remote cursor moves don't re-render every item.
  const live = useCanvasStore((s) => {
    const session = s.sessions.find(
      (candidate) =>
        candidate.activity?.kind === "working" &&
        "itemId" in candidate.activity &&
        candidate.activity.itemId === itemId,
    );
    return session ? `${session.actor.id}\u0000${session.label}\u0000${session.status ?? ""}` : null;
  });
  const [held, setHeld] = useState<string | null>(null);
  useEffect(() => {
    if (live) {
      setHeld(live);
      return;
    }
    const timer = setTimeout(() => setHeld(null), WORK_LINGER_MS);
    return () => clearTimeout(timer);
  }, [live]);

  const key = live ?? held;
  if (!key) return null;
  const [actorId, label, status] = key.split("\u0000");
  return { actorId: actorId!, label: label!, status: status || null };
}

function screenToWorldPoint(sx: number, sy: number): { x: number; y: number } {
  const { viewport } = useUiStore.getState();
  return { x: (sx - viewport.tx) / viewport.scale, y: (sy - viewport.ty) / viewport.scale };
}

// ---------------- renderers ----------------

const textCache = new Map<string, string>();

/**
 * A blob's body as text, memoized. Only a 2xx is cached — a 404's body is the
 * daemon's `{"error":"blob not found"}`, and reading it as the document is how
 * that JSON ends up rendered on the canvas, then remembered as the file's
 * contents for the rest of the session.
 */
async function fetchBlobText(url: string): Promise<string> {
  const cached = textCache.get(url);
  if (cached !== undefined) return cached;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.text();
  textCache.set(url, body);
  return body;
}

/** Loaded text, a load failure, or neither yet. */
type TextLoad = { text: string } | { failed: string } | null;

function BlobError({ reason }: { reason: string }) {
  return (
    <div className="file-view">
      couldn't load this file
      <br />({reason})
    </div>
  );
}

export function VersionContent({
  projectId,
  blobHash,
  mimeType,
  filename,
  entered,
  reloadToken = 0,
}: {
  projectId: string;
  blobHash: string;
  mimeType: string;
  filename: string;
  entered: boolean;
  /** Bumped by the titlebar's ⟳ to remount a browser item's iframe. */
  reloadToken?: number;
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
  if (mimeType === BROWSER_MIME) {
    return <BrowserView blobUrl={url} reloadToken={reloadToken} />;
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

/**
 * The mini-browser (#40): the version's blob is a text/uri-list naming a
 * live site — typically a localhost dev server — and the content is that
 * site in an iframe. A Vite site refreshes itself over its own HMR socket;
 * the titlebar's ⟳ remounts the frame for everything else.
 *
 * Sandbox posture, deliberately different from the HTML-blob boundary
 * above: the projected site keeps ITS OWN origin (`allow-same-origin`), so
 * its localStorage, cookies, and dev tooling work — and since a dev server
 * on another port is cross-origin from this app, that still cannot reach
 * the canvas's DOM, storage, or the daemon API. The one exception is
 * projecting this app's own origin onto itself, which is the user
 * projecting their own tool — not a boundary this sandbox is defending.
 */
function BrowserView({ blobUrl, reloadToken }: { blobUrl: string; reloadToken: number }) {
  const [load, setLoad] = useState<TextLoad>(() => {
    const cached = textCache.get(blobUrl);
    return cached === undefined ? null : { text: cached };
  });

  useEffect(() => {
    let cancelled = false;
    fetchBlobText(blobUrl)
      .then((body) => !cancelled && setLoad({ text: body }))
      .catch((err: Error) => !cancelled && setLoad({ failed: err.message }));
    return () => {
      cancelled = true;
    };
  }, [blobUrl]);

  if (load === null) return <div className="file-view">…</div>;
  if ("failed" in load) return <BlobError reason={load.failed} />;
  const site = parseUriList(load.text);
  if (site === null) return <BlobError reason="not a link" />;
  return (
    <iframe
      key={reloadToken}
      className="browser-view"
      src={site}
      sandbox="allow-scripts allow-same-origin allow-forms"
      title={site}
    />
  );
}

function MarkdownView({ url, plain }: { url: string; plain: boolean }) {
  const [load, setLoad] = useState<TextLoad>(() => {
    const cached = textCache.get(url);
    return cached === undefined ? null : { text: cached };
  });

  useEffect(() => {
    let cancelled = false;
    fetchBlobText(url)
      .then((body) => !cancelled && setLoad({ text: body }))
      .catch((err: Error) => !cancelled && setLoad({ failed: err.message }));
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (load === null) return <div className="file-view">…</div>;
  if ("failed" in load) return <BlobError reason={load.failed} />;
  if (plain) return <div className="md-view" style={{ whiteSpace: "pre-wrap" }}>{load.text}</div>;
  return (
    <div className="md-view">
      {/* GFM: tables, strikethrough, task lists, autolinks */}
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{load.text}</ReactMarkdown>
    </div>
  );
}
