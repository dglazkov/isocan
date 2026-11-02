import { describe, expect, it } from "vitest";
import { makeTextAnchor, resolveTextAnchor, validateTextAnchor, invertOperation, itemThread } from "../src/index.ts";
import type { Operation } from "../src/index.ts";
import { apply, seedState } from "./helpers.ts";
const identity = { versionId: "ver_1", blobHash: "hash_ver_1", flavor: "document" as const };

describe("durable quotes", () => {
  it("uses Unicode points and preserves provenance when a passage moves", () => {
    const anchor = makeTextAnchor("🐏 Read this sentence.", identity, { start: 7, end: 20 });
    expect(anchor.quote).toBe("this sentence");
    expect(resolveTextAnchor(anchor, "Before. 🐏 Read this sentence. After.", { ...identity, blobHash: "new" })).toEqual({ status: "resolved", start: 15, end: 28 });
    expect(anchor.start).toBe(7);
    expect(resolveTextAnchor(anchor, "Removed", { ...identity, blobHash: "new" }).status).toBe("missing");
    expect(resolveTextAnchor(anchor, "this sentence this sentence", { ...identity, blobHash: "new" }).status).toBe("ambiguous");
    expect(resolveTextAnchor(anchor, "🐏 Read this sentence.", { ...identity, flavor: "plain" }).status).toBe("unavailable");
  });
  it("context disambiguates repeated quotes without trusting old offsets", () => {
    const anchor = makeTextAnchor("A target B", identity, { start: 2, end: 8 });
    expect(resolveTextAnchor(anchor, "target. A target B", { ...identity, blobHash: "new" })).toEqual({ status: "resolved", start: 10, end: 16 });
  });
  it("validates source and visual representations, not another item's version", () => {
    const item = seedState().canvas.items.itm_1!;
    const anchor = makeTextAnchor("hello", identity, { start: 0, end: 5 });
    expect(validateTextAnchor(anchor, item)).toEqual(anchor);
    expect(() => validateTextAnchor({ ...anchor, versionId: "ver_2" }, item)).toThrow();
    expect(() => validateTextAnchor({ ...anchor, end: 6 }, item)).toThrow();
    item.versions[0]!.visual = { blobHash: "visual", mimeType: "text/markdown" };
    expect(validateTextAnchor({ ...anchor, blobHash: "visual" }, item)?.blobHash).toBe("visual");
  });
  it("does not make a passage the default item conversation", () => {
    const state = seedState();
    state.canvas.threads.thr_1!.textAnchor = makeTextAnchor("hello", identity, { start: 0, end: 5 });
    expect(itemThread(state.canvas, "itm_1")).toBeNull();
  });
  it("creates, reanchors, undoes, deletes and restores through ordinary operations", () => {
    let state = seedState();
    const textAnchor = makeTextAnchor("hello", identity, { start: 0, end: 5 });
    state = apply(state, { type: "thread.create", threadId: "thr_quote", anchorItemId: "itm_1", x: 12, y: 12, textAnchor, comment: { id: "cmt_quote", body: "Clarify this" } })!;
    const move: Operation = { type: "thread.setAnchor", threadId: "thr_quote", anchorItemId: null, x: 100, y: 100 };
    const inverse = invertOperation(state, move)!;
    state = apply(state, move)!;
    expect(state.canvas.threads.thr_quote!.textAnchor).toBeUndefined();
    state = apply(state, inverse)!;
    expect(state.canvas.threads.thr_quote!.textAnchor).toEqual(textAnchor);
    expect(itemThread(state.canvas, "itm_1")?.id).toBe("thr_1");
    const remove: Operation = { type: "thread.delete", threadId: "thr_quote" };
    const restore = invertOperation(state, remove)!;
    state = apply(apply(state, remove), restore)!;
    expect(state.canvas.threads.thr_quote!.textAnchor).toEqual(textAnchor);
  });
});
