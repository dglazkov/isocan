import { useEffect, useMemo, useRef, useState } from "react";
import type { Actor } from "@isocan/core";
import { mainThread } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { markRead } from "../stores/unreadStore.ts";
import { actorColorIn, useActorColors } from "../lib/colors.ts";
import { listeningAgents, postToMain } from "../lib/mainthread.ts";
import { actorNameIn, useActorNames } from "../lib/names.ts";
import { useMentionRoster } from "../lib/mentions.ts";
import { useItemRefRoster } from "../lib/itemrefs.ts";
import { MentionField } from "./MentionField.tsx";
import { submitOnCmdEnter } from "../lib/submit.ts";
import { runLocalCommand } from "../lib/localcommands.ts";
import { useCommands } from "../lib/commands.ts";

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
 *
 * It composes with the same field the panel and the pins use, so @, # and /
 * complete here too. They have to: this bar's placeholder has been promising
 * "@name to address · #Title to point" while offering no way to find either.
 */
export function CommandBar({ projectId, actor }: { projectId: string; actor: Actor }) {
  const colors = useActorColors();
  const names = useActorNames();
  const open = useUiStore((s) => s.commandBarOpen);
  const setOpen = useUiStore((s) => s.setCommandBarOpen);
  const canvas = useCanvasStore((s) => s.canvas);
  const sessions = useCanvasStore((s) => s.sessions);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const { candidates, peers } = useMentionRoster(actor.id);
  // The bar, not the field: Escape has to close it from anywhere inside, and
  // after a send the focus is no longer in the field.
  const barRef = useRef<HTMLDivElement>(null);
  const itemRoster = useItemRefRoster();
  const commands = useCommands();

  const thread = canvas ? mainThread(canvas) : null;
  const agents = useMemo(() => listeningAgents(sessions), [sessions]);
  // Newest last — the tail of the conversation, so a reply lands in view.
  const recent = thread ? thread.comments.slice(-4) : [];

  // Focus is the field's own affair now (autoFocus), and it has to be: the
  // field is remounted by the bar opening, not merely revealed.

  // Opening the bar is reading the channel — clear its unread, like the panel.
  useEffect(() => {
    if (open && thread) markRead(thread.id);
  }, [open, thread?.id, thread?.comments.length]);

  if (!open || !canvas) return null;

  async function submit() {
    const body = draft.trim();
    if (!body || sending) return;
    if (runLocalCommand(body, commands)) {
      setDraft("");
      setOpen(false); // the bar hands over to the panel it opened
      return;
    }
    setSending(true);
    try {
      // The same rule as the docked panel: what you have selected is what the
      // message is about, and it travels as ids.
      await postToMain(projectId, actor, body, useUiStore.getState().selectedItemIds);
      setDraft("");
    } finally {
      setSending(false);
      // Sending one message usually means sending another. The field is not
      // ours to hold a ref to, so ask the bar for it.
      barRef.current?.querySelector("input")?.focus();
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
        ref={barRef}
        role="dialog"
        aria-label="Message your emissary"
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          // The field eats these while its menu is open — Enter completes a
          // name, Escape shuts the menu. Only what it did NOT take gets to
          // close the bar. Handled here rather than on the form so it still
          // works when the focus has moved on after a send.
          if (e.defaultPrevented) return;
          if (e.key === "Escape") {
            e.preventDefault();
            setOpen(false);
          }
        }}
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
                <span className="cmdbar-author" style={{ color: actorColorIn(colors, c.author.id) }}>
                  {actorNameIn(names, c.author)}
                </span>
                <span className="cmdbar-body">{c.body}</span>
              </div>
            ))}
          </div>
        )}

        <form
          className="cmdbar-form"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          onKeyDown={(e) => {
            if (e.defaultPrevented) return; // the menu took it
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            } else {
              submitOnCmdEnter(e);
            }
          }}
        >
          <MentionField
            autoFocus
            placeholder="Message your emissary…  (@name to address · #Title to point · / for a command)"
            value={draft}
            onChange={setDraft}
            candidates={candidates}
            peers={peers}
            itemCandidates={itemRoster.candidates}
            items={itemRoster.entries}
          />
        </form>
      </div>
    </div>
  );
}
