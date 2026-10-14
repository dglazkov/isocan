import { describe, expect, it } from "vitest";
import {
  HANDOFF_REVIEWED_PROP,
  OpValidationError,
  PROMISE_TAKE_PROP,
  PROPOSAL_CAP,
  answerLine,
  applyOperation,
  handoffProperties,
  invertOperation,
  mainThread,
  midwayItems,
  midwayRefusal,
  morningDue,
  morningText,
  namedByOthers,
  nightReview,
  planNight,
  promiseProperties,
  proposalProperties,
  readNote,
} from "../src/index.ts";
import type { Actor, CanvasState, LogEntry, NightLine, NightNote, Operation } from "../src/index.ts";

/**
 * **The morning review** (proactive-agent phase 3, design §5) on a synthetic
 * Acme Bakery night: Maya says goodnight at five, Kit fills two promised
 * frames (one sure, one failed with its reason and its take), edits Checkout
 * because she named it, and posts the brief. The trigger (her own goodnight;
 * a seen mark older than ready-by), the cap, the off-limits rule for what she
 * was mid-way through, Left alone, and closing the note once seen.
 */
const maya: Actor = { id: "usr_maya", name: "Maya" };
const ravi: Actor = { id: "usr_ravi", name: "Ravi" };
const kit: Actor = { id: "usr_kit", name: "Kit" };

const H = 3600_000;
const DAY = Date.UTC(2026, 9, 14, 0, 0, 0);
const GOODNIGHT = DAY + 17 * H;
const READY = DAY + 32 * H; // 8:00 the next morning
const iso = (ms: number) => new Date(ms).toISOString();

let seq = 0;
let entries: LogEntry[] = [];
function step(s: CanvasState | null, op: Operation, actor: Actor, at: number): CanvasState {
  seq += 1;
  const envelope = { id: `op_${seq}`, canvasId: op.type === "project.create" ? null : "prj_acme", actor, ts: iso(at), op };
  entries.push({ seq, envelope, inverse: null });
  return applyOperation(s, envelope)!;
}
const v = (id: string, mimeType = "text/html") => ({ id, blobHash: `hash_${id}`, mimeType, filename: `${id}.html`, size: 10 });
const add = (s: CanvasState, itemId: string, title: string, props: Record<string, string>, by: Actor, at: number, x = 0) =>
  step(s, { type: "item.add", itemId, version: v(`ver_${itemId}`), width: 390, height: 640, placement: { x, y: 0, chosen: true }, title, properties: props }, by, at);
const say = (s: CanvasState, id: string, body: string, by: Actor, at: number, extra: Record<string, unknown> = {}) =>
  mainThread(s.canvas)
    ? step(s, { type: "thread.reply", threadId: mainThread(s.canvas)!.id, comment: { id, body, ...extra } as never }, by, at)
    : step(s, { type: "thread.create", threadId: "thr_chat", x: 0, y: 0, anchorItemId: null, main: true, comment: { id, body, ...extra } as never }, by, at);

const LINES: NightLine[] = [
  { n: 1, text: "three takes on the empty basket", budget: "three takes", on: "itm_basket", edit: false, ticked: true },
  { n: 2, text: "group past orders by week", budget: "one take", on: "itm_history", edit: false, ticked: true },
  { n: 3, text: "pickup first", budget: "one new version", on: "itm_checkout", edit: true, ticked: true },
  { n: 4, text: "check the red against contrast", budget: "one take", on: "itm_history", edit: false, ticked: false },
];

/** The evening: four screens, Maya mid-way through Menu, her goodnight, and Kit's note with two frames. */
function evening(over: Partial<NightNote> = {}): { s: CanvasState; note: NightNote } {
  seq = 0;
  entries = [];
  let s = step(null, { type: "project.create", canvasId: "prj_acme", title: "Acme Bakery", description: "" }, maya, DAY);
  s = add(s, "itm_basket", "Basket", {}, maya, DAY + H, 0);
  s = add(s, "itm_checkout", "Checkout", {}, maya, DAY + H, 500);
  s = add(s, "itm_history", "Order history", {}, maya, DAY + H, 1000);
  s = add(s, "itm_menu", "Menu", {}, maya, DAY + H, 1500);
  s = step(s, { type: "item.addVersion", itemId: "itm_basket", version: v("ver_basket_2") }, maya, GOODNIGHT - 2 * H);
  s = step(s, { type: "item.addVersion", itemId: "itm_menu", version: v("ver_menu_2") }, maya, GOODNIGHT - 20 * 60_000);
  s = say(s, "cmt_gn", "/goodnight @Kit rework the checkout too", maya, GOODNIGHT);
  s.canvas.agents = { [kit.id]: { actor: kit } };
  const lines = LINES.map((l) => ({ ...l, ...(l.edit || !l.ticked ? {} : { frame: `itm_frame_${l.n}` }) }));
  const note: NightNote = {
    person: maya, lead: kit, settled: [], open: [], lines, wont: [], ready: iso(READY), named: ["itm_checkout"],
    titles: { itm_basket: "Basket", itm_history: "Order history", itm_checkout: "Checkout", itm_menu: "Menu" },
    midway: ["itm_menu"], left: [{ what: "Ravi's note about delivery", why: "a business decision, not a design one" }],
    ...over,
  };
  s = step(s, { type: "item.add", itemId: "itm_note", version: v("ver_note", "text/markdown"), width: 460, height: 600, placement: { x: 0, y: -900, chosen: true }, title: "Goodnight, Maya", properties: handoffProperties(note) }, kit, GOODNIGHT + 60_000);
  for (const l of lines) {
    if (!l.frame) continue;
    s = step(s, { type: "item.add", itemId: l.frame, version: v(`ver_${l.frame}`), width: 390, height: 640, placement: { x: 0, y: 900 + l.n * 700, chosen: true }, title: `${l.on} — promised tonight`, properties: promiseProperties("itm_note", l) }, kit, GOODNIGHT + 61_000);
  }
  return { s, note };
}

/** The night: frame 1 filled sure, frame 2 failed with its take, Checkout reworked, the brief posted. */
function night(): { s: CanvasState; note: NightNote } {
  let { s, note } = evening();
  const t = GOODNIGHT + 2 * H;
  s = step(s, { type: "item.addVersion", itemId: "itm_frame_1", version: v("ver_take_1") }, kit, t);
  s = step(s, { type: "item.update", itemId: "itm_frame_1", patch: { properties: { proposal: "sure", proposalWhy: "Empty states teach: show the first step." } } }, kit, t);
  note = answerLine(note, 1, { done: true });
  s = step(s, { type: "item.addVersion", itemId: "itm_frame_2", version: v("ver_take_2") }, kit, t + 1000);
  s = step(s, { type: "item.update", itemId: "itm_frame_2", patch: { properties: { proposal: "failed", proposalWhy: "every take broke the list's scan line", [PROMISE_TAKE_PROP]: "1" } } }, kit, t + 1000);
  note = answerLine(note, 2, { failed: "every take broke the list's scan line" });
  s = step(s, { type: "item.addVersion", itemId: "itm_checkout", version: v("ver_checkout_kit") }, kit, t + 2000);
  note = answerLine(note, 3, { done: true });
  s = step(s, { type: "item.update", itemId: "itm_note", patch: { properties: handoffProperties(note) } }, kit, t + 3000);
  s = say(s, "cmt_brief", "One take I'm sure of; the history regroup did not work. Checkout reworked, pickup first.", kit, t + 4000, { record: true, goodnight: { step: "brief", note: "itm_note" } });
  return { s, note };
}

describe("the trigger: back after your own goodnight, with a seen mark older than ready-by", () => {
  it("is due when the mark is from the evening, and when no visit was ever recorded", () => {
    const { s } = night();
    expect(morningDue(s.canvas, maya.id, { at: iso(GOODNIGHT - 5 * 60_000) }, READY + H)).toEqual({ noteId: "itm_note" });
    expect(morningDue(s.canvas, maya.id, null, READY + H)).toEqual({ noteId: "itm_note" });
  });

  it("is not due when the mark is newer than ready-by — she was already back", () => {
    const { s } = night();
    expect(morningDue(s.canvas, maya.id, { at: iso(READY + 60_000) }, READY + H)).toEqual({ not: "you have been back since its ready-by" });
  });

  it("is not due for someone with no goodnight: no goodnight, no morning review", () => {
    const { s } = night();
    expect(morningDue(s.canvas, ravi.id, null, READY + H)).toEqual({ not: "no goodnight of yours on this canvas" });
  });

  it("waits while the night is still on, and shows early once the brief is posted", () => {
    const { s } = evening();
    expect(morningDue(s.canvas, maya.id, { at: iso(GOODNIGHT) }, GOODNIGHT + 3 * H)).toEqual({ not: "the night is still on" });
    expect(morningDue(night().s.canvas, maya.id, { at: iso(GOODNIGHT) }, GOODNIGHT + 3 * H)).toEqual({ noteId: "itm_note" });
  });

  it("closes once seen: handoffReviewed ends the review, and the note stops blocking another person's night", () => {
    let { s } = evening();
    // A night that never answered: past ready-by, line 1 still promised — the note stays open.
    expect(namedByOthers(s.canvas, mainThread(s.canvas), ravi.id, READY + H).has("itm_basket")).toBe(true);
    s = step(s, { type: "item.update", itemId: "itm_note", patch: { properties: { [HANDOFF_REVIEWED_PROP]: iso(READY + H) } } }, maya, READY + H);
    expect(morningDue(s.canvas, maya.id, { at: iso(GOODNIGHT) }, READY + H)).toEqual({ not: "already reviewed" });
    expect(namedByOthers(s.canvas, mainThread(s.canvas), ravi.id, READY + H).size).toBe(0);
    expect(readNote(s.canvas.items.itm_note!)?.lines).toHaveLength(4);
  });
});

describe("closing the note is not the person's act", () => {
  it("has no inverse, so ⌘Z never reopens the note — while an ordinary update of the note still undoes", () => {
    const { s } = night();
    const close: Operation = { type: "item.update", itemId: "itm_note", patch: { properties: { [HANDOFF_REVIEWED_PROP]: iso(READY + H) } } };
    expect(invertOperation(s, close)).toBeNull();
    expect(invertOperation(s, { type: "item.update", itemId: "itm_note", patch: { properties: { [HANDOFF_REVIEWED_PROP]: iso(READY + H), other: "1" } } })).not.toBeNull();
    expect(invertOperation(s, { type: "item.update", itemId: "itm_note", patch: { title: "Renamed", properties: { [HANDOFF_REVIEWED_PROP]: iso(READY + H) } } })).not.toBeNull();
  });
});

describe("what the morning shows", () => {
  it("leads with the brief, then the proposals highest confidence first, Left alone with reasons, and the named original's version before", () => {
    const { s } = night();
    const review = nightReview(s.canvas, "itm_note", READY + H)!;
    expect(review.headline).toBeNull();
    expect(review.brief?.body).toMatch(/^One take I'm sure of/);
    expect(review.proposals.map((p) => [p.itemId, p.state])).toEqual([["itm_frame_1", "sure"], ["itm_frame_2", "failed"]]);
    expect(review.proposals[1]).toMatchObject({ why: "every take broke the list's scan line", take: true });
    expect(review.left).toEqual([
      { what: "Ravi's note about delivery", why: "a business decision, not a design one" },
      { what: "check the red against contrast", why: "you unticked it, so it was an offer, not a promise" },
      { what: "“Menu”", why: "you were still working on it when you left" },
    ]);
    expect(review.edited).toEqual([{ itemId: "itm_checkout", title: "Checkout", before: "ver_itm_checkout", after: "ver_checkout_kit" }]);
    const text = morningText(review);
    expect(text).toMatch(/Kit's brief for Maya/);
    expect(text).toMatch(/did not work — “itm_history — promised tonight” \(itm_frame_2\): every take broke/);
    expect(text).toMatch(/Left alone:\n {2}- Ravi's note about delivery — a business decision/);
    expect(text).toMatch(/isocan diff itm_checkout ver_itm_checkout ver_checkout_kit/);
  });

  it("never touches the person's other screens: only Checkout, which she named, has a version the night made", () => {
    const { s } = night();
    const byKit = Object.values(s.canvas.items)
      .filter((item) => item.createdBy.id === maya.id)
      .filter((item) => item.versions.some((ver) => ver.createdBy.id === kit.id))
      .map((item) => item.id);
    expect(byKit).toEqual(["itm_checkout"]);
  });

  it("caps the morning at five: a sixth proposal from the night is refused, and the list never runs past PROPOSAL_CAP", () => {
    let { s } = night();
    // Two frames are open; three more proposals fill the five.
    for (const n of [1, 2, 3]) {
      s = step(s, { type: "item.add", itemId: `itm_extra_${n}`, version: v(`ver_extra_${n}`), width: 390, height: 640, placement: { x: 3000 + n * 500, y: 0, chosen: true }, title: `Extra ${n}`, properties: proposalProperties("itm_basket", n === 3 ? "sure" : "hunch", [{ kind: "comment", ref: "cmt_gn" }], "Proximity: group what belongs together.") }, kit, GOODNIGHT + 3 * H + n);
    }
    expect(() => step(s, { type: "item.add", itemId: "itm_extra_4", version: v("ver_extra_4"), width: 390, height: 640, placement: { x: 6000, y: 0, chosen: true }, title: "Extra 4", properties: proposalProperties("itm_basket", "sure", [{ kind: "comment", ref: "cmt_gn" }], "One more.") }, kit, GOODNIGHT + 4 * H)).toThrow(OpValidationError);
    const review = nightReview(s.canvas, "itm_note", READY + H)!;
    expect(review.proposals).toHaveLength(PROPOSAL_CAP);
    expect(review.proposals.map((p) => p.state)).toEqual(["sure", "sure", "hunch", "hunch", "failed"]);
  });

  it("says plainly, in one line with the reason, when the night failed or made nothing", () => {
    const nothing = evening({ lines: [], nothing: "Nothing can answer overnight: no agent stands on this canvas to work overnight. Nothing is promised." }).s;
    expect(nightReview(nothing.canvas, "itm_note", READY + H)!.headline).toBe("Nothing was made overnight: no agent stands on this canvas to work overnight.");
    const unticked = evening({ lines: LINES.map((l) => ({ ...l, ticked: false })) }).s;
    expect(nightReview(unticked.canvas, "itm_note", READY + H)!.headline).toBe("Nothing was made overnight: you unticked every line, so nothing was promised.");
    const stopped = evening().s;
    expect(nightReview(stopped.canvas, "itm_note", READY + H)!.headline).toBe("The night did not finish: Kit answered 0 of 3 promises before it stopped.");
    const failedAll = evening({ lines: [{ ...LINES[1]!, n: 1, result: { failed: "every take broke the list's scan line" } }] }).s;
    expect(nightReview(failedAll.canvas, "itm_note", READY + H)!.headline).toBe("Nothing worth keeping overnight: every take broke the list's scan line.");
  });
});

describe("never on a screen the person was mid-way through", () => {
  it("reads what she changed in the hour before /goodnight, and nothing older", () => {
    const { s } = evening();
    expect(midwayItems(s.canvas, entries, maya.id, GOODNIGHT)).toEqual(["itm_menu"]);
  });

  it("refuses a line on it unless she named it in the conversation", () => {
    const { s } = evening();
    const base = { canvas: s.canvas, person: maya, lead: kit, cannotAnswer: null, settled: [], others: new Map(), midway: ["itm_menu"] };
    const out = planNight({ ...base, asks: [{ on: "itm_menu", text: "tighten the type scale" }], named: [] });
    expect("refused" in out && out.refused).toMatch(/Maya was still working on “Menu” in the hour before \/goodnight/);
    const ok = planNight({ ...base, asks: [{ on: "itm_menu", text: "tighten the type scale" }], named: ["itm_menu"] });
    expect("lines" in ok && ok.lines).toHaveLength(1);
  });

  it("refuses the night's own proposal beside it while the note is open, unless a ticked line names it", () => {
    const { s } = evening();
    expect(midwayRefusal(s.canvas, kit.id, "itm_menu", GOODNIGHT + H)).toMatch(/still working on “Menu” when they left/);
    expect(midwayRefusal(s.canvas, kit.id, "itm_basket", GOODNIGHT + H)).toBeNull();
    expect(midwayRefusal(s.canvas, ravi.id, "itm_menu", GOODNIGHT + H)).toBeNull();
    const named = evening({ lines: [{ ...LINES[0]!, on: "itm_menu" }] }).s;
    expect(midwayRefusal(named.canvas, kit.id, "itm_menu", GOODNIGHT + H)).toBeNull();
  });
});
