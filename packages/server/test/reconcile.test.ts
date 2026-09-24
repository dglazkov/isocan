import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createHash } from "node:crypto";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import * as pathsOf from "../src/paths.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

/**
 * **Bytes fall behind the ops that name them, and nothing used to notice.**
 *
 * A blob is not an Operation, so it does not replicate: `putBlob` pushes it to
 * the home by hand alongside the local copy. Anything that stops that push —
 * the routing table not yet read, a home down for the one second it mattered,
 * a process killed mid-upload — leaves the `item.addVersion` replicated and
 * the bytes behind it absent, permanently and in silence. A teammate opens the
 * canvas and sees the item, its title and its version number, with
 * "blob not found" where the screen should be.
 *
 * Reported exactly that way. Neither machine could answer the only question
 * that mattered — *are the bytes at the home?* — because a local read is
 * served from the local copy. So it was fixed by a hand re-upload and
 * confirmed by somebody else's reload, which is a guess that happened to work.
 * On the real canvas, `isocan blobs` then found twenty blobs still missing
 * AFTER that repair was believed to be done.
 */

const CANVAS = "prj_slides";
const bytes = (s: string) => Buffer.from(s, "utf8");

let homeDir: string;
let repDir: string;
let home: Daemon;
let replica: Daemon;
let repBadge: TestBadge;
let homeBadge: TestBadge;

const baseOf = (d: Daemon) => {
  const a = d.app.server.address();
  return `http://127.0.0.1:${typeof a === "object" && a ? a.port : 0}`;
};

beforeEach(async () => {
  homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-rc-home-"));
  repDir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-rc-rep-"));
  home = await startDaemon({ port: 0, home: homeDir });
  homeBadge = await mintTestBadge(baseOf(home));
  await homeBadge.speakAs({ id: "usr_home", name: "Home" });
  replica = await startDaemon({
    port: 0,
    home: repDir,
    birthHome: baseOf(home),
    homePollMs: 50,
  });
  repBadge = await mintTestBadge(baseOf(replica));
  await repBadge.speakAs({ id: "usr_dion", name: "Dion" });
  // Born THROUGH the replica, which is the real shape: a canvas made on a
  // laptop whose home is elsewhere. Creating it at the home instead would
  // leave the replica's badge unadmitted, and it would never see the canvas
  // at all — a different bug from the one under test.
  const made = await fetch(`${baseOf(replica)}/api/ops`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...repBadge.headers },
    body: JSON.stringify({
      canvasId: null,
      actor: { id: "usr_dion", name: "Dion" },
      op: { type: "project.create", canvasId: CANVAS, title: "Slides" },
    }),
  });
  expect(made.status, "the canvas has to exist to have blobs").toBe(200);
});

afterEach(async () => {
  await replica?.close();
  await home?.close();
  await Promise.allSettled(
    [homeDir, repDir].map((d) => fs.rm(d, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })),
  );
});

/** The replica has the canvas when its link has caught up. */
async function untilReplicated(): Promise<void> {
  for (let tries = 0; tries < 100; tries++) {
    const res = await fetch(`${baseOf(replica)}/api/projects/${CANVAS}/canvas`, {
      headers: repBadge.headers,
    });
    if (res.ok) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("the canvas never reached the replica");
}

const reconcile = async (push: boolean) => {
  const res = await fetch(`${baseOf(replica)}/api/projects/${CANVAS}/blobs/reconcile`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...repBadge.headers },
    body: JSON.stringify({ push }),
  });
  expect(res.status).toBe(200);
  return (await res.json()) as {
    home: string | null;
    checked: number;
    missing: string[];
    pushed: string[];
    unknown: string[];
  };
};

describe("do the bytes agree with the ops", () => {
  it("finds a blob the home never received, and sends it", async () => {
    await untilReplicated();
    // Divergence made the way it happens for real: bytes in the replica's own
    // store with no push to the home. `putBlob` on the ENGINE would push;
    // going to the store directly is what a skipped push leaves behind.
    const { blobHash } = await replica.store.putBlob(CANVAS, bytes("<h1>slide 1</h1>"), {
      mimeType: "text/html",
      filename: "01-title.html",
    });

    const before = await reconcile(false);
    expect(before.home).toBe(baseOf(home));
    expect(before.missing, "the home never got these bytes").toContain(blobHash);
    expect(before.pushed, "a read must not write").toEqual([]);

    const repair = await reconcile(true);
    expect(repair.pushed).toContain(blobHash);

    // The home can now serve them, which is the whole point: this is what a
    // teammate's reload actually asks for.
    const at = await fetch(`${baseOf(home)}/api/projects/${CANVAS}/blobs/${blobHash}`, {
      headers: homeBadge.headers,
    });
    expect(at.status).toBe(200);
    expect(await at.text()).toBe("<h1>slide 1</h1>");

    const after = await reconcile(false);
    expect(after.missing, "and it stays fixed").toEqual([]);
  });

  it("says nothing is wrong when the bytes did travel", async () => {
    await untilReplicated();
    // The ordinary path: the engine pushes to the home and keeps a copy, so
    // there is nothing to repair and the report must not invent work.
    await replica.engine.putBlob(CANVAS, bytes("<h1>fine</h1>"), {
      mimeType: "text/html",
      filename: "ok.html",
    });
    const report = await reconcile(false);
    expect(report.checked).toBeGreaterThan(0);
    expect(report.missing).toEqual([]);
    expect(report.unknown).toEqual([]);
  });

  it("reports nothing to reconcile for a canvas that lives here", async () => {
    // At its own home there is no second copy to disagree with, and saying
    // "0 missing" would imply a check that never happened.
    const res = await fetch(`${baseOf(home)}/api/projects/${CANVAS}/blobs/reconcile`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...homeBadge.headers },
      body: JSON.stringify({ push: false }),
    });
    const report = (await res.json()) as { home: string | null; checked: number };
    expect(report.home).toBe(null);
    expect(report.checked).toBe(0);
  });

  it("never pushes a blob it could not ask about", async () => {
    await untilReplicated();
    // "I could not reach the home" is not "the home does not have it", and
    // only one of those means upload. Conflating them means a home that had a
    // bad minute gets every blob on the canvas thrown at it the moment it
    // answers again — and, worse, a report that says bytes are missing when
    // nobody has established any such thing.
    await replica.store.putBlob(CANVAS, bytes("<h1>unknowable</h1>"), {
      mimeType: "text/html",
      filename: "x.html",
    });
    await home.close(); // the home is gone; nothing can be established
    const report = await reconcile(true);
    expect(report.unknown.length, "an unreachable home yields unknowns").toBeGreaterThan(0);
    expect(report.missing, "unreachable is not missing").toEqual([]);
    expect(report.pushed, "and unreachable is never pushed").toEqual([]);
  });
});

/**
 * **And now nobody has to think to ask.**
 *
 * `reconcileBlobs` could always find bytes that had fallen behind. What it
 * could not do is ask on its own: it ran when a person typed `isocan blobs`,
 * which means it ran only after somebody had already been shown a broken
 * screen. That is a repair, not resilience.
 *
 * It happened again the night before a talk — two slides, on two canvases,
 * written in the three minutes before the home restarted for a deploy. The
 * bytes were on the laptop the whole time; nothing was lost. It simply needed
 * somebody to think to ask.
 */
describe("the replica checks its own bytes on a clock", () => {
  it("sends a blob the home never got, without anybody asking", async () => {
    await untilReplicated();
    // The divergence a skipped push leaves: bytes in the replica's store that
    // the home was never told about.
    const { blobHash } = await replica.store.putBlob(CANVAS, bytes("<h1>lost slide</h1>"), {
      mimeType: "text/html",
      filename: "07-lost.html",
    });
    const homeHas = async () =>
      (await home.store.listBlobs(CANVAS)).some((b) => b.hash === blobHash);
    expect(await homeHas(), "the home must start without these bytes").toBe(false);

    // A second replica over the SAME home directory, with the keeper on a
    // millisecond clock — the daemon under test is the one that boots and
    // finds bytes behind, which is exactly the shape that produced the report.
    await replica.close();
    const keeper = await startDaemon({
      port: 0,
      home: repDir,
      birthHome: baseOf(home),
      homePollMs: 50,
      blobCheckIntervalMs: 50,
      blobCheckFirstMs: 10,
    });
    try {
      let landed = false;
      for (let tries = 0; tries < 200 && !landed; tries++) {
        landed = await homeHas();
        if (!landed) await new Promise((r) => setTimeout(r, 25));
      }
      expect(landed, "the keeper never sent the blob the home was missing").toBe(true);
    } finally {
      await keeper.close();
      // The suite's afterEach closes `replica`; it is already down.
      replica = keeper;
    }
  });
});

/**
 * **The check must not hold the machine's writes hostage.**
 *
 * `reconcileBlobs` used to run whole on the engine's single-writer chain, so
 * one HEAD per blob held every write on the daemon — every canvas, every
 * home. The blob keeper runs it for every replica canvas every ten minutes,
 * and on a laptop replicating ~2,600 blobs from isocan.io that was minutes of
 * `isocan set` and `wire link` sitting silent behind a sweep they had nothing
 * to do with. The home's answer is held open here, which is a slow home made
 * exact: a write has to land while the question is still unanswered.
 */
describe("a slow home does not stall the writer", () => {
  it("lands a write while the check is still waiting on the home", async () => {
    await untilReplicated();
    await replica.store.putBlob(CANVAS, bytes("<h1>slow</h1>"), {
      mimeType: "text/html",
      filename: "slow.html",
    });
    expect(replica.homes.for(CANVAS), "the canvas must be a replica here").not.toBeNull();
    // Held at the HOME, so the test does not care how the replica asks.
    const { asked, release } = tapHome(home).holdBlobs();
    const check = replica.engine.reconcileBlobs(CANVAS, { push: false });
    await asked;

    const write = fetch(`${baseOf(replica)}/api/ops`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...repBadge.headers },
      body: JSON.stringify({
        canvasId: CANVAS,
        actor: { id: "usr_dion", name: "Dion" },
        op: { type: "project.update", patch: { title: "Slides, renamed" } },
      }),
    }).then((res) => res.status);
    const outcome = await Promise.race([
      write,
      new Promise<"stalled">((r) => setTimeout(() => r("stalled"), 3000)),
    ]);
    release();
    await check;
    expect(outcome, "the write waited on the blob check's round trip to the home").toBe(200);
  });
});

/**
 * **What the home hears, and a way to make it an older, a sicker or a slower
 * home.**
 *
 * Wraps the home's own `request` listener, so every request is counted on the
 * home — the side the meter is on — and none is answered differently unless
 * asked: `old` renames the batch route to a path no home serves, so the REAL
 * door and not-found handler answer exactly as a home that predates the route
 * does; `sick` answers every blob request 503 before the home sees it; and
 * `holdBlobs` keeps every blob request waiting until released.
 */
function tapHome(d: Daemon, mode: "current" | "old" | "sick" = "current") {
  const server = d.app.server;
  const inner = server.listeners("request") as Array<(req: IncomingMessage, res: ServerResponse) => void>;
  server.removeAllListeners("request");
  const heard: string[] = [];
  let hold: { gate: Promise<void>; asked: () => void } | null = null;
  server.on("request", (req: IncomingMessage, res: ServerResponse) => {
    heard.push(`${req.method} ${req.url}`);
    if (mode === "sick" && req.url?.includes("/blobs")) {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "the home is having a bad minute" }));
      return;
    }
    if (mode === "old" && req.url?.endsWith("/blobs/present")) req.url = req.url.replace(/\/blobs\/present$/, "/blobs/predates");
    const pass = () => { for (const listener of inner) listener.call(server, req, res); };
    if (hold && req.url?.includes("/blobs")) {
      // Paused so the body waits in the socket, not in a stream nobody reads.
      req.pause();
      hold.asked();
      void hold.gate.then(pass);
      return;
    }
    pass();
  });
  return {
    /** Requests about this canvas's bytes — HEADs, batch asks, uploads. */
    blobAsks: () => heard.filter((line) => line.includes(`/api/projects/${CANVAS}/blobs`)),
    reset: () => void heard.splice(0),
    holdBlobs: () => {
      let release!: () => void;
      let asked!: () => void;
      const gate = new Promise<void>((r) => (release = r));
      const askedOnce = new Promise<void>((r) => (asked = r));
      hold = { gate, asked };
      return { asked: askedOnce, release: () => { hold = null; release(); } };
    },
  };
}

/**
 * The same bytes `store.putBlob` would leave, written in one index rewrite
 * rather than one per blob — a thousand-blob canvas through `putBlob` is a
 * thousand rewrites of a growing `blobs.json`, which is most of a minute.
 */
async function seedBlobs(dir: string, seeded: ReturnType<typeof files>): Promise<void> {
  const blobs = pathsOf.blobsDir(dir, CANVAS);
  await fs.mkdir(blobs, { recursive: true });
  const indexFile = pathsOf.blobsIndexFile(dir, CANVAS);
  const index = JSON.parse(await fs.readFile(indexFile, "utf8").catch(() => "{}")) as Record<string, unknown>;
  for (const f of seeded) {
    const hash = createHash("sha256").update(f.data).digest("hex");
    await fs.writeFile(path.join(blobs, `${hash}.html`), f.data);
    index[hash] = { file: `${hash}.html`, mimeType: f.meta.mimeType, filename: f.meta.filename, size: f.data.length };
  }
  await fs.writeFile(indexFile, JSON.stringify(index));
}

/** `n` distinct little files. */
const files = (n: number, tag: string) =>
  Array.from({ length: n }, (_, i) => ({
    data: bytes(`<p>${tag} ${i}</p>`),
    meta: { mimeType: "text/html", filename: `${tag}-${i}.html` },
  }));

/**
 * **A sweep is a handful of requests, not one per blob.**
 *
 * One HEAD per blob per replica canvas every ten minutes was ~2,550 requests
 * a sweep from one laptop replicating isocan.io canvases, at a door metered by
 * address — whose symptom when tripped is a silent 401. These count what the
 * HOME hears.
 */
describe("a sweep asks the home in a handful of requests", () => {
  it("asks about 1,100 blobs in two requests, and finds the few it lacks", async () => {
    await untilReplicated();
    const both = files(1_097, "both");
    await seedBlobs(homeDir, both);
    await seedBlobs(repDir, both);
    const lost: string[] = [];
    for (const f of files(3, "lost")) lost.push((await replica.store.putBlob(CANVAS, f.data, f.meta)).blobHash);
    const tap = tapHome(home);

    const report = await replica.engine.reconcileBlobs(CANVAS, { push: false });
    expect(report.checked).toBe(1_100);
    expect(report.missing.sort()).toEqual([...lost].sort());
    expect(report.unknown).toEqual([]);
    expect(tap.blobAsks(), "one request per thousand hashes, not one per blob").toHaveLength(2);

    tap.reset();
    const repair = await replica.engine.reconcileBlobs(CANVAS, { push: true });
    expect(repair.pushed.sort()).toEqual([...lost].sort());
    // Two asks and the three uploads the repair is for — nothing per blob.
    expect(tap.blobAsks()).toHaveLength(2 + 3);
  }, 60_000);

  it("asks on the keeper's clock only about blobs new since the home said yes", async () => {
    await untilReplicated();
    for (const f of files(40, "old-news")) await replica.engine.putBlob(CANVAS, f.data, f.meta);
    const tap = tapHome(home);
    // A person's `isocan blobs` asks about everything, every time.
    const asked = await replica.engine.reconcileBlobs(CANVAS, { push: false });
    expect(asked.missing).toEqual([]);
    expect(tap.blobAsks()).toHaveLength(1);
    tap.reset();
    const quiet = await replica.engine.reconcileBlobs(CANVAS, { push: true, trustConfirmed: true });
    expect(quiet.checked).toBe(40);
    expect(tap.blobAsks(), "a quiet canvas costs its home nothing").toEqual([]);
  });
});

describe("a home older than the batch route", () => {
  it("is asked one HEAD per blob once, and then only about what is new", async () => {
    await untilReplicated();
    for (const f of files(38, "shared")) {
      await home.store.putBlob(CANVAS, f.data, f.meta);
      await replica.store.putBlob(CANVAS, f.data, f.meta);
    }
    const lost: string[] = [];
    for (const f of files(2, "behind")) lost.push((await replica.store.putBlob(CANVAS, f.data, f.meta)).blobHash);
    const tap = tapHome(home, "old");

    const first = await replica.engine.reconcileBlobs(CANVAS, { push: false, trustConfirmed: true });
    expect(first.missing.sort(), "the HEADs still find what is behind").toEqual([...lost].sort());
    expect(first.unknown).toEqual([]);
    const asks = tap.blobAsks();
    expect(asks.filter((line) => line.startsWith("POST")), "the batch was tried, once").toHaveLength(1);
    expect(asks.filter((line) => line.startsWith("HEAD"))).toHaveLength(40);

    tap.reset();
    const second = await replica.engine.reconcileBlobs(CANVAS, { push: true, trustConfirmed: true });
    expect(second.pushed.sort()).toEqual([...lost].sort());
    // No second try of a route the home has just said it lacks, and no HEAD
    // for the 38 it said yes to: two HEADs, and the two uploads.
    const again = tap.blobAsks();
    expect(again.filter((line) => line.startsWith("POST") && line.endsWith("/present"))).toEqual([]);
    expect(again.filter((line) => line.startsWith("HEAD"))).toHaveLength(2);
  });
});

describe("a home that cannot answer", () => {
  it("is sent nothing, and is not asked blob by blob", async () => {
    await untilReplicated();
    for (const f of files(30, "stranded")) await replica.store.putBlob(CANVAS, f.data, f.meta);
    const tap = tapHome(home, "sick");
    const report = await replica.engine.reconcileBlobs(CANVAS, { push: true, trustConfirmed: true });
    expect(report.unknown, "a 503 is 'I could not ask'").toHaveLength(30);
    expect(report.missing).toEqual([]);
    expect(report.pushed, "and 'I could not ask' is never answered by uploading").toEqual([]);
    const uploads = tap.blobAsks().filter((line) => line.startsWith("POST") && !line.endsWith("/present"));
    expect(uploads, "no upload reached it").toEqual([]);
    expect(tap.blobAsks().length, "one ask, not thirty").toBeLessThanOrEqual(2);
  });
});

/**
 * **The batch is the HEAD's question, behind the HEAD's gate** — not one notch
 * wider (a stranger learning which hashes a canvas holds) and not one narrower
 * (a view-only member, who may send the HEAD, refused the POST by the hook
 * that refuses every other non-GET below `edit`).
 */
describe("the batch route has the blob HEAD's gate", () => {
  it("refuses whom the HEAD refuses, and answers whom it answers", async () => {
    await untilReplicated();
    const { blobHash } = await home.store.putBlob(CANVAS, bytes("<p>gated</p>"), { mimeType: "text/html", filename: "g.html" });
    const absent = "0".repeat(64);
    const base = baseOf(home);
    const head = (headers: Record<string, string>) =>
      fetch(`${base}/api/projects/${CANVAS}/blobs/${blobHash}`, { method: "HEAD", headers }).then((r) => r.status);
    const ask = (headers: Record<string, string>, hashes: unknown = [blobHash, absent]) =>
      fetch(`${base}/api/projects/${CANVAS}/blobs/present`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ hashes }),
      });
    for (const grant of await home.desk.grantsFor(CANVAS)) {
      await home.desk.revokeGrant(grant.id, new Date().toISOString(), homeBadge.badgeId);
    }

    expect(await head({})).toBe(401);
    expect((await ask({})).status).toBe(401);
    const stranger = await mintTestBadge(base);
    expect(await head(stranger.headers)).toBe(403);
    const refused = await ask(stranger.headers);
    expect(refused.status).toBe(403);
    expect(await refused.json()).toMatchObject({ code: "not-admitted" });

    await home.desk.putGrant({
      id: "gnt_rc_view",
      canvasId: CANVAS,
      subject: "link",
      capability: "view",
      grantedBy: homeBadge.badgeId,
      at: new Date().toISOString(),
    });
    const viewer = await mintTestBadge(base);
    expect(await head(viewer.headers)).toBe(200);
    const answered = await ask(viewer.headers);
    expect(answered.status, "a viewer may ask what it may HEAD").toBe(200);
    expect(await answered.json()).toEqual({ missing: [absent] });
    expect((await ask(viewer.headers, ["not-a-hash"])).status).toBe(400);
  });
});
