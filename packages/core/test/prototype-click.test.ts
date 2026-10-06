import { describe, expect, it } from "vitest";
import type { Actor, Operation } from "../src/index.ts";
import {
  CLICK_COALESCE_MS,
  clickBody,
  clickFromMessage,
  clickOp,
  coalescedClick,
  dispatchReason,
  itemThread,
  namesFor,
} from "../src/index.ts";
import { alice, apply, nv, seedState } from "./helpers.ts";

/**
 * **The prototype click's pure half** (`prototype-click.ts`): what a frame
 * may post, the comment it becomes on the item's thread, who that wakes, and
 * the window that folds a repeated press into one.
 *
 * Fixtures are synthetic: Alice clicks; Percy, an agent, published the screen.
 */
const percy: Actor = { id: "act_percy", name: "Percy" };

function withPrototype() {
  return apply(
    seedState(),
    {
      type: "item.add",
      itemId: "itm_proto",
      version: { ...nv("ver_proto"), mimeType: "text/html", filename: "prototype.html" },
      width: 400,
      height: 800,
      placement: { x: 900, y: 0 },
      title: "Acme Prototype",
    },
    percy,
  )!;
}

const press = { type: "isocan:click", element: "home.hero.cta", label: "Get started", screen: "home", intent: "begin sign-up" };

describe("clickFromMessage — what a frame may post", () => {
  it("reads a click and names the item it came from", () => {
    expect(clickFromMessage(press, "itm_proto")).toEqual({
      itemId: "itm_proto",
      element: "home.hero.cta",
      label: "Get started",
      screen: "home",
      intent: "begin sign-up",
    });
  });

  it("ignores every other message, and a click nobody could act on", () => {
    expect(clickFromMessage({ isocanMeasure: true }, "itm_proto")).toBeNull();
    expect(clickFromMessage("isocan:click", "itm_proto")).toBeNull();
    expect(clickFromMessage({ type: "isocan:click", element: "  " }, "itm_proto")).toBeNull();
  });

  it("lets a label stand for the id, and bounds what untrusted content can say", () => {
    expect(clickFromMessage({ type: "isocan:click", label: "Pricing" }, "itm_proto")).toEqual({
      itemId: "itm_proto",
      element: "Pricing",
      label: "Pricing",
    });
    const long = clickFromMessage({ type: "isocan:click", element: "x".repeat(5000), intent: "y".repeat(5000) }, "itm_proto")!;
    expect(long.element.length).toBe(200);
    expect(long.intent!.length).toBe(500);
  });
});

describe("a click on the canvas", () => {
  it("births the item's thread, mentions the publisher, and carries the click as data", () => {
    let s = withPrototype();
    const click = clickFromMessage(press, "itm_proto")!;
    const op = clickOp(s.canvas, click, alice.id);
    expect(op).toMatchObject({
      type: "thread.create",
      anchorItemId: "itm_proto",
      x: 400,
      y: 0,
      comment: { body: "Clicked “Get started” (home.hero.cta) on home — begin sign-up", mentions: [percy.id], click },
    });
    s = apply(s, op, alice)!;
    const thread = itemThread(s.canvas, "itm_proto")!;
    expect(thread.comments[0]).toMatchObject({ author: alice, click });

    const again = clickOp(s.canvas, { ...click, element: "home.nav.pricing", label: "Pricing" }, alice.id);
    expect(again).toMatchObject({ type: "thread.reply", threadId: thread.id });
  });

  it("wakes the agent that published the screen, and never the person who clicked", () => {
    const s = withPrototype();
    const op = clickOp(s.canvas, clickFromMessage(press, "itm_proto")!, alice.id);
    expect(dispatchReason(op, alice.id, { actorId: percy.id, names: namesFor(percy) }, s.canvas)).toBe("mentioned");
    expect(dispatchReason(op, alice.id, { actorId: alice.id, names: namesFor(alice) }, s.canvas)).toBeNull();
  });

  it("mentions nobody when the person clicking published the screen", () => {
    const s = withPrototype();
    const op = clickOp(s.canvas, clickFromMessage(press, "itm_proto")!, percy.id) as Extract<Operation, { type: "thread.create" }>;
    expect(op.comment.mentions).toBeUndefined();
  });

  it("refuses a click that is not one at the reducer", () => {
    const s = withPrototype();
    expect(() =>
      apply(s, { type: "thread.create", threadId: "thr_bad", x: 0, y: 0, anchorItemId: "itm_proto", comment: { id: "cmt_bad", body: "x", click: { itemId: "itm_proto" } as never } }, alice),
    ).toThrow(/prototype click/);
  });

  it("clickBody leaves out what the page did not say", () => {
    expect(clickBody({ itemId: "itm_proto", element: "Pricing", label: "Pricing" })).toBe("Clicked “Pricing”");
  });
});

describe("coalescedClick — one press, however many clicks", () => {
  it("folds the same person's press on the same control inside the window, and nothing else", () => {
    const s = apply(withPrototype(), clickOp(withPrototype().canvas, clickFromMessage(press, "itm_proto")!, alice.id), alice)!;
    const at = Date.parse(itemThread(s.canvas, "itm_proto")!.comments[0]!.createdAt);
    const click = clickFromMessage(press, "itm_proto")!;
    expect(coalescedClick(s.canvas, click, alice.id, at + 1_000)).toBe(true);
    expect(coalescedClick(s.canvas, click, alice.id, at + CLICK_COALESCE_MS)).toBe(false);
    expect(coalescedClick(s.canvas, click, "usr_bob", at + 1_000)).toBe(false);
    expect(coalescedClick(s.canvas, { ...click, element: "home.nav.pricing" }, alice.id, at + 1_000)).toBe(false);
  });
});
