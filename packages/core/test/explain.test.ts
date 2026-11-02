import { describe, expect, it } from "vitest";
import {
  applyOperation,
  convergeOps,
  convergePlan,
  critiqueAsk,
  critiqueBody,
  critiqueCannot,
  designSystemProperties,
  explainSections,
  explainStory,
  explainText,
  isRefusal,
  lineageProperties,
  parseCite,
  parseSpeak,
  plainReadings,
  proposalProperties,
  proposalRefusal,
  rationaleSpot,
  rationaleText,
  seams,
} from "../src/index.ts";
import type { Actor, CanvasState, ExplainStory, Operation } from "../src/index.ts";

/**
 * **Explain this item** (proactive-agent phase 4, design §6) on a synthetic
 * Acme Bakery Checkout with fifty versions: Maya drafts it (v1–v20), Ravi
 * makes the total more obvious and says so (v21–v30), Kit makes three
 * variations and Maya chooses B, "shorter form" (v31), Maya iterates
 * (v32–v39), Kit nudges one version with nothing said (v40), Maya finishes
 * (v41–v50). Then the design system moves on. The story is read off the
 * canvas alone; these tests hold what the phase's Proof names.
 */
const maya: Actor = { id: "usr_maya", name: "Maya" };
const ravi: Actor = { id: "usr_ravi", name: "Ravi" };
const kit: Actor = { id: "usr_kit", name: "Kit" };

const T0 = Date.UTC(2026, 9, 14, 9, 0, 0);
const iso = (ms: number) => new Date(ms).toISOString();

let n = 0;
function step(s: CanvasState | null, op: Operation, actor: Actor, at: number, group?: string): CanvasState {
  n += 1;
  return applyOperation(s, { id: `op_${n}`, canvasId: op.type === "project.create" ? null : "prj_acme", actor, ts: iso(at), op, ...(group ? { group } : {}) })!;
}
const ver = (id: string, hash = `hash_${id}`) => ({ id, blobHash: hash, mimeType: "text/html", filename: `${id}.html`, size: 10 });
const add = (s: CanvasState, itemId: string, title: string, props: Record<string, string>, by: Actor, at: number, x = 0, mime = "text/html") =>
  step(s, { type: "item.add", itemId, version: { ...ver(`ver_${itemId}`), mimeType: mime }, width: 390, height: 640, placement: { x, y: 0, chosen: true }, title, properties: props }, by, at);
const edit = (s: CanvasState, itemId: string, k: number, by: Actor, at: number) =>
  step(s, { type: "item.addVersion", itemId, version: ver(`ver_${itemId}_${k}`) }, by, at);
const comment = (s: CanvasState, threadId: string, id: string, body: string, by: Actor, at: number, items: string[], extra: Record<string, unknown> = {}) =>
  s.canvas.threads[threadId]
    ? step(s, { type: "thread.reply", threadId, comment: { id, body, items, ...extra } as never }, by, at)
    : step(s, { type: "thread.create", threadId, x: 0, y: 0, anchorItemId: items[0] ?? null, comment: { id, body, items, ...extra } as never }, by, at);

/** The fifty-version Checkout, its three variations and the choice, and what came after. */
function acme(): CanvasState {
  n = 0;
  let t = T0;
  const tick = (ms = 5_000) => (t += ms);
  let s = step(null, { type: "project.create", canvasId: "prj_acme", title: "Acme Bakery", description: "" }, maya, t);
  s = add(s, "itm_ds", "DESIGN.md", designSystemProperties(), maya, tick(), 2000, "text/markdown");
  s = add(s, "itm_checkout", "Checkout", {}, maya, tick(), 0);
  for (let k = 2; k <= 20; k++) s = edit(s, "itm_checkout", k, maya, tick(600_000));
  // Ravi, in one sitting, then says what he did — the lane's "make it, then say so".
  tick(3_600_000);
  for (let k = 21; k <= 30; k++) s = edit(s, "itm_checkout", k, ravi, tick());
  s = comment(s, "thr_checkout", "cmt_ravi", "Did this to make it more obvious; the total, it gets lost below the fold.", ravi, tick(), ["itm_checkout"]);
  // Kit's three takes, each announced.
  tick(3_600_000);
  for (const [id, title, words] of [["itm_a", "Checkout A", "A: one long page"], ["itm_b", "Checkout B", "B: shorter form, pickup slot first"], ["itm_c", "Checkout C", "C: a stepper"]] as const) {
    s = add(s, id, title, lineageProperties("itm_checkout"), kit, tick(), 500);
    s = comment(s, "thr_takes", `cmt_${id}`, words, kit, tick(), [id]);
  }
  // Maya chooses B: the fold `isocan choose` makes, in one group.
  const plan = convergePlan(s.canvas, "itm_b");
  if (isRefusal(plan)) throw new Error(plan.refused);
  const at = tick(3_600_000);
  for (const op of convergeOps(plan)) s = step(s, op, maya, at, "grp_choose");
  for (let k = 32; k <= 39; k++) s = edit(s, "itm_checkout", k, maya, tick(600_000));
  s = edit(s, "itm_checkout", 40, kit, tick(600_000));
  for (let k = 41; k <= 50; k++) s = edit(s, "itm_checkout", k, maya, tick(600_000));
  // A proposal Maya deleted, and the design system moving on after v50.
  s = add(s, "itm_prop", "Checkout — proposal", proposalProperties("itm_checkout", "hunch", [{ kind: "comment", ref: "cmt_ravi" }], "Progressive disclosure: hide the notes field."), kit, tick(), 1000);
  s = step(s, { type: "item.delete", itemId: "itm_prop" }, maya, tick());
  s = edit(s, "itm_ds", 2, ravi, tick(600_000));
  return s;
}

function story(s: CanvasState): ExplainStory {
  const out = explainStory(s.canvas, "itm_checkout");
  if ("refused" in out) throw new Error(out.refused);
  return out;
}

describe("the versions that mattered", () => {
  it("has fifty versions, and the story names four seams — first, Ravi's, the choose, the latest", () => {
    const s = acme();
    const st = story(s);
    expect(st.versions).toBe(50);
    expect(st.moves.map((m) => [m.kind, m.from, m.to, m.who.name])).toEqual([
      ["made", 1, 20, "Maya"],
      ["edited", 21, 30, "Ravi"],
      ["chose", 31, 31, "Maya"],
      ["edited", 32, 39, "Maya"],
      ["edited", 40, 40, "Kit"],
      ["edited", 41, 50, "Maya"],
    ]);
    const { moves, hidden } = seams(st);
    expect(moves.map((m) => `v${m.from}-v${m.to}`)).toEqual(["v1-v20", "v21-v30", "v31-v31", "v41-v50"]);
    expect(hidden).toBe(2);
  });

  it("gives the chosen variation's comment as the choice's reason, and the comment that made a run as its", () => {
    const st = story(acme());
    const chose = st.moves.find((m) => m.kind === "chose")!;
    expect(chose.chosen).toMatchObject({ itemId: "itm_b", title: "Checkout B", siblings: 2 });
    expect(chose.reason).toMatchObject({ text: "B: shorter form, pickup slot first", source: "comment", commentId: "cmt_itm_b" });
    expect(st.moves[1]!.reason).toMatchObject({ commentId: "cmt_ravi", threadId: "thr_checkout" });
    expect(st.moves[0]!.reason).toBeNull();
  });

  it("reads a reason as a sentence: a reference to the item itself goes, another becomes its title", () => {
    let s = acme();
    const at = T0 + 20 * 86_400_000;
    s = edit(s, "itm_checkout", 51, ravi, at);
    s = comment(s, "thr_checkout", "cmt_ravi2", "Matched #itm_checkout to #itm_ds", ravi, at + 1000, ["itm_checkout", "itm_ds"]);
    expect(story(s).moves.at(-1)!.reason?.text).toBe("Matched to “DESIGN.md”");
  });

  it("does not let an old comment claim a later version by the same hand", () => {
    let s = acme();
    // A week later Ravi edits again, saying nothing: his comment still names v30, not this.
    s = edit(s, "itm_checkout", 51, ravi, T0 + 7 * 86_400_000);
    const st = story(s);
    expect(st.moves.at(-1)).toMatchObject({ from: 51, who: { name: "Ravi" }, reason: null });
    expect(st.moves[1]!.reason?.commentId).toBe("cmt_ravi");
  });
});

describe("the roads not taken", () => {
  it("lists the two losing variations from the trash with their own reasons, and the deleted proposal", () => {
    const st = story(acme());
    const roads = st.roads.map((r) => [r.kind, r.title, r.where, r.why]);
    expect(roads).toEqual([
      ["variation", "Checkout A", "trash", "A: one long page"],
      ["variation", "Checkout C", "trash", "C: a stepper"],
      ["proposal", "Checkout — proposal", "trash", "Progressive disclosure: hide the notes field."],
    ]);
    expect(st.roads.some((r) => r.itemId === "itm_b")).toBe(false);
  });

  it("names what it was preferred over", () => {
    let s = acme();
    s = add(s, "itm_old", "Old checkout", {}, maya, T0 + 9 * 86_400_000, 3000);
    s = step(s, { type: "item.update", itemId: "itm_checkout", patch: { properties: { preferredOver: "itm_old" } } }, maya, T0 + 9 * 86_400_000 + 1000);
    expect(story(s).roads.at(-1)).toMatchObject({ kind: "preferred", title: "Old checkout", where: "canvas" });
  });

  it("omits the roads section when there are no roads not taken", () => {
    let s = step(null, { type: "project.create", canvasId: "prj_acme", title: "Acme Bakery", description: "" }, maya, T0);
    s = add(s, "itm_solo", "Solo", {}, maya, T0 + 1000, 0);
    const out = explainStory(s.canvas, "itm_solo");
    if ("refused" in out) throw new Error(out.refused);
    expect(out.roads).toEqual([]);
    expect(explainSections(out).find((x) => x.key === "roads")).toBeUndefined();
  });
});

describe("what moved around it since", () => {
  it("lists a DESIGN.md version newer than the item's current one", () => {
    const st = story(acme());
    expect(st.moved[0]).toMatchObject({ kind: "design", itemId: "itm_ds", newer: 1, latest: 2, by: { name: "Ravi" } });
  });

  it("is empty when nothing moved after the current version", () => {
    let s = acme();
    s = edit(s, "itm_checkout", 51, maya, T0 + 30 * 86_400_000);
    expect(story(s).moved).toEqual([]);
  });

  it("lists a relative's newer version", () => {
    let s = acme();
    s = add(s, "itm_d", "Checkout D", lineageProperties("itm_checkout"), kit, T0 + 30 * 86_400_000, 4000);
    expect(story(s).moved.some((m) => m.kind === "item" && m.itemId === "itm_d")).toBe(true);
  });
});

describe("the explanation sections", () => {
  it("renders one clear version of the moves with version badges and design terms", () => {
    const st = story(acme());
    const how = explainSections(st).find((x) => x.key === "how")!.lines.map((l) => l.text);
    expect(how[0]).toBe("v1–v20 · Maya drafted it over 20 versions — no reason recorded");
    expect(how[1]).toBe("v21–v30 · Ravi iterated (10 versions) — “Did this to make it more obvious; the total, it gets lost below the fold.” (visual hierarchy)");
    expect(how[2]).toBe("v31 · Maya chose “Checkout B” over 2 other takes — “B: shorter form, pickup slot first”");
    expect(how.at(-1)).toBe("…and 2 smaller moves.");
  });

  it("links each move to its compare, and roads in the trash to the trash", () => {
    const sections = explainSections(story(acme()));
    const how = sections.find((x) => x.key === "how")!.lines;
    expect(how[1]!.compare).toEqual({ itemId: "itm_checkout", from: "ver_itm_checkout_20", to: "ver_itm_checkout_30" });
    expect(how[0]!.compare).toBeUndefined();
    expect(sections.find((x) => x.key === "roads")!.lines.every((l) => l.trash)).toBe(true);
  });

  it("speaks design: a phrase typed about the item beside the designer's term", () => {
    const st = story(acme());
    expect(st.speak.map((p) => [p.said, p.designer, p.from])).toEqual([["make it more obvious", "visual hierarchy", "glossary"], ["it gets lost", "visual hierarchy", "glossary"]]);
    const speak = explainSections(st).find((x) => x.key === "speak")!.lines[0]!.text;
    expect(speak).toMatch(/^“make it more obvious” → visual hierarchy/);
    expect(plainReadings("Make it pop, it feels cramped").map((r) => r.term)).toEqual(["contrast", "density"]);
  });

  it("prints the active sections from one function, omitting critique when there isn't one yet", () => {
    const text = explainText(story(acme()));
    for (const heading of ["How it got here", "The roads not taken", "What moved around it since", "Speak design"]) expect(text).toContain(heading);
    expect(text).not.toContain("Critique");
  });
});

describe("the critique, the lead's half", () => {
  it("reads the lead's record back, pairs its speak lines, and finds the proposal citing explain:", () => {
    let s = acme();
    const at = T0 + 40 * 86_400_000;
    s = comment(s, "thr_chat", "cmt_ask", critiqueAsk(kit, { id: "itm_checkout", title: "Checkout" }), maya, at, ["itm_checkout"]);
    expect(story(s).asked).toBe(true);
    const body = critiqueBody({ title: "Checkout" }, { working: "The pickup slot leads.", risk: "The total sits below the fold on small phones.", tryThis: "Pin the total beside the button.", speak: [{ said: "make the total pop", designer: "raise the total's contrast" }] });
    s = comment(s, "thr_chat", "cmt_crit", body, kit, at + 60_000, ["itm_checkout"], { record: true });
    const cite = parseCite("explain:cmt_crit");
    if ("refused" in cite) throw new Error(cite.refused);
    const props = proposalProperties("itm_checkout", "sure", [cite], "Proximity: the total beside the button.");
    expect(proposalRefusal(s.canvas, kit.id, props)).toBeNull();
    s = add(s, "itm_try", "Checkout — proposal", props, kit, at + 120_000, 900);
    const st = story(s);
    expect(st.asked).toBe(false);
    expect(st.critique).toMatchObject({ by: { name: "Kit" }, working: "The pickup slot leads.", risk: "The total sits below the fold on small phones.", tryThis: "Pin the total beside the button.", proposal: { itemId: "itm_try" } });
    expect(st.speak[0]).toMatchObject({ said: "make the total pop", designer: "raise the total's contrast", from: "lead" });
    const lines = explainSections(st).find((x) => x.key === "critique")!.lines;
    expect(lines.map((l) => l.text)).toEqual(["Working: The pickup slot leads.", "A risk: The total sits below the fold on small phones.", "One thing to try: Pin the total beside the button. — a proposal beneath it"]);
    expect(lines[2]!.itemId).toBe("itm_try");
  });

  it("without a lead, says why nothing can critique — and omits the critique section when there isn't one yet", () => {
    const s = acme();
    const why = critiqueCannot({ agent: null, how: "none" }, maya.id, {});
    expect(why).toMatch(/^no agent stands on this canvas — enrol one/);
    expect(critiqueCannot({ agent: { actor: kit }, how: "standing" }, maya.id, {})).toMatch(/nothing is answering for Kit here/);
    expect(critiqueCannot({ agent: { actor: kit }, how: "standing" }, maya.id, { answering: { actorIds: [kit.id] } as never })).toBeNull();
    expect(story(s).critique).toBeNull();
    expect(explainSections(story(s)).find((x) => x.key === "critique")).toBeUndefined();
  });

  it("reads a speak pair, or refuses one", () => {
    expect(parseSpeak("make it pop => raise its contrast")).toEqual({ said: "make it pop", designer: "raise its contrast" });
    expect(parseSpeak("make it pop")).toHaveProperty("refused");
  });
});

describe("explain writes nothing; Copy as rationale is text and a spot", () => {
  it("leaves the canvas exactly as it found it", () => {
    const s = acme();
    const before = JSON.stringify(s.canvas);
    explainText(story(s));
    expect(JSON.stringify(s.canvas)).toBe(before);
  });

  it("writes a dated rationale, and stands it right of the item, clear of everything", () => {
    const s = acme();
    const text = rationaleText(story(s), Date.UTC(2026, 9, 14));
    expect(text.split("\n")[0]).toBe("# Why “Checkout” looks like this");
    expect(text).toContain("## The roads not taken");
    expect(text).toContain("- v31 · Maya chose “Checkout B”");
    expect(text.trim().split("\n").at(-1)).toBe("Written from the canvas's own history by Explain, 2026-10-14.");
    const checkout = s.canvas.items.itm_checkout!;
    const spot = rationaleSpot(s.canvas, checkout, text);
    expect(spot.x).toBeGreaterThanOrEqual(checkout.x + checkout.width);
    for (const other of Object.values(s.canvas.items)) {
      const apart = spot.x + spot.width <= other.x || spot.x >= other.x + other.width || spot.y + spot.height <= other.y || spot.y >= other.y + other.height;
      expect(apart, other.title).toBe(true);
    }
  });

  it("refuses an item that is not there", () => {
    expect(explainStory(acme().canvas, "itm_nope")).toEqual({ refused: "no item itm_nope on this canvas" });
  });
});
