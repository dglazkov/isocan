import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Markdown } from "../lib/markdown.tsx";
import type { Actor, CanvasContents, CommentThread, NewComment } from "@isocan/core";
import {
  collectItemRefCandidates,
  extractItemRefs,
  extractMentions,
  newCommentId,
  newThreadId,
  workedFor, itemThread, atCorner, faceMark} from "@isocan/core";

import { sendEchoed, useCanvasStore } from "../stores/canvasStore.ts";
import { type PendingComment, useUiStore } from "../stores/uiStore.ts";
import { threadWorldPos, worldToScreen } from "../lib/viewport.ts";
import { actorColorIn, useActorColors } from "../lib/colors.ts";
import { mentionRoster, useMentionRoster } from "../lib/mentions.ts";
import { catapultToItem, useItemRefRoster } from "../lib/itemrefs.ts";
import { rehypeChips } from "../lib/chips.ts";
import { submitOnCmdEnter, submitOnEnter } from "../lib/submit.ts";
import { pastSlop } from "../lib/gesture.ts";
import { MentionField } from "./MentionField.tsx";
import { openMainPanel } from "./MainThreadPanel.tsx";
import { markRead, unreadCount, useUnreadStore } from "../stores/unreadStore.ts";
import { actorNameIn, useActorNames } from "../lib/names.ts";
import { CommandChip, awaitingReply, withoutCommand } from "./MainThreadPanel.tsx";
import { OnIt } from "./OnIt.tsx";
import { liveActorIds } from "../lib/presence.ts";
import { useActorMarks } from "../lib/marks.ts";

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
export function CommentLayer({ canvasId, actor }: { canvasId: string; actor: Actor }) {
  const canvas = useCanvasStore((s) => s.canvas);
  const viewport = useUiStore((s) => s.viewport);
  const marks = useActorMarks();
  const drag = useUiStore((s) => s.drag);
  const openThreadId = useUiStore((s) => s.openThreadId);
  const pendingComment = useUiStore((s) => s.pendingComment);
  const seen = useUnreadStore((s) => s.seen);
  const joined = useCanvasStore((s) => s.actorJoins);

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
            canvasId={canvasId}
            actor={actor}
            screen={screenOf(thread)}
            corner={atCorner(canvas, thread)}
            open={openThreadId === thread.id}
            unread={unreadCount(thread, seen, actor.id, joined)}
          />
        ))}
      </div>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 30 }}>
        {openThread && (
          <ThreadPopover
            thread={openThread}
            screen={screenOf(openThread)}
            canvasId={canvasId}
            actor={actor}
          />
        )}
        {pendingComment && (
          <ComposePopover canvasId={canvasId} actor={actor} pending={pendingComment} />
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

function ThreadPopover({
  thread,
  screen,
  canvasId,
  actor,
}: {
  thread: CommentThread;
  screen: { x: number; y: number };
  canvasId: string;
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
              <Markdown rehypePlugins={chips}>
                {withoutCommand(comment.body)}
              </Markdown>
            </div>
          </div>
        ))}
        <OnIt
                thread={thread}
                waiting={awaitingReply(thread, actor.id)}
                canvasId={canvasId}
                actor={actor}
              />
      </div>
      <form
        /**
         * The same two keys the Chat takes, because these are the same
         * gesture in two places. Reported as "I hit ENTER expecting to get a
         * newline": this field was a bare `<input>` while every other
         * composer in the app grows, so a reply could not hold a second line
         * at all and Enter had nowhere to go but submit.
         */
        onKeyDown={(e) => {
          submitOnEnter(e);
          submitOnCmdEnter(e);
        }}
        onSubmit={async (e) => {
          e.preventDefault();
          const body = reply.trim();
          if (!body) return;
          setReply("");
          await sendEchoed(canvasId, actor, {
            type: "thread.reply",
            threadId: thread.id,
            comment: makeComment(body),
          });
        }}
      >
        <MentionField
          placeholder="Reply…"
          // Grows, like the Chat's. An `<input>` cannot hold a newline, so
          // Shift+Enter had nothing to make and the field could never show
          // more than one line of what somebody wrote.
          grow
          value={reply}
          onChange={setReply}
          candidates={candidates}
          peers={peers}
          itemCandidates={itemRoster.candidates}
          items={itemRoster.entries}
        />
        {/* `primary`, like the Chat's send and like this thread's own opening
            comment two hundred lines below — the odd one out was HERE.
            `.btn:disabled` is a 45% opacity, so a plain grey button reads
            almost the same enabled as disabled: the send that was ready to
            go looked like the one that was not, and people stopped believing
            they could press it. The accent makes the two states different
            colours rather than two shades of the same one. */}
        <button className="btn primary" type="submit" title="Reply (⌘⏎)" disabled={!reply.trim()}>
          ↑
        </button>
      </form>
      <div className="thread-actions">
        <button
          className="promote"
          title="This conversation becomes the canvas's Chat: docked on the left, heard by every agent without an @-mention. A canvas has one Chat, so whichever conversation holds it now becomes a pin on the canvas instead — nothing is deleted."
          onClick={async () => {
            useUiStore.getState().setOpenThread(null);
            openMainPanel(canvasId, true);
            await sendEchoed(canvasId, actor, { type: "thread.setMain", threadId: thread.id });
          }}
        >
          Make this the Chat
        </button>
        <button
          onClick={async () => {
            useUiStore.getState().setOpenThread(null);
            await sendEchoed(canvasId, actor, { type: "thread.delete", threadId: thread.id });
          }}
        >
          Delete comment
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
  canvasId,
  actor,
  pending,
}: {
  canvasId: string;
  actor: Actor;
  pending: PendingComment;
}) {
  const viewport = useUiStore((s) => s.viewport);
  const canvas = useCanvasStore((s) => s.canvas);
  const marks = useActorMarks();
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
          await sendEchoed(canvasId, actor, {
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

/** Re-exported so the surfaces that already import it from here keep
 * working — the RULE now lives in core, where the CLI can read it too. */
export { itemThread };
