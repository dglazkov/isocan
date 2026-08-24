import { describe, expect, it } from "vitest";
import {
  cancelledSince,
  latestCancel,
  listeners,
  summonedBy,
  workersOn,
  type PresenceSession,
} from "../src/index.ts";

const session = (over: Partial<PresenceSession>): PresenceSession => ({
  sessionId: "ses_1", actor: { id: "usr_1", name: "Fable" }, kind: "cli", harness: null, label: null,
  cursor: null, selection: [], status: null, activity: null, onThread: null,
  lastSeen: "2026-08-21T12:00:00.000Z", ...over,
});

describe("who has picked up a thread", () => {
  it("finds the sessions that claimed it, and no others", () => {
    const sessions = [
      session({ sessionId: "a", onThread: "t1" }),
      session({ sessionId: "b", onThread: "t2" }),
      session({ sessionId: "c", activity: null }),
    ];
    expect(workersOn(sessions, "t1").map((w) => w.sessionId)).toEqual(["a"]);
  });

  it("does not mistake working on an ITEM for working on a thread", () => {
    // `activity` says where somebody is standing; `onThread` says what they
    // are answering. Reading the first as the second is how an agent vanished
    // from the thread the moment it started doing the work.
    const sessions = [
      session({ activity: { kind: "working", itemId: "t1" } }),
      session({ activity: { kind: "working", x: 10, y: 10 } }),
    ];
    expect(workersOn(sessions, "t1")).toEqual([]);
  });

  it("keeps the thread while the agent walks off to work on an item", () => {
    // The whole reason these are two fields. An agent answering a thread
    // spends most of its time working on the items the thread is about.
    const sessions = [
      session({ onThread: "t1", activity: { kind: "working", itemId: "itm_9" }, status: "wireframing…" }),
    ];
    expect(workersOn(sessions, "t1")[0]).toMatchObject({ status: "wireframing…" });
  });

  it("carries the status through — that is the whole point", () => {
    const sessions = [
      session({ status: "moving 12 items into rows…", onThread: "t1" }),
    ];
    expect(workersOn(sessions, "t1")[0]).toMatchObject({
      name: "Fable",
      status: "moving 12 items into rows…",
    });
  });

  it("prefers the label the person knows them by", () => {
    const sessions = [
      session({ label: "Fable 🤖", onThread: "t1" }),
    ];
    expect(workersOn(sessions, "t1")[0]!.name).toBe("Fable 🤖");
  });

  it("reports several, because two agents can take the same thread", () => {
    const sessions = [
      session({ sessionId: "a", onThread: "t1" }),
      session({ sessionId: "b", onThread: "t1" }),
    ];
    expect(workersOn(sessions, "t1")).toHaveLength(2);
  });
});

describe("who could pick something up", () => {
  it("counts agents, not people watching", () => {
    // A web session is somebody looking at the canvas; it will not act on a
    // comment while you look away. Counting it would promise an answer.
    const sessions = [session({ kind: "cli" }), session({ kind: "web" }), session({ kind: "cli" })];
    expect(listeners(sessions)).toHaveLength(2);
  });

  it("says nobody when nobody is parked", () => {
    expect(listeners([session({ kind: "web" })])).toEqual([]);
  });
});

describe("who the last message woke", () => {
  const thread = (over: object) => ({ main: false, comments: [], ...over }) as never;
  const asked = (mentions?: string[]) => ({
    author: { id: "usr_di" }, ...(mentions ? { mentions } : {}),
  });

  it("names the agents a comment @-mentioned", () => {
    const sessions = [
      session({ actor: { id: "usr_fable", name: "Fable" }, label: "Fable 🤖" }),
      session({ actor: { id: "usr_andy", name: "Wise Andy" } }),
    ];
    const woken = summonedBy(sessions, thread({ comments: [asked(["usr_fable"])] }));
    expect(woken.map((s) => s.actor.name)).toEqual(["Fable"]);
  });

  it("wakes every parked agent in the MAIN thread, mention or not", () => {
    // The daemon's rule, restated so a client can say who is coming.
    const sessions = [session({ actor: { id: "usr_fable", name: "Fable" } })];
    expect(summonedBy(sessions, thread({ main: true, comments: [asked()] }))).toHaveLength(1);
    expect(summonedBy(sessions, thread({ main: false, comments: [asked()] }))).toEqual([]);
  });

  it("never says an agent woke itself", () => {
    const sessions = [session({ actor: { id: "usr_fable", name: "Fable" } })];
    const own = { author: { id: "usr_fable" } };
    expect(summonedBy(sessions, thread({ main: true, comments: [own] }))).toEqual([]);
  });

  it("does not count people watching", () => {
    const sessions = [session({ kind: "web", actor: { id: "usr_p", name: "Di" } })];
    expect(summonedBy(sessions, thread({ main: true, comments: [asked()] }))).toEqual([]);
  });

  it("says nobody for an empty thread", () => {
    expect(summonedBy([session({})], thread({ main: true }))).toEqual([]);
  });
});

describe("calling something off", () => {
  const comment = (id: string, body: string, createdAt: string) => ({
    id, body, author: { id: "usr_di", name: "Di" }, createdAt,
  });

  it("finds a /cancel in the thread", () => {
    const thread = { comments: [comment("c1", "do the thing", "2026-08-21T10:00:00.000Z"), comment("c2", "/cancel", "2026-08-21T10:01:00.000Z")] };
    expect(latestCancel(thread)?.id).toBe("c2");
  });

  it("takes the most recent one", () => {
    const thread = { comments: [comment("c1", "/cancel", "2026-08-21T10:00:00.000Z"), comment("c2", "actually go on", "2026-08-21T10:01:00.000Z"), comment("c3", "/cancel no really", "2026-08-21T10:02:00.000Z")] };
    expect(latestCancel(thread)?.id).toBe("c3");
  });

  it("is not a message ABOUT cancelling", () => {
    // Same rule every command follows: only the start of the message counts.
    const thread = { comments: [comment("c1", "I nearly typed /cancel there", "2026-08-21T10:00:00.000Z")] };
    expect(latestCancel(thread)).toBeNull();
  });

  it("only counts a cancellation that came after the work started", () => {
    // Last week's cancellation is history; a minute ago is an instruction.
    const thread = { comments: [comment("c1", "/cancel", "2026-08-21T10:00:00.000Z")] };
    expect(cancelledSince(thread, "2026-08-21T09:00:00.000Z")?.id).toBe("c1");
    expect(cancelledSince(thread, "2026-08-21T11:00:00.000Z")).toBeNull();
    expect(cancelledSince(thread, null)?.id).toBe("c1");
  });
});
