import { afterEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { inboxRoute, newSince, seenRoute, seenMarksRoute, formatBadgeToken, type Actor, type Canvas, type InboxResponse, type Operation } from "@isocan/core";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";
import { collectInbox } from "../src/inbox.ts";
import { readBadge } from "../src/badge-store.ts";

const ada = { id: "usr_ada", name: "Ada" };
const bo = { id: "usr_bo", name: "Bo" };
const nodes: Array<{ daemon: Daemon; dir: string }> = [];
async function node() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-inbox-"));
  const daemon = await startDaemon({ port: 0, home: dir, birthHome: null, homePollMs: 50 });
  nodes.push({ daemon, dir });
  const address = daemon.app.server.address();
  const base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  return { daemon, base, dir };
}
afterEach(async () => {
  for (const node of nodes.reverse()) await node.daemon.close().catch(() => {});
  await Promise.all(nodes.splice(0).map((node) => fs.rm(node.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })));
});
async function request(base: string, badge: TestBadge, method: string, route: string, body?: unknown) {
  return fetch(base + route, { method, headers: { ...badge.headers, "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
async function op(base: string, badge: TestBadge, actor: Actor, canvasId: string | null, op: Operation, home?: string) {
  const response = await request(base, badge, "POST", "/api/ops", { actor, canvasId, op, ...(home ? { home } : {}) });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}
async function inbox(base: string, badge: TestBadge, canvasId?: string): Promise<InboxResponse> {
  const response = await request(base, badge, "GET", inboxRoute(ada.id, canvasId ? { canvasId } : {}));
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<InboxResponse>;
}
const thread = (id: string, body: string): Operation => ({ type: "thread.create", threadId: id, x: 10, y: 20, anchorItemId: null, comment: { id: `cmt_${id}`, body, mentions: [ada.id] } });

it("uses claimed identity, core routing, and durable marks without marking a read", async () => {
  const home = await node();
  const mine = await mintTestBadge(home.base); await mine.speakAs(ada);
  const author = await mintTestBadge(home.base); await author.speakAs(bo);
  await op(home.base, mine, ada, null, { type: "project.create", canvasId: "prj_one", title: "Acme" });
  await op(home.base, author, bo, "prj_one", thread("thr_other", "@Ada please look"));
  await op(home.base, mine, ada, "prj_one", thread("thr_own", "@Ada my own words"));
  const stranger = await mintTestBadge(home.base);
  expect((await request(home.base, stranger, "GET", inboxRoute(ada.id))).status).toBe(400);
  const before = await inbox(home.base, mine);
  expect(before.entries.map((entry) => entry.threadId)).toEqual(["thr_other"]);
  expect(before.marks).toEqual({});
  expect(await home.daemon.desk.seenOf(ada.id)).toEqual({});
  const marked = await request(home.base, mine, "PUT", seenRoute("prj_one"), { actorId: ada.id, seq: 3 });
  expect(marked.status).toBe(200);
  expect(newSince((await inbox(home.base, mine)).entries, (await inbox(home.base, mine)).marks)).toEqual([]);
});

it("reads remote content and seen truth at two homes, and drops withdrawn and disabled replicas", async () => {
  const h1 = await node(); const h2 = await node(); const local = await node();
  const mine = await mintTestBadge(local.base); await mine.speakAs(ada);
  const authors = new Map<string, TestBadge>();
  for (const [home, id] of [[h1, "prj_one"], [h2, "prj_two"]] as const) {
    const author = await mintTestBadge(home.base); await author.speakAs(bo);
    authors.set(home.base, author);
    await op(home.base, author, bo, null, { type: "project.create", canvasId: id, title: id === "prj_one" ? "Acme" : "Bramble" });
    await op(home.base, author, bo, id, thread(`thr_${id}`, "@Ada remote message"));
    const joined = await request(local.base, mine, "POST", "/api/home/join", { canvasId: id, home: home.base });
    expect(joined.status).toBe(200);
  }
  const deadline = Date.now() + 5000;
  while ((await local.daemon.engine.listCanvases()).length < 2) {
    if (Date.now() > deadline) throw new Error("replicas did not settle");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  const first = await inbox(local.base, mine);
  expect(first.entries.map((entry) => entry.canvasId).sort()).toEqual(["prj_one", "prj_two"]);
  expect(first.homes).toEqual({ prj_one: h1.base, prj_two: h2.base });
  expect(first.marks).toEqual({});
  // Another actual home client writes the mark; the replica has no mark and
  // must still report the home truth immediately, without waiting for sync.
  const now = new Date().toISOString();
  await h1.daemon.desk.markSeen(ada.id, "prj_one", { seq: 99, at: now });
  const marked = await inbox(local.base, mine);
  expect(marked.marks.prj_one).toEqual({ seq: 99, at: now });
  expect(newSince(marked.entries, marked.marks).map((entry) => entry.canvasId)).toEqual(["prj_two"]);
  expect(await local.daemon.desk.seenOf(ada.id)).toEqual({});
  // Revoke through the real owner route, including its expulsion sweep.
  // The held replica remains, but its home's door no longer admits it.
  const link = (await h1.daemon.desk.grantsFor("prj_one")).find((grant) => grant.subject === "link")!;
  const revoke = await request(h1.base, authors.get(h1.base)!, "DELETE", `/api/projects/prj_one/grants/${link.id}`, { actorId: bo.id });
  expect(revoke.status).toBe(200);
  const refused = await inbox(local.base, mine);
  expect(refused.entries.map((entry) => entry.canvasId)).toEqual(["prj_two"]);
  expect(refused.unavailable.map((entry) => entry.canvasId)).toContain("prj_one");
  expect(refused.marks.prj_one).toBeUndefined();
  // A stopped home cannot be replaced with the held snapshot either.
  await h2.daemon.close();
  const offline = await inbox(local.base, mine);
  expect(offline.entries).toEqual([]);
  expect(offline.unavailable.map((entry) => entry.canvasId).sort()).toEqual(["prj_one", "prj_two"]);
}, 20_000);

it("caps assembly at four reads, forwards cancellation to all four, and dispatches no more", async () => {
  const canvases = Array.from({ length: 12 }, (_, i) => ({ id: String(i) } as Canvas));
  const aborter = new AbortController();
  const signals: AbortSignal[] = [];
  const read = (_canvas: Canvas, signal: AbortSignal) => new Promise<InboxResponse>((_resolve, reject) => {
    signals.push(signal);
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  });
  const work = collectInbox(canvases, read, aborter.signal);
  expect(signals).toHaveLength(4);
  aborter.abort();
  await expect(work).rejects.toThrow();
  expect(signals).toHaveLength(4);
  expect(signals.every((signal) => signal.aborted)).toBe(true);
});

it("folds joined identities for routing and seen marks without including another actor's mentions", async () => {
  const home = await node();
  const mine = await mintTestBadge(home.base);
  const former = { id: "usr_ada_old", name: "Ada before" };
  await mine.speakAs(ada); await mine.speakAs(former);
  const author = await mintTestBadge(home.base); await author.speakAs(bo);
  await op(home.base, mine, ada, null, { type: "project.create", canvasId: "prj_joined", title: "Acme joined" });
  const addressed = thread("thr_former", "A note for the old identity");
  if (addressed.type !== "thread.create") throw new Error("fixture needs a thread");
  await op(home.base, author, bo, "prj_joined", { ...addressed, comment: { ...addressed.comment, mentions: [former.id] } });
  await op(home.base, mine, former, "prj_joined", thread("thr_own_old", "Own words before joining"));
  await op(home.base, author, bo, "prj_joined", { ...addressed, threadId: "thr_somebody_else", comment: { id: "cmt_somebody_else", body: "For another actor", mentions: ["usr_helper"] } });
  await request(home.base, mine, "PUT", seenRoute("prj_joined"), { actorId: former.id, seq: 4 });
  await op(home.base, mine, ada, null, { type: "actor.join", from: former.id, into: ada.id });
  const result = await inbox(home.base, mine);
  expect(result.entries.map((entry) => entry.threadId)).toEqual(["thr_former"]);
  expect(result.marks.prj_joined?.seq).toBe(4);
  expect(newSince(result.entries, result.marks)).toEqual([]);
});

it("keeps a comment after the visited snapshot new when the seen request arrives later", async () => {
  const home = await node();
  const mine = await mintTestBadge(home.base); await mine.speakAs(ada);
  const author = await mintTestBadge(home.base); await author.speakAs(bo);
  await op(home.base, mine, ada, null, { type: "project.create", canvasId: "prj_race", title: "Acme race" });
  const head = (await home.daemon.engine.getSnapshot("prj_race")).lastSeq;
  await op(home.base, author, bo, "prj_race", thread("thr_later", "A message after the snapshot"));
  const response = await request(home.base, mine, "PUT", seenRoute("prj_race"), { actorId: ada.id, seq: head });
  expect(response.status).toBe(200);
  const result = await inbox(home.base, mine);
  expect(result.entries[0]!.seq).toBe(head + 1);
  expect(result.entries[0]!.comment.createdAt <= result.marks.prj_race!.at).toBe(true);
  expect(newSince(result.entries, result.marks).map((entry) => entry.threadId)).toEqual(["thr_later"]);
});


/** The refusal row is durable before the operator finishes its badge sweep.
 * Restart at that boundary: existing badges are still alive, and every read
 * must obey the refusal registry that boot just loaded. */
async function refuseBeforeSweep(home: Awaited<ReturnType<typeof node>>, badgeId: string) {
  await home.daemon.desk.attest(badgeId, {
    attribute: "email:blocked@example.test", verifiedVia: "magic-link", at: new Date().toISOString(),
  });
  await home.daemon.desk.recordRefusal({
    subject: "email:blocked@example.test", kind: "email", at: new Date().toISOString(),
    reason: "harassment", by: "email:operator@example.test", actId: "opr_acme",
  });
  const previous = home.daemon;
  await previous.close();
  home.daemon = await startDaemon({ port: Number(new URL(home.base).port), home: home.dir, birthHome: null });
  nodes.find((node) => node.daemon === previous)!.daemon = home.daemon;
}

it("refuses inbox content and marks wherever the ordinary snapshot refuses an attestation", async () => {
  const home = await node();
  const mine = await mintTestBadge(home.base); await mine.speakAs(ada);
  const author = await mintTestBadge(home.base); await author.speakAs(bo);
  await op(home.base, mine, ada, null, { type: "project.create", canvasId: "prj_refused", title: "Acme private" });
  await op(home.base, author, bo, "prj_refused", thread("thr_refused", "Synthetic protected comment"));
  expect((await request(home.base, mine, "PUT", seenRoute("prj_refused"), { actorId: ada.id, seq: 0 })).status).toBe(200);
  expect((await inbox(home.base, mine)).entries).toHaveLength(1);
  await refuseBeforeSweep(home, mine.badgeId);
  const ordinary = await request(home.base, mine, "GET", "/api/projects/prj_refused/canvas");
  expect(ordinary.status).toBe(403);
  expect(await ordinary.json()).toMatchObject({ reason: "refused" });
  for (const scope of [undefined, "prj_refused"]) {
    const result = await inbox(home.base, mine, scope);
    expect(result.entries).toEqual([]);
    expect(result.marks).toEqual({});
    expect(result.homes).toEqual({});
    expect(result.unavailable.map((entry) => entry.canvasId)).toEqual(["prj_refused"]);
    expect(JSON.stringify(result)).not.toContain("Synthetic protected comment");
  }
});

it("keeps an unrelated home's inbox available when a forwarded badge's attestation is refused", async () => {
  const first = await node(); const other = await node(); const local = await node();
  const mine = await mintTestBadge(local.base); await mine.speakAs(ada);
  for (const [home, id] of [[first, "prj_blocked"], [other, "prj_available"]] as const) {
    const author = await mintTestBadge(home.base); await author.speakAs(bo);
    await op(home.base, author, bo, null, { type: "project.create", canvasId: id, title: id });
    await op(home.base, author, bo, id, thread(`thr_${id}`, `Synthetic comment for ${id}`));
    expect((await request(local.base, mine, "POST", "/api/home/join", { canvasId: id, home: home.base })).status).toBe(200);
  }
  const deadline = Date.now() + 5000;
  while ((await local.daemon.engine.listCanvases()).length < 2) {
    if (Date.now() > deadline) throw new Error("both inbox replicas did not settle");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  const initial = await inbox(local.base, mine);
  expect(initial.entries).toHaveLength(2);
  await first.daemon.desk.markSeen(ada.id, "prj_blocked", { seq: 0, at: "2026-01-01T00:00:00Z" });
  const held = (await readBadge(local.dir, first.base))!;
  expect(held).not.toBeNull();
  await refuseBeforeSweep(first, held.badgeId);
  const ordinary = await fetch(`${first.base}/api/projects/prj_blocked/canvas`, {
    headers: { ...mine.headers, Authorization: `Bearer ${formatBadgeToken(held.badgeId, held.secret)}` },
  });
  expect(ordinary.status).toBe(403);
  expect(await ordinary.json()).toMatchObject({ reason: "refused" });
  const mixed = await inbox(local.base, mine);
  expect(mixed.entries.map((entry) => entry.canvasId)).toEqual(["prj_available"]);
  expect(mixed.marks.prj_blocked).toBeUndefined();
  expect(mixed.unavailable.map((entry) => entry.canvasId)).toContain("prj_blocked");
  const scoped = await inbox(local.base, mine, "prj_blocked");
  expect(scoped.entries).toEqual([]);
  expect(scoped.marks).toEqual({});
  expect(JSON.stringify(scoped)).not.toContain("Synthetic comment for prj_blocked");
}, 20_000);


it("cancels a forwarded prior-read's home HTTP request when the client leaves and allows retry", async () => {
  const home = await node(); const local = await node();
  const mine = await mintTestBadge(local.base); await mine.speakAs(ada);
  const owner = await mintTestBadge(home.base); await owner.speakAs(bo);
  await op(home.base, owner, bo, null, { type: "project.create", canvasId: "prj_prior", title: "Acme prior" });
  expect((await request(local.base, mine, "POST", "/api/home/join", { canvasId: "prj_prior", home: home.base })).status).toBe(200);
  const deadline = Date.now() + 5000;
  while (!(await local.daemon.engine.listCanvases()).some((canvas) => canvas.id === "prj_prior")) {
    if (Date.now() > deadline) throw new Error("replica did not settle");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  // Claim through the normal forwarded read before holding only seen HTTP.
  await inbox(local.base, mine, "prj_prior");
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  let entered!: () => void;
  const started = new Promise<void>((resolve) => { entered = resolve; });
  let closed!: () => void;
  const disconnected = new Promise<void>((resolve) => { closed = resolve; });
  const observe = (req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse) => {
    if (req.url?.startsWith("/api/seen?")) res.once("close", closed);
  };
  home.daemon.app.server.on("request", observe);
  const original = home.daemon.desk.seenOf.bind(home.daemon.desk);
  const read = vi.spyOn(home.daemon.desk, "seenOf").mockImplementationOnce(async (actorId) => {
    entered();
    await held;
    return original(actorId);
  });
  try {
    const aborter = new AbortController();
    const response = fetch(local.base + seenMarksRoute(ada.id, "prj_prior"), { headers: mine.headers, signal: aborter.signal });
    const rejected = expect(response).rejects.toThrow();
    await started;
    aborter.abort();
    await rejected;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stopped = await Promise.race([
      disconnected.then(() => true),
      new Promise<boolean>((resolve) => { timer = setTimeout(() => resolve(false), 1000); }),
    ]).finally(() => clearTimeout(timer));
    expect(stopped, "disconnect must reach the actual home request, not only the replica socket").toBe(true);
    release();
    const retry = await request(local.base, mine, "GET", seenMarksRoute(ada.id, "prj_prior"));
    expect(retry.status).toBe(200);
    expect(await retry.json()).toEqual({ marks: {} });
  } finally {
    release(); read.mockRestore();
    home.daemon.app.server.off("request", observe);
  }
});
