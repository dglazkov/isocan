import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { JevAnswer, JevResponse } from "@isocan/core/jev";
import type { DialogFacts } from "@isocan/core";
import { ECHO_MS, HOLD_MS, QUIET_MS, announce, createFastPath, type ModelCall } from "../src/fastact.ts";
import { fastPathQuestions, saysANumber, type FastPathAsk, type Thresholds } from "../src/fastpath.ts";
import { fastSummary } from "../src/fastpath-report.ts";
import type { ShadowTurn } from "../src/shadow.ts";
import { MEASURED, THRESHOLDS } from "../src/thresholds.ts";
import { runTool, snapshotItemsFor, type PanelFacts } from "../src/web.tsx";

/**
 * **The fast path acting** (voice-agent phase 7). Jev is never called: its
 * answers are written by hand, so each test says which answer it reads. The
 * executor is NOT a stand-in — it is `web.tsx`'s own `runTool`, the function
 * the model's tool calls go through, over a host that records what it is
 * asked to send. So "one op per fast act" is a claim about the real path.
 */

const screen = (id: string, title: string, x: number, y: number) => ({
  id, title, x, y, width: 320, height: 640, description: "", properties: {}, versions: [], currentVersionId: "",
});

function clock() {
  let t = 1_000;
  const timers: Array<{ at: number; fn: () => void; live: boolean }> = [];
  const settle = async () => {
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
  };
  return {
    now: () => t,
    setTimer: (fn: () => void, ms: number) => {
      const h = { at: t + ms, fn, live: true };
      timers.push(h);
      return h;
    },
    clearTimer: (h: unknown) => {
      if (h) (h as { live: boolean }).live = false;
    },
    async advance(ms: number) {
      const end = t + ms;
      for (;;) {
        await settle();
        const due = timers.filter((x) => x.live && x.at <= end).sort((a, b) => a.at - b.at)[0];
        if (!due) break;
        t = due.at;
        due.live = false;
        due.fn();
      }
      t = end;
      await settle();
    },
    settle,
  };
}

/** Jev's response, from the options chosen and the probability of each. */
function answer(ask: FastPathAsk, picks: { action: string; subject?: string; relation?: string; target?: string }, p = 0.9): JevResponse {
  const choice = (id: "action" | "subject" | "relation" | "target", value: string): JevAnswer => {
    const q = ask.request.questions[id]!;
    if (q.type !== "choice") throw new Error("not a choice");
    const keys = Object.keys(q.criteria);
    expect(keys).toContain(value);
    const rest = (1 - p) / (keys.length - 1);
    return { type: "choice", choice: value, probabilities: Object.fromEntries(keys.map((k) => [k, k === value ? p : rest])) };
  };
  return {
    model: "jev-test",
    answers: {
      action: choice("action", picks.action),
      subject: choice("subject", picks.subject ?? "none"),
      relation: choice("relation", picks.relation ?? "none"),
      target: choice("target", picks.target ?? "none"),
      simple: { type: "noul", noul: Math.max(p, 0.5) },
    },
    usage: { input_tokens: 1000, output_tokens: 0 },
  };
}

interface Harness {
  fast: ReturnType<typeof createFastPath>;
  clock: ReturnType<typeof clock>;
  sent: { ops: Record<string, unknown>[]; group?: string }[];
  retracted: number;
  told: string[];
  notes: string[];
  saved: ShadowTurn[];
  asks: number;
  canvas: { items: Record<string, ReturnType<typeof screen>> };
  /** Let Jev's pending answer arrive. */
  release: () => void;
}

/**
 * The fast path over a canvas of three Acme screens, with the real `runTool`
 * as its executor. `jevMs` is how long Jev takes; `null` holds the answer
 * until `release()` is called.
 */
function harness(pick: (ask: FastPathAsk) => JevResponse, opts: { thresholds?: Thresholds; jevMs?: number | null } = {}): Harness {
  const c = clock();
  const canvas = {
    items: {
      itm_login: screen("itm_login", "Login page", 0, 0),
      itm_home: screen("itm_home", "Home", 400, 0),
      itm_checkout: screen("itm_checkout", "Checkout", 800, 0),
    },
    threads: {},
    trash: [],
    agents: {},
  };
  const h = { sent: [], retracted: 0, told: [], notes: [], saved: [], asks: 0, canvas } as unknown as Harness;
  const facts = {
    canvasId: "prj_acme",
    groupMode: "legacy",
    canvas,
    selection: [],
    canEdit: true,
    host: {
      send: async (ops: readonly Record<string, unknown>[], group?: string) => {
        h.sent.push({ ops: [...ops], ...(group ? { group } : {}) });
        for (const op of ops) {
          if (op.type === "item.move") {
            const item = canvas.items[op.itemId as keyof typeof canvas.items];
            item.x = Number(op.x);
            item.y = Number(op.y);
          }
        }
      },
      putBlob: async () => ({ blobHash: "h", size: 1 }),
      retract: async () => {
        h.retracted++;
      },
      viewer: { id: "usr_acme", name: "Acme Viewer" },
      reveal: () => undefined,
      select: () => undefined,
      enrol: async () => ({ actorId: "x" }),
      commands: () => [],
      runCommand: async () => "local" as const,
    },
  } as unknown as PanelFacts;
  let pending: (() => void) | null = null;
  h.release = () => pending?.();
  h.clock = c;
  h.fast = createFastPath({
    canvasId: "prj_acme",
    thresholds: opts.thresholds ?? THRESHOLDS,
    ask: async (request) => {
      h.asks++;
      const g = fastPathQuestions((request.state as { utterance: string }).utterance, { items: snapshotItemsFor(canvas as never) });
      if (!g.ok) throw new Error(g.reason);
      const response = pick(g.ask);
      if (opts.jevMs === null) await new Promise<void>((r) => (pending = r));
      else await new Promise<void>((r) => c.setTimer(r, opts.jevMs ?? 150));
      return { response, ms: opts.jevMs ?? 150, by: "jev-test" };
    },
    items: () => snapshotItemsFor(canvas as never),
    runTool: (name, args) => runTool(name, args, facts),
    tell: (text) => h.told.push(text),
    note: (text) => h.notes.push(text),
    save: (t) => void h.saved.push(JSON.parse(JSON.stringify(t)) as ShadowTurn),
    now: c.now,
    setTimer: c.setTimer,
    clearTimer: c.clearTimer,
  });
  return h;
}

const moveHomeLeft: ModelCall = { id: "call_1", name: "move_item", args: { item_ref: "itm_home", by_x: -200 } };
const said = (h: Harness, ...pieces: string[]) => pieces.forEach((p) => h.fast.heard(p));

describe("the thresholds are data, measured", () => {
  it("only move has one, with the numbers that set it — at least 30 commands, at least 95% agreed", () => {
    expect(Object.keys(MEASURED)).toEqual(["move"]);
    expect(THRESHOLDS).toEqual({ move: MEASURED.move!.p });
    const m = MEASURED.move!;
    expect(m.n).toBeGreaterThanOrEqual(30);
    expect(m.agreement / m.n).toBeGreaterThanOrEqual(0.95);
    expect(m.source).toMatch(/197/);
    expect(m.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("the fast path acting", () => {
  it("acts above the threshold: one operation through the real runTool, announced, the model's duplicate dropped", async () => {
    const h = harness((a) => answer(a, { action: "move", subject: "Home", relation: "left-of" }, MEASURED.move!.p));
    said(h, "move the home", " screen left");
    h.fast.modelBegan();
    const gated = h.fast.gate([moveHomeLeft]);
    await h.clock.advance(QUIET_MS + 200);
    const verdicts = await gated;
    expect(h.sent).toHaveLength(1);
    expect(h.sent[0]!.ops).toHaveLength(1);
    expect(h.sent[0]!.ops[0]).toMatchObject({ type: "item.move", itemId: "itm_home", x: 400 - 160, y: 0 });
    expect(verdicts).toHaveLength(1);
    expect(verdicts[0]).toMatchObject({ run: false, response: { ok: false } });
    expect(String((verdicts[0] as unknown as { response: { error: string } }).response.error)).toMatch(/^already done by the fast path: moved “Home” left/);
    expect(h.notes).toContain("fast path: moved “Home” left — say undo");
    // The held call carried the news; no separate text turn.
    expect(h.told).toEqual([]);
    h.fast.turnDone();
    await h.fast.flush();
    expect(h.saved[0]!.fast).toMatchObject({ decision: "act", dropped: 1 });
    expect(h.saved[0]!.fast!.held).toBeGreaterThan(0);
    expect(h.saved[0]!.fast!.held).toBeLessThanOrEqual(HOLD_MS);
  });

  it("tells the live session when the model has made no call yet — and drops the duplicate when it comes", async () => {
    const h = harness((a) => answer(a, { action: "move", subject: "Login page", relation: "right-of", target: "Home" }, 0.95));
    said(h, "put the login page to the right of home");
    h.fast.modelBegan();
    await h.clock.advance(QUIET_MS + 200);
    expect(h.sent).toHaveLength(1);
    expect(h.sent[0]!.ops[0]).toMatchObject({ type: "item.move", itemId: "itm_login" });
    expect(h.told).toHaveLength(1);
    expect(h.told[0]).toMatch(/ALREADY been carried out.*moved “Login page” right of “Home”/);
    // The model, told mid-answer, still calls it in this turn: dropped.
    const v = await h.fast.gate([{ id: "c2", name: "move_item", args: { item_ref: "itm_login", beside_ref: "itm_home", side: "right" } }]);
    expect(v[0]!.run).toBe(false);
    h.fast.turnDone();
    // …or in its next turn, answering the text turn: the same act is still a duplicate.
    const next = h.fast.gate([{ id: "c3", name: "move_item", args: { item_ref: "Login", beside_ref: "Home" } }]);
    await h.clock.advance(QUIET_MS + 10);
    expect((await next)[0]!.run).toBe(false);
    expect(h.sent).toHaveLength(1);
  });

  it("escalates under the threshold: nothing done, the held call released unchanged", async () => {
    const h = harness((a) => answer(a, { action: "move", subject: "Home", relation: "left-of" }, MEASURED.move!.p - 0.01));
    said(h, "move home left");
    const gated = h.fast.gate([moveHomeLeft]);
    await h.clock.advance(QUIET_MS + 200);
    expect(await gated).toEqual([{ run: true }]);
    expect(h.sent).toHaveLength(0);
    h.fast.turnDone();
    await h.fast.flush();
    expect(h.saved[0]!.fast).toMatchObject({ decision: "escalate", dropped: 0 });
    expect(h.saved[0]!.reasons[0]).toMatch(/under move's threshold/);
  });

  it("escalates a number, however sure Jev is — but not the number in a title", async () => {
    const h = harness((a) => answer(a, { action: "move", subject: "Checkout", relation: "right-of" }, 0.99));
    said(h, "move the checkout 300 pixels to the right");
    const gated = h.fast.gate([{ id: "n", name: "move_item", args: { item_ref: "itm_checkout", by_x: 300 } }]);
    await h.clock.advance(QUIET_MS + 200);
    expect(await gated).toEqual([{ run: true }]);
    expect(h.sent).toHaveLength(0);
    const items = [{ id: "a", title: "Home v2", kind: "screen", x: 0, y: 0, width: 1, height: 1 }];
    expect(saysANumber("move home v2 to the left", items)).toBe(false);
    expect(saysANumber("move the blue one left", items)).toBe(false);
    expect(saysANumber("make it twice as big", items)).toBe(true);
    expect(saysANumber("move it to 500, 300", items)).toBe(true);
  });

  it("escalates an action with no measured threshold, however sure Jev is", async () => {
    const h = harness((a) => answer(a, { action: "delete", subject: "Checkout" }, 0.99));
    said(h, "delete the checkout screen");
    const gated = h.fast.gate([{ id: "d", name: "delete_item", args: { item_ref: "itm_checkout" } }]);
    await h.clock.advance(QUIET_MS + 200);
    expect(await gated).toEqual([{ run: true }]);
    expect(h.sent).toHaveLength(0);
  });

  it("releases the model's calls at the deadline, and does NOT act when Jev answers late", async () => {
    const h = harness((a) => answer(a, { action: "move", subject: "Home", relation: "left-of" }, 0.99), { jevMs: null });
    said(h, "move home left");
    const gated = h.fast.gate([moveHomeLeft]);
    await h.clock.advance(HOLD_MS);
    expect(await gated).toEqual([{ run: true }]);
    h.release();
    await h.clock.advance(100);
    expect(h.sent).toHaveLength(0);
    h.fast.turnDone();
    await h.fast.flush();
    expect(h.saved[0]!.fast).toMatchObject({ decision: "released", held: HOLD_MS });
  });

  it("voids Jev's answer when words arrive while it is being asked", async () => {
    const h = harness((a) => answer(a, { action: "move", subject: "Home", relation: "left-of" }, 0.99));
    said(h, "move home left");
    const gated = h.fast.gate([moveHomeLeft]);
    await h.clock.advance(QUIET_MS + 50); // asked, not yet answered
    said(h, " and then make it bigger");
    await h.clock.advance(200);
    expect(await gated).toEqual([{ run: true }]);
    expect(h.sent).toHaveLength(0);
    h.fast.turnDone();
    await h.fast.flush();
    expect(h.saved[0]!.reasons).toEqual(["the words were still arriving when Jev was asked"]);
  });

  it("records words that arrive after the act as late", async () => {
    const h = harness((a) => answer(a, { action: "move", subject: "Home", relation: "left-of" }, 0.99));
    said(h, "move home left");
    h.fast.modelBegan();
    await h.clock.advance(QUIET_MS + 200);
    expect(h.sent).toHaveLength(1);
    said(h, " a little");
    h.fast.turnDone();
    await h.fast.flush();
    expect(h.saved[0]!.fast).toMatchObject({ decision: "act", late: true });
    expect(fastSummary(h.saved)).toMatch(/words still arriving after the act: \*\*1 of 1\*\*/);
  });

  it("drops every acting call of a turn it acted on — even one that is not the same act — and runs the calls that only look", async () => {
    const h = harness((a) => answer(a, { action: "move", subject: "Home", relation: "left-of" }, 0.99));
    said(h, "move home left");
    const gated = h.fast.gate([
      { id: "r", name: "read_canvas", args: {} },
      { id: "m", name: "move_item", args: { item_ref: "itm_home", to_x: 0, to_y: 900 } },
    ]);
    await h.clock.advance(QUIET_MS + 200);
    expect((await gated).map((v) => v.run)).toEqual([true, false]);
    expect(h.sent).toHaveLength(1);
  });

  it("leaves a different act in the next turn to the model", async () => {
    const h = harness((a) => answer(a, { action: "move", subject: "Home", relation: "left-of" }, 0.99));
    said(h, "move home left");
    h.fast.modelBegan();
    await h.clock.advance(QUIET_MS + 200);
    h.fast.turnDone();
    const other = h.fast.gate([{ id: "x", name: "move_item", args: { item_ref: "itm_checkout", by_x: 100 } }]);
    await h.clock.advance(QUIET_MS + 10);
    expect(await other).toEqual([{ run: true }]);
    // And the same act after the echo window is the model's again.
    await h.clock.advance(ECHO_MS);
    h.fast.turnDone();
    const later = h.fast.gate([moveHomeLeft]);
    await h.clock.advance(QUIET_MS + 10);
    expect(await later).toEqual([{ run: true }]);
  });

  it("'undo' as a fast act retracts through the host — when a threshold for it is present", async () => {
    const h = harness((a) => answer(a, { action: "undo" }, 0.97), { thresholds: { ...THRESHOLDS, undo: 0.9 } });
    said(h, "undo that");
    const gated = h.fast.gate([{ id: "u", name: "undo", args: {} }]);
    await h.clock.advance(QUIET_MS + 200);
    expect(h.retracted).toBe(1);
    expect(h.sent).toHaveLength(0);
    expect((await gated)[0]!.run).toBe(false);
    expect(h.notes).toContain("fast path: undid your last change");
  });

  it("without an undo threshold, a spoken undo goes to the model — whose undo now retracts instead of refusing", async () => {
    const h = harness((a) => answer(a, { action: "undo" }, 0.99));
    said(h, "undo that");
    const gated = h.fast.gate([{ id: "u", name: "undo", args: {} }]);
    await h.clock.advance(QUIET_MS + 200);
    expect(await gated).toEqual([{ run: true }]);
    expect(h.retracted).toBe(0);
  });

  it("escalates a turn with no words at all, quickly", async () => {
    const h = harness(() => {
      throw new Error("Jev must not be asked about nothing");
    });
    const gated = h.fast.gate([moveHomeLeft]);
    await h.clock.advance(QUIET_MS + 1);
    expect(await gated).toEqual([{ run: true }]);
    expect(h.asks).toBe(0);
  });

  it("does not ask about words that never settled: a turn that ends while they arrive is the model's", async () => {
    const h = harness((a) => answer(a, { action: "move", subject: "Home", relation: "left-of" }, 0.99));
    said(h, "move the login");
    h.fast.modelBegan();
    await h.clock.advance(QUIET_MS - 100);
    said(h, " page");
    h.fast.turnDone(); // a barge-in, or the end of a turn, before the quiet ran out
    await h.clock.advance(QUIET_MS + 200);
    await h.fast.flush();
    expect(h.asks).toBe(0);
    expect(h.sent).toHaveLength(0);
    expect(h.saved[0]!.reasons).toEqual(["the turn ended while the words were still arriving"]);
  });

  it("announces in the past tense", () => {
    const items = snapshotItemsFor({ items: { a: screen("a", "Login", 0, 0), b: screen("b", "Home", 400, 0) } } as never);
    expect(announce({ act: "move-beside", subject: "a", target: "b", side: "left" }, items)).toBe("moved “Login” left of “Home” — say undo");
    expect(announce({ act: "undo" }, items)).toBe("undid your last change");
  });

  it("reaches the executor only through what it is handed", () => {
    const code = readFileSync(fileURLToPath(new URL("../src/fastact.ts", import.meta.url)), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(code).not.toMatch(/\.send\(|putBlob|fetch\(|from "\.\/web|planForCall/);
    expect(code).toMatch(/deps\.runTool\(/);
  });
});

describe("the browser's undo tool retracts", () => {
  it("through host.retract, once, and says whose change it took back", async () => {
    let n = 0;
    const facts = {
      canvasId: "prj_acme", groupMode: "legacy", canvas: { items: {}, threads: {}, trash: [] }, canEdit: true,
      host: { retract: async () => void n++, viewer: { id: "usr_a", name: "Acme Viewer" }, send: async () => { throw new Error("an undo is not a new operation"); } },
    } as unknown as DialogFacts;
    const r = await runTool("undo", {}, facts);
    expect(r).toMatchObject({ ok: true });
    expect(String(r.answer)).toMatch(/Acme Viewer's last change/);
    expect(n).toBe(1);
    const refused = await runTool("undo", {}, { ...facts, host: { ...facts.host, retract: async () => { throw new Error("nothing to undo"); } } } as unknown as DialogFacts);
    expect(refused).toMatchObject({ ok: false, error: "nothing was undone: nothing to undo" });
  });
});
