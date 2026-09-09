import { afterEach, describe, expect, it } from "vitest";
import type { Item } from "@isocan/core";
import { itemKind, itemKinds, moduleKindOf, registerModule, unregisterModule } from "@isocan/core";
import {
  STICKER_KIND,
  STICKER_MIME,
  STICKERS,
  findSticker,
  isStickerItem,
  stickersModule,
  stickersOn,
} from "../src/core.ts";

function itemOf(mimeType: string, filename = "star.sticker", title = "⭐", id = "itm_1"): Item {
  return {
    id,
    x: 0,
    y: 0,
    width: 120,
    height: 120,
    title,
    description: "",
    properties: {},
    currentVersionId: "ver_1",
    versions: [{ id: "ver_1", blobHash: "hash1", mimeType, filename, size: 4 }],
    createdAt: "2026-09-09T10:00:00.000Z",
    updatedAt: "2026-09-09T10:00:00.000Z",
  } as unknown as Item;
}

afterEach(() => unregisterModule(stickersModule.name));

describe("stickers core", () => {
  it("is a sticker while the module is loaded, and a document when it is not", () => {
    expect(itemKind(itemOf(STICKER_MIME))).toBe("document");
    registerModule(stickersModule);
    expect(itemKind(itemOf(STICKER_MIME))).toBe("sticker");
    expect(moduleKindOf(STICKER_MIME)).toEqual(STICKER_KIND);
    unregisterModule(stickersModule.name);
    expect(itemKind(itemOf(STICKER_MIME))).toBe("document");
  });

  it("joins the kind list before Files (other)", () => {
    expect(itemKinds()).not.toContain("sticker");
    registerModule(stickersModule);
    const kinds = itemKinds();
    expect(kinds).toContain("sticker");
    expect(kinds.indexOf("sticker")).toBeLessThan(kinds.indexOf("other"));
  });

  it("defines exactly 5 emoji stickers", () => {
    expect(STICKERS).toHaveLength(5);
    expect(STICKERS.map((s) => s.emoji)).toEqual(["⭐", "❤️", "🔥", "👍", "🎉"]);
  });

  it("resolves stickers by emoji, id, normalized id, and name", () => {
    expect(findSticker("⭐")?.id).toBe("star");
    expect(findSticker("star")?.emoji).toBe("⭐");
    expect(findSticker("Star")?.emoji).toBe("⭐");
    expect(findSticker("🔥")?.id).toBe("fire");
    expect(findSticker("fire")?.emoji).toBe("🔥");
    expect(findSticker("thumbs-up")?.emoji).toBe("👍");
    expect(findSticker("thumbsup")?.emoji).toBe("👍");
    expect(findSticker("Thumbs Up")?.emoji).toBe("👍");
    expect(findSticker("🎉")?.id).toBe("party");
    expect(findSticker("unknown")).toBeUndefined();
  });

  it("identifies sticker items and lists them from canvas", () => {
    const s1 = itemOf(STICKER_MIME, "heart.sticker", "❤️", "s1");
    const doc = itemOf("text/markdown", "notes.md", "Notes", "doc");
    expect(isStickerItem(s1)).toBe(true);
    expect(isStickerItem(doc)).toBe(false);

    const canvas = {
      items: { [s1.id]: s1, [doc.id]: doc },
    } as any;
    expect(stickersOn(canvas)).toEqual([s1]);
  });
});
