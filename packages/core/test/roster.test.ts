import { describe, expect, it } from "vitest";
import type { CanvasContents, PresenceSession } from "../src/index.ts";
import {
  QUIET_AFTER_MS,
  answeringExcerpt,
  openAsk,
  openAsks,
  roster,
  sessionState,
} from "../src/index.ts";

const NOW = Date.parse("2026-08-26T12:00:00.000Z");

/** A minimal session; only what the roster reads. */
function session(over: Partial<PresenceSession>): PresenceSession {
  return {
    sessionId: "ses_x",
    actor: { id: "usr_a", name: "Kenny" },
    kind: "cli",
    harness: "claude-code",
    label: null,
    cursor: null,
    selection: [],
    status: null,
    statusSource: null,
    activity: null,
    onThread: null,
    lastSeen: new Date(NOW).toISOString(),
    ...over,
  } as PresenceSession;
}

function canvasWith(over: Partial<CanvasContents>): CanvasContents {
  return { items: {}, threads: {}, trash: [], ...over } as unknown as CanvasContents;
}

const thread = (id: string, comments: Array<{ id: string; author: string; body: string }>) => ({
  id,
  createdBy: { id: comments[0]?.author ?? "usr_t", name: "t" },
  comments: comments.map((c) => ({ id: c.id, author: { id: c.author, name: c.author }, body: c.body })),
});

describe("the roster's rows", () => {
  it("is one row per ACTOR, led by the cli session regardless of arrival order", () => {
    // The facepile's recorded bug, inherited as law — and unlike facesFor's
    // first-push-wins, the ACTING surface leads.
    const rows = roster(
      [
        session({ sessionId: "web1", kind: "web", harness: null }),
        session({ sessionId: "cli1", kind: "cli" }),
      ],
      null,
      NOW,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.primary!.sessionId).toBe("cli1");
    expect(rows[0]!.others.map((s) => s.sessionId)).toEqual(["web1"]);
  });

  it("shows no live row for a person at a browser", () => {
    expect(roster([session({ kind: "web", harness: null })], null, NOW)).toEqual([]);
  });

  it("says 'terminal' rather than guessing an agent from a bare cli session", () => {
    expect(roster([session({ harness: null })], null, NOW)[0]!.harness).toBeNull();
  });

  it("prefers the freshest cli surface when an actor holds two", () => {
    const rows = roster(
      [
        session({ sessionId: "old", lastSeen: new Date(NOW - 60_000).toISOString() }),
        session({ sessionId: "new" }),
      ],
      null,
      NOW,
    );
    expect(rows[0]!.primary!.sessionId).toBe("new");
  });
});

describe("what a row is doing", () => {
  it("derives PARKED from the source, never from the words", () => {
    // The whole reason statusSource crosses the wire: the state must survive
    // the day wait's copy changes, and must NOT fire on an agent SAYING the
    // same words out loud.
    const parked = session({ status: "waiting for you…", statusSource: "lifecycle" });
    expect(sessionState(parked, null, NOW)).toBe("parked");
    const saidIt = session({ status: "waiting for you…", statusSource: "explicit" });
    expect(sessionState(saidIt, null, NOW)).not.toBe("parked");
  });

  it("lets a locus outrank the parked status", () => {
    // Waking lands presence on the summoning thread with lifecycle narration
    // AND an activity — that agent is working, not parked.
    const waking = session({
      status: "reading your comment…",
      statusSource: "lifecycle",
      activity: { kind: "working", itemId: "itm_1" },
    });
    expect(sessionState(waking, null, NOW)).toBe("working");
  });

  it("reads quiet from the clock, for cli sessions only", () => {
    const idle = session({ lastSeen: new Date(NOW - QUIET_AFTER_MS - 1).toISOString() });
    expect(sessionState(idle, null, NOW)).toBe("quiet");
    const person = session({
      kind: "web",
      harness: null,
      lastSeen: new Date(NOW - QUIET_AFTER_MS - 1).toISOString(),
    });
    expect(sessionState(person, null, NOW)).toBe("here");
  });

  it("puts blocked first: an open ask outranks everything", () => {
    const canvas = canvasWith({
      threads: { t1: thread("t1", [{ id: "c1", author: "usr_a", body: "/ask which header ships?" }]) },
    } as never);
    const working = session({ activity: { kind: "working", itemId: "itm_1" } });
    expect(sessionState(working, canvas, NOW)).toBe("blocked");
    const rows = roster(
      [
        working,
        session({ sessionId: "b", actor: { id: "usr_b", name: "B" }, activity: { kind: "working", itemId: "i" } }),
      ],
      canvas,
      NOW,
    );
    expect(rows[0]!.actorId).toBe("usr_a");
  });
});

describe("open asks", () => {
  it("finds the last /ask with no reply from anyone else", () => {
    const t = thread("t1", [
      { id: "c1", author: "usr_a", body: "/ask blue or green?" },
      { id: "c2", author: "usr_a", body: "/ask blue, green, or the token?" },
    ]);
    expect(openAsk(t as never)).toMatchObject({
      commentId: "c2",
      askerId: "usr_a",
      body: "blue, green, or the token?",
    });
  });

  it("clears on the ANSWER — anyone else speaking after it", () => {
    const t = thread("t1", [
      { id: "c1", author: "usr_a", body: "/ask blue or green?" },
      { id: "c2", author: "usr_b", body: "green" },
    ]);
    expect(openAsk(t as never)).toBeNull();
  });

  it("stays open while the asker amends their own question", () => {
    const t = thread("t1", [
      { id: "c1", author: "usr_a", body: "/ask blue or green?" },
      { id: "c2", author: "usr_a", body: "context: the header" },
    ]);
    expect(openAsk(t as never)).toMatchObject({ commentId: "c1" });
  });

  it("is not fooled by /askew — the verb is a word, not a prefix", () => {
    const t = thread("t1", [{ id: "c1", author: "usr_a", body: "/askew is not a verb" }]);
    expect(openAsk(t as never)).toBeNull();
  });

  it("collects across threads, newest first", () => {
    const canvas = canvasWith({
      threads: {
        t1: thread("t1", [{ id: "c1", author: "usr_a", body: "/ask one?" }]),
        t2: thread("t2", [{ id: "c2", author: "usr_b", body: "/ask two?" }]),
      },
    } as never);
    expect(openAsks(canvas).map((a) => a.threadId)).toEqual(["t2", "t1"]);
  });
});

describe("away rows", () => {
  const made = (actorId: string, at: string, id: string) => ({
    id,
    title: id,
    x: 0, y: 0, width: 10, height: 10,
    createdBy: { id: actorId, name: actorId },
    updatedBy: { id: actorId, name: actorId },
    createdAt: at,
    versions: [{ id: `v_${id}`, blobHash: "h", mimeType: "text/plain", filename: "f", size: 1, createdAt: at, createdBy: { id: actorId, name: actorId } }],
    currentVersionId: `v_${id}`,
    properties: {},
  });

  it("remembers an actor who DID something, and skips a name-only claimant", () => {
    // The did-filter is the probe-actor defence: a canvas remembers every
    // claimant, and a roster of one-shot verification names is a list, not a
    // room. (The retire research counted 29 of 44 name-holders with zero
    // canvas ops — none of them belong in this panel.)
    const canvas = canvasWith({
      items: { i1: made("usr_gone", "2026-08-25T10:00:00.000Z", "i1") },
      threads: {
        t1: thread("t1", [{ id: "c1", author: "usr_probe", body: "" }]),
      },
    } as never);
    // usr_probe authored only an EMPTY comment; recentActivity records said
    // comments, so give it nothing at all instead:
    (canvas.threads as Record<string, unknown>)["t1"] = thread("t1", []);
    const rows = roster([], canvas, NOW);
    expect(rows.map((r) => [r.actorId, r.state])).toEqual([["usr_gone", "away"]]);
    expect(rows[0]!.primary).toBeNull();
    expect(rows[0]!.lastAct?.kind).toBe("made");
  });

  it("keeps a live actor out of the away half", () => {
    const canvas = canvasWith({
      items: { i1: made("usr_a", "2026-08-25T10:00:00.000Z", "i1") },
    } as never);
    const rows = roster([session({})], canvas, NOW);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.state).not.toBe("away");
  });

  it("caps the away half, newest act first", () => {
    const items: Record<string, unknown> = {};
    for (let i = 0; i < 9; i++) {
      items[`i${i}`] = made(`usr_${i}`, `2026-08-2${i < 5 ? 0 + i : 5}T0${i}:00:00.000Z`, `i${i}`);
    }
    const rows = roster([], canvasWith({ items } as never), NOW);
    expect(rows).toHaveLength(6);
    const acts = rows.map((r) => r.lastAct!.at);
    expect([...acts].sort().reverse()).toEqual(acts);
  });
});

describe("what an agent is answering", () => {
  const canvas = canvasWith({
    threads: {
      th_1: thread("th_1", [
        { id: "c1", author: "usr_d", body: "first" },
        { id: "c2", author: "usr_d", body: "make it match the mock" },
      ]),
    },
  } as never);

  it("excerpts the LAST comment of the thread the session is on", () => {
    expect(answeringExcerpt(canvas, session({ onThread: "th_1" }))).toEqual({
      threadId: "th_1",
      body: "make it match the mock",
    });
  });

  it("answers nothing off-thread, and nothing for a thread that is gone", () => {
    expect(answeringExcerpt(canvas, session({}))).toBeNull();
    expect(answeringExcerpt(canvas, session({ onThread: "th_gone" }))).toBeNull();
  });
});
