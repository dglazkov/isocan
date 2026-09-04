import { describe as suite, expect, it } from "vitest";
import type { Actor, PresenceSession } from "@isocan/core";
import { facesFor, unreadByAuthor } from "../src/lib/facepile.ts";
import { unreadCount } from "../src/stores/unreadStore.ts";

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
  it("a parked rc is a process fact, not a face — and it never eats its person's", () => {
    // First-push-wins per actor: an rc session ahead of the person's web tab
    // would claim Kenny's one face and render a participant that isn't one.
    const faces = facesFor(
      [session(kenny, "ses_rc", "rc"), session(kenny, "ses_web", "web")],
      noUnread,
      kenny,
    );
    expect(faces).toHaveLength(1);
    expect(faces[0]!.kind).toBe("web");
  });

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
    expect(theirs.presence).toBe("away");
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

/**
 * multi-identity phase 5: `actor.join` folds one actor into another. The log
 * keeps the folded id on every comment it wrote, so the unread helpers have
 * to resolve authors through the `joined` map before deciding whose words a
 * comment is.
 */
suite("a folded actor's comments are their person's own", () => {
  const kenny2: Actor = { id: "usr_kenny2", name: "Kenny 2" };
  const joined = { usr_kenny2: "usr_kenny" };
  const thread = {
    id: "thr_1",
    comments: [
      { author: kenny2, createdAt: "2026-01-01T00:00:01Z", body: "written before the join" },
      { author: nico, createdAt: "2026-01-01T00:00:02Z", body: "from somebody else" },
    ],
  } as never;

  it("is not unread for the person it folded into when `joined` maps it", () => {
    expect(unreadCount(thread, {}, kenny.id, joined)).toBe(1);
    expect(unreadCount(thread, {}, kenny.id)).toBe(2);
  });

  it("groups under the id that answers now, and never under yours", () => {
    const byAuthor = unreadByAuthor([thread], {}, nico.id, joined);
    expect([...byAuthor.keys()]).toEqual(["usr_kenny"]);
    expect(byAuthor.get("usr_kenny")!.count).toBe(1);
    expect(unreadByAuthor([thread], {}, kenny.id, joined).has("usr_kenny2")).toBe(false);
  });
});

/**
 * **The third state** — `docs/research/2026-08-30-standing-agents.md` asks it
 * as an open question and answers it in the same breath: an agent registered
 * for a canvas it has never opened is neither present nor absent, and
 * *"`available` must look different from `here`"*.
 */
suite("standing by is neither here nor away", () => {
  const parked = (actor: Actor) => ({ ...session(actor, "ses_rc", "cli"), kind: "rc" as const });
  const sian: Actor = { id: "usr_sian", name: "Sian" };

  it("gives an answerable agent a face of its own — and says so in words, not only in a ring", () => {
    const [face] = facesFor([], noUnread, kenny, [sian]).filter((f) => f.actor.id === sian.id);
    expect(face?.presence).toBe("available");
    // The status is what the tooltip and the aria label carry: a state told
    // by colour alone is not told (phase 3's accessibility pass).
    expect(face?.status).toMatch(/^standing by/);
  });

  it("does not wear the rc's own person as standing by — the rc runs; its agents stand by", () => {
    /* Phase 2.5's stand-in gave the announcement session a face. Now that
       `answerable` is connection-bound, the person at the terminal is not
       "standing by" — the agents they answer for are. The announcement is
       still skipped here so it never eats its person's real face. */
    const faces = facesFor([parked(nico)], noUnread, kenny, [sian]);
    expect(faces.find((f) => f.actor.id === nico.id)).toBeUndefined();
    expect(faces.find((f) => f.actor.id === sian.id)?.presence).toBe("available");
  });

  it("offers nothing to follow, because nobody is moving", () => {
    /* A session handle here would put a Follow control on a face with no
       cursor: a button that flies you nowhere. */
    const [face] = facesFor([], noUnread, kenny, [sian]).filter((f) => f.actor.id === sian.id);
    expect(face?.sessionId).toBeNull();
    expect(face?.cursor).toBeNull();
  });

  it("never eats the real face of an agent that is actually here", () => {
    /* First-push-wins. An agent with a live session mid-turn AND an rc
       holding it is WORKING, and the weaker fact must not claim the row. */
    const faces = facesFor([session(sian, "ses_cli", "cli")], noUnread, kenny, [sian]);
    const theirs = faces.filter((f) => f.actor.id === sian.id);
    expect(theirs).toHaveLength(1);
    expect(theirs[0]!.presence).toBe("here");
  });

  it("outranks having left a comment and gone", () => {
    /* Reachable now is a stronger fact than was here once. */
    const unread = new Map([["usr_sian", { actor: sian, count: 2 }]]);
    const [face] = facesFor([], unread, kenny, [sian]).filter((f) => f.actor.id === sian.id);
    expect(face?.presence).toBe("available");
    expect(face?.unread, "and it keeps what they left behind").toBe(2);
  });
});
