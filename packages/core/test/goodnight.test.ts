import { describe, expect, it } from "vitest";
import {
  OpValidationError,
  PROPOSAL_CAP,
  answerLine,
  applyOperation,
  briefRefusal,
  convergePlan,
  fillTarget,
  goodnightNotes,
  HANDOFF_PROP,
  goodnightTalk,
  handoffProperties,
  isRefusal,
  leftOpen,
  mainThread,
  namedByOthers,
  nightAnswerable,
  nightLead,
  noteText,
  planNight,
  promiseProperties,
  proposalMarked,
  proposalProperties,
  proposalRoom,
  readNote,
  readyAt,
  settledToday,
  untickLine,
} from "../src/index.ts";
import type { Actor, CanvasState, FillTarget, GoodnightTalk, LogEntry, NightAsk, NightCited, NightInput, NightLead, NightLine, NightNote, NightSeen, Operation, PresenceSession } from "../src/index.ts";

/**
 * **The night watch** (proactive-agent phase 2, design §4) — the derivations
 * and the promise rules, on a synthetic Acme Bakery day. Every rule the
 * phase names has a case here: what the day settled and left open, only
 * agreed lines, the cap with promised frames counted, will-not-touch, one
 * person's night never touching another's, an edit only of an original the
 * person named, and the honest refusal when nothing can answer.
 */
const maya: Actor = { id: "usr_maya", name: "Maya" };
const ravi: Actor = { id: "usr_ravi", name: "Ravi" };
const kit: Actor = { id: "usr_kit", name: "Kit" };

const TODAY = Date.UTC(2026, 9, 14, 9, 0, 0);
const YESTERDAY = TODAY - 24 * 3600_000;
const SINCE = Date.UTC(2026, 9, 14, 0, 0, 0);

let seq = 0;
let entries: LogEntry[] = [];

function step(s: CanvasState | null, op: Operation, actor: Actor = maya, at = TODAY + seq * 1000, cause?: LogEntry["cause"]): CanvasState {
  seq += 1;
  const envelope = { id: `op_${seq}`, canvasId: op.type === "project.create" ? null : "prj_acme", actor, ts: new Date(at).toISOString(), op };
  entries.push({ seq, envelope, inverse: null, ...(cause ? { cause } : {}) });
  return applyOperation(s, envelope)!;
}

const v = (id: string, hash = `hash_${id}`, mimeType = "text/html") => ({ id, blobHash: hash, mimeType, filename: `${id}.html`, size: 10 });
const add = (s: CanvasState, itemId: string, title: string, props: Record<string, string> = {}, by: Actor = maya, at?: number, x = 0): CanvasState =>
  step(s, { type: "item.add", itemId, version: v(`ver_${itemId}`), width: 390, height: 640, placement: { x, y: 0, chosen: true }, title, properties: props }, by, at);

/**
 * Maya's day: yesterday's Menu and its variation B; today she chose B (a
 * `choose`: B's bytes as Menu's new version, B trashed), kept a wireframe
 * maybe, wrote a DESIGN.md version, and preferred something she then undid.
 * Kit asked two questions nobody answered.
 */
function day(): CanvasState {
  seq = 0;
  entries = [];
  let s = step(null, { type: "project.create", canvasId: "prj_acme", title: "Acme Bakery", description: "" }, maya, YESTERDAY);
  s = add(s, "itm_menu", "Menu", {}, maya, YESTERDAY, 0);
  s = add(s, "itm_menu_b", "Menu B", { parent: "itm_menu" }, maya, YESTERDAY, 2000);
  s = add(s, "itm_wire", "Sign-up wire", { wireMaybe: "0.40" }, maya, YESTERDAY, 4000);
  s = add(s, "itm_ds", "DESIGN.md", { role: "design-system" }, maya, YESTERDAY, 6000);
  s = add(s, "itm_checkout", "Checkout", {}, maya, YESTERDAY, 8000);
  s = add(s, "itm_basket", "Basket", {}, maya, YESTERDAY, 10000);
  s = add(s, "itm_history", "Order history", {}, maya, YESTERDAY, 12000);
  // Today: the choose — one group of an addVersion with B's bytes and B to the trash.
  s = step(s, { type: "item.addVersion", itemId: "itm_menu", version: v("ver_menu_2", "hash_ver_itm_menu_b") });
  s = step(s, { type: "item.delete", itemId: "itm_menu_b" });
  s = step(s, { type: "item.update", itemId: "itm_wire", patch: { properties: { wireKeep: "1" } } });
  s = step(s, { type: "item.addVersion", itemId: "itm_ds", version: v("ver_ds_2", "hash_ds_2", "text/markdown") });
  s = step(s, { type: "item.update", itemId: "itm_checkout", patch: { properties: { preferredOver: "itm_menu" } } });
  const undone = seq;
  s = step(s, { type: "item.update", itemId: "itm_checkout", patch: { removeProperties: ["preferredOver"] } }, maya, undefined, { kind: "undo", targetSeq: undone });
  s = step(s, { type: "thread.create", threadId: "thr_q1", x: 0, y: 0, anchorItemId: "itm_basket", comment: { id: "cmt_q1", body: "/ask Should the empty basket suggest a loaf?" } }, kit);
  s = step(s, { type: "thread.create", threadId: "thr_q2", x: 0, y: 0, anchorItemId: "itm_history", comment: { id: "cmt_q2", body: "/ask Group past orders by week?" } }, kit);
  s.canvas.agents = { [kit.id]: { actor: kit } };
  return s;
}

/** The Chat: a goodnight conversation by `who`, ending with "That's the plan" when `planned`. */
function talk(s: CanvasState, who: Actor, words: string[], planned: boolean, items: string[] = []): CanvasState {
  const main = mainThread(s.canvas);
  const say = (state: CanvasState, comment: Record<string, unknown>, by: Actor) =>
    main || mainThread(state.canvas)
      ? step(state, { type: "thread.reply", threadId: mainThread(state.canvas)!.id, comment: comment as never }, by)
      : step(state, { type: "thread.create", threadId: "thr_chat", x: 0, y: 0, anchorItemId: null, main: true, comment: comment as never }, by);
  s = say(s, { id: `cmt_gn_${who.id}_${seq}`, body: `/goodnight @Kit ${words[0] ?? ""}`, ...(items.length ? { items } : {}) }, who);
  s = say(s, { id: `cmt_kit_${seq}`, body: "Settled today: the menu. Left open: the empty basket. I could rework Order history tonight." }, kit);
  for (const w of words.slice(1)) s = say(s, { id: `cmt_${seq}`, body: w }, who);
  if (planned) s = say(s, { id: `cmt_plan_${seq}`, body: "That's the plan.", goodnight: { step: "plan" } }, who);
  return s;
}

function input(s: CanvasState, asks: NightAsk[], over: Partial<NightInput> = {}): NightInput {
  const t = goodnightTalk(s.canvas, mainThread(s.canvas), maya.id);
  return {
    canvas: s.canvas,
    person: maya,
    lead: kit,
    cannotAnswer: null,
    asks,
    named: t?.named ?? [],
    settled: settledToday(s.canvas, entries, maya.id, SINCE),
    others: namedByOthers(s.canvas, mainThread(s.canvas), maya.id, TODAY),
    ...over,
  };
}

function lines(out: ReturnType<typeof planNight>): NightLine[] {
  if ("refused" in out) throw new Error(out.refused);
  return out.lines;
}

function refused(out: ReturnType<typeof planNight>): string {
  if (!("refused" in out)) throw new Error(`expected a refusal, got ${JSON.stringify(out)}`);
  return out.refused;
}

describe("settled today and left open, derived and cited", () => {
  it("lists exactly the choose, the kept maybe and the DESIGN.md version — not yesterday, not the undone", () => {
    const s = day();
    const settled: NightCited[] = settledToday(s.canvas, entries, maya.id, SINCE);
    expect(settled.map((x) => [x.what, `${x.cite.kind}:${x.cite.ref}`])).toEqual([
      ["chose “Menu B” for Menu", "version:itm_menu@v2"],
      ["a new version of DESIGN.md", "design:itm_ds@v2"],
      ["kept the maybe “Sign-up wire”", `op:${entries.find((e) => e.envelope.op.type === "item.update")!.seq}`],
    ]);
    // Somebody else's day is not hers: Ravi settled nothing.
    expect(settledToday(s.canvas, entries, ravi.id, SINCE).map((x) => x.what)).toEqual(["a new version of DESIGN.md"]);
  });

  it("left open is the two unanswered questions, each citing its comment", () => {
    const s = day();
    expect(leftOpen(s.canvas).map((x) => `${x.cite.kind}:${x.cite.ref}`).sort()).toEqual(["comment:cmt_q1", "comment:cmt_q2"]);
    expect(leftOpen(s.canvas).map((x) => x.what).join(" | ")).toContain("Should the empty basket suggest a loaf?");
  });
});

describe("the conversation", () => {
  it("names what the PERSON named — by title or #-reference — and knows when they said that's the plan", () => {
    let s = talk(day(), maya, ["", "rework the checkout screen please", "and not the contrast check"], false, ["itm_basket"]);
    let t: GoodnightTalk = goodnightTalk(s.canvas, mainThread(s.canvas), maya.id)!;
    expect(t.planned).toBe(false);
    // Kit said "Order history"; that is a suggestion, not her word.
    expect(t.named.sort()).toEqual(["itm_basket", "itm_checkout"]);
    s = step(s, { type: "thread.reply", threadId: mainThread(s.canvas)!.id, comment: { id: "cmt_p", body: "That's the plan.", goodnight: { step: "plan" } } }, maya);
    t = goodnightTalk(s.canvas, mainThread(s.canvas), maya.id)!;
    expect(t.planned).toBe(true);
    // Typed rather than pressed, it is the same word.
    const typed = talk(day(), maya, ["", "That’s the plan, thanks"], false);
    expect(goodnightTalk(typed.canvas, mainThread(typed.canvas), maya.id)!.planned).toBe(true);
    expect(goodnightTalk(s.canvas, mainThread(s.canvas), ravi.id)).toBeNull();
  });
});

describe("the promise rules", () => {
  const basket: NightAsk = { on: "itm_basket", text: "Three takes on the empty basket, one a sketch", budget: "three takes" };
  const contrast: NightAsk = { on: "itm_checkout", text: "Check the red against contrast" };

  it("promises only the agreed lines, ticked, with their budgets", () => {
    const s = talk(day(), maya, ["", "rework the checkout screen"], true);
    const out = lines(planNight(input(s, [basket, { on: "itm_checkout", text: "Rework the checkout: pickup first", edit: true }])));
    expect(out.map((l) => [l.n, l.on, l.edit, l.ticked, l.budget])).toEqual([
      [1, "itm_basket", false, true, "three takes"],
      [2, "itm_checkout", true, true, "one new version"],
    ]);
    expect(refused(planNight(input(s, [{ on: "itm_gone", text: "something" }])))).toMatch(/names no item/);
    expect(refused(planNight(input(s, [{ on: "itm_basket", text: "  " }])))).toMatch(/says nothing/);
  });

  it("edits an original only when the person named it, and never the design system or what was settled today", () => {
    const s = talk(day(), maya, ["", "rework the checkout screen, the menu and DESIGN.md too"], true);
    expect(refused(planNight(input(s, [{ on: "itm_history", text: "Rework order history", edit: true }])))).toMatch(/Maya did not name “Order history”.*propose beside it/);
    expect(refused(planNight(input(s, [{ on: "itm_ds", text: "Tighten the type scale", edit: true }])))).toMatch(/design system is never edited/);
    expect(refused(planNight(input(s, [{ on: "itm_menu", text: "Rework the menu", edit: true }])))).toMatch(/settled today.*will-not-touch/);
    // Beside it is always fine: a proposal touches nothing.
    expect(lines(planNight(input(s, [{ on: "itm_history", text: "A grouped history" }])))).toHaveLength(1);
    expect(lines(planNight(input(s, [{ on: "itm_checkout", text: "Pickup first", edit: true }])))[0]!.edit).toBe(true);
  });

  it(`counts promised frames toward the cap of ${PROPOSAL_CAP}: room for one is room for one`, () => {
    let s = talk(day(), maya, [""], true);
    for (let i = 1; i < PROPOSAL_CAP; i++) {
      s = step(s, { type: "item.add", itemId: `itm_p${i}`, version: v(`ver_p${i}`), width: 390, height: 640, placement: { x: 0, y: 800 * i }, title: `P${i}`, properties: proposalProperties("itm_basket", "sure", [{ kind: "op", ref: "1" }], "Proximity.") }, kit);
    }
    expect(proposalRoom(s.canvas, kit.id)).toBe(1);
    expect(refused(planNight(input(s, [basket, contrast])))).toMatch(/room for 1 more proposal tonight, not 2.*promised frames included/);
    // An edit is not a proposal, so it needs no room.
    const s2 = talk(s, maya, ["", "rework the checkout"], true);
    expect(lines(planNight(input(s2, [basket, { on: "itm_checkout", text: "Rework", edit: true }])))).toHaveLength(2);
    // A promised frame is a proposal the reducer counts: the fifth fills the cap.
    const frame = promiseProperties("itm_note", { n: 1, text: "Three takes", budget: "three takes", on: "itm_basket", edit: false, ticked: true });
    s = step(s, { type: "item.add", itemId: "itm_frame", version: v("ver_frame"), width: 390, height: 640, placement: { x: 0, y: 5000 }, title: "Basket — promised tonight", properties: frame }, kit);
    expect(proposalMarked(s.canvas.items.itm_frame!)).toBe(true);
    expect(proposalRoom(s.canvas, kit.id)).toBe(0);
    const none = planNight(input(s, [basket]));
    expect("nothing" in none && none.nothing).toMatch(/Nothing new tonight: 5 of my proposals are already waiting/);
    expect(lines(none)).toEqual([]);
  });

  it("never touches an item another person's open goodnight named — note or conversation", () => {
    let s = talk(day(), ravi, ["", "have a look at the basket overnight"], false);
    s = talk(s, maya, [""], true);
    const others = namedByOthers(s.canvas, mainThread(s.canvas), maya.id, TODAY);
    expect([...others.entries()].map(([id, who]) => [id, who.name])).toEqual([["itm_basket", "Ravi"]]);
    expect(refused(planNight(input(s, [basket])))).toMatch(/“Basket” is in Ravi's goodnight tonight/);
    // Ravi's own night may.
    const ravis = { ...input(s, [basket]), person: ravi, others: namedByOthers(s.canvas, mainThread(s.canvas), ravi.id, TODAY) };
    expect(lines(planNight(ravis))).toHaveLength(1);
  });

  it("refuses to promise when nothing can answer — and the note says why", () => {
    const s = talk(day(), maya, [""], true);
    const props = { proactive: "Kit" };
    const silent: NightSeen = { answering: { parked: false, actorIds: [] }, sessions: [] };
    const lead: NightLead = nightLead(s.canvas, props, silent);
    expect(lead.agent?.actor.id).toBe(kit.id);
    expect(lead.how).toBe("named");
    const why = nightAnswerable(lead, maya.id, silent)!;
    expect(why).toMatch(/nothing is answering for Kit here/);
    const out = planNight(input(s, [basket], { cannotAnswer: why }));
    expect(lines(out)).toEqual([]);
    const note: NightNote = { person: maya, lead: kit, settled: [], open: [], lines: [], wont: [], ready: readyAt("8:00", TODAY)!, nothing: "nothing" in out ? out.nothing! : "", named: [], titles: {} };
    expect(noteText(note)).toMatch(/## Tonight I will\nNothing can answer overnight: nothing is answering for Kit here.*Nothing is promised\./);
    // Answering: an rc holds Kit, or Kit is parked on wait — unless its gate turns Maya away.
    expect(nightAnswerable(lead, maya.id, { answering: { parked: true, actorIds: [kit.id] } })).toBeNull();
    const parked = { sessionId: "s1", actor: kit, kind: "cli" } as unknown as PresenceSession;
    expect(nightAnswerable(lead, maya.id, { sessions: [parked] })).toBeNull();
    const gated: NightSeen = { answering: { parked: true, actorIds: [kit.id], policies: { [kit.id]: { owner: ravi, listen: [] } } } };
    expect(nightAnswerable(lead, maya.id, gated)).toMatch(/Kit does not take your word here.*ask Ravi/);
    // No lead at all, and a lead named but not enrolled.
    expect(nightAnswerable(nightLead({ ...s.canvas, agents: {} }, {}, silent), maya.id, silent)).toMatch(/no agent stands on this canvas/);
    expect(nightAnswerable(nightLead(s.canvas, { proactive: "Juno" }, silent), maya.id, silent)).toMatch(/"Juno" is named to lead here/);
  });

  it("picks the canvas's answerable standing agent when no lead is named, never a critic", () => {
    const s = day();
    const critic: Actor = { id: "usr_crit", name: "Critic" };
    const juno: Actor = { id: "usr_juno", name: "Juno" };
    s.canvas.agents = { [critic.id]: { actor: critic, ceiling: "note" }, [kit.id]: { actor: kit }, [juno.id]: { actor: juno } };
    expect(nightLead(s.canvas, {}, { answering: { parked: true, actorIds: [juno.id, critic.id] } }).agent?.actor.name).toBe("Juno");
    expect(nightLead(s.canvas, {}, {}).agent?.actor.name).toBe("Kit");
  });
});

describe("the note on the canvas: untick, fill, the brief", () => {
  /** Kit's note for Maya, written as `isocan goodnight note` writes it: the note, then a promised frame. */
  function written(): { s: CanvasState; note: NightNote } {
    let s = talk(day(), maya, ["", "rework the checkout screen"], true);
    const planned = lines(planNight(input(s, [{ on: "itm_basket", text: "Three takes on the empty basket" }, { on: "itm_history", text: "Check the red against contrast" }, { on: "itm_checkout", text: "Pickup first", edit: true }])));
    planned[0]!.frame = "itm_f1";
    planned[1]!.frame = "itm_f2";
    const note: NightNote = { person: maya, lead: kit, settled: settledToday(s.canvas, entries, maya.id, SINCE), open: leftOpen(s.canvas), lines: planned, wont: [], ready: readyAt("8:00", TODAY)!, named: ["itm_checkout"], titles: { itm_basket: "Basket", itm_history: "Order history", itm_checkout: "Checkout" } };
    s = step(s, { type: "item.add", itemId: "itm_note", version: v("ver_note", "hash_note", "text/markdown"), width: 400, height: 600, placement: { x: 20000, y: 0 }, title: "Goodnight, Maya", properties: handoffProperties(note) }, kit);
    for (const line of planned.filter((l) => l.frame)) {
      s = step(s, { type: "item.add", itemId: line.frame!, version: v(`ver_${line.frame}`), width: 390, height: 640, placement: { x: 0, y: 3000 + line.n * 800 }, title: "promised", properties: promiseProperties("itm_note", line) }, kit);
    }
    return { s, note };
  }

  it("the note's text has every heading, the ticked lines with budgets, and what may be edited", () => {
    const { s, note } = written();
    expect(readNote(s.canvas.items.itm_note!)).toEqual(note);
    expect(s.canvas.items.itm_note!.properties[HANDOFF_PROP]).toBe(maya.id);
    expect(goodnightNotes(s.canvas).map((n) => n.item.id)).toEqual(["itm_note"]);
    const text = noteText(note);
    expect(text).toContain("Kit's note for tonight · Kit is standing by overnight · ready by 8:00");
    for (const heading of ["## Settled today", "## Left open", "## Tonight I will", "## Will not touch", "## Ready by"]) expect(text).toContain(heading);
    expect(text).toContain("- [x] Three takes on the empty basket — beside “Basket” · one take");
    expect(text).toContain("- [x] Pickup first — edits “Checkout”, as a new version · one new version");
    expect(text).toContain("- every original you did not name for editing");
    expect(text).toContain("(named for editing: “Checkout”)");
  });

  it("unticking a line keeps it as an offer and takes its frame", () => {
    const { note } = written();
    const out = untickLine(note, 2);
    if ("refused" in out) throw new Error(out.refused);
    expect(out.frame).toBe("itm_f2");
    expect(out.note.lines.find((l) => l.n === 2)).toMatchObject({ ticked: false });
    expect(out.note.lines.find((l) => l.n === 2)!.frame).toBeUndefined();
    expect(noteText(out.note)).toContain("- [ ] Check the red against contrast — beside “Order history” · one take — unticked: an offer, not a promise");
    const again = untickLine(out.note, 2);
    expect("refused" in again && again.refused).toMatch(/already unticked/);
  });

  it("fills only its own promised frames and named originals; Keep refuses an empty frame", () => {
    const { s } = written();
    const target: FillTarget | { refused: string } = fillTarget(s.canvas, kit.id, "itm_f1", TODAY);
    expect(target).toMatchObject({ kind: "frame", line: { n: 1 } });
    expect(fillTarget(s.canvas, kit.id, "itm_checkout", TODAY)).toMatchObject({ kind: "edit", line: { n: 3 } });
    expect(fillTarget(s.canvas, ravi.id, "itm_f1", TODAY)).toMatchObject({ refused: expect.stringMatching(/another agent's note/) });
    expect(fillTarget(s.canvas, kit.id, "itm_basket", TODAY)).toMatchObject({ refused: expect.stringMatching(/the night never edits anything else/) });
    const plan = convergePlan(s.canvas, "itm_f1");
    expect(isRefusal(plan) && plan.refused).toMatch(/promised frame, still empty/);
  });

  it("the brief waits until every ticked promise is filled or failed with a reason", () => {
    const { note } = written();
    expect(briefRefusal(note)).toMatch(/line 1 .* is still promised/);
    let n = answerLine(note, 1, { done: true });
    n = answerLine(n, 2, { failed: "every take broke the list's scan line" });
    expect(briefRefusal(n)).toMatch(/line 3/);
    n = answerLine(n, 3, { done: true });
    expect(briefRefusal(n)).toBeNull();
    expect(noteText(n)).toContain("— did not work: every take broke the list's scan line");
  });
});

describe("at the writer", () => {
  it("a promised frame cites the line that promised it, or is refused", () => {
    const s = day();
    const bad = { ...promiseProperties("itm_note", { n: 1, text: "x", budget: "one take", on: "itm_basket", edit: false, ticked: true }), proposalCites: JSON.stringify([{ kind: "op", ref: "1" }]) };
    expect(() => step(s, { type: "item.add", itemId: "itm_bad", version: v("ver_bad"), width: 10, height: 10, placement: { x: 0, y: 9000 }, properties: bad }, kit)).toThrow(/cites the goodnight line/);
  });

  it("a goodnight comment is a plan, or a brief naming its note", () => {
    const s = day();
    expect(() => step(s, { type: "thread.create", threadId: "thr_b", x: 0, y: 0, anchorItemId: null, comment: { id: "cmt_b", body: "done", record: true, goodnight: { step: "brief" } } }, kit)).toThrow(OpValidationError);
    const ok = step(s, { type: "thread.create", threadId: "thr_b", x: 0, y: 0, anchorItemId: null, comment: { id: "cmt_b", body: "done", record: true, goodnight: { step: "brief", note: "itm_note" } } }, kit);
    expect(ok.canvas.threads.thr_b!.comments[0]!.goodnight).toEqual({ step: "brief", note: "itm_note" });
  });
});
