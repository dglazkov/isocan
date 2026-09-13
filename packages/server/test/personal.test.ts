import { afterEach, expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { SOURCE_POLICY_HEADER, sourcePolicyHeader, type Actor, type Operation, type PersonalEnsureResponse, type PersonalLinkResponse } from "@isocan/core";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

const person: Actor = { id: "usr_personal_maya", name: "Maya" };
const other: Actor = { id: "usr_personal_theo", name: "Theo" };
const agent: Actor = { id: "usr_personal_rowan", name: "Rowan" };
const nodes: Array<{ daemon: Daemon; dir: string }> = [];
async function node(birthHome: string | null = null) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-personal-"));
  const daemon = await startDaemon({ port: 0, home: dir, birthHome, homePollMs: 50, servesWorld: true });
  nodes.push({ daemon, dir });
  return { daemon, dir, base: `http://127.0.0.1:${(daemon.app.server.address() as { port: number }).port}` };
}
afterEach(async () => {
  vi.restoreAllMocks();
  for (const node of nodes.reverse()) await node.daemon.close().catch(() => {});
  await Promise.all(nodes.splice(0).map((node) => fs.rm(node.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })));
});
async function request(home: Awaited<ReturnType<typeof node>>, badge: TestBadge, method: string, route: string, body?: unknown, policy?: { mode: "exclude" } | { mode: "direct"; actorId: string; intent: "read" | "edit" | "own" }) {
  return fetch(home.base + route, { method, headers: { ...badge.headers, ...(policy ? { [SOURCE_POLICY_HEADER]: sourcePolicyHeader({ policy, expectedHome: home.base }) } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
async function json<T>(response: Response): Promise<T> {
  expect(response.status, await response.clone().text()).toBe(200);
  return response.json() as Promise<T>;
}
async function op(home: Awaited<ReturnType<typeof node>>, badge: TestBadge, canvasId: string | null, operation: Operation, actor = person) {
  return json(await request(home, badge, "POST", "/api/ops", { actor, canvasId, op: operation }));
}
async function fixture() {
  const home = await node(); const badge = await mintTestBadge(home.base);
  await badge.speakAs(person, "home:maya"); await badge.speakAs(other, "home:theo");
  await json(await request(home, badge, "POST", "/api/ops", { canvasId: null, op: { type: "actor.claim", sessionKey: "agent:rowan", as: agent.id, name: agent.name, harness: "test" } }));
  await op(home, badge, null, { type: "project.create", canvasId: "prj_destination", title: "Acme project" });
  return { home, badge };
}
async function ensure(home: Awaited<ReturnType<typeof node>>, badge: TestBadge) {
  return json<PersonalEnsureResponse>(await request(home, badge, "POST", "/api/personal/ensure", { actorId: person.id }));
}
async function link(home: Awaited<ReturnType<typeof node>>, badge: TestBadge, requestId = "gesture-one") {
  return json<PersonalLinkResponse>(await request(home, badge, "POST", "/api/projects/prj_destination/personal/link", { actorId: person.id, requestId }));
}

it("reserves one private source under concurrent explicit birth, with no link, space or Public row", async () => {
  const { home, badge } = await fixture();
  expect(await json(await request(home, badge, "GET", `/api/personal?actorId=${person.id}`))).toMatchObject({ source: null });
  const results = await Promise.all(Array.from({ length: 8 }, () => ensure(home, badge)));
  const id = results[0]!.source!.canvasId;
  expect(new Set(results.map((row) => row.source!.canvasId)).size).toBe(1);
  expect(results.filter((row) => row.created)).toHaveLength(1);
  expect(await home.daemon.desk.grantsFor(id)).toEqual([]);
  expect(await home.daemon.desk.spaceOf(id)).toBeNull();
  expect(await json(await request(home, badge, "GET", "/api/public"))).toEqual({ canvases: [] });
  expect((await home.daemon.engine.getLog(id)).filter((row) => row.envelope.op.type === "project.create")).toHaveLength(1);
  expect((await request(home, badge, "POST", "/api/personal/ensure", { actorId: agent.id })).status).toBe(403);
  expect((await request(home, badge, "POST", "/api/personal/ensure", {})).status).toBe(403);
});

it("links in one operation, reads owner/delegate bytes, and refuses before source reads", async () => {
  const { home, badge } = await fixture(); const source = (await ensure(home, badge)).source!.canvasId;
  const blob = await home.daemon.engine.putBlob(source, Buffer.from("PRIVATE_SYNTHETIC_PHONE_390"), { mimeType: "text/plain", filename: "preference.txt" });
  await op(home, badge, source, { type: "item.add", itemId: "itm_preference", title: "Phone preference", width: 400, height: 200, placement: { x: 0, y: 0 }, properties: { context: "pinned" }, version: { ...blob, id: "ver_preference", filename: "preference.txt" } });
  const before = (await home.daemon.engine.getLog("prj_destination")).length;
  const linked = await link(home, badge);
  expect((await home.daemon.engine.getLog("prj_destination")).length).toBe(before + 1);
  const read = (actorId: string, mode = "content") => request(home, badge, "POST", "/api/projects/prj_destination/personal/read", { actorId, itemId: linked.link.itemId, mode });
  const snapshot = vi.spyOn(home.daemon.engine, "getSnapshot"); const bytes = vi.spyOn(home.daemon.store, "openBlob");
  expect((await read(other.id)).status).toBe(403); expect((await read(agent.id)).status).toBe(403);
  expect(snapshot.mock.calls.filter(([id]) => id === source)).toEqual([]); expect(bytes).not.toHaveBeenCalled();
  await json(await request(home, badge, "PUT", `/api/personal/sources/${source}/delegates/${agent.id}`, { actorId: person.id, allowed: true }));
  const summary = await json(await read(agent.id, "summary")); expect(JSON.stringify(summary)).not.toContain("PRIVATE_SYNTHETIC"); expect(bytes).not.toHaveBeenCalled();
  expect(JSON.stringify(await json(await read(person.id)))).toContain("PRIVATE_SYNTHETIC_PHONE_390");
  expect(JSON.stringify(await json(await read(agent.id)))).toContain("PRIVATE_SYNTHETIC_PHONE_390");
  bytes.mockClear(); snapshot.mockClear();
  await json(await request(home, badge, "PUT", `/api/personal/sources/${source}/delegates/${agent.id}`, { actorId: person.id, allowed: false }));
  expect((await read(agent.id)).status).toBe(403); expect(snapshot.mock.calls.filter(([id]) => id === source)).toEqual([]); expect(bytes).not.toHaveBeenCalled();
  const shared = JSON.stringify({ snapshot: await home.daemon.engine.getSnapshot("prj_destination"), log: await home.daemon.engine.getLog("prj_destination") });
  expect(shared).not.toContain("PRIVATE_SYNTHETIC"); expect(shared).not.toContain(blob.blobHash); expect(shared).not.toContain("ver_preference");
});

it("unlink and undo restore only the concrete consent; a new gesture relinks after undo", async () => {
  const { home, badge } = await fixture(); const linked = await link(home, badge);
  await json(await request(home, badge, "POST", "/api/projects/prj_destination/personal/unlink", { actorId: person.id, requestId: "unlink-one", itemId: linked.link.itemId }));
  const read = () => request(home, badge, "POST", "/api/projects/prj_destination/personal/read", { actorId: person.id, itemId: linked.link.itemId, mode: "summary" });
  expect((await read()).status).toBe(403);
  await json(await request(home, badge, "POST", "/api/projects/prj_destination/undo", { actor: person }));
  expect((await read()).status).toBe(200);
  await json(await request(home, badge, "POST", "/api/projects/prj_destination/undo", { actor: person }));
  expect((await read()).status).toBe(403);
  expect((await request(home, badge, "POST", "/api/projects/prj_destination/personal/link", { actorId: person.id, requestId: "gesture-one" })).status).toBe(403);
  expect((await link(home, badge, "gesture-two")).link.itemId).not.toBe(linked.link.itemId);
});

it("ambient source reads and stored-own borrowing are refused before source snapshots", async () => {
  const { home, badge } = await fixture(); const source = (await ensure(home, badge)).source!.canvasId;
  await json(await request(home, badge, "GET", `/api/projects/${source}/canvas`));
  const snapshot = vi.spyOn(home.daemon.engine, "getSnapshot");
  for (const policy of [{ mode: "exclude" } as const, { mode: "direct", actorId: other.id, intent: "read" } as const]) {
    expect((await request(home, badge, "GET", `/api/projects/${source}/canvas`, undefined, policy)).status).toBe(403);
  }
  expect(snapshot.mock.calls.filter(([id]) => id === source)).toEqual([]);
  await home.daemon.desk.putGrant({ id: "gnt_source_read", canvasId: source, subject: "link", capability: "read", grantedBy: badge.badgeId, at: new Date().toISOString() });
  expect((await request(home, badge, "GET", `/api/projects/${source}/canvas`, undefined, { mode: "direct", actorId: other.id, intent: "read" })).status).toBe(200);
  snapshot.mockClear(); const tip = await home.daemon.store.tipSeq(source);
  const refused = await request(home, badge, "POST", "/api/ops", { canvasId: source, actor: other, op: { type: "project.update", patch: { title: "Borrowed owner" } } }, { mode: "direct", actorId: other.id, intent: "read" });
  expect(refused.status).toBe(403); expect(await refused.json()).toMatchObject({ code: "personal-intent-exceeded" });
  expect(snapshot.mock.calls.filter(([id]) => id === source)).toEqual([]); expect(await home.daemon.store.tipSeq(source)).toBe(tip);
  expect(await json(await request(home, badge, "GET", `/api/source-classification?canvasId=${source}&expectedHome=${encodeURIComponent(home.base)}`))).toEqual({ kind: "personal" });
  expect(JSON.stringify(await json(await request(home, badge, "GET", "/api/projects", undefined, { mode: "exclude" })))).not.toContain(source);
});

it("recovers durable seq1 without metadata, then keeps the same deleted binding", async () => {
  const { home, badge } = await fixture();
  const save = vi.spyOn(home.daemon.store, "saveSnapshot").mockRejectedValueOnce(new Error("synthetic crash after seq1"));
  expect((await request(home, badge, "POST", "/api/personal/ensure", { actorId: person.id })).status).toBe(500);
  save.mockRestore();
  const reserved = await home.daemon.desk.personalBinding([person.id]);
  const id = reserved!.source.canvasId;
  expect(await home.daemon.store.canvasLifecycle(id)).toBe("incomplete");
  await home.daemon.close();
  home.daemon = await startDaemon({ port: 0, home: home.dir, servesWorld: true });
  nodes.find((row) => row.dir === home.dir)!.daemon = home.daemon;
  home.base = `http://127.0.0.1:${(home.daemon.app.server.address() as { port: number }).port}`;
  const recovered = await ensure(home, badge);
  expect(recovered.source).toEqual({ canvasId: id, state: "live" });
  expect((await home.daemon.engine.getLog(id))).toHaveLength(1);
  expect((await home.daemon.desk.badge(badge.badgeId))!.admissions.some((row) => row.canvasId === id)).toBe(true);
  expect(await home.daemon.desk.grantsFor(id)).toEqual([]);
  await op(home, badge, id, { type: "project.delete" });
  expect((await ensure(home, badge)).source).toEqual({ canvasId: id, state: "deleted" });
});

it("keeps reserved alias ownership through a join before first birth and later repair", async () => {
  const { home, badge } = await fixture();
  await home.daemon.desk.reservePersonal({ ownerId: person.id, aliases: [], canvasId: "prj_reserved_alias", birthOpId: "op_reserved_alias", at: new Date().toISOString() });
  await op(home, badge, null, { type: "actor.join", from: person.id, into: other.id }, other);
  const save = vi.spyOn(home.daemon.store, "saveSnapshot").mockRejectedValueOnce(new Error("synthetic interrupted alias birth"));
  expect((await request(home, badge, "POST", "/api/personal/ensure", { actorId: other.id })).status).toBe(500); save.mockRestore();
  const result = await json<PersonalEnsureResponse>(await request(home, badge, "POST", "/api/personal/ensure", { actorId: other.id }));
  expect(result.source).toEqual({ canvasId: "prj_reserved_alias", state: "live" });
  expect((await home.daemon.engine.getLog("prj_reserved_alias"))).toHaveLength(1);
  expect((await home.daemon.desk.personalSource("prj_reserved_alias"))!.ownerId).toBe(person.id);
});

it("an emptied trash and a mutable agent harness cannot resurrect consent or prevent revoke", async () => {
  const { home, badge } = await fixture(); const linked = await link(home, badge);
  const source = linked.link.sourceCanvasId;
  await json(await request(home, badge, "PUT", `/api/personal/sources/${source}/delegates/${agent.id}`, { actorId: person.id, allowed: true }));
  await json(await request(home, badge, "POST", "/api/ops", { canvasId: null, op: { type: "actor.claim", sessionKey: "agent:rowan", as: agent.id, name: agent.name, harness: "home" } }));
  expect((await request(home, badge, "PUT", `/api/personal/sources/${source}/delegates/${agent.id}`, { actorId: person.id, allowed: false })).status).toBe(200);
  await json(await request(home, badge, "POST", "/api/projects/prj_destination/undo", { actor: person }));
  await op(home, badge, "prj_destination", { type: "trash.empty" });
  await home.daemon.engine.gc("prj_destination", { keepOps: 0 });
  expect((await home.daemon.engine.getArchivedLog("prj_destination")).some((row) => row.envelope.id === linked.receipt!.envelope.id)).toBe(true);
  const retry = await request(home, badge, "POST", "/api/projects/prj_destination/personal/link", { actorId: person.id, requestId: "gesture-one" });
  expect(retry.status).toBe(403); expect(await retry.json()).toMatchObject({ code: "personal-link-undone" });
  expect((await home.daemon.engine.getSnapshot("prj_destination")).canvas.items[linked.link.itemId]).toBeUndefined();
});

it("dedicated reads never borrow another same-badge actor from their request body", async () => {
  const { home, badge } = await fixture(); const linked = await link(home, badge);
  const snapshots = vi.spyOn(home.daemon.engine, "getSnapshot");
  for (const policy of [{ mode: "exclude" } as const, { mode: "direct", actorId: other.id, intent: "read" } as const]) {
    const result = await request(home, badge, "POST", "/api/projects/prj_destination/personal/read", { actorId: person.id, itemId: linked.link.itemId, mode: "content" }, policy);
    expect(result.status).toBe(403);
  }
  expect(snapshots.mock.calls.filter(([id]) => id === linked.link.sourceCanvasId)).toEqual([]);
});

it("rechecks a current source grant when a queued write starts", async () => {
  const { home, badge } = await fixture(); const source = (await ensure(home, badge)).source!.canvasId;
  const grant = { id: "gnt_queued_edit", canvasId: source, subject: "link" as const, capability: "edit" as const, grantedBy: badge.badgeId, at: new Date().toISOString() };
  await home.daemon.desk.putGrant(grant);
  let release!: () => void; let entered!: () => void;
  const ready = new Promise<void>((resolve) => { entered = resolve; });
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const held = home.daemon.engine.personalWrite(async () => { entered(); await gate; }); await ready;
  const submitted = vi.spyOn(home.daemon.engine, "submit");
  const tip = await home.daemon.store.tipSeq(source);
  const pending = request(home, badge, "POST", "/api/ops", { canvasId: source, actor: other, op: { type: "project.update", patch: { title: "Should not land" } } }, { mode: "direct", actorId: other.id, intent: "edit" });
  await expect.poll(() => submitted.mock.calls.length).toBe(1);
  await home.daemon.desk.revokeGrant(grant.id, new Date().toISOString(), badge.badgeId);
  release(); await held;
  const refused = await pending; expect(refused.status).toBe(403); expect(await refused.json()).toMatchObject({ code: "personal-refused" });
  expect(await home.daemon.store.tipSeq(source)).toBe(tip);
});

it("forwards destination birth and private reads to the authority, without a replica birth link", async () => {
  const { home, badge } = await fixture(); const local = await node(); const localBadge = await mintTestBadge(local.base);
  await localBadge.speakAs(person, "home:maya");
  const pass = await json<{ token: string }>(await request(home, badge, "POST", "/api/projects/prj_destination/passes", { actorId: person.id }));
  await json(await request(local, localBadge, "POST", "/api/passes/redeem", { home: home.base, token: pass.token }));
  await expect.poll(async () => (await local.daemon.engine.listCanvases()).some((canvas) => canvas.id === "prj_destination")).toBe(true);
  const answer = await json<PersonalEnsureResponse>(await request(local, localBadge, "POST", "/api/personal/ensure", { actorId: person.id, destinationCanvasId: "prj_destination" }));
  const source = answer.source!.canvasId;
  expect(answer.home).toBe(home.base); expect(await local.daemon.desk.personalBinding([person.id])).toBeNull();
  expect(await local.daemon.desk.personalReplica(source)).toBe(home.base);
  expect(await home.daemon.desk.grantsFor(source)).toEqual([]);
  await expect.poll(async () => local.daemon.store.canvasExists(source)).toBe(true);
  expect(await local.daemon.desk.grantsFor(source)).toEqual([]);
  const linked = await link(local, localBadge);
  expect(linked.link.home).toBe(home.base);
  const metadata = await json(await request(local, localBadge, "POST", "/api/projects/prj_destination/personal/read", { actorId: person.id, itemId: linked.link.itemId, mode: "summary" }));
  expect(metadata).toMatchObject({ home: home.base, sourceCanvasId: source });
  const snapshot = vi.spyOn(local.daemon.engine, "getSnapshot"); const log = vi.spyOn(local.daemon.engine, "getLog");
  const policy = { mode: "direct" as const, actorId: person.id, intent: "read" as const };
  const scoped = { ...localBadge.headers, [SOURCE_POLICY_HEADER]: sourcePolicyHeader({ policy, expectedHome: home.base }), "Content-Type": "application/json" };
  const current = await fetch(`${local.base}/api/projects/${source}/canvas`, { headers: scoped });
  expect(current.status, await current.clone().text()).toBe(200);
  const watch = await fetch(`${local.base}/api/oplog/watch`, { method: "POST", headers: scoped, body: JSON.stringify({ only: [source], cursors: { [source]: 0 }, holdMs: 0 }) });
  expect(watch.status, await watch.clone().text()).toBe(200);
  expect(snapshot.mock.calls.filter(([id]) => id === source)).toEqual([]); expect(log.mock.calls.filter(([id]) => id === source)).toEqual([]);
});

it("flat space membership enforces source intent and actor identity before reading a personal source", async () => {
  const { home, badge } = await fixture(); const source = (await ensure(home, badge)).source!.canvasId;
  const space = { id: "spc_personal_boundary", name: "Acme", createdBy: person.id, canvasIds: [] as string[], at: new Date().toISOString() };
  await home.daemon.desk.putSpace(space);
  const snapshots = vi.spyOn(home.daemon.engine, "getSnapshot");
  for (const policy of [{ mode: "exclude" } as const, { mode: "direct", actorId: person.id, intent: "read" } as const]) {
    const result = await request(home, badge, "PUT", `/api/spaces/${space.id}/canvases/${source}`, { actorId: person.id }, policy);
    expect(result.status, await result.clone().text()).toBe(403);
    expect(await result.json()).toMatchObject({ code: policy.mode === "exclude" ? "personal-source-excluded" : "personal-intent-exceeded" });
  }
  expect(snapshots.mock.calls.filter(([id]) => id === source)).toEqual([]);
  expect(await home.daemon.desk.spaceOf(source)).toBeNull();
  await home.daemon.desk.putSpace({ ...space, canvasIds: [source] });
  const mismatch = await request(home, badge, "DELETE", `/api/spaces/${space.id}/canvases/${source}?actorId=${other.id}`, undefined, { mode: "direct", actorId: person.id, intent: "own" });
  expect(mismatch.status, await mismatch.clone().text()).toBe(403);
  expect(await home.daemon.desk.spaceOf(source)).toMatchObject({ id: space.id });
});

it("generic creation cannot replace a reserved, deleted, or purged private birth", async () => {
  const { home, badge } = await fixture(); const id = "prj_private_reserved";
  await home.daemon.desk.reservePersonal({ ownerId: person.id, aliases: [], canvasId: id, birthOpId: "op_private_reserved", at: new Date().toISOString() });
  const create = (policy?: { mode: "exclude" }) => request(home, badge, "POST", "/api/ops", { canvasId: null, actor: person, opId: "op_intruder", op: { type: "project.create", canvasId: id, title: "Ordinary replacement" } }, policy);
  const excluded = await create({ mode: "exclude" });
  expect(excluded.status, await excluded.clone().text()).toBe(403); expect(await excluded.json()).toMatchObject({ code: "personal-source-excluded" });
  const reserved = await create(); expect(reserved.status, await reserved.clone().text()).toBe(403); expect(await reserved.json()).toMatchObject({ code: "personal-birth-reserved" });
  expect(await home.daemon.store.canvasLifecycle(id)).toBe("absent");
  expect((await ensure(home, badge)).source).toEqual({ canvasId: id, state: "live" });
  const original = await home.daemon.engine.getLog(id);
  expect(original[0]!.envelope.id).toBe("op_private_reserved");
  await op(home, badge, id, { type: "project.delete" });
  expect((await create()).status).toBe(403); expect(await home.daemon.store.canvasLifecycle(id)).toBe("deleted");
  const second = await json<PersonalEnsureResponse>(await request(home, badge, "POST", "/api/personal/ensure", { actorId: other.id }));
  const purged = second.source!.canvasId;
  await home.daemon.store.setTakenDown(purged, new Date().toISOString());
  await home.daemon.store.purgeCanvas(purged); home.daemon.engine.drop(purged);
  const recreated = await request(home, badge, "POST", "/api/ops", { canvasId: null, actor: other, op: { type: "project.create", canvasId: purged, title: "Replacement" } });
  expect(recreated.status).toBe(403); expect(await home.daemon.store.canvasLifecycle(purged)).toBe("purged");
  expect((await request(home, badge, "POST", `/api/projects/${purged}/adopt`, { entries: original })).status).toBe(403);
  expect(await home.daemon.store.canvasLifecycle(purged)).toBe("purged");
});

it("personal teleport refuses before reading source history or creating target data", async () => {
  const { home, badge } = await fixture(); const target = await node(); const source = (await ensure(home, badge)).source!.canvasId;
  const tip = await home.daemon.store.tipSeq(source);
  const logs = vi.spyOn(home.daemon.store, "readArchivedLog"); const blobs = vi.spyOn(home.daemon.store, "listBlobs");
  for (const dryRun of [true, false]) {
    const result = await request(home, badge, "POST", `/api/projects/${source}/teleport`, { to: target.base, dryRun });
    expect(result.status, await result.clone().text()).toBe(403); expect(await result.json()).toMatchObject({ code: "personal-transfer-refused" });
  }
  expect(logs).not.toHaveBeenCalled(); expect(blobs).not.toHaveBeenCalled();
  expect(await home.daemon.store.tipSeq(source)).toBe(tip); expect(await target.daemon.store.canvasLifecycle(source)).toBe("absent");
  expect(await home.daemon.desk.personalSource(source)).not.toBeNull();
});

it("aggregate maintenance excludes personal sources while keeping ordinary canvases available", async () => {
  const { home, badge } = await fixture(); const source = (await ensure(home, badge)).source!.canvasId;
  const before = await home.daemon.store.tipSeq(source); const gc = vi.spyOn(home.daemon.engine, "gc");
  const report = await json<{ canvases: Array<{ canvasId: string }> }>(await request(home, badge, "POST", "/api/gc", { dryRun: true }, { mode: "exclude" }));
  expect(report.canvases.map((row) => row.canvasId)).toEqual(["prj_destination"]);
  expect(gc.mock.calls.map(([id]) => id)).toEqual(["prj_destination"]); expect(await home.daemon.store.tipSeq(source)).toBe(before);
});

it.each(["gc", "reconcileBlobs", "groupMigrationPreview"] as const)("rechecks a revoked grant before queued %s reads source data", async (method) => {
  const { home, badge } = await fixture(); const source = (await ensure(home, badge)).source!.canvasId;
  const grant = { id: "gnt_maintenance", canvasId: source, subject: "link" as const, capability: "edit" as const, grantedBy: badge.badgeId, at: new Date().toISOString() };
  await home.daemon.desk.putGrant(grant);
  let release!: () => void; let entered!: () => void;
  const ready = new Promise<void>((resolve) => { entered = resolve; }); const gate = new Promise<void>((resolve) => { release = resolve; });
  const held = home.daemon.engine.personalWrite(async () => { entered(); await gate; }); await ready;
  const queued = vi.spyOn(home.daemon.engine, method); const listing = vi.spyOn(home.daemon.store, "listBlobs");
  const pending = request(home, badge, method === "groupMigrationPreview" ? "GET" : "POST", `/api/projects/${source}/${method === "gc" ? "gc" : method === "reconcileBlobs" ? "blobs/reconcile" : "groups/migration"}`, method === "groupMigrationPreview" ? undefined : { dryRun: true, push: true }, { mode: "direct", actorId: other.id, intent: "edit" });
  try { await expect.poll(() => queued.mock.calls.length).toBe(1); await home.daemon.desk.revokeGrant(grant.id, new Date().toISOString(), badge.badgeId); }
  finally { release(); await held; }
  const result = await pending; expect(result.status, await result.clone().text()).toBe(403); expect(listing).not.toHaveBeenCalled();
});

it("park setup and long-poll continuation recheck personal read policy", async () => {
  const { home, badge } = await fixture(); const source = (await ensure(home, badge)).source!.canvasId;
  const snapshot = vi.spyOn(home.daemon.engine, "getSnapshot");
  const excluded = await request(home, badge, "POST", "/api/park/claim", { canvasId: source, actorId: person.id }, { mode: "exclude" });
  expect(excluded.status, await excluded.clone().text()).toBe(403); expect(snapshot.mock.calls.filter(([id]) => id === source)).toEqual([]);
  const grant = { id: "gnt_long_poll", canvasId: source, subject: "link" as const, capability: "read" as const, grantedBy: badge.badgeId, at: new Date().toISOString() };
  await home.daemon.desk.putGrant(grant);
  const tip = await home.daemon.store.tipSeq(source); const log = vi.spyOn(home.daemon.engine, "getLog");
  const pending = request(home, badge, "GET", `/api/projects/${source}/oplog?since=${tip}&waitMs=300`, undefined, { mode: "direct", actorId: other.id, intent: "read" });
  await expect.poll(() => log.mock.calls.filter(([id]) => id === source).length).toBe(1);
  await home.daemon.desk.revokeGrant(grant.id, new Date().toISOString(), badge.badgeId);
  const result = await pending; expect(result.status, await result.clone().text()).toBe(403);
  expect(log.mock.calls.filter(([id]) => id === source)).toHaveLength(1);
});

it("two-home raw reads and watch fetches recheck current grants without reading retained private bytes", async () => {
  const { home, badge } = await fixture(); const local = await node(); const localBadge = await mintTestBadge(local.base);
  await localBadge.speakAs(person, "home:maya"); await localBadge.speakAs(other, "home:theo");
  const pass = await json<{ token: string }>(await request(home, badge, "POST", "/api/projects/prj_destination/passes", { actorId: person.id }));
  await json(await request(local, localBadge, "POST", "/api/passes/redeem", { home: home.base, token: pass.token }));
  const otherPass = await json<{ token: string }>(await request(home, badge, "POST", "/api/projects/prj_destination/passes", { actorId: other.id }));
  await json(await request(local, localBadge, "POST", "/api/passes/redeem", { home: home.base, token: otherPass.token }));
  await expect.poll(async () => (await local.daemon.engine.listCanvases()).some((canvas) => canvas.id === "prj_destination")).toBe(true);
  const source = (await json<PersonalEnsureResponse>(await request(local, localBadge, "POST", "/api/personal/ensure", { actorId: person.id, destinationCanvasId: "prj_destination" }))).source!.canvasId;
  await expect.poll(() => local.daemon.store.canvasExists(source)).toBe(true);
  const blob = await home.daemon.engine.putBlob(source, Buffer.from("PRIVATE_RAW_AUTHORITY"), { mimeType: "text/plain", filename: "preference.txt" });
  const grant = { id: "gnt_raw_read", canvasId: source, subject: "link" as const, capability: "read" as const, grantedBy: badge.badgeId, at: new Date().toISOString() };
  await home.daemon.desk.putGrant(grant);
  const headers = { ...localBadge.headers, [SOURCE_POLICY_HEADER]: sourcePolicyHeader({ policy: { mode: "direct", actorId: other.id, intent: "read" }, expectedHome: home.base }) };
  const localBytes = vi.spyOn(local.daemon.store, "openBlob"); const homeBytes = vi.spyOn(home.daemon.store, "openBlob");
  const download = await fetch(`${local.base}/api/projects/${source}/blobs/${blob.blobHash}`, { headers });
  expect(download.headers.get("Cache-Control")).toBe("no-store");
  expect(download.headers.get("X-Content-Type-Options")).toBe("nosniff");
  expect(download.headers.get("Content-Security-Policy")).toBe("sandbox allow-scripts");
  expect(download.status, await download.clone().text()).toBe(200); expect(await download.text()).toBe("PRIVATE_RAW_AUTHORITY");
  expect(localBytes).not.toHaveBeenCalled(); expect(homeBytes.mock.calls.some(([id]) => id === source)).toBe(true);
  const direct = await request(home, badge, "GET", `/api/projects/${source}/blobs/${blob.blobHash}`, undefined, { mode: "direct", actorId: person.id, intent: "read" });
  expect(direct.status).toBe(200); expect(direct.headers.get("Cache-Control")).toBe("no-store"); await direct.arrayBuffer();
  homeBytes.mockClear();
  const upload = await fetch(`${local.base}/api/projects/${source}/blobs`, { method: "POST", headers: { ...headers, "Content-Type": "text/plain", "X-Isocan-Filename": "forbidden.txt" }, body: "FORBIDDEN_RAW_WRITE" });
  expect(upload.status).toBe(403); expect(await upload.json()).toMatchObject({ code: "personal-intent-exceeded" });
  const connection = local.daemon.homes.for(source)!;
  const actual = connection.personalRequest.bind(connection);
  let entered!: () => void; let release!: () => void;
  const ready = new Promise<void>((resolve) => { entered = resolve; }); const gate = new Promise<void>((resolve) => { release = resolve; });
  const intercepted = vi.spyOn(connection, "personalRequest").mockImplementation(async (...args) => {
    if (args[1] === "/api/oplog/watch") { entered(); await gate; }
    return actual(...args);
  });
  const homeLog = vi.spyOn(home.daemon.engine, "getLog"); const localLog = vi.spyOn(local.daemon.engine, "getLog");
  const pending = fetch(`${local.base}/api/oplog/watch`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ only: [source], cursors: { [source]: 0 }, waitMs: 0 }) });
  try { await ready; await home.daemon.desk.revokeGrant(grant.id, new Date().toISOString(), badge.badgeId); }
  finally { release(); }
  const result = await pending; expect(result.status, await result.clone().text()).toBe(403);
  expect(homeLog.mock.calls.filter(([id]) => id === source)).toEqual([]); expect(localLog.mock.calls.filter(([id]) => id === source)).toEqual([]);
  expect(homeBytes).not.toHaveBeenCalled(); expect(localBytes).not.toHaveBeenCalled(); intercepted.mockRestore();
  // The real HTTP stream stays open at the authority. Aborting the local
  // request must cancel the forwarded fetch and destroy that source stream.
  const stalled = new PassThrough(); stalled.write("P");
  homeBytes.mockResolvedValueOnce(stalled);
  const forwarded = vi.spyOn(connection, "sourceRequest");
  const controller = new AbortController();
  const ownerHeaders = { ...localBadge.headers, [SOURCE_POLICY_HEADER]: sourcePolicyHeader({ policy: { mode: "direct", actorId: person.id, intent: "read" }, expectedHome: home.base }) };
  const canceled = fetch(`${local.base}/api/projects/${source}/blobs/${blob.blobHash}`, { headers: ownerHeaders, signal: controller.signal }).then((response) => response.arrayBuffer()).then(() => false, () => true);
  try {
    await expect.poll(() => homeBytes.mock.calls.length).toBe(1);
    controller.abort(); expect(await canceled).toBe(true);
    await expect.poll(() => forwarded.mock.calls[0]?.[5].signal?.aborted).toBe(true);
    await expect.poll(() => stalled.destroyed).toBe(true);
  } finally { controller.abort(); stalled.destroy(); }
});

it("a mismatched trusted consent row is refused before private reads and omitted from link status", async () => {
  const { home, badge } = await fixture(); const linked = await link(home, badge);
  const actual = await home.daemon.desk.personalLinkForItem("prj_destination", linked.link.itemId);
  const row = vi.spyOn(home.daemon.desk, "personalLinkForItem");
  const snapshot = vi.spyOn(home.daemon.engine, "getSnapshot"); const bytes = vi.spyOn(home.daemon.store, "openBlob");
  for (const wrong of [{ destinationCanvasId: "prj_another" }, { itemId: "itm_another" }]) {
    row.mockResolvedValue({ ...actual!, ...wrong });
    const response = await request(home, badge, "POST", "/api/projects/prj_destination/personal/read", { actorId: person.id, itemId: linked.link.itemId, mode: "content" });
    expect(response.status, await response.clone().text()).toBe(403);
    expect(await json(await request(home, badge, "GET", `/api/projects/prj_destination/personal?actorId=${person.id}`))).toEqual({ links: [] });
  }
  expect(snapshot.mock.calls.filter(([id]) => id === linked.link.sourceCanvasId)).toEqual([]); expect(bytes).not.toHaveBeenCalled();
});

it("contradictory actor fields cannot mask the actor used by a private pass or grant route", async () => {
  const { home, badge } = await fixture(); const source = (await ensure(home, badge)).source!.canvasId;
  const snapshots = vi.spyOn(home.daemon.engine, "getSnapshot");
  const policy = { mode: "direct", actorId: person.id, intent: "own" } as const;
  const pass = await request(home, badge, "POST", `/api/projects/${source}/passes`, { actor: person, actorId: other.id }, policy);
  expect(pass.status, await pass.clone().text()).toBe(403);
  const grant = { id: "gnt_actor_fields", canvasId: source, subject: "link" as const, capability: "read" as const, grantedBy: badge.badgeId, at: new Date().toISOString() };
  await home.daemon.desk.putGrant(grant);
  const revoke = await request(home, badge, "DELETE", `/api/projects/${source}/grants/${grant.id}?actorId=${other.id}`, { actor: person, actorId: person.id }, policy);
  expect(revoke.status, await revoke.clone().text()).toBe(403);
  expect(snapshots.mock.calls.filter(([id]) => id === source)).toEqual([]);
  expect((await home.daemon.desk.grantsFor(source)).find((row) => row.id === grant.id)).toEqual(grant);
});

it("invalid gesture identities cannot create a source or unlink a live card", async () => {
  const { home, badge } = await fixture();
  for (const requestId of [undefined, 123, "", "x".repeat(257)]) {
    const result = await request(home, badge, "POST", "/api/projects/prj_destination/personal/link", { actorId: person.id, requestId });
    expect(result.status).toBe(403); expect(await home.daemon.desk.personalBinding([person.id])).toBeNull();
  }
  const linked = await link(home, badge); const tip = await home.daemon.store.tipSeq("prj_destination");
  const result = await request(home, badge, "POST", "/api/projects/prj_destination/personal/unlink", { actorId: person.id, itemId: linked.link.itemId });
  expect(result.status).toBe(403); expect(await home.daemon.store.tipSeq("prj_destination")).toBe(tip);
  expect((await home.daemon.engine.getSnapshot("prj_destination")).canvas.items[linked.link.itemId]).toBeDefined();
});
