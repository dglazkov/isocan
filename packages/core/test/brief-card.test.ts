import { describe, expect, it } from "vitest";
import { applyOperation, citeLabel, proposalProperties } from "../src/index.ts";
import type { Actor, CanvasState, DesignBrief, NewVersion } from "../src/index.ts";
import {
  BRIEF_ASSUMED_CAP,
  briefCard,
  briefChanges,
  briefEditPatch,
  briefLineLabel,
  briefReread,
  briefScreens,
  findBriefLine,
  rereadAnswer,
  rereadAsk,
  rereadAsked,
  rereadBody,
  rereadQuestionRefusal,
  sensedMode,
  type BriefCardLine,
} from "../src/brief-card.ts";
import { envelope } from "./helpers.ts";

/**
 * **The brief, as a card** (proactive-agent phase 5, design §7). The card is
 * a reading of the brief record: said lines (`origin: supplied`) solid,
 * inferred ones (`assumed`, `context`, a sensed Right now) in pencil with
 * Right / Wrong; an edit is a patch for `design brief --update` and nothing
 * else; the re-read after it is derived — which screens assumed the old line
 * is read off what their proposals and receipts cite — and writes nothing.
 */
const maya: Actor = { id: "usr_maya", name: "Maya" };
const kit: Actor = { id: "usr_kit", name: "Kit" };

const html = (id: string): NewVersion => ({ id, blobHash: `hash_${id}`, mimeType: "text/html", filename: `${id}.html`, size: 10 });

function brief(over: Partial<DesignBrief> = {}): DesignBrief {
  return {
    schemaVersion: 1, kind: "brief", requestId: "req_acme", epoch: 1, requestingActorId: maya.id,
    source: { entrance: "canvas-chat", threadId: "thr_1", commentId: "cmt_1" },
    progress: "active", intent: "refine", fidelity: "designed", delivery: "html-node", targetItemId: null, groupId: null,
    audience: "regulars who order weekly", primaryTask: "a pre-order app", constraints: ["pickup only"],
    facts: [
      { id: "feel", name: "Should feel", value: "warm, quick", origin: "supplied", sources: [] },
      { id: "never", name: "Never", value: "pushy", origin: "assumed", sources: [] },
    ],
    context: { canvasId: "prj_test", revision: 1, rootIds: [], expandedIds: [], includeExcluded: false, ambient: true, entries: [], counts: { included: 0, excluded: 0, unavailable: 0 } },
    references: [], outstandingDecisionIds: [], outputIds: [],
    ...over,
  };
}

/** Acme: Menu, Checkout, Basket; Kit's proposal beneath Checkout answers For. */
function acme(): CanvasState {
  let s = applyOperation(null, envelope({ type: "project.create", canvasId: "prj_test", title: "Acme Bakery", description: "" }));
  for (const [i, [id, title]] of [["itm_menu", "Menu"], ["itm_checkout", "Checkout"], ["itm_basket", "Basket"]].entries()) {
    s = applyOperation(s, envelope({ type: "item.add", itemId: id!, version: html(`ver_${id}`), width: 390, height: 640, placement: { x: i * 470, y: 0 }, title: title! }, maya));
  }
  s = applyOperation(s, envelope({ type: "item.add", itemId: "itm_p", version: html("ver_p"), width: 390, height: 640, placement: { x: 470, y: 760 }, title: "Checkout — proposal", properties: proposalProperties("itm_checkout", "sure", [{ kind: "brief", ref: "for" }], "Summary before detail: regulars check the pickup slot first.") }, kit));
  return s!;
}

const line = (b: DesignBrief, name: string): BriefCardLine => findBriefLine(briefCard(b), name)!;

describe("the card reads said and inferred from origin", () => {
  it("draws the six lines in order; supplied is said, assumed and sensed are inferred", () => {
    const card = briefCard(brief(), acme().canvas);
    expect(card.lines.map((l) => [l.label, l.value, l.said, l.origin])).toEqual([
      ["Making", "a pre-order app", true, "supplied"],
      ["For", "regulars who order weekly", true, "supplied"],
      ["Should feel", "warm, quick", true, "supplied"],
      ["Never", "pushy", false, "assumed"],
      ["Constraints", "pickup only", true, "supplied"],
      ["Right now", "refining", false, "sensed"],
    ]);
    expect(card.intent).toBe("refine existing work");
  });

  it("an assumed fact under a line's own field is still pencil, and context reads as inferred", () => {
    const card = briefCard(brief({ audience: null, facts: [{ id: "aud", name: "Audience", value: "regulars", origin: "assumed", sources: [] }, { id: "tone", name: "Tone", value: "warm", origin: "context", sources: [] }] }));
    expect(findBriefLine(card, "For")).toMatchObject({ value: "regulars", said: false, factId: "aud", cite: "for" });
    expect(findBriefLine(card, "feel")).toMatchObject({ value: "warm", said: false, origin: "context" });
    expect(findBriefLine(card, "never")).toMatchObject({ value: null, said: false });
  });

  it("caps the inferred lines at four; the rest wait, counted", () => {
    const many = Array.from({ length: 6 }, (_, i) => ({ id: `guess${i}`, name: `Guess ${i}`, value: `g${i}`, origin: "assumed" as const, sources: [] }));
    const card = briefCard(brief({ facts: many }));
    expect(card.lines.filter((l) => l.value !== null && !l.said)).toHaveLength(BRIEF_ASSUMED_CAP);
    expect(card.quiet).toBe(3); // six guesses and the sensed Right now, four shown
  });

  it("senses Right now from the canvas: two takes in play is exploring, a finished request is shipping", () => {
    const s = acme();
    expect(sensedMode(s.canvas, brief({ intent: "refine" }))).toBe("refining");
    const two = applyOperation(s, envelope({ type: "item.add", itemId: "itm_v", version: html("ver_v"), width: 390, height: 640, placement: { x: 0, y: 760 }, title: "Menu B", properties: { parent: "itm_menu" } }, maya))!;
    expect(sensedMode(two.canvas, brief({ intent: "refine" }))).toBe("exploring");
    expect(sensedMode(s.canvas, brief({ progress: "completed" }))).toBe("shipping");
  });

  it("a proposal's chip names the line it answers", () => {
    const s = acme();
    expect(citeLabel(s.canvas, { kind: "brief", ref: "for" })).toBe("cites · For");
    expect(citeLabel(s.canvas, { kind: "brief", ref: "audience" })).toBe("cites · For");
    expect(citeLabel(s.canvas, { kind: "brief", ref: "fct_9" })).toBe("cites · fct_9");
    expect(briefLineLabel("Should feel")).toBe("Should feel");
  });
});

describe("Right and Wrong are patches for design brief --update", () => {
  it("Right turns an assumed fact supplied, and nothing else", () => {
    const b = brief();
    const patch = briefEditPatch(b, line(b, "never"), { act: "right" });
    expect(patch).toEqual({ facts: [b.facts[0], { ...b.facts[1], origin: "supplied" }] });
    const after = { ...b, ...patch } as DesignBrief;
    expect(line(after, "never")).toMatchObject({ said: true, value: "pushy" });
  });

  it("Right on a sensed Right now writes the person's now", () => {
    const b = brief({ intent: "create" });
    expect(briefEditPatch(b, line(b, "now"), { act: "right" })).toEqual({ facts: [...b.facts, { id: "now", name: "Right now", value: "exploring", origin: "supplied", sources: [] }] });
  });

  it("Wrong removes the inferred fact; with the right value, the person's takes its place", () => {
    const b = brief();
    expect(briefEditPatch(b, line(b, "never"), { act: "wrong" })).toEqual({ facts: [b.facts[0]] });
    expect(briefEditPatch(b, line(b, "never"), { act: "wrong", value: "salesy" })).toEqual({ facts: [b.facts[0], { id: "never", name: "Never", value: "salesy", origin: "supplied", sources: [] }] });
  });

  it("refuses what is not an inference, and an empty value", () => {
    const b = brief();
    expect(briefEditPatch(b, line(b, "for"), { act: "right" })).toEqual({ refused: "“For” is already what the person said" });
    expect(briefEditPatch(b, line(b, "for"), { act: "wrong" })).toMatchObject({ refused: expect.stringMatching(/is what the person said/) });
    expect(briefEditPatch(b, line(b, "now"), { act: "wrong" })).toMatchObject({ refused: expect.stringMatching(/exploring, refining, shipping/) });
    expect(briefEditPatch(b, line(b, "for"), { act: "set", value: "  " })).toEqual({ refused: "say what “For” should be" });
  });

  it("a new value goes to the brief's own field where the line has one", () => {
    const b = brief();
    expect(briefEditPatch(b, line(b, "for"), { act: "set", value: "regulars, and weekend first-timers" })).toEqual({ audience: "regulars, and weekend first-timers" });
    expect(briefEditPatch(b, line(b, "constraints"), { act: "set", value: "pickup only · no accounts" })).toEqual({ constraints: ["pickup only", "no accounts"] });
  });
});

describe("an edit changes nothing by itself; it only re-reads", () => {
  const before = brief();
  const after = brief({ audience: "regulars, and weekend first-timers" });

  it("names the line whose words changed, and a Right changes none", () => {
    expect(briefChanges(before, after)).toEqual([{ key: "for", label: "For", refs: ["for", "audience"], before: "regulars who order weekly", after: "regulars, and weekend first-timers" }]);
    const confirmed = { ...before, ...briefEditPatch(before, line(before, "never"), { act: "right" }) } as DesignBrief;
    expect(briefChanges(before, confirmed)).toEqual([]);
  });

  it("sorts every screen by what cites the changed line — proposals and receipts — and the lead's call", () => {
    const s = acme();
    const frozen = JSON.stringify(s);
    const changes = briefChanges(before, after);
    const read = briefReread(s.canvas, after, changes, { afterVersionId: "ver_b2", receipts: [{ outputItemId: "itm_basket", briefVersionId: "ver_b1" }, { outputItemId: "itm_menu", briefVersionId: "ver_b2" }], matters: ["itm_menu"] });
    expect(read.old).toEqual([
      { itemId: "itm_checkout", title: "Checkout", because: "its proposal “Checkout — proposal” cites For" },
      { itemId: "itm_basket", title: "Basket", because: "its evidence was checked against the brief before this edit" },
    ]);
    expect(read.more).toEqual([{ itemId: "itm_menu", title: "Menu" }]);
    expect(read.holds).toEqual([]);
    // Derived: the canvas it read is exactly as it was.
    expect(JSON.stringify(s)).toBe(frozen);
  });

  it("a change to another line leaves Checkout holding", () => {
    const s = acme();
    const read = briefReread(s.canvas, before, briefChanges(before, brief({ constraints: ["pickup or delivery"] })), { afterVersionId: "ver_b2" });
    expect(read.old).toEqual([]);
    expect(read.holds.map((r) => r.title)).toEqual(["Menu", "Checkout", "Basket"]);
    expect(briefScreens(s.canvas, before).map((i) => i.id)).not.toContain("itm_p");
  });

  it("the ask names the change and the sort; the answer is one question, read back", () => {
    let s = acme();
    const at = { itemId: "itm_brief", versionId: "ver_b2" };
    const read = briefReread(s.canvas, after, briefChanges(before, after), { afterVersionId: "ver_b2" });
    const ask = rereadAsk(kit, at, read);
    expect(ask).toMatch(/^@Kit Brief re-read, please \(itm_brief@ver_b2\): “For” is now “regulars, and weekend first-timers” \(was “regulars who order weekly”\)\. Assumed the old line: “Checkout”\. Still holds: “Menu”, “Basket”\./);
    expect(rereadQuestionRefusal("As well as regulars, or instead?")).toBeNull();
    expect(rereadQuestionRefusal("Who? And why?")).toMatch(/one question/);
    expect(rereadQuestionRefusal("Tell me more.")).toMatch(/question mark/);
    expect(rereadAsked(s.canvas, at)).toBe(false);
    s = applyOperation(s, envelope({ type: "thread.create", threadId: "thr_main", x: 0, y: 0, anchorItemId: null, main: true, comment: { id: "cmt_ask", body: ask } }, maya))!;
    expect(rereadAsked(s.canvas, at)).toBe(true);
    expect(rereadAnswer(s.canvas, at)).toBeNull();
    s = applyOperation(s, envelope({ type: "thread.reply", threadId: "thr_main", comment: { id: "cmt_answer", body: rereadBody(at, [{ id: "itm_menu", title: "Menu" }], "As well as regulars, or instead?"), record: true } }, kit))!;
    expect(rereadAnswer(s.canvas, at)).toMatchObject({ by: { name: "Kit" }, matters: ["itm_menu"], question: "As well as regulars, or instead?", commentId: "cmt_answer" });
    expect(rereadAnswer(s.canvas, { ...at, versionId: "ver_b3" })).toBeNull();
  });
});
