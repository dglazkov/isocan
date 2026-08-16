import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Actor, CommentThread, NewComment } from "@isocan/core";
import { extractMentions, newCommentId, newThreadId } from "@isocan/core";
import { sendOp } from "../lib/api.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { worldToScreen } from "../lib/viewport.ts";
import { actorColor } from "../lib/colors.ts";
import { mentionRoster, rehypeMentions, useMentionRoster } from "../lib/mentions.ts";
import { MentionField } from "./MentionField.tsx";

/** Comment payload with @Name mentions resolved against everyone visible on
 * the canvas — actors in the state plus the live presence roster (labels too).
 * Resolved at send time from the store, so the roster is never stale. */
function makeComment(body: string): NewComment {
  const { canvas, sessions } = useCanvasStore.getState();
  const mentions = extractMentions(body, mentionRoster(canvas, sessions).candidates);
  return { id: newCommentId(), body, ...(mentions.length > 0 ? { mentions } : {}) };
}

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
        const riding = drag?.itemIds.includes(item.id) ? drag : null;
        return {
          x: item.x + (riding?.dx ?? 0) + thread.x,
          y: item.y + (riding?.dy ?? 0) + thread.y,
        };
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

const GUTTER = 12; // breathing room from the window edges
const TOOLBAR_H = 48; // popovers must clear the toolbar

/**
 * Screen placement for a popover hanging off a pin: capped to a height that
 * fits between the toolbar and the bottom gutter (long threads scroll inside),
 * flipped to the pin's other side when it would run off the right edge, and
 * clamped so it never leaves the window.
 */
function usePopoverPlacement(anchor: { x: number; y: number }, dx: number, dy: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 240, height: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSize({ width: el.offsetWidth, height: el.offsetHeight });
    measure();
    // The element resizes as the thread grows; the window resize re-clamps it.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const top = TOOLBAR_H + GUTTER;
  const maxHeight = Math.max(120, window.innerHeight - top - GUTTER);
  const rightLimit = window.innerWidth - GUTTER - size.width;
  const flipped = anchor.x + dx > rightLimit;

  return {
    ref,
    style: {
      left: Math.max(GUTTER, Math.min(flipped ? anchor.x - dx - size.width : anchor.x + dx, rightLimit)),
      top: Math.max(top, Math.min(anchor.y + dy, window.innerHeight - GUTTER - size.height)),
      maxHeight,
      pointerEvents: "auto",
    } satisfies CSSProperties,
  };
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
  // Distinct authors in comment order; up to three initials, then a +N chip.
  const authors: Actor[] = [];
  for (const comment of thread.comments) {
    if (!authors.some((author) => author.id === comment.author.id)) {
      authors.push(comment.author);
    }
  }
  const shown = authors.length > 3 ? authors.slice(0, 2) : authors;
  const overflow = authors.length - shown.length;

  return (
    <button
      className="pin"
      style={{ left: screen.x, top: screen.y, pointerEvents: "auto" }}
      title={`${authors.map((author) => author.name).join(", ")} — ${first.body.slice(0, 60)}`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={() => useUiStore.getState().setOpenThread(open ? null : thread.id)}
    >
      {shown.map((author) => (
        <span className="pin-avatar" key={author.id} style={{ background: actorColor(author.id) }}>
          {author.name.charAt(0).toUpperCase()}
        </span>
      ))}
      {overflow > 0 && <span className="pin-avatar pin-more">+{overflow}</span>}
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
  const { candidates, peers } = useMentionRoster(actor.id);
  const chips = useMemo(() => [rehypeMentions(candidates, actor.id)], [candidates, actor.id]);
  const { ref, style } = usePopoverPlacement(screen, 30, -16);
  return (
    <div
      ref={ref}
      className="thread-popover"
      style={style}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="thread-comments">
        {thread.comments.map((comment) => (
          <div className="comment" key={comment.id}>
            <span className="who">{comment.author.name}</span>
            <span className="when">{new Date(comment.createdAt).toLocaleString()}</span>
            <div className="body">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={chips}>
                {comment.body}
              </ReactMarkdown>
            </div>
          </div>
        ))}
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const body = reply.trim();
          if (!body) return;
          setReply("");
          await sendOp(projectId, actor, {
            type: "thread.reply",
            threadId: thread.id,
            comment: makeComment(body),
          });
        }}
      >
        <MentionField
          placeholder="Reply…"
          value={reply}
          onChange={setReply}
          candidates={candidates}
          peers={peers}
        />
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
  const { candidates, peers } = useMentionRoster(actor.id);
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
  const { ref, style } = usePopoverPlacement(screen, 0, 0);

  return (
    <div
      ref={ref}
      className="thread-popover compose-popover"
      style={style}
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
            comment: makeComment(trimmed),
          });
        }}
        style={{ display: "block" }}
      >
        <MentionField
          multiline
          autoFocus
          placeholder={pending.anchorItemId ? "Comment on this item…" : "Comment here…"}
          value={body}
          onChange={setBody}
          candidates={candidates}
          peers={peers}
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
