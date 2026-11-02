import { describe, expect, it } from "vitest";
import type { CanvasContents, LogEntry, Operation } from "../src/index.ts";
import {
  STUCK_QUICK_MS,
  STUCK_WINDOW_MS,
  stuckAll,
  stuckAnswerBody,
  stuckAnswered,
  stuckAxis,
  stuckOn,
  stuckQuestionBody,
  stuckQuestionOf,
  stuckQuestionRefusal,
  stuckSections,
  type StuckQuestion,
} from "../src/stuck.ts";

/**
 * **Stuck detection** (proactive-agent phase 7): a pure reading of a synthetic
 * Acme log. Maya asks Kit for a new header in the Chat; Kit answers each ask
 * with a version; Maya sets each aside. The trigger's boundaries are each a
 * case: three misses trip it and two do not; three tries on three items do
 * not; a kept take resets it; a slow, equally long ask is a keep; a window
 * too wide, or too long ago, is not stuck; an undo, a deleted variation and
 * shrinking asks all count as misses; and an answer to the question starts
 * the count again.
 */

const MAYA = { id: "usr_maya", name: "Maya" };
const KIT = { id: "usr_kit", name: "Kit" };
const T0 = Date.parse("2026-10-14T10:00:00.000Z");
const iso = (ms: number) => new Date(T0 + ms).toISOString();
const S = 1000;
const M = 60_000;

class Log {
  entries: LogEntry[] = [];
  private seq = 0;
  private n = 0;
  constructor() {
    this.op({ type: "thread.create", threadId: "thr_main", x: 0, y: 0, anchorItemId: null, main: true, comment: { id: "cmt_hello", body: "Hello", mentions: [] } }, 0, MAYA);
  }
  op(op: Operation, at: number, actor = KIT, over: Partial<LogEntry> = {}): LogEntry {
    const e: LogEntry = { seq: ++this.seq, envelope: { id: `op_${this.seq}`, canvasId: "prj_acme", actor, ts: iso(at), op }, inverse: null, ...over };
    this.entries.push(e);
    return e;
  }
  /** Maya, in the Chat, about the item. */
  ask(body: string, at: number, items: string[] = ["itm_header"], thread = "thr_main"): string {
    const id = `cmt_${++this.n}`;
    this.op({ type: "thread.reply", threadId: thread, comment: { id, body, mentions: [KIT.id], items } }, at, MAYA);
    return id;
  }
  /** Kit's take: a new version of the item. */
  take(at: number, itemId = "itm_header"): { seq: number; versionId: string } {
    const versionId = `ver_${++this.n}`;
    const e = this.op({ type: "item.addVersion", itemId, version: { id: versionId, blobHash: `h${this.n}`, mimeType: "text/html", filename: "h.html", size: 1 } }, at);
    return { seq: e.seq, versionId };
  }
  /** Maya steps the item back to the version before. */
  setAside(at: number, itemId = "itm_header"): void {
    this.op({ type: "item.setCurrentVersion", itemId, versionId: "ver_original" }, at, MAYA);
  }
  undo(targetSeq: number, at: number, actor = KIT): void {
    this.op({ type: "item.removeVersion", itemId: "itm_header", versionId: "x", prevCurrentVersionId: "ver_original" }, at, actor, { cause: { kind: "undo", targetSeq } });
  }
}

/** Three tries, each set aside within half a minute, then a fourth ask. */
function stuckLog(): { log: Log; fourth: string } {
  const log = new Log();
  log.ask("Make a new header for the menu, warmer, with the photo", 0);
  log.take(20 * S);
  log.setAside(45 * S);
  log.ask("Again, but warmer", 3 * M);
  log.take(3 * M + 20 * S);
  log.setAside(3 * M + 40 * S);
  log.ask("again", 6 * M);
  log.take(6 * M + 20 * S);
  log.setAside(6 * M + 30 * S);
  const fourth = log.ask("no", 8 * M);
  return { log, fourth };
}

describe("stuckOn", () => {
  it("three takes on one item, each set aside, trip it — and the fourth ask waits for a question", () => {
    const { log, fourth } = stuckLog();
    const s = stuckOn(log.entries, "itm_header", MAYA.id);
    expect(s).not.toBeNull();
    expect(s!.tries.map((t) => t.fate)).toEqual(["set aside", "set aside", "set aside"]);
    expect(s!.tries.every((t) => t.by.id === KIT.id)).toBe(true);
    expect(s!.pending).toEqual({ commentId: fourth, at: iso(8 * M), ask: "no" });
    expect(s!.at).toBe(`itm_header · ${fourth}`);
    expect(s!.shorter).toBe(true);
    expect(s!.facts[0]).toBe("Three tries in 8 minutes, and none of them landed: three set aside.");
    expect(s!.facts[1]).toBe("The quickest went after 10 seconds.");
    expect(s!.facts[2]).toBe("The asks got shorter: “Make a new header for the menu warmer with the photo” → “Again but warmer” → “again” → “no”.");
  });

  it("two misses do not trip it", () => {
    const log = new Log();
    log.ask("a new header", 0);
    log.take(10 * S);
    log.setAside(20 * S);
    log.ask("again", 1 * M);
    log.take(1 * M + 10 * S);
    log.setAside(1 * M + 20 * S);
    log.ask("no", 2 * M);
    expect(stuckOn(log.entries, "itm_header", MAYA.id)).toBeNull();
  });

  it("three tries on three items do not", () => {
    const log = new Log();
    for (const [i, item] of ["itm_header", "itm_menu", "itm_footer"].entries()) {
      log.ask(`a new one ${i}`, i * M, [item]);
      log.take(i * M + 10 * S, item);
      log.setAside(i * M + 20 * S, item);
    }
    log.ask("no", 4 * M, ["itm_footer"]);
    for (const item of ["itm_header", "itm_menu", "itm_footer"]) expect(stuckOn(log.entries, item, MAYA.id)).toBeNull();
    expect(stuckAll(log.entries)).toEqual([]);
  });

  it("a kept take resets it: three misses after a keep trip it, two misses after it do not", () => {
    const log = new Log();
    log.ask("a new header", 0);
    log.take(10 * S);
    log.setAside(20 * S);
    log.ask("again", 1 * M);
    log.take(1 * M + 10 * S);
    log.setAside(1 * M + 20 * S);
    // A take that stands, and the next ask comes after the quick window, with as many words: kept.
    log.ask("try a darker one", 2 * M);
    log.take(2 * M + 10 * S);
    log.ask("now the footer too", 2 * M + 10 * S + STUCK_QUICK_MS + 1);
    log.take(5 * M);
    log.setAside(5 * M + 10 * S);
    log.ask("again", 6 * M);
    log.take(6 * M + 10 * S);
    log.setAside(6 * M + 20 * S);
    log.ask("no", 7 * M);
    expect(stuckOn(log.entries, "itm_header", MAYA.id)).toBeNull();
    log.take(7 * M + 10 * S);
    log.setAside(7 * M + 20 * S);
    log.ask("no", 8 * M);
    const s = stuckOn(log.entries, "itm_header", MAYA.id);
    expect(s?.tries.map((t) => t.ask)).toEqual(["now the footer too", "again", "no"]);
  });

  it("the quick boundary: asked again at exactly two minutes misses; a moment later, with as many words, keeps", () => {
    const quick = new Log();
    for (let i = 0; i < 4; i++) {
      quick.ask("one more header take", i * (STUCK_QUICK_MS + 10 * S));
      if (i < 3) quick.take(i * (STUCK_QUICK_MS + 10 * S) + 10 * S);
    }
    expect(stuckOn(quick.entries, "itm_header", MAYA.id)?.tries.map((t) => t.fate)).toEqual(["asked again", "asked again", "asked again"]);
    const slow = new Log();
    for (let i = 0; i < 4; i++) {
      slow.ask("one more header take", i * (STUCK_QUICK_MS + 11 * S));
      if (i < 3) slow.take(i * (STUCK_QUICK_MS + 11 * S) + 10 * S);
    }
    expect(stuckOn(slow.entries, "itm_header", MAYA.id)).toBeNull();
  });

  it("asks getting shorter count as misses even when slow", () => {
    const log = new Log();
    const bodies = ["make the header warmer and keep the photo", "warmer still, keep the photo", "warmer, please", "no"];
    for (const [i, b] of bodies.entries()) {
      log.ask(b, i * 4 * M);
      if (i < 3) log.take(i * 4 * M + 10 * S);
    }
    expect(stuckOn(log.entries, "itm_header", MAYA.id)?.tries.map((t) => t.fate)).toEqual(["asked shorter", "asked shorter", "asked shorter"]);
  });

  it("the window: tries spread past fifteen minutes are not stuck; stuck long ago is not stuck now", () => {
    const wide = new Log();
    for (let i = 0; i < 4; i++) {
      wide.ask("again", i * 6 * M);
      if (i < 3) {
        wide.take(i * 6 * M + 10 * S);
        wide.setAside(i * 6 * M + 20 * S);
      }
    }
    expect(stuckOn(wide.entries, "itm_header", MAYA.id)).toBeNull();
    const { log } = stuckLog();
    expect(stuckOn(log.entries, "itm_header", MAYA.id, T0 + 8 * M + STUCK_WINDOW_MS)).not.toBeNull();
    expect(stuckOn(log.entries, "itm_header", MAYA.id, T0 + 8 * M + STUCK_WINDOW_MS + 1)).toBeNull();
  });

  it("an undo and a deleted variation are misses too; a take by the asker is not a try", () => {
    const log = new Log();
    log.ask("a new header", 0);
    const first = log.take(10 * S);
    log.undo(first.seq, 30 * S);
    log.ask("again", 1 * M);
    log.op({ type: "item.add", itemId: "itm_var", version: { id: "ver_v", blobHash: "hv", mimeType: "text/html", filename: "v.html", size: 1 }, width: 10, height: 10, placement: { x: 0, y: 0 }, properties: { parent: "itm_header" } }, 1 * M + 10 * S);
    log.op({ type: "item.delete", itemId: "itm_var" }, 1 * M + 30 * S, MAYA);
    log.ask("again", 2 * M);
    // Maya's own edit is not an answer to her ask.
    log.op({ type: "item.addVersion", itemId: "itm_header", version: { id: "ver_m", blobHash: "hm", mimeType: "text/html", filename: "h.html", size: 1 } }, 2 * M + 5 * S, MAYA);
    log.take(2 * M + 10 * S);
    log.setAside(2 * M + 20 * S);
    log.ask("no", 3 * M);
    expect(stuckOn(log.entries, "itm_header", MAYA.id)?.tries.map((t) => t.fate)).toEqual(["undone", "deleted", "set aside"]);
  });

  it("an ask that names nothing is about what the person's last ask in that thread named", () => {
    const { log } = stuckLog();
    // The fixture names the item on every ask; strip all but the first.
    for (const e of log.entries.slice(2)) {
      const op = e.envelope.op;
      if (op.type === "thread.reply") op.comment.items = [];
    }
    expect(stuckOn(log.entries, "itm_header", MAYA.id)).not.toBeNull();
  });

  it("an answer to the question starts the count again", () => {
    const { log, fourth } = stuckLog();
    const at = `itm_header · ${fourth}`;
    log.op({ type: "thread.reply", threadId: "thr_main", comment: { id: "cmt_q", body: `Stuck question (${at})\n…`, record: true } }, 8 * M + 10 * S);
    log.ask(stuckAnswerBody(KIT, at, null, { kind: "extremes" }), 9 * M);
    expect(stuckOn(log.entries, "itm_header", MAYA.id)).toBeNull();
    log.take(9 * M + 10 * S);
    log.setAside(9 * M + 20 * S);
    log.ask("no", 10 * M);
    expect(stuckOn(log.entries, "itm_header", MAYA.id)).toBeNull();
  });

  it("stuckAll finds who is stuck on what", () => {
    const { log } = stuckLog();
    expect(stuckAll(log.entries).map((s) => [s.person.id, s.itemId])).toEqual([[MAYA.id, "itm_header"]]);
  });
});

describe("the stuck question", () => {
  const q: StuckQuestion = {
    observations: ["You kept the photo every time.", "You undid the colour twice."],
    tiles: [
      { axis: "density", now: "Roomy, one idea per row", instead: "Dense, more at a glance", guess: "now" },
      { axis: "brand", now: "Quiet, the photo speaks", instead: "Loud, the bakery's red", guess: "instead" },
      { axis: "layout", now: "Photo on top", instead: "Photo beside the words", guess: "now" },
      { axis: "tone", now: "Plain", instead: "Warm, a little playful", guess: "instead" },
    ],
  };

  it("is refused when nobody is stuck, and when it says the person is stuck", () => {
    const { log } = stuckLog();
    const s = stuckOn(log.entries, "itm_header", MAYA.id);
    expect(stuckQuestionRefusal(null, "Header", q)).toMatch(/nobody is stuck on “Header”/);
    expect(stuckQuestionRefusal(s, "Header", q)).toBeNull();
    expect(stuckQuestionRefusal(s, "Header", { ...q, observations: ["You're stuck on the header."] })).toMatch(/never say the person is stuck/);
    expect(stuckQuestionRefusal(s, "Header", { ...q, observations: [] })).toMatch(/say what you noticed/);
    expect(stuckQuestionRefusal(s, "Header", { ...q, tiles: q.tiles.slice(0, 3) })).toMatch(/Tone of voice is missing/);
    expect(stuckQuestionRefusal(s, "Header", { ...q, tiles: [...q.tiles, q.tiles[0]!] })).toMatch(/“Density” is asked twice/);
  });

  it("round-trips through its record, draws the guess on every tile, and is answered once", () => {
    const { log, fourth } = stuckLog();
    const s = stuckOn(log.entries, "itm_header", MAYA.id)!;
    const body = stuckQuestionBody(s, "Header", q);
    expect(body.split("\n")[0]).toBe(`Stuck question (itm_header · ${fourth})`);
    expect(body).toContain("I've been guessing at “Header”");
    const canvas = { items: {}, trash: [], threads: { thr_main: { id: "thr_main", anchorItemId: null, x: 0, y: 0, main: true, comments: [{ id: "cmt_q", body, author: KIT, createdAt: iso(9 * M), record: true }] } } } as unknown as CanvasContents;
    const back = stuckQuestionOf(canvas, s.at);
    expect(back?.observations).toEqual(q.observations);
    expect(back?.tiles).toEqual(q.tiles);
    const sections = stuckSections(s, "Header", back, "Kit", null);
    expect(sections.map((x) => x.heading)).toEqual(["I've been guessing at “Header”", "What I noticed — say if I'm wrong", "Now, or instead?", "Or"]);
    expect(sections[2]!.lines.map((l) => l.guess)).toEqual(["now", "instead", "now", "instead"]);
    const waiting = stuckSections(s, "Header", null, null, "no agent stands on this canvas");
    expect(waiting.map((x) => x.lines.at(-1)!.text).at(-1)).toBe("The question waits: no agent stands on this canvas");
    expect(stuckAnswered(canvas, s.at)).toBe(false);
    const answer = stuckAnswerBody(KIT, s.at, back, { kind: "tiles", picks: [{ axis: "density", side: "instead" }, { axis: "tone", side: "now" }] });
    expect(answer).toBe(`@Kit Stuck answer (${s.at}): Density: instead (Dense, more at a glance); Tone of voice: now (Plain). Make one take from these.`);
    const answered = { ...canvas, threads: { thr_main: { ...canvas.threads.thr_main!, comments: [...canvas.threads.thr_main!.comments, { id: "cmt_a", body: answer, author: MAYA, createdAt: iso(10 * M) }] } } } as CanvasContents;
    expect(stuckAnswered(answered, s.at)).toBe(true);
  });

  it("reads an axis by id or name", () => {
    expect(stuckAxis("Brand expression")).toBe("brand");
    expect(stuckAxis("tone of voice")).toBe("tone");
    expect(stuckAxis("tone")).toBe("tone");
    expect(stuckAxis("colour")).toBeNull();
  });
});
