import { describe, expect, it } from "vitest";
import type { Actor } from "../src/index.ts";
import {
  collectCanvasNames,
  extractMentions,
  invertOperation,
  OpValidationError,
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
