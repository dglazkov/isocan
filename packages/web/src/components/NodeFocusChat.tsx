import "./focus.css";
import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { shortcut, workedFor, type Actor, type Item } from "@isocan/core";
import { Markdown } from "../lib/markdown.tsx";
import { sendEchoedResult, useCanvasStore } from "../stores/canvasStore.ts";
import { useFocusStore } from "../stores/focusStore.ts";
import { useCanEdit } from "../lib/capability.ts";
import { actorNameIn, useActorNames } from "../lib/names.ts";
import { useMentionRoster } from "../lib/mentions.ts";
import { useItemRefRoster, catapultToItem } from "../lib/itemrefs.ts";
import { rehypeChips } from "../lib/chips.ts";
import { submitOnCmdEnter, submitOnEnter } from "../lib/submit.ts";
import { markRead } from "../stores/unreadStore.ts";
import { MentionField } from "./MentionField.tsx";
import { ItemThumb } from "./ItemThumb.tsx";
import { CommentFold, CommentWhen } from "./CommentWhen.tsx";
import { CommandChip, awaitingReply, withoutCommand } from "./MainThreadPanel.tsx";
import { OnIt } from "./OnIt.tsx";
import { makeComment } from "./CommentLayer.tsx";
import {
  manifestNeedsDisclosure,
  messageContextRoots,
  needsContextManifestPreview,
  useMessageContext,
  useMessageSend,
} from "../lib/messagecontext.ts";
import { ContextManifestView, MessageContextPreview } from "./LazyGroupContext.tsx";
import {
  buildNodeAnchoredMessageOp,
  itemThreadsFor,
  parseSubtargetPrefix,
} from "../lib/nodechat.ts";
import { inspectNodeFocus } from "../lib/focusRegistry.ts";

const DesignComment = lazy(() =>
  import("./DesignComment.tsx").then((m) => ({ default: m.DesignComment })),
);
const DesignComparisonComment = lazy(() =>
  import("./DesignComparisonComment.tsx").then((m) => ({ default: m.DesignComparisonComment })),
);

/**
 * Node-Anchored Chat Drawer (`docs/projects/node-focus/design.md` §6).
 *
 * Mounted in Edit Focus (`workbenchItemPath`) and bound strictly to
 * `anchorItemId = item.id`:
 * - Lists threads where `thread.anchorItemId === item.id`.
 * - Sending the first message creates an anchored thread (`anchorItemId: item.id`),
 *   so the conversation stays attached to the node back on the canvas and wakes
 *   any parked agent (`isocan wait`).
 * - Carries any active `FocusSubtarget` (`wf-slot`, `ds-token`, `dom-element`,
 *   `image-region`) as a removable pill in the composer.
 */
export function NodeFocusChat({
  canvasId,
  item,
  actor,
}: {
  canvasId: string;
  item: Item;
  actor: Actor;
}) {
  const canvas = useCanvasStore((s) => s.canvas);
  const sessions = useCanvasStore((s) => s.sessions);
  const canEdit = useCanEdit();
  const names = useActorNames();
  const { candidates, peers } = useMentionRoster(actor.id);
  const itemRoster = useItemRefRoster();

  const subtarget = useFocusStore((s) => s.subtarget);
  const setSubtarget = useFocusStore((s) => s.setSubtarget);
  const setChatOpen = useFocusStore((s) => s.setChatOpen);
  const seedPrompt = useFocusStore((s) => s.seedPrompt);
  const consumeSeedPrompt = useFocusStore((s) => s.consumeSeedPrompt);
  const activeThreadId = useFocusStore((s) => s.activeThreadId);
  const setActiveThreadId = useFocusStore((s) => s.setActiveThreadId);

  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (seedPrompt !== null) {
      const consumed = consumeSeedPrompt();
      if (consumed) setDraft(consumed);
    }
  }, [seedPrompt, consumeSeedPrompt]);

  const threadsMap = canvas?.threads;
  const threads = useMemo(
    () => (threadsMap ? itemThreadsFor(useCanvasStore.getState().canvas, item.id) : []),
    [threadsMap, item.id],
  );
  const currentThread =
    activeThreadId === "new"
      ? null
      : (threads.find((t) => t.id === activeThreadId) ?? threads[0] ?? null);

  const currentThreadId = currentThread?.id ?? null;
  const currentThreadCount = currentThread?.comments.length ?? 0;

  useEffect(() => {
    if (currentThreadId) markRead(currentThreadId);
  }, [currentThreadId, currentThreadCount]);

  const workingSessions = useMemo(
    () =>
      sessions.filter(
        (s) =>
          s.actor.id !== actor.id &&
          s.activity &&
          "itemId" in s.activity &&
          s.activity.itemId === item.id,
      ),
    [sessions, actor.id, item.id],
  );

  const { agentPrompts } = useMemo(() => inspectNodeFocus(item), [item]);

  const chips = useMemo(
    () => [rehypeChips(candidates, actor.id, itemRoster.candidates)],
    [candidates, actor.id, itemRoster.candidates],
  );

  const selectionRoots = useMemo(() => [item.id], [item.id]);
  const contextRoots = useMemo(
    () => messageContextRoots(canvas, draft, selectionRoots),
    [canvas, draft, selectionRoots],
  );
  const context = useMessageContext(canvasId, contextRoots);
  const sending = useMessageSend(canvasId, context, draft);

  return (
    <aside className="node-focus-chat" aria-label={`Chat anchored to ${item.title}`}>
      <div className="node-focus-chat-header">
        <div className="node-focus-chat-title">
          <ItemThumb canvasId={canvasId} itemId={item.id} width={18} height={18} />
          <b title={item.title}>{item.title}</b>
          <span className="node-focus-chat-anchor-badge">Anchored</span>
        </div>
        <button
          type="button"
          className="wb-fold"
          aria-label="Hide node chat"
          title={`Hide node chat (${shortcut("J")})`}
          onClick={() => setChatOpen(false)}
        >
          ✕
        </button>
      </div>

      {threads.length > 0 && (
        <div className="node-focus-chat-thread-bar">
          <select
            className="node-focus-chat-thread-select"
            aria-label="Anchored thread"
            value={activeThreadId === "new" ? "new" : (currentThread?.id ?? "")}
            onChange={(e) => {
              const v = e.target.value;
              setActiveThreadId(v === "new" ? "new" : v || null);
            }}
          >
            {threads.map((t, idx) => {
              const preview = t.comments[0]?.body.replace(/^\[focus:[^\]]+\]\s*/i, "").slice(0, 42) ?? "Thread";
              return (
                <option key={t.id} value={t.id}>
                  {idx === 0 ? `Primary (${t.comments.length})` : `#${idx + 1} (${t.comments.length})`} — {preview}
                </option>
              );
            })}
            <option value="new">+ New thread on this item</option>
          </select>
        </div>
      )}

      {workingSessions.map((ws) => (
        <div key={ws.sessionId} className="node-focus-chat-working" role="status">
          <span className="work-dot" />
          <span>
            {ws.label ?? actorNameIn(names, ws.actor)} is working on this item…
          </span>
        </div>
      ))}

      <div
        className="node-focus-chat-messages"
        onClick={(e) => {
          const id = (e.target as HTMLElement)
            .closest("[data-item-id]")
            ?.getAttribute("data-item-id");
          if (id) catapultToItem(id);
        }}
      >
        {!currentThread ? (
          <p className="node-focus-chat-empty">
            Ask an agent or collaborator about <b>{item.title}</b>. Messages here are
            anchored to this node (`{item.id}`) so they stay attached on the canvas.
          </p>
        ) : (
          <>
            {currentThread.comments.map((comment) => {
              const { subtarget: commentSubtarget, rest } = parseSubtargetPrefix(comment.body);
              return (
                <div className="comment" key={comment.id}>
                  <span className="who">{actorNameIn(names, comment.author)}</span>
                  <CommentWhen comment={comment} />
                  {workedFor(comment) && (
                    <span
                      className="worked"
                      title={`Posted, then rewritten ${workedFor(comment)} later`}
                    >
                      edited · {workedFor(comment)}
                    </span>
                  )}
                  <CommentFold comment={comment}>
                    <div className="body">
                      {commentSubtarget && (
                        <div className="focus-subtarget-badge" title={`${commentSubtarget.kind}:${commentSubtarget.id}`}>
                          📍 {commentSubtarget.label}
                        </div>
                      )}
                      {comment.designDecision ? (
                        <Suspense fallback={<p>Reading design decision…</p>}>
                          <DesignComparisonComment
                            comment={comment}
                            canvasId={canvasId}
                            actor={actor}
                            threadId={currentThread.id}
                          />
                        </Suspense>
                      ) : comment.design ? (
                        <Suspense fallback={<p>Reading design record…</p>}>
                          <DesignComment comment={comment} />
                        </Suspense>
                      ) : (
                        <>
                          <CommandChip body={rest} />
                          <Markdown rehypePlugins={chips}>{withoutCommand(rest)}</Markdown>
                        </>
                      )}
                    </div>
                    {comment.context && manifestNeedsDisclosure(comment.context, selectionRoots) && (
                      <ContextManifestView
                        manifest={comment.context}
                        comment={{ threadId: currentThread.id, commentId: comment.id }}
                      />
                    )}
                  </CommentFold>
                </div>
              );
            })}
            <OnIt
              thread={currentThread}
              waiting={awaitingReply(currentThread, actor.id)}
              canvasId={canvasId}
              actor={actor}
            />
          </>
        )}
      </div>

      {canEdit && agentPrompts.length > 0 && !draft.trim() && (
        <div className="node-focus-chat-prompts" aria-label="Suggested prompts">
          {agentPrompts.map((chip) => (
            <button
              type="button"
              key={chip.label}
              className="node-focus-prompt-chip"
              onClick={() => setDraft(chip.prompt)}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      {canEdit && subtarget && (
        <div className="node-focus-subtarget-pill" data-subtarget-id={subtarget.id}>
          <span>📍 {subtarget.label}</span>
          <button
            type="button"
            aria-label="Clear subtarget"
            title="Clear subtarget focus"
            onClick={() => setSubtarget(null)}
          >
            ✕
          </button>
        </div>
      )}

      {canEdit && (
        <form
          className="node-focus-chat-composer"
          onKeyDown={(e) => {
            submitOnEnter(e);
            submitOnCmdEnter(e);
          }}
          onSubmit={async (e) => {
            e.preventDefault();
            const trimmed = draft.trim();
            if (!trimmed) return;
            const op = buildNodeAnchoredMessageOp({
              canvas,
              item,
              body: trimmed,
              subtarget,
              threadId: activeThreadId === "new" ? "new" : (currentThread?.id ?? null),
              makeComment,
              contextRequest: context.request,
            });
            await sending.submit(
              () => sendEchoedResult(canvasId, actor, op),
              () => {
                setDraft("");
                setSubtarget(null);
                if (op.type === "thread.create") {
                  setActiveThreadId(op.threadId);
                }
              },
            );
          }}
        >
          {needsContextManifestPreview(context, selectionRoots) && <MessageContextPreview context={context} />}
          {sending.error && <p role="alert">{sending.error}</p>}
          <div className="node-focus-chat-composer-row">
            <MentionField
              placeholder={
                subtarget
                  ? `Ask about ${subtarget.label}…`
                  : `Ask about ${item.title}…`
              }
              grow
              value={draft}
              onChange={setDraft}
              candidates={candidates}
              peers={peers}
              itemCandidates={itemRoster.candidates}
              items={itemRoster.entries}
            />
            <button
              className="btn primary"
              type="submit"
              title={`Send anchored message (${shortcut("⏎")})`}
              disabled={!draft.trim() || sending.disabled}
            >
              ↑
            </button>
          </div>
        </form>
      )}
    </aside>
  );
}
