import { useRef } from "react";
import { Link } from "react-router-dom";
import type { Actor } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { redo, undo } from "../lib/api.ts";
import { addFiles } from "../lib/upload.ts";
import { centerOn, screenToWorld, threadWorldPos } from "../lib/viewport.ts";
import { unreadThreads, useUnreadStore } from "../stores/unreadStore.ts";

/**
 * Comments that arrived while you were away have pins, but a pin can be
 * anywhere on an infinite canvas — this walks them. Each click flies to the
 * next unread thread and opens it, which marks it read, so the count ticks
 * down to nothing.
 */
function UnreadJump({ actor }: { actor: Actor }) {
  const canvas = useCanvasStore((s) => s.canvas);
  const seen = useUnreadStore((s) => s.seen);
  if (!canvas) return null;
  const pending = unreadThreads(canvas, seen, actor.id);
  if (pending.length === 0) return null;

  function jump() {
    const next = pending[0]!;
    const world = threadWorldPos(canvas!, next);
    const ui = useUiStore.getState();
    ui.setViewport(centerOn(ui.viewport, world.x, world.y, window.innerWidth, window.innerHeight));
    ui.setOpenThread(next.id);
  }

  return (
    <button className="btn unread-jump" onClick={jump} title="Go to the next unread comment">
      💬 {pending.length} new
    </button>
  );
}

export function Toolbar({
  projectId,
  actor,
  onZoomToFit,
}: {
  projectId: string;
  actor: Actor;
  onZoomToFit: () => void;
}) {
  const project = useCanvasStore((s) => s.project);
  const connection = useCanvasStore((s) => s.connection);
  const commentMode = useUiStore((s) => s.commentMode);
  const trashOpen = useUiStore((s) => s.trashOpen);
  const trashCount = useCanvasStore((s) => s.canvas?.trash.length ?? 0);
  const fileInput = useRef<HTMLInputElement>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    const { selectedItemIds, viewport } = useUiStore.getState();
    // A single selected item anchors placement (left of it); otherwise the
    // viewport center.
    const placement =
      selectedItemIds.length === 1
        ? { anchorItemId: selectedItemIds[0]! }
        : screenToWorld(viewport, window.innerWidth / 2, window.innerHeight / 2);
    const ids = await addFiles(projectId, actor, files, placement);
    const last = ids[ids.length - 1];
    if (last) useUiStore.getState().select(last);
  }

  return (
    <div className="toolbar">
      <Link className="home" to="/" title="All projects">
        ⌂
      </Link>
      <span className="title">{project?.title ?? "…"}</span>
      <button className="btn primary" onClick={() => fileInput.current?.click()}>
        + Add file
      </button>
      <input
        ref={fileInput}
        type="file"
        multiple
        hidden
        onChange={onPick}
        accept=".md,.markdown,.txt,.html,.htm,image/*,video/*"
      />
      <button
        className={`btn${commentMode ? " active" : ""}`}
        title="Comment mode (C) — click the canvas or an item"
        onClick={() => useUiStore.getState().setCommentMode(!commentMode)}
      >
        💬
      </button>
      <span className="spacer" />
      <UnreadJump actor={actor} />
      <span className={`conn ${connection}`}>{connection}</span>
      <button
        className="btn icon"
        title="Undo (⌘Z)"
        onClick={() => void undo(projectId, actor).catch(() => {})}
      >
        ↩︎
      </button>
      <button
        className="btn icon"
        title="Redo (⇧⌘Z)"
        onClick={() => void redo(projectId, actor).catch(() => {})}
      >
        ↪︎
      </button>
      <button className="btn" onClick={onZoomToFit} title="Zoom to fit (0)">
        Fit
      </button>
      <button
        className={`btn${trashOpen ? " active" : ""}`}
        onClick={() => useUiStore.getState().setTrashOpen(!trashOpen)}
      >
        🗑{trashCount > 0 ? ` ${trashCount}` : ""}
      </button>
    </div>
  );
}
