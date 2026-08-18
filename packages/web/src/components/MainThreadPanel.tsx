import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Actor, Item } from "@isocan/core";
import { mainThread } from "@isocan/core";
import { sendOp } from "../lib/api.ts";
import { postToMain } from "../lib/mainthread.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { centerOn } from "../lib/viewport.ts";
import { actorColor } from "../lib/colors.ts";
import { useMentionRoster } from "../lib/mentions.ts";
import { useItemRefRoster } from "../lib/itemrefs.ts";
import { rehypeChips } from "../lib/chips.ts";
import { MentionField } from "./MentionField.tsx";
import { markRead } from "../stores/unreadStore.ts";

/**
 * The designated main thread (#36): one thread per canvas rendered as a
 * docked agent-chat panel on the left instead of a pin. It exists before its
 * thread does — the first message creates the thread with `main: true` — and
 * any thread can be promoted into it ("Make main" on a popover, or
 * `isocan comment main`). Agents always wake on comments landing here.
 */

const openKey = (projectId: string) => `isocan.mainpanel.${projectId}`;

/** Must match .main-panel's width in styles.css. */
export const PANEL_WIDTH = 320;

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

/** Open/close the panel and remember the choice per project. */
export function openMainPanel(projectId: string, open: boolean): void {
  try {
    localStorage.setItem(openKey(projectId), open ? "open" : "closed");
  } catch {
    // Private mode — the panel still works, it just forgets.
  }
  useUiStore.getState().setMainPanelOpen(open);
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
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(openKey(projectId));
    } catch {
      // ignore
    }
    useUiStore
      .getState()
      .setMainPanelOpen(stored ? stored === "open" : mainThread(canvas) !== null);
  }, [canvas, projectId]);

  // Closed, the panel has no surface of its own — its toggle (wearing the
  // unread badge) is the "Main" button in the top bar's create actions.
  if (!canvas || !open) return null;
  return <Panel projectId={projectId} actor={actor} />;
}

function Panel({ projectId, actor }: { projectId: string; actor: Actor }) {
  const canvas = useCanvasStore((s) => s.canvas);
  const thread = canvas ? mainThread(canvas) : null;
  const [draft, setDraft] = useState("");
  const { candidates, peers } = useMentionRoster(actor.id);
  const itemRoster = useItemRefRoster();
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

  async function send(body: string) {
    await postToMain(projectId, actor, body);
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
              <span className="who" style={{ color: actorColor(comment.author.id) }}>
                {comment.author.name}
              </span>
              <span className="when">{new Date(comment.createdAt).toLocaleString()}</span>
              <div className="body">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={chips}>
                  {comment.body}
                </ReactMarkdown>
              </div>
              {(comment.items ?? [])
                .filter((id, i, all) => all.indexOf(id) === i)
                .map((itemId) => (
                  <ItemCard key={itemId} itemId={itemId} />
                ))}
            </div>
          ))}
        </div>
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const body = draft.trim();
          if (!body) return;
          setDraft("");
          await send(body);
        }}
      >
        <MentionField
          placeholder="Message the canvas…"
          value={draft}
          onChange={setDraft}
          candidates={candidates}
          peers={peers}
          itemCandidates={itemRoster.candidates}
          items={itemRoster.entries}
        />
        <button className="btn primary" type="submit" disabled={!draft.trim()}>
          ↑
        </button>
      </form>
    </div>
  );
}

/**
 * A #-referenced item rendered as a card (the Claude-Artifact idiom the
 * issue asks for): glyph, title, what it is — clicking flies you to it.
 */
function ItemCard({ itemId }: { itemId: string }) {
  const item = useCanvasStore((s) => s.canvas?.items[itemId]);
  if (!item) {
    return (
      <div className="mt-card gone">
        <span className="mt-glyph">▦</span>
        <span className="mt-title">No longer on the canvas</span>
      </div>
    );
  }
  return (
    <button className="mt-card" onClick={() => catapultBesidePanel(itemId)} title="Fly to this item">
      <span className="mt-glyph">▦</span>
      <span className="mt-text">
        <span className="mt-title">{item.title}</span>
        <span className="mt-meta">
          {kindOf(item)}
          {item.versions.length > 1 ? ` · v${item.versions.length}` : ""}
        </span>
      </span>
      <span className="mt-go">➜</span>
    </button>
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
