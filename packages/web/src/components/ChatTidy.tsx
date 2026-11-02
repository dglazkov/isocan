import "./chat-tidy.css";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Actor, Comment, CommentThread } from "@isocan/core";
import { atLeast, isSystemActor, mainThread, newGroupId, ownsCanvas } from "@isocan/core";
// A subpath, not the barrel: through the barrel it became a shared chunk that
// every lazy import naming core listed, and the entry paid for the list.
import {
  cleanupNoun,
  cleanupOps,
  cleanupSelection,
  mayRemoveComment,
  parseBefore,
  removableComment,
  type CommentFilter,
} from "@isocan/core/chatclean";
import { sendEchoedResult, useCanvasStore } from "../stores/canvasStore.ts";
import { undo } from "../lib/api.ts";
import { actorNameIn } from "../lib/names.ts";

/**
 * **Cleaning up the Chat** (24 Sep 2026) — lazy, because the panel it lives in
 * is on the entry chunk and this is a gesture most visits never make.
 *
 * Two controls, one rule. A ✕ on a message you may remove (your own; anybody's
 * if you own the canvas), and — for the owner — a "Clean up" menu in the
 * Chat's header that takes many at once: the system voice's notices, one
 * person's messages, everything before a day, or the lot. Each asks with the
 * count first, sends ONE group (`cleanupOps`, in core, the ops
 * `isocan comment clean` sends), and then offers Undo, which is the same ⌘Z
 * that walks the rest of your history.
 *
 * The panel renders this as a sibling that draws nothing where it stands:
 * every piece of it is portalled into the panel it finds itself in — the ⋯
 * into the header, the menu and the notice over the messages, the ✕ into
 * whichever message the pointer or the focus is on. Drawn by the panel
 * instead, a button per message and a header slot would have been bytes on
 * the entry chunk for a gesture most visits never make. A message is found
 * by its place among `.main-msgs`'s `.comment` rows, which is its place in
 * the thread: the panel renders one row per comment, in order.
 *
 * The home decides. Who owns is asked here only to choose what to OFFER; a
 * removal this tab thinks is allowed and the home does not comes back refused,
 * and the notice says the home's sentence.
 */
export default function ChatTidy({ canvasId, actor }: { canvasId: string; actor: Actor }) {
  const canvas = useCanvasStore((s) => s.canvas);
  const record = useCanvasStore((s) => s.record);
  const capability = useCanvasStore((s) => s.capability);
  const joins = useCanvasStore((s) => s.actorJoins);
  const names = useCanvasStore((s) => s.actorNames);
  const thread = canvas ? mainThread(canvas) : null;
  const owner = (record !== null && ownsCanvas(record, actor.id, joins)) || atLeast(capability, "own");
  const anchor = useRef<HTMLSpanElement>(null);
  const [panel, setPanel] = useState<HTMLElement | null>(null);
  const [menu, setMenu] = useState(false);
  const [notice, setNotice] = useState<{ text: string; undo: boolean } | null>(null);
  const [hover, setHover] = useState<{ el: HTMLElement; index: number } | null>(null);

  useLayoutEffect(() => setPanel(anchor.current?.closest<HTMLElement>(".main-panel") ?? null), []);

  // The ✕ follows the pointer and the focus through the messages.
  useEffect(() => {
    const scroll = panel?.querySelector<HTMLElement>(".main-scroll");
    if (!scroll) return;
    const over = (e: Event) => {
      const el = (e.target as HTMLElement).closest?.<HTMLElement>(".main-msgs > .comment");
      if (!el) return;
      const rows = [...el.parentElement!.children].filter((row) => row.classList.contains("comment"));
      setHover({ el, index: rows.indexOf(el) });
    };
    const leave = () => setHover(null);
    scroll.addEventListener("pointerover", over);
    scroll.addEventListener("focusin", over);
    scroll.addEventListener("pointerleave", leave);
    return () => {
      scroll.removeEventListener("pointerover", over);
      scroll.removeEventListener("focusin", over);
      scroll.removeEventListener("pointerleave", leave);
    };
  }, [panel]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 10_000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function remove(target: CommentThread, ids: string[], said: string): Promise<void> {
    const ops = cleanupOps(target, ids);
    if (ops.length === 0) return;
    // Sent together, not one round trip at a time: thirty-seven notices
    // trickling out of the Chat one by one read as something going wrong.
    // Order does not matter to undo — each removal's inverse is taken against
    // the state it met, and the group is undone newest first.
    const group = newGroupId();
    const receipts = await Promise.all(ops.map((op) => sendEchoedResult(canvasId, actor, op, group)));
    const refused = receipts.find((receipt) => receipt.status === "refused");
    if (refused) setNotice({ text: refused.message ?? "The home refused that removal.", undo: receipts.some((r) => r.status !== "refused") });
    else setNotice({ text: said, undo: true });
  }

  const hovered = hover?.el.isConnected && thread ? thread.comments[hover.index] : undefined;
  const removable = hovered && removableComment(hovered) && mayRemoveComment(hovered, actor.id, owner, joins);
  const head = panel?.querySelector<HTMLElement>(".panel-head") ?? null;

  return (
    <span ref={anchor} className="chat-tidy" hidden>
      {owner && thread && head &&
        createPortal(
          <button
            type="button"
            className="main-close chat-tidy-open"
            title="Clean up the Chat"
            aria-label="Clean up the Chat"
            aria-expanded={menu}
            onClick={() => setMenu((open) => !open)}
          >
            ⋯
          </button>,
          head,
        )}
      {menu && owner && thread && panel &&
        createPortal(
          <CleanupMenu
            thread={thread}
            actor={actor}
            joins={joins}
            nameOf={(c) => actorNameIn(names, c.author)}
            onClose={() => setMenu(false)}
            onRemove={(ids, noun) => {
              setMenu(false);
              void remove(thread, ids, `Removed ${noun} from the Chat.`);
            }}
          />,
          panel,
        )}
      {removable && thread &&
        createPortal(
          <button
            type="button"
            className="chat-tidy-rm"
            title="Remove from the Chat — Undo brings it back"
            aria-label="Remove this message"
            onClick={() => {
              setHover(null);
              void remove(thread, [hovered!.id], "Message removed from the Chat.");
            }}
          >
            ✕
          </button>,
          hover!.el,
        )}
      {notice && panel &&
        createPortal(
          <div className="chat-tidy-notice" role="status">
            <span>{notice.text}</span>
            {notice.undo && (
              <button
                type="button"
                onClick={() => {
                  setNotice(null);
                  undo(canvasId, actor).catch((err: Error) => setNotice({ text: err.message, undo: false }));
                }}
              >
                Undo
              </button>
            )}
          </div>,
          panel,
        )}
    </span>
  );
}

type Choice = { filter: CommentFilter; label?: string };

/** The owner's menu: pick what to take, see how many, then say yes. */
function CleanupMenu({
  thread,
  actor,
  joins,
  nameOf,
  onClose,
  onRemove,
}: {
  thread: CommentThread;
  actor: Actor;
  joins: Record<string, string>;
  nameOf: (c: Comment) => string;
  onClose: () => void;
  onRemove: (ids: string[], noun: string) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [asking, setAsking] = useState<Choice | null>(null);
  const [sub, setSub] = useState<"from" | "before" | null>(null);
  const [day, setDay] = useState("");
  const take = (filter: CommentFilter) => cleanupSelection(thread, filter, actor.id, true, joins);

  // Who has spoken here, most messages first — the "from" list.
  const authors = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; count: number }>();
    for (const c of thread.comments) {
      if (!removableComment(c)) continue;
      const row = seen.get(c.author.id) ?? { id: c.author.id, name: isSystemActor(c.author.id) ? `⚙ ${c.author.name}` : nameOf(c), count: 0 };
      row.count++;
      seen.set(c.author.id, row);
    }
    return [...seen.values()].sort((a, b) => b.count - a.count);
  }, [thread, nameOf]);

  useEffect(() => {
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node) && !(e.target as HTMLElement).closest?.(".chat-tidy-open")) onClose();
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [onClose]);

  if (asking) {
    const ids = take(asking.filter).map((c) => c.id);
    const noun = cleanupNoun(asking.filter, ids.length, asking.label);
    return (
      <div ref={box} className="chat-tidy-menu" role="dialog" aria-label="Confirm clean-up">
        <p className="chat-tidy-ask">Remove {noun}?</p>
        <p className="chat-tidy-small">
          {ids.length === thread.comments.length
            ? "That is every message: the Chat starts fresh with the next one. "
            : "They leave the Chat for everyone here. "}
          Undo brings them back; the canvas's history keeps them either way.
        </p>
        <div className="chat-tidy-row">
          <button type="button" className="btn" onClick={() => setAsking(null)}>
            Back
          </button>
          <button type="button" className="btn danger" disabled={ids.length === 0} onClick={() => onRemove(ids, noun)} autoFocus>
            Remove {ids.length}
          </button>
        </div>
      </div>
    );
  }

  const system = take({ kind: "system" }).length;
  const all = take({ kind: "all" }).length;
  const before = parseBefore(day);
  const earlier = before ? take({ kind: "before", before }).length : 0;
  return (
    <div ref={box} className="chat-tidy-menu" role="menu" aria-label="Clean up the Chat">
      <p className="chat-tidy-head">Clean up</p>
      <button type="button" role="menuitem" disabled={system === 0} onClick={() => setAsking({ filter: { kind: "system" } })}>
        Remove system notices <span className="chat-tidy-n">{system}</span>
      </button>
      <button type="button" role="menuitem" aria-expanded={sub === "from"} onClick={() => setSub(sub === "from" ? null : "from")}>
        Remove messages from…
      </button>
      {sub === "from" && (
        <div className="chat-tidy-sub">
          {authors.map((a) => (
            <button key={a.id} type="button" role="menuitem" onClick={() => setAsking({ filter: { kind: "from", actorId: a.id }, label: a.name })}>
              {a.name} <span className="chat-tidy-n">{a.count}</span>
            </button>
          ))}
        </div>
      )}
      <button type="button" role="menuitem" aria-expanded={sub === "before"} onClick={() => setSub(sub === "before" ? null : "before")}>
        Remove everything before…
      </button>
      {sub === "before" && (
        <div className="chat-tidy-sub chat-tidy-row">
          <input type="date" aria-label="Remove messages posted before this day" value={day} onChange={(e) => setDay(e.target.value)} />
          <button type="button" className="btn" disabled={earlier === 0} onClick={() => before && setAsking({ filter: { kind: "before", before }, label: day })}>
            {earlier} earlier
          </button>
        </div>
      )}
      <button type="button" role="menuitem" className="chat-tidy-danger" disabled={all === 0} onClick={() => setAsking({ filter: { kind: "all" } })}>
        Clear the whole Chat <span className="chat-tidy-n">{all}</span>
      </button>
    </div>
  );
}
