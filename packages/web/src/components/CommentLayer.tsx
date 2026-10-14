import { createPortal } from "react-dom";
import { useTextAnchorStore } from "../stores/textAnchorStore.ts";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { Actor, CommentThread, NewComment } from "@isocan/core";
import {
  collectItemRefCandidates,
  extractItemRefs,
  extractMentions,
  newCommentId,
  itemThread, atCorner, faceMark } from "@isocan/core";

import { sendEchoed, useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { threadWorldPos, worldToScreen } from "../lib/viewport.ts";
import { actorColorIn, useActorColors } from "../lib/colors.ts";
import { mentionRoster } from "../lib/mentions.ts";
import { pastSlop } from "../lib/gesture.ts";
import { useCanEdit } from "../lib/capability.ts";
import { unreadCount, useUnreadStore } from "../stores/unreadStore.ts";
import { actorNameIn, useActorNames } from "../lib/names.ts";
import { liveActorIds } from "../lib/presence.ts";
import { useActorMarks } from "../lib/marks.ts";
/**
 * **The open thread and the composer arrive with the first one opened**
 * (14 Oct 2026) — `CommentPopovers.tsx` says why. Fetched once the canvas
 * has painted (the effect in `CommentLayer`), never before it.
 */
const popovers = () => import("./CommentPopovers.tsx");
const ThreadPopover = lazy(() => popovers().then((m) => ({ default: m.ThreadPopover })));
const ComposePopover = lazy(() => popovers().then((m) => ({ default: m.ComposePopover })));

/** Comment payload with @Name mentions and #Title item references resolved
 * against what's visible on the canvas — actors in the state plus the live
 * presence roster (labels too), and the live items. Resolved at send time
 * from the store, so the rosters are never stale. */
export function makeComment(body: string): NewComment {
  const { canvas, sessions } = useCanvasStore.getState();
  const { actorNames, actorJoins } = useCanvasStore.getState();
  const mentions = extractMentions(
    body,
    mentionRoster(canvas, sessions, undefined, actorNames, actorJoins).candidates,
  );
  const items = canvas ? extractItemRefs(body, collectItemRefCandidates(canvas)) : [];
  return {
    id: newCommentId(),
    body,
    ...(mentions.length > 0 ? { mentions } : {}),
    ...(items.length > 0 ? { items } : {}),
  };
}

/**
 * Pins and popovers render in SCREEN space (constant size at any zoom),
 * positioned from world coordinates via the viewport transform. Anchored
 * threads store an offset from their item's origin, so pins follow drags.
 */
import { usePresentation } from "../lib/canvasPresentation.ts";
import { presentedOffset, previewedCanvas } from "../lib/presentation.ts";

export function CommentLayer({ canvasId, actor }: { canvasId: string; actor: Actor }) {
  const canvas = useCanvasStore((s) => s.past?.canvas ?? s.canvas);
  const viewport = useUiStore((s) => s.viewport);
  const gesture = useUiStore((s) => s.drag ?? s.groupPreview);
  const openThreadId = useUiStore((s) => s.openThreadId);
  const pendingComment = useUiStore((s) => s.pendingComment);
  const presentation = usePresentation();
  const textViews = useTextAnchorStore(s => s.views);
  const seen = useUnreadStore((s) => s.seen);
  const joined = useCanvasStore((s) => s.actorJoins);
  // A reader cannot comment, by the decision the roles journey records:
  // comments reach agents, and a rung that can start work is not a viewer.
  const canEdit = useCanEdit();
  useEffect(() => {
    void popovers().catch(() => {});
  }, []);

  if (!canvas) return null;
  const shown = previewedCanvas(canvas, gesture);

  function pinWorldPos(thread: CommentThread): { x: number; y: number } {
    const view = textViews[thread.id];
    const positioned = thread.textAnchor && view?.x !== undefined && view.y !== undefined ? { ...thread, x: view.x, y: view.y } : thread;
    // While a gesture is live the item has not moved in the replica yet, so
    // the pin reads the anchor where the hand has it (`previewedCanvas`).
    const anchor = positioned.anchorItemId ? shown.items[positioned.anchorItemId] : undefined;
    return anchor ? presentedOffset(anchor, presentation, positioned) : threadWorldPos(canvas!, positioned);
  }

  // The main thread has no pin — it lives in the docked panel instead.
  const threads = Object.values(canvas.threads).filter((thread) => !thread.main && (!presentation?.isolate || (thread.anchorItemId && presentation.items[thread.anchorItemId])));
  const screenOf = (thread: CommentThread) => {
    const world = pinWorldPos(thread);
    return worldToScreen(viewport, world.x, world.y);
  };
  const openedThread = openThreadId ? canvas.threads[openThreadId] : undefined;
  const openThread = openedThread?.main ? undefined : openedThread;

  // Two layers: pins sit under panels (z 8); popovers sit above them (z 30).
  // One layer would trap the popover in the pins' stacking context.
  return (
    <>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 8 }}>
        {threads.map((thread) => (
          <ThreadPin
            key={thread.id}
            thread={thread}
            canvasId={canvasId}
            actor={actor}
            screen={screenOf(thread)}
            corner={atCorner(canvas, thread) && !(thread.textAnchor && textViews[thread.id]?.x !== undefined)}
            open={openThreadId === thread.id}
            unread={unreadCount(thread, seen, actor.id, joined)}
          />
        ))}
      </div>
      {createPortal(
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: "var(--z-popover)" }}>
        <Suspense fallback={null}>
        {openThread && (
          <ThreadPopover
            key={`${canvasId}:${openThread.id}`}
            thread={openThread}
            screen={screenOf(openThread)}
            canvasId={canvasId}
            actor={actor}
          />
        )}
        {pendingComment && canEdit && (
          <ComposePopover key={`${canvasId}:${pendingComment.anchorItemId}:${pendingComment.x}:${pendingComment.y}`} canvasId={canvasId} actor={actor} pending={pendingComment} />
        )}
        </Suspense>
      </div>
      , document.querySelector(".fullscreen") ?? document.body)}
    </>
  );
}


function ThreadPin({
  thread,
  canvasId,
  actor,
  screen,
  corner,
  open,
  unread,
}: {
  thread: CommentThread;
  canvasId: string;
  actor: Actor;
  screen: { x: number; y: number };
  /** At its item's top-right corner: step clear of it — see `atCorner`. */
  corner: boolean;
  open: boolean;
  unread: number;
}) {
  const colors = useActorColors();
  const names = useActorNames();
  const marks = useActorMarks();
  // A ring says somebody is here now. Without it a face on a pin looks the
  // same whether they are reading this or asleep, and "who can I ask" is the
  // question a pin is usually being looked at to answer.
  //
  // Subscribe to the sessions and build the Set OUTSIDE the selector: a
  // selector that constructs a value returns a new reference every call, so
  // the store looks changed on every render. That is an infinite loop, and it
  // does not fail loudly — it blanks the whole app.
  const sessions = useCanvasStore((s) => s.sessions);
  const live = liveActorIds(sessions);
  const first = thread.comments[0]!;
  // Distinct authors in comment order; up to three initials, then a +N chip.
  const authors: Actor[] = [];
  for (const comment of thread.comments) {
    if (!authors.some((author) => author.id === comment.author.id)) {
      authors.push(comment.author);
    }
  }
  const shown = authors.length > 3 ? authors.slice(0, 2) : authors;
  const overflow = authors.length - shown.length;
  const newest = thread.comments[thread.comments.length - 1]!;

  /**
   * **Dragging a pin that marks a PLACE.**
   *
   * A free pin is somebody pointing at a spot on the canvas, and a spot can
   * turn out to be the wrong one — so it moves, by the plain drag every other
   * object here answers to rather than behind a modifier. The modifier was
   * considered and declined: what it would prevent is four pixels of pointer
   * travel, `thread.setAnchor` carries a real inverse so ⌘Z already puts a
   * slip back, and a gesture you have to be told about is worse than a
   * mistake you can undo.
   *
   * **A pin anchored to an ITEM does not move at all**, and that is the point
   * of it: it sits at that item's corner because it is the conversation about
   * that item, ⇧C and `isocan comment add --item` both put it there, and a
   * fixed address is what lets ⇧C reopen it instead of minting another. It
   * already rides the item when the item is dragged, which is the only moving
   * it should do.
   */
  const movable = !thread.anchorItemId;
  const scale = useUiStore((s) => s.viewport.scale);
  const from = useRef<{ x: number; y: number } | null>(null);
  const dragged = useRef(false);
  const [nudge, setNudge] = useState<{ dx: number; dy: number } | null>(null);

  function onPointerDown(e: React.PointerEvent) {
    e.stopPropagation(); // the canvas below must not start a selection box
    if (!movable || e.button !== 0) return;
    from.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    const start = from.current;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (!dragged.current && !pastSlop(dx, dy)) return;
    dragged.current = true;
    setNudge({ dx, dy });
  }

  function onPointerUp(e: React.PointerEvent) {
    const start = from.current;
    from.current = null;
    setNudge(null);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (!start || !dragged.current) return;
    // Screen travel becomes world travel by the zoom — the pin is drawn in
    // screen space, but where it POINTS is a world fact and that is what the
    // op carries. `dragged` stays true until the click handler eats the click
    // this release is about to fire.
    const dx = (e.clientX - start.x) / scale;
    const dy = (e.clientY - start.y) / scale;
    void sendEchoed(canvasId, actor, {
      type: "thread.setAnchor",
      threadId: thread.id,
      anchorItemId: null,
      x: thread.x + dx,
      y: thread.y + dy,
    });
  }

  const said =
    unread > 0
      ? `${unread} new from ${actorNameIn(names, newest.author)} — ${newest.body.slice(0, 60)}`
      : `${authors.map((author) => actorNameIn(names, author)).join(", ")} — ${first.body.slice(0, 60)}`;

  return (
    <button
      className={`pin${corner ? " corner" : ""}${unread > 0 ? " unread" : ""}`}
      style={{
        left: screen.x + (nudge?.dx ?? 0),
        top: screen.y + (nudge?.dy ?? 0),
        pointerEvents: "auto",
      }}
      // Anchored pins say what they are instead of offering a move they will
      // refuse: this one belongs to its item and rides it.
      title={movable ? `${said} · drag to move` : `${said} · pinned to this item`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onClick={(e) => {
        // A press that travelled was a move, not a click on the thing — the
        // same bargain every draggable object here makes (`lib/gesture.ts`).
        if (dragged.current) {
          dragged.current = false;
          e.preventDefault();
          return;
        }
        useUiStore.getState().setOpenThread(open ? null : thread.id);
      }}
    >
      {shown.map((author) => (
        <span
          className={`pin-avatar${live.has(author.id) ? " live" : ""}`}
          key={author.id}
          style={{ background: actorColorIn(colors, author.id) }}
        >
          {faceMark(marks, author, actorNameIn(names, author))}
        </span>
      ))}
      {overflow > 0 && <span className="pin-avatar pin-more">+{overflow}</span>}
      {unread > 0 && <span className="pin-unread">{unread}</span>}
    </button>
  );
}

/** Re-exported so the surfaces that already import it from here keep
 * working — the RULE now lives in core, where the CLI can read it too. */
export { itemThread };
