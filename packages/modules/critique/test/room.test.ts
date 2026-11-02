import { describe, expect, it } from "vitest";
import { applyOperation, OpValidationError, type Actor, type CanvasState, type Operation } from "@isocan/core";
import { CRITIC_PROP, canvasClashes, findCritic, mentionClash, noteBody, readCritic, criticMarkdown, refuseJoin, type Critic } from "../src/core.ts";
import {
  CRITIC_COLOR,
  CRITIC_LOUD,
  CRITIC_ON,
  CRITIC_WHEN,
  LOUDNESS,
  PAUSE_MS,
  PAUSE_STALE_MS,
  STARTER_LENSES,
  WHENS,
  bothAsked,
  describedDraft,
  findStarter,
  loudRefusal,
  pauseDue,
  postedRoomRead,
  roomAskBody,
  roomAskFor,
  roomAsks,
  roomBothBody,
  roomNotes,
  roomRead,
  roomReadBody,
  roomSettings,
  settingsPatch,
  starterDraft,
} from "../src/room.ts";

/**
 * **Critics in the room** (proactive-agent phase 8): the deterministic half,
 * on a synthetic Acme canvas. Maya switches on two lenses, The Reductionist
 * and The Brand Voice; Kit, the lead, wears them over the Home screen. The
 * read of the room sorts their notes into agree, split and blocker — and two
 * lenses that disagree about one banner are a **split, never an average**.
 * Every lens note is a comment: the screen's versions do not move. And the
 * settings, the starter lenses, a described lens, the pause, and the ask
 * and the read as the Chat carries them.
 */

const MAYA: Actor = { id: "usr_maya", name: "Maya" };
const KIT: Actor = { id: "usr_kit", name: "Kit" };
const T0 = Date.parse("2026-10-14T10:00:00.000Z");
let n = 0;

function apply(s: CanvasState | null, op: Operation, actor: Actor = MAYA, at?: number): CanvasState {
  n += 1;
  return applyOperation(s, { id: `op_${n}`, canvasId: op.type === "project.create" ? null : "prj_acme", actor, ts: new Date(at ?? T0 + n * 1000).toISOString(), op })!;
}

const html = (id: string) => ({ id, blobHash: `h_${id}`, mimeType: "text/html", filename: "home.html", size: 10 });
const md = (id: string) => ({ id, blobHash: `h_${id}`, mimeType: "text/markdown", filename: `${id}.md`, size: 10 });

/** Acme's Home screen, two lens cards switched on, and the main thread. */
function acme(): CanvasState {
  let s = apply(null, { type: "project.create", canvasId: "prj_acme", title: "Acme Bakery", description: "" });
  s = apply(s, { type: "item.add", itemId: "itm_home", version: html("ver_home"), width: 390, height: 800, placement: { x: 0, y: 0 }, title: "Home" });
  for (const lens of [STARTER_LENSES[0]!, STARTER_LENSES[1]!]) {
    const d = starterDraft(lens);
    s = apply(s, { type: "item.add", itemId: `itm_${d.name}`, version: md(`ver_${d.name}`), width: 360, height: 440, placement: { x: 500, y: 0 }, title: d.agentName, properties: { [CRITIC_PROP]: d.name, [CRITIC_ON]: "on", [CRITIC_COLOR]: d.color! } });
  }
  s = apply(s, { type: "thread.create", threadId: "thr_main", x: 0, y: 0, anchorItemId: null, main: true, comment: { id: "cmt_hello", body: "Hello" } });
  return s;
}

const LENSES = [
  { name: "the-reductionist", agentName: "The Reductionist", loud: "studio" as const },
  { name: "the-brand-voice", agentName: "The Brand Voice", loud: "studio" as const },
];

/** Maya asks the room about Home, in the Chat. */
function ask(s: CanvasState): CanvasState {
  return apply(s, { type: "thread.reply", threadId: "thr_main", comment: { id: "cmt_ask", body: roomAskBody(KIT, [{ id: "itm_home", title: "Home", versionId: "ver_home" }], LENSES, "asked"), mentions: [KIT.id], items: ["itm_home"] } });
}

/** Kit's note, worn as one lens: a thread on Home whose first comment carries `persona`. */
function lens(s: CanvasState, threadId: string, persona: string, kind: "working" | "risk" | "blocker", at: [number, number], text: string): CanvasState {
  return apply(s, { type: "thread.create", threadId, x: 390 * at[0], y: 800 * at[1], anchorItemId: "itm_home", comment: { id: `cmt_${threadId}`, body: noteBody({ kind, question: 1, text }), persona } }, KIT);
}

describe("the read of the room", () => {
  it("two lenses that disagree about one banner are a split, never an average", () => {
    let s = ask(acme());
    s = lens(s, "thr_cut", "the-reductionist", "risk", [0.5, 0.2], "The promotion banner competes with the order button. Cut it.");
    s = lens(s, "thr_keep", "the-brand-voice", "working", [0.52, 0.22], "The banner's red is the only thing that says Acme. Leave it.");
    s = lens(s, "thr_hero_a", "the-reductionist", "risk", [0.5, 0.6], "The hero photo pushes the menu below the fold. Reduce it.");
    s = lens(s, "thr_hero_b", "the-brand-voice", "risk", [0.55, 0.62], "The hero photo is a stock loaf. Shrink it to a strip.");
    const a = roomAskFor(s.canvas, "itm_home")!;
    const r = roomRead(s.canvas, a, "itm_home");

    expect(r.notes.map((x) => x.critic).sort()).toEqual(["The Brand Voice", "The Brand Voice", "The Reductionist", "The Reductionist"]);
    expect(r.notes.every((x) => x.by?.name === "Kit" && x.criticId.startsWith("persona:"))).toBe(true);
    // The banner: one keeps what the other would cut — two sides, both kept whole.
    expect(r.read.split).toHaveLength(1);
    const [split] = r.read.split;
    expect(split!.sides[0].map((x) => x.critic)).toEqual(["The Brand Voice"]);
    expect(split!.sides[1].map((x) => x.critic)).toEqual(["The Reductionist"]);
    expect(split!.ref).toBe("thr_keep+thr_cut");
    // The hero: two risks in one region whose moves agree.
    expect(r.read.agree).toHaveLength(1);
    expect(r.read.agree[0]!.critics.sort()).toEqual(["The Brand Voice", "The Reductionist"]);
    expect(r.read.blocker).toEqual([]);
    expect(r.silent).toEqual([]);

    // Posted, the words above the fold are the lead's; the fold carries build both.
    const body = roomReadBody(s.canvas.items["itm_home"]!, a, "Reduction against recognition: the banner is both the noise and the brand.", r.read, []);
    expect(body).toContain("**They split**");
    expect(body).toContain("build both: `isocan critique both thr_keep+thr_cut`");
    expect(body).not.toMatch(/average|compromise|halfway/i);
    s = apply(s, { type: "thread.reply", threadId: "thr_main", comment: { id: "cmt_read", body, record: true, items: ["itm_home"] } }, KIT);
    expect(postedRoomRead(s.canvas, a, "itm_home")).toMatchObject({ commentId: "cmt_read", by: KIT, say: "Reduction against recognition: the banner is both the noise and the brand." });
  });

  it("lens notes are comments only: the screen and every item stand as they were", () => {
    const before = ask(acme());
    let s = lens(before, "thr_cut", "the-reductionist", "risk", [0.5, 0.2], "The banner competes. Cut it.");
    s = lens(s, "thr_keep", "the-brand-voice", "working", [0.5, 0.2], "The banner is the brand. Leave it.");
    expect(s.canvas.items).toEqual(before.canvas.items);
    expect(Object.keys(s.canvas.threads).length).toBe(Object.keys(before.canvas.threads).length + 2);
  });

  it("reads only the lenses asked, since they were asked, and names the silent", () => {
    let s = acme();
    s = lens(s, "thr_old", "the-reductionist", "risk", [0.5, 0.2], "Before the ask. Cut it.");
    s = ask(s);
    s = lens(s, "thr_new", "the-reductionist", "blocker", [0.5, 0.9], "The order button is below the fold on a phone. Move it up.");
    const a = roomAskFor(s.canvas, "itm_home")!;
    expect(roomNotes(s.canvas, a, "itm_home").map((x) => x.threadId)).toEqual(["thr_new"]);
    const r = roomRead(s.canvas, a, "itm_home");
    expect(r.read.blocker.map((x) => x.threadId)).toEqual(["thr_new"]);
    expect(r.silent).toEqual(["the-brand-voice"]);
  });

  it("the ask reads back off the Chat: screens at their versions, the lenses, and why", () => {
    const s = ask(acme());
    expect(roomAsks(s.canvas)).toEqual([{ commentId: "cmt_ask", createdAt: expect.any(String), by: MAYA, screens: [{ itemId: "itm_home", versionId: "ver_home" }], critics: ["the-reductionist", "the-brand-voice"], why: "asked" }]);
    const body = roomAskBody(KIT, [{ id: "itm_home", title: "Home", versionId: "ver_home" }], LENSES, "share", ["Contrast: primary is 3.1:1."]);
    expect(body).toMatch(/^@Kit Crit, please \(itm_home@ver_home\): “Home” as The Reductionist \(studio crit\) and The Brand Voice \(studio crit\) — before they share\.$/m);
    expect(body).toContain("The desk check found: Contrast: primary is 3.1:1.");
    expect(body).toContain("never from another lens's notes");
    expect(body).toContain("Critics never edit");
  });

  it("build both asks the lead for two proposals, each citing the note it answers — once", () => {
    let s = ask(acme());
    s = lens(s, "thr_cut", "the-reductionist", "risk", [0.5, 0.2], "The banner competes. Cut it.");
    s = lens(s, "thr_keep", "the-brand-voice", "working", [0.5, 0.2], "The banner is the brand. Leave it.");
    const r = roomRead(s.canvas, roomAskFor(s.canvas, "itm_home")!, "itm_home");
    const [keep, cut] = r.read.split[0]!.sides.map((side) => side[0]!);
    const body = roomBothBody(KIT, s.canvas.items["itm_home"]!, keep!, cut!);
    expect(body).toContain("isocan propose itm_home <file> --cites critic:thr_keep");
    expect(body).toContain("isocan propose itm_home <file> --cites critic:thr_cut");
    expect(body).toContain("Leave “Home” as it is");
    expect(bothAsked(s.canvas, "thr_keep+thr_cut")).toBe(false);
    s = apply(s, { type: "thread.reply", threadId: "thr_main", comment: { id: "cmt_both", body, mentions: [KIT.id] } });
    expect(bothAsked(s.canvas, "thr_keep+thr_cut")).toBe(true);
  });
});

describe("how loud, and when", () => {
  it("defaults to off, studio crit, only when asked; a patch is one update and refuses what is not a setting", () => {
    expect(roomSettings({ properties: {} })).toEqual({ on: false, loud: "studio", when: "asked", color: null });
    expect(roomSettings({ properties: { [CRITIC_ON]: "on", [CRITIC_LOUD]: "blockers", [CRITIC_WHEN]: "share", [CRITIC_COLOR]: "#3056c8" } })).toEqual({ on: true, loud: "blockers", when: "share", color: "#3056c8" });
    expect(settingsPatch({ on: false, loud: "everything", when: "pause" })).toEqual({ [CRITIC_ON]: "off", [CRITIC_LOUD]: "everything", [CRITIC_WHEN]: "pause" });
    expect(settingsPatch({ loud: "shouty" })).toEqual({ refused: 'how loud is blockers, studio, everything — not "shouty"' });
    expect(settingsPatch({ when: "always" })).toEqual({ refused: 'when is pause, share, asked — not "always"' });
    expect(Object.keys(WHENS)).toEqual(["pause", "share", "asked"]);
  });

  it("a lens says only what its volume allows", () => {
    expect(loudRefusal("The Reductionist", "blockers", "risk", 0)).toBe("The Reductionist is set to blockers only — a risk note is quieter than it speaks");
    expect(loudRefusal("The Reductionist", "blockers", "blocker", 0)).toBeNull();
    expect(loudRefusal("The Reductionist", "studio", "working", 2)).toBeNull();
    expect(loudRefusal("The Reductionist", "studio", "risk", 3)).toMatch(/studio crit is at most 3/);
    expect(loudRefusal("The Reductionist", "everything", "risk", 7)).toBeNull();
    expect(LOUDNESS.everything.cap).toBe(8);
  });

  it("a pause asks once: after a minute of quiet, on the person's last screen, with the lenses set to it", () => {
    let s = acme();
    const critics = Object.values(s.canvas.items).flatMap((i) => (i.properties[CRITIC_PROP] ? [{ itemId: i.id, name: i.properties[CRITIC_PROP]! }] : []));
    const edit = T0 + 10 * 60_000;
    s = apply(s, { type: "item.addVersion", itemId: "itm_home", version: html("ver_home_2") }, MAYA, edit);
    // Nobody set to "when I pause" yet.
    expect(pauseDue(s.canvas, MAYA.id, edit + PAUSE_MS + 1, critics)).toBeNull();
    s = apply(s, { type: "item.update", itemId: "itm_the-brand-voice", patch: { properties: { [CRITIC_WHEN]: "pause" } } });
    expect(pauseDue(s.canvas, MAYA.id, edit + PAUSE_MS - 1, critics)).toBeNull();
    expect(pauseDue(s.canvas, MAYA.id, edit + PAUSE_MS + 1, critics)).toEqual({ itemId: "itm_home", versionId: "ver_home_2", critics: ["the-brand-voice"] });
    expect(pauseDue(s.canvas, MAYA.id, edit + PAUSE_STALE_MS + 1, critics)).toBeNull();
    // Somebody else's edit is not this person's pause.
    expect(pauseDue(s.canvas, KIT.id, edit + PAUSE_MS + 1, critics)).toBeNull();
    // Switched off, it does not speak.
    const off = apply(s, { type: "item.update", itemId: "itm_the-brand-voice", patch: { properties: { [CRITIC_ON]: "off" } } });
    expect(pauseDue(off.canvas, MAYA.id, edit + PAUSE_MS + 1, critics)).toBeNull();
    // Asked once for that version, never again.
    s = apply(s, { type: "thread.reply", threadId: "thr_main", comment: { id: "cmt_pause", body: roomAskBody(KIT, [{ id: "itm_home", title: "Home", versionId: "ver_home_2" }], [LENSES[1]!], "pause"), mentions: [KIT.id] } });
    expect(roomAsks(s.canvas).at(-1)?.why).toBe("pause");
    expect(pauseDue(s.canvas, MAYA.id, edit + PAUSE_MS + 1, critics)).toBeNull();
  });
});

describe("lenses, never people", () => {
  it("the starter lenses are named for what they look for, and two that start with The do not clash", () => {
    const drafts = STARTER_LENSES.map(starterDraft);
    expect(drafts.map((d) => d.agentName)).toEqual(["The Reductionist", "The Brand Voice", "The Newcomer", "The Craftsperson"]);
    const on = drafts.map((d, i) => ({ itemId: `itm_${i}`, critic: readCritic(criticMarkdown(d))! }));
    expect(on.every(({ critic }) => critic.line.length > 0 && critic.credit.includes("not affiliated"))).toBe(true);
    expect(canvasClashes(on)).toEqual([]);
    expect(refuseJoin(on.slice(0, 1), drafts[1]!)).toBeNull();
    expect(findCritic(on, "reductionist", [])?.critic.agentName).toBe("The Reductionist");
    expect(findCritic(on, "brand-voice", [])?.critic.agentName).toBe("The Brand Voice");
    expect(findStarter("Brand Voice")?.id).toBe("brand-voice");
    // A mention cannot tell two "The …" critics apart, so --by asks them one at a time.
    expect(mentionClash(on.slice(0, 2).map((o) => o.critic) as Critic[])).toMatch(/ask them one at a time, or as the lead's lenses with `--as`/);
  });

  it("a described lens takes the line as its question, and may carry no word of the work it is after", () => {
    const d = describedDraft({ agentName: "The Purist", line: "One typeface, one accent, nothing decorative.", refs: "Swiss railway signage" });
    expect("refused" in d).toBe(false);
    const critic = readCritic(criticMarkdown(d as never))!;
    expect(critic).toMatchObject({ agentName: "The Purist", line: "One typeface, one accent, nothing decorative.", questions: ["One typeface, one accent, nothing decorative."] });
    expect(critic.credit).toBe("after Swiss railway signage; a lens, not affiliated with anyone it references");
    expect(describedDraft({ agentName: "The Swiss Eye", line: "Grids.", refs: "Swiss railway signage" })).toEqual({ refused: expect.stringMatching(/carries "swiss" from "Swiss railway signage" — a critic is named for its principle, never its person/) });
    expect(describedDraft({ agentName: "The Purist", line: "" })).toEqual({ refused: expect.stringMatching(/says what it looks for in one line/) });
  });

  it("the canvas refuses a note worn as a critic named any other way than a card's name", () => {
    const s = acme();
    expect(() => apply(s, { type: "thread.create", threadId: "thr_x", x: 0, y: 0, anchorItemId: "itm_home", comment: { id: "cmt_x", body: "x", persona: "A Person" } }, KIT)).toThrow(OpValidationError);
  });
});
