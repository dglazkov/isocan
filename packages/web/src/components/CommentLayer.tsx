import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Actor, CommentThread, NewComment } from "@isocan/core";
import {
  collectItemRefCandidates,
  extractItemRefs,
  extractMentions,
  newCommentId,
  newThreadId,
  workedFor,
} from "@isocan/core";
import { sendOp } from "../lib/api.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { type PendingComment, useUiStore } from "../stores/uiStore.ts";
import { threadWorldPos, worldToScreen } from "../lib/viewport.ts";
import { actorColorIn, useActorColors } from "../lib/colors.ts";
import { mentionRoster, useMentionRoster } from "../lib/mentions.ts";
import { catapultToItem, useItemRefRoster } from "../lib/itemrefs.ts";
import { rehypeChips } from "../lib/chips.ts";
import { submitOnCmdEnter } from "../lib/submit.ts";
import { MentionField } from "./MentionField.tsx";
import { openMainPanel } from "./MainThreadPanel.tsx";
import { markRead, unreadCount, useUnreadStore } from "../stores/unreadStore.ts";
import { actorNameIn, useActorNames } from "../lib/names.ts";
import { CommandChip, awaitingReply, withoutCommand } from "./MainThreadPanel.tsx";
import { OnIt } from "./OnIt.tsx";

/** Comment payload with @Name mentions and #Title item references resolved
 * against what's visible on the canvas — actors in the state plus the live
 * presence roster (labels too), and the live items. Resolved at send time
 * from the store, so the rosters are never stale. */
export function makeComment(body: string): NewComment {
  const { canvas, sessions } = useCanvasStore.getState();
  const { actorNames } = useCanvasStore.getState();
  const mentions = extractMentions(body, mentionRoster(canvas, sessions, undefined, actorNames).candidates);
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
export function CommentLayer({ projectId, actor }: { projectId: string; actor: Actor }) {
  const canvas = useCanvasStore((s) => s.canvas);
  const viewport = useUiStore((s) => s.viewport);
  const drag = useUiStore((s) => s.drag);
  const openThreadId = useUiStore((s) => s.openThreadId);
  const pendingComment = useUiStore((s) => s.pendingComment);
  const seen = useUnreadStore((s) => s.seen);

  if (!canvas) return null;

  function pinWorldPos(thread: CommentThread): { x: number; y: number } {
    const world = threadWorldPos(canvas!, thread);
    // While a drag is live the item has not moved in the replica yet, so the
    // pin rides the gesture's delta to stay glued to it.
    const riding =
      thread.anchorItemId && drag?.itemIds.includes(thread.anchorItemId) ? drag : null;
    return { x: world.x + (riding?.dx ?? 0), y: world.y + (riding?.dy ?? 0) };
  }

  // The main thread has no pin — it lives in the docked panel instead.
  const threads = Object.values(canvas.threads).filter((thread) => !thread.main);
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
            screen={screenOf(thread)}
            open={openThreadId === thread.id}
            unread={unreadCount(thread, seen, actor.id)}
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
  unread,
}: {
  thread: CommentThread;
  screen: { x: number; y: number };
  open: boolean;
  unread: number;
}) {
  const colors = useActorColors();
  const names = useActorNames();
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

  return (
    <button
      className={`pin${unread > 0 ? " unread" : ""}`}
      style={{ left: screen.x, top: screen.y, pointerEvents: "auto" }}
      title={
        unread > 0
          ? `${unread} new from ${actorNameIn(names, newest.author)} — ${newest.body.slice(0, 60)}`
          : `${authors.map((author) => actorNameIn(names, author)).join(", ")} — ${first.body.slice(0, 60)}`
      }
      onPointerDown={(e) => e.stopPropagation()}
      onClick={() => useUiStore.getState().setOpenThread(open ? null : thread.id)}
    >
      {shown.map((author) => (
        <span className="pin-avatar" key={author.id} style={{ background: actorColorIn(colors, author.id) }}>
          {actorNameIn(names, author).charAt(0).toUpperCase()}
        </span>
      ))}
      {overflow > 0 && <span className="pin-avatar pin-more">+{overflow}</span>}
      {unread > 0 && <span className="pin-unread">{unread}</span>}
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
  // The registry names people, not the comment: see lib/names.ts.
  const names = useActorNames();
  const { candidates, peers } = useMentionRoster(actor.id);
  const itemRoster = useItemRefRoster();
  const chips = useMemo(
    () => [rehypeChips(candidates, actor.id, itemRoster.candidates)],
    [candidates, actor.id, itemRoster.candidates],
  );
  const { ref, style } = usePopoverPlacement(screen, 30, -16);
  // Open is read — including replies that land while you are looking at it.
  useEffect(() => markRead(thread.id), [thread.id, thread.comments.length]);
  // Item chips come out of rehype as plain elements, so their clicks are
  // delegated: any [data-item-id] under the comment list catapults.
  function chipTarget(e: { target: EventTarget }): string | null {
    return (e.target as HTMLElement).closest("[data-item-id]")?.getAttribute("data-item-id") ?? null;
  }
  return (
    <div
      ref={ref}
      className="thread-popover"
      style={style}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        className="thread-comments"
        onClick={(e) => {
          const itemId = chipTarget(e);
          if (itemId) catapultToItem(itemId);
        }}
        onKeyDown={(e) => {
          const itemId = e.key === "Enter" ? chipTarget(e) : null;
          if (itemId) catapultToItem(itemId);
        }}
      >
        {thread.comments.map((comment) => (
          <div className="comment" key={comment.id}>
            <span className="who">{actorNameIn(names, comment.author)}</span>
            <span className="when">{new Date(comment.createdAt).toLocaleString()}</span>
            {workedFor(comment) && (
              <span className="worked" title={`Posted, then rewritten ${workedFor(comment)} later`}>
                edited · {workedFor(comment)}
              </span>
            )}
            <div className="body">
              <CommandChip body={comment.body} />
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={chips}>
                {withoutCommand(comment.body)}
              </ReactMarkdown>
            </div>
          </div>
        ))}
        <OnIt
                thread={thread}
                waiting={awaitingReply(thread, actor.id)}
                projectId={projectId}
                actor={actor}
              />
      </div>
      <form
        onKeyDown={submitOnCmdEnter}
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
          itemCandidates={itemRoster.candidates}
          items={itemRoster.entries}
        />
        <button className="btn" type="submit" title="Reply (⌘⏎)" disabled={!reply.trim()}>
          ↑
        </button>
      </form>
      <div className="thread-actions">
        <button
          className="promote"
          title="Dock this thread as the canvas's main thread — agents always wake on it"
          onClick={async () => {
            useUiStore.getState().setOpenThread(null);
            openMainPanel(projectId, true);
            await sendOp(projectId, actor, { type: "thread.setMain", threadId: thread.id });
          }}
        >
          Make main
        </button>
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

/** Carry the annotation into the comment's item references, so whoever picks
 * this up can find the ink that prompted it without reading coordinates. */
function withAbout(comment: NewComment, aboutItemId?: string): NewComment {
  if (!aboutItemId) return comment;
  const items = [...new Set([...(comment.items ?? []), aboutItemId])];
  return { ...comment, items };
}

function ComposePopover({
  projectId,
  actor,
  pending,
}: {
  projectId: string;
  actor: Actor;
  pending: PendingComment;
}) {
  const viewport = useUiStore((s) => s.viewport);
  const canvas = useCanvasStore((s) => s.canvas);
  const { candidates, peers } = useMentionRoster(actor.id);
  const itemRoster = useItemRefRoster();
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
        onKeyDown={submitOnCmdEnter}
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
            comment: withAbout(makeComment(trimmed), pending.aboutItemId),
          });
        }}
        style={{ display: "block" }}
      >
        <MentionField
          multiline
          autoFocus
          placeholder={
            pending.aboutItemId
              ? "What should happen here?"
              : pending.anchorItemId
                ? "Comment on this item…"
                : "Comment here…"
          }
          value={body}
          onChange={setBody}
          candidates={candidates}
          peers={peers}
          itemCandidates={itemRoster.candidates}
          items={itemRoster.entries}
        />
        <div className="row">
          <button
            type="button"
            className="btn"
            onClick={() => useUiStore.getState().setPendingComment(null)}
          >
            Cancel
          </button>
          <button className="btn primary" type="submit" title="Comment (⌘⏎)" disabled={!body.trim()}>
            Comment
          </button>
        </div>
      </form>
    </div>
  );
}
