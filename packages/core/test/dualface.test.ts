import { describe, expect, it } from "vitest";
import {
  hasDistinctVisualFace,
  sourceFaceOf,
  visualFaceOf,
  type ItemVersion,
} from "../src/model.ts";
import { applyOperation, type Operation } from "../src/index.ts";
import { bob, envelope, seedState } from "./helpers.ts";

describe("dual faces of an artifact", () => {
  const actor = { id: "usr_a", name: "Alice" };

  it("returns the single face when visual is not defined", () => {
    const single: ItemVersion = {
      id: "ver_1",
      blobHash: "hash_src",
      mimeType: "text/markdown",
      filename: "notes.md",
      size: 100,
      createdAt: "",
      createdBy: actor,
    };

    expect(hasDistinctVisualFace(single)).toBe(false);
    expect(sourceFaceOf(single)).toEqual({
      blobHash: "hash_src",
      mimeType: "text/markdown",
      filename: "notes.md",
      size: 100,
    });
    expect(visualFaceOf(single)).toEqual({
      blobHash: "hash_src",
      mimeType: "text/markdown",
      filename: "notes.md",
      size: 100,
    });
  });

  it("returns distinct visual face when defined", () => {
    const dual: ItemVersion = {
      id: "ver_2",
      blobHash: "hash_src",
      mimeType: "text/markdown",
      filename: "design.md",
      size: 200,
      visual: {
        blobHash: "hash_vis",
        mimeType: "text/html",
        filename: "design-system.html",
        size: 500,
      },
      createdAt: "",
      createdBy: actor,
    };

    expect(hasDistinctVisualFace(dual)).toBe(true);
    expect(sourceFaceOf(dual)).toEqual({
      blobHash: "hash_src",
      mimeType: "text/markdown",
      filename: "design.md",
      size: 200,
    });
    expect(visualFaceOf(dual)).toEqual({
      blobHash: "hash_vis",
      mimeType: "text/html",
      filename: "design-system.html",
      size: 500,
    });
  });

  it("round-trips visual face through item.add and item.addVersion in the reducer", () => {
    const s = seedState();
    const addOp: Operation = {
      type: "item.add",
      itemId: "itm_dual",
      width: 400,
      height: 300,
      placement: { x: 50, y: 50 },
      version: {
        id: "ver_1",
        blobHash: "hash_md",
        mimeType: "text/markdown",
        filename: "design.md",
        size: 100,
        visual: {
          blobHash: "hash_html",
          mimeType: "text/html",
          filename: "design-system.html",
          size: 300,
        },
      },
    };

    const s2 = applyOperation(s, envelope(addOp, bob));
    expect(s2).not.toBeNull();
    const item = s2!.canvas.items["itm_dual"];
    expect(item).toBeDefined();
    expect(item?.versions[0]?.visual).toEqual({
      blobHash: "hash_html",
      mimeType: "text/html",
      filename: "design-system.html",
      size: 300,
    });

    const addVerOp: Operation = {
      type: "item.addVersion",
      itemId: "itm_dual",
      version: {
        id: "ver_2",
        blobHash: "hash_md_v2",
        mimeType: "text/markdown",
        filename: "design.md",
        size: 150,
        visual: {
          blobHash: "hash_html_v2",
          mimeType: "text/html",
          filename: "design-system.html",
          size: 350,
        },
      },
    };

    const s3 = applyOperation(s2, envelope(addVerOp, bob));
    expect(s3).not.toBeNull();
    const itemV2 = s3!.canvas.items["itm_dual"];
    expect(itemV2?.versions.length).toBe(2);
    expect(itemV2?.versions[1]?.visual?.blobHash).toBe("hash_html_v2");
    expect(visualFaceOf(itemV2!.versions[1]!).blobHash).toBe("hash_html_v2");
    expect(sourceFaceOf(itemV2!.versions[1]!).blobHash).toBe("hash_md_v2");
  });
});
