import { describe, expect, it } from "vitest";
import {
  OpValidationError,
  PROPOSAL_CAP,
  applyOperation,
  citeLabel,
  convergeOps,
  convergePlan,
  deletedBody,
  designWordSpans,
  invertOperation,
  isRefusal,
  parseCite,
  proposalCites,
  proposalMarked,
  proposalProperties,
  proposalRoom,
  proposalsOf,
  tasteNote,
  tasteProperties,
  tasteWithLine,
} from "../src/index.ts";
import type { Actor, CanvasState, Operation } from "../src/index.ts";
import { alice, envelope, nv } from "./helpers.ts";

/**
 * **Proposals, and deletes that teach** (proactive-agent phase 1).
 *
 * A proposal is an ordinary item with `parent=` and three properties; the
 * mark is derived and the two rules (a cite, the cap) hold at the reducer,
 * which is the one writer every surface goes through.
 */
const kit: Actor = { id: "usr_kit", name: "Kit" };
const rue: Actor = { id: "usr_rue", name: "Rue" };

function start(): CanvasState {
  let s = applyOperation(null, envelope({ type: "project.create", canvasId: "prj_test", title: "Acme Bakery", description: "" }));
  s = applyOperation(s, envelope({ type: "item.add", itemId: "itm_src", version: nv("ver_src"), width: 390, height: 640, placement: { x: 0, y: 0 }, title: "Checkout" }));
  s = applyOperation(s, envelope({ type: "thread.create", threadId: "thr_r", x: 10, y: 10, anchorItemId: "itm_src", comment: { id: "cmt_r", body: "people miss the pickup slot" } }, { id: "usr_ravi", name: "Ravi" }));
  return s!;
}

const cites = [{ kind: "comment" as const, ref: "cmt_r" }];
const propose = (s: CanvasState, id: string, by: Actor = kit, props = proposalProperties("itm_src", "sure", cites, "Summary before detail: the pickup time comes first.")): CanvasState =>
  applyOperation(s, envelope({ type: "item.add", itemId: id, version: nv(`ver_${id}`), width: 390, height: 640, placement: { x: 0, y: 700 }, title: `Proposal ${id}`, properties: props }, by))!;

function refusal(fn: () => unknown): string {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(OpValidationError);
    return (err as Error).message;
  }
  throw new Error("expected a refusal");
}

describe("a proposal is marked until it is kept", () => {
  it("is marked while it carries proposal and parent, and found under its source", () => {
    const s = propose(start(), "itm_p1");
    const p = s.canvas.items.itm_p1!;
    expect(proposalMarked(p)).toBe(true);
    expect(proposalMarked(s.canvas.items.itm_src!)).toBe(false);
    expect(proposalsOf(s.canvas, "itm_src").map((i) => i.id)).toEqual(["itm_p1"]);
    expect(proposalCites(p)).toEqual(cites);
    expect(citeLabel(s.canvas, proposalCites(p)[0]!)).toBe("Ravi's comment, “people miss the pickup slot”");
  });

  it("Keep is one new version of the source and the proposal trashed — and inverts as one", () => {
    let s = propose(start(), "itm_p1");
    s = propose(s, "itm_p2", rue);
    const before = structuredClone(s);
    const plan = convergePlan(s.canvas, "itm_p1");
    if (isRefusal(plan)) throw new Error(plan.refused);
    // Only the proposal goes: Rue's proposal on the same source is somebody
    // else's note, not a losing sibling.
    expect(plan.trash).toEqual(["itm_p1"]);
    const ops = convergeOps(plan);
    const inverses: Operation[] = [];
    for (const op of ops) {
      inverses.unshift(invertOperation(s, op)!);
      s = applyOperation(s, envelope(op, alice))!;
    }
    expect(s.canvas.items.itm_src!.versions.map((v) => v.id)).toEqual(["ver_src", "ver_itm_p1"]);
    expect(s.canvas.items.itm_p1).toBeUndefined();
    expect(s.canvas.trash.map((t) => t.item.id)).toEqual(["itm_p1"]);
    expect(proposalsOf(s.canvas).map((i) => i.id)).toEqual(["itm_p2"]);
    expect(proposalMarked(s.canvas.items.itm_src!)).toBe(false);
    // The group's inverses, in reverse, are the one undo: everything back.
    for (const op of inverses) s = applyOperation(s, envelope(op, alice))!;
    expect(s.canvas.items.itm_src!.versions.map((v) => v.id)).toEqual(before.canvas.items.itm_src!.versions.map((v) => v.id));
    expect(proposalMarked(s.canvas.items.itm_p1!)).toBe(true);
    expect(s.canvas.trash).toEqual([]);
  });
});

describe("no trigger, no proposal — and the cap", () => {
  it("refuses a proposal with no cites, saying what to do", () => {
    const empty = proposalProperties("itm_src", "sure", [], "Because.");
    expect(refusal(() => propose(start(), "itm_p1", kit, empty))).toMatch(/no trigger, no proposal.*--cites kind:ref/);
    const garbage = { ...empty, proposalCites: "not json" };
    expect(refusal(() => propose(start(), "itm_p1", kit, garbage))).toMatch(/no trigger/);
  });

  it(`refuses one agent's proposal past ${PROPOSAL_CAP}, and counts per agent per canvas`, () => {
    let s = start();
    for (let i = 1; i <= PROPOSAL_CAP; i++) s = propose(s, `itm_k${i}`);
    expect(proposalRoom(s.canvas, kit.id)).toBe(0);
    expect(proposalRoom(s.canvas, rue.id)).toBe(PROPOSAL_CAP);
    const sixth = refusal(() => propose(s, "itm_over"));
    expect(sixth).toContain(`already have ${PROPOSAL_CAP} open proposals`);
    expect(sixth).toContain("only when the person keeps or deletes one");
    // No room frees by time: a proposal a year old still counts.
    const aged = structuredClone(s);
    for (const item of Object.values(aged.canvas.items)) item.createdAt = "2025-01-01T00:00:00.000Z";
    expect(proposalRoom(aged.canvas, kit.id)).toBe(0);
    // Another agent is not crowded out by Kit's.
    s = propose(s, "itm_rue", rue);
    // A Delete frees room: the trash holds no open proposal.
    s = applyOperation(s, envelope({ type: "item.delete", itemId: "itm_k1" }))!;
    expect(proposalRoom(s.canvas, kit.id)).toBe(1);
    expect(() => propose(s, "itm_again")).not.toThrow();
  });

  it("refuses a source that is not on the canvas", () => {
    const orphan = proposalProperties("itm_gone", "hunch", cites, "x");
    expect(refusal(() => propose(start(), "itm_p1", kit, orphan))).toMatch(/name an item that is on the canvas/);
  });

  it("reads kind:ref, and refuses anything else by name", () => {
    expect(parseCite("comment:cmt_1")).toEqual({ kind: "comment", ref: "cmt_1" });
    expect(parseCite("version:itm_a@v3")).toEqual({ kind: "version", ref: "itm_a@v3" });
    expect(parseCite("vibes:yes")).toHaveProperty("refused");
    expect(parseCite("comment:")).toHaveProperty("refused");
  });
});

describe("a delete that teaches", () => {
  it("carries the deleted id on an ordinary comment, and refuses a malformed one", () => {
    let s = propose(start(), "itm_p1");
    s = applyOperation(s, envelope({ type: "thread.reply", threadId: "thr_r", comment: { id: "cmt_d", body: deletedBody("Proposal", "the trigger was wrong"), deleted: "itm_p1", mentions: [kit.id] } }))!;
    const note = s.canvas.threads.thr_r!.comments.at(-1)!;
    expect(note.deleted).toBe("itm_p1");
    expect(note.body).toContain("the trigger was wrong");
    expect(() => applyOperation(s, envelope({ type: "thread.reply", threadId: "thr_r", comment: { id: "cmt_e", body: "x", deleted: "<script>" } }))).toThrow(OpValidationError);
  });

  it("the taste note is one pinned text node that gains a line at a time", () => {
    expect(tasteNote(start().canvas)).toBeNull();
    expect(tasteProperties()).toEqual({ taste: "1", context: "pinned" });
    const one = tasteWithLine(null, "No gates before value.");
    expect(one).toBe("# What your deletes taught\n- No gates before value.\n");
    expect(tasteWithLine(one, "  Keep the photo. ")).toBe("# What your deletes taught\n- No gates before value.\n- Keep the photo.\n");
  });
});

describe("design words", () => {
  it("splits a why at the terms it knows, and gives the sentence back whole", () => {
    const why = "Summary before detail: raise it in the visual hierarchy.";
    const spans = designWordSpans(why);
    expect(spans.map((s) => s.text).join("")).toBe(why);
    expect(spans.filter((s) => s.word).map((s) => s.word!.term)).toEqual(["summary before detail", "visual hierarchy"]);
    expect(designWordSpans("make it bigger").every((s) => !s.word)).toBe(true);
  });
});
