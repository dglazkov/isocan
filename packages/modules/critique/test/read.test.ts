import { describe, expect, it } from "vitest";
import { dispatchReason, SYSTEM_ACTOR, isSystemActor, type CanvasContents, type CommentThread, type Operation } from "@isocan/core";
import critiqueCore, {
  REGION,
  critiqueRead,
  critiqueStatus,
  pinDistance,
  readWords,
  readyLine,
  requestBody,
  MOVE_VOCABULARY,
  moveFamily,
  moveOf,
  opposition,
  stance,
  type CritiqueNote,
} from "../src/core.ts";

/**
 * **The read** (critique phase 3): a pure fold over parsed notes, and the
 * request thread's status, on synthetic notes. And the wake it rests on —
 * `dispatchReason`, the ordinary rule, asked about the lines `critique done`
 * now writes — so "the first critic's done does not wake the second" is a
 * fact about the real router, not a hope.
 */

const QUIET = { id: "act_quiet", name: "Quiet Hands" };
const WARM = { id: "act_warm", name: "Warm Light" };
const PLAIN = { id: "act_plain", name: "Plain Speech" };
const ADA = { id: "usr_ada", name: "Ada" };

let clock = 0;
function note(by: { id: string; name: string }, kind: CritiqueNote["kind"], x: number, y: number, text: string, threadId?: string): CritiqueNote {
  clock += 1;
  return {
    threadId: threadId ?? `thr_${by.id.slice(4)}_${clock}`,
    critic: by.name,
    criticId: by.id,
    item: "itm_screen",
    at: { x, y },
    kind,
    question: 1,
    text,
    createdAt: new Date(Date.UTC(2026, 9, 14, 10, 0, clock)).toISOString(),
  };
}

describe("one region", () => {
  it("is one stated distance in fractions of the screen, inclusive", () => {
    expect(REGION).toBe(0.15);
    expect(pinDistance({ x: 0.5, y: 0.5 }, { x: 0.59, y: 0.62 })).toBeCloseTo(0.15, 10);
    const a = note(QUIET, "risk", 0.5, 0.5, "Too quiet. Make it bolder.");
    const inside = note(WARM, "risk", 0.5, 0.64, "The price hides. Set it larger.");
    const outside = note(WARM, "risk", 0.5, 0.66, "The price hides. Set it larger.");
    expect(critiqueRead([a, inside]).agree).toHaveLength(1);
    expect(critiqueRead([a, outside]).agree).toHaveLength(0);
  });
});

describe("critiqueRead", () => {
  const priceA = note(QUIET, "risk", 0.7, 0.3, "The price is too quiet next to the photo. Set it in the largest type.");
  const priceB = note(WARM, "risk", 0.75, 0.36, "The total reads like a footnote. Give it weight.");
  const photoKeep = note(WARM, "working", 0.5, 0.15, "The photo carries the bakery's warmth. Leave it.");
  const photoCut = note(QUIET, "risk", 0.45, 0.2, "The photo pushes the order below the fold. Cut it.");
  const footer = note(QUIET, "blocker", 0.5, 0.95, "Pay is off-screen on a phone. Move it above the fold.");
  const lonely = note(WARM, "risk", 0.1, 0.6, "The address form asks twice. Ask once.");
  const all = [priceA, priceB, photoKeep, photoCut, footer, lonely];

  it("groups agree, split and blocker, each citing its notes, and keeps the rest as alone", () => {
    const read = critiqueRead(all);
    expect(read.agree).toEqual([{ kind: "risk", critics: ["Quiet Hands", "Warm Light"], notes: [priceA, priceB], at: { x: 0.73, y: 0.33 } }]);
    expect(read.split).toEqual([{ at: { x: 0.48, y: 0.18 }, why: "keep-change", sides: [[photoKeep], [photoCut]], ref: `${photoKeep.threadId}+${photoCut.threadId}` }]);
    expect(read.blocker).toEqual([footer]);
    expect(read.alone).toEqual([lonely]);
  });

  it("is the same read in any order", () => {
    const forward = critiqueRead(all);
    expect(critiqueRead([...all].reverse())).toEqual(forward);
    expect(critiqueRead([all[3]!, all[0]!, all[5]!, all[2]!, all[4]!, all[1]!])).toEqual(forward);
  });

  it("never agrees or splits a critic with itself", () => {
    const one = critiqueRead([note(QUIET, "risk", 0.5, 0.5, "A. Do x."), note(QUIET, "risk", 0.51, 0.5, "B. Do y."), note(QUIET, "working", 0.5, 0.52, "C. Leave it.")]);
    expect(one.agree).toEqual([]);
    expect(one.split).toEqual([]);
    expect(one.alone).toHaveLength(3);
  });

  it("chains a region: a third critic near either note joins the agreement", () => {
    const a = note(QUIET, "risk", 0.2, 0.2, "One. Do it.");
    const b = note(WARM, "risk", 0.3, 0.2, "Two. Do it.");
    const c = note(PLAIN, "risk", 0.42, 0.2, "Three. Do it.");
    const read = critiqueRead([a, b, c]);
    expect(read.agree).toHaveLength(1);
    expect(read.agree[0]!.critics).toEqual(["Quiet Hands", "Warm Light", "Plain Speech"]);
  });

  it("holds a note in an agreement and a split at once, because both are true", () => {
    const a = note(QUIET, "risk", 0.5, 0.5, "Too loud. Quiet it.");
    const b = note(WARM, "risk", 0.52, 0.5, "Too loud. Tone it down.");
    const c = note(PLAIN, "working", 0.5, 0.52, "It is the one thing that speaks. Leave it.");
    const read = critiqueRead([a, b, c]);
    expect(read.agree.map((g) => g.notes)).toEqual([[a, b]]);
    expect(read.split.map((s) => s.sides)).toEqual([[[c], [a, b]]]);
  });

  it("reads 'Leave it.' as keeping, whatever the kind; and a blocker is a change", () => {
    expect(stance({ kind: "working", text: "Good." })).toBe("keep");
    expect(stance({ kind: "risk", text: "It is fine as it stands. Leave it." })).toBe("keep");
    expect(stance({ kind: "risk", text: "Leave it out entirely and use a link." })).toBe("change");
    expect(stance({ kind: "blocker", text: "Broken. Fix it." })).toBe("change");
    const split = critiqueRead([note(QUIET, "working", 0.5, 0.5, "Calm. Leave it."), note(WARM, "blocker", 0.5, 0.55, "Unreadable. Raise contrast.")]);
    expect(split.split).toHaveLength(1);
    expect(split.blocker).toHaveLength(1);
  });

  it("says the fold in words that cite each note, and the both-ref beside a split", () => {
    const words = readWords(critiqueRead(all));
    expect(words.split("\n")).toEqual([
      "**They agree** (2 risk notes near 0.73,0.33): Quiet Hands — “The price is too quiet next to the photo.”; Warm Light — “The total reads like a footnote.”",
      `**They split** near 0.48,0.18: Warm Light (working) — “The photo carries the bakery's warmth.” → “Leave it.” against Quiet Hands (risk) — “The photo pushes the order below the fold.” → “Cut it.” — build both: \`isocan critique both ${photoKeep.threadId}+${photoCut.threadId}\``,
      "**Blocker:** Quiet Hands — “Pay is off-screen on a phone.”",
      "On their own: Warm Light (risk) — “The address form asks twice.”",
    ]);
    expect(readWords(critiqueRead([]))).toBe("**Blocker:** none.");
  });
});

describe("the move, by its verb (MOVE_VOCABULARY)", () => {
  // The critique phase 3 walk's own banner pair, verbatim, as synthetic text.
  const replaceWithPhoto = "The warm brown field suggests a bakery, but its empty gradient gives me no loaf to crave in the first three seconds. Replace it with a close photograph of the sourdough crust.";
  const removeBanner = "The empty gradient banner occupies 244 of the screen's 320 pixels, giving decoration precedence over the order and its cost. Remove the banner.";

  it("reads the move as the note's last sentence", () => {
    expect(moveOf(removeBanner)).toBe("Remove the banner");
    expect(moveOf("Leave it.")).toBe("Leave it");
  });

  it("sorts moves into families, KEEP before ADD before REMOVE", () => {
    expect(Object.keys(MOVE_VOCABULARY)).toEqual(["keep", "add", "remove"]);
    const cases: [string, string][] = [
      [replaceWithPhoto, "add"],
      [removeBanner, "remove"],
      ["Pay and Save compete. Cut Save for later.", "remove"],
      ["The hero is tall. Reduce the hero height so the order arrives sooner.", "remove"],
      ["The price whispers. Make the total larger.", "add"],
      ["The total reads like a footnote. Give it weight.", "add"],
      ["The crust is the brand. Bring in a photograph of it.", "add"],
      ["The pickup window is clear. Leave it.", "keep"],
      ["It earns its place. Keep it as it is.", "keep"],
      ["Two buttons compete. Make Save for later a text link.", "other"],
      ["Leave it out entirely and use a link.", "other"],
      ["Too loud. Tone it down.", "other"],
      ["Do not remove the banner.", "other"],
    ];
    for (const [text, family] of cases) expect([text, moveFamily(text)]).toEqual([text, family]);
  });

  it("splits the walk's banner pair — remove against replace-with — where it used to agree", () => {
    const a = note(WARM, "risk", 0.5, 0.35, replaceWithPhoto);
    const b = note(QUIET, "risk", 0.5, 0.38, removeBanner);
    expect(opposition(a, b)).toBe("remove-add");
    const read = critiqueRead([a, b]);
    expect(read.agree).toEqual([]);
    expect(read.split).toEqual([{ at: { x: 0.5, y: 0.37 }, why: "remove-add", sides: [[b], [a]], ref: `${b.threadId}+${a.threadId}` }]);
    expect(readWords(read).split("\n")[0]).toBe(
      `**They split** near 0.5,0.37 (remove against add): Quiet Hands (risk) — “The empty gradient banner occupies 244 of the screen's 320 pixels, giving decoration prec…” → “Remove the banner.” against Warm Light (risk) — “The warm brown field suggests a bakery, but its empty gradient gives me no loaf to crave…” → “Replace it with a close photograph of the sourdough crust.” — build both: \`isocan critique both ${b.threadId}+${a.threadId}\``,
    );
  });

  it("keeps agreeing when the families match, or either is OTHER", () => {
    expect(opposition({ kind: "risk", text: "Cut it." }, { kind: "risk", text: "Remove it." })).toBeNull();
    expect(opposition({ kind: "risk", text: "Cut it." }, { kind: "risk", text: "Make it a link." })).toBeNull();
    expect(opposition({ kind: "risk", text: "Enlarge it." }, { kind: "risk", text: "Make it a link." })).toBeNull();
    expect(opposition({ kind: "working", text: "Calm. Leave it." }, { kind: "risk", text: "Make it a link." })).toBe("keep-change");
    expect(critiqueRead([note(QUIET, "risk", 0.5, 0.5, "Noisy. Cut it."), note(WARM, "risk", 0.5, 0.52, "Noisy. Drop it.")]).agree).toHaveLength(1);
  });
});

describe("the request thread, and who is done", () => {
  const at = (s: number) => new Date(Date.UTC(2026, 9, 14, 11, 0, s)).toISOString();
  const thread = (...later: { author: { id: string; name: string }; body: string; record?: true; mentions?: string[] }[]): CommentThread =>
    ({
      id: "thr_ask",
      x: 0,
      y: 0,
      anchorItemId: "itm_screen",
      createdAt: at(0),
      createdBy: ADA,
      comments: [
        { id: "cmt_ask", author: ADA, body: requestBody([QUIET.name, WARM.name], "Acme checkout"), mentions: [QUIET.id, WARM.id], items: ["itm_screen"], createdAt: at(0) },
        ...later.map((c, i) => ({ id: `cmt_${i}`, createdAt: at(i + 1), ...c })),
      ],
    }) as CommentThread;

  it("asks every critic in one comment, each told it answers alone", () => {
    expect(requestBody([QUIET.name, WARM.name], "Acme checkout")).toBe(
      "@Quiet and @Warm — what do you make of #Acme checkout? Each of you on your own: pin your notes on it; change nothing.",
    );
    expect(requestBody(QUIET.name, "Acme checkout")).toBe("@Quiet what do you make of #Acme checkout? Pin your notes on it; change nothing.");
  });

  it("counts a done line and the rc's budget stop as finished, and nothing else", () => {
    const critics = [QUIET, WARM];
    expect(critiqueStatus(thread(), critics, isSystemActor)).toMatchObject({ asker: ADA, threadId: "thr_ask", commentId: "cmt_ask", pending: [{ ...QUIET, state: null }, { ...WARM, state: null }] });
    const one = critiqueStatus(thread({ author: QUIET, body: "Done — 3 notes on #Acme checkout: 3 risk.", record: true }, { author: WARM, body: "I think the photo is lovely" }), critics, isSystemActor)!;
    expect(one.asked.map((a) => a.state)).toEqual(["done", null]);
    const both = critiqueStatus(thread({ author: QUIET, body: "Done — 3 notes on #Acme checkout: 3 risk.", record: true }, { author: SYSTEM_ACTOR, body: "Warm Light stopped at its budget — 6 of 6 turns for this run. Ask again in a new thread for a new run." }), critics, isSystemActor)!;
    expect(both.asked.map((a) => a.state)).toEqual(["done", "capped"]);
    expect(both.pending).toEqual([]);
    // A budget line in a critic's voice, or about another, is not a stop.
    expect(critiqueStatus(thread({ author: WARM, body: "Warm Light stopped at its budget" }), critics, isSystemActor)!.asked[1]!.state).toBeNull();
    // A thread that asks no critic is no critique.
    expect(critiqueStatus(thread(), [PLAIN], isSystemActor)).toBeNull();
  });

  it("offers /critique as a module command whose body leads with the verbs", () => {
    const command = critiqueCore.commands!.find((c) => c.name === "critique")!;
    expect(command.source).toBe("module");
    expect(command.body).toContain("isocan critique \"#<Item>\" --by <a>,<b>");
    expect(command.body).toContain("isocan critique read <thread> --post --say");
    expect(command.body).toContain("isocan critique both <ref>");
  });
});

/**
 * **The wake the read rests on**, asked of the real router. Critics are
 * both mentioned in the request, so each is "in" the thread: a plain reply
 * there would wake the other (the control case). A done line is a record,
 * and wakes nobody; the last critic's line mentions the asker, which wakes a
 * lead agent and still not the other critic.
 */
describe("who the done lines wake (dispatchReason, unchanged)", () => {
  const LEAD = { id: "act_lead", name: "Lead Hand" };
  const canvasWith = (asker: { id: string; name: string }): CanvasContents =>
    ({
      items: {},
      agents: {},
      threads: {
        thr_ask: {
          id: "thr_ask",
          x: 0,
          y: 0,
          anchorItemId: "itm_screen",
          createdAt: "2026-10-14T11:00:00.000Z",
          createdBy: asker,
          comments: [{ id: "cmt_ask", author: asker, body: requestBody([QUIET.name, WARM.name], "Acme checkout"), mentions: [QUIET.id, WARM.id], items: ["itm_screen"], createdAt: "2026-10-14T11:00:00.000Z" }],
        },
      },
    }) as unknown as CanvasContents;
  const reply = (comment: Record<string, unknown>): Operation => ({ type: "thread.reply", threadId: "thr_ask", comment: { id: "cmt_x", ...comment } }) as Operation;
  const wakes = (op: Operation, author: string, who: { id: string; name: string }, canvas: CanvasContents) =>
    dispatchReason(op, author, { actorId: who.id, names: [who] }, canvas);

  it("a plain reply by one critic would wake the other — the reason the done line is a record", () => {
    expect(wakes(reply({ body: "Done — 3 notes on #Acme checkout: 3 risk." }), QUIET.id, WARM, canvasWith(ADA))).toBe("in-your-thread");
  });

  it("the first critic's done (a record) wakes nobody", () => {
    const done = reply({ body: "Done — 3 notes on #Acme checkout: 3 risk.", record: true });
    expect(wakes(done, QUIET.id, WARM, canvasWith(LEAD))).toBeNull();
    expect(wakes(done, QUIET.id, LEAD, canvasWith(LEAD))).toBeNull();
  });

  it("the last critic's done wakes the lead who asked, and not the other critic", () => {
    const last = reply({ body: `Done — 2 notes on #Acme checkout: 2 working.\n${readyLine(LEAD.name, "thr_ask")}`, mentions: [LEAD.id] });
    expect(wakes(last, WARM.id, LEAD, canvasWith(LEAD))).toBe("mentioned");
    expect(wakes(last, WARM.id, QUIET, canvasWith(LEAD))).toBeNull();
  });

  it("the posted read is a record too: it wakes neither critic", () => {
    const read = reply({ body: "They pull two ways.\n\n**Blocker:** none.", record: true });
    expect(wakes(read, LEAD.id, QUIET, canvasWith(LEAD))).toBeNull();
    expect(wakes(read, LEAD.id, WARM, canvasWith(LEAD))).toBeNull();
  });

  it("a Build-both ask mentions its builder, so the critics in the thread stay asleep", () => {
    const both = reply({ body: "@Lead build both sides of this split…", mentions: [LEAD.id] });
    expect(wakes(both, ADA.id, LEAD, canvasWith(ADA))).toBe("mentioned");
    expect(wakes(both, ADA.id, QUIET, canvasWith(ADA))).toBeNull();
  });
});
