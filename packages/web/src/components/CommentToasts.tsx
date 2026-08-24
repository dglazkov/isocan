import { useEffect } from "react";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { dismissNotice, useUnreadStore, type CommentNotice } from "../stores/unreadStore.ts";
import { centerOn, threadWorldPos } from "../lib/viewport.ts";
import { actorColorIn, useActorColors } from "../lib/colors.ts";
import { openMainPanel } from "./MainThreadPanel.tsx";
import { actorNameIn, useActorNames } from "../lib/names.ts";

const LIFETIME_MS = 12_000; // long enough to read, short enough to forgive

/**
 * A comment arriving is the one remote change worth interrupting for: the pin
 * may be anywhere on an infinite canvas, so a toast says WHO wrote it and
 * WHAT it says, and clicking it flies you to the pin and opens the thread.
 * The pin's own unread badge is the persistent half of the signal.
 */
export function CommentToasts() {
  const notices = useUnreadStore((s) => s.notices);

  // One sweep for the whole stack — a timer per toast would be finer-grained
  // than anyone can perceive.
  useEffect(() => {
    if (notices.length === 0) return;
    const timer = setInterval(() => {
      const stale = useUnreadStore
        .getState()
        .notices.filter((notice) => Date.now() - notice.at > LIFETIME_MS);
      for (const notice of stale) dismissNotice(notice.id);
    }, 1000);
    return () => clearInterval(timer);
  }, [notices.length]);

  if (notices.length === 0) return null;
  return (
    <div className="toasts">
      {notices.map((notice) => (
        <Toast key={notice.id} notice={notice} />
      ))}
    </div>
  );
}

function Toast({ notice }: { notice: CommentNotice }) {
  const colors = useActorColors();
  const names = useActorNames();
  const canvas = useCanvasStore((s) => s.canvas);
  const thread = canvas?.threads[notice.threadId];
  const item = thread?.anchorItemId ? canvas?.items[thread.anchorItemId] : undefined;

  function jump() {
    const state = useCanvasStore.getState().canvas;
    const target = state?.threads[notice.threadId];
    if (target?.main) {
      // The main thread lives in the docked panel, not at a canvas spot.
      const canvasId = useCanvasStore.getState().canvasId;
      if (canvasId) openMainPanel(canvasId, true);
    } else if (target) {
      const world = threadWorldPos(state!, target);
      const ui = useUiStore.getState();
      ui.setViewport(centerOn(ui.viewport, world.x, world.y, window.innerWidth, window.innerHeight));
      ui.setOpenThread(target.id); // opening marks it read
    }
    dismissNotice(notice.id);
  }

  return (
    <div className="toast">
      <button className="toast-body" onClick={jump} title="Show me where">
        <span className="toast-avatar" style={{ background: actorColorIn(colors, notice.author.id) }}>
          {actorNameIn(names, notice.author).charAt(0).toUpperCase()}
        </span>
        <span className="toast-text">
          <span className="toast-who">
            {actorNameIn(names, notice.author)} commented{item ? ` on ${item.title}` : ""}
          </span>
          <span className="toast-said">{notice.body}</span>
        </span>
      </button>
      <button className="toast-close" onClick={() => dismissNotice(notice.id)} title="Dismiss">
        ✕
      </button>
    </div>
  );
}
