import { describe as suite, expect, it } from "vitest";
import type { Actor, PresenceSession } from "@isocan/core";
import { facesFor, unreadByAuthor } from "../src/lib/facepile.ts";

/**
 * The facepile draws one face per PERSON.
 *
 * It is keyed by actor id, so this is not a preference — a second entry for one
 * actor is a React duplicate key, and React's documented answer to that is that
 * children "may be duplicated and/or omitted". It shipped as two identical
 * faces and a console warning per render.
 */

const kenny: Actor = { id: "usr_kenny", name: "Kenny" };
const nico: Actor = { id: "usr_nico", name: "Nico" };

function session(actor: Actor, sessionId: string, kind: PresenceSession["kind"]): PresenceSession {
  return {
    sessionId,
    actor,
    kind,
    label: kind === "cli" ? `${actor.name} 🤖` : null,
    cursor: null,
    selection: [],
    activity: null,
    lastSeen: new Date().toISOString(),
  } as unknown as PresenceSession;
}

const noUnread = new Map<string, { actor: Actor; count: number }>();

suite("one face per person", () => {
  it("draws you once when you also hold another live session", () => {
    // The exact shape that produced the bug: canvasStore filters your own TAB
    // out of `sessions` by session id, so your CLI session is still in there,
    // wearing the same actor. Two sessions, one person, one face.
    const faces = facesFor([session(kenny, "ses_cli", "cli")], noUnread, kenny);
    expect(faces.map((face) => face.actor.id)).toEqual(["usr_kenny"]);
  });

  it("and that one face is yours", () => {
    // Not merely deduped — the surviving face has to be the SELF one, or your
    // own face stops opening the identity menu and starts trying to fly to
    // your own cursor.
    const [mine] = facesFor([session(kenny, "ses_cli", "cli")], noUnread, kenny);
    expect(mine!.self).toBe(true);
  });

  it("keeps what the other surface was doing", () => {
    // Marking beats replacing: the session's cursor is real, and it is what
    // the minimap and follow mode aim at.
    const live = session(kenny, "ses_cli", "cli");
    (live as { cursor: unknown }).cursor = { x: 12, y: 34 };
    const [mine] = facesFor([live], noUnread, kenny);
    expect(mine!.cursor).toEqual({ x: 12, y: 34 });
    expect(mine!.sessionId).toBe("ses_cli");
  });

  it("still gives you a face when you hold no other session", () => {
    const faces = facesFor([], noUnread, kenny);
    expect(faces).toHaveLength(1);
    expect(faces[0]!.self).toBe(true);
  });

  it("does not swallow anybody else", () => {
    const faces = facesFor(
      [session(nico, "ses_n", "cli"), session(kenny, "ses_k", "cli")],
      noUnread,
      kenny,
    );
    expect(faces.map((face) => face.actor.id).sort()).toEqual(["usr_kenny", "usr_nico"]);
    expect(faces.find((face) => face.actor.id === "usr_nico")!.self).toBe(false);
  });

  it("never repeats an actor, whichever way they arrive", () => {
    // Three doors into the pile — a session, an unread comment, and being you.
    // Somebody standing in all three is still one person.
    const unread = new Map([["usr_kenny", { actor: kenny, count: 2 }]]);
    const faces = facesFor(
      [session(kenny, "ses_a", "cli"), session(kenny, "ses_b", "web")],
      unread,
      kenny,
    );
    const ids = faces.map((face) => face.actor.id);
    expect(new Set(ids).size, `duplicate actor in ${JSON.stringify(ids)}`).toBe(ids.length);
  });

  it("carries an absent person's unread count without a session", () => {
    // The negative control for the dedupe: it must not eat the comment-only
    // face, which is the whole reason that door exists.
    const unread = new Map([["usr_nico", { actor: nico, count: 3 }]]);
    const faces = facesFor([], unread, kenny);
    const theirs = faces.find((face) => face.actor.id === "usr_nico")!;
    expect(theirs.unread).toBe(3);
    expect(theirs.live).toBe(false);
  });
});

suite("unread is counted per author", () => {
  it("skips your own comments and anything already seen", () => {
    const thread = {
      id: "thr_1",
      comments: [
        { author: kenny, createdAt: "2026-01-01T00:00:00Z", body: "mine" },
        { author: nico, createdAt: "2026-01-01T00:00:01Z", body: "old" },
        { author: nico, createdAt: "2026-01-01T00:00:03Z", body: "new" },
      ],
    };
    const unread = unreadByAuthor(
      [thread as never],
      { thr_1: "2026-01-01T00:00:02Z" },
      kenny.id,
    );
    expect(unread.get("usr_kenny")).toBeUndefined();
    expect(unread.get("usr_nico")!.count).toBe(1);
  });
});
