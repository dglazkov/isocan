import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { JevAnswer, JevRequest, JevResponse } from "@isocan/core/jev";
import { JUDGMENT_MAX_BYTES } from "@isocan/core";
import {
  FAST_ACT_NAMES, MAX_OPTIONS, NUDGE, canonicalCall, decide, fastActs, fastPathQuestions, itemOptions, modelAct, readProposal, sameAct,
  type FastPathAsk,
} from "../src/fastpath.ts";
import { numbers, reliability, rowsFromRecord, scored, thresholdFor, type EvalRow } from "../src/fastpath-report.ts";
import { LATE_PIECE_MS, UNDO_WINDOW_MS, createShadow, parseShadow, type ShadowTurn } from "../src/shadow.ts";
import { LIVE_TOOLS, canvasSnapshotText, type SnapshotItem } from "../src/live.ts";
import { DEFAULT_FIXTURE, canvasFor, truthOf, type Fixture } from "../scripts/fast-path-eval.ts";

/**
 * **The fast path, pure** (voice-agent phase 6): the questions a turn
 * becomes, the proposal the answers become, the rule that decides, and the
 * shadow that records and never acts. Jev itself is never called here — its
 * answers are written by hand, so each test says exactly which answer it is
 * reading.
 */

const item = (id: string, title: string, x: number, y: number, extra: Partial<SnapshotItem> = {}): SnapshotItem => ({
  id, title, kind: "screen", x, y, width: 320, height: 640, ...extra,
});

const ITEMS: SnapshotItem[] = [
  item("itm_login", "Login page", 0, 0),
  item("itm_home", "Home", 400, 0),
  item("itm_home2", "Home v2", 800, 0),
  item("itm_note", "Pricing card", 0, 800, { kind: "text", width: 220, height: 220, properties: { paper: "yellow" } }),
  item("itm_sketch", "Arrow", 400, 800, { kind: "drawing", width: 180, height: 120, properties: { ink: "red" } }),
];

/** Jev's response shape, from the options chosen and their probabilities. */
function answer(ask: FastPathAsk, picks: { action: string; subject?: string; relation?: string; target?: string; simple?: number }, p: Partial<Record<"action" | "subject" | "relation" | "target", number>> = {}): JevResponse {
  const choice = (id: "action" | "subject" | "relation" | "target", value: string): JevAnswer => {
    const q = ask.request.questions[id]!;
    if (q.type !== "choice") throw new Error("not a choice");
    const keys = Object.keys(q.criteria);
    expect(keys).toContain(value);
    const top = p[id] ?? 0.9;
    const rest = (1 - top) / (keys.length - 1);
    return { type: "choice", choice: value, probabilities: Object.fromEntries(keys.map((k) => [k, k === value ? top : rest])) };
  };
  return {
    model: "jev-test",
    answers: {
      action: choice("action", picks.action),
      subject: choice("subject", picks.subject ?? "none"),
      relation: choice("relation", picks.relation ?? "none"),
      target: choice("target", picks.target ?? "none"),
      simple: { type: "noul", noul: picks.simple ?? 0.9 },
    },
    usage: { input_tokens: 1000, output_tokens: 0 },
  };
}

function ask(utterance: string, items = ITEMS, lastAct?: string): FastPathAsk {
  const g = fastPathQuestions(utterance, { items, ...(lastAct ? { lastAct } : {}) });
  if (!g.ok) throw new Error(g.reason);
  return g.ask;
}

describe("question generation", () => {
  it("offers the acts whose tools the live session declares, and only those", () => {
    expect(fastActs(LIVE_TOOLS)).toEqual(FAST_ACT_NAMES);
    const noResize = LIVE_TOOLS.filter((t) => t.name !== "resize_item");
    expect(fastActs(noResize)).toEqual(FAST_ACT_NAMES.filter((a) => a !== "grow" && a !== "shrink"));
    const a = fastPathQuestions("make it bigger", { items: ITEMS }, noResize);
    expect(a.ok && Object.keys((a.ask.request.questions.action as { criteria: object }).criteria)).toEqual(["move", "delete", "undo", "select", "show", "none"]);
    expect(fastPathQuestions("move it", { items: ITEMS }, [])).toEqual({ ok: false, reason: "no fast-path act has a tool in this session" });
  });

  it("asks five questions whose item options are the canvas's items plus none", () => {
    const a = ask("move the login page left");
    expect(Object.keys(a.request.questions)).toEqual(["action", "subject", "relation", "target", "simple"]);
    const subject = a.request.questions.subject as { type: string; criteria: Record<string, string> };
    expect(subject.type).toBe("choice");
    expect(Object.keys(subject.criteria)).toEqual(["Login page", "Home", "Home v2", "Pricing card", "Arrow", "none"]);
    expect(a.request.questions.target).toMatchObject({ type: "choice" });
    expect(Object.keys((a.request.questions.target as { criteria: object }).criteria)).toEqual(Object.keys(subject.criteria));
    expect(Object.keys((a.request.questions.relation as { criteria: object }).criteria)).toEqual(["left-of", "right-of", "above", "below", "beside", "into", "none"]);
    expect(a.request.questions.simple).toMatchObject({ type: "noul" });
    // The option names what the canvas knows: kind and colour.
    expect(subject.criteria["Pricing card"]).toContain("yellow");
    expect(subject.criteria["Arrow"]).toContain("red");
    expect(a.ids).toMatchObject({ "Login page": "itm_login", Home: "itm_home" });
  });

  it("carries the utterance, the model's own projection and the last act in the state", () => {
    const a = ask("  move   it left ", ITEMS, "move “Home” right");
    expect(a.request.state).toEqual({ utterance: "move it left", canvas: canvasSnapshotText(ITEMS, [], MAX_OPTIONS), lastAct: "move “Home” right" });
  });

  it("keeps option keys unique and never 'none'", () => {
    const { criteria, ids } = itemOptions([item("a", "Home", 0, 0), item("b", "Home", 10, 0), item("c", "none", 20, 0), item("d", "", 30, 0)]);
    expect(Object.keys(criteria)).toEqual(["Home", "Home (2)", "none (item)", "untitled screen"]);
    expect(ids).toEqual({ Home: "a", "Home (2)": "b", "none (item)": "c", "untitled screen": "d" });
  });

  it("escalates a canvas over what one choice can carry — without asking", () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => item(`itm_${i}`, `S${i}`, i * 10, 0));
    expect(fastPathQuestions("move S1 left", { items: many(MAX_OPTIONS - 1) }).ok).toBe(true);
    const over = fastPathQuestions("move S1 left", { items: many(MAX_OPTIONS) });
    expect(over.ok).toBe(false);
    expect(!over.ok && over.reason).toMatch(/255 items/);
    expect(fastPathQuestions("move S1 left", { items: many(400) }).ok).toBe(false);
  });

  it("escalates a question file the home would refuse for size, and an empty turn", () => {
    const long = Array.from({ length: 200 }, (_, i) => item(`itm_${i}`, `${"A very long screen title ".repeat(12)}${i}`, i, 0));
    const g = fastPathQuestions("move it left", { items: long });
    expect(g.ok).toBe(false);
    expect(!g.ok && g.reason).toMatch(/bytes/);
    const fits = fastPathQuestions("move it left", { items: ITEMS });
    expect(fits.ok && JSON.stringify(fits.ask.request).length).toBeLessThan(JUDGMENT_MAX_BYTES);
    expect(fastPathQuestions("   ", { items: ITEMS })).toEqual({ ok: false, reason: "nothing was said" });
  });
});

describe("answers → a proposed tool call", () => {
  it("a move with a direction and no target is a nudge through move_item", () => {
    const a = ask("move the login page left");
    const p = readProposal(a, answer(a, { action: "move", subject: "Login page", relation: "left-of" }));
    expect(p.act).toEqual({ act: "move-by", subject: "itm_login", direction: "left" });
    expect(p.call).toEqual({ name: "move_item", args: { item_ref: "itm_login", by_x: -NUDGE, by_y: 0 } });
    expect(p.reasons).toEqual([]);
  });

  it("a move with a target is beside_ref + side, and 'beside' is the right side, as planForCall hears it", () => {
    const a = ask("put the login page next to home");
    const beside = readProposal(a, answer(a, { action: "move", subject: "Login page", relation: "beside", target: "Home" }));
    expect(beside.call).toEqual({ name: "move_item", args: { item_ref: "itm_login", beside_ref: "itm_home", side: "right" } });
    const below = readProposal(a, answer(a, { action: "move", subject: "Login page", relation: "below", target: "Home" }));
    expect(below.act).toEqual({ act: "move-beside", subject: "itm_login", target: "itm_home", side: "below" });
    // The call and the canonical act agree with each other through the same reading a model's call gets.
    expect(sameAct(canonicalCall(below.call!.name, below.call!.args, ITEMS)!, below.act)).toBe(true);
  });

  it("grow and shrink scale the item by 1.5 through resize_item", () => {
    const a = ask("make the arrow bigger");
    expect(readProposal(a, answer(a, { action: "grow", subject: "Arrow" })).call).toEqual({ name: "resize_item", args: { item_ref: "itm_sketch", width: 270, height: 180 } });
    expect(readProposal(a, answer(a, { action: "shrink", subject: "Arrow" })).call).toEqual({ name: "resize_item", args: { item_ref: "itm_sketch", width: 120, height: 80 } });
  });

  it("delete, select, show and undo map to their own tools", () => {
    const a = ask("x");
    expect(readProposal(a, answer(a, { action: "delete", subject: "Home" })).call).toEqual({ name: "delete_item", args: { item_ref: "itm_home" } });
    expect(readProposal(a, answer(a, { action: "select", subject: "Home" })).call).toEqual({ name: "selection_set", args: { item_refs: ["itm_home"] } });
    expect(readProposal(a, answer(a, { action: "show", subject: "Home" })).call).toEqual({ name: "viewport_focus", args: { item_ref: "itm_home" } });
    const u = readProposal(a, answer(a, { action: "undo" }));
    expect(u.call).toEqual({ name: "undo", args: {} });
    expect(u.act).toEqual({ act: "undo" });
  });

  it("escalates every structural refusal, with its reason", () => {
    const a = ask("x");
    const why = (picks: Parameters<typeof answer>[1]) => {
      const p = readProposal(a, answer(a, picks));
      expect(p.act).toEqual({ act: "escalate" });
      expect(p.call).toBeUndefined();
      return p.reasons;
    };
    expect(why({ action: "none" })).toContain("not a fast-path act");
    expect(why({ action: "move", subject: "Home", relation: "left-of", simple: 0.2 })).toContain("not one simple act");
    expect(why({ action: "delete" })).toContain("no item on the canvas is named");
    expect(why({ action: "move", subject: "Home", relation: "into", target: "Login page" })).toContain("no voice tool puts an item into a group");
    expect(why({ action: "move", subject: "Home", relation: "beside" })).toContain("beside nothing");
    expect(why({ action: "move", subject: "Home" })).toContain("a move with no place");
    expect(why({ action: "move", subject: "Home", relation: "left-of", target: "Home" })).toContain("an item cannot move beside itself");
    expect(why({ action: "delete", subject: "Home", target: "Login page" })).toContain("a second item is named");
  });

  it("p is the least certain answer the act relied on", () => {
    const a = ask("x");
    expect(readProposal(a, answer(a, { action: "move", subject: "Home", relation: "left-of" }, { action: 0.8, subject: 0.7, relation: 0.4, target: 0.95 })).p).toBeCloseTo(0.4);
    // Undo relies on the action and simple only — a confused subject does not lower it.
    expect(readProposal(a, answer(a, { action: "undo", subject: "Home" }, { action: 0.85, subject: 0.1 })).p).toBeCloseTo(0.85);
  });
});

describe("the act/escalate rule", () => {
  const a = ask("move home left");
  const confident = readProposal(a, answer(a, { action: "move", subject: "Home", relation: "left-of", simple: 0.99 }, { action: 0.99, subject: 0.99, relation: 0.99, target: 0.99 }));

  it("escalates everything when no threshold has been measured — phase 6's state", () => {
    expect(decide(confident, {})).toEqual({ decision: "escalate", reasons: ["no measured threshold for move"] });
  });

  it("acts only at or above the action's measured threshold", () => {
    expect(decide(confident, { move: 0.95 })).toEqual({ decision: "act", call: confident.call, act: confident.act });
    expect(decide(confident, { move: 0.995 }).decision).toBe("escalate");
    expect(decide(confident, { delete: 0.1 }).decision).toBe("escalate");
    const none = readProposal(a, answer(a, { action: "none" }));
    expect(decide(none, { move: 0 }).decision).toBe("escalate");
  });
});

describe("the model's calls, as one act", () => {
  it("reads move_item by delta, by destination and beside, resolving refs as runTool does", () => {
    expect(canonicalCall("move_item", { item_ref: "Login", by_x: -50 }, ITEMS)).toEqual({ act: "move-by", subject: "itm_login", direction: "left" });
    expect(canonicalCall("move_item", { item_ref: "itm_home", to_x: 400, to_y: 900 }, ITEMS)).toEqual({ act: "move-by", subject: "itm_home", direction: "down" });
    expect(canonicalCall("move_item", { item_ref: "Pricing", beside_ref: "itm_home" }, ITEMS)).toEqual({ act: "move-beside", subject: "itm_note", target: "itm_home", side: "right" });
    expect(canonicalCall("move_item", { item_ref: "Pricing", beside_ref: "itm_home", side: "under" }, ITEMS)).toMatchObject({ side: "below" });
    // "Home" is a prefix of two titles: unresolvable, as it is for runTool.
    expect(canonicalCall("move_item", { item_ref: "Home", by_x: 10 }, ITEMS)).toEqual({ act: "escalate" });
  });

  it("reads resizes as grow or shrink, and single-item batch tools as their single act", () => {
    expect(canonicalCall("resize_item", { item_ref: "itm_home", width: 400, height: 700 }, ITEMS)).toEqual({ act: "grow", subject: "itm_home" });
    expect(canonicalCall("resize_item", { item_ref: "itm_home", width: 100, height: 700 }, ITEMS)).toEqual({ act: "shrink", subject: "itm_home" });
    expect(canonicalCall("items_delete", { item_refs: ["itm_home"] }, ITEMS)).toEqual({ act: "delete", subject: "itm_home" });
    expect(canonicalCall("items_delete", { item_refs: ["itm_home", "itm_login"] }, ITEMS)).toEqual({ act: "escalate" });
    expect(canonicalCall("add_item", { title: "x" }, ITEMS)).toEqual({ act: "escalate" });
    expect(canonicalCall("read_canvas", {}, ITEMS)).toBeNull();
  });

  it("a turn of reads and one act is that act; two different acts, or none, is not a fast-path act", () => {
    expect(modelAct([{ name: "read_canvas" }, { name: "delete_item", args: { item_ref: "itm_home" } }], ITEMS)).toEqual({ act: "delete", subject: "itm_home" });
    expect(modelAct([], ITEMS)).toEqual({ act: "escalate" });
    expect(modelAct([{ name: "delete_item", args: { item_ref: "itm_home" } }, { name: "delete_item", args: { item_ref: "itm_login" } }], ITEMS)).toEqual({ act: "escalate" });
    expect(modelAct([{ name: "selection_set", args: { item_refs: ["itm_home"] } }, { name: "selection_set", args: { item_refs: ["itm_home"] } }], ITEMS)).toEqual({ act: "select", subject: "itm_home" });
  });
});

// ---------- the shadow

function clock() {
  let t = 1_000;
  const timers: Array<{ at: number; fn: () => void; live: boolean }> = [];
  return {
    now: () => t,
    setTimer: (fn: () => void, ms: number) => {
      const h = { at: t + ms, fn, live: true };
      timers.push(h);
      return h;
    },
    clearTimer: (h: unknown) => {
      (h as { live: boolean }).live = false;
    },
    async advance(ms: number) {
      const end = t + ms;
      for (;;) {
        const due = timers.filter((x) => x.live && x.at <= end).sort((a, b) => a.at - b.at)[0];
        if (!due) break;
        t = due.at;
        due.live = false;
        due.fn();
        await new Promise((r) => setTimeout(r, 0));
      }
      t = end;
      await new Promise((r) => setTimeout(r, 0));
    },
  };
}

function shadowHarness(pick: (ask: FastPathAsk) => JevResponse) {
  const c = clock();
  let items = ITEMS.map((i) => ({ ...i }));
  const saved: ShadowTurn[] = [];
  const notes: string[] = [];
  const asked: JevRequest[] = [];
  // A host-shaped object sits beside the deps, spying: the shadow must never reach it.
  const host = { send: () => { throw new Error("the shadow sent an operation"); }, putBlob: () => { throw new Error("the shadow wrote a blob"); } };
  const shadow = createShadow({
    canvasId: "prj_acme",
    ask: async (request) => {
      asked.push(request);
      const g = fastPathQuestions((request.state as { utterance: string }).utterance, { items: items });
      if (!g.ok) throw new Error(g.reason);
      return { response: pick(g.ask), ms: 180, by: "jev-test via the home" };
    },
    items: () => items,
    save: (t) => void saved.push(JSON.parse(JSON.stringify(t)) as ShadowTurn),
    note: (text) => notes.push(text),
    now: c.now,
    setTimer: c.setTimer,
    clearTimer: c.clearTimer,
    ...({ host } as object),
  });
  return {
    shadow, saved, notes, asked, clock: c, host,
    move(id: string, dx: number) {
      items = items.map((i) => (i.id === id ? { ...i, x: i.x + dx } : i));
      shadow.canvasChanged(items);
    },
    remove(id: string) {
      items = items.filter((i) => i.id !== id);
      shadow.canvasChanged(items);
    },
    get items() {
      return items;
    },
  };
}

describe("the shadow: records, never acts", () => {
  it("pairs a turn's words with the model's calls, asks once, and records the proposal — and nothing on the canvas moves", async () => {
    const h = shadowHarness((a) => answer(a, { action: "delete", subject: "Home" }, { action: 0.99, subject: 0.99, target: 0.99 }));
    const before = JSON.stringify(h.items);
    h.shadow.heard(" delete");
    h.shadow.heard(" the home screen");
    h.clock.now();
    h.shadow.toolCall("read_canvas", {});
    h.shadow.toolCall("delete_item", { item_ref: "itm_home" });
    h.shadow.turnDone();
    await h.clock.advance(LATE_PIECE_MS + UNDO_WINDOW_MS + 10);
    expect(h.asked).toHaveLength(1);
    expect(h.saved).toHaveLength(1);
    const t = h.saved[0]!;
    expect(t.utterance).toBe("delete the home screen");
    expect(t.proposed).toEqual({ act: "delete", subject: "itm_home" });
    expect(t.call).toEqual({ name: "delete_item", args: { item_ref: "itm_home" } });
    expect(t.model.act).toEqual({ act: "delete", subject: "itm_home" });
    expect(t.model.calls.map((c) => c.name)).toEqual(["read_canvas", "delete_item"]);
    expect(t.answers?.action).toMatchObject({ value: "delete" });
    expect(t.p).toBeCloseTo(0.9); // simple's 0.9 is the least certain
    expect(t.undone).toBe(false);
    expect(t.titles).toEqual({ itm_home: "Home" });
    expect(t.ms).toBe(180);
    // Even at p 0.9+ on every answer, nothing was executed: the canvas is as it was.
    expect(JSON.stringify(h.items)).toBe(before);
    expect(h.notes.at(-1)).toMatch(/^fast path \(shadow, did nothing\): Jev would delete “Home”/);
  });

  it("the shadow's source reaches no executor", () => {
    const src = readFileSync(fileURLToPath(new URL("../src/shadow.ts", import.meta.url)), "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(code).not.toMatch(/runTool|planForCall|\.send\(|putBlob|from "\.\/web/);
    const fp = readFileSync(fileURLToPath(new URL("../src/fastpath.ts", import.meta.url)), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(fp).not.toMatch(/runTool|\.send\(|fetch\(/);
  });

  it("labels a keyboard undo inside the window from the canvas: moved, then back", async () => {
    const h = shadowHarness((a) => answer(a, { action: "move", subject: "Home", relation: "left-of" }));
    h.shadow.heard("move home left");
    h.shadow.toolCall("move_item", { item_ref: "itm_home", by_x: -200 });
    h.move("itm_home", -200); // the model's act lands
    h.shadow.turnDone();
    await h.clock.advance(LATE_PIECE_MS + 2000);
    h.move("itm_home", 200); // ⌘Z puts it back
    await h.clock.advance(UNDO_WINDOW_MS);
    expect(h.saved[0]).toMatchObject({ undone: true, undoneBy: "canvas", model: { act: { act: "move-by", subject: "itm_home", direction: "left" } } });
  });

  it("labels a spoken undo in the next turn inside the window, and not one after it", async () => {
    const h = shadowHarness((a) => answer(a, { action: "delete", subject: "Arrow" }));
    h.shadow.heard("delete the arrow");
    h.shadow.toolCall("delete_item", { item_ref: "itm_sketch" });
    h.remove("itm_sketch");
    h.shadow.turnDone();
    await h.clock.advance(LATE_PIECE_MS + 3000);
    h.shadow.heard("no, undo that");
    h.shadow.toolCall("undo", {});
    h.shadow.turnDone();
    await h.clock.advance(LATE_PIECE_MS + UNDO_WINDOW_MS + 10);
    expect(h.saved[0]).toMatchObject({ undone: true, undoneBy: "said" });
    expect(h.saved[1]).toMatchObject({ utterance: "no, undo that", model: { act: { act: "undo" } }, undone: false });

    const late = shadowHarness((a) => answer(a, { action: "delete", subject: "Arrow" }));
    late.shadow.heard("delete the arrow");
    late.shadow.toolCall("delete_item", { item_ref: "itm_sketch" });
    late.shadow.turnDone();
    await late.clock.advance(LATE_PIECE_MS + UNDO_WINDOW_MS + 10);
    late.shadow.heard("undo");
    late.shadow.turnDone();
    await late.clock.advance(LATE_PIECE_MS + UNDO_WINDOW_MS + 10);
    expect(late.saved[0]).toMatchObject({ undone: false });
  });

  it("keeps transcription that trails the end of the turn, and hands the last act to the next turn", async () => {
    const h = shadowHarness((a) => answer(a, { action: "move", subject: "Pricing card", relation: "right-of" }));
    h.shadow.heard("move the pricing");
    h.shadow.toolCall("move_item", { item_ref: "itm_note", by_x: 100 });
    h.shadow.turnDone();
    h.shadow.heard(" card right"); // late piece
    await h.clock.advance(LATE_PIECE_MS + 1);
    h.shadow.heard("and now make it bigger");
    h.shadow.turnDone();
    await h.clock.advance(LATE_PIECE_MS + UNDO_WINDOW_MS + 10);
    expect(h.saved[0]!.utterance).toBe("move the pricing card right");
    expect(h.saved[0]!.timing.firstCall).toBe(0);
    expect(h.asked[1]!.state).toMatchObject({ lastAct: "move “Pricing card” right" });
    expect(h.saved[1]!.model.act).toEqual({ act: "escalate" }); // the model did nothing that turn
  });

  it("flush saves what is pending, and a window cut short says so", async () => {
    const h = shadowHarness((a) => answer(a, { action: "delete", subject: "Home" }));
    h.shadow.heard("delete home");
    h.shadow.toolCall("delete_item", { item_ref: "itm_home" });
    await h.shadow.flush();
    expect(h.saved).toHaveLength(1);
    expect(h.saved[0]!.undone).toBeNull();
  });

  it("records a failed ask as an error, not as an escalation Jev chose", async () => {
    const h = shadowHarness(() => { throw Object.assign(new Error("this home has no judge"), { code: "judgment-unavailable" }); });
    h.shadow.heard("delete home");
    h.shadow.turnDone();
    await h.clock.advance(LATE_PIECE_MS + UNDO_WINDOW_MS + 10);
    expect(h.saved[0]).toMatchObject({ error: "this home has no judge", proposed: { act: "escalate" } });
    expect(h.notes.at(-1)).toMatch(/could not be asked/);
  });

  it("round-trips through the record's own format, skipping a torn line", () => {
    const t: ShadowTurn = {
      v: 1, at: "2026-09-23T10:00:00.000Z", canvasId: "prj_acme", utterance: "undo", items: 3, proposed: { act: "undo" }, reasons: [],
      model: { calls: [{ name: "undo", args: {} }], act: { act: "undo" } }, undone: false, titles: {}, timing: { done: 900 },
    };
    expect(parseShadow(`${JSON.stringify(t)}\n{"v":1,"utter`)).toEqual([t]);
  });
});

describe("the report", () => {
  it("a threshold needs 95% on at least 30, and is the lowest cut that has it", () => {
    const right = (p: number) => ({ p, right: true });
    expect(thresholdFor(Array.from({ length: 29 }, () => right(0.9)))).toBeNull();
    expect(thresholdFor(Array.from({ length: 30 }, (_, i) => right(0.5 + i / 100)))).toEqual({ cut: 0.5, n: 30, accuracy: 1 });
    // Three wrong low answers push the cut up until what is kept clears 95%.
    const pts = [{ p: 0.3, right: false }, { p: 0.35, right: false }, { p: 0.4, right: false }, ...Array.from({ length: 40 }, (_, i) => right(0.6 + i / 200))];
    expect(thresholdFor(pts)?.cut).toBeCloseTo(0.35);
    expect(reliability([{ p: 0.95, right: false }, { p: 0.95, right: true }]).ece).toBeCloseTo(0.45);
  });

  it("scores a person's record against the model's unreverted act; an undone act is wrong to agree with", () => {
    const base = { v: 1 as const, at: "2026-09-23T10:00:00.000Z", canvasId: "p", items: 3, reasons: [], titles: {}, timing: { done: 1 } };
    const del = { act: "delete" as const, subject: "itm_home" };
    const turns: ShadowTurn[] = [
      { ...base, utterance: "delete home", proposed: del, p: 0.8, model: { calls: [], act: del }, undone: false },
      { ...base, utterance: "delete home", proposed: del, p: 0.8, model: { calls: [], act: del }, undone: true, undoneBy: "canvas" },
      { ...base, utterance: "delete login", proposed: { act: "escalate" }, p: 0.4, model: { calls: [], act: del }, undone: true },
      { ...base, utterance: "hello", proposed: { act: "escalate" }, model: { calls: [], act: { act: "escalate" } }, undone: false },
    ];
    const { rows } = rowsFromRecord(turns);
    expect(rows.map(scored)).toEqual([true, false, null, true]);
    const x = numbers(rows);
    expect(x.agreement).toBeCloseTo(2 / 3);
    expect(x.perAction.find((a) => a.action === "delete")).toMatchObject({ proposed: 2, right: 1, threshold: null });
  });
});

describe("the scripted command set", () => {
  const fixture = JSON.parse(readFileSync(DEFAULT_FIXTURE, "utf8")) as Fixture;

  it("is 120+ synthetic commands on an Acme canvas, ≥30 of them complex, each meaning an act the tools can do or escalate", () => {
    expect(fixture.commands.length).toBeGreaterThanOrEqual(120);
    expect(fixture.commands.filter((c) => c.complex && c.expect === "escalate").length).toBeGreaterThanOrEqual(30);
    expect(new Set(fixture.commands.map((c) => c.id)).size).toBe(fixture.commands.length);
    for (const c of fixture.commands) {
      expect(() => truthOf(fixture, c), c.id).not.toThrow();
      expect(fastPathQuestions(c.say, canvasFor(fixture, c)).ok, c.id).toBe(true);
      for (const id of c.selected ?? []) expect(fixture.canvas.items.some((i) => i.id === id), c.id).toBe(true);
    }
    const kinds = new Set(fixture.commands.map((c) => truthOf(fixture, c).act));
    expect([...kinds].sort()).toEqual(["delete", "escalate", "grow", "move-beside", "move-by", "select", "show", "shrink", "undo"]);
  });

  it("scores a flat stub as useless — the pipeline is not flattering by construction", () => {
    const rows: EvalRow[] = fixture.commands.map((c) => ({
      id: c.id, utterance: c.say, truth: truthOf(fixture, c), complex: !!c.complex, proposed: { act: "escalate" }, action: "none", p: null, reasons: [], ms: 0, tokens: 0, by: "",
    }));
    const x = numbers(rows);
    expect(x.agreement).toBeLessThan(0.3); // only the must-escalate commands agree
    expect(x.pooledThreshold).toBeNull();
    expect(x.escalation.recall).toBe(1);
  });
});
