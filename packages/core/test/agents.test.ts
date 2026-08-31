import { describe, expect, it } from "vitest";
import type { Actor, PresenceSession } from "../src/index.ts";
import {
  collectCanvasNames,
  dispatchReason,
  extractMentions,
  invertOperation,
  OpValidationError,
  roster,
  rulesOf,
  SYSTEM_ACTOR,
} from "../src/index.ts";
import { apply, seedState } from "./helpers.ts";

/**
 * **The enrolment record's home half** (agents-on-demand phase 2): standing
 * agents as canvas state, written by `agent.enroll` / `agent.withdraw`.
 * What these pin: the record's shape, re-enrolment updating in place,
 * withdrawal removing the standing and nothing else, neither op being
 * undoable, and the property the whole storage decision was made for — an
 * enrolled agent that has never spoken is mentionable, so `@Sian` can
 * summon before Sian ever runs.
 */

const sian: Actor = { id: "usr_sian", name: "Sian" };

describe("agent.enroll / agent.withdraw", () => {
  it("enrolment writes the row, rules verbatim", () => {
    const s = apply(seedState(), {
      type: "agent.enroll",
      agent: sian,
      rules: { items: ["itm_1"], ops: ["item.addVersion"] },
    })!;
    expect(s.canvas.agents).toEqual({
      usr_sian: { actor: sian, rules: { items: ["itm_1"], ops: ["item.addVersion"] } },
    });
  });

  it("re-enrolment updates in place — the standing was already there", () => {
    let s = apply(seedState(), { type: "agent.enroll", agent: sian, rules: { a: 1 } })!;
    s = apply(s, { type: "agent.enroll", agent: sian, rules: { a: 2 } })!;
    expect(Object.keys(s.canvas.agents ?? {})).toEqual(["usr_sian"]);
    expect(s.canvas.agents!["usr_sian"]!.rules).toEqual({ a: 2 });
  });

  it("withdrawal removes the standing, not the rest of the canvas", () => {
    const before = apply(seedState(), { type: "agent.enroll", agent: sian })!;
    const after = apply(before, { type: "agent.withdraw", actorId: sian.id })!;
    expect(after.canvas.agents).toEqual({});
    expect(after.canvas.threads).toEqual(before.canvas.threads);
    expect(after.canvas.items).toEqual(before.canvas.items);
  });

  it("withdrawing a stranger is refused", () => {
    expect(() => apply(seedState(), { type: "agent.withdraw", actorId: "usr_ghost" })).toThrow(
      OpValidationError,
    );
  });

  it("neither op is undoable — standing never moves on a casual ⌘Z", () => {
    const s = seedState();
    expect(invertOperation(s, { type: "agent.enroll", agent: sian })).toBeNull();
    const enrolled = apply(s, { type: "agent.enroll", agent: sian })!;
    expect(invertOperation(enrolled, { type: "agent.withdraw", actorId: sian.id })).toBeNull();
  });

  it("a canvas from before the field behaves as empty", () => {
    const s = seedState();
    delete (s.canvas as { agents?: unknown }).agents;
    const enrolled = apply(s, { type: "agent.enroll", agent: sian })!;
    expect(Object.keys(enrolled.canvas.agents ?? {})).toEqual(["usr_sian"]);
  });
});

describe("an enrolled agent is mentionable before it ever speaks", () => {
  it("@Sian resolves with no comment, item or session by Sian anywhere", () => {
    const s = apply(seedState(), { type: "agent.enroll", agent: sian })!;
    const candidates = collectCanvasNames(s.canvas);
    expect(extractMentions("@Sian take a look?", candidates)).toEqual([sian.id]);
  });

  it("…and stops resolving through the enrolment once withdrawn", () => {
    let s = apply(seedState(), { type: "agent.enroll", agent: sian })!;
    s = apply(s, { type: "agent.withdraw", actorId: sian.id })!;
    expect(extractMentions("@Sian still there?", collectCanvasNames(s.canvas))).toEqual([]);
  });
});

describe("the roster shows the record (phase 2.5)", () => {
  const rcSession = (actor: Actor): PresenceSession =>
    ({
      sessionId: "ses_rc",
      actor,
      kind: "rc",
      harness: null,
      label: null,
      cursor: null,
      selection: [],
      status: null,
      statusSource: null,
      activity: null,
      onThread: null,
      lastSeen: new Date().toISOString(),
    }) as PresenceSession;

  it("an enrolled agent is a row with no session at all — that is the point", () => {
    const s = apply(seedState(), { type: "agent.enroll", agent: sian })!;
    const rows = roster([], s.canvas, Date.now());
    const row = rows.find((r) => r.actorId === sian.id);
    expect(row).toMatchObject({ name: "Sian", state: "enrolled", primary: null });
  });

  it("an enrolled agent never doubles into the away half", () => {
    // Give Sian history (a thread), then withdraw-free: enrolled + activity
    // must still be ONE row.
    let s = apply(seedState(), { type: "agent.enroll", agent: sian })!;
    s = apply(
      s,
      {
        type: "thread.create",
        threadId: "th_s",
        x: 0,
        y: 0,
        anchorItemId: null,
        comment: { id: "cmt_s", body: "here" },
      },
      sian,
    )!;
    const rows = roster([], s.canvas, Date.now()).filter((r) => r.actorId === sian.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.state).toBe("enrolled");
  });

  it("answerable is the caller's derivation, never the record's claim (phase 6)", () => {
    const s = apply(seedState(), { type: "agent.enroll", agent: sian })!;
    // A caller that can see the connection-bound holds passes the set…
    const seen = roster([], s.canvas, Date.now(), new Set([sian.id]));
    expect(seen.find((r) => r.actorId === sian.id)!.state).toBe("answerable");
    // …and one that cannot (the web on a replica) under-claims, safely.
    const blind = roster([], s.canvas, Date.now());
    expect(blind.find((r) => r.actorId === sian.id)!.state).toBe("enrolled");
  });

  it("a parked rc's announcement is a process fact, never a roster row", () => {
    const person: Actor = { id: "usr_dimitri", name: "Dimitri" };
    const s = seedState();
    const rows = roster([rcSession(person)], s.canvas, Date.now());
    expect(rows.find((r) => r.actorId === person.id && r.state !== "away")).toBeUndefined();
  });
});

describe("dispatchReason — THE routing composition (phase 4)", () => {
  const sianCtx = (rules?: unknown) => ({
    actorId: sian.id,
    names: [{ id: sian.id, name: sian.name }],
    rules: rules === undefined ? null : (rules as { items?: string[]; ops?: string[] }),
  });
  const comment = (body: string, threadId = "th_x") =>
    ({
      type: "thread.create",
      threadId,
      x: 0,
      y: 0,
      anchorItemId: null,
      comment: { id: "cmt_x", body },
    }) as const;

  it("your own ops never wake you, mention or not", () => {
    const s = seedState();
    expect(dispatchReason(comment("@Sian hi"), sian.id, sianCtx(), s.canvas)).toBeNull();
  });

  it("a mention pierces any filter; unmatched noise stays noise", () => {
    const s = apply(seedState(), { type: "agent.enroll", agent: sian })!;
    const ctx = sianCtx({ ops: ["item.move"] });
    expect(dispatchReason(comment("@Sian look"), "usr_alice", ctx, s.canvas)).toBe("mentioned");
    expect(
      dispatchReason({ type: "item.move", itemId: "itm_1", x: 1, y: 2 }, "usr_alice", ctx, s.canvas),
    ).toBe("change");
    expect(
      dispatchReason({ type: "item.resize", itemId: "itm_1", width: 9, height: 9 }, "usr_alice", ctx, s.canvas),
    ).toBeNull();
  });

  it("empty rules mean comments only — the enrolled default", () => {
    const s = seedState();
    expect(
      dispatchReason({ type: "item.move", itemId: "itm_1", x: 1, y: 2 }, "usr_alice", sianCtx({}), s.canvas),
    ).toBeNull();
    expect(
      dispatchReason({ type: "item.move", itemId: "itm_1", x: 1, y: 2 }, "usr_alice", sianCtx({ ops: ["*"] }), s.canvas),
    ).toBe("change");
  });

  it("rulesOf reads the opaque field tolerantly", () => {
    expect(rulesOf(null)).toEqual({});
    expect(rulesOf("nonsense")).toEqual({});
    expect(rulesOf({ items: ["a", 3], ops: "not-an-array", extra: true })).toEqual({ items: ["a"] });
  });
});

describe("the system voice (phase 5)", () => {
  it("is a voice, not a participant: unmentionable, no roster row", () => {
    let s = seedState();
    s = apply(
      s,
      {
        type: "thread.create",
        threadId: "th_sys",
        x: 0,
        y: 0,
        anchorItemId: null,
        comment: { id: "cmt_sys", body: "Sian couldn't answer — machinery reporting" },
      },
      SYSTEM_ACTOR,
    )!;
    expect(extractMentions("@isocan are you there?", collectCanvasNames(s.canvas))).toEqual([]);
    expect(roster([], s.canvas, Date.now()).find((r) => r.actorId === SYSTEM_ACTOR.id)).toBeUndefined();
  });

  it("its reports never summon — the failure message must not wake the failure", () => {
    let s = apply(seedState(), { type: "agent.enroll", agent: sian })!;
    // Sian is IN this thread (wrote in it), so an ordinary reply would be
    // in-your-thread; the system's reply is not.
    s = apply(
      s,
      { type: "thread.create", threadId: "th_g", x: 0, y: 0, anchorItemId: null, comment: { id: "c0", body: "hello" } },
      sian,
    )!;
    const systemReply = {
      type: "thread.reply",
      threadId: "th_g",
      comment: { id: "c1", body: "Sian couldn't answer — the adapter died" },
    } as const;
    expect(
      dispatchReason(systemReply, SYSTEM_ACTOR.id, { actorId: sian.id, names: [sian] }, s.canvas),
    ).toBeNull();
  });
});
