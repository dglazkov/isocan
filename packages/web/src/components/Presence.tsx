import { useState } from "react";
import type { Actor, ActivityEntry, PresenceSession, ActorMarks} from "@isocan/core";
import { atLeast, capabilityWord, elapsedLabel, recentActivity, sameActor } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { unreadThreads, useUnreadStore } from "../stores/unreadStore.ts";
import { actorColorIn, useActorColors } from "../lib/colors.ts";
import { faceMarkClass, faceMarkStyle } from "../lib/face.ts";
import { actorNameIn, useActorNames } from "../lib/names.ts";
import { describe, facesFor, unreadByAuthor, type Face } from "../lib/facepile.ts";
import { centerOn, threadWorldPos } from "../lib/viewport.ts";
import { useActorMarks } from "../lib/marks.ts";

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

const MAX_FACES = 5;

export function Presence({ actor }: { actor: Actor }) {
  const colors = useActorColors();
  const marks = useActorMarks();
  const names = useActorNames();
  // Which face the pointer is on. Not per-face hover state: see the row.
  const [peek, setPeek] = useState<string | null>(null);
  const canvas = useCanvasStore((s) => s.canvas);
  const sessions = useCanvasStore((s) => s.sessions);
  const joined = useCanvasStore((s) => s.actorJoins);
  const seen = useUnreadStore((s) => s.seen);
  const followSessionId = useUiStore((s) => s.followSessionId);
  if (!canvas) return null;

  const pending = unreadThreads(canvas, seen, actor.id, joined);
  const unreadBy = unreadByAuthor(pending, seen, actor.id, joined);
  // One entry per PERSON, you included — see lib/facepile.ts for why that is
  // a rule and not a preference.
  const faces = facesFor(sessions, unreadBy, actor);

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
    const live = useCanvasStore.getState().actorJoins;
    const next = unreadThreads(state, useUnreadStore.getState().seen, actor.id, live).find(
      (thread) =>
        thread.comments.some((comment) => sameActor(live, comment.author.id, face.actor.id)),
    );
    const target = next ? threadWorldPos(state, next) : face.cursor;
    if (!target) return;
    ui.setViewport(centerOn(ui.viewport, target.x, target.y, window.innerWidth, window.innerHeight));
    if (next) ui.setOpenThread(next.id);
  }

  /** Watch them: the camera tracks their locus until the user pans away.
   * Watching yourself is a hall of mirrors. */
  function toggleFollow(face: Face) {
    if (!face.sessionId || face.self) return;
    const ui = useUiStore.getState();
    ui.setFollow(ui.followSessionId === face.sessionId ? null : face.sessionId);
  }

  const peeked = shown.find((face) => face.actor.id === peek) ?? null;

  return (
    <div
      className="facepile"
      // Tracked on the ROW rather than per face: the faces sit shoulder to
      // shoulder, and per-face enter/leave pairs interleave and cancel. The
      // card is inside this element, so moving onto it is not leaving.
      onPointerMove={(e) => {
        const button = (e.target as HTMLElement).closest?.("[data-face-id]");
        const id = button?.getAttribute("data-face-id") ?? null;
        if (id && id !== peek) setPeek(id);
      }}
      onPointerLeave={() => setPeek(null)}
    >
      {shown.map((face) => (
        <button
          key={face.actor.id}
          data-face-id={face.actor.id}
          className={`face ${face.presence}${
            face.self ? " self" : ""
          }${face.unread > 0 ? " badged" : ""}${
            face.sessionId !== null && face.sessionId === followSessionId ? " followed" : ""
          }`}
          aria-label={tooltip(face)}
          onClick={() => goTo(face)}
          onDoubleClick={() => toggleFollow(face)}
        >
          {/* The disc, not the button, carries the dimming — a badge on an
              absent author still has to read at full strength. */}
          <span className={faceMarkClass(marks, face.actor)} style={faceMarkStyle(colors, face.actor)}>
            {initial(face.label, marks, face.actor)}
          </span>
          {face.unread > 0 && <span className="face-badge">{face.unread}</span>}
        </button>
      ))}
      {overflow > 0 && (
        <span className="face" title={faces.slice(shown.length).map(tooltip).join("\n")}>
          <span className="face-mark face-more">+{overflow}</span>
        </span>
      )}
      {peeked && <FaceCard face={peeked} names={names} colors={colors} onGo={goTo} />}
    </div>
  );
}

/**
 * Who this is, what they are doing, and what they have been doing — under the
 * face, in the card the rest of the canvas peeks with.
 *
 * The status line is the live half and the activity list is the remembered
 * half, and both are worth more than the name alone: a facepile tells you
 * somebody is here, and the next thing you want to know is whether they have
 * been anywhere near what you are working on. Every row is a way to go there.
 */
function FaceCard({
  face,
  names,
  colors,
  onGo,
}: {
  face: Face;
  names: ReturnType<typeof useActorNames>;
  colors: ReturnType<typeof useActorColors>;
  onGo: (face: Face) => void;
}) {
  const canvas = useCanvasStore((s) => s.canvas);
  const marks = useActorMarks();
  const recent = canvas ? recentActivity(canvas, face.actor.id, 5) : [];
  // Stamped once per open: "4m ago" that re-renders into "4m ago" is noise,
  // and the card does not live long enough for the number to go stale.
  const now = new Date().toISOString();
  const name = actorNameIn(names, face.actor);
  return (
    <div className="hover-card face-card" onPointerDown={(e) => e.stopPropagation()}>
      <div className="face-card-head">
        <span className={faceMarkClass(marks, face.actor)} style={faceMarkStyle(colors, face.actor)}>
          {initial(face.label, marks, face.actor)}
        </span>
        <span className="face-card-who">
          <b>{name}</b>
          <span className="face-card-kind">
            {face.self
              ? "you"
              : face.presence === "available"
                ? "standing by"
                : face.presence === "here"
                  ? rungWord(face) ?? (face.kind === "cli" ? "terminal" : "here")
                  : "away"}
          </span>
        </span>
      </div>
      {/* The live half: what they say they are doing, right now. */}
      <div className={`face-card-status${face.status ? "" : " idle"}`}>
        {face.status ?? (face.self ? "click to rename or switch" : "nothing to report")}
      </div>
      {face.unread > 0 && (
        <button className="face-card-unread" onClick={() => onGo(face)}>
          {face.unread} unread — go and read {face.unread === 1 ? "it" : "them"}
        </button>
      )}
      {recent.length > 0 && (
        <>
          <div className="face-card-head-label">Recently</div>
          <div className="face-card-list">
            {recent.map((entry, i) => (
              <button
                key={`${entry.at}-${i}`}
                className="face-card-row"
                onClick={() => goToActivity(entry)}
                title={`Go to ${entry.subject}`}
              >
                <span className="face-card-verb">{VERB[entry.kind]}</span>
                <span className="face-card-subject">{entry.subject}</span>
                {/* Before the body: the body spans the row below it, and grid
                    auto-placement would push the time onto a third line. */}
                <span className="face-card-when">{elapsedLabel(entry.at, now)}</span>
                {entry.body && <span className="face-card-body">{entry.body}</span>}
              </button>
            ))}
          </div>
        </>
      )}
      {face.sessionId && !face.self && (
        <div className="face-card-foot">double-click the face to watch them</div>
      )}
    </div>
  );
}

const VERB: Record<ActivityEntry["kind"], string> = {
  said: "said",
  made: "made",
  edited: "edited",
};

/** Go to what they did: the thread they said it in, or the item itself. */
function goToActivity(entry: ActivityEntry): void {
  const canvas = useCanvasStore.getState().canvas;
  if (!canvas) return;
  const ui = useUiStore.getState();
  const item = entry.itemId ? canvas.items[entry.itemId] : undefined;
  const thread = entry.threadId ? canvas.threads[entry.threadId] : undefined;
  const target = item
    ? { x: item.x + item.width / 2, y: item.y + item.height / 2 }
    : thread
      ? threadWorldPos(canvas, thread)
      : null;
  if (!target) return;
  ui.setViewport(centerOn(ui.viewport, target.x, target.y, window.innerWidth, window.innerHeight));
  if (entry.threadId) ui.setOpenThread(entry.threadId);
  else if (entry.itemId) ui.select(entry.itemId);
}

/** *reading*, for a face whose connection holds less than `edit` — the word
 * comes from core's one map, so the Share roster and `isocan who` say the
 * same thing. Null for an editor: being here is the whole of it. */
function rungWord(face: Face): string | null {
  if (face.capability === null || atLeast(face.capability, "edit")) return null;
  return capabilityWord.presence[face.capability];
}

function tooltip(face: Face): string {
  if (face.self) return `${face.label} (you) · click to rename or switch`;
  const parts = [face.label];
  const rung = rungWord(face);
  if (rung) parts.push(rung);
  // Which agent, when we know — "terminal" is true of every one of them and
  // therefore the least useful thing this card could say about a row of three.
  if (face.harness) parts.push(face.harness);
  else if (face.kind === "cli") parts.push("terminal");
  if (face.status) parts.push(face.status);
  if (face.unread > 0) parts.push(`${face.unread} new — click to read`);
  else if (face.cursor) parts.push("click to jump to them");
  if (face.sessionId && !face.self) parts.push("double-click to watch");
  return parts.join(" · ");
}

/**
 * What goes in the disc.
 *
 * A CHOSEN mark wins outright. Failing that, the first character of a label,
 * skipping a leading emoji when there is a word — presence labels have
 * carried an emoji by convention for a while ("Kenny 🤖"), and that decoration
 * should not become the whole face. `actor.setMark` is the same wish said
 * deliberately, so it outranks the guess.
 */
function initial(label: string, marks: ActorMarks, actor: { id: string; name: string }): string {
  const chosen = marks[actor.id];
  if (chosen) return chosen;
  const word = label.trim().split(/\s+/).find((part) => /\p{L}|\p{N}/u.test(part));
  return (word ?? label).charAt(0).toUpperCase();
}
