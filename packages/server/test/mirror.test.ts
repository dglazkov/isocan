import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { createVerify, generateKeyPairSync } from "node:crypto";
import os from "node:os";
import path from "node:path";
import type { LogEntry, Operation } from "@isocan/core";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import {
  batchWrites,
  signAssertion,
  RemoteError,
  type Remote,
  type RemoteWrite,
} from "../src/remote.ts";
import { backoffMs, hashesInEntry, seqDocId } from "../src/mirror.ts";
import * as p from "../src/paths.ts";

/**
 * The daemon as the mirror's writer (#70).
 *
 * Everything that would leave the machine goes through `Remote`, so the whole
 * of backfill and tailing runs here against a Firestore that lives in a
 * variable — the same trick the provisioning dance's tests play on Google, and
 * for the same reason: the properties worth testing are not "does fetch work"
 * but "what does this do when the answer is no".
 *
 * What these tests are really about is the promise that mirroring cannot cost
 * you anything. A canvas whose remote is on fire must still be a canvas.
 */

const alice = { id: "usr_alice", name: "Alice" };

let home: string;
let daemon: Daemon;
let base: string;
let fake: FakeFirestore;
/** What the daemon narrated — captured rather than printed, so an outage a
 * test causes on purpose does not read like one the run suffered. */
let said: string[];

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-mirror-"));
  fake = fakeFirestore();
  said = [];
});

afterEach(async () => {
  await daemon?.close();
  await fs.rm(home, { recursive: true, force: true });
});

/* ── a Firestore that lives in a variable ───────────────────────────────── */

interface FakeFirestore extends Remote {
  /** Doc path → the fields written there. Last write wins, as Firestore's own
   * `update` does — which is what makes re-mirroring a seq harmless. */
  docs: Map<string, Record<string, unknown>>;
  blobs: Map<string, Buffer>;
  /** Every call in order, so "bytes before the doc that names them" is a thing
   * a test can actually assert rather than hope for. */
  calls: string[];
  /** While set, every call fails this way. */
  outage: { status: number; message: string } | null;
  /** Resolves the next time the mirror finishes a commit. */
  settled(): Promise<void>;
}

function fakeFirestore(): FakeFirestore {
  const waiters: Array<() => void> = [];
  const fake: FakeFirestore = {
    docs: new Map(),
    blobs: new Map(),
    calls: [],
    outage: null,
    async commit(writes: RemoteWrite[]) {
      if (fake.outage) throw new RemoteError(fake.outage.message, fake.outage.status);
      for (const write of writes) {
        fake.calls.push(`commit ${write.path}`);
        fake.docs.set(write.path, write.fields);
      }
      for (const waiter of waiters.splice(0)) waiter();
    },
    async upload(target, bytes) {
      if (fake.outage) throw new RemoteError(fake.outage.message, fake.outage.status);
      fake.calls.push(`upload ${target}`);
      fake.blobs.set(target, bytes);
    },
    // Not a real wait: a backoff that actually slept would make every outage
    // test a stopwatch. Order is what matters, and yielding preserves it.
    sleep: () => new Promise((resolve) => setImmediate(resolve)),
    settled: () => new Promise<void>((resolve) => waiters.push(resolve)),
  };
  return fake;
}

/** The record `isocan share` leaves behind: this home hosts these canvases. */
async function provisioned(options: { canvases: string[]; bucket?: string | null }): Promise<void> {
  await fs.mkdir(p.remotesDir(home), { recursive: true });
  await fs.writeFile(
    p.remoteFile(home, "isocan-test"),
    JSON.stringify({
      kind: "firestore",
      firebaseProject: "isocan-test",
      location: "nam5",
      done: { project: "now", hosting: "now" },
      keyFile: path.join(p.remotesDir(home), "isocan-test.key.json"),
      ...(options.bucket === null ? {} : { storageBucket: options.bucket ?? "isocan-test.firebasestorage.app" }),
      canvases: Object.fromEntries(options.canvases.map((id) => [id, { sharedAt: "now" }])),
    }),
  );
}

async function boot(): Promise<void> {
  daemon = await startDaemon({
    port: 0,
    home,
    remoteFor: async () => fake,
    notify: (message) => said.push(message),
  });
  const address = daemon.app.server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
}

async function post(url: string, body: unknown): Promise<{ status: number; json: any }> {
  const res = await fetch(`${base}${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

async function op(operation: Operation, projectId: string | null = "prj_1") {
  return post("/api/ops", { projectId, actor: alice, op: operation });
}

async function uploadBlob(content: string, filename: string): Promise<string> {
  const res = await fetch(`${base}/api/projects/prj_1/blobs`, {
    method: "POST",
    headers: { "Content-Type": "text/markdown", "X-Isocan-Filename": filename },
    body: content,
  });
  const { blobHash } = (await res.json()) as { blobHash: string };
  return blobHash;
}

/** A canvas with some history and one item made of real bytes. */
async function seed(): Promise<{ hash: string }> {
  await op({ type: "project.create", projectId: "prj_1", title: "P" }, null);
  const hash = await uploadBlob("# hello\n", "hello.md");
  await op({
    type: "item.add",
    itemId: "itm_1",
    version: { id: "ver_1", blobHash: hash, mimeType: "text/markdown", filename: "hello.md", size: 8 },
    width: 100,
    height: 100,
    placement: { x: 0, y: 0 },
  });
  await op({ type: "items.move", moves: [{ itemId: "itm_1", x: 40, y: 40 }] });
  return { hash };
}

/** Wait for the mirror to have nothing left to ship. `pending` is the same
 * promise `gc` waits on, so a test that uses it is testing the real thing. */
async function drained(projectId = "prj_1"): Promise<void> {
  await daemon.mirror.pending(projectId);
}

function entriesInMirror(projectId = "prj_1"): LogEntry[] {
  return [...fake.docs.entries()]
    .filter(([docPath]) => docPath.startsWith(`canvases/${projectId}/ops/`))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, fields]) => JSON.parse((fields.entry as { stringValue: string }).stringValue));
}

async function localLog(projectId = "prj_1"): Promise<LogEntry[]> {
  return daemon.engine.getLog(projectId, 0);
}

/* ── the tests ──────────────────────────────────────────────────────────── */

describe("backfill", () => {
  it("publishes the whole history and its blobs when a canvas is shared", async () => {
    await boot();
    const { hash } = await seed();
    // Shared AFTER the fact, which is the normal case: `isocan share` runs on a
    // canvas that already has a life behind it.
    await provisioned({ canvases: ["prj_1"] });
    await post("/api/projects/prj_1/mirror", {});
    await drained();

    const local = await localLog();
    expect(local).toHaveLength(3);
    expect(entriesInMirror()).toEqual(local);
    expect([...fake.blobs.keys()]).toEqual([`blobs/${hash}`]);
    expect(fake.blobs.get(`blobs/${hash}`)!.toString()).toBe("# hello\n");
  });

  it("names docs by a zero-padded seq, so string order is seq order", async () => {
    await boot();
    await provisioned({ canvases: ["prj_1"] });
    await seed();
    await post("/api/projects/prj_1/mirror", {});
    await drained();

    const ids = [...fake.docs.keys()].map((docPath) => docPath.split("/").pop()!);
    expect(ids).toContain("000000000001");
    expect([...ids].sort()).toEqual(ids.slice().sort());
    expect(seqDocId(42)).toBe("000000000042");
  });

  it("carries the stored inverse, not just the op — a guest's undo needs it", async () => {
    await boot();
    await provisioned({ canvases: ["prj_1"] });
    await seed();
    await post("/api/projects/prj_1/mirror", {});
    await drained();

    const move = entriesInMirror().find((entry) => entry.envelope.op.type === "items.move")!;
    expect(move.inverse).toEqual({ type: "items.move", moves: [{ itemId: "itm_1", x: 0, y: 0 }] });
  });

  it("adopts its canvases on startup, with no poke at all", async () => {
    await boot();
    await seed();
    await daemon.close();

    await provisioned({ canvases: ["prj_1"] });
    await boot();
    await drained();
    expect(entriesInMirror()).toHaveLength(3);
  });
});

describe("tailing", () => {
  it("an op made locally lands in the mirror without another poke", async () => {
    await boot();
    await provisioned({ canvases: ["prj_1"] });
    await seed();
    await post("/api/projects/prj_1/mirror", {});
    await drained();
    expect(entriesInMirror()).toHaveLength(3);

    const settled = fake.settled();
    await op({ type: "item.resize", itemId: "itm_1", width: 300, height: 200 });
    await settled;
    await drained();

    const mirrored = entriesInMirror();
    expect(mirrored).toHaveLength(4);
    expect(mirrored[3]!.envelope.op).toMatchObject({ type: "item.resize", width: 300 });
  });

  /**
   * The bug a real burst found, and no single-op test could.
   *
   * Most of the time the pump is not waiting for a wake — it is mid-drain, with
   * `wake` null. An op landing in that window had its wake dropped, and the
   * pass in flight could not carry it either, having decided what it owed by
   * reading the log before that op existed. The result was a mirror two ops
   * short of the truth, reporting itself caught up.
   */
  it("loses nothing to ops that land while it is mid-drain", async () => {
    await boot();
    await provisioned({ canvases: ["prj_1"] });
    await seed();
    await post("/api/projects/prj_1/mirror", {});
    await drained();

    // Land an op precisely INSIDE a commit — the window where `wake` is null
    // and the pass in flight has already decided what it owes. Doing it from
    // the commit hook makes the race deterministic instead of hoping a burst
    // hits it, which is what it took to notice this against real Firestore.
    const realCommit = fake.commit.bind(fake);
    let slipped = false;
    fake.commit = async (writes) => {
      await realCommit(writes);
      if (slipped) return;
      slipped = true;
      await op({ type: "items.move", moves: [{ itemId: "itm_1", x: 99, y: 99 }] });
    };

    const settled = fake.settled();
    await op({ type: "items.move", moves: [{ itemId: "itm_1", x: 1, y: 1 }] });
    await settled;
    await drained();

    const local = await localLog();
    expect(local).toHaveLength(5); // 3 seeded + the op + the one that slipped in
    // Both of these were false against real Firestore before the fix: the
    // mirror sat two entries short of the log and called itself caught up.
    expect(entriesInMirror()).toEqual(local);
    expect(daemon.mirror.status("prj_1")).toMatchObject({ mirroredSeq: 5, behind: false });
  });

  it("uploads the bytes before the document that names them", async () => {
    await boot();
    await provisioned({ canvases: ["prj_1"] });
    await seed();
    await post("/api/projects/prj_1/mirror", {});
    await drained();

    const hash = await uploadBlob("# second\n", "second.md");
    const settled = fake.settled();
    await op({
      type: "item.add",
      itemId: "itm_2",
      version: { id: "ver_2", blobHash: hash, mimeType: "text/markdown", filename: "second.md", size: 9 },
      width: 10,
      height: 10,
      placement: { x: 200, y: 0 },
    });
    await settled;
    await drained();

    // The guarantee: a guest who can see an item can always fetch it. The
    // mirror never advertises content it has not delivered.
    const upload = fake.calls.indexOf(`upload blobs/${hash}`);
    const commit = fake.calls.indexOf(`commit canvases/prj_1/ops/${seqDocId(4)}`);
    expect(upload).toBeGreaterThanOrEqual(0);
    expect(commit).toBeGreaterThan(upload);
  });
});

describe("behind is a state; broken is not", () => {
  it("an outage never blocks local work, and the backlog drains when it lifts", async () => {
    await boot();
    await provisioned({ canvases: ["prj_1"] });
    await seed();
    fake.outage = { status: 503, message: "Firestore is having a day" };
    await post("/api/projects/prj_1/mirror", {});

    // The canvas does not notice. Every one of these would hang if mirroring
    // were anywhere near the engine's single-writer chain.
    for (let i = 0; i < 5; i += 1) {
      const res = await op({ type: "items.move", moves: [{ itemId: "itm_1", x: i, y: i }] });
      expect(res.status).toBe(200);
    }
    expect(await localLog()).toHaveLength(8);
    expect(fake.docs.size).toBe(0);
    expect(daemon.mirror.status("prj_1")?.error).toMatch(/having a day/);

    // One piece of news, however many times it was retried: a mirror that
    // narrates every attempt of an hour-long outage is a log nobody reads twice.
    expect(said.filter((line) => line.includes("having a day"))).toHaveLength(1);

    fake.outage = null;
    await drained();
    expect(entriesInMirror()).toEqual(await localLog());
  });

  it("mirrors ops and says why blobs are missing when the project has no bucket", async () => {
    await boot();
    await provisioned({ canvases: ["prj_1"], bucket: null });
    await seed();
    const status = (await post("/api/projects/prj_1/mirror", {})).json;
    await drained();

    expect(entriesInMirror()).toHaveLength(3);
    expect(fake.blobs.size).toBe(0);
    expect(status.blobsUnavailable).toMatch(/Cloud Storage/);
  });

  /**
   * Firestore refuses a property over 1,048,487 bytes — learned by sending it
   * one, not from the docs. An entry that big is not exotic: a pasted essay of
   * a comment, or the inverse of a delete that took two thousand items with it.
   * Before the spill, one of them stopped a canvas mirroring forever.
   */
  it("puts an entry too big for a document into Storage, and keeps going", async () => {
    await boot();
    await provisioned({ canvases: ["prj_1"] });
    await seed();
    await post("/api/projects/prj_1/mirror", {});
    await drained();

    const settled = fake.settled();
    await op({
      type: "thread.create",
      threadId: "thr_big",
      x: 0,
      y: 0,
      anchorItemId: null,
      comment: { id: "cmt_big", body: "x".repeat(1_200_000) },
    });
    await settled;
    await drained();

    const doc = fake.docs.get(`canvases/prj_1/ops/${seqDocId(4)}`)!;
    // The document carries the address, not the entry — and the entry is where
    // the address says. `entry` or `entryPath`, never neither: that is the
    // contract #73's reader implements.
    expect(doc.entry).toBeUndefined();
    const at = (doc.entryPath as { stringValue: string }).stringValue;
    expect(at).toBe(`entries/${seqDocId(4)}.json`);
    const spilled = JSON.parse(fake.blobs.get(at)!.toString());
    expect(spilled).toEqual((await localLog())[3]);

    // And the canvas did not stop: the op after it is inline again.
    const after = fake.settled();
    await op({ type: "items.move", moves: [{ itemId: "itm_1", x: 7, y: 7 }] });
    await after;
    await drained();
    expect(fake.docs.get(`canvases/prj_1/ops/${seqDocId(5)}`)!.entry).toBeDefined();
    expect(daemon.mirror.status("prj_1")).toMatchObject({ behind: false, mirroredSeq: 5 });
  });

  it("with no bucket to spill into, says so — and says what fixes it", async () => {
    await boot();
    await provisioned({ canvases: ["prj_1"], bucket: null });
    await seed();
    await post("/api/projects/prj_1/mirror", {});
    await drained();

    await op({
      type: "thread.create",
      threadId: "thr_big",
      x: 0,
      y: 0,
      anchorItemId: null,
      comment: { id: "cmt_big", body: "x".repeat(1_200_000) },
    });
    await drained();

    const status = daemon.mirror.status("prj_1")!;
    expect(status.parked).toBe(true);
    expect(status.error).toMatch(/too big for a Firestore document/);
    expect(status.error).toMatch(/billing account/);
  });

  it("parks on a permanent refusal instead of retrying it forever", async () => {
    await boot();
    await provisioned({ canvases: ["prj_1"] });
    await seed();
    fake.outage = { status: 403, message: "that credential was revoked" };
    await post("/api/projects/prj_1/mirror", {});
    await drained();

    expect(fake.docs.size).toBe(0);
    expect(daemon.mirror.status("prj_1")?.error).toMatch(/revoked/);
    // Parked, not spinning: a revoked credential is not a thing patience fixes.
    const calls = fake.calls.length;
    await op({ type: "items.move", moves: [{ itemId: "itm_1", x: 9, y: 9 }] });
    await drained();
    expect(fake.calls.length).toBe(calls);

    // And parked is NOT idle. Saying "behind: false" here is how `isocan share`
    // reports "caught up" about a canvas that has stopped, and how `gc` gets
    // permission to sweep blobs that were never published.
    expect(daemon.mirror.status("prj_1")).toMatchObject({ parked: true, behind: true });
  });

  it("a poke retries a parked canvas — which is what its own message promises", async () => {
    await boot();
    await provisioned({ canvases: ["prj_1"] });
    await seed();
    fake.outage = { status: 403, message: "that credential was revoked" };
    await post("/api/projects/prj_1/mirror", {});
    await drained();
    expect(daemon.mirror.status("prj_1")?.parked).toBe(true);

    // "Fix it, then `isocan share` again" has to actually work, or it is worse
    // than saying nothing.
    fake.outage = null;
    await post("/api/projects/prj_1/mirror", {});
    await drained();
    expect(entriesInMirror()).toEqual(await localLog());
    expect(daemon.mirror.status("prj_1")?.behind).toBe(false);
    expect(daemon.mirror.status("prj_1")?.parked).toBeUndefined();
  });

  it("gives up on a canvas that has been deleted, rather than retrying it forever", async () => {
    await boot();
    await provisioned({ canvases: ["prj_1"] });
    await seed();
    await post("/api/projects/prj_1/mirror", {});
    await drained();
    await op({ type: "project.delete" });
    await daemon.close();

    // Deleting a canvas does not un-share it — the record still names it, and
    // tidying the remote is `unshare`'s job (#72) — so a restart meets a
    // project that is gone and must recognise it as gone.
    fake.calls.length = 0;
    await boot();
    await drained();
    expect(fake.calls).toEqual([]);
    expect(daemon.mirror.status("prj_1")?.error).toMatch(/project not found/);
  });

  it("a canvas this home does not host is never written anywhere", async () => {
    await boot();
    await seed(); // no record under ~/.isocan/remotes at all
    const res = await post("/api/projects/prj_1/mirror", {});
    await drained();

    expect(res.json).toEqual({ projectId: "prj_1", mirroring: false });
    expect(fake.docs.size).toBe(0);
  });
});

describe("restart loses nothing", () => {
  it("resumes from its cursor, and re-writes at most an identical document", async () => {
    await boot();
    await provisioned({ canvases: ["prj_1"] });
    await seed();
    await post("/api/projects/prj_1/mirror", {});
    await drained();

    // Die mid-stream: the ops made during the outage never reached Firestore.
    fake.outage = { status: 503, message: "down" };
    for (let i = 0; i < 4; i += 1) {
      await op({ type: "items.move", moves: [{ itemId: "itm_1", x: i, y: 0 }] });
    }
    await daemon.close();
    const before = new Map(fake.docs);

    fake.outage = null;
    await boot();
    await drained();

    expect(entriesInMirror()).toEqual(await localLog());
    // Nothing already published came back different — the doc id is the seq,
    // so the worst a crash can cost is writing the same bytes twice.
    for (const [docPath, fields] of before) {
      expect(fake.docs.get(docPath)).toEqual(fields);
    }
  });
});

describe("gc and the mirror", () => {
  it("waits for a canvas that is still catching up before it sweeps", async () => {
    await boot();
    await provisioned({ canvases: ["prj_1"] });
    await seed();
    // An orphan the sweep would take, and which the mirror has never seen.
    await uploadBlob("# orphan\n", "orphan.md");
    fake.outage = { status: 503, message: "still down" };
    await post("/api/projects/prj_1/mirror", {});

    let swept = false;
    const sweeping = post("/api/projects/prj_1/gc", { graceMs: 0 }).then((res) => {
      swept = true;
      return res;
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(swept).toBe(false); // held, because the mirror is behind

    fake.outage = null;
    const report = (await sweeping).json;
    expect(swept).toBe(true);
    expect(report.sweptBlobs).toBe(1);
    // And the mirror got everything it was owed before the sweep happened.
    expect(entriesInMirror()).toEqual(await localLog());
  });

  it("keeps the history the local log gives up — the mirror is a superset", async () => {
    await boot();
    await provisioned({ canvases: ["prj_1"] });
    await seed();
    for (let i = 0; i < 5; i += 1) {
      await op({ type: "items.move", moves: [{ itemId: "itm_1", x: i, y: 0 }] });
    }
    await post("/api/projects/prj_1/mirror", {});
    await drained();
    const published = entriesInMirror().length;

    await post("/api/projects/prj_1/gc", { keepOps: 2, graceMs: 0 });
    const local = await localLog();
    expect(local.length).toBeLessThan(published);
    // Compaction is a local economy. A guest's history does not shrink because
    // the host tidied up, and the mirror is never rewritten to match.
    expect(entriesInMirror()).toHaveLength(published);
  });
});

describe("the pieces that need no cloud at all", () => {
  it("finds the blobs an entry names in its op AND its inverse", () => {
    const version = {
      id: "v",
      blobHash: "abc",
      mimeType: "text/markdown",
      filename: "a.md",
      size: 1,
      createdAt: "now",
      createdBy: alice,
    };
    const entry: LogEntry = {
      seq: 1,
      envelope: {
        id: "op_1",
        projectId: "prj_1",
        actor: alice,
        ts: "now",
        op: {
          type: "item.removeVersion",
          itemId: "itm_1",
          versionId: "v",
          prevCurrentVersionId: "v0",
        },
      },
      // An undo of a version removal replays the version — and a guest walking
      // that inverse needs bytes the mirror was never asked for by any op.
      inverse: { type: "item.restoreVersion", itemId: "itm_1", version },
    };
    expect(hashesInEntry(entry)).toContain("abc");
  });

  it("cuts commits by bytes as well as by count", () => {
    const big = (i: number): RemoteWrite => ({
      path: `canvases/prj_1/ops/${seqDocId(i)}`,
      fields: { entry: { stringValue: "x".repeat(3 * 1024 * 1024) } },
    });
    const batches = batchWrites([big(1), big(2), big(3), big(4)]);
    expect(batches.length).toBeGreaterThan(1);
    expect(batches.flat()).toHaveLength(4);

    const many = Array.from({ length: 900 }, (_, i) => ({
      path: `canvases/prj_1/ops/${seqDocId(i)}`,
      fields: { entry: { stringValue: "small" } },
    }));
    expect(batchWrites(many).every((batch) => batch.length <= 400)).toBe(true);
    expect(batchWrites(many).flat()).toHaveLength(900);
  });

  it("backs off further each time, but never gives up on a minute", () => {
    expect(backoffMs(1)).toBeLessThan(backoffMs(2));
    expect(backoffMs(50)).toBe(60_000);
  });

  /**
   * The one piece here whose mistakes are otherwise invisible until a real
   * canvas is really shared: Google answers a malformed assertion with a 400
   * that does not say which field it disliked. So the assertion is checked
   * against the same public half Google would check it against.
   */
  it("signs an assertion Google's token endpoint would accept", () => {
    const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const key = {
      client_email: "isocan-host@isocan-test.iam.gserviceaccount.com",
      private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
      project_id: "isocan-test",
    };
    const assertion = signAssertion(key, 1_700_000_000);
    const [header, claims, signature] = assertion.split(".");

    expect(JSON.parse(Buffer.from(header!, "base64url").toString())).toEqual({
      alg: "RS256",
      typ: "JWT",
    });
    const payload = JSON.parse(Buffer.from(claims!, "base64url").toString());
    expect(payload).toMatchObject({
      iss: key.client_email,
      aud: "https://oauth2.googleapis.com/token",
      iat: 1_700_000_000,
      // An hour exactly — more is refused outright, not shortened.
      exp: 1_700_003_600,
    });
    // The two scopes the mirror spends, and no others: this credential writes
    // the mirror and publishes blobs, and is not able to do anything else.
    expect(payload.scope.split(" ").sort()).toEqual([
      "https://www.googleapis.com/auth/datastore",
      "https://www.googleapis.com/auth/devstorage.read_write",
    ]);

    const verified = createVerify("RSA-SHA256")
      .update(`${header}.${claims}`)
      .verify(publicKey, Buffer.from(signature!, "base64url"));
    expect(verified).toBe(true);
  });
});
