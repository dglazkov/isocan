import type { Actor } from "@isocan/core";
import { mainThread, sessionState, faceMark} from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUnreadStore } from "../stores/unreadStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { unreadCount, unreadThreads } from "../stores/unreadStore.ts";
import { unreadByAuthor } from "../lib/facepile.ts";
import { facesFor } from "../lib/facepile.ts";
import { actorColorIn, useActorColors } from "../lib/colors.ts";
import { openPanel } from "../lib/panels.ts";
import { AgentsGlyph, ChatGlyph } from "./Glyphs.tsx";
import { useActorMarks } from "../lib/marks.ts";

/**
 * **The rail when it is shut.**
 *
 * Closing the Chat used to leave nothing — a bare edge, and no way to know
 * that anything had happened in there. The two facts worth a permanent 48px
 * are the ones you would otherwise have to open the panel to learn: how much
 * you have not read, and which agents are working right now.
 *
 * **Nothing here is computed a second way.** The unread count is
 * `unreadThreads`, which the facepile and the panel already call; the ring
 * comes from `sessionState`, which is the same reader `isocan who` uses to
 * decide what to print. If the terminal says an agent is working, this ring
 * is on — not because both were written to agree, but because there is one
 * answer and two places show it.
 *
 * A strip that shows you have unread messages and cannot be clicked would be
 * a taunt, so the count opens the Chat and a face opens it too.
 */
export function RailStrip({ canvasId, actor }: { canvasId: string; actor: Actor }) {
  const canvas = useCanvasStore((s) => s.canvas);
  const sessions = useCanvasStore((s) => s.sessions);
  const joined = useCanvasStore((s) => s.actorJoins);
  const seen = useUnreadStore((s) => s.seen);
  const colors = useActorColors();
  const marks = useActorMarks();
  const mainOpen = useUiStore((s) => s.mainPanelOpen);
  const filesOpen = useUiStore((s) => s.filesPanelOpen);

  // The strip IS the shut rail, so it is not drawn beside an open one.
  if (!canvas || mainOpen || filesOpen) return null;

  /**
   * **The Chat's unread, not the canvas's.**
   *
   * The badge sits on the button that opens the Chat, so it has to count the
   * Chat. Summing every thread put comment pins from all over the canvas onto
   * the Chat's badge — a number that says "two waiting for you in here" while
   * the Chat is empty, which is worse than no number.
   *
   * COMMENTS, not threads. There is exactly one Chat, so counting threads
   * would only ever say 0 or 1. The tab title counts threads on purpose and
   * is a different question — "how many conversations want you" across the
   * whole canvas — so the two numbers differ without disagreeing.
   */
  const chat = mainThread(canvas);
  const unread = chat ? unreadCount(chat, seen, actor.id, joined) : 0;
  const unreadBy = unreadByAuthor(
    unreadThreads(canvas, seen, actor.id, joined),
    seen,
    actor.id,
    joined,
  );
  const now = Date.now();

  // Agents only. A person's face belongs in the facepile, which is about who
  // is HERE; this strip is about what is being done to the canvas while you
  // are not looking at the Chat.
  const agents = facesFor(sessions, unreadBy, actor)
    .filter((face) => face.kind === "cli" && !face.self)
    .slice(0, 4);

  const stateOf = (sessionId: string | null) => {
    const session = sessions.find((s) => s.sessionId === sessionId);
    return session ? sessionState(session, canvas, now) : null;
  };

  return (
    <div className="rail-strip floats" aria-label="Chat and agents">
      <button
        className="strip-chat"
        title={unread > 0 ? `Open the Chat — ${unread} unread` : "Open the Chat"}
        aria-label={unread > 0 ? `Open the Chat, ${unread} unread` : "Open the Chat"}
        onClick={() => openPanel(canvasId, "main")}
      >
        <span className="strip-glyph">
          <ChatGlyph />
        </span>
        {unread > 0 && (
          <span className="strip-unread" aria-hidden>
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {/* The tray's standing door (agents-on-demand phase 2.5). The faces
          below only exist while agents are LIVE, which made the tray
          unreachable on exactly the canvas journey 1 starts on — no agents
          yet, and the Add-an-agent gesture behind a door that never appears.
          This button is always there: the room, before anybody is in it. */}
      <button
        className="strip-chat strip-agents"
        title="Agents — who answers here, and Add an agent"
        aria-label="Open the agent tray"
        onClick={() => openPanel(canvasId, "agents")}
      >
        <span className="strip-glyph">
          <AgentsGlyph size={14} />
        </span>
      </button>
      {agents.length > 0 && <div className="strip-sep" />}
      {agents.map((face) => {
        const state = stateOf(face.sessionId);
        return (
          <button
            key={face.actor.id}
            className={`strip-face${state ? ` is-${state}` : ""}`}
            style={{ background: actorColorIn(colors, face.actor.id) }}
            title={face.status ? `${face.label} — ${face.status}` : face.label}
            aria-label={face.label}
            /* The TRAY, not the Chat. A face is a question about what that
               agent is doing, and the tray is where that is answered — sending
               it to the conversation instead was the strip's faces being
               decorative, which is the thing phase 3 was trying to avoid. */
            onClick={() => openPanel(canvasId, "agents")}
          >
            {faceMark(marks, face.actor, face.label)}
          </button>
        );
      })}
    </div>
  );
}
