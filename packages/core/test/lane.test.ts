import { describe, expect, it } from "vitest";
import type { Actor, CanvasContents, Comment, CommentThread, Item } from "../src/model.ts";
import { laneFor, laneOf } from "../src/lane.ts";

/**
 * **The claim an arrow makes.**
 *
 * "Here is what I built" and "look at that" are different things to say, and
 * the whole value of the lane is that it only draws the first. Every test
 * here is a way the distinction can be got wrong, and each one would show up
 * as an arrow pointing at work the message did not do — which is worse than
 * no arrow at all, because a person would stop trusting the ones that are
 * right.
 */
const fable: Actor = { id: "usr_fable", name: "Fable" };
const di: Actor = { id: "usr_di", name: "Di" };

const version = (id: string, by: Actor, at: string) => ({
  id,
  blobHash: `sha_${id}`,
  mimeType: "text/html",
  filename: `${id}.html`,
  size: 1,
  createdAt: at,
  createdBy: by,
});

function item(over: Partial<Item> & { id: string; createdAt: string; createdBy: Actor }): Item {
  return {
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    title: over.id,
    description: "",
    properties: {},
    versions: [version(`${over.id}_v1`, over.createdBy, over.createdAt)],
    currentVersionId: `${over.id}_v1`,
    updatedAt: over.createdAt,
    updatedBy: over.createdBy,
    ...over,
  } as Item;
}

const say = (id: string, by: Actor, at: string, items: string[] = []): Comment => ({
  id,
  author: by,
  body: "…",
  items,
  createdAt: at,
});

const thread = (comments: Comment[]): CommentThread =>
  ({ id: "thr_1", x: 0, y: 0, anchorItemId: null, comments, createdAt: comments[0]!.createdAt }) as
    CommentThread;

const canvasOf = (items: Item[]): CanvasContents =>
  ({ items: Object.fromEntries(items.map((i) => [i.id, i])), threads: {} }) as CanvasContents;

describe("what a message made", () => {
  it("claims an item its author created after saying so", () => {
    const msg = say("c1", fable, "2026-08-01T10:00:00Z", ["itm_a"]);
    const canvas = canvasOf([item({ id: "itm_a", createdAt: "2026-08-01T10:00:30Z", createdBy: fable })]);
    const made = laneFor(canvas, thread([msg]), msg);
    expect(made).toEqual([{ itemId: "itm_a", title: "itm_a", version: 1, born: true }]);
  });

  it("does not claim an item that already existed — that is a mention", () => {
    // The difference the whole feature rests on. Pointing at something is not
    // making it, and an arrow that cannot tell them apart is decoration.
    const msg = say("c1", fable, "2026-08-01T10:00:00Z", ["itm_a"]);
    const canvas = canvasOf([item({ id: "itm_a", createdAt: "2026-07-01T09:00:00Z", createdBy: fable })]);
    expect(laneFor(canvas, thread([msg]), msg)).toEqual([]);
  });

  it("claims what its author made moments BEFORE saying so", () => {
    /**
     * The commonest flow in the product, and it produced no arrow at all
     * until this was fixed. `comment.items` is resolved when a message is
     * written, so an agent cannot #-reference an item that does not exist
     * yet: the only way to point at a new thing is to make it first and
     * announce it after. A rule that demanded the work come after the words
     * described a habit nobody has.
     *
     * Found by using it rather than by reading it — an agent probe added an
     * item and announced it, exactly as an agent does, and the lane stayed
     * empty.
     */
    const msg = say("c1", fable, "2026-08-01T10:00:30Z", ["itm_a"]);
    const canvas = canvasOf([item({ id: "itm_a", createdAt: "2026-08-01T10:00:00Z", createdBy: fable })]);
    expect(laneFor(canvas, thread([msg]), msg)).toEqual([
      { itemId: "itm_a", title: "itm_a", version: 1, born: true },
    ]);
  });

  it("will not reach back past the author's previous word", () => {
    // The span a message owns starts where the author last spoke. Work done
    // before that belongs to the earlier message, or to no message at all.
    const first = say("c1", fable, "2026-08-01T10:00:00Z", []);
    const second = say("c2", fable, "2026-08-01T10:05:00Z", ["itm_a"]);
    const canvas = canvasOf([
      item({ id: "itm_a", createdAt: "2026-08-01T09:59:00Z", createdBy: fable }),
    ]);
    expect(laneFor(canvas, thread([first, second]), second)).toEqual([]);
  });

  it("does not claim somebody else's work", () => {
    // An agent's message does not get credit for the version a person
    // uploaded half a minute later.
    const msg = say("c1", fable, "2026-08-01T10:00:00Z", ["itm_a"]);
    const canvas = canvasOf([item({ id: "itm_a", createdAt: "2026-08-01T10:00:30Z", createdBy: di })]);
    expect(laneFor(canvas, thread([msg]), msg)).toEqual([]);
  });

  it("infers nothing from the prose — only what the message pointed at", () => {
    const msg = say("c1", fable, "2026-08-01T10:00:00Z", []); // no #ref
    const canvas = canvasOf([item({ id: "itm_a", createdAt: "2026-08-01T10:00:30Z", createdBy: fable })]);
    expect(laneFor(canvas, thread([msg]), msg)).toEqual([]);
  });

  it("names the version the item's own badge shows", () => {
    const msg = say("c1", fable, "2026-08-01T10:00:00Z", ["itm_a"]);
    const existing = item({ id: "itm_a", createdAt: "2026-07-01T09:00:00Z", createdBy: di });
    existing.versions = [
      version("v1", di, "2026-07-01T09:00:00Z"),
      version("v2", di, "2026-07-02T09:00:00Z"),
      version("v3", fable, "2026-08-01T10:01:00Z"),
    ];
    const made = laneFor(canvasOf([existing]), thread([msg]), msg);
    expect(made).toEqual([{ itemId: "itm_a", title: "itm_a", version: 3, born: false }]);
  });

  it("points at the version the author ended on, not the one they started with", () => {
    // An agent that saves three times between two messages produced the
    // third. Pointing at the first sends somebody to a superseded version.
    const msg = say("c1", fable, "2026-08-01T10:00:00Z", ["itm_a"]);
    const it0 = item({ id: "itm_a", createdAt: "2026-07-01T09:00:00Z", createdBy: di });
    it0.versions = [
      version("v1", di, "2026-07-01T09:00:00Z"),
      version("v2", fable, "2026-08-01T10:01:00Z"),
      version("v3", fable, "2026-08-01T10:02:00Z"),
    ];
    expect(laneFor(canvasOf([it0]), thread([msg]), msg)[0]?.version).toBe(3);
  });

  it("stops claiming at the author's next word", () => {
    /**
     * The bound that was NOT in the original sketch, and the feature is wrong
     * without it: with only a lower bound, the first message that ever
     * mentioned an item claims every version made afterwards, so a long
     * thread grows arrows pointing at work a later message did.
     */
    const first = say("c1", fable, "2026-08-01T10:00:00Z", ["itm_a"]);
    const second = say("c2", fable, "2026-08-01T11:00:00Z", ["itm_a"]);
    const it0 = item({ id: "itm_a", createdAt: "2026-07-01T09:00:00Z", createdBy: di });
    it0.versions = [
      version("v1", di, "2026-07-01T09:00:00Z"),
      version("v2", fable, "2026-08-01T10:30:00Z"), // between the two: the first's
      version("v3", fable, "2026-08-01T11:30:00Z"), // after the second: not the first's
    ];
    const t = thread([first, second]);
    expect(laneFor(canvasOf([it0]), t, first)[0]?.version).toBe(2);
    expect(laneFor(canvasOf([it0]), t, second)[0]?.version).toBe(3);
  });

  it("is not confused by somebody else speaking in between", () => {
    // The bound is the AUTHOR's next word, not the thread's. A person saying
    // "thanks" does not end what the agent is still doing.
    const msg = say("c1", fable, "2026-08-01T10:00:00Z", ["itm_a"]);
    const interjection = say("c2", di, "2026-08-01T10:10:00Z", []);
    const it0 = item({ id: "itm_a", createdAt: "2026-07-01T09:00:00Z", createdBy: di });
    it0.versions = [
      version("v1", di, "2026-07-01T09:00:00Z"),
      version("v2", fable, "2026-08-01T10:20:00Z"),
    ];
    expect(laneFor(canvasOf([it0]), thread([msg, interjection]), msg)[0]?.version).toBe(2);
  });

  it("survives an item that has been deleted since", () => {
    // A lane is drawn from history against a live canvas, so the thing an old
    // message made may simply not be there any more. That is a quiet skip,
    // never a crash and never a chip pointing at nothing.
    const msg = say("c1", fable, "2026-08-01T10:00:00Z", ["itm_gone"]);
    expect(laneFor(canvasOf([]), thread([msg]), msg)).toEqual([]);
  });

  it("reports only the messages that made something", () => {
    const made = say("c1", fable, "2026-08-01T10:00:00Z", ["itm_a"]);
    const chat = say("c2", di, "2026-08-01T10:05:00Z", []);
    const canvas = canvasOf([item({ id: "itm_a", createdAt: "2026-08-01T10:00:30Z", createdBy: fable })]);
    const lane = laneOf(canvas, thread([made, chat]));
    expect(lane).toHaveLength(1);
    expect(lane[0]!.comment.id).toBe("c1");
  });
});
