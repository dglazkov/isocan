import { useRef, useState } from "react";
import type { Actor, Placement } from "@isocan/core";
import { mainThread } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { redo, undo } from "../lib/api.ts";
import { addBrowserItem, addFiles } from "../lib/upload.ts";
import { screenToWorld, zoomAt } from "../lib/viewport.ts";
import { openMainPanel } from "./MainThreadPanel.tsx";
import { unreadCount, useUnreadStore } from "../stores/unreadStore.ts";

/**
 * The Shelf: every verb in one dock at bottom center, in grouped segments —
 * create · converse · history · navigate. The toolbar above keeps only
 * identity (where you are, who's here); nothing up there acts on the canvas.
 */
export function Shelf({
  projectId,
  actor,
  onZoomToFit,
}: {
  projectId: string;
  actor: Actor;
  onZoomToFit: () => void;
}) {
  const commentMode = useUiStore((s) => s.commentMode);
  const mainOpen = useUiStore((s) => s.mainPanelOpen);
  const viewport = useUiStore((s) => s.viewport);
  const canvas = useCanvasStore((s) => s.canvas);
  const seen = useUnreadStore((s) => s.seen);
  const fileInput = useRef<HTMLInputElement>(null);
  const [siteOpen, setSiteOpen] = useState(false);
  const [siteUrl, setSiteUrl] = useState("");
  const [siteError, setSiteError] = useState<string | null>(null);

  const main = canvas ? mainThread(canvas) : null;
  const unread = main ? unreadCount(main, seen, actor.id) : 0;

  // A single selected item anchors placement (left of it); otherwise the
  // viewport center.
  function createPlacement(): Placement {
    const { selectedItemIds, viewport } = useUiStore.getState();
    return selectedItemIds.length === 1
      ? { anchorItemId: selectedItemIds[0]! }
      : screenToWorld(viewport, window.innerWidth / 2, window.innerHeight / 2);
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    const ids = await addFiles(projectId, actor, files, createPlacement());
    const last = ids[ids.length - 1];
    if (last) useUiStore.getState().select(last);
  }

  async function onProjectSite(e: React.FormEvent) {
    e.preventDefault();
    try {
      const itemId = await addBrowserItem(projectId, actor, siteUrl, createPlacement());
      setSiteOpen(false);
      setSiteUrl("");
      setSiteError(null);
      useUiStore.getState().select(itemId);
    } catch (err) {
      setSiteError((err as Error).message);
    }
  }

  const zoom = (factor: number) =>
    useUiStore
      .getState()
      .setViewport(
        zoomAt(useUiStore.getState().viewport, window.innerWidth / 2, window.innerHeight / 2, factor),
      );

  return (
    // With the main panel open, center in the canvas the panel leaves visible.
    <div className={`shelf${mainOpen ? " beside-panel" : ""}`}>
      <button className="btn primary" onClick={() => fileInput.current?.click()}>
        ＋ File
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
        className={`btn${siteOpen ? " active" : ""}`}
        title="Project a live site — point it at your localhost dev server"
        onClick={() => {
          setSiteOpen(!siteOpen);
          setSiteError(null);
        }}
      >
        ＋ Site
      </button>
      {siteOpen && (
        <form className="site-popover" onSubmit={onProjectSite}>
          <input
            className="text-input"
            autoFocus
            placeholder="localhost:5173"
            value={siteUrl}
            onChange={(e) => {
              setSiteUrl(e.target.value);
              setSiteError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setSiteOpen(false);
            }}
          />
          <button className="btn primary" type="submit" disabled={!siteUrl.trim()}>
            Project
          </button>
          {siteError && <div className="site-error">{siteError}</div>}
        </form>
      )}
      <span className="shelf-divider" />
      <button
        className={`btn icon${commentMode ? " active" : ""}`}
        title="Comment mode (C) — click the canvas or an item"
        onClick={() => useUiStore.getState().setCommentMode(!commentMode)}
      >
        💬
      </button>
      <button
        className={`btn${mainOpen ? " active" : ""}`}
        title="Main thread — the canvas's direct channel"
        onClick={() => openMainPanel(projectId, !mainOpen)}
      >
        <span className="shelf-glyph">✳</span> Main
        {unread > 0 && <span className="shelf-badge">{unread}</span>}
      </button>
      <span className="shelf-divider" />
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
      <span className="shelf-divider" />
      <div className="shelf-zoom">
        <button onClick={() => zoom(1 / 1.25)} title="Zoom out">
          −
        </button>
        <span>{Math.round(viewport.scale * 100)}%</span>
        <button onClick={() => zoom(1.25)} title="Zoom in">
          +
        </button>
      </div>
      <button className="btn" onClick={onZoomToFit} title="Zoom to fit (0)">
        ⌖ Fit
      </button>
    </div>
  );
}
