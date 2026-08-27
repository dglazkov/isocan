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
export function CreateActions({ canvasId, actor }: { canvasId: string; actor: Actor }) {
  const [siteOpen, setSiteOpen] = useState(false);
  const [siteUrl, setSiteUrl] = useState("");
  const [siteError, setSiteError] = useState<string | null>(null);

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
      const itemId = await addBrowserItem(canvasId, actor, siteUrl, createPlacement());
      setSiteOpen(false);
      setSiteUrl("");
      setSiteError(null);
      useUiStore.getState().select(itemId);
    } catch (err) {
      setSiteError((err as Error).message);
    }
  }

  return (
    <>
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
              Canvas
            </button>
            {siteError && <div className="site-error">{siteError}</div>}
          </form>
        )}
      </div>
    </>
  );
}

/**
 * Which panel the left dock is showing — and it can only be showing one, so
 * the two read as one control with two settings rather than as two buttons
 * that happen to disagree.
 *
 * They used to sit beside "＋ Site", which is a different kind of thing
 * altogether: a panel toggle says what you are LOOKING at and stays where you
 * put it; an action makes something and is over. Mixing the two in one cluster
 * is why the row never quite parsed.
 */
export function PanelSwitch({ canvasId, actor }: { canvasId: string; actor: Actor }) {
  const mainOpen = useUiStore((s) => s.mainPanelOpen);
  const filesOpen = useUiStore((s) => s.filesPanelOpen);
  const canvas = useCanvasStore((s) => s.canvas);
  const seen = useUnreadStore((s) => s.seen);
  const main = canvas ? mainThread(canvas) : null;
  const unread = main ? unreadCount(main, seen, actor.id) : 0;
  return (
    <div className="panel-switch" role="group" aria-label="Left panel">
      <button
        className={`btn${mainOpen ? " active" : ""}`}
        aria-pressed={mainOpen}
        title="Chat — the canvas's conversation, and the one agents always hear"
        onClick={() => openMainPanel(canvasId, !mainOpen)}
      >
        <span className="shelf-glyph">✳</span> Chat
        {unread > 0 && <span className="shelf-badge">{unread}</span>}
      </button>
      <button
        className={`btn${filesOpen ? " active" : ""}`}
        aria-pressed={filesOpen}
        title="Files — everything on this canvas, by kind"
        onClick={() => openFilesPanel(canvasId, !filesOpen)}
      >
        <span className="shelf-glyph">▤</span> Files
      </button>
    </div>
  );
}
