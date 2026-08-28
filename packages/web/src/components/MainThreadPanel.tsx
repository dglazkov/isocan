import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Actor, CanvasContents, Comment, CommentThread, Item } from "@isocan/core";
import { keyFor, laneFor, mainThread, parseSlashCommand, workedFor } from "@isocan/core";
import { sendOp } from "../lib/api.ts";
import { postToMain } from "../lib/mainthread.ts";
import { flashNotice, useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { centerOn, threadWorldPos } from "../lib/viewport.ts";
import { railSpan, stageRect } from "../lib/stage.ts";
import { placeableArea, revealIfOffscreen } from "../lib/spot.ts";
import { glideToBox, revealItem } from "../lib/zoomactions.ts";
import { actorColorIn, useActorColors } from "../lib/colors.ts";
import { useMentionRoster } from "../lib/mentions.ts";
import { useItemRefRoster } from "../lib/itemrefs.ts";
import { rehypeChips } from "../lib/chips.ts";
import { MentionField } from "./MentionField.tsx";
import { ItemPeek, ItemThumb } from "./ItemThumb.tsx";
import { submitOnCmdEnter, submitOnEnter } from "../lib/submit.ts";
import { markRead } from "../stores/unreadStore.ts";
import { openPanel, storedPanel } from "../lib/panels.ts";
import { OnIt } from "./OnIt.tsx";
import { runLocalCommand } from "../lib/localcommands.ts";
import { useCommands } from "../lib/commands.ts";
import { actorNameIn, useActorNames } from "../lib/names.ts";

/**
 * The designated main thread (#36): one thread per canvas rendered as a
 * docked agent-chat panel on the left instead of a pin. It exists before its
 * thread does — the first message creates the thread with `main: true` — and
 * any thread can be promoted into it ("Make main" on a popover, or
 * `isocan comment main`). Agents always wake on comments landing here.
 */



/**
 * The panel's width is no longer a constant — it is dragged, and it lives in
 * `uiStore` as `panelWidth` (floor: `PANEL_MIN_WIDTH`). Re-exported here
 * because this module was where everything asked, and one import site moving
 * is cheaper than six.
 */
export { PANEL_MIN_WIDTH } from "../stores/uiStore.ts";

import { PanelResizer } from "./PanelResizer.tsx";

/**
 * What the message is about: the current selection, shown as chips over the
 * composer and sent with the message as ids. The chips ARE the selection —
 * removing one deselects it — so there is one answer to "what am I pointing
 * at" rather than two that can disagree.
 */
function Attached({ canvasId }: { canvasId: string }) {
  const selected = useUiStore((s) => s.selectedItemIds);
  // Which pill the pointer is on, and where it sits, so the bigger look at it
  // opens over the chip rather than under the pointer.
  const [peek, setPeek] = useState<{ id: string; title: string; left: number; top: number } | null>(
    null,
  );
  // Subscribe to the canvas, then map OUTSIDE the selector. A selector that
  // builds an array returns a new reference every call, so the store looks
  // changed on every render — which is an infinite loop, not a subscription.
  const canvas = useCanvasStore((s) => s.canvas);
  const items = selected.map((id) => canvas?.items[id]).filter((item) => item !== undefined);
  if (items.length === 0) return null;
  const shown = items.slice(0, 3);
  return (
    <div
      className="attached"
      aria-label="Items this message is about"
      // Tracked on the ROW, not per chip: chips sit shoulder to shoulder, and
      // their previews resize as they load, so per-chip enter/leave pairs churn
      // and cancel each other. The row only ever sees one pointer.
      onPointerMove={(e) => {
        const chip = (e.target as HTMLElement).closest?.("[data-chip-id]");
        const id = chip?.getAttribute("data-chip-id") ?? null;
        if (!id) return;
        if (peek?.id === id) return;
        const rect = chip!.getBoundingClientRect();
        const item = items.find((one) => one.id === id);
        if (!item) return;
        setPeek({ id, title: item.title, left: rect.left, top: rect.top });
        useUiStore.getState().setPeeked(id);
      }}
      onPointerLeave={() => {
        setPeek(null);
        useUiStore.getState().setPeeked(null);
      }}
    >
      {shown.map((item) => (
        <span key={item.id} className="attached-chip" data-chip-id={item.id}>
          <ItemThumb canvasId={canvasId} itemId={item.id} width={18} height={18} />
          <b>{item.title}</b>
          <button
            type="button"
            title={`Don't send ${item.title}`}
            aria-label={`Remove ${item.title}`}
            onClick={() => useUiStore.getState().toggleSelect(item.id)}
          >
            ✕
          </button>
        </span>
      ))}
      {items.length > shown.length && (
        <span className="attached-more">+{items.length - shown.length}</span>
      )}
      {peek && (
        <ItemPeek
          canvasId={canvasId}
          itemId={peek.id}
          style={{ left: Math.max(8, peek.left), top: peek.top - 8, transform: "translateY(-100%)" }}
        />
      )}
    </div>
  );
}

/**
 * A message that asked for a known piece of work wears the command as a chip:
 * the words after it are the instruction, and the chip is the part an agent
 * will look up. Rendering it as a chip and dropping it from the markdown keeps
 * it said once — the body below is what they typed on top of the request.
 */
export function CommandChip({ body }: { body: string }) {
  const parsed = parseSlashCommand(body);
  if (!parsed) return null;
  return (
    <span className="command-chip" title={`Asks an agent to run /${parsed.name}`}>
      /{parsed.name}
    </span>
  );
}

/** The message without its command word — what they typed on top of it. */
export function withoutCommand(body: string): string {
  const parsed = parseSlashCommand(body);
  return parsed ? body.slice(parsed.end).trimStart() : body;
}

/**
 * Is the last word in this thread yours, and unanswered? That is the only
 * moment "sent — somebody is listening" is worth saying: before you have asked
 * it is noise, and after somebody has answered it is wrong.
 */
export function awaitingReply(
  thread: { comments: { author: { id: string } }[] },
  actorId: string,
): boolean {
  const last = thread.comments[thread.comments.length - 1];
  return last !== undefined && last.author.id === actorId;
}

/** catapultToItem, but centered in the canvas area the panel leaves visible. */
function catapultBesidePanel(itemId: string): void {
  const item = useCanvasStore.getState().canvas?.items[itemId];
  if (!item) return;
  const ui = useUiStore.getState();
  const stage = stageRect();
  const at = centerOn(ui.viewport, item.x + item.width / 2, item.y + item.height / 2, stage.width, stage.height);
  ui.setViewport({ ...at, tx: at.tx + stage.x, ty: at.ty + stage.y });
  ui.select(item.id);
}

/** Open/close the panel and remember the choice per canvas. The left dock
 * holds one panel at a time; opening this one puts the files away. */
export function openMainPanel(canvasId: string, open: boolean): void {
  openPanel(canvasId, open ? "main" : null);
}

/* The key the overlay and `isocan shortcuts` both print for undo. Spelled
   once, in `SHORTCUTS`, so a notice cannot promise a keystroke the app does
   not actually listen for. */
const undoKey = keyFor("Undo and redo") ?? "⌘Z";

/* A pin is a small round mark, not a box — this is the span the reveal treats
   it as so that "is it on screen" has something to measure. */
const PIN_SIZE = 28;

export function MainThreadPanel({ canvasId, actor }: { canvasId: string; actor: Actor }) {
  const canvas = useCanvasStore((s) => s.canvas);
  const open = useUiStore((s) => s.mainPanelOpen);
  const panelWidth = useUiStore((s) => s.panelWidth);

  // First snapshot decides the default: open when a main thread already
  // exists (someone designated this channel), closed on a virgin canvas.
  // A stored preference from an earlier visit wins either way.
  const initedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!canvas || initedFor.current === canvasId) return;
    initedFor.current = canvasId;
    const stored = storedPanel(canvasId);
    // Never chosen here: a canvas that already has a main thread opens with it.
    // No pan: the viewport being restored was saved WITH this rail open, so
    // it is already correct. Panning here would slide the canvas sideways on
    // every load.
    openPanel(canvasId, stored === undefined ? (mainThread(canvas) ? "main" : null) : stored, false);
  }, [canvas, canvasId]);

  // Closed, the panel has no surface of its own — its toggle (wearing the
  // unread badge) is the "Main" button in the top bar's create actions.
  if (!canvas || !open) return null;
  return <Panel canvasId={canvasId} actor={actor} />;
}

/**
 * The thread itself, exported for the workbench: ONE channel, two frames.
 *
 * The workbench renders the main thread through this exact component rather
 * than a copy — the design doc's hardest one-liner ("never a copy") — so the
 * composer, the mention roster, the chips and the unread store cannot drift
 * between the two views. `docked` is the only difference the frame makes:
 * the canvas dock brings its resizer and its stored width; the workbench
 * column sizes it with its grid, and read-marking waits for engagement
 * (below) instead of firing on mount.
 */
/**
 * **What this message produced**, as against what it merely pointed at.
 *
 * The cards below list every item the message #-referenced. This row is the
 * narrower claim the cards cannot make: these ones did not exist, or did not
 * exist in this version, until the author said this. That is the sentence
 * isocan has been able to write since versions were added and has never
 * written down.
 *
 * `laneFor` lives in core, not here, because it is a fact about the canvas
 * rather than about this panel — `isocan comment` can print the same lane the
 * app draws, and the alternative is two derivations that agree until they
 * don't.
 *
 * Clicking flies to the item, which is the entire point of an arrow: an arrow
 * you cannot follow is punctuation.
 *
 * **It is not a duplicate of the card below it, even when it looks like one.**
 * The card says what the item IS — `v${versions.length}`, the top of the
 * stack right now. The chip says what this message MADE, which is a fact
 * about the past and stops changing the moment the author moves on. They
 * coincide only while the message produced the latest version; on any item
 * that has been worked since, the card reads v7 and the chip still reads v2,
 * which is the whole reason the chip is worth its row.
 */
function LaneChips({
  canvas,
  thread,
  comment,
}: {
  canvas: CanvasContents;
  thread: CommentThread;
  comment: Comment;
}) {
  const made = laneFor(canvas, thread, comment);
  if (made.length === 0) return null;
  return (
    <div className="lane-row">
      {made.map((entry) => (
        <button
          key={entry.itemId}
          className="lane-chip"
          data-item={entry.itemId}
          title={
            entry.born
              ? `${comment.author.name} made this here`
              : `${comment.author.name} took this to v${entry.version} here`
          }
          onClick={() => revealItem(entry.itemId)}
        >
          <span className="lane-arrow" aria-hidden>
            →
          </span>
          <span className="lane-name">{entry.title}</span>
          <span className="lane-v">v{entry.version}</span>
        </button>
      ))}
    </div>
  );
}

export function MainThreadBody({
  canvasId,
  actor,
  docked = true,
}: {
  canvasId: string;
  actor: Actor;
  docked?: boolean;
}) {
  return <Panel canvasId={canvasId} actor={actor} docked={docked} />;
}

function Panel({
  canvasId,
  actor,
  docked = true,
}: {
  canvasId: string;
  actor: Actor;
  docked?: boolean;
}) {
  // A subscription, not a read: the chips have to appear and vanish as the
  // selection changes under the pointer.
  const selected = useUiStore((s) => s.selectedItemIds);
  const panelWidth = useUiStore((s) => s.panelWidth);
  const colors = useActorColors();
  // Names come from the registry, not from the comment: a rename has to reach
  // what its author said before it (lib/names.ts).
  const names = useActorNames();
  const canvas = useCanvasStore((s) => s.canvas);
  const thread = canvas ? mainThread(canvas) : null;
  const [draft, setDraft] = useState("");
  const { candidates, peers } = useMentionRoster(actor.id);
  const itemRoster = useItemRefRoster();
  const commands = useCommands();
  const chips = useMemo(
    () => [rehypeChips(candidates, actor.id, itemRoster.candidates)],
    [candidates, actor.id, itemRoster.candidates],
  );

  // Open is read — including messages landing while you are looking at it.
  // But only for the DOCKED frame, where opening the panel was a deliberate
  // gesture. The workbench column is permanently open: marking on mount
  // there would clear the badge for messages nobody saw while staring at
  // the stage, so it marks on engagement instead (the pointer handler on
  // the root, below).
  const commentCount = thread?.comments.length ?? 0;
  useEffect(() => {
    if (docked && thread) markRead(thread.id);
    // Identity and count, not the object — see the same narrowing in
    // CommandBar. A fresh snapshot per op would re-mark on unrelated traffic.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docked, thread?.id, commentCount]);

  // Chat scroll: pinned to the newest message as they arrive.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread?.id, commentCount]);

  if (!canvas) return null; // reconnecting — parent unmounts us next render

  async function send(body: string, attached: string[]) {
    await postToMain(canvasId, actor, body, attached);
  }

  function chipTarget(e: { target: EventTarget }): string | null {
    return (e.target as HTMLElement).closest("[data-item-id]")?.getAttribute("data-item-id") ?? null;
  }

  return (
    <div
      className="main-panel dock-panel"
      style={docked ? { width: panelWidth } : undefined}
      onPointerDown={(e) => {
        e.stopPropagation();
        // Engagement IS reading, in the undocked frame.
        if (!docked && thread) markRead(thread.id);
      }}
    >
      {docked && <PanelResizer />}
      <header>
        <span className="main-glyph">✳</span>
        {/* The same word the button that opens it says. It read "Main
            thread" under a button that said "Main" — two labels for one panel,
            and both naming the SLOT (there is one, it is the main one) rather
            than the thing people do in it. Name and hint, the pattern the
            stage's panes already use. */}
        <b>Chat</b>
        <i className="main-hint" title="Everything posted here reaches every collaborator, agents included, with no @-mention needed — which is what makes it different from a comment pinned to one thing.">everyone here, agents included</i>
        <span className="spacer" />
        {thread && (
          <button
            className="main-detach"
            /**
             * **It was never necessarily on the canvas.**
             *
             * This said "back to canvas", and the tooltip said "where it was
             * anchored" — both of which assume the Chat used to be a pin that
             * somebody promoted. A Chat can equally be BORN as the Chat:
             * `thread.create` takes `main: true`, which is what the panel
             * does on a virgin canvas, and such a thread has never been
             * anchored to anything. Told it was going "back" somewhere it had
             * never been, on a canvas with 36 messages in it, a person reads
             * a button that has lost their conversation.
             *
             * "Make it a pin" is true either way, and mirrors the promote
             * button's "Make this the Chat" on the other side of the same op.
             */
            title="This conversation stops being the Chat and becomes an ordinary pin on the canvas. Nothing is deleted, and it can be made the Chat again."
            onClick={() => {
              /**
               * **Show where it went, do not just claim it went somewhere.**
               *
               * The pin lands at the thread's own coordinates, and for a Chat
               * born as the Chat those are the centre of whatever view the
               * FIRST message was typed in — which on this canvas was nine
               * days and one other person ago. So the honest failure is not
               * that the conversation is lost, it is that the pin can be two
               * screens away with nothing on screen changing except the panel
               * emptying.
               *
               * Same safety net dropped files got, and conditional for the
               * same reason: if the pin is already in front of you, the
               * camera does not move. Silent in the common case, handled in
               * the surprising one.
               */
              const canvas = useCanvasStore.getState().canvas;
              const at = canvas && thread ? threadWorldPos(canvas, thread) : null;
              sendOp(canvasId, actor, { type: "thread.setMain", threadId: null });
              if (at) {
                revealIfOffscreen(
                  useUiStore.getState().viewport,
                  [{ x: at.x, y: at.y, width: PIN_SIZE, height: PIN_SIZE }],
                  placeableArea(),
                  glideToBox,
                );
              }
              // **Say what just happened, and how to take it back.**
              //
              // This button empties the Chat panel in one click, sits beside
              // the ✕, and was pressed by mistake on a canvas with 36
              // messages in it. Nothing was lost — the thread is a pin again
              // and `thread.setMain` has always had an inverse — but the
              // screen said nothing, so it read as "the entire chat is gone",
              // which is the worst thing an interface can be wrong about.
              //
              // The op was already reversible; what was missing was anybody
              // being told. A confirm dialog would have been the other
              // answer, and the wrong one: it taxes every deliberate press to
              // protect the rare accidental one, and it still would not have
              // said the conversation survived.
              flashNotice(
                `This is a pin on the canvas now — ${undoKey} makes it the Chat again.`,
                6000,
              );
            }}
          >
            make it a pin
          </button>
        )}
        <button
          className="main-close"
          title="Collapse"
          onClick={() => openMainPanel(canvasId, false)}
        >
          ✕
        </button>
      </header>
      <div
        className="main-scroll"
        ref={scrollRef}
        onClick={(e) => {
          const itemId = chipTarget(e);
          if (itemId) catapultBesidePanel(itemId);
        }}
      >
        <div className="main-msgs">
          {!thread && (
            <div className="main-empty">
              The canvas's own conversation: everything here reaches every
              collaborator, agents included, with no @-mention needed. That is
              what makes it different from a comment, which is pinned to one
              thing and is about that thing. Items you #-reference show up as
              cards.
            </div>
          )}
          {thread?.comments.map((comment) => (
            <div className="comment" key={comment.id}>
              <span className="who" style={{ "--who": actorColorIn(colors, comment.author.id) } as CSSProperties}>
                {actorNameIn(names, comment.author)}
              </span>
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
              {canvas && thread && <LaneChips canvas={canvas} thread={thread} comment={comment} />}
              {(comment.items ?? [])
                .filter((id, i, all) => all.indexOf(id) === i)
                .map((itemId) => (
                  <ItemCard key={itemId} canvasId={canvasId} itemId={itemId} />
                ))}
            </div>
          ))}
          {thread && (
            <OnIt
                thread={thread}
                waiting={awaitingReply(thread, actor.id)}
                canvasId={canvasId}
                actor={actor}
              />
          )}
        </div>
      </div>
      <form
        onKeyDown={(e) => {
          submitOnEnter(e);
          submitOnCmdEnter(e);
        }}
        onSubmit={async (e) => {
          e.preventDefault();
          const body = draft.trim();
          if (!body) return;
          // /help and its kind are answered here rather than posted: see
          // lib/localcommands.ts.
          if (runLocalCommand(body, commands)) {
            setDraft("");
            return;
          }
          const attached = useUiStore.getState().selectedItemIds;
          setDraft("");
          await send(body, attached);
        }}
      >
        <Attached canvasId={canvasId} />
        <MentionField
          // One placeholder, both states: what the CHANNEL is beats what the
          // moment is. Everything typed here reaches every agent listening
          // unless a name is called, and that is the thing worth knowing
          // before you type; the chips above already say what it is about.
          // (No "@name to target" tail: it needs 285px in a 236px field, and
          // a hint that ellipsises is worse than no hint. ⌘K and ? carry it.)
          placeholder="Message everyone — agents included"
          grow
          value={draft}
          onChange={setDraft}
          candidates={candidates}
          peers={peers}
          itemCandidates={itemRoster.candidates}
          items={itemRoster.entries}
        />
        <button className="btn primary" type="submit" title="Send (⌘⏎)" disabled={!draft.trim()}>
          ↑
        </button>
      </form>
    </div>
  );
}

/**
 * A #-referenced item rendered as a card (the Claude-Artifact idiom the issue
 * asks for): what it looks like, its name, what it is — clicking flies you to
 * it, and pointing at it opens the same peek the panel and the rim open,
 * beside the panel, while the item itself lights up on the canvas.
 */
function ItemCard({ canvasId, itemId }: { canvasId: string; itemId: string }) {
  const item = useCanvasStore((s) => s.canvas?.items[itemId]);
  const panelWidth = useUiStore((s) => s.panelWidth);
  const [peekTop, setPeekTop] = useState<number | null>(null);
  if (!item) {
    return (
      <div className="mt-card gone">
        <span className="mt-glyph">▦</span>
        <span className="mt-title">No longer on the canvas</span>
      </div>
    );
  }
  return (
    <>
      <button
        className="mt-card"
        onClick={() => catapultBesidePanel(itemId)}
        aria-label={`Fly to ${item.title}`}
        onPointerEnter={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setPeekTop(rect.top + rect.height / 2);
          useUiStore.getState().setPeeked(itemId);
        }}
        onPointerLeave={() => {
          setPeekTop(null);
          useUiStore.getState().setPeeked(null);
        }}
      >
        <ItemThumb canvasId={canvasId} itemId={itemId} width={44} height={34} />
        <span className="mt-text">
          <span className="mt-title">{item.title}</span>
          <span className="mt-meta">
            {kindOf(item)}
            {item.versions.length > 1 ? ` · v${item.versions.length}` : ""}
          </span>
        </span>
        <span className="mt-go">➜</span>
      </button>
      {peekTop !== null && (
        <ItemPeek
          canvasId={canvasId}
          itemId={itemId}
          // Beside the panel, centred on the card, never off the window it is
          // meant to be read on — the files panel's peek, in the other panel.
          style={{
            left: railSpan(panelWidth) + 10,
            top: Math.min(Math.max(peekTop, 110), window.innerHeight - 110),
            transform: "translateY(-50%)",
          }}
        />
      )}
    </>
  );
}

function kindOf(item: Item): string {
  const mime =
    item.versions.find((v) => v.id === item.currentVersionId)?.mimeType ??
    item.versions[item.versions.length - 1]?.mimeType ??
    "";
  if (mime === "text/markdown") return "markdown";
  if (mime === "text/html") return "html";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return mime || "file";
}
