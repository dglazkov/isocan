import "./chat-bar.css";
import { useEffect, useRef, type FocusEvent, type KeyboardEvent, type PointerEvent } from "react";
import type { Actor } from "@isocan/core";
import { mainThread } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { markRead, unreadCount, useUnreadStore } from "../stores/unreadStore.ts";
import { chatHiddenNow } from "../lib/panels.ts";
import { barPreview, dragChat, placeChat } from "../lib/chatmove.ts";
import { MainThreadBody } from "./MainThreadPanel.tsx";
import { ChatHandle } from "./ChatHandle.tsx";

/**
 * **Where the Chat is, and the way to move it** — the one lazy door
 * `CanvasPage` mounts beside the dock. At the bottom it is the bar; on the
 * left it is the docked Chat's Move button and header drag. A pane that owns
 * the conversation (`?embed=1`) gets neither.
 */
export default function ChatPlace({ canvasId, actor }: { canvasId: string; actor: Actor }) {
  const at = useUiStore((s) => s.chatAt);
  if (chatHiddenNow()) return null;
  return at === "bottom" ? <ChatBar canvasId={canvasId} actor={actor} /> : <ChatHandle canvasId={canvasId} />;
}

/**
 * **The Chat as a bar at the bottom of the canvas** — the viewer chose it by
 * dragging the Chat's header there, or with its Move button (`chatplace.ts`).
 *
 * Minimized it is the composer and nothing else, so the canvas keeps its whole
 * width; open, the messages stand above the composer in the same bar. Both are
 * `MainThreadBody` — the Chat itself, not a copy — so chips, @mentions and
 * design tasks behave exactly as they do in the dock.
 *
 * Lazy, CSS and all: a viewer who keeps the Chat on the left never fetches it.
 */
function ChatBar({ canvasId, actor }: { canvasId: string; actor: Actor }) {
  const canvas = useCanvasStore((s) => s.canvas);
  const joined = useCanvasStore((s) => s.actorJoins);
  const seen = useUnreadStore((s) => s.seen);
  const open = useUiStore((s) => s.chatBarOpen);
  const ref = useRef<HTMLDivElement>(null);
  const setOpen = (chatBarOpen: boolean) => useUiStore.setState({ chatBarOpen });
  const chat = canvas ? mainThread(canvas) : null;
  const count = chat?.comments.length ?? 0;

  // Opened from anywhere — ▴, ⌘J, a toast — and the caret is in the field;
  // put down, and the keys go back to the canvas.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const inside = el.contains(document.activeElement);
    if (open && !inside) el.querySelector<HTMLElement>("form textarea, form input")?.focus();
    if (!open && inside) (document.activeElement as HTMLElement).blur();
    // Open, the newest is in view: the list was not laid out while it was down.
    const list = el.querySelector(".main-scroll");
    if (open && list) list.scrollTop = list.scrollHeight;
  }, [open]);

  // The panel is undocked here, so the bar decides what has been read: what
  // lands while it is open is read, and what lands while it is down is counted.
  useEffect(() => {
    if (open && chat) markRead(chat.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, chat?.id, count]);

  // ⌘J opens and minimizes the bar. Caught on the way down, ahead of the
  // canvas's own ⌘J, which would otherwise reach for the dock.
  useEffect(() => {
    const key = (e: globalThis.KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "j") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      setOpen(!useUiStore.getState().chatBarOpen);
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, []);

  if (!canvas) return null;
  const unread = chat && !open ? unreadCount(chat, seen, actor.id, joined) : 0;
  const preview = barPreview(chat?.comments, unread, actor.id);

  const controls = (
    <div className="chat-bar-controls">
      <span className="chat-bar-grip" title="Drag to move the Chat" aria-hidden>
        ⠿
      </span>
      <button
        type="button"
        className="chat-bar-btn"
        title={open ? "Minimize the Chat (Esc)" : "Show the messages"}
        aria-label={open ? "Minimize the Chat" : "Show the Chat's messages"}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {/* ▴ / ▾, drawn: the text glyphs are a few pixels tall at this size. */}
        <svg viewBox="0 0 16 16" width={14} height={14} aria-hidden fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
          <path d={open ? "M4 6.5l4 4 4-4" : "M4 9.5l4-4 4 4"} />
        </svg>
      </button>
      <button
        type="button"
        className="chat-bar-btn"
        title="Dock on the left"
        aria-label="Dock the Chat on the left"
        onClick={() => placeChat(canvasId, "left")}
      >
        <svg viewBox="0 0 16 16" width={13} height={13} aria-hidden fill="none" stroke="currentColor" strokeWidth={1.5}>
          <rect x="1.5" y="2.5" width="13" height="11" rx="2" />
          <path d="M5 5.5v5" />
        </svg>
      </button>
    </div>
  );

  return (
    <div
      ref={ref}
      className={`chat-bar floats${open ? " open" : ""}`}
      role="region"
      aria-label="Chat"
      onFocus={(e: FocusEvent) => {
        if ((e.target as Element).matches("textarea, input")) setOpen(true);
      }}
      onKeyDown={(e: KeyboardEvent) => {
        // The mention menu takes Esc first, and says so by preventing it.
        if (e.key !== "Escape" || e.defaultPrevented || !open) return;
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      }}
      // Capture: the Chat stops its own presses from reaching the canvas, so
      // the bar has to see them on the way down.
      onPointerDownCapture={(e: PointerEvent<HTMLElement>) => {
        // The bar's own surface is its header: anything you can type in,
        // press or read is left alone.
        if (e.button !== 0) return;
        if ((e.target as Element).closest("button, a, textarea, input, select, .main-scroll, .mention-backdrop")) return;
        e.preventDefault();
        dragChat(canvasId, { x: e.clientX, y: e.clientY }, ref.current);
      }}
    >
      {preview && (
        <button type="button" className="chat-bar-news" onClick={() => setOpen(true)} title="Show the messages">
          <span className="chat-bar-unread">{unread > 99 ? "99+" : unread}</span>
          <span className="chat-bar-preview">{preview}</span>
        </button>
      )}
      <MainThreadBody canvasId={canvasId} actor={actor} docked={false} />
      {controls}
    </div>
  );
}
