import "./comment-popovers.css";
import { useTextAnchorStore } from "../stores/textAnchorStore.ts";
import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Markdown } from "../lib/markdown.tsx";
const DesignComment = lazy(() => import("./DesignComment.tsx").then((module) => ({ default: module.DesignComment })));
const DesignComparisonComment = lazy(() => import("./DesignComparisonComment.tsx").then((module) => ({ default: module.DesignComparisonComment })));
import type { Actor, CommentThread, NewComment } from "@isocan/core";
import { newThreadId, workedFor, shortcut } from "@isocan/core";

import { sendEchoed, sendEchoedResult, useCanvasStore } from "../stores/canvasStore.ts";
import { type PendingComment, useUiStore } from "../stores/uiStore.ts";
import { worldToScreen } from "../lib/viewport.ts";
import { useMentionRoster } from "../lib/mentions.ts";
import { catapultToItem, useItemRefRoster } from "../lib/itemrefs.ts";
import { rehypeChips } from "../lib/chips.ts";
import { submitOnCmdEnter, submitOnEnter } from "../lib/submit.ts";
import { useCanEdit } from "../lib/capability.ts";
import { MentionField } from "./MentionField.tsx";
import { openMainPanel } from "./MainThreadPanel.tsx";
import { markRead } from "../stores/unreadStore.ts";
import { actorNameIn, useActorNames } from "../lib/names.ts";
import { CommandChip, awaitingReply, withoutCommand } from "./MainThreadPanel.tsx";
import { OnIt } from "./OnIt.tsx";
import { GateGrant } from "./LazyGate.tsx";
import { modules as shellModules } from "../modules.ts";
import { CommentFold, CommentWhen } from "./CommentWhen.tsx";
import { messageContextRoots, useMessageContext, useMessageSend, withMessageContext } from "../lib/messagecontext.ts";
import { ContextManifestView, MessageContextPreview } from "./LazyGroupContext.tsx";
import { usePresentation } from "../lib/canvasPresentation.ts";
import { presentedOffset } from "../lib/presentation.ts";
import { makeComment } from "./CommentLayer.tsx";

/**
 * **A pin's open thread and a new comment's composer, loaded when the first
 * one opens** (14 Oct 2026).
 *
 * Both draw only after a click or ⇧C — a pin opened, a place picked — and
 * until they moved here they were in every first visit's bytes with the pins
 * that open them. `CommentLayer` draws the pins and mounts these through
 * `lazy()`, and starts fetching this chunk once the canvas has painted, so
 * the first ⇧C finds it already here and its first keystrokes land.
 */
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

export function ThreadPopover({
  thread,
  embedded = false,
  onOpenItem,
  screen,
  canvasId,
  actor,
}: {
  thread: CommentThread;
  embedded?: boolean;
  onOpenItem?: (id: string) => void;
  screen: { x: number; y: number };
  canvasId: string;
  actor: Actor;
}) {
  const [reply, setReply] = useState("");
  const canvas = useCanvasStore((state) => state.canvas);
  const context = useMessageContext(canvasId, messageContextRoots(canvas, reply, thread.anchorItemId ? [thread.anchorItemId] : []));
  const sending = useMessageSend(canvasId, context, reply);
  const textView = useTextAnchorStore(s => s.views[thread.id]);
  // The registry names people, not the comment: see lib/names.ts.
  const names = useActorNames();
  const { candidates, peers } = useMentionRoster(actor.id);
  const itemRoster = useItemRefRoster();
  const chips = useMemo(
    () => [rehypeChips(candidates, actor.id, itemRoster.candidates)],
    [candidates, actor.id, itemRoster.candidates],
  );
  const { ref, style } = usePopoverPlacement(screen, 30, -16);
  const canEdit = useCanEdit();
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
      style={embedded ? undefined : style}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        className="thread-comments"
        onClick={(e) => {
          const itemId = chipTarget(e);
          if (itemId) (onOpenItem ?? catapultToItem)(itemId);
        }}
        onKeyDown={(e) => {
          const itemId = e.key === "Enter" ? chipTarget(e) : null;
          if (itemId) (onOpenItem ?? catapultToItem)(itemId);
        }}
      >
        {thread.textAnchor && <div className="thread-text-anchor">
          <blockquote>{thread.textAnchor.quote}</blockquote>
          <small>{textView?.resolution.status === "resolved" ? "On this passage" : textView?.resolution.status === "ambiguous" ? "This passage appears more than once — re-anchor to choose" : textView?.resolution.status === "missing" ? "This passage is no longer in the current version" : "Original passage — open the document to locate it"} · said of {thread.textAnchor.versionId}</small>
        </div>}
        {thread.comments.map((comment) => (
          <div className="comment" key={comment.id}>
            <span className="who">{actorNameIn(names, comment.author)}</span>
            <CommentWhen comment={comment} />
            {workedFor(comment) && (
              <span className="worked" title={`Posted, then rewritten ${workedFor(comment)} later`}>
                edited · {workedFor(comment)}
              </span>
            )}
            <CommentFold comment={comment}>
              <div className="body">
                {comment.designDecision ? <Suspense fallback={<p>Reading design decision…</p>}><DesignComparisonComment comment={comment} canvasId={canvasId} actor={actor} threadId={thread!.id} /></Suspense> : comment.design ? <Suspense fallback={<p>Reading design record…</p>}><DesignComment comment={comment} /></Suspense> : <><CommandChip body={comment.body} /><Markdown rehypePlugins={chips}>{withoutCommand(comment.body)}</Markdown></>}
              </div>
              {comment.context && <ContextManifestView manifest={comment.context} comment={{ threadId: thread.id, commentId: comment.id }} />}
            </CommentFold>
            {/* The refusal is the control (#272): under the ask an agent's
                gate turned away, the owner — and nobody else — gets the two
                buttons that answer it. Mounted only for a comment that names
                somebody: it subscribes to the rc poll, and a long thread of
                plain messages should not open one subscription per line. */}
            {comment.mentions && comment.mentions.length > 0 && (
              <GateGrant canvasId={canvasId} viewer={actor} thread={thread} comment={comment} />
            )}
            {/* A loaded module's buttons under this comment (`WebModule.comments`): each opens its dialog. The thread
                closes first — it sits above every dialog. Outside the reply form, so a bare button submits
                nothing; only a row's label and run are read. */}
            {canEdit && canvas && shellModules().flatMap((m) => m.comments?.({ canvas, thread, comment, open: (id, args) => { useUiStore.getState().setOpenThread(null); useUiStore.getState().openModuleDialog(id, args); } }) ?? []).map((row, i) => "run" in row && <button key={i} className="btn" onClick={row.run}>{row.label}</button>)}
          </div>
        ))}
        <OnIt
                thread={thread}
                waiting={awaitingReply(thread, actor.id)}
                canvasId={canvasId}
                actor={actor}
              />
      </div>
      {canEdit && (
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
          await sending.submit(() => sendEchoedResult(canvasId, actor, {
            type: "thread.reply",
            threadId: thread.id,
            comment: withMessageContext(makeComment(body), context.request),
          }), () => setReply(""));
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
        <MessageContextPreview context={context} />
        {sending.error && <p role="alert">{sending.error}</p>}
        <button className="btn primary" type="submit" title={`Reply (${shortcut("⏎")})`} disabled={!reply.trim() || sending.disabled}>
          ↑
        </button>
      </form>
      )}
      {canEdit && !embedded && <div className="thread-actions">
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
      </div>}
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

export function ComposePopover({
  canvasId,
  actor,
  pending,
  embedded = false,
  onSent,
}: {
  canvasId: string;
  actor: Actor;
  pending: PendingComment;
  embedded?: boolean;
  onSent?: () => void;
}) {
  const viewport = useUiStore((s) => s.viewport);
  const canvas = useCanvasStore((s) => s.past?.canvas ?? s.canvas);
  const { candidates, peers } = useMentionRoster(actor.id);
  const itemRoster = useItemRefRoster();
  const [body, setBody] = useState("");
  const context = useMessageContext(canvasId, messageContextRoots(canvas, body, [pending.aboutItemId, pending.anchorItemId].filter((id): id is string => Boolean(id))));
  const sending = useMessageSend(canvasId, context, body);
  const presentation = usePresentation();

  // Pending world position: anchored offsets resolve against the item.
  let wx = pending.x;
  let wy = pending.y;
  if (pending.anchorItemId && canvas?.items[pending.anchorItemId]) {
    const item = canvas.items[pending.anchorItemId]!;
    const point = presentedOffset(item, presentation, pending);
    wx = point.x;
    wy = point.y;
  }
  const screen = worldToScreen(viewport, wx, wy);
  const { ref, style } = usePopoverPlacement(screen, 0, 0);

  return (
    <div
      ref={ref}
      className="thread-popover compose-popover"
      style={embedded ? undefined : style}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <form
        onKeyDown={submitOnCmdEnter}
        onSubmit={async (e) => {
          e.preventDefault();
          const trimmed = body.trim();
          if (!trimmed) return;
          await sending.submit(() => sendEchoedResult(canvasId, actor, {
            type: "thread.create",
            threadId: newThreadId(),
            x: pending.x,
            y: pending.y,
            anchorItemId: pending.anchorItemId,
            ...(pending.textAnchor ? { textAnchor: pending.textAnchor } : {}),
            comment: withMessageContext(withAbout(makeComment(trimmed), pending.aboutItemId), context.request),
          }), () => { onSent?.(); if (useUiStore.getState().pendingComment === pending) useUiStore.getState().setPendingComment(null); });
        }}
        style={{ display: "block" }}
      >
        {pending.textAnchor && <blockquote className="thread-text-anchor">{pending.textAnchor.quote}</blockquote>}
        <MessageContextPreview context={context} />
        {sending.error && <p role="alert">{sending.error}</p>}
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
          <button className="btn primary" type="submit" title={`Comment (${shortcut("⏎")})`} disabled={!body.trim() || sending.disabled}>
            Comment
          </button>
        </div>
      </form>
    </div>
  );
}
