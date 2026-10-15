import { describe, expect, it } from "vitest";
import { applyOperation, proposalProperties } from "../src/index.ts";
import type { Actor, CanvasState, ItemVersion, NewVersion, Operation } from "../src/index.ts";
import {
  RIPPLE_PROP,
  RIPPLE_QUIET_MS,
  RIPPLE_RUN,
  readBackBody,
  readBackOf,
  readBackRefusal,
  rippleAsk,
  rippleAsked,
  rippleChanges,
  ripplePulse,
  rippleRead,
  rippleRun,
  rippleRuns,
  rippleSections,
  rippleVersions,
  systemAsk,
  systemAsked,
  type ReadBack,
  type RippleRead,
} from "../src/ripple.ts";
import { envelope } from "./helpers.ts";

/**
 * **Changes ripple** (proactive-agent phase 6, design §8). The deterministic
 * half: a settled run of one person's edits; what it changed that another
 * screen could share; which screens use it, in three states; and the pulse,
 * one tick per screen — all derived, nothing written. The lead's half (the
 * ask, the read-back) is words in and words out, and read back the same.
 */
const maya: Actor = { id: "usr_maya", name: "Maya" };
const kit: Actor = { id: "usr_kit", name: "Kit" };

/** The words behind each blob, by hash — what `textOf` reads. */
const blobs = new Map<string, string>();
let n = 0;
function page(html: string): NewVersion {
  n += 1;
  const id = `ver_r${n}`;
  blobs.set(`hash_${id}`, html);
  return { id, blobHash: `hash_${id}`, mimeType: "text/html", filename: `${id}.html`, size: html.length };
}
const textOf = (v: ItemVersion) => blobs.get(v.blobHash);

const screen = (accent: string | null, words: string, extra = "") =>
  `<!doctype html><title>x</title><style>:root{${accent ? `--accent:${accent};` : ""}}h1{font-size:18px;color:var(--accent)}${extra}</style><body><h1>${words}</h1></body>`;

function op(s: CanvasState | null, o: Operation, by: Actor = maya): CanvasState {
  return applyOperation(s, envelope(o, by))!;
}

/**
 * Acme, six screens. Menu is the source: Maya edits it three times and the
 * last edit moves `--accent` from #b5452a to #8a3a20. Checkout still defines
 * the old accent; Basket already has the new one; Profile has the old one
 * and is marked a one-off; Orders has the old one and Maya deleted Kit's
 * preview of it; About uses no accent at all.
 */
function acme(): CanvasState {
  let s = op(null, { type: "project.create", canvasId: "prj_test", title: "Acme Bakery", description: "" });
  const add = (id: string, title: string, html: string, i: number, props?: Record<string, string>) => {
    s = op(s, { type: "item.add", itemId: id, version: page(html), width: 390, height: 640, placement: { x: (i % 3) * 470, y: Math.floor(i / 3) * 760 }, title, ...(props ? { properties: props } : {}) });
  };
  add("itm_menu", "Menu", screen("#b5452a", "Sourdough Rye Croissant"), 0);
  add("itm_checkout", "Checkout", screen("#b5452a", "Pickup Saturday"), 1);
  add("itm_basket", "Basket", screen("#8a3a20", "Your basket is empty"), 2);
  add("itm_profile", "Profile", screen("#b5452a", "Settings"), 3, { [RIPPLE_PROP]: "off" });
  add("itm_orders", "Orders", screen("#b5452a", "Past orders"), 4);
  add("itm_about", "About", `<!doctype html><title>About</title><body><p>A neighbourhood bakery.</p></body>`, 5);
  s = op(s, { type: "agent.enroll", agent: kit } as Operation);
  // Kit previewed Orders from an earlier ripple of Menu; Maya deleted it.
  s = op(s, { type: "item.add", itemId: "itm_orders_p", version: page(screen("#8a3a20", "Past orders")), width: 390, height: 640, placement: { x: 470, y: 1600 }, title: "Orders — proposal", properties: proposalProperties("itm_orders", "sure", [{ kind: "version", ref: "itm_menu@v1" }], "One accent across the app.") }, kit);
  s = op(s, { type: "item.delete", itemId: "itm_orders_p" });
  // Maya's run on Menu: three edits, the last one the new accent.
  for (const [accent, words] of [["#b5452a", "Sourdough Rye"], ["#b5452a", "Sourdough Rye Croissant Bun"], ["#8a3a20", "Sourdough Rye Croissant Bun"]] as const) {
    s = op(s, { type: "item.addVersion", itemId: "itm_menu", version: page(screen(accent, words)) });
  }
  return s;
}

const lastAt = (s: CanvasState, id: string) => Date.parse(s.canvas.items[id]!.versions.at(-1)!.createdAt);

function read(s: CanvasState, exceptions: { itemId: string; why: string }[] = []): RippleRead {
  const run = rippleRun(s.canvas, "itm_menu", lastAt(s, "itm_menu") + RIPPLE_QUIET_MS)!;
  return rippleRead(s.canvas, run, textOf, exceptions)!;
}

describe("when an iteration has settled", () => {
  it("is RIPPLE_RUN edits by one person, then quiet for RIPPLE_QUIET_MS", () => {
    const s = acme();
    const at = lastAt(s, "itm_menu");
    const quiet = rippleRun(s.canvas, "itm_menu", at + 1000)!;
    expect(quiet).toMatchObject({ edits: RIPPLE_RUN, from: 1, to: 4, settled: false, settlesAt: at + RIPPLE_QUIET_MS, by: maya });
    expect(rippleRun(s.canvas, "itm_menu", at + RIPPLE_QUIET_MS)!.settled).toBe(true);
    // One edit is not a run — unless the person says "I like this".
    expect(rippleRun(s.canvas, "itm_checkout", at + RIPPLE_QUIET_MS)).toBeNull();
    const one = op(s, { type: "item.addVersion", itemId: "itm_checkout", version: page(screen("#b5452a", "Pickup Sunday")) });
    expect(rippleRun(one.canvas, "itm_checkout", Date.now())).toBeNull();
    expect(rippleRun(one.canvas, "itm_checkout", Date.now(), true)).toMatchObject({ edits: 1, from: 1, to: 2, settled: true });
    expect(rippleRuns(s.canvas, at + RIPPLE_QUIET_MS).map((r) => r.itemId)).toEqual(["itm_menu"]);
  });

  it("an agent's edits are not the person's iteration, and a screen stepped back down its stack is not done", () => {
    let s = acme();
    for (let i = 0; i < 3; i++) s = op(s, { type: "item.addVersion", itemId: "itm_about", version: page(`<p>take ${i}</p>`) }, kit);
    expect(rippleRun(s.canvas, "itm_about", Date.now(), true)).toBeNull();
    const menu = s.canvas.items.itm_menu!;
    s = op(s, { type: "item.setCurrentVersion", itemId: "itm_menu", versionId: menu.versions[1]!.id } as Operation);
    expect(rippleRun(s.canvas, "itm_menu", Date.now(), true)).toBeNull();
  });
});

describe("what a run changed", () => {
  it("names a token, a value and a term; a rewrite of the copy is not a term", () => {
    const before = `<style>:root{--accent:#B5452A;--ground:#fff}h1{font-size:18px}p{padding:16px}</style><h1>Pickup Saturday</h1>`;
    const after = `<style>:root{--accent:#8a3a20;--ground:#fff}h1{font-size:16px}p{padding:16px}</style><h1>Collection Saturday</h1>`;
    expect(rippleChanges(before, after).map((c) => c.tag)).toEqual(["--accent #b5452a → #8a3a20", "font-size 18px → 16px", "“Pickup” → “Collection”"]);
    const rewrite = `<style>:root{--accent:#B5452A}</style><h1>Order your weekly loaf before Friday noon</h1>`;
    expect(rippleChanges(before.replace(/--ground:#fff/, ""), rewrite).some((c) => c.kind === "term")).toBe(false);
    expect(rippleChanges(before, before)).toEqual([]);
  });
});

describe("the three states", () => {
  it("changing one token in the source lists exactly the screens that use it", () => {
    const r = read(acme());
    expect(r.changes.map((c) => c.tag)).toEqual(["--accent #b5452a → #8a3a20"]);
    expect(r.screens.map((s) => [s.title, s.state])).toEqual([
      ["Checkout", "would change"],
      ["Basket", "in sync"],
      ["Profile", "disagrees"],
      ["Orders", "disagrees"],
    ]);
    expect(r.untouched).toBe(1);
    expect(r.screens.find((s) => s.title === "Profile")!.because).toBe("marked a one-off");
    expect(r.screens.find((s) => s.title === "Orders")!.because).toBe("a preview of it was deleted");
    expect(r.cite).toBe("itm_menu@v4");
    expect(r.at).toBe("itm_menu@v1..v4");
  });

  it("an exception the lead argued is a disagreement, with its one line", () => {
    const r = read(acme(), [{ itemId: "itm_checkout", why: "a decision screen keeps the louder red" }]);
    expect(r.screens.find((s) => s.title === "Checkout")).toMatchObject({ state: "disagrees", because: "a decision screen keeps the louder red" });
  });

  it("ripple=off on the source silences it", () => {
    const s = op(acme(), { type: "item.update", itemId: "itm_menu", patch: { properties: { [RIPPLE_PROP]: "off" } } });
    const r = read(s);
    expect(r).toMatchObject({ off: true, screens: [], changes: [] });
    expect(rippleSections(r, null, "nobody").map((x) => x.key)).toEqual(["back", "changes"]);
  });

  it("an open preview citing the source's version is found beside its screen", () => {
    const s = op(acme(), { type: "item.add", itemId: "itm_checkout_p", version: page(screen("#8a3a20", "Pickup Saturday")), width: 390, height: 640, placement: { x: 470, y: 2400 }, title: "Checkout — proposal", properties: proposalProperties("itm_checkout", "sure", [{ kind: "version", ref: "itm_menu@v4" }], "One accent across the app.") }, kit);
    const r = read(s);
    expect(r.screens.find((x) => x.title === "Checkout")!.previewId).toBe("itm_checkout_p");
    // The preview is not itself a screen the ripple reaches.
    expect(r.screens.some((x) => x.itemId === "itm_checkout_p")).toBe(false);
  });

  it("is null while a version it needs is unread, and names exactly the versions to read", () => {
    const s = acme();
    const run = rippleRun(s.canvas, "itm_menu", Date.now())!;
    expect(rippleRead(s.canvas, run, () => undefined)).toBeNull();
    const want = rippleVersions(s.canvas, [run]).map((v) => v.blobHash);
    expect(want).toHaveLength(2 + 5);
    expect(rippleRead(s.canvas, run, (v) => (want.includes(v.blobHash) ? textOf(v) : undefined))).not.toBeNull();
  });
});

describe("the pulse", () => {
  it("derives behind and conflict from the reads, one tick per screen, and writes nothing", () => {
    const s = acme();
    const before = JSON.stringify(s.canvas);
    const ticks = ripplePulse(s.canvas, [read(s)]);
    expect(ticks.map((t) => [t.title, t.state])).toEqual([
      ["Menu", "current"],
      ["Checkout", "behind"],
      ["Basket", "current"],
      ["Profile", "conflict"],
      ["Orders", "conflict"],
      ["About", "current"],
    ]);
    expect(ticks[1]!.why).toBe("behind “Menu”: --accent #b5452a → #8a3a20");
    expect(JSON.stringify(s.canvas)).toBe(before);
  });

  it("a kept preview brings a screen current — Keep trashes it too, and that is not a delete", () => {
    const kept = page(screen("#8a3a20", "Pickup Saturday"));
    let s = op(acme(), { type: "item.add", itemId: "itm_checkout_p", version: kept, width: 390, height: 640, placement: { x: 470, y: 2400 }, title: "Checkout — proposal", properties: proposalProperties("itm_checkout", "sure", [{ kind: "version", ref: "itm_menu@v4" }], "One accent across the app.") }, kit);
    s = op(s, { type: "item.addVersion", itemId: "itm_checkout", version: { ...kept, id: "ver_kept" } });
    s = op(s, { type: "item.delete", itemId: "itm_checkout_p" });
    expect(ripplePulse(s.canvas, [read(s)]).find((t) => t.title === "Checkout")!.state).toBe("current");
  });
});

describe("the lead's half", () => {
  const back: ReadBack = {
    decisions: ["a warmer, quieter accent", "a tighter type scale"],
    good: "you used proximity: the pickup time sits with the total",
    exceptions: [{ itemId: "itm_checkout", title: "Checkout", why: "a decision screen keeps the louder red" }],
    sketch: "With one accent, the brand mark could carry the colour alone.",
  };

  it("the ask names the run, the change and the three states, and says nothing else moved", () => {
    const s = acme();
    const r = read(s);
    const ask = rippleAsk(kit, r);
    expect(ask).toMatch(/^@Kit Ripple, please \(itm_menu@v1\.\.v4\): Maya's run on “Menu” settled — 3 edits\./);
    expect(ask).toContain("Would change: “Checkout”. Already in sync: “Basket”. Disagrees: “Profile”, “Orders”.");
    expect(ask).toContain("citing version:itm_menu@v4");
    expect(rippleAsked(s.canvas, r.at)).toBe(false);
    const asked = op(s, { type: "thread.create", threadId: "thr_main", x: 0, y: 0, anchorItemId: null, main: true, comment: { id: "cmt_ask", body: ask, createdAt: new Date().toISOString() } } as Operation);
    expect(rippleAsked(asked.canvas, r.at)).toBe(true);
    // "I like this": a run somebody asked about is settled whatever the clock says.
    const early = lastAt(s, "itm_menu") + 1000;
    expect(rippleRuns(s.canvas, early)[0]!.settled).toBe(false);
    expect(rippleRuns(asked.canvas, early)[0]!.settled).toBe(true);
    expect(systemAsk(kit, r)).toMatch(/^@Kit Ripple into the design system, please \(itm_menu@v1\.\.v4\)/);
    expect(systemAsked(asked.canvas, r.at)).toBe(false);
  });

  it("the read-back round-trips, and refuses four decisions, a stranger exception and a good move named twice", () => {
    const s = acme();
    const r = read(s);
    expect(readBackRefusal(s.canvas, r, back)).toBeNull();
    expect(readBackRefusal(s.canvas, r, { ...back, decisions: ["a", "b", "c", "d"] })).toMatch(/three decisions at most/);
    expect(readBackRefusal(s.canvas, r, { ...back, decisions: [] })).toMatch(/at least one decision/);
    expect(readBackRefusal(s.canvas, r, { ...back, exceptions: [{ itemId: "itm_about", title: "About", why: "x" }] })).toMatch(/not one of the screens/);
    const body = readBackBody(r.at, back);
    const posted = op(s, { type: "thread.create", threadId: "thr_main", x: 0, y: 0, anchorItemId: null, main: true, comment: { id: "cmt_back", body, createdAt: new Date().toISOString(), record: true } } as Operation, kit);
    const got = readBackOf(posted.canvas, r.at)!;
    expect(got).toMatchObject({ ...back, by: kit, commentId: "cmt_back" });
    expect(readBackRefusal(posted.canvas, r, back)).toMatch(/already named on this canvas/);
    // The argued exception moves Checkout to disagrees, and the sections say all of it.
    const sections = rippleSections(read(posted, got.exceptions), got, null);
    expect(sections.map((x) => x.key)).toEqual(["back", "changes", "would", "sync", "disagrees", "altitude", "sketch"]);
    expect(sections[0]!.lines.map((l) => l.text)).toEqual(["a warmer, quieter accent", "a tighter type scale", "Caught doing it right: you used proximity: the pickup time sits with the total"]);
    expect(sections.find((x) => x.key === "disagrees")!.lines.map((l) => l.text)).toContain("“Checkout” — a decision screen keeps the louder red");
    expect(sections.find((x) => x.key === "altitude")!.lines[0]!.text).toMatch(/^Screen by screen \(the default\)/);
  });

  it("with nothing to answer, the deterministic half still shows and says the read-back waits", () => {
    const sections = rippleSections(read(acme()), null, "no agent stands on this canvas");
    expect(sections[0]!.lines[0]!.text).toBe("The read-back waits: no agent stands on this canvas");
    expect(sections.find((x) => x.key === "would")!.lines.map((l) => l.text)).toEqual(["“Checkout” — --accent #b5452a → #8a3a20"]);
  });
});
