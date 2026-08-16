import { useCallback, useEffect, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import type { Actor } from "@isocan/core";
import {
  connectToProject,
  disconnect,
  publishSelection,
  useCanvasStore,
} from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { redo, sendOp, undo } from "../lib/api.ts";
import { fitBounds, itemsBounds } from "../lib/viewport.ts";
import { CanvasViewport } from "../components/CanvasViewport.tsx";
import { Toolbar } from "../components/Toolbar.tsx";
import { Shelf } from "../components/Shelf.tsx";
import { Minimap } from "../components/Minimap.tsx";
import { TrashPanel } from "../components/TrashPanel.tsx";
import { MainThreadPanel } from "../components/MainThreadPanel.tsx";
import { CommentToasts } from "../components/CommentToasts.tsx";
import { unreadThreads, useUnreadStore } from "../stores/unreadStore.ts";

export function CanvasPage({ actor }: { actor: Actor }) {
  const { projectId } = useParams<{ projectId: string }>();
  const canvas = useCanvasStore((s) => s.canvas);
  const connection = useCanvasStore((s) => s.connection);
  const seen = useUnreadStore((s) => s.seen);
  const didFit = useRef(false);

  useEffect(() => {
    if (!projectId) return;
    didFit.current = false;
    connectToProject(projectId, actor);
    return disconnect;
  }, [projectId, actor]);

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
        if (ui.pendingComment) ui.setPendingComment(null);
        else if (ui.openThreadId) ui.setOpenThread(null);
        else if (ui.commentMode) ui.setCommentMode(false);
        else if (ui.fannedItemId) ui.setFanned(null);
        else if (ui.enteredHtmlItemId) ui.setEnteredHtml(null);
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
      <Toolbar actor={actor} />
      <Shelf projectId={projectId} actor={actor} onZoomToFit={zoomToFit} />
      <Minimap />
      <TrashPanel projectId={projectId} actor={actor} />
      <MainThreadPanel projectId={projectId} actor={actor} />
      <CommentToasts />
    </div>
  );
}
