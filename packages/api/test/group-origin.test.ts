import { afterEach, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Operation } from "@isocan/core";
import { fileBadgeStore } from "@isocan/server";
import { DaemonRoutes } from "../src/routes.ts";
import { CanvasHandle } from "../src/connect.ts";
import type { Ctx } from "../src/ctx.ts";
import { groupFixture } from "./group-fixture.ts";

const homes: string[] = [];
afterEach(async () => { vi.unstubAllGlobals(); vi.restoreAllMocks(); for (const home of homes.splice(0)) await rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

it("carries the observed mode, an explicitly older origin and the independent undo label through real request serialization", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "isocan-origin-")); homes.push(home);
  const f = groupFixture(false);
  const client = new DaemonRoutes("https://acme.invalid", fileBadgeStore(home, "https://acme.invalid"));
  const bodies: any[] = [];
  vi.stubGlobal("fetch", vi.fn<typeof fetch>(async (_url, opts) => {
    if (opts?.method === "GET") return Response.json(await f.client.snapshot());
    bodies.push(JSON.parse(String(opts?.body)));
    return Response.json({ seq: 1, envelope: { id: "op_test" } });
  }));
  await client.snapshot(f.state.project.id);
  await client.sendOp(f.state.project.id, f.actor, { type: "item.move", itemId: "a", x: 1, y: 2 }, undefined, undefined, "undo_label");
  expect(bodies[0]).toMatchObject({ group: "undo_label", originGroupMode: "legacy", op: { type: "item.move" } });
  await client.changeGroup(f.state.project.id, f.actor, { kind: "delete", itemIds: ["a"] }, "op_retry", "groups");
  expect(bodies[1]).toMatchObject({ opId: "op_retry", originGroupMode: "groups", op: { type: "group.change" } });
  await client.sendOp(null, f.actor, { type: "project.create", canvasId: "prj_new", title: "Acme ordinary birth" });
  expect(bodies[2]).toEqual({ canvasId: null, actor: f.actor, op: { type: "project.create", canvasId: "prj_new", title: "Acme ordinary birth" } });
  await client.sendOp(null, f.actor, { type: "project.create", canvasId: "prj_legacy", title: "Acme explicit legacy", groupMode: "legacy" });
  expect(bodies[3].op.groupMode).toBe("legacy");
});

it.each(["add", "edit"] as const)("keeps %s's legacy origin across a delayed upload and another caller's newer read", async (verb) => {
  const f = groupFixture(false); f.card("a");
  let release!: () => void;
  let started!: () => void;
  const startedUpload = new Promise<void>((resolve) => { started = resolve; });
  const pendingUpload = new Promise<void>((resolve) => { release = resolve; });
  const send = vi.fn(async (_canvas: string | null, _actor: unknown, _op: Operation, _client?: string, _home?: string, _group?: string, origin?: string) => {
    expect(origin).toBe("legacy");
    throw new Error("migration-boundary: originating legacy mode no longer matches");
  });
  const client = { ...f.client, sendOp: send, uploadBlob: async (...args: Parameters<typeof f.client.uploadBlob>) => { started(); await pendingUpload; return f.client.uploadBlob(...args); } };
  const handle = new CanvasHandle({ client, actor: f.actor } as unknown as Ctx, f.state.project);
  const pending = verb === "add" ? handle.add({ title: "Acme new", content: "Acme bytes", mime: "text/markdown", at: { x: 0, y: 0 } }) : handle.edit("a", { content: "Acme edit" });
  const refusal = expect(pending).rejects.toThrow("migration-boundary");
  await startedUpload;
  // A shared client can receive a newer read while this upload is held. The
  // original operation explicitly carries the snapshot mode, not a mutable cache.
  vi.spyOn(client, "snapshot").mockResolvedValue({ ...await f.client.snapshot(), project: { ...f.state.project, groupMode: "groups" } });
  await client.snapshot(); release();
  await refusal;
  expect(send).toHaveBeenCalledTimes(1); expect(f.writes).toHaveLength(0);
});

it("keeps the original mode through identity recovery and reports a cutover refusal without refreshing the intent", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "isocan-origin-retry-")); homes.push(home);
  const f = groupFixture(false);
  const client = new DaemonRoutes("https://acme.invalid", fileBadgeStore(home, "https://acme.invalid"));
  let mode: "legacy" | "groups" = "legacy";
  const posted: any[] = [];
  vi.stubGlobal("fetch", vi.fn<typeof fetch>(async (_url, opts) => {
    if (opts?.method === "GET") return Response.json({ ...await f.client.snapshot(), project: { ...f.state.project, groupMode: mode } });
    posted.push(JSON.parse(String(opts?.body)));
    return posted.length === 1 ? Response.json({ error: "claim first", code: "not-your-actor" }, { status: 403 }) : Response.json({ error: "This was prepared in legacy mode", code: "migration-boundary" }, { status: 409 });
  }));
  await client.snapshot(f.state.project.id);
  client.reclaimWith(async () => { mode = "groups"; await client.snapshot(f.state.project.id); });
  await expect(client.sendOp(f.state.project.id, f.actor, { type: "item.move", itemId: "a", x: 1, y: 2 })).rejects.toMatchObject({ status: 409, code: "migration-boundary" });
  expect(posted).toHaveLength(2);
  expect(posted[1]).toEqual(posted[0]);
  expect(posted.every((body) => body.originGroupMode === "legacy")).toBe(true);
});
