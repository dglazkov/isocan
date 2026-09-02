import { describe, expect, it } from "vitest";
import type { CanvasContents, CommentThread, Item } from "../src/model.ts";
import type { PresenceSession } from "../src/protocol.ts";
import {
  SPRINT_PROP,
  agentActorIds,
  clockLabel,
  handInPatch,
  handedInFor,
  hidesVotes,
  parseDuration,
  parseSprintCommand,
  phaseOver,
  remainingSeconds,
  sprintState,
  tally,
  wallFor,
} from "../src/sprint.ts";

/**
 * The sprint (docs/research/2026-09-01-design-sprint.md): phase derived from
 * the Chat the way `/ask` is, the clock from the comment's daemon stamp, a
 * hand-in as a property, a vote as a reaction that hides by lens while open.
 */

const T0 = "2026-09-01T10:00:00.000Z";
const at = (offsetSeconds: number) => new Date(Date.parse(T0) + offsetSeconds * 1000).toISOString();

const item = (id: string, props: Record<string, string> = {}, reactions: Record<string, string[]> = {}): Item =>
  ({
    id,
    title: id,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    properties: props,
    reactions,
    versions: [],
    currentVersionId: "v",
  }) as unknown as Item;

const chat = (
  comments: { id: string; author: string; body: string; at?: string }[],
): CommentThread =>
  ({
    id: "thr_chat",
    x: 0,
    y: 0,
    anchorItemId: null,
    main: true,
    comments: comments.map((c) => ({
      id: c.id,
      author: { id: c.author, name: c.author },
      body: c.body,
      createdAt: c.at ?? T0,
    })),
  }) as unknown as CommentThread;

const canvasOf = (items: Item[], thread?: CommentThread, agents: string[] = []): CanvasContents =>
  ({
    items: Object.fromEntries(items.map((i) => [i.id, i])),
    threads: thread ? { [thread.id]: thread } : {},
    trash: [],
    agents: Object.fromEntries(agents.map((id) => [id, { actor: { id, name: id } }])),
  }) as unknown as CanvasContents;

describe("reading a /sprint command", () => {
  it("takes a phase, a duration and a note", () => {
    expect(parseSprintCommand("/sprint crazy8s 8m one idea per frame")).toEqual({
      phase: "crazy8s",
      seconds: 480,
      note: "one idea per frame",
    });
  });

  it("takes the phase's default when no duration is given", () => {
    expect(parseSprintCommand("/sprint sketch")).toEqual({ phase: "sketch", seconds: null, note: "" });
    expect(parseSprintCommand("/sprint sketch three panels, a title")).toMatchObject({
      phase: "sketch",
      seconds: null,
      note: "three panels, a title",
    });
  });

  it("is not a phase change when the word is not a phase", () => {
    // A brief for the facilitator, not a timer starting on a typo.
    expect(parseSprintCommand("/sprint make onboarding better")).toBeNull();
    expect(parseSprintCommand("/sprint")).toBeNull();
    expect(parseSprintCommand("/sprnt sketch")).toBeNull();
    expect(parseSprintCommand("we ran /sprint sketch earlier")).toBeNull();
  });

  it("knows the word that closes the sprint", () => {
    expect(parseSprintCommand("/sprint end thanks all")).toEqual({ phase: "end", seconds: null, note: "thanks all" });
  });

  it("is not fussy about case", () => {
    expect(parseSprintCommand("/sprint HeatMap 5m")?.phase).toBe("heatmap");
  });
});

describe("durations and the clock", () => {
  it("reads minutes bare, and h/m/s spelled", () => {
    expect(parseDuration("8")).toBe(480);
    expect(parseDuration("8m")).toBe(480);
    expect(parseDuration("90s")).toBe(90);
    expect(parseDuration("1h")).toBe(3600);
    expect(parseDuration("1h30m")).toBe(5400);
    expect(parseDuration("soon")).toBeNull();
    expect(parseDuration("")).toBeNull();
  });

  it("shows what a wall clock would", () => {
    expect(clockLabel(482)).toBe("8:02");
    expect(clockLabel(5)).toBe("0:05");
    expect(clockLabel(3661)).toBe("1:01:01");
    expect(clockLabel(-4)).toBe("0:00");
  });
});

describe("the phase the Chat says is running", () => {
  it("is null with no Chat, and null before any phase", () => {
    expect(sprintState(canvasOf([]))).toBeNull();
    expect(sprintState(canvasOf([], chat([{ id: "c1", author: "F", body: "hello" }])))).toBeNull();
  });

  it("is the newest phase command, timed from the daemon's stamp", () => {
    const canvas = canvasOf(
      [],
      chat([
        { id: "c1", author: "F", body: "/sprint hmw 10m", at: at(0) },
        { id: "c2", author: "P", body: "sounds good" },
        { id: "c3", author: "F", body: "/sprint crazy8s 8m", at: at(600) },
        { id: "c4", author: "P", body: "/ask can I use colour?" },
      ]),
    );
    const state = sprintState(canvas)!;
    expect(state.phase.name).toBe("crazy8s");
    expect(state.facilitatorId).toBe("F");
    expect(state.commentId).toBe("c3");
    expect(state.startedAt).toBe(at(600));
    expect(state.endsAt).toBe(at(600 + 480));
    expect(remainingSeconds(state, Date.parse(at(700)))).toBe(380);
    expect(phaseOver(state, Date.parse(at(700)))).toBe(false);
    expect(remainingSeconds(state, Date.parse(at(2000)))).toBe(0);
    expect(phaseOver(state, Date.parse(at(2000)))).toBe(true);
  });

  it("takes the method's timebox when the command names none", () => {
    const state = sprintState(canvasOf([], chat([{ id: "c1", author: "F", body: "/sprint crazy8s", at: at(0) }])))!;
    expect(state.endsAt).toBe(at(480));
  });

  it("has no clock for a phase that runs until the next one", () => {
    const state = sprintState(canvasOf([], chat([{ id: "c1", author: "F", body: "/sprint museum", at: at(0) }])))!;
    expect(state.endsAt).toBeNull();
    expect(remainingSeconds(state, Date.parse(at(99999)))).toBeNull();
    expect(phaseOver(state, Date.parse(at(99999)))).toBe(false);
  });

  it("ends with `end`, and a later phase starts again", () => {
    const ended = canvasOf(
      [],
      chat([
        { id: "c1", author: "F", body: "/sprint sketch" },
        { id: "c2", author: "F", body: "/sprint end" },
      ]),
    );
    expect(sprintState(ended)).toBeNull();
    const again = canvasOf(
      [],
      chat([
        { id: "c1", author: "F", body: "/sprint end" },
        { id: "c2", author: "F", body: "/sprint map" },
      ]),
    );
    expect(sprintState(again)?.phase.name).toBe("map");
  });

  it("counts what was handed in for THIS phase", () => {
    const canvas = canvasOf(
      [item("a", { [SPRINT_PROP]: "sketch" }), item("b", { [SPRINT_PROP]: "sketch" }), item("c", { [SPRINT_PROP]: "hmw" }), item("d")],
      chat([{ id: "c1", author: "F", body: "/sprint sketch" }]),
    );
    expect(sprintState(canvas)!.handedIn.map((i) => i.id)).toEqual(["a", "b"]);
  });
});

describe("the curtain", () => {
  const voting = (body: string) => sprintState(canvasOf([], chat([{ id: "c1", author: "F", body, at: at(0) }])));

  it("hides votes while a vote phase's clock runs, and reveals at the bell", () => {
    const state = voting("/sprint heatmap 5m");
    expect(hidesVotes(state, Date.parse(at(10)))).toBe(true);
    expect(hidesVotes(state, Date.parse(at(300)))).toBe(false);
  });

  it("hides nothing during a silent or group phase, or with no sprint", () => {
    expect(hidesVotes(voting("/sprint sketch"), Date.parse(at(10)))).toBe(false);
    expect(hidesVotes(voting("/sprint museum"), Date.parse(at(10)))).toBe(false);
    expect(hidesVotes(null, Date.parse(at(10)))).toBe(false);
  });

  it("the supervote is a decision, not a hidden vote", () => {
    // The Decider's dots are the decision; there is nothing to conceal.
    expect(hidesVotes(voting("/sprint supervote"), Date.parse(at(10)))).toBe(false);
  });
});

describe("handing in", () => {
  it("is a property, spelled once", () => {
    expect(handInPatch("sketch")).toEqual({ properties: { sprint: "sketch" } });
    expect(handedInFor(item("a", { sprint: "sketch" }))).toBe("sketch");
    expect(handedInFor(item("a"))).toBeNull();
  });
});

describe("two tallies on one sketch", () => {
  const session = (over: Partial<PresenceSession>): PresenceSession =>
    ({ sessionId: "s", actor: { id: "x", name: "x" }, kind: "web", harness: null, ...over }) as PresenceSession;

  it("knows an agent by its harness or its enrolment, never by guessing", () => {
    const sessions = [
      session({ sessionId: "1", actor: { id: "P", name: "Priya" }, kind: "web" }),
      session({ sessionId: "2", actor: { id: "K", name: "Kenny" }, kind: "cli", harness: "claude-code" }),
      session({ sessionId: "3", actor: { id: "T", name: "term" }, kind: "cli", harness: null }),
    ];
    const agents = agentActorIds(sessions, canvasOf([], undefined, ["S"]));
    expect([...agents].sort()).toEqual(["K", "S"]);
  });

  it("splits human dots from agent dots and sorts by the whole", () => {
    const wall = [
      item("a", {}, { "🔴": ["P", "K"] }),
      item("b", {}, { "🔴": ["P", "Q", "R"], "👍": ["K"] }),
      item("c", {}, { "⭐": ["P"] }),
    ];
    const rows = tally(wall, "🔴", new Set(["K"]));
    expect(rows.map((r) => [r.item.id, r.humans, r.agents])).toEqual([
      ["b", 3, 0],
      ["a", 1, 1],
    ]);
  });
});

describe("the wall a vote is about", () => {
  it("is what was handed in for the last silent phase before the vote", () => {
    const canvas = canvasOf(
      [item("s1", { sprint: "sketch" }), item("s2", { sprint: "sketch" }), item("h1", { sprint: "hmw" }), item("other")],
      chat([
        { id: "c1", author: "F", body: "/sprint hmw" },
        { id: "c2", author: "F", body: "/sprint sketch" },
        { id: "c3", author: "F", body: "/sprint museum" },
        { id: "c4", author: "F", body: "/sprint heatmap" },
      ]),
    );
    expect(wallFor(canvas, sprintState(canvas)!).map((i) => i.id)).toEqual(["s1", "s2"]);
  });

  it("is everything when nothing was handed in", () => {
    const canvas = canvasOf([item("a"), item("b")], chat([{ id: "c1", author: "F", body: "/sprint heatmap" }]));
    expect(wallFor(canvas, sprintState(canvas)!).map((i) => i.id)).toEqual(["a", "b"]);
  });
});
