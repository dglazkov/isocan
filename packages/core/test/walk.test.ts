import { afterEach, describe, expect, it } from "vitest";
import { registerModule, unregisterModule, type CanvasContents, type Comment, type CommentThread, type Item } from "../src/index.ts";
import {
  WALKERS,
  WALK_NOTICE,
  WALK_PARAMETERS,
  contrastFix,
  flowReach,
  lowVisionFilter,
  readScreen,
  readWalkAsk,
  readingOrder,
  seenContrast,
  stumbleBody,
  thumbArcs,
  thumbZone,
  walkAskBody,
  walkFindings,
  walkFixHtml,
  walkFlow,
  walkLanes,
  walkRecordBody,
  walkRecordOf,
  walkRecordRefusal,
  walkScreen,
  walkShared,
  walkStumbles,
  walkerOf,
  type WalkScreen,
  type WalkStumble,
} from "../src/walk.ts";

/**
 * **Walk it as someone else** (proactive-agent phase 9, design §11): the
 * deterministic half. A synthetic Acme flow of three phone screens — Pick a
 * loaf, Choose a day, Checkout — where Checkout has one low-contrast button
 * ("Edit", #aaaaaa on white) and one small target in the bottom-left corner
 * ("Help", 28×28, fixed). The low-vision walker meets exactly the first and
 * the one-handed walker exactly the second; both pinned there, the shared
 * finding names Checkout. The transforms' numbers, the flow's path and the
 * records' format are held here; the stumbles' words are the lead's.
 */
const maya = { id: "usr_maya", name: "Maya" };
const kit = { id: "usr_kit", name: "Kit" };

const PICK = `<!doctype html><title>Pick a loaf</title><style>:root{--ink:#1d1b18;--paper:#fffdf8}body{margin:0;color:var(--ink);background:var(--paper);font:16px system-ui}.go{position:fixed;left:16px;right:16px;bottom:16px;height:56px;background:#8a3a20;color:#fff}</style>
<body><h1>Pick a loaf</h1><ul><li><a href="#rye">Rye</a></li><li><a href="#sourdough">Sourdough</a></li></ul><button class="go">Continue</button></body>`;
const DAY = `<!doctype html><title>Choose a day</title><style>body{margin:0;color:#222;font:16px system-ui}.go{position:fixed;left:16px;right:16px;bottom:16px;height:56px;background:#8a3a20;color:#ffffff}</style>
<body><h1>Choose a day</h1><label for="day">Pickup day</label><select id="day"><option>Saturday</option></select><button class="go">Continue</button></body>`;
const CHECKOUT = `<!doctype html><title>Checkout</title><style>body{margin:0;color:#222;font:16px system-ui}.edit{color:#aaaaaa;background:#ffffff;border:0}.help{position:fixed;left:8px;bottom:8px;width:28px;height:28px}.pay{position:fixed;left:16px;right:16px;bottom:56px;height:56px;background:#8a3a20;color:#fff}</style>
<body><h1>Checkout</h1><p>Sourdough, Saturday 9:00 <button class="edit">Edit</button></p><button class="pay">Pay £4.20</button><a class="help" href="#help" aria-label="Help">?</a></body>`;

function item(id: string, title: string, html: string | null, x: number, y: number, extra: Partial<Item> = {}): Item {
  return {
    id, title, description: "", x, y, width: 390, height: 844, properties: {},
    currentVersionId: `${id}_v1`,
    versions: [{ id: `${id}_v1`, blobHash: `hash_${id}`, mimeType: html === null ? "text/markdown" : "text/html", filename: "x.html", size: html?.length ?? 0, createdAt: "2026-10-14T09:00:00.000Z", createdBy: maya } as Item["versions"][number]],
    createdAt: "2026-10-14T09:00:00.000Z", createdBy: maya, updatedAt: "2026-10-14T09:00:00.000Z",
    ...extra,
  } as Item;
}

const HTML: Record<string, string> = { itm_pick: PICK, itm_day: DAY, itm_checkout: CHECKOUT };

/** The flow as a group (`kind=group`), placed out of reading order on purpose. */
function acme(threads: Record<string, CommentThread> = {}): CanvasContents {
  const group = item("grp_order", "Order a loaf", null, 0, 0, { width: 1500, height: 1000, properties: { kind: "group" } });
  const items = {
    grp_order: group,
    itm_checkout: item("itm_checkout", "Checkout", CHECKOUT, 960, 40, { containerId: "grp_order" }),
    itm_pick: item("itm_pick", "Pick a loaf", PICK, 0, 60, { containerId: "grp_order" }),
    itm_day: item("itm_day", "Choose a day", DAY, 480, 20, { containerId: "grp_order" }),
    itm_note: item("itm_note", "Notes", null, 0, 1200),
  };
  return { items, threads, trash: [] } as unknown as CanvasContents;
}

const screens = (): WalkScreen[] => ["itm_pick", "itm_day", "itm_checkout"].map((id) => walkScreen(acme().items[id]!, `${id}_v1`, HTML[id]!));
const walker = (id: string) => WALKERS.find((w) => w.id === id)!;

describe("the transforms and their numbers", () => {
  it("the low-vision blur is half 20/80's resolution at reading distance, and the veil sees 7:1 as 3:1", () => {
    // 4′ at 330 mm is 2.3 CSS px; σ = MAR/2 keeps exp(−π²/8) ≈ 29% of the contrast at the resolution limit.
    expect(WALK_PARAMETERS.lowVision.blurPx).toBe(1.2);
    expect(Math.exp(-2 * Math.PI ** 2 * (1 / 2) ** 2 * (1 / 2) ** 2)).toBeCloseTo(0.29, 2);
    const f = lowVisionFilter();
    expect(f).toEqual({ blurPx: 1.2, slope: 0.769, intercept: 0.231 });
    // #595959 on white is WCAG's 7:1; through the veil it reads as 3:1.
    expect(seenContrast("#595959", "#ffffff")).toBe(3);
    expect(seenContrast("#767676", "#ffffff")).toBeLessThan(3);
    expect(WALK_PARAMETERS.lowVision.source).toMatch(/not a diagnosis/);
    expect(WALK_PARAMETERS.thumb.source).toMatch(/not anthropometry/);
  });

  it("the thumb's zones pivot at the bottom right: comfortable in a band, a stretch further, hard at the top and right at the corner", () => {
    const vp = { width: 390, height: 844 };
    expect(thumbArcs(vp)).toEqual({ pivot: { x: 390, y: 844 }, inner: 90, easy: 360, stretch: 450 });
    expect(thumbZone({ x: 195, y: 700 }, vp)).toBe("easy");
    expect(thumbZone({ x: 22, y: 822 }, vp)).toBe("stretch");
    expect(thumbZone({ x: 30, y: 40 }, vp)).toBe("hard");
    expect(thumbZone({ x: 380, y: 834 }, vp)).toBe("hard");
  });

  it("the fix is the nearest ink of the same hue that reaches the ratio, and the fixed screen is the file plus one sheet", () => {
    const fix = contrastFix("#aaaaaa", "#ffffff", 7)!;
    expect(fix.ratio).toBeGreaterThanOrEqual(7);
    expect(fix.ratio).toBeLessThan(7.2);
    // Through the low-vision veil, the fix reads at the 3:1 a person reads at all.
    expect(seenContrast(fix.colour, "#ffffff")).toBeGreaterThanOrEqual(3);
    expect(contrastFix("#555555", "#111111", 4.5)!.colour > "#555555").toBe(true);
    const fixed = walkFixHtml(CHECKOUT, [{ path: "html > body > p:nth-child(2) > button:nth-child(1)", colour: fix.colour }]);
    expect(fixed.replace(/<style data-isocan-walk-fix>[^<]*<\/style>/, "")).toBe(CHECKOUT);
    expect(fixed).toContain(`html > body > p:nth-child(2) > button:nth-child(1){color:${fix.colour} !important}`);
  });
});

describe("the static read", () => {
  it("reads colours through the cascade and var(), places only what the CSS places, and names what it reaches", () => {
    const pick = readScreen(PICK, { width: 390, height: 844 });
    expect(pick.texts.find((t) => t.text === "Pick a loaf")).toMatchObject({ fg: "#1d1b18", bg: "#fffdf8", fontPx: 32, bold: true });
    expect(pick.texts.find((t) => t.text === "Rye")).toMatchObject({ fg: "#0000ee" });
    const go = pick.targets.find((t) => t.name === "Continue")!;
    expect(go.at).toEqual({ x: 16, y: 772, width: 358, height: 56 });
    expect(pick.targets.find((t) => t.name === "Rye")!.at).toBeNull();
    expect(pick.order.map((s) => `${s.role}: ${s.name}`)).toEqual(["heading 1: Pick a loaf", "link: Rye", "link: Sourdough", "button: Continue"]);
    const day = readScreen(DAY, { width: 390, height: 844 });
    expect(day.targets.find((t) => t.tag === "select")!.name).toBe("Pickup day");
    const checkout = readScreen(CHECKOUT, { width: 390, height: 844 });
    expect(checkout.targets.find((t) => t.name === "Help")).toMatchObject({ role: "link", at: { x: 8, y: 808, width: 28, height: 28 } });
  });

  it("a viewport meta names the width; an unnamed icon button, a clickable div and an image with no alt are what a screen reader meets", () => {
    const html = `<meta name="viewport" content="width=375"><body><button><svg></svg></button><div onclick="go()">Go</div><img src="loaf.jpg"><input placeholder="Email"></body>`;
    const r = readScreen(html, { width: 750, height: 1624 });
    expect(r.viewport).toEqual({ width: 375, height: 812 });
    const sr = walkFindings(walker("screen-reader"), [{ itemId: "x", versionId: "v", title: "X", read: r }]);
    expect(sr.map((f) => f.kind)).toEqual(["unnamed", "no-role", "placeholder", "no-alt"]);
  });
});

describe("the flow", () => {
  it("a group's screens in reading order, never a note; one screen alone; a note refused", () => {
    expect(readingOrder(["itm_checkout", "itm_pick", "itm_day"].map((id) => acme().items[id]!)).map((i) => i.id)).toEqual(["itm_pick", "itm_day", "itm_checkout"]);
    expect(walkFlow(acme(), "grp_order", null)).toEqual({ via: "group", title: "Order a loaf", screens: ["itm_pick", "itm_day", "itm_checkout"], unreached: [] });
    expect(walkFlow(acme(), "itm_day", DAY)).toMatchObject({ via: "screen", screens: ["itm_day"] });
    expect(walkFlow(acme(), "itm_note", null)).toEqual({ refused: "a walk goes over screens — a group of them, a prototype, or one screen; “Notes” is none of those" });
  });

  it("a module's flow is walked from where it opens, link by link; a screen no link reaches is unreached", () => {
    expect(flowReach({ start: "a", screens: ["a", "b", "c", "d"], links: [{ from: "a", to: "c" }, { from: "c", to: "b" }] })).toEqual({ screens: ["a", "c", "b"], unreached: ["d"] });
    registerModule({ name: "@isocan/test-proto", walkFlow: (_item, html) => (html.includes("proto") ? { start: "itm_pick", screens: ["itm_pick", "itm_day", "itm_checkout", "itm_gone"], links: [{ from: "itm_pick", to: "itm_day" }, { from: "itm_day", to: "itm_checkout" }] } : null) });
    expect(walkFlow(acme(), "itm_note", "proto")).toEqual({ via: "prototype", title: "Notes", screens: ["itm_pick", "itm_day", "itm_checkout"], unreached: [] });
  });
  afterEach(() => unregisterModule("@isocan/test-proto"));
});

describe("two walkers over one flow", () => {
  it("the low-vision walker meets exactly the low-contrast button, the one-handed walker exactly the small corner target — both on Checkout", () => {
    const lv = walkFindings(walker("low-vision"), screens());
    expect(lv).toHaveLength(1);
    expect(lv[0]).toMatchObject({ id: "3.1", itemId: "itm_checkout", kind: "contrast", label: "Edit", contrast: { fg: "#aaaaaa", bg: "#ffffff", ratio: 2.32, need: 4.5 } });
    expect(lv[0]!.text).toMatch(/^“Edit” is #aaaaaa on #ffffff, 2\.32:1 — text this size needs 4\.5:1; through low vision it is about 1\.\d+:1\. The fix, at the 7:1 they read at: #[0-9a-f]{6} \(7\.\d+:1\)$/);
    const oh = walkFindings(walker("one-handed"), screens());
    expect(oh).toHaveLength(1);
    expect(oh[0]).toMatchObject({ id: "3.1", itemId: "itm_checkout", kind: "reach", label: "Help", reach: { zone: "stretch", width: 28, height: 28 } });
    expect(oh[0]!.text).toBe("“Help” is 28×28 px in the stretch zone, bottom left — a thumb needs 44×44 there");
    // Pinned where they happen, the shared finding names the screen both hit.
    const pins: WalkStumble[] = [lv[0]!, oh[0]!].map((f) => ({ walk: "cmt_w", walker: f.walker, itemId: f.itemId, finding: f.id, what: "…" }));
    expect(walkShared(pins)).toEqual([{ itemId: "itm_checkout", walkers: ["low-vision", "one-handed"] }]);
    // One walker alone shares nothing.
    expect(walkShared(pins.slice(0, 1))).toEqual([]);
  });

  it("a first-time visitor and a described walker are judged, never measured, and their lanes say so", () => {
    expect(walkFindings(walker("first-time"), screens())).toEqual([]);
    const lanes = walkLanes([walker("first-time")], screens(), [], null);
    expect(lanes[0]!.screens[0]!.notes).toEqual(["judged by the lead: this walker meets meaning, which the code cannot measure"]);
    const commuter = walkerOf("commuter: one hand on a strap, reading on a moving bus");
    expect(commuter).toMatchObject({ id: "commuter", name: "Commuter", checks: [], described: true });
    expect(walkerOf("Low vision")).toBe(walker("low-vision"));
    expect(walkerOf("thumb")).toBe(walker("one-handed"));
    expect(walkerOf("grandma: old and slow with phones")).toEqual({ refused: "a walker is a situation and a constraint, not who someone is — say what they are doing and what they cannot do, not their age or who they are" });
    expect(walkerOf("tourist")).toMatchObject({ refused: expect.stringMatching(/^no walker "tourist" — the starters are one-handed, low-vision, screen-reader, first-time/) });
  });
});

describe("the records", () => {
  const ask = (): Comment => ({
    id: "cmt_walk", author: maya, createdAt: "2026-10-14T10:00:00.000Z",
    body: walkAskBody(kit, "order a loaf for Saturday", screens(), [walker("one-handed"), walker("low-vision")], [...walkFindings(walker("one-handed"), screens()), ...walkFindings(walker("low-vision"), screens())]),
  });

  it("the ask names the screens at their versions, each walker, what was measured and the notice — and reads back", () => {
    const c = ask();
    expect(c.body.split("\n")[0]).toBe("@Kit Walk it as someone else, please (itm_pick@itm_pick_v1, itm_day@itm_day_v1, itm_checkout@itm_checkout_v1): “order a loaf for Saturday” as One-handed on a phone and Low vision.");
    expect(c.body).toContain(WALK_NOTICE);
    expect(c.body).toContain("- one-handed on “Checkout”, 3.1: “Help” is 28×28 px");
    const read = readWalkAsk(c)!;
    expect(read).toMatchObject({ id: "cmt_walk", task: "order a loaf for Saturday", screens: [{ itemId: "itm_pick", versionId: "itm_pick_v1" }, { itemId: "itm_day", versionId: "itm_day_v1" }, { itemId: "itm_checkout", versionId: "itm_checkout_v1" }] });
    expect(read.walkers.map((w) => w.id)).toEqual(["one-handed", "low-vision"]);
  });

  it("stumbles are pins worn as the walker, read back with what they cite; the record reads back whole", () => {
    const thread = (id: string, walkerId: string, finding: string): CommentThread => ({
      id, x: 22, y: 822, anchorItemId: "itm_checkout",
      comments: [{ id: `c_${id}`, author: kit, createdAt: `2026-10-14T10:0${id.length}:00.000Z`, persona: walkerId, body: stumbleBody(walker(walkerId), "cmt_walk", finding, "Could not reach Help with the thumb.") }],
    } as unknown as CommentThread);
    const canvas = acme({ t1: thread("t1", "one-handed", "3.1"), t22: thread("t22", "low-vision", "judged") });
    expect(walkStumbles(canvas, "cmt_walk")).toEqual([
      { walk: "cmt_walk", walker: "one-handed", itemId: "itm_checkout", finding: "3.1", what: "Could not reach Help with the thumb.", threadId: "t1", at: { x: 0.06, y: 0.97 } },
      { walk: "cmt_walk", walker: "low-vision", itemId: "itm_checkout", finding: "judged", what: "Could not reach Help with the thumb.", threadId: "t22", at: { x: 0.06, y: 0.97 } },
    ]);
    expect(stumbleBody(walker("low-vision"), "cmt_walk", "judged", "x")).toBe("Low vision stumbled here (walk cmt_walk · judged, not measured): x");
    const body = walkRecordBody({ id: "cmt_walk", task: "order a loaf for Saturday" }, [{ walker: "one-handed", outcome: "stumbled", line: "Reached everything but Help." }, { walker: "low-vision", outcome: "gave up", line: "Could not find Edit." }], { itemId: "itm_checkout", sentence: "Checkout's secondary actions are faint and out of reach." }, "itm_fix");
    const withRecord = acme({ main: { id: "main", x: 0, y: 0, anchorItemId: null, main: true, comments: [{ id: "cmt_rec", author: kit, createdAt: "2026-10-14T10:09:00.000Z", record: true, body }] } as unknown as CommentThread });
    expect(walkRecordOf(withRecord, "cmt_walk")).toMatchObject({ commentId: "cmt_rec", outcomes: [{ walker: "one-handed", outcome: "stumbled" }, { walker: "low-vision", outcome: "gave up" }], shared: { itemId: "itm_checkout" }, fix: "itm_fix" });
    expect(body).toContain(WALK_NOTICE);
    expect(walkRecordOf(withRecord, "cmt_other")).toBeNull();
  });

  it("the grounding: a measured stumble cites what was measured there; endings agree with the pins; a screen two walkers hit is named, with one fix", () => {
    const a = readWalkAsk(ask())!;
    const findings = [...walkFindings(walker("one-handed"), screens()), ...walkFindings(walker("low-vision"), screens())];
    const pin = (w: string, finding: string, itemId = "itm_checkout"): WalkStumble => ({ walk: a.id, walker: w, itemId, finding, what: "It happened." });
    const ends = [{ walker: "one-handed", outcome: "stumbled" }, { walker: "low-vision", outcome: "stumbled" }];
    const both = [pin("one-handed", "3.1"), pin("low-vision", "3.1")];
    expect(walkRecordRefusal(a, findings, both, ends, { itemId: "itm_checkout" }, true)).toBeNull();
    expect(walkRecordRefusal(a, findings, [pin("one-handed", "2.1", "itm_day")], ends, null, false)).toBe("one-handed has no measured 2.1 on that screen (nothing was measured there) — cite one, or say judged");
    expect(walkRecordRefusal(a, findings, [pin("first-time", "judged")], ends, null, false)).toBe("first-time did not walk this — the walkers are one-handed, low-vision");
    expect(walkRecordRefusal(a, findings, [pin("one-handed", "3.1")], [{ walker: "one-handed", outcome: "stumbled" }], null, false)).toBe("every walker ends: low-vision has no --outcome (made it, stumbled or gave up)");
    expect(walkRecordRefusal(a, findings, [pin("one-handed", "3.1")], [{ walker: "one-handed", outcome: "made it" }, { walker: "low-vision", outcome: "made it" }], null, false)).toBe("one-handed stumbled — say stumbled (or gave up), not made it");
    expect(walkRecordRefusal(a, findings, [pin("one-handed", "3.1")], [{ walker: "one-handed", outcome: "stumbled" }, { walker: "low-vision", outcome: "gave up" }], null, false)).toBe("low-vision gave up with no stumble pinned — pin where it happened, or say made it");
    expect(walkRecordRefusal(a, findings, both, ends, null, false)).toBe("one-handed and low-vision all stumbled on one screen (itm_checkout) — name the shared problem with --shared \"<screen> | …\" and propose one fix");
    expect(walkRecordRefusal(a, findings, both, ends, { itemId: "itm_checkout" }, false)).toBe("the shared finding comes with one fix: --fix <file> --why \"…\", a proposal beneath that screen");
    expect(walkRecordRefusal(a, findings, [pin("one-handed", "3.1"), pin("low-vision", "judged", "itm_day")], ends, { itemId: "itm_checkout" }, true)).toBe("a shared finding is a screen two or more walkers stumbled on — this one is not");
  });
});
