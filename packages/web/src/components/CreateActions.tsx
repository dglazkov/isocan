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
 * **What is left here is a panel switch, and that is the whole point.**
 *
 * This file held the "content actions" docked in the top bar. Upload went to
 * the tool rail first; `＋ Site` followed it, for the reason stated a few
 * lines below about its old neighbours — an action makes something and is
 * over, a toggle says what you are looking at and stays put — and because
 * "bring something onto the canvas" is one category with one home. The top
 * bar is now navigation, identity and lookups, with nothing in it that makes
 * an item.
 */
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
