import { describe, expect, it } from "vitest";
import type { CanvasContents, Item } from "../src/model.ts";
import { convergePlan, isRefusal } from "../src/converge.ts";
import { lineageProperties } from "../src/lineage.ts";

/**
 * **The half of diverge/converge the whole category left undone.**
 *
 * `/variation` makes siblings and each says what it was made from. Nothing
 * could ever say "this is the one", so a canvas accumulates four screens
 * where a decision was made about one, and the decision is recorded nowhere.
 *
 * Every refusal here is a sentence rather than a boolean, because each of
 * them is something somebody could reasonably try and "cannot converge" tells
 * them nothing about which assumption was wrong.
 */
const actor = { id: "usr_1", name: "Di" };
const version = (id: string) => ({
  id, blobHash: `sha_${id}`, mimeType: "text/html", filename: `${id}.html`,
  size: 1, createdAt: "2026-01-01T00:00:00.000Z", createdBy: actor,
});
const item = (id: string, title: string, props: Record<string, string> = {}): Item =>
  ({
    id, title, x: 0, y: 0, width: 10, height: 10, description: "",
    properties: props, versions: [version(`${id}_v1`)], currentVersionId: `${id}_v1`,
    createdAt: "2026-01-01T00:00:00.000Z", createdBy: actor,
    updatedAt: "2026-01-01T00:00:00.000Z", updatedBy: actor,
  }) as unknown as Item;
const canvasOf = (items: Item[]): CanvasContents =>
  ({ items: Object.fromEntries(items.map((i) => [i.id, i])), threads: {} }) as unknown as CanvasContents;

const source = () => item("itm_src", "Checkout");
const child = (id: string, title: string) => item(id, title, lineageProperties("itm_src"));

describe("choosing one", () => {
  it("folds the winner onto its source and clears the exploration", () => {
    const canvas = canvasOf([source(), child("itm_a", "Bold"), child("itm_b", "Quiet")]);
    const plan = convergePlan(canvas, "itm_a");
    if (isRefusal(plan)) throw new Error(plan.refused);
    expect(plan.parentId).toBe("itm_src");
    expect(plan.version.blobHash).toBe("sha_itm_a_v1");
    // The winner goes to the trash TOO, and that is the point rather than an
    // oversight: its content now lives on the parent's stack, so leaving it
    // would be two copies of one decision and an invitation to edit the wrong
    // one. Nothing is lost — the trash is reversible.
    expect(plan.trash.sort()).toEqual(["itm_a", "itm_b"]);
  });

  it("names the decision, which is what the group label carries", () => {
    const canvas = canvasOf([source(), child("itm_a", "Bold")]);
    const plan = convergePlan(canvas, "itm_a");
    if (isRefusal(plan)) throw new Error(plan.refused);
    // A label on the GROUP rather than a name on the version: it is the name
    // of the decision, and the decision is the group.
    expect(plan.label).toBe("chose Bold");
  });

  it("works on an only child", () => {
    const canvas = canvasOf([source(), child("itm_a", "Bold")]);
    const plan = convergePlan(canvas, "itm_a");
    expect(isRefusal(plan)).toBe(false);
  });
});

describe("what it will not do, and says why", () => {
  it("refuses an item that was not made from anything", () => {
    const plan = convergePlan(canvasOf([source()]), "itm_src");
    expect(isRefusal(plan) && plan.refused).toContain("not made from anything");
  });

  it("refuses when the source has been deleted since", () => {
    // Reachable: explore from a screen, then trash the screen. The children
    // still name a parent that is not there.
    const orphan = child("itm_a", "Bold");
    expect(isRefusal(convergePlan(canvasOf([orphan]), "itm_a")) && "yes").toBe("yes");
    const plan = convergePlan(canvasOf([orphan]), "itm_a");
    expect(isRefusal(plan) && plan.refused).toContain("no longer on the canvas");
  });

  it("refuses an item that is not here at all", () => {
    const plan = convergePlan(canvasOf([source()]), "itm_nope");
    expect(isRefusal(plan) && plan.refused).toContain("no item itm_nope");
  });

  it("refuses an item with nothing in it", () => {
    const empty = { ...child("itm_a", "Bold"), versions: [], currentVersionId: "" } as unknown as Item;
    const plan = convergePlan(canvasOf([source(), empty]), "itm_a");
    expect(isRefusal(plan) && plan.refused).toContain("no content");
  });
});
