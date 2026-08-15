import { useState } from "react";
import type { Actor, CommentThread } from "@isocan/core";
import { newCommentId, newThreadId } from "@isocan/core";
import { sendOp } from "../lib/api.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { worldToScreen } from "../lib/viewport.ts";

/**
 * Pins and popovers render in SCREEN space (constant size at any zoom),
 * positioned from world coordinates via the viewport transform. Anchored
 * threads store an offset from their item's origin, so pins follow drags.
 */
export function CommentLayer({ projectId, actor }: { projectId: string; actor: Actor }) {
  const canvas = useCanvasStore((s) => s.canvas);
  const viewport = useUiStore((s) => s.viewport);
  const drag = useUiStore((s) => s.drag);
  const openThreadId = useUiStore((s) => s.openThreadId);
  const pendingComment = useUiStore((s) => s.pendingComment);

  if (!canvas) return null;

  function pinWorldPos(thread: CommentThread): { x: number; y: number } {
    if (thread.anchorItemId) {
      const item = canvas!.items[thread.anchorItemId];
      if (item) {
        const ix = drag?.itemId === item.id ? drag.x : item.x;
        const iy = drag?.itemId === item.id ? drag.y : item.y;
        return { x: ix + thread.x, y: iy + thread.y };
      }
    }
    return { x: thread.x, y: thread.y };
  }

  const threads = Object.values(canvas.threads);
  const screenOf = (thread: CommentThread) => {
    const world = pinWorldPos(thread);
    return worldToScreen(viewport, world.x, world.y);
  };
  const openThread = openThreadId ? canvas.threads[openThreadId] : undefined;

  // Two layers: pins sit under panels (z 8); popovers sit above them (z 30).
  // One layer would trap the popover in the pins' stacking context.
  return (
    <>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 8 }}>
        {threads.map((thread) => (
          <ThreadPin
            key={thread.id}
            thread={thread}
            screen={screenOf(thread)}
            open={openThreadId === thread.id}
          />
        ))}
      </div>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 30 }}>
        {openThread && (
          <ThreadPopover
            thread={openThread}
            screen={screenOf(openThread)}
            projectId={projectId}
            actor={actor}
          />
        )}
        {pendingComment && (
          <ComposePopover projectId={projectId} actor={actor} pending={pendingComment} />
        )}
      </div>
    </>
  );
}

function ThreadPin({
  thread,
  screen,
  open,
}: {
  thread: CommentThread;
  screen: { x: number; y: number };
  open: boolean;
}) {
  const first = thread.comments[0]!;
  return (
    <button
      className="pin"
      style={{ left: screen.x, top: screen.y, pointerEvents: "auto" }}
      title={`${first.author.name}: ${first.body.slice(0, 60)}`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={() => useUiStore.getState().setOpenThread(open ? null : thread.id)}
    >
      {first.author.name.charAt(0).toUpperCase()}
    </button>
  );
}

function ThreadPopover({
  thread,
  screen,
  projectId,
  actor,
}: {
  thread: CommentThread;
  screen: { x: number; y: number };
  projectId: string;
  actor: Actor;
}) {
  const [reply, setReply] = useState("");
  return (
    <div
      className="thread-popover"
      style={{ left: screen.x + 30, top: screen.y - 16, pointerEvents: "auto" }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {thread.comments.map((comment) => (
        <div className="comment" key={comment.id}>
          <span className="who">{comment.author.name}</span>
          <span className="when">{new Date(comment.createdAt).toLocaleString()}</span>
          <p className="body">{comment.body}</p>
        </div>
      ))}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const body = reply.trim();
          if (!body) return;
          setReply("");
          await sendOp(projectId, actor, {
            type: "thread.reply",
            threadId: thread.id,
            comment: { id: newCommentId(), body },
          });
        }}
      >
        <input placeholder="Reply…" value={reply} onChange={(e) => setReply(e.target.value)} />
        <button className="btn" type="submit" disabled={!reply.trim()}>
          ↑
        </button>
      </form>
      <div className="thread-actions">
        <button
          onClick={async () => {
            useUiStore.getState().setOpenThread(null);
            await sendOp(projectId, actor, { type: "thread.delete", threadId: thread.id });
          }}
        >
          Delete thread
        </button>
      </div>
    </div>
  );
}

function ComposePopover({
  projectId,
  actor,
  pending,
}: {
  projectId: string;
  actor: Actor;
  pending: { x: number; y: number; anchorItemId: string | null };
}) {
  const viewport = useUiStore((s) => s.viewport);
  const canvas = useCanvasStore((s) => s.canvas);
  const [body, setBody] = useState("");

  // Pending world position: anchored offsets resolve against the item.
  let wx = pending.x;
  let wy = pending.y;
  if (pending.anchorItemId && canvas?.items[pending.anchorItemId]) {
    const item = canvas.items[pending.anchorItemId]!;
    wx = item.x + pending.x;
    wy = item.y + pending.y;
  }
  const screen = worldToScreen(viewport, wx, wy);

  return (
    <div
      className="thread-popover compose-popover"
      style={{ left: screen.x, top: screen.y, pointerEvents: "auto" }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const trimmed = body.trim();
          if (!trimmed) return;
          useUiStore.getState().setPendingComment(null);
          await sendOp(projectId, actor, {
            type: "thread.create",
            threadId: newThreadId(),
            x: pending.x,
            y: pending.y,
            anchorItemId: pending.anchorItemId,
            comment: { id: newCommentId(), body: trimmed },
          });
        }}
        style={{ display: "block" }}
      >
        <textarea
          autoFocus
          placeholder={
            pending.anchorItemId ? "Comment on this item…" : "Comment here…"
          }
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="row">
          <button
            type="button"
            className="btn"
            onClick={() => useUiStore.getState().setPendingComment(null)}
          >
            Cancel
          </button>
          <button className="btn primary" type="submit" disabled={!body.trim()}>
            Comment
          </button>
        </div>
      </form>
    </div>
  );
}
