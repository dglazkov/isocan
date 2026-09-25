import { useChatDraft } from "../lib/chatdraft.ts";
import "./command-chip.css";
import { modules } from "../modules.ts";
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Markdown } from "../lib/markdown.tsx";
/**
 * **Loaded only when a module actually offers a control** (proposed:
 * `composer`). The slot's renderer reaches the module host and the theme
 * store, which measured 6KB in the entry chunk when it was a plain import —
 * paid by every first visit for a slot that is empty unless an experiment is
 * on. Same argument as `EXPERIMENT_HALVES`: merged but off has to mean off.
 */
const ModuleComposerControls = lazy(() =>
  import("./ModuleComposer.tsx").then((module) => ({ default: module.ModuleComposerControls })),
);

/** The Chat's clean-up — the remove control on a message and the owner's
 *  "Clean up…" menu — loaded only for somebody who can write here. */
const ChatTidy = lazy(() => import("./ChatTidy.tsx"));

const DesignComment = lazy(() => import("./DesignComment.tsx").then((module) => ({ default: module.DesignComment })));
const DesignComparisonComment = lazy(() => import("./DesignComparisonComment.tsx").then((module) => ({ default: module.DesignComparisonComment })));
import type { Actor, CanvasContents, Comment, CommentThread, Item } from "@isocan/core";
import { benchJoinAsk, isSystemActor, laneFor, mainThread, parseSlashCommand, workedFor, shortcut } from "@isocan/core";
import { sendOp } from "../lib/api.ts";
import { postToMain } from "../lib/mainthread.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { centerOn } from "../lib/viewport.ts";
import { railSpan, stageRect } from "../lib/stage.ts";
import { glideToBox, revealItem } from "../lib/zoomactions.ts";
import { type FollowState, nextFollow } from "../lib/lanefollow.ts";
import { actorColorIn, useActorColors } from "../lib/colors.ts";
import { useMentionRoster } from "../lib/mentions.ts";
import { useBenchMentions } from "../lib/benchmentions.ts";
import { useItemRefRoster } from "../lib/itemrefs.ts";
import { rehypeChips } from "../lib/chips.ts";
import { MentionField } from "./MentionField.tsx";
import { ItemPeek, ItemThumb } from "./ItemThumb.tsx";
import { submitOnCmdEnter, submitOnEnter } from "../lib/submit.ts";
import { markRead } from "../stores/unreadStore.ts";
import { openPanel, storedPanel } from "../lib/panels.ts";
import { ChatGlyph } from "./Glyphs.tsx";
import { OnIt } from "./OnIt.tsx";
import { GateGrant } from "./LazyGate.tsx";
import { runLocalCommand } from "../lib/localcommands.ts";
import { useCommands } from "../lib/commands.ts";
import { actorNameIn, useActorNames } from "../lib/names.ts";
const DesignTaskPanel = lazy(() => import("./DesignTaskPanel.tsx").then((module) => ({ default: module.DesignTaskPanel })));
const QuestionnairePanel = lazy(() => import("./QuestionnairePanel.tsx").then((module) => ({ default: module.QuestionnairePanel })));
import { messageContextRoots, useMessageContext, useMessageSend } from "../lib/messagecontext.ts";
import { ContextManifestView, MessageContextPreview } from "./LazyGroupContext.tsx";
import { useCanEdit } from "../lib/capability.ts";


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

/**
 * **What the `@` menu says beside a name that is on your bench and not on this
 * canvas** (the bench, phase 2 — journey 3).
 *
 * A name in a mention menu reads as somebody who can hear you. Sian cannot,
 * until the next word is `join` — so the row says so rather than letting the
 * menu imply otherwise. Present tense and no apology: it is not an error, it
 * is the state, and the fix is one word away.
 */
const NOT_HERE_YET = "not here yet";

import { PanelResizer } from "./PanelResizer.tsx";
import { PanelHead } from "./PanelHead.tsx";
import { CommentFold, CommentWhen } from "./CommentWhen.tsx";

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
  if (/^\/ask(?:\s|$)/.test(body)) return body; // Invalid legacy data remains readable text.
  const parsed = parseSlashCommand(body);
  return parsed ? body.slice(parsed.end).trimStart() : body;
}

/**
 * Is the last word in this thread yours, and unanswered? That is the only
 * moment "sent — somebody is listening" is worth saying: before you have asked
 * it is noise, and after somebody has answered it is wrong. A `record` asked
 * nothing (a `/wire` act's account of what it made summons nobody), so it
 * waits on nobody either.
 */
export function awaitingReply(
  thread: { comments: { author: { id: string }; record?: Comment["record"] }[] },
  actorId: string,
): boolean {
  const last = thread.comments[thread.comments.length - 1];
  return last !== undefined && last.author.id === actorId && !last.record;
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

export function MainThreadPanel({ canvasId, actor }: { canvasId: string; actor: Actor }) {
  const canvas = useCanvasStore((s) => s.canvas);
  const open = useUiStore((s) => s.mainPanelOpen);
  const panelWidth = useUiStore((s) => s.panelWidth);

  // A canvas you have never chosen for opens with the Chat: it is where you
  // talk to everyone here, agents included, and a closed pill on a new canvas
  // read as "nothing to say" (reported 24 Sep 2026). It used to open only
  // when a main thread already existed. A stored choice from an earlier visit
  // wins either way.
  const initedFor = useRef<string | null>(null);
  /**
   * **A remembered rail is restored BEFORE the first paint, not after the
   * canvas loads.**
   *
   * This waited for `canvas` — a network round-trip — so for that whole time
   * the store said "closed" and everything positioned against the rail was
   * drawn in the wrong place. When the canvas landed, the rail opened and the
   * minimap slid 340px across the screen on its 0.22s transition. Reported as
   * "the minimap icon jumps across from the left on reload", which is exactly
   * what it was: not a minimap bug, a restore that happened too late.
   *
   * The remembered choice needs nothing from the canvas — it is a string in
   * localStorage — so it is applied synchronously, in a layout effect, before
   * anything is painted. Only the case where nobody has ever chosen has to
   * wait, because "open if this canvas already has a Chat" is a question about
   * the canvas. (Since 24 Sep the never-chosen default is simply open, so it
   * waits on nothing and is applied here too.)
   */
  useLayoutEffect(() => {
    if (initedFor.current === canvasId) return;
    const stored = storedPanel(canvasId);
    initedFor.current = canvasId;
    // No pan: the viewport being restored was saved WITH this rail open, so
    // it is already correct. Panning here would slide the canvas sideways on
    // every load.
    // Never chosen here (undefined): open with the Chat, not remembered, so
    // the first real choice is still the person's.
    openPanel(canvasId, stored === undefined ? "main" : stored, false, false);
  }, [canvasId]);

  // Closed, the panel has no surface of its own — its toggle (wearing the
  // unread badge) is the "Main" button in the top bar's create actions.
  if (!canvas || !open) return null;
  return <Panel key={canvasId} canvasId={canvasId} actor={actor} />;
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

/**
 * **Follow: the camera goes to what a message just made.**
 *
 * The decision lives in `lib/lanefollow.ts` as a pure function, and that is
 * the point rather than tidiness: this is the one feature that moves the
 * canvas without being asked each time, so its rules are somewhere they can
 * be argued with instead of buried in an effect.
 *
 * It lives here because the LANE lives here — what a message made is a fact
 * about this thread — but what it follows is chosen in the agent tray, one
 * agent at a time. A toggle on the Chat meant "follow whatever anybody just
 * made", which with three agents working is a camera yanked between unrelated
 * corners of the canvas.
 *
 * `busy` is a pan or a drag, and it beats follow outright — the move is
 * dropped rather than deferred, because a camera that lurches the instant you
 * release the mouse is worse than one that missed a message.
 *
 * `revealItem`, not `centerOn`: the same conditional flight a dropped file
 * gets. If the thing is already in front of you, nothing moves at all.
 */
function useLaneFollow(canvas: CanvasContents | null, thread: CommentThread | null) {
  const actorId = useUiStore((s) => s.followingActorId);
  const panning = useUiStore((s) => s.panning);
  const drag = useUiStore((s) => s.drag);
  const state = useRef<FollowState>({ lastItemId: null, lastAtMs: 0 });
  useEffect(() => {
    if (!canvas) return;
    const go = nextFollow(canvas, thread, state.current, {
      actorId,
      busy: panning || drag !== null,
      nowMs: Date.now(),
    });
    if (!go) return;
    state.current = { lastItemId: go, lastAtMs: Date.now() };
    revealItem(go);
  }, [canvas, thread, actorId, panning, drag]);
}

export function MainThreadBody({
  canvasId,
  actor,
  docked = true,
  onOpenItem,
  refCards,
}: {
  canvasId: string;
  actor: Actor;
  docked?: boolean;
  onOpenItem?: ((id: string) => void) | undefined;
  refCards?: RefCards | undefined;
}) {
  return <Panel key={canvasId} canvasId={canvasId} actor={actor} docked={docked} onOpenItem={onOpenItem} refCards={refCards} />;
}

/**
 * **What a message links, drawn by the frame that wants it drawn so.** The
 * phone passes its reference cards (`MessageReferenceCards.tsx`) in; the
 * docked Chat never drew them, so the cards and the core reader under them
 * sit in the phone's chunk rather than on every first visit.
 */
type RefCards = (comment: Comment) => ReactNode;

function Panel({
  canvasId,
  actor,
  docked = true,
  onOpenItem,
  refCards,
}: {
  canvasId: string;
  actor: Actor;
  docked?: boolean;
  onOpenItem?: ((id: string) => void) | undefined;
  refCards?: RefCards | undefined;
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
  useLaneFollow(onOpenItem ? null : canvas, onOpenItem ? null : thread);
  const [draft, setDraft] = useChatDraft(canvasId, actor.id);
  const context = useMessageContext(canvasId, messageContextRoots(canvas, draft, selected));
  const sending = useMessageSend(canvasId, context, draft);
  /**
   * **Which module is standing where the message box is** (proposed:
   * `composer`), or null when the composer is the shell's own.
   *
   * State here rather than in the slot because the SHELL owns the row: a
   * module reports that it wants it and the shell decides what yielding
   * means. That also makes the recovery obvious — an experiment switched off
   * mid-session takes its control away, and a holder with no control left
   * would be a composer nobody can type in and nothing on screen to give it
   * back, which no reload-free gesture fixes.
   */
  const [composerHolder, setComposerHolder] = useState<string | null>(null);
  const takeComposer = useCallback(
    (moduleName: string, active: boolean) => setComposerHolder(active ? moduleName : null),
    [],
  );
  const composerOffered = modules()
    .filter((m) => (m.composer ?? []).length > 0)
    .map((m) => m.core.name);
  useEffect(() => {
    if (composerHolder !== null && !composerOffered.includes(composerHolder)) setComposerHolder(null);
  }, [composerHolder, composerOffered]);
  /** What a `@Name join` was answered with, when it was not carried out. Its
   *  own state rather than `sending.error`: nothing was sent, so nothing was
   *  refused by a home, and saying "the message was refused" would be wrong
   *  about which refusal this is. */
  const [refused, setRefused] = useState("");
  const canEdit = useCanEdit();
  /**
   * **The design partner's two entrances, behind their experiment.**
   *
   * `Start design task` renders under EVERY comment and `Ask design questions`
   * at the foot of every thread, unconditionally for anyone who can edit — so
   * a canvas with forty messages grew forty controls for a feature that landed
   * the same day. Dion's reading, 16 Sep 2026: *"verbose and I don't get it"*.
   *
   * The gate is the house answer for exactly this, and `experiments.ts` says so
   * — a module behind an experiment ships in the bundle and is off. The Inbox
   * went behind one for the same reason: off while its shape settles.
   *
   * Only the ALWAYS-ON entrances are gated. A canvas that already carries
   * design requests or questions still draws them, because hiding work
   * somebody has already started would be a different and worse bug.
   */
  const designPartner = useUiStore((s) => s.experiments.includes("design.partner"));
  const questionnaireViewer = JSON.stringify([canvasId, actor.id]);
  const [publisherFor, setPublisherFor] = useState<string | null>(null);
  const showDesignQuestions = publisherFor === questionnaireViewer;
  const [designSource, setDesignSource] = useState<{ entrance: "canvas-chat"; threadId: string; commentId: string } | null>(null);
  const hasDesignRequests = canvas && Object.values(canvas.items).some((item) => item.versions.some((version) => version.designRecord?.kind === "brief"));
  const hasDesignQuestions = canvas && Object.values(canvas.threads).some((one) => one.comments.some((comment) => comment.design?.kind === "questions" || /^\/ask(?:\s|$)/.test(comment.body)));


  /**
   * A command the launcher picked, handed over rather than posted.
   *
   * ⌘K does not send it, because most commands take an argument —
   * `/variation 3 layouts` is a different request from `/variation` — and
   * sending the bare word would be guessing at the half nobody has typed yet.
   * So it arrives here, in the field, with the caret after it.
   *
   * Taken once and cleared: leaving it in the store would re-apply it over
   * whatever somebody typed next, on the next render that happened to run.
   */
  const pendingChat = useUiStore((s) => s.pendingChat);
  useEffect(() => {
    if (pendingChat === null) return;
    setDraft((current) => (current.trim() === "" ? pendingChat : current));
    useUiStore.getState().setPendingChat(null);
  }, [pendingChat, setDraft]);
  const { candidates, peers } = useMentionRoster(actor.id);
  /**
   * **The composer's candidates gain the asker's own bench** (the bench, phase
   * 2 — journey 3): `@Sian` has to resolve here BEFORE Sian is on this canvas,
   * or `@Sian join` is a line nobody can type.
   *
   * Only the composer's. `rehypeChips` below keeps the canvas's own
   * candidates, because a rendered body is read by everybody and a bench is
   * read by one person — painting somebody else's message with names off MY
   * bench would be the canvas showing me a chip nobody else can see.
   *
   * And only the ASKER's. `useBenchMentions` takes one actor id and reads one
   * personal canvas; there is no argument anywhere here that could reach a
   * second bench, which is what makes "Theo cannot see Sian" structural
   * rather than a filter somebody has to remember.
   */
  const bench = useBenchMentions(actor.id);
  const composerCandidates = useMemo(
    () => [...candidates, ...bench.mentions],
    [candidates, bench.mentions],
  );
  const composerPeers = useMemo(() => {
    const here = new Set(peers.map((peer) => peer.id));
    return [
      ...peers,
      ...bench.mentions
        .filter((one) => one.notHereYet && !here.has(one.id))
        .map((one) => ({ id: one.id, name: one.name, online: false, note: NOT_HERE_YET })),
    ];
  }, [peers, bench.mentions]);
  const itemRoster = useItemRefRoster();
  const commands = useCommands();
  /* The verbs this canvas actually has, for the chips. A command is chipped
     only where the palette could offer it — a chip that opens nothing is
     worse than plain text. */
  const commandNames = useMemo(() => commands.map((one) => one.name), [commands]);
  const chips = useMemo(
    () => [rehypeChips(candidates, actor.id, itemRoster.candidates, commandNames)],
    [candidates, actor.id, itemRoster.candidates, commandNames],
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
    // Identity and count, not the object: a fresh snapshot per op would
    // re-mark on unrelated traffic. (The ⌘K bar that shared this narrowing is
    // gone — the launcher replaced it.)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docked, thread?.id, commentCount]);

  // Chat scroll: pinned to the newest message as they arrive.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread?.id, commentCount]);

  if (!canvas) return null; // reconnecting — parent unmounts us next render

  function chipTarget(e: { target: EventTarget }): string | null {
    return (e.target as HTMLElement).closest("[data-item-id]")?.getAttribute("data-item-id") ?? null;
  }

  return (
    <div
      className="main-panel dock-panel floats"
      style={docked ? { width: panelWidth } : undefined}
      onPointerDown={(e) => {
        e.stopPropagation();
        // Engagement IS reading, in the undocked frame.
        if (!docked && thread) markRead(thread.id);
      }}
    >
      {docked && <PanelResizer />}
      {/**
       * **There is no "make it a pin" here, and that is the decision.**
       *
       * This button demoted the Chat to an ordinary pin. It was renamed once
       * (from "back to canvas", which was false for a Chat born as the Chat)
       * and given a flash notice after somebody pressed it by mistake on a
       * canvas holding 36 messages. Both were repairs to a button that should
       * not have been on this header.
       *
       * **Because the only thing it does is leave the canvas with NO Chat.**
       * The reducer already demotes the previous main when another thread is
       * promoted (`thread.setMain` in `reducer.ts`), so switching the Chat
       * needs only the promote button on a pin. And undoing a promotion is
       * what undo is for.
       *
       * What is left is a rare, deliberate act of configuration whose real
       * consequence the tooltip never mentioned: `isocan wait` wakes on the
       * main thread, so a canvas without one stops waking parked agents. That
       * belongs in `isocan comment main --clear`, typed on purpose, and not
       * one pixel from the ✕ that collapses the panel.
       *
       * Deliberately reintroducing it would trip `chrome.test.ts`.
       */}
      {!onOpenItem && <PanelHead
        glyph={<ChatGlyph size={13} />}
        /* The same word the button that opens it says. It read "Main thread"
           under a button that said "Main" — two labels for one panel, and both
           naming the SLOT rather than the thing people do in it. */
        name="Chat"
        hint="everyone here, agents included"
        hintTitle="Everything posted here reaches every collaborator, agents included, with no @-mention needed — which is what makes it different from a comment pinned to one thing."
        closeTitle="Collapse"
        closeLabel="Collapse the Chat"
        onClose={() => openMainPanel(canvasId, false)}
      />}
      {canEdit && <Suspense fallback={null}><ChatTidy canvasId={canvasId} actor={actor} /></Suspense>}
      <div
        className="main-scroll"
        ref={scrollRef}
        onClick={(e) => {
          const itemId = chipTarget(e);
          if (itemId) {
            (onOpenItem ?? catapultBesidePanel)(itemId);
            return;
          }
          /* A command chip opens the palette at that verb. The reader who
             clicks one usually wants to do the same thing, not read about it
             — a definition you cannot act on is the worse half of the answer,
             and the palette shows the description anyway. */
          const command = (e.target as HTMLElement).closest("[data-command]")?.getAttribute("data-command");
          if (command) useUiStore.getState().setPaletteOpen("commands");
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
            <div
              className={`comment${isSystemActor(comment.author.id) ? " system" : ""}`}
              key={comment.id}
            >
              {/* The system voice (phase 5): machinery reporting, never a
                  participant — no actor color, a fixed chip instead of a
                  name, so it can never be mistaken for someone answering. */}
              {isSystemActor(comment.author.id) ? (
                <span className="who system-voice" title="isocan itself — machinery reporting, not a participant">
                  ⚙ {comment.author.name}
                </span>
              ) : (
                <span className="who" style={{ "--who": actorColorIn(colors, comment.author.id) } as CSSProperties}>
                  {actorNameIn(names, comment.author)}
                </span>
              )}
              <CommentWhen comment={comment} />
              {workedFor(comment) && (
                <span className="worked" title={`Posted, then rewritten ${workedFor(comment)} later`}>
                  edited · {workedFor(comment)}
                </span>
              )}
              {/* Folded: the first line stands in for the message, so a thread
                  of folded reports is still a list you can navigate rather
                  than a column of names. Everything under it goes — the item
                  cards especially, which are the tallest thing here. */}
              <CommentFold comment={comment}>
                <div className="body">
                  {comment.designDecision ? <Suspense fallback={<p>Reading design decision…</p>}><DesignComparisonComment comment={comment} canvasId={canvasId} actor={actor} threadId={thread!.id} /></Suspense> : comment.design ? <Suspense fallback={<p>Reading design record…</p>}><DesignComment comment={comment} /></Suspense> : <><CommandChip body={comment.body} /><Markdown rehypePlugins={chips}>{withoutCommand(comment.body)}</Markdown></>}
                </div>
                {!onOpenItem && canvas && thread && <LaneChips canvas={canvas} thread={thread} comment={comment} />}
                {comment.context && <ContextManifestView manifest={comment.context} comment={{ threadId: thread.id, commentId: comment.id }} />}
                {refCards ? refCards(comment) : !comment.context && (comment.items ?? [])
                  .filter((id, i, all) => all.indexOf(id) === i)
                  .map((itemId) => (
                    <ItemCard key={itemId} canvasId={canvasId} itemId={itemId} onOpenItem={onOpenItem} />
                  ))}
                {designPartner && canEdit && !comment.design && !isSystemActor(comment.author.id) && <button className="main-design-ask" type="button" onClick={() => setDesignSource({ entrance: "canvas-chat", threadId: thread.id, commentId: comment.id })}>Start design task</button>}
              </CommentFold>
              {/* The refusal is the control (#272): the Chat reaches everyone,
                  so a mention here is turned away exactly as one in a thread
                  is, and the owner answers it in the same place. Mounted only
                  for a comment that names somebody — it subscribes to the rc
                  poll, and the Chat is the longest thread on the canvas. */}
              {thread && comment.mentions && comment.mentions.length > 0 && (
                <GateGrant canvasId={canvasId} viewer={actor} thread={thread} comment={comment} />
              )}
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
        {(hasDesignRequests || designSource) && <Suspense fallback={<p>Opening design task…</p>}><DesignTaskPanel key={questionnaireViewer} canvasId={canvasId} actor={actor} startSource={designSource} onStarted={() => setDesignSource(null)} /></Suspense>}
        </div>
      </div>
      {hasDesignQuestions || showDesignQuestions ? <Suspense fallback={null}><QuestionnairePanel key={questionnaireViewer} canvasId={canvasId} canvas={canvas} actor={actor} thread={thread} canEdit={canEdit} startPublishing={showDesignQuestions} /></Suspense> : designPartner && canEdit && thread && <button className="main-design-ask" type="button" onClick={() => setPublisherFor(questionnaireViewer)}>Ask design questions</button>}
      {canEdit && <form
        onKeyDown={(e) => {
          submitOnEnter(e);
          submitOnCmdEnter(e);
        }}
        onSubmit={async (e) => {
          e.preventDefault();
          const body = draft.trim();
          if (!body || sending.disabled) return;
          setRefused("");
          /**
           * **`@Sian join` is carried out here, not posted** (the bench,
           * phase 2 — journey 3), for `/help`'s reason: the act is the
           * message, and posting it would leave a request in the thread for
           * an agent that is not here to answer.
           *
           * A line that named nobody on YOUR bench is refused rather than
           * posted, and the refusal is shown to you rather than written into
           * the thread — it is an answer to the person who typed it, and
           * posting it would tell the whole canvas which names somebody
           * tried. `benchJoinAsk` returns an ask for an unresolved name
           * precisely so this branch exists: silence here would read as *no
           * such agent*, which is a claim about a canvas the speaker cannot
           * see.
           */
          const ask = benchJoinAsk(body, bench.mentions);
          if (ask) {
            // Fetched on the Enter that asks for it, never on the visit that
            // renders the composer: recognising the line is a dozen bytes of
            // core, and CARRYING IT OUT — the op, the thread's line, both
            // sentences — is a chunk that most people never touch. The same
            // boundary `lib/benchmentions.ts` puts round the bench reader,
            // for the same reason.
            const { joinFromChat } = await import("../lib/benchjoin.ts");
            const said = await joinFromChat(canvasId, actor, ask, bench);
            if (said) setRefused(said);
            else setDraft("");
            return;
          }
          // /help and its kind are answered here rather than posted: see
          // lib/localcommands.ts.
          if (runLocalCommand(body, commands)) {
            setDraft("");
            return;
          }
          const attached = useUiStore.getState().selectedItemIds;
          await sending.submit(() => postToMain(canvasId, actor, body, attached, context.request), () => setDraft(""));
        }}
      >
        {/* **A module may stand where the message box is** (proposed:
            `composer`). While one holds the row — a live voice session, say —
            the shell puts its own input, chips and send button away rather
            than drawing two ways to say something at once. It keeps the form,
            so ⌘⏎ and the submit handler are untouched and giving the row back
            restores a composer that never went anywhere. */}
        {composerHolder === null && (context.enabled ? <MessageContextPreview context={context} /> : <Attached canvasId={canvasId} />)}
        {composerHolder === null && sending.error && <p role="alert">{sending.error}</p>}
        {composerHolder === null && refused && <p role="alert">{refused}</p>}
        {composerHolder === null && <MentionField
          // One placeholder, both states: what the CHANNEL is beats what the
          // moment is. Everything typed here reaches every agent listening
          // unless a name is called, and that is the thing worth knowing
          // before you type; the chips above already say what it is about.
          // (No "@name to target" tail: it needs 285px in a 236px field, and
          // a hint that ellipsises is worse than no hint. ⌘K and ? carry it.)
          placeholder="Message everyone — agents included"
          grow
          value={draft}
          // A refusal is about the line that was typed. Keep it on screen
          // while that line is still there — and drop it the moment it is
          // not, rather than leaving "Sian is not on your bench" sitting
          // under a message about something else entirely.
          onChange={(next) => {
            setDraft(next);
            if (refused) setRefused("");
          }}
          candidates={composerCandidates}
          peers={composerPeers}
          bench={bench.mentions}
          itemCandidates={itemRoster.candidates}
          items={itemRoster.entries}
        />}
        {/* **One render site, always mounted.** Drawn in two places — one for
            the idle row and one for the taken-over row — React unmounts and
            remounts the control on takeover, which drops its state and flips
            it straight back. The shell hides its OWN parts instead. */}
        {composerOffered.length > 0 && (
          <Suspense fallback={null}>
            <ModuleComposerControls
              canvasId={canvasId}
              actor={actor}
              takenOverBy={composerHolder}
              onTakeOver={takeComposer}
            />
          </Suspense>
        )}
        {composerHolder === null && <button className="btn primary" type="submit" title={`Send (${shortcut("⏎")})`} disabled={!draft.trim() || sending.disabled}>
          ↑
        </button>}
      </form>}
    </div>
  );
}

/**
 * A #-referenced item rendered as a card (the Claude-Artifact idiom the issue
 * asks for): what it looks like, its name, what it is — clicking flies you to
 * it, and pointing at it opens the same peek the panel and the rim open,
 * beside the panel, while the item itself lights up on the canvas.
 */
export function ItemCard({ canvasId, itemId, onOpenItem }: { canvasId: string; itemId: string; onOpenItem?: ((id: string) => void) | undefined }) {
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
        onClick={() => (onOpenItem ?? catapultBesidePanel)(itemId)}
        aria-label={`${onOpenItem ? "Open" : "Fly to"} ${item.title}`}
        onPointerEnter={(e) => {
          if (onOpenItem) return;
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
