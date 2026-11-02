import { describe, expect, it } from "vitest";
import {
  FACE_PROP,
  activeFaceIdOf,
  availableFacesOf,
  faceLabel,
  hasDistinctVisualFace,
  isNamedFaceId,
  sourceFaceOf,
  visualFaceOf,
  warmFacesOf,
  type ItemVersion,
} from "../src/model.ts";
import { applyOperation, invertOperation, type Operation } from "../src/index.ts";
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

  it("supports named fidelity faces (wireframe, mid-fi, hi-fi, prototype) and in-place item.update faces", () => {
    expect(isNamedFaceId("wireframe")).toBe(true);
    expect(isNamedFaceId("hi-fi")).toBe(true);
    expect(isNamedFaceId("unknown")).toBe(false);
    expect(faceLabel("wireframe")).toBe("Wireframe");
    expect(faceLabel("hi-fi")).toBe("Hi-Fi");

    const s = seedState();
    const addOp: Operation = {
      type: "item.add",
      itemId: "itm_screen",
      width: 400,
      height: 800,
      placement: { x: 100, y: 100 },
      properties: { [FACE_PROP]: "wireframe" },
      version: {
        id: "ver_1",
        blobHash: "hash_wf",
        mimeType: "text/html",
        filename: "home.html",
        size: 120,
        faces: {
          wireframe: {
            blobHash: "hash_wf",
            mimeType: "text/html",
            filename: "home.html",
            size: 120,
          },
        },
      },
    };
    const s2 = applyOperation(s, envelope(addOp, bob))!;
    const item1 = s2.canvas.items["itm_screen"]!;
    expect(activeFaceIdOf(item1, item1.versions[0]!)).toBe("wireframe");
    expect(visualFaceOf(item1.versions[0]!, activeFaceIdOf(item1, item1.versions[0]!)).blobHash).toBe("hash_wf");

    // Pre-publish hi-fi face in-place on ver_1 via item.update without bumping version count or changing active face
    const updateFacesOp: Operation = {
      type: "item.update",
      itemId: "itm_screen",
      patch: {},
      faces: {
        "hi-fi": {
          blobHash: "hash_hifi",
          mimeType: "text/html",
          filename: "home.html",
          size: 240,
        },
      },
    };
    const inv = invertOperation(s2, updateFacesOp);
    const s3 = applyOperation(s2, envelope(updateFacesOp, bob))!;
    const item2 = s3.canvas.items["itm_screen"]!;
    expect(item2.versions.length).toBe(1);
    expect(availableFacesOf(item2.versions[0]!)).toEqual(["wireframe", "hi-fi", "source"]);
    // Still on wireframe until explicitly flipped
    expect(activeFaceIdOf(item2, item2.versions[0]!)).toBe("wireframe");
    expect(visualFaceOf(item2.versions[0]!, activeFaceIdOf(item2, item2.versions[0]!)).blobHash).toBe("hash_wf");
    expect(warmFacesOf(item2.versions[0]!, "hash_wf")).toEqual(["hash_hifi"]);

    // Flip active face to hi-fi
    const flipOp: Operation = {
      type: "item.update",
      itemId: "itm_screen",
      patch: { properties: { [FACE_PROP]: "hi-fi" } },
    };
    const s4 = applyOperation(s3, envelope(flipOp, bob))!;
    const item3 = s4.canvas.items["itm_screen"]!;
    expect(activeFaceIdOf(item3, item3.versions[0]!)).toBe("hi-fi");
    expect(visualFaceOf(item3.versions[0]!, activeFaceIdOf(item3, item3.versions[0]!)).blobHash).toBe("hash_hifi");

    // Undo face attachment removes hi-fi face cleanly
    expect(inv).not.toBeNull();
    const sUndone = applyOperation(s3, envelope(inv!, bob))!;
    expect(sUndone.canvas.items["itm_screen"]!.versions[0]!.faces?.["hi-fi"]).toBeUndefined();
  });
});
