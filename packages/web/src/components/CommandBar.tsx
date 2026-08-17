import { useEffect, useMemo, useRef, useState } from "react";
import type { Actor } from "@isocan/core";
import { mainThread } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { markRead } from "../stores/unreadStore.ts";
import { actorColor } from "../lib/colors.ts";
import { listeningAgents, postToMain } from "../lib/mainthread.ts";

/**
 * The friction-free lane (⌘K): a floating bar to talk to your emissary from
 * anywhere on the canvas. What you type posts to the main thread, which wakes
 * a parked agent's `isocan wait` — the same channel as the docked panel, but a
 * keystroke away and with no panel to open.
 *
 * It reads as addressing a partner, not driving a tool: it names who is
 * listening before you send, shows their replies inline as they land, and
 * treats an empty room as "nobody's here yet" rather than an error — your
 * message simply waits on the thread for the next agent to park.
 */
export function CommandBar({ projectId, actor }: { projectId: string; actor: Actor }) {
  const open = useUiStore((s) => s.commandBarOpen);
  const setOpen = useUiStore((s) => s.setCommandBarOpen);
  const canvas = useCanvasStore((s) => s.canvas);
  const sessions = useCanvasStore((s) => s.sessions);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const thread = canvas ? mainThread(canvas) : null;
  const agents = useMemo(() => listeningAgents(sessions), [sessions]);
  // Newest last — the tail of the conversation, so a reply lands in view.
  const recent = thread ? thread.comments.slice(-4) : [];

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Opening the bar is reading the channel — clear its unread, like the panel.
  useEffect(() => {
    if (open && thread) markRead(thread.id);
  }, [open, thread?.id, thread?.comments.length]);

  if (!open || !canvas) return null;

  async function submit() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await postToMain(projectId, actor, body);
      setDraft("");
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  const listening =
    agents.length === 0
      ? null
      : agents.map((a) => a.label ?? a.actor.name).join(", ");

  return (
    <div className="cmdbar-backdrop" onPointerDown={() => setOpen(false)}>
      <div
        className="cmdbar"
        role="dialog"
        aria-label="Message your emissary"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className={`cmdbar-listening${listening ? " live" : ""}`}>
          {listening ? (
            <>
              <span className="cmdbar-dot" />
              {listening} {agents.length > 1 ? "are" : "is"} listening
            </>
          ) : (
            <>No emissary parked — your message waits on the thread for one.</>
          )}
        </div>

        {recent.length > 0 && (
          <div className="cmdbar-thread">
            {recent.map((c) => (
              <div key={c.id} className="cmdbar-msg">
                <span className="cmdbar-author" style={{ color: actorColor(c.author.id) }}>
                  {c.author.name}
                </span>
                <span className="cmdbar-body">{c.body}</span>
              </div>
            ))}
          </div>
        )}

        <input
          ref={inputRef}
          className="cmdbar-input"
          placeholder="Message your emissary…  (@name to address · #Title to point)"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              setOpen(false);
            }
          }}
        />
      </div>
    </div>
  );
}
