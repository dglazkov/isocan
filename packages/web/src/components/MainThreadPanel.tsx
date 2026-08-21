import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Actor, Item } from "@isocan/core";
import { mainThread, parseSlashCommand, workedFor } from "@isocan/core";
import { sendOp } from "../lib/api.ts";
import { postToMain } from "../lib/mainthread.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { centerOn } from "../lib/viewport.ts";
import { actorColorIn, useActorColors } from "../lib/colors.ts";
import { useMentionRoster } from "../lib/mentions.ts";
import { useItemRefRoster } from "../lib/itemrefs.ts";
import { rehypeChips } from "../lib/chips.ts";
import { MentionField } from "./MentionField.tsx";
import { ItemPeek, ItemThumb } from "./ItemThumb.tsx";
import { submitOnCmdEnter } from "../lib/submit.ts";
import { markRead } from "../stores/unreadStore.ts";
import { openPanel, storedPanel } from "../lib/panels.ts";
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



/** Must match .main-panel's width in styles.css. */
export const PANEL_WIDTH = 320;

/**
 * What the message is about: the current selection, shown as chips over the
 * composer and sent with the message as ids. The chips ARE the selection —
 * removing one deselects it — so there is one answer to "what am I pointing
 * at" rather than two that can disagree.
 */
function Attached({ projectId }: { projectId: string }) {
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
          <ItemThumb projectId={projectId} itemId={item.id} width={18} height={18} />
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
          projectId={projectId}
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

/** catapultToItem, but centered in the canvas area the panel leaves visible. */
function catapultBesidePanel(itemId: string): void {
  const item = useCanvasStore.getState().canvas?.items[itemId];
  if (!item) return;
  const ui = useUiStore.getState();
  ui.setViewport(
    centerOn(
      ui.viewport,
      item.x + item.width / 2,
      item.y + item.height / 2,
      window.innerWidth + PANEL_WIDTH,
      window.innerHeight,
    ),
  );
  ui.select(item.id);
}

/** Open/close the panel and remember the choice per project. The left dock
 * holds one panel at a time; opening this one puts the files away. */
export function openMainPanel(projectId: string, open: boolean): void {
  openPanel(projectId, open ? "main" : null);
}

export function MainThreadPanel({ projectId, actor }: { projectId: string; actor: Actor }) {
  const canvas = useCanvasStore((s) => s.canvas);
  const open = useUiStore((s) => s.mainPanelOpen);

  // First snapshot decides the default: open when a main thread already
  // exists (someone designated this channel), closed on a virgin canvas.
  // A stored preference from an earlier visit wins either way.
  const initedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!canvas || initedFor.current === projectId) return;
    initedFor.current = projectId;
    const stored = storedPanel(projectId);
    // Never chosen here: a canvas that already has a main thread opens with it.
    openPanel(projectId, stored === undefined ? (mainThread(canvas) ? "main" : null) : stored);
  }, [canvas, projectId]);

  // Closed, the panel has no surface of its own — its toggle (wearing the
  // unread badge) is the "Main" button in the top bar's create actions.
  if (!canvas || !open) return null;
  return <Panel projectId={projectId} actor={actor} />;
}

function Panel({ projectId, actor }: { projectId: string; actor: Actor }) {
  // A subscription, not a read: the chips have to appear and vanish as the
  // selection changes under the pointer.
  const selected = useUiStore((s) => s.selectedItemIds);
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
  const commentCount = thread?.comments.length ?? 0;
  useEffect(() => {
    if (thread) markRead(thread.id);
  }, [thread?.id, commentCount]);

  // Chat scroll: pinned to the newest message as they arrive.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread?.id, commentCount]);

  if (!canvas) return null; // reconnecting — parent unmounts us next render

  async function send(body: string, attached: string[]) {
    await postToMain(projectId, actor, body, attached);
  }

  function chipTarget(e: { target: EventTarget }): string | null {
    return (e.target as HTMLElement).closest("[data-item-id]")?.getAttribute("data-item-id") ?? null;
  }

  return (
    <div className="main-panel" onPointerDown={(e) => e.stopPropagation()}>
      <header>
        <span className="main-glyph">✳</span>
        <b>Main thread</b>
        <span className="spacer" />
        {thread && (
          <button
            className="main-detach"
            title="Demote back to a canvas pin"
            onClick={() => sendOp(projectId, actor, { type: "thread.setMain", threadId: null })}
          >
            detach
          </button>
        )}
        <button
          className="main-close"
          title="Collapse"
          onClick={() => openMainPanel(projectId, false)}
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
              The canvas's direct channel. Everything here reaches every
              collaborator — agents included, no @-mention needed. Items you
              #-reference show up as cards.
            </div>
          )}
          {thread?.comments.map((comment) => (
            <div className="comment" key={comment.id}>
              <span className="who" style={{ color: actorColorIn(colors, comment.author.id) }}>
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
              {(comment.items ?? [])
                .filter((id, i, all) => all.indexOf(id) === i)
                .map((itemId) => (
                  <ItemCard key={itemId} projectId={projectId} itemId={itemId} />
                ))}
            </div>
          ))}
        </div>
      </div>
      <form
        onKeyDown={submitOnCmdEnter}
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
        <Attached projectId={projectId} />
        <MentionField
          placeholder={selected.length > 0 ? "What should happen to these?" : "Message the canvas…"}
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
function ItemCard({ projectId, itemId }: { projectId: string; itemId: string }) {
  const item = useCanvasStore((s) => s.canvas?.items[itemId]);
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
        <ItemThumb projectId={projectId} itemId={itemId} width={44} height={34} />
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
          projectId={projectId}
          itemId={itemId}
          // Beside the panel, centred on the card, never off the window it is
          // meant to be read on — the files panel's peek, in the other panel.
          style={{
            left: PANEL_WIDTH + 10,
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
