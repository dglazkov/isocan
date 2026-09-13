import { afterEach, expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { grantsRoute, publicListingRoute, PUBLIC_CANVASES_ROUTE, type Actor, type Grant, type Operation, type PublicCanvasesResponse } from "@isocan/core";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

const owner: Actor = { id: "usr_public_owner", name: "Maya" };
const nodes: Array<{ daemon: Daemon; dir: string }> = [];
async function node(birthHome: string | null = null) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-public-"));
  const daemon = await startDaemon({ port: 0, home: dir, birthHome, homePollMs: 50, servesWorld: true });
  nodes.push({ daemon, dir });
  return { daemon, dir, base: `http://127.0.0.1:${(daemon.app.server.address() as { port: number }).port}` };
}
afterEach(async () => {
  vi.restoreAllMocks();
  for (const node of nodes.reverse()) await node.daemon.close().catch(() => {});
  await Promise.all(nodes.splice(0).map((node) => fs.rm(node.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })));
});
async function request(base: string, badge: TestBadge | null, method: string, route: string, body?: unknown) {
  return fetch(base + route, { method, headers: { ...badge?.headers, ...(body === undefined ? {} : { "Content-Type": "application/json" }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
async function op(base: string, badge: TestBadge, canvasId: string | null, op: Operation) {
  const result = await request(base, badge, "POST", "/api/ops", { actor: owner, canvasId, op });
  expect(result.status, await result.clone().text()).toBe(200);
}
async function waitForCanvas(local: Awaited<ReturnType<typeof node>>) {
  const deadline = Date.now() + 5000;
  while (!(await local.daemon.engine.listCanvases()).some((canvas) => canvas.id === "prj_public")) {
    if (Date.now() > deadline) throw new Error("replica did not settle");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
async function seed(home: Awaited<ReturnType<typeof node>>, id = "prj_public") {
  const badge = await mintTestBadge(home.base); await badge.speakAs(owner);
  await op(home.base, badge, null, { type: "project.create", canvasId: id, title: "Acme examples" });
  return badge;
}
async function link(base: string, badge: TestBadge, id: string, capability: "read" | "view" | "edit") {
  const result = await request(base, badge, "POST", grantsRoute(id), { subject: "link", capability, actorId: owner.id });
  expect(result.status, await result.clone().text()).toBe(200);
  return ((await result.json()) as { grant: Grant }).grant;
}
async function listing(base: string, badge: TestBadge, id: string, grantId: string, listed: boolean) {
  return request(base, badge, "PUT", publicListingRoute(id, grantId), { listed, actorId: owner.id });
}
async function catalogue(base: string, badge: TestBadge | null = null) {
  const result = await request(base, badge, "GET", PUBLIC_CANVASES_ROUTE);
  expect(result.status, await result.clone().text()).toBe(200);
  return result.json() as Promise<PublicCanvasesResponse>;
}

it("advertises only explicit narrow metadata without admission, seen marks or working discovery", async () => {
  const home = await node(); const mine = await seed(home);
  const row = await link(home.base, mine, "prj_public", "read");
  expect(await catalogue(home.base)).toEqual({ canvases: [] });
  expect((await listing(home.base, mine, "prj_public", row.id, true)).status).toBe(200);
  const stranger = await mintTestBadge(home.base);
  const before = await home.daemon.desk.badge(stranger.badgeId);
  const load = vi.spyOn(home.daemon.store, "load").mockRejectedValue(new Error("catalogue must not load contents"));
  const wide = vi.spyOn(home.daemon.store, "listCanvases").mockRejectedValue(new Error("catalogue must not scan canvases"));
  const response = await request(home.base, null, "GET", PUBLIC_CANVASES_ROUTE);
  expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  expect(response.headers.get("cache-control")).toBe("no-store");
  const expected = { canvases: [{ id: "prj_public", title: "Acme examples", home: home.base, capability: "read" }] };
  expect(await response.json()).toEqual(expected);
  expect(await catalogue(home.base, stranger)).toEqual(expected);
  expect(load).not.toHaveBeenCalled(); expect(wide).not.toHaveBeenCalled();
  load.mockRestore(); wide.mockRestore();
  expect((await home.daemon.desk.badge(stranger.badgeId))!.admissions).toEqual(before!.admissions);
  expect(await home.daemon.desk.seenOf(owner.id)).toEqual({});
  expect(await (await request(home.base, stranger, "GET", "/api/projects")).json()).toEqual([]);
});

it("requires an owner, a boolean and a current eligible concrete link", async () => {
  const home = await node(); const mine = await seed(home);
  const old = (await home.daemon.desk.grantsFor("prj_public"))[0]!;
  expect((await listing(home.base, mine, "prj_public", old.id, true)).status).toBe(409); // legacy edit
  const row = await link(home.base, mine, "prj_public", "read");
  const other = await mintTestBadge(home.base); await other.speakAs({ id: "usr_public_other", name: "Rowan" });
  await home.daemon.desk.attest(other.badgeId, { attribute: "email:editor@example.test", verifiedVia: "magic-link", at: new Date().toISOString() });
  await home.daemon.desk.putGrant({ id: "gnt_editor", canvasId: "prj_public", subject: "email:editor@example.test", capability: "edit", grantedBy: mine.badgeId, at: new Date().toISOString() });
  expect((await request(home.base, other, "GET", "/api/projects/prj_public/canvas")).status).toBe(200);
  expect((await home.daemon.desk.badge(other.badgeId))!.admissions[0]!.capability ?? "edit").toBe("edit");
  const outsider = await request(home.base, other, "PUT", publicListingRoute("prj_public", row.id), { listed: true, actorId: "usr_public_other" });
  expect(outsider.status).toBe(403);
  expect(await outsider.json()).toMatchObject({ code: "not-owner" });
  expect((await request(home.base, mine, "PUT", publicListingRoute("prj_public", row.id), { listed: "true", actorId: owner.id })).status).toBe(400);
  expect((await listing(home.base, mine, "prj_public", "missing", true)).status).toBe(409);
  expect(await catalogue(home.base)).toEqual({ canvases: [] });
  expect((await home.daemon.desk.grantsFor("prj_public")).every((grant) => !grant.listing)).toBe(true);
});

it("unlists without expelling, and off/replacement/edit cannot later republish", async () => {
  const home = await node(); const mine = await seed(home);
  let row = await link(home.base, mine, "prj_public", "read");
  expect((await listing(home.base, mine, "prj_public", row.id, true)).status).toBe(200);
  const visitor = await mintTestBadge(home.base);
  expect((await request(home.base, visitor, "GET", "/api/projects/prj_public/canvas")).status).toBe(200);
  const admissions = (await home.daemon.desk.badge(visitor.badgeId))!.admissions;
  expect((await listing(home.base, mine, "prj_public", row.id, false)).status).toBe(200);
  expect((await home.daemon.desk.badge(visitor.badgeId))!.admissions).toEqual(admissions);
  expect((await request(home.base, visitor, "GET", "/api/projects/prj_public/canvas")).status).toBe(200);
  expect(await catalogue(home.base)).toEqual({ canvases: [] });
  await listing(home.base, mine, "prj_public", row.id, true);
  const stale = row.id;
  await link(home.base, mine, "prj_public", "edit");
  row = await link(home.base, mine, "prj_public", "view");
  expect(row.listing).toBeUndefined();
  expect((await listing(home.base, mine, "prj_public", stale, true)).status).toBe(409);
  expect(await catalogue(home.base)).toEqual({ canvases: [] });
  await listing(home.base, mine, "prj_public", row.id, true);
  expect((await request(home.base, mine, "DELETE", `${grantsRoute("prj_public")}/${row.id}?actorId=${owner.id}`)).status).toBe(200);
  expect((await home.daemon.desk.grantsFor("prj_public")).find((g) => g.id === row.id)?.listing?.listed).toBe(false);
  row = await link(home.base, mine, "prj_public", "read");
  expect(row.listing).toBeUndefined();
  expect(await catalogue(home.base)).toEqual({ canvases: [] });
});

it("checks current backing lifecycle rather than retained metadata or a warmed runtime", async () => {
  const home = await node(); const mine = await seed(home);
  const row = await link(home.base, mine, "prj_public", "view");
  await listing(home.base, mine, "prj_public", row.id, true);
  await home.daemon.engine.getSnapshot("prj_public");
  await home.daemon.store.setTakenDown("prj_public", "2026-09-13T00:00:00Z");
  expect(await catalogue(home.base)).toEqual({ canvases: [] });
  await home.daemon.store.setTakenDown("prj_public", null);
  expect((await catalogue(home.base)).canvases).toHaveLength(1);
  await home.daemon.store.setTakenDown("prj_public", "2026-09-13T01:00:00Z");
  await home.daemon.store.purgeCanvas("prj_public");
  await home.daemon.store.setTakenDown("prj_public", null); // purge still wins if this flag is damaged
  expect(await catalogue(home.base)).toEqual({ canvases: [] });
  const another = "prj_deleted";
  await op(home.base, mine, null, { type: "project.create", canvasId: another, title: "Acme deleted" });
  const second = await link(home.base, mine, another, "read");
  await listing(home.base, mine, another, second.id, true);
  await op(home.base, mine, another, { type: "project.delete" });
  expect(await catalogue(home.base)).toEqual({ canvases: [] });
});

it.each([false, true])("forwards mutations to the canvas home without listing replicas (read before pass: %s)", async (readBeforePass) => {
  const home = await node(); const local = await node(); const mine = await seed(home);
  const row = await link(home.base, mine, "prj_public", "read");
  const localBadge = await mintTestBadge(local.base);
  await localBadge.speakAs(owner);
  if (readBeforePass) {
    expect((await request(local.base, localBadge, "POST", "/api/home/join", { canvasId: "prj_public", home: home.base })).status).toBe(200);
    await waitForCanvas(local);
    expect((await request(local.base, localBadge, "GET", "/api/projects/prj_public/canvas")).status).toBe(200);
    const remoteReaders = (await home.daemon.desk.badgesIn("prj_public")).filter((badge) => badge.badgeId !== mine.badgeId);
    expect(remoteReaders.some((badge) => badge.admissions.some((entry) => entry.canvasId === "prj_public" && entry.capability === "read"))).toBe(true);
  }
  // The local claim cannot usurp the home owner's persona. A real pass gives
  // the replica badge custody of that person at the home before forwarding.
  const minted = await request(home.base, mine, "POST", "/api/projects/prj_public/passes", { actorId: owner.id });
  const pass = await minted.json() as { token: string };
  const redeemed = await request(local.base, localBadge, "POST", "/api/passes/redeem", { token: pass.token, home: home.base });
  expect(redeemed.status, await redeemed.clone().text()).toBe(200);
  await waitForCanvas(local);
  const published = await listing(local.base, localBadge, "prj_public", row.id, true);
  expect(published.status, await published.clone().text()).toBe(200);
  expect((await catalogue(home.base)).canvases).toHaveLength(1);
  const localGrant = (await local.daemon.desk.grantsFor("prj_public"))[0]!;
  await local.daemon.desk.putGrant({ ...localGrant, capability: "read", listing: { listed: true, at: "2026-09-13T00:00:00Z", by: "bdg_synthetic" } });
  expect(await catalogue(local.base)).toEqual({ canvases: [] });
  expect((await listing(local.base, localBadge, "prj_public", row.id, false)).status).toBe(200);
  expect(await catalogue(home.base)).toEqual({ canvases: [] });
});

it("lets an existing reader become the owner by redeeming that owner's pass", async () => {
  const home = await node(); const mine = await seed(home);
  const row = await link(home.base, mine, "prj_public", "read");
  const reader = await mintTestBadge(home.base);
  expect((await request(home.base, reader, "GET", "/api/projects/prj_public/canvas")).status).toBe(200);
  expect((await home.daemon.desk.badge(reader.badgeId))!.admissions[0]!.capability).toBe("read");
  const minted = await request(home.base, mine, "POST", "/api/projects/prj_public/passes", { actorId: owner.id });
  const pass = await minted.json() as { token: string };
  expect((await request(home.base, reader, "POST", "/api/passes/redeem", { token: pass.token })).status).toBe(200);
  const published = await listing(home.base, reader, "prj_public", row.id, true);
  expect(published.status, await published.clone().text()).toBe(200);
  expect((await home.daemon.desk.badge(reader.badgeId))!.admissions[0]).toMatchObject({ capability: "own", provenance: { root: "pass", badgeId: mine.badgeId } });
  expect((await catalogue(home.base)).canvases).toHaveLength(1);
});

it("an owner pass keeps an active operator look unable to publish", async () => {
  const home = await node(); const mine = await seed(home);
  const row = await link(home.base, mine, "prj_public", "read");
  const looking = await mintTestBadge(home.base);
  const provenance = { root: "operator" as const, until: new Date(Date.now() + 60_000).toISOString() };
  await home.daemon.desk.admit(looking.badgeId, "prj_public", provenance, "view");
  const minted = await request(home.base, mine, "POST", "/api/projects/prj_public/passes", { actorId: owner.id });
  const pass = await minted.json() as { token: string };
  expect((await request(home.base, looking, "POST", "/api/passes/redeem", { token: pass.token })).status).toBe(200);
  const published = await listing(home.base, looking, "prj_public", row.id, true);
  expect(published.status).toBe(403);
  expect(await published.json()).toMatchObject({ code: "view-only" });
  expect((await home.daemon.desk.badge(looking.badgeId))!.admissions[0]).toMatchObject({ provenance, capability: "view" });
  expect(await catalogue(home.base)).toEqual({ canvases: [] });
});

it("does not turn a supplied ended badge into an anonymous catalogue reader", async () => {
  const home = await node(); const mine = await seed(home);
  const row = await link(home.base, mine, "prj_public", "view");
  await listing(home.base, mine, "prj_public", row.id, true);
  const ended = await mintTestBadge(home.base);
  await home.daemon.desk.killBadge(ended.badgeId, new Date().toISOString(), mine.badgeId);
  const result = await request(home.base, ended, "GET", PUBLIC_CANVASES_ROUTE);
  expect(result.status).toBe(401);
  expect(JSON.stringify(await result.json())).not.toContain("Acme examples");
  expect((await catalogue(home.base)).canvases).toHaveLength(1);
});

it("serves the named replica's public page and real app asset without redirecting its other pages", async () => {
  const home = await node(); const local = await node(home.base);
  for (const route of ["/public", "/public/"]) {
    const page = await request(local.base, null, "GET", route);
    expect(page.status, "a build is required to prove this public page").toBe(200);
    expect(page.headers.get("x-isocan-home")).toBeNull();
    expect(page.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(page.headers.get("cache-control")).toBe("no-store");
    const html = await page.text();
    const asset = html.match(/\/?assets\/[A-Za-z0-9._-]+\.(?:js|css)/)?.[0];
    expect(asset).toBeTruthy();
    const response = await request(local.base, null, "GET", `/${asset!.replace(/^\//, "")}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("immutable");
    expect(response.headers.get("content-type")).not.toContain("text/html");
  }
  for (const route of ["/", "/index.html", "/public-other", "/assets/missing.js"]) {
    const response = await request(local.base, null, "GET", route);
    expect(response.status).toBe(404);
    expect(await response.text()).toContain(home.base);
  }
  expect(await catalogue(local.base)).toEqual({ canvases: [] });
});
