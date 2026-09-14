import { afterEach, expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { SOURCE_POLICY_HEADER, sourcePolicyHeader, recapHeadRoute, type Actor, type Operation, type PersonalEnsureResponse, type RecapHeadResponse, type SourceRequestContext } from "@isocan/core";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

const actor: Actor = { id: "usr_recap_maya", name: "Maya" };
const nodes: Array<{ daemon: Daemon; dir: string; base: string }> = [];
function recapSpellings(id: string) {
  return [recapHeadRoute(id), `/%61pi/projects/${id}/context/recap`, `/api/%70rojects/${id}/context/recap`, `/api/projects/${id}/%63ontext/recap`, `/api/projects/${id}/context/%72ecap`, `/api/projects/%70${id.slice(1)}/context/recap`];
}
async function node() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-recap-head-"));
  const daemon = await startDaemon({ home: dir, port: 0, contentPort: "off", birthHome: null, servesWorld: true, homePollMs: 60_000 });
  const result = { daemon, dir, base: `http://127.0.0.1:${(daemon.app.server.address() as { port: number }).port}` };
  nodes.push(result); return result;
}
afterEach(async () => {
  vi.restoreAllMocks();
  for (const one of nodes.reverse()) await one.daemon.close();
  await Promise.all(nodes.splice(0).map((one) => fs.rm(one.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })));
});
async function json<T>(response: Response): Promise<T> {
  expect(response.status, await response.clone().text()).toBe(200);
  return response.json() as Promise<T>;
}
function request(home: Awaited<ReturnType<typeof node>>, badge: TestBadge, method: string, route: string, body?: unknown, context?: SourceRequestContext) {
  return fetch(home.base + route, { method, headers: { ...badge.headers, ...(context ? { [SOURCE_POLICY_HEADER]: sourcePolicyHeader(context) } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
async function op(home: Awaited<ReturnType<typeof node>>, badge: TestBadge, id: string | null, operation: Operation) {
  return json(await request(home, badge, "POST", "/api/ops", { canvasId: id, actor, op: operation }));
}
function countReads(home: Awaited<ReturnType<typeof node>>, defaultId?: string) {
  const spies = [vi.spyOn(home.daemon.engine, "getSnapshot"), vi.spyOn(home.daemon.engine, "getLog"), vi.spyOn(home.daemon.engine, "getArchivedLog"),
    vi.spyOn(home.daemon.engine as unknown as { runtime(id: string): Promise<unknown> }, "runtime"), vi.spyOn(home.daemon.store, "load"), vi.spyOn(home.daemon.store, "readArchivedLog"), vi.spyOn(home.daemon.store, "openBlob")];
  const names = ["snapshot", "log", "archive", "runtime", "load", "backing archive", "blob"];
  return { clear: () => { for (const spy of spies) spy.mockClear(); }, none: (id = defaultId) => { for (const [index, spy] of spies.entries()) expect(spy.mock.calls.filter(([canvasId]) => canvasId === id), `${home.base} ${names[index]} reads of ${id}`).toEqual([]); } };
}

it("requires ordinary read admission using metadata before content, and preserves real grant/creator floors", async () => {
  const home = await node(), owner = await mintTestBadge(home.base), reader = await mintTestBadge(home.base);
  await owner.speakAs(actor, "home:maya");
  const id = "prj_recap_admission";
  await op(home, owner, null, { type: "project.create", canvasId: id, title: "Acme recap" });
  for (const grant of await home.daemon.desk.grantsFor(id)) await home.daemon.desk.revokeGrant(grant.id, new Date().toISOString(), owner.badgeId);
  const reads = countReads(home, id);
  for (const route of recapSpellings(id)) {
    const denied = await request(home, reader, "GET", route);
    expect(denied.status, `${route}: ${await denied.clone().text()}`).toBe(403); expect(await denied.json()).toMatchObject({ code: "not-admitted" }); reads.none();
  }
  const record = vi.spyOn(home.daemon.store, "canvasRecord").mockResolvedValueOnce(null);
  expect((await request(home, reader, "GET", recapHeadRoute(id))).status).toBe(404); reads.none();
  record.mockRestore();
  const unknown = await request(home, reader, "GET", recapHeadRoute("prj_unknown"));
  expect(unknown.status).toBe(404);
  const ownerRow = (await home.daemon.desk.badge(owner.badgeId))!;
  await home.daemon.desk.put({ ...ownerRow, admissions: [] });
  expect(await json<RecapHeadResponse>(await request(home, owner, "GET", recapHeadRoute(id)))).toMatchObject({ canvasId: id, home: home.base, title: "Acme recap", revision: 1, head: { count: 1 } });
  const grant = { id: "gnt_recap_link", canvasId: id, subject: "link" as const, capability: "view" as const, grantedBy: owner.badgeId, at: new Date().toISOString() };
  await home.daemon.desk.putGrant(grant);
  reads.clear(); expect((await request(home, reader, "GET", recapHeadRoute(id))).status).toBe(403); reads.none();
  await home.daemon.desk.putGrant({ ...grant, capability: "read" });
  const admitted = await request(home, reader, "GET", recapHeadRoute(id));
  expect(admitted.headers.get("cache-control")).toBe("no-store");
  expect(await json(admitted)).toMatchObject({ head: { count: 1 } });
});

it("forces personal exclusion before hooks even without a header or with the owner's direct policy", async () => {
  const home = await node(), owner = await mintTestBadge(home.base);
  await owner.speakAs(actor, "home:maya");
  const source = (await json<PersonalEnsureResponse>(await request(home, owner, "POST", "/api/personal/ensure", { actorId: actor.id }))).source!.canvasId;
  const reads = countReads(home, source);
  for (const context of [undefined, { policy: { mode: "exclude" as const }, expectedHome: home.base }, { policy: { mode: "direct" as const, actorId: actor.id, intent: "own" as const }, expectedHome: home.base }]) for (const route of recapSpellings(source)) for (const method of ["GET", "HEAD"]) {
    // No group feature header: a misplaced check would load the snapshot in
    // the generic capability hook before returning an apparently safe error.
    const response = await fetch(home.base + route, { method, headers: { Authorization: owner.headers.Authorization!, ...(context ? { [SOURCE_POLICY_HEADER]: sourcePolicyHeader(context) } : {}) } });
    expect(response.status, `${method} ${route}: ${await response.clone().text()}`).toBe(403);
    if (method === "GET") expect(await response.json()).toMatchObject({ code: "personal-source-excluded" });
  }
  reads.none();
});

it("forwards the actual head to its home and never falls back to a retained replica", async () => {
  const home = await node(), owner = await mintTestBadge(home.base);
  await owner.speakAs(actor, "home:maya");
  const id = "prj_recap_forward";
  await op(home, owner, null, { type: "project.create", canvasId: id, title: "Acme authoritative" });
  const local = await node(), localBadge = await mintTestBadge(local.base);
  await localBadge.speakAs(actor, "home:maya");
  const pass = await json<{ token: string }>(await request(home, owner, "POST", `/api/projects/${id}/passes`, { actorId: actor.id }));
  await json(await request(local, localBadge, "POST", "/api/passes/redeem", { home: home.base, token: pass.token }));
  await expect.poll(() => local.daemon.store.canvasExists(id)).toBe(true);
  const source = (await json<PersonalEnsureResponse>(await request(local, localBadge, "POST", "/api/personal/ensure", { actorId: actor.id, destinationCanvasId: id }))).source!.canvasId;
  await local.daemon.homes.for(source)!.join(source, actor);
  await expect.poll(() => local.daemon.store.canvasExists(source)).toBe(true);
  await expect.poll(() => local.daemon.homes.linkFor(home.base).handshakes(source).last).not.toBeNull();
  // Drain this fixture's background replication after real snapshots landed.
  // Retained assignments and credentials still drive actual HTTP forwarding;
  // no polling/redial reads can contaminate the request observation window.
  await local.daemon.homes.close();
  await local.daemon.engine.settled();
  const localReads = countReads(local), homeReads = countReads(home);
  const context: SourceRequestContext = { policy: { mode: "exclude" }, expectedHome: home.base };
  const authoritative = await json(await request(home, owner, "GET", recapHeadRoute(id)));
  for (const route of recapSpellings(id)) {
    const forwarded = await json<RecapHeadResponse>(await request(local, localBadge, "GET", route, undefined, context));
    expect(forwarded).toEqual(authoritative); localReads.none(id);
  }
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  const blocking = home.daemon.engine.personalWrite(async () => { await held; });
  const headCalls = vi.spyOn(home.daemon.engine, "recapHead");
  homeReads.clear(); localReads.clear();
  try {
    const controller = new AbortController();
    const canceled = expect(fetch(local.base + recapHeadRoute(id), { headers: { ...localBadge.headers, [SOURCE_POLICY_HEADER]: sourcePolicyHeader(context) }, signal: controller.signal })).rejects.toThrow();
    await expect.poll(() => headCalls.mock.calls.length, { timeout: 5_000 }).toBe(1);
    const authoritativeSignal = headCalls.mock.calls[0]![2].signal!;
    controller.abort();
    await canceled;
    await expect.poll(() => authoritativeSignal.aborted, { timeout: 5_000 }).toBe(true);
  } finally {
    release(); await blocking; await home.daemon.engine.settled(); headCalls.mockRestore();
  }
  homeReads.none(id); localReads.none(id);
  const foreign = await request(local, localBadge, "GET", recapHeadRoute(id), undefined, { policy: { mode: "exclude" }, expectedHome: "https://foreign.invalid" });
  expect(foreign.status).toBe(403); localReads.none(id);
  localReads.clear(); homeReads.clear();
  for (const selected of [undefined, { policy: { mode: "direct" as const, actorId: actor.id, intent: "own" as const }, expectedHome: home.base }]) {
    const refused = await request(local, localBadge, "GET", recapHeadRoute(source), undefined, selected);
    expect(refused.status, await refused.clone().text()).toBe(403);
    expect(await refused.json()).toMatchObject({ code: "personal-source-excluded" });
  }
  homeReads.none(source); localReads.none(source);
  await home.daemon.close();
  localReads.clear();
  const unavailable = await request(local, localBadge, "GET", recapHeadRoute(id), undefined, context);
  expect(unavailable.ok).toBe(false); localReads.none(id);
});
