import { describe, expect, it } from "vitest";
import { ownerOf, ownsCanvas } from "../src/grants.ts";
import { isFramedItem } from "../src/kinds.ts";
import type { Item } from "../src/model.ts";

/**
 * **Two rules that came out of the same afternoon of presenting.**
 *
 * Ownership, because a non-owner pressed "Can view" and the sweep took THEM
 * with it — into a canvas they could only look at, with the control that
 * would undo it behind the edit they had just given away.
 *
 * And whether an item is a frame, because a sandboxed iframe cannot be
 * photographed: the view transition that pushes one slide over the next
 * captured a blank rectangle and animated it, which is a white flash on
 * every flip that no amount of caching could touch.
 */
describe("who owns a canvas", () => {
  const project = { createdBy: { id: "usr_dion", name: "Dion" } };

  it("is whoever made it, which every canvas already recorded", () => {
    // No migration and no new field: `createdBy` has been on every canvas
    // since the first one, so canvases made before this rule have an owner.
    expect(ownerOf(project)).toBe("usr_dion");
    expect(ownsCanvas(project, "usr_dion")).toBe(true);
  });

  it("is not whoever happens to be holding an edit grant", () => {
    expect(ownsCanvas(project, "usr_someone_else")).toBe(false);
  });

  it("is an ACTOR, so the same person owns it from another surface", () => {
    /**
     * The reported shape: the canvas was made by one identity and the link
     * pressed from a browser wearing another. `{root: "created"}` marks one
     * BADGE, and a person has a laptop, a phone and a terminal — so owning by
     * badge would have made the owner a stranger to their own canvas.
     */
    expect(ownsCanvas(project, ownerOf(project))).toBe(true);
  });
});

describe("an item that lives in a frame", () => {
  const item = (mime: string, props: Record<string, string> = {}): Item =>
    ({
      id: "itm_1",
      title: "x",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      properties: props,
      versions: [{ id: "v", blobHash: "h", mimeType: mime, filename: "f", size: 1, createdAt: "", createdBy: { id: "a", name: "A" } }],
      currentVersionId: "v",
      createdAt: "",
      updatedAt: "",
    }) as unknown as Item;

  it("is a screen or a site — the two that cannot be photographed", () => {
    expect(isFramedItem(item("text/html"))).toBe(true);
    expect(isFramedItem(item("text/uri-list"))).toBe(true);
  });

  it("is not a picture or a document, which snapshot perfectly well", () => {
    // These still get the push: the flip is worth keeping wherever it works.
    expect(isFramedItem(item("image/png"))).toBe(false);
    expect(isFramedItem(item("text/markdown"))).toBe(false);
    expect(isFramedItem(item("application/pdf"))).toBe(false);
  });
});
