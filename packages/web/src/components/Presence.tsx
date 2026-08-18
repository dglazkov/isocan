import type { Actor, PresenceSession } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { unreadThreads, useUnreadStore } from "../stores/unreadStore.ts";
import { actorColorIn, useActorColors } from "../lib/colors.ts";
import { quietFor, statusLine } from "../lib/presence.ts";
import { centerOn, threadWorldPos } from "../lib/viewport.ts";

/**
 * Who is on this canvas, top right — and, in the same cluster, who has said
 * something you have not read. Presence and notification are one question to
 * a collaborator ("is anyone here, and did they need me?"), so they share one
 * row of faces: live people in their identity color, anyone who left an
 * unread comment behind dimmed, each badged with what they said.
 *
 * A third state sits between the two: ON CALL — an agent parked on
 * `isocan wait` in a terminal. It is not on this canvas and has no cursor,
 * but it is listening to every canvas in the home, so it wears a dashed ring
 * to say "not here, but you can reach them". That face is the answer to
 * "how do I get the agent onto a space it has never seen?" — @-mention it,
 * or just write in the main thread.
 *
 * Clicking a face takes you to them: to their next unread comment if they
 * left one, otherwise to wherever their cursor is. Double-clicking a live
 * face starts WATCHING them (#39): the camera follows their locus until you
 * pan, zoom, jump, or press Esc — one glance at the facepile instead of
 * hunting the canvas for their cursor.
 */

interface Face {
  actor: Actor;
  /** Their live session, when they have one — the handle follow mode needs. */
  sessionId: string | null;
  /** Presence label if they have a session, else their plain name. */
  label: string;
  live: boolean;
  /** Listening from the home rather than standing on this canvas. */
  onCall: boolean;
  kind: PresenceSession["kind"] | null;
  /** What they are up to, for the tooltip. */
  status: string | null;
  cursor: { x: number; y: number } | null;
  unread: number;
  self: boolean;
}

const MAX_FACES = 5;

export function Presence({ actor }: { actor: Actor }) {
  const colors = useActorColors();
  const canvas = useCanvasStore((s) => s.canvas);
  const sessions = useCanvasStore((s) => s.sessions);
  const seen = useUnreadStore((s) => s.seen);
  const followSessionId = useUiStore((s) => s.followSessionId);
  if (!canvas) return null;

  const pending = unreadThreads(canvas, seen, actor.id);
  const unreadBy = new Map<string, { actor: Actor; count: number }>();
  for (const thread of pending) {
    for (const comment of thread.comments) {
      if (comment.author.id === actor.id) continue;
      const since = seen[thread.id];
      if (since && comment.createdAt <= since) continue;
      const entry = unreadBy.get(comment.author.id);
      if (entry) entry.count += 1;
      else unreadBy.set(comment.author.id, { actor: comment.author, count: 1 });
    }
  }

  // People on the canvas first, then whoever is on call for the home, then
  // whoever only left a comment behind, then you. (The daemon already orders
  // the roster that way and never lists an actor twice.)
  const faces: Face[] = [];
  for (const session of sessions) {
    if (faces.some((face) => face.actor.id === session.actor.id)) continue;
    const onCall = session.scope === "home";
    faces.push({
      actor: session.actor,
      sessionId: session.sessionId,
      label: session.label ?? session.actor.name,
      live: true,
      onCall,
      kind: session.kind,
      status: describe(session) ?? (onCall ? "on call — parked in a terminal" : null),
      cursor: session.cursor,
      unread: unreadBy.get(session.actor.id)?.count ?? 0,
      self: false,
    });
  }
  faces.sort((a, b) => Number(a.onCall) - Number(b.onCall));
  for (const [id, { actor: author, count }] of unreadBy) {
    if (faces.some((face) => face.actor.id === id)) continue;
    faces.push({
      actor: author,
      sessionId: null,
      label: author.name,
      live: false,
      onCall: false,
      kind: null,
      status: "not here — left a comment",
      cursor: null,
      unread: count,
      self: false,
    });
  }
  faces.push({
    actor,
    sessionId: null,
    label: actor.name,
    live: true,
    onCall: false,
    kind: "web",
    status: null,
    cursor: null,
    unread: 0,
    self: true,
  });

  const shown = faces.length > MAX_FACES ? faces.slice(0, MAX_FACES - 1) : faces;
  const overflow = faces.length - shown.length;

  function goTo(face: Face) {
    // Your own face has nowhere to fly to — it is the handle for who you are
    // instead: rename yourself, or come back as someone else (#43).
    if (face.self) {
      const ui = useUiStore.getState();
      ui.setIdentityOpen(!ui.identityOpen);
      return;
    }
    const state = useCanvasStore.getState().canvas;
    if (!state) return;
    const ui = useUiStore.getState();
    // The identity menu lives inside the pile, so a press on another face is
    // not "outside" it — but going to look at someone else is done with it.
    ui.setIdentityOpen(false);
    // Their comment first: it is the thing that wants an answer.
    const next = unreadThreads(state, useUnreadStore.getState().seen, actor.id).find((thread) =>
      thread.comments.some((comment) => comment.author.id === face.actor.id),
    );
    const target = next ? threadWorldPos(state, next) : face.cursor;
    if (!target) return;
    ui.setViewport(centerOn(ui.viewport, target.x, target.y, window.innerWidth, window.innerHeight));
    if (next) ui.setOpenThread(next.id);
  }

  /** Watch them: the camera tracks their locus until the user pans away.
   * An on-call face has no place to watch, and watching yourself is a hall
   * of mirrors. */
  function toggleFollow(face: Face) {
    if (!face.sessionId || face.onCall || face.self) return;
    const ui = useUiStore.getState();
    ui.setFollow(ui.followSessionId === face.sessionId ? null : face.sessionId);
  }

  return (
    <div className="facepile">
      {shown.map((face) => (
        <button
          key={face.actor.id}
          className={`face${face.live ? "" : " away"}${face.onCall ? " oncall" : ""}${
            face.self ? " self" : ""
          }${face.unread > 0 ? " badged" : ""}${
            face.sessionId !== null && face.sessionId === followSessionId ? " followed" : ""
          }`}
          title={tooltip(face)}
          onClick={() => goTo(face)}
          onDoubleClick={() => toggleFollow(face)}
        >
          {/* The disc, not the button, carries the dimming — a badge on an
              absent author still has to read at full strength. */}
          <span className="face-mark" style={{ background: actorColorIn(colors, face.actor.id) }}>
            {initial(face.label)}
          </span>
          {face.unread > 0 && <span className="face-badge">{face.unread}</span>}
        </button>
      ))}
      {overflow > 0 && (
        <span className="face" title={faces.slice(shown.length).map(tooltip).join("\n")}>
          <span className="face-mark face-more">+{overflow}</span>
        </span>
      )}
    </div>
  );
}

function describe(session: PresenceSession): string | null {
  // A quiet agent is still here — say so, and say for how long — but never
  // invent an activity it didn't claim.
  const quiet = quietFor(session);
  const parts = [statusLine(session), quiet && `quiet ${quiet}`].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function tooltip(face: Face): string {
  if (face.self) return `${face.label} (you) · click to rename or switch`;
  const parts = [face.label];
  if (face.kind === "cli") parts.push("terminal");
  if (face.status) parts.push(face.status);
  if (face.unread > 0) parts.push(`${face.unread} new — click to read`);
  else if (face.cursor) parts.push("click to jump to them");
  // An on-call face has nowhere to jump to — say how to reach them instead.
  else if (face.onCall) parts.push(`@${face.label} them, or write in the main thread`);
  if (face.sessionId && !face.onCall && !face.self) parts.push("double-click to watch");
  return parts.join(" · ");
}

/** First character of a label, skipping a leading emoji when there is a word. */
function initial(label: string): string {
  const word = label.trim().split(/\s+/).find((part) => /\p{L}|\p{N}/u.test(part));
  return (word ?? label).charAt(0).toUpperCase();
}
