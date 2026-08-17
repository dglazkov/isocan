import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Actor } from "@isocan/core";
import {
  connectToProject,
  disconnect,
  publishSelection,
  setPresenceActor,
  useCanvasStore,
} from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { redo, sendOp, undo } from "../lib/api.ts";
import { centerOn, fitBounds, itemsBounds } from "../lib/viewport.ts";
import { sessionLocus } from "../lib/presence.ts";
import { checkForUpdate } from "../lib/appversion.ts";
import { CanvasViewport } from "../components/CanvasViewport.tsx";
import { CommandBar } from "../components/CommandBar.tsx";
import { Toolbar } from "../components/Toolbar.tsx";
import { Shelf } from "../components/Shelf.tsx";
import { Minimap } from "../components/Minimap.tsx";
import { TrashPanel } from "../components/TrashPanel.tsx";
import { MainThreadPanel, PANEL_WIDTH } from "../components/MainThreadPanel.tsx";
import { CommentToasts } from "../components/CommentToasts.tsx";
import { unreadThreads, useUnreadStore } from "../stores/unreadStore.ts";

export function CanvasPage({
  actor,
  onIdentity,
}: {
  actor: Actor;
  onIdentity: (actor: Actor | null) => void;
}) {
  const { projectId } = useParams<{ projectId: string }>();
  const canvas = useCanvasStore((s) => s.canvas);
  const connection = useCanvasStore((s) => s.connection);
  const seen = useUnreadStore((s) => s.seen);
  const followSessionId = useUiStore((s) => s.followSessionId);
  const followedLabel = useCanvasStore((s) => {
    const session = s.sessions.find((x) => x.sessionId === followSessionId);
    return session ? session.label ?? session.actor.name : null;
  });
  const [outdated, setOutdated] = useState(false);
  const didFit = useRef(false);
  // Who to open a connection as, without making a rename reconnect.
  const actorRef = useRef(actor);
  actorRef.current = actor;

  useEffect(() => {
    if (!projectId) return;
    didFit.current = false;
    connectToProject(projectId, actorRef.current);
    return disconnect;
  }, [projectId]);

  // Becoming someone else does NOT drop the socket. The tab keeps its session
  // and simply asserts the new actor on the next presence beat, which the
  // daemon adopts — reconnecting would race the old socket's teardown against
  // the new socket's session (same tab id) and could leave you off the roster.
  useEffect(() => {
    setPresenceActor(actor);
  }, [actor]);

  // Broadcast selection changes on the presence channel.
  useEffect(() => useUiStore.subscribe((s, prev) => {
    if (s.selectedItemIds !== prev.selectedItemIds) publishSelection();
  }), []);

  // Zoom-to-fit once, on the first snapshot.
  useEffect(() => {
    if (!canvas || didFit.current) return;
    didFit.current = true;
    const box = itemsBounds(canvas);
    if (box) {
      useUiStore
        .getState()
        .setViewport(fitBounds(box, window.innerWidth, window.innerHeight));
    }
  }, [canvas]);

  // Watch mode (#39): the camera chases the followed session's locus so the
  // agent's work is always on screen. Rest-and-chase, not a hard tether:
  // hold still while they putter near center, glide after them once they
  // stray, settle again. Any manual pan/zoom/jump goes through setViewport,
  // which clears the follow — the user grabbing the wheel always wins.
  useEffect(() => {
    if (!followSessionId) return;
    let raf = 0;
    let chasing = true; // open with a catch-up glide to wherever they are
    const step = () => {
      const { sessions, canvas: current } = useCanvasStore.getState();
      const ui = useUiStore.getState();
      const session = sessions.find((s) => s.sessionId === followSessionId);
      const locus = session && current ? sessionLocus(session, current) : null;
      if (!locus || session!.scope === "home") {
        ui.setFollow(null); // they left, or lost their place — nothing to watch
        return;
      }
      const width = window.innerWidth + (ui.mainPanelOpen ? PANEL_WIDTH : 0);
      const target = centerOn(ui.viewport, locus.x, locus.y, width, window.innerHeight);
      const dx = target.tx - ui.viewport.tx;
      const dy = target.ty - ui.viewport.ty;
      const dist = Math.hypot(dx, dy); // screen px — tx/ty live in screen space
      const wake = Math.min(width, window.innerHeight) * 0.22;
      if (!chasing && dist > wake) chasing = true;
      if (chasing) {
        if (dist < 1) chasing = false;
        else ui.followViewport({ ...ui.viewport, tx: ui.viewport.tx + dx * 0.12, ty: ui.viewport.ty + dy * 0.12 });
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [followSessionId]);

  // A daemon restart is where an upgrade becomes visible: the socket drops,
  // comes back, and the app this tab is running may no longer be the one being
  // served. Check on every reconnect (and once on arrival) rather than polling.
  useEffect(() => {
    if (connection !== "live") return;
    let cancelled = false;
    void checkForUpdate().then((yes) => {
      if (yes && !cancelled) setOutdated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [connection]);

  // Unread comments reach a backgrounded tab through its title.
  useEffect(() => {
    const count = canvas ? unreadThreads(canvas, seen, actor.id).length : 0;
    document.title = count > 0 ? `(${count}) isocan` : "isocan";
    return () => {
      document.title = "isocan";
    };
  }, [canvas, seen, actor.id]);

  const zoomToFit = useCallback(() => {
    const current = useCanvasStore.getState().canvas;
    if (!current) return;
    const box = itemsBounds(current);
    if (box) {
      useUiStore.getState().setViewport(fitBounds(box, window.innerWidth, window.innerHeight));
    }
  }, []);

  // Keyboard shortcuts — typical visual-editor ergonomics.
  useEffect(() => {
    if (!projectId) return;
    function onKeyDown(e: KeyboardEvent) {
      // ⌘K is global — the lane to your emissary opens from anywhere, even
      // mid-typing in another field.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const ui = useUiStore.getState();
        ui.setCommandBarOpen(!ui.commandBarOpen);
        return;
      }
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }
      const ui = useUiStore.getState();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        const action = e.shiftKey ? redo : undo;
        void action(projectId!, actor).catch(() => {}); // 409 = nothing to undo
      } else if (e.key === "Delete" || e.key === "Backspace") {
        const ids = ui.selectedItemIds;
        if (ids.length > 0) {
          e.preventDefault();
          // Batch delete = one undo step for the whole selection.
          void sendOp(
            projectId!,
            actor,
            ids.length === 1
              ? { type: "item.delete", itemId: ids[0]! }
              : { type: "items.delete", itemIds: ids },
          );
          ui.select(null);
        }
      } else if (e.key === "Escape") {
        // Watching is the outermost mode: Esc hands the camera back first.
        if (ui.followSessionId) ui.setFollow(null);
        else if (ui.pendingComment) ui.setPendingComment(null);
        else if (ui.openThreadId) ui.setOpenThread(null);
        else if (ui.commentMode) ui.setCommentMode(false);
        else if (ui.fannedItemId) ui.setFanned(null);
        else if (ui.enteredItemId) ui.setEntered(null);
        else ui.select(null);
      } else if (e.key.toLowerCase() === "v" && !e.metaKey && !e.ctrlKey) {
        if (ui.selectedItemIds.length === 1) {
          const only = ui.selectedItemIds[0]!;
          ui.setFanned(ui.fannedItemId === only ? null : only);
        }
      } else if (e.key === "0") {
        zoomToFit();
      } else if (e.key.toLowerCase() === "c" && !e.metaKey && !e.ctrlKey) {
        ui.setCommentMode(!ui.commentMode);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [projectId, actor, zoomToFit]);

  if (!projectId) return null;

  if (connection === "gone") {
    return (
      <div className="canvas-page">
        <div className="page-note">
          This project was deleted.&nbsp;<Link to="/">Back to projects</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="canvas-page">
      <CanvasViewport projectId={projectId} actor={actor} />
      <CommandBar projectId={projectId} actor={actor} />
      <Toolbar actor={actor} onIdentity={onIdentity} />
      {outdated && (
        <button className="follow-banner update-banner" onClick={() => location.reload()}>
          isocan updated — reload to catch up
        </button>
      )}
      {followedLabel && (
        <button className="follow-banner" onClick={() => useUiStore.getState().setFollow(null)}>
          Watching {followedLabel} — Esc to stop
        </button>
      )}
      <Shelf projectId={projectId} actor={actor} onZoomToFit={zoomToFit} />
      <Minimap />
      <TrashPanel projectId={projectId} actor={actor} />
      <MainThreadPanel projectId={projectId} actor={actor} />
      <CommentToasts />
    </div>
  );
}
