import { useState } from "react";
import type { Actor, Placement } from "@isocan/core";
import { mainThread } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { addBrowserItem } from "../lib/upload.ts";
import { screenToWorld } from "../lib/viewport.ts";
import { openMainPanel } from "./MainThreadPanel.tsx";
import { openFilesPanel } from "./FilesPanel.tsx";
import { unreadCount, useUnreadStore } from "../stores/unreadStore.ts";

/**
 * The content actions, now docked in the top bar: bring things onto the canvas
 * (a live Site) and open the Main thread — the direct channel to your emissary.
 * File upload has moved to the right tool rail (CanvasTools).
 */
export function CreateActions({ projectId, actor }: { projectId: string; actor: Actor }) {
  const mainOpen = useUiStore((s) => s.mainPanelOpen);
  const filesOpen = useUiStore((s) => s.filesPanelOpen);
  const canvas = useCanvasStore((s) => s.canvas);
  const seen = useUnreadStore((s) => s.seen);
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

  return (
    <div className="create-actions">
      <div className="create-site">
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
      </div>
      <button
        className={`btn${mainOpen ? " active" : ""}`}
        title="Main thread — the canvas's direct channel"
        onClick={() => openMainPanel(projectId, !mainOpen)}
      >
        <span className="shelf-glyph">✳</span> Main
        {unread > 0 && <span className="shelf-badge">{unread}</span>}
      </button>
      <button
        className={`btn${filesOpen ? " active" : ""}`}
        title="Files — everything on this canvas, by kind"
        onClick={() => openFilesPanel(projectId, !filesOpen)}
      >
        <span className="shelf-glyph">▤</span> Files
      </button>
    </div>
  );
}
