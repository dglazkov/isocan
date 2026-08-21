import { describe, expect, it } from "vitest";
import { listeners, workersOn, type PresenceSession } from "../src/index.ts";

const session = (over: Partial<PresenceSession>): PresenceSession => ({
  sessionId: "ses_1", actor: { id: "usr_1", name: "Fable" }, kind: "cli", label: null,
  cursor: null, selection: [], status: null, activity: null,
  lastSeen: "2026-08-21T12:00:00.000Z", ...over,
});

describe("who has picked up a thread", () => {
  it("finds the sessions that claimed it, and no others", () => {
    const sessions = [
      session({ sessionId: "a", activity: { kind: "working", threadId: "t1" } }),
      session({ sessionId: "b", activity: { kind: "working", threadId: "t2" } }),
      session({ sessionId: "c", activity: null }),
    ];
    expect(workersOn(sessions, "t1").map((w) => w.sessionId)).toEqual(["a"]);
  });

  it("does not mistake working on an ITEM for working on a thread", () => {
    // The other activity kinds say where somebody is standing. Only this one
    // says what they are answering.
    const sessions = [
      session({ activity: { kind: "working", itemId: "t1" } }),
      session({ activity: { kind: "working", x: 10, y: 10 } }),
    ];
    expect(workersOn(sessions, "t1")).toEqual([]);
  });

  it("carries the status through — that is the whole point", () => {
    const sessions = [
      session({ status: "moving 12 items into rows…", activity: { kind: "working", threadId: "t1" } }),
    ];
    expect(workersOn(sessions, "t1")[0]).toMatchObject({
      name: "Fable",
      status: "moving 12 items into rows…",
    });
  });

  it("prefers the label the person knows them by", () => {
    const sessions = [
      session({ label: "Fable 🤖", activity: { kind: "working", threadId: "t1" } }),
    ];
    expect(workersOn(sessions, "t1")[0]!.name).toBe("Fable 🤖");
  });

  it("reports several, because two agents can take the same thread", () => {
    const sessions = [
      session({ sessionId: "a", activity: { kind: "working", threadId: "t1" } }),
      session({ sessionId: "b", activity: { kind: "working", threadId: "t1" } }),
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
