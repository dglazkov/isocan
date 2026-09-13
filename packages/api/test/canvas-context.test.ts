import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { contextContentPage, resolveContextOperation } from "@isocan/core";
import { CanvasHandle } from "../src/connect.ts";
import type { Ctx } from "../src/ctx.ts";
import { DaemonRoutes } from "../src/routes.ts";
import { readContextItem } from "../src/canvas-context.ts";
import { groupFixture } from "./group-fixture.ts";

const homes: string[] = [];
afterEach(async () => { vi.unstubAllGlobals(); vi.restoreAllMocks(); for (const home of homes.splice(0)) await rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });
async function contextFixture() {
  const f = groupFixture();
  const handle = new CanvasHandle({ client: f.client, actor: f.actor } as unknown as Ctx, f.state.project);
  const group = (await f.api.new("Acme scope", { note: "Acme brief" })).itemId!;
  const card = await handle.add({ title: "Acme source", content: "Original αβ text", mime: "text/markdown", in: group });
  const excluded = await handle.add({ title: "Acme excluded", content: "Private draft", mime: "text/markdown", in: group });
  await handle.set(excluded.id, { properties: { context: "excluded" } });
  return { f, handle, group, card, excluded };
}

describe("complete frozen group context through the public API", () => {
  it("keeps actual selected roots, deduplicates their closure and retains old versions after delete", async () => {
    const { f, handle, group, card, excluded } = await contextFixture();
    const before = f.writes.length;
    const preview = await handle.context({ rootIds: [group, card.id] });
    expect(preview.rootIds).toEqual([group, card.id]);
    expect(preview.expandedIds).toEqual([group, card.id, excluded.id]);
    expect(preview.counts).toEqual({ included: 2, excluded: 1, unavailable: 0 });
    expect(f.writes).toHaveLength(before);
    const posted = await handle.say("Review these", { rootIds: [group, card.id], expectedRevision: preview.revision });
    expect(f.writes).toHaveLength(before + 1);
    expect(posted.context).toEqual(preview);
    await handle.edit(card.id, { content: "Changed today" });
    await handle.remove(group);
    expect(f.state.canvas.items[card.id]).toBeUndefined();
    expect(await handle.contextOfComment(posted.threadId, posted.commentId)).toEqual(preview);
    expect(await handle.contextItem(posted.threadId, posted.commentId, card.id)).toMatchObject({ versionId: card.currentVersionId, data: "Original αβ text", bytesRead: 18, nextOffset: null });
    const blocked = await handle.contextItem(posted.threadId, posted.commentId, excluded.id);
    expect(blocked).toMatchObject({ status: "excluded", bytesRead: 0, nextOffset: null });
    expect(blocked.data).toBeUndefined();
  });

  it("auto-expands #group references and returns actual writer state; explicit stale previews refuse without append", async () => {
    const { f, handle, group, card } = await contextFixture();
    f.setBeforeWrite(() => f.apply({ type: "item.update", itemId: card.id, patch: { title: "Acme writer title" } }));
    const posted = await handle.notify(`Review #${group}`);
    expect(posted.context?.entries.find((entry) => entry.itemId === card.id)?.title).toBe("Acme writer title");
    const preview = await handle.context({ in: group, includeExcluded: true });
    expect(preview.counts.excluded).toBe(0);
    await handle.notify("Another message");
    const before = f.writes.length;
    await expect(handle.ask("Ready?", { in: group, expectedRevision: preview.revision })).rejects.toThrow(/changed|preview/i);
    expect(f.writes).toHaveLength(before);
    const saved = await handle.contextOfComment(posted.threadId, posted.commentId);
    const update = resolveContextOperation(f.state, before, { type: "comment.update", threadId: posted.threadId, commentId: posted.commentId, body: "New words" });
    f.apply(update);
    expect(await handle.contextOfComment(posted.threadId, posted.commentId)).toEqual(saved);
  });

  it("reads scopes without identity or presence and distinguishes direct from recursive membership", async () => {
    const { f, group, card, excluded } = await contextFixture();
    const nested = (await f.api.wrap([card.id], "Acme inner")).itemId!;
    const client = { ...f.client, listSessions: vi.fn(() => { throw new Error("reader did not ask for presence"); }) };
    const ctx = { client, get actor() { throw new Error("read must not demand identity"); } } as unknown as Ctx;
    const reader = new CanvasHandle(ctx, f.state.project);
    expect((await reader.items({ in: group })).map((item) => item.id)).toEqual([nested, excluded.id]);
    expect((await reader.items({ in: group, recursive: true })).map((item) => item.id)).toEqual([nested, card.id, excluded.id]);
    expect((await reader.context({ in: group })).entries).toHaveLength(4);
    expect(client.listSessions).not.toHaveBeenCalled();
  });
});

describe("saved version transport and bounded byte pages", () => {
  it.each([404, 403])("tells a missing 404 from an access refusal (%i)", async (status) => {
    const { handle, group, card } = await contextFixture();
    const manifest = (await handle.say("Review", { in: group })).context!;
    const page = contextContentPage(manifest, { offset: 1, limit: 1 });
    const home = await mkdtemp(path.join(os.tmpdir(), "isocan-context-transport-")); homes.push(home);
    const client = new DaemonRoutes("https://acme.invalid", home);
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(manifest)).mockResolvedValueOnce(Response.json(page)).mockResolvedValueOnce(Response.json({ error: "Acme access ended", code: "canvas-access-ended", reason: "revoked" }, { status }));
    vi.stubGlobal("fetch", fetcher);
    const read = readContextItem(client, manifest.canvasId, "thr_saved", "cmt_saved", card.id);
    if (status === 404) expect(await read).toMatchObject({ status: "unavailable", bytesRead: 0, reason: expect.stringContaining("no longer available") });
    else await expect(read).rejects.toMatchObject({ status: 403, code: "canvas-access-ended", reason: "revoked", message: "Acme access ended" });
    expect(fetcher.mock.calls.map(([url]) => String(url))).toEqual([
      "https://acme.invalid/api/projects/prj_acme/threads/thr_saved/comments/cmt_saved/context",
      "https://acme.invalid/api/projects/prj_acme/threads/thr_saved/comments/cmt_saved/context/content?offset=1&limit=1&face=source",
      `https://acme.invalid/api/projects/prj_acme/blobs/${card.versions[0]!.blobHash}`,
    ]);
    expect(fetcher.mock.calls.every(([, options]) => (options?.method ?? "GET") === "GET")).toBe(true);
  });

  it("pages split UTF-8 losslessly and never fetches excluded bytes", async () => {
    const { f, handle, group, card, excluded } = await contextFixture();
    const posted = await handle.comment(card.id, "Review", { in: group });
    const first = await handle.contextItem(posted.threadId, posted.commentId, card.id, { offset: 9, limit: 1 });
    expect(first).toMatchObject({ encoding: "base64", data: "zg==", bytesRead: 1, nextOffset: 10 });
    const download = vi.spyOn(f.client, "downloadBlob");
    expect(await handle.contextItem(posted.threadId, posted.commentId, excluded.id)).toMatchObject({ status: "excluded", bytesRead: 0 });
    expect(download).not.toHaveBeenCalled();
    await expect(handle.contextItem(posted.threadId, posted.commentId, card.id, { limit: 262145 })).rejects.toThrow(/262144/);
    expect(download).not.toHaveBeenCalled();
  });
});
