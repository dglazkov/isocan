import { afterEach, expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { BADGE_COOKIE, DOOR_ROUTE, SOURCE_POLICY_HEADER, sourcePolicyHeader, type Actor, type PersonalEnsureResponse } from "@isocan/core";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { mintTestBadge } from "./badge.ts";

const nodes: Array<{ daemon: Daemon; dir: string }> = [];
const actor: Actor = { id: "usr_acme_route_owner", name: "Maya" };
afterEach(async () => {
  vi.restoreAllMocks();
  for (const node of nodes.reverse()) await node.daemon.close();
  await Promise.all(nodes.splice(0).map(({ dir }) => fs.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })));
});
async function setup() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-api-route-policy-"));
  const daemon = await startDaemon({ home: dir, port: 0, contentPort: "off", birthHome: null, servesWorld: true });
  nodes.push({ daemon, dir });
  const base = `http://127.0.0.1:${(daemon.app.server.address() as { port: number }).port}`;
  const owner = await mintTestBadge(base), stranger = await mintTestBadge(base);
  await owner.speakAs(actor, "home:maya");
  const request = (route: string, headers: Record<string, string> = {}, method = "GET", body?: unknown) => fetch(base + route, { method, headers: { ...headers, ...(body === undefined ? {} : { "Content-Type": "application/json" }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const id = "prj_acme_route_policy";
  expect((await request("/api/ops", owner.headers, "POST", { actor, canvasId: null, op: { type: "project.create", canvasId: id, title: "CONFIDENTIAL_ACME_TITLE" } })).status).toBe(200);
  for (const grant of await daemon.desk.grantsFor(id)) await daemon.desk.revokeGrant(grant.id, new Date().toISOString(), owner.badgeId);
  return { daemon, base, owner, stranger, request, id };
}
function spellings(id: string, suffix: string) {
  return [`/api/projects/${id}/${suffix}`, `/%61pi/projects/${id}/${suffix}`, `/api/%70rojects/${id}/${suffix}`, `/api/projects/%70${id.slice(1)}/${suffix}`];
}
function observe(daemon: Daemon, id: string) {
  const spies = [vi.spyOn(daemon.engine, "getSnapshot"), vi.spyOn(daemon.engine, "getLog"), vi.spyOn(daemon.engine, "getArchivedLog"),
    vi.spyOn(daemon.engine as unknown as { runtime(id: string): Promise<unknown> }, "runtime"), vi.spyOn(daemon.store, "load"), vi.spyOn(daemon.store, "readArchivedLog"), vi.spyOn(daemon.store, "openBlob")];
  return { clear: () => { for (const spy of spies) spy.mockClear(); }, none: () => { for (const spy of spies) expect(spy.mock.calls.filter(([canvasId]) => canvasId === id)).toEqual([]); } };
}

it("matches encoded API routes before openness, Origin, admission and capability checks", async () => {
  const { daemon, owner, stranger, request, id } = await setup();
  const reads = observe(daemon, id);
  for (const suffix of ["canvas", "oplog", "oplog/archive", "context/recap"]) for (const route of spellings(id, suffix)) for (const method of ["GET", "HEAD"]) {
    const response = await request(route, {}, method);
    expect(response.status, `${method} ${route}: ${await response.clone().text()}`).toBe(401);
    reads.none();
  }
  for (const route of ["/api/homes", "/%61pi/homes"]) expect((await request(route)).status).toBe(401);
  for (const route of spellings(id, "canvas")) {
    const response = await request(route, { Cookie: `${BADGE_COOKIE}=${owner.token}`, Origin: "https://foreign.invalid" });
    expect(response.status, await response.clone().text()).toBe(403);
    expect(await response.json()).toMatchObject({ code: "bad-origin" }); reads.none();
  }
  for (const suffix of ["canvas", "oplog", "oplog/archive", "context/recap"]) for (const route of spellings(id, suffix)) {
    const response = await request(route, stranger.headers);
    expect(response.status, `${route}: ${await response.clone().text()}`).toBe(403);
    const answer = await response.json(); expect(answer).toMatchObject({ code: "not-admitted" });
    expect(JSON.stringify(answer)).not.toContain("CONFIDENTIAL_ACME_TITLE");
  }
  for (const route of spellings(id, "canvas")) expect((await request(route, owner.headers)).status).toBe(200);
  // This API door stays deliberately open under either spelling.
  expect((await request(DOOR_ROUTE.replace("/api/", "/%61pi/"), {}, "POST", { carrier: "bearer" })).status).toBe(200);
  const tip = await daemon.store.tipSeq(id);
  expect((await request("/%61pi/ops", {}, "POST", { canvasId: id, actor, op: { type: "project.update", patch: { title: "Unauthorized edit" } } })).status).toBe(401);
  await daemon.desk.putGrant({ id: "gnt_acme_route_read", canvasId: id, subject: "link", capability: "read", grantedBy: owner.badgeId, at: new Date().toISOString() });
  for (const route of spellings(id, "undo")) {
    const response = await request(route, stranger.headers, "POST", { actor });
    expect(response.status, await response.clone().text()).toBe(403);
    expect(await response.json()).toMatchObject({ code: "view-only" });
  }
  expect(await daemon.store.tipSeq(id)).toBe(tip);
});

it("applies source exclusion and intent before encoded canvas or body-scoped reads and writes", async () => {
  const { daemon, base, owner, request } = await setup();
  const response = await request("/api/personal/ensure", owner.headers, "POST", { actorId: actor.id });
  expect(response.status).toBe(200);
  const source = ((await response.json()) as PersonalEnsureResponse).source!.canvasId;
  const reads = observe(daemon, source);
  const headers = { Authorization: owner.headers.Authorization!, [SOURCE_POLICY_HEADER]: sourcePolicyHeader({ policy: { mode: "exclude" }, expectedHome: base }) };
  for (const suffix of ["canvas", "%63anvas", "oplog", "%6fplog", "oplog/archive", "context/recap", "context/%72ecap"]) for (const route of spellings(source, suffix)) {
    const result = await request(route, headers);
    expect(result.status, `${route}: ${await result.clone().text()}`).toBe(403);
    expect(await result.json()).toMatchObject({ code: "personal-source-excluded" }); reads.none();
  }
  const tip = await daemon.store.tipSeq(source);
  for (const route of ["/api/ops", "/%61pi/ops", "/api/%6fps"]) {
    const denied = await request(route, headers, "POST", { canvasId: source, actor, op: { type: "project.update", patch: { title: "Unauthorized private edit" } } });
    expect(denied.status, await denied.clone().text()).toBe(403);
    expect(await denied.json()).toMatchObject({ code: "personal-source-excluded" }); reads.none();
  }
  const readOnly = { ...headers, [SOURCE_POLICY_HEADER]: sourcePolicyHeader({ policy: { mode: "direct", actorId: actor.id, intent: "read" }, expectedHome: base }) };
  for (const route of spellings(source, "%67rants")) {
    const denied = await request(route, readOnly, "POST", { actorId: actor.id, subject: "link", capability: "read" });
    expect(denied.status, await denied.clone().text()).toBe(403);
    expect(await denied.json()).toMatchObject({ code: "personal-intent-exceeded" }); reads.none();
  }
  expect(await daemon.store.tipSeq(source)).toBe(tip);
});
