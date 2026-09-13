import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createSign, generateKeyPairSync } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  NOT_ADMITTED,
  OPERATOR_PROOF_HEADER,
  TAKEDOWNS_ROUTE,
  TAKEN_DOWN,
  canvasesRoute,
  takedownSentence,
  type Canvas,
  type LogEntry,
  type OperatorAct,
  type OperatorLogResponse,
  type OperatorPurgeResponse,
  type OperatorShowResponse,
  type OperatorTakedownResponse,
  type TakedownsResponse,
} from "@isocan/core";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import * as p from "../src/paths.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

/**
 * **Purge: the bytes** — operator phase 3, walked against a real daemon with a
 * real file store and a real desk. Journey 6, and the two Open entries phase 2
 * left for this phase.
 *
 * The load-bearing distinctions, each of which is an assertion below:
 *
 * - **Refused unless taken down**, at the route with journey 6's sentence,
 *   and the refusal is in the ledger. A purge is the second of two deliberate
 *   acts and cannot be the first.
 * - **The bytes are gone and the tombstone stays**: the directory holds only
 *   `project.json` and the two marks; `canvasExists` is still true; `adopt`
 *   of the same id is refused; `project.create` under it is `duplicate-id`.
 * - **Nothing lifts it**: `--lift` is refused with `purged`; a second purge
 *   is refused with `already-purged`; both survive a restart.
 * - **`show` says something true afterwards** (phase 2's second Open entry):
 *   the title and the maker from the tombstone, the counts from the row.
 * - **The owner's delete stays refused with the sentence** (phase 2's first
 *   Open entry): before and after the purge, and never *not found*.
 * - **The output's four horizons**: on a file home, one — the members'
 *   replicas — because a disk keeps nothing behind it. The other three are
 *   the cloud backing's and are asserted in `packages/cloudstore/test`.
 *
 * The tokens are signed with a key pair this file generated, as
 * `takedown.test.ts` does. Everything downstream of the signature is the
 * production path.
 */

const PROJECT = "isocan-io-dev";
const auth = { project: PROJECT, apiKey: "browser-key-not-a-secret" };
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const keys = { kid_1: publicKey.export({ type: "spki", format: "pem" }) as string };

const OLU = "olu@example.test";

let home: string;
let daemon: Daemon;
let base: string;
let owner: TestBadge;
let desk: TestBadge;
let member: TestBadge;
let canvasId: string;

async function boot() {
  daemon = await startDaemon({
    port: 0,
    home,
    birthHome: null,
    auth,
    operators: [`email:${OLU}`],
    signingKeys: async () => keys,
  });
  const address = daemon.app.server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  owner = await mintTestBadge(base);
  await owner.speakAs({ id: "usr_priya", name: "Priya" });
  desk = await mintTestBadge(base);
  member = await mintTestBadge(base);
  await member.speakAs({ id: "usr_jordan", name: "Jordan" });
}

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-purge-"));
  await boot();
  canvasId = await makeCanvas("prj_reported1", "Acme quarterly");
});

afterEach(async () => {
  await daemon?.close();
  daemon = undefined as unknown as Daemon;
  await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

function idToken(email: string): string {
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: "RS256", kid: "kid_1", typ: "JWT" });
  const body = b64({
    iss: `https://securetoken.google.com/${PROJECT}`,
    aud: PROJECT,
    sub: `uid_${email}`,
    iat: now - 60,
    exp: now + 3600,
    email,
    email_verified: true,
    auth_time: now,
  });
  const signer = createSign("RSA-SHA256");
  signer.update(`${head}.${body}`);
  return `${head}.${body}.${signer.sign(privateKey).toString("base64url")}`;
}

const b64 = (value: unknown): string => Buffer.from(JSON.stringify(value)).toString("base64url");

async function operate(route: string, body?: unknown): Promise<Response> {
  return fetch(`${base}${route}`, {
    ...(body === undefined ? {} : { method: "POST", body: JSON.stringify(body) }),
    headers: {
      ...desk.headers,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      [OPERATOR_PROOF_HEADER]: idToken(OLU),
    },
  });
}

async function makeCanvas(id: string, title: string): Promise<string> {
  const res = await fetch(`${base}/api/ops`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...owner.headers },
    body: JSON.stringify({
      canvasId: null,
      actor: { id: "usr_priya", name: "Priya" },
      op: { type: "project.create", canvasId: id, title },
    }),
  });
  if (!res.ok) throw new Error(`could not make a canvas: ${await res.text()}`);
  return id;
}

/** A blob on the canvas, so there are bytes to erase and count. */
async function attachEvidence(): Promise<void> {
  const res = await fetch(`${base}/api/projects/${canvasId}/blobs`, {
    method: "POST",
    headers: {
      ...owner.headers,
      "Content-Type": "text/plain",
      "X-Isocan-Filename": "evidence.txt",
    },
    body: "eight by",
  });
  if (!res.ok) throw new Error(`could not attach a blob: ${await res.text()}`);
}

async function takedown(): Promise<OperatorTakedownResponse> {
  const res = await operate(`/api/operator/canvases/${canvasId}/takedown`, {
    reason: "illegal-content",
    note: "kai, 12 Sep",
  });
  if (!res.ok) throw new Error(`takedown refused: ${await res.text()}`);
  return (await res.json()) as OperatorTakedownResponse;
}

async function purge(): Promise<OperatorPurgeResponse> {
  const res = await operate(`/api/operator/canvases/${canvasId}/purge`, { force: true });
  if (!res.ok) throw new Error(`purge refused: ${await res.text()}`);
  return (await res.json()) as OperatorPurgeResponse;
}

const ledger = async (): Promise<OperatorAct[]> =>
  ((await (await operate("/api/operator/log")).json()) as OperatorLogResponse).acts;

const canvasDirListing = async (): Promise<string[]> =>
  (await fs.readdir(p.canvasDir(home, canvasId))).sort();

// ---------------------------------------------------------------------------

describe("the second of two deliberate acts", () => {
  it("is refused on a canvas that is not taken down, with journey 6's sentence — and the refusal is in the ledger", async () => {
    await attachEvidence();
    const res = await operate(`/api/operator/canvases/${canvasId}/purge`, { force: true });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string; code: string };
    expect(body.code).toBe("not-taken-down");
    expect(body.error).toMatch(/purge erases; take prj_reported1 down first/);
    expect(body.error).toMatch(/second of two deliberate acts/);
    // Nothing happened to the bytes.
    expect(await daemon.store.load(canvasId)).not.toBeNull();
    expect(await daemon.store.listBlobs(canvasId)).toHaveLength(1);
    expect(await daemon.store.purgedAt(canvasId)).toBeNull();
    // Somebody asked this home to erase something: that is a row.
    const rows = await ledger();
    const refused = rows.find((row) => row.act === "purge")!;
    expect(refused.outcome).toBe("not-taken-down");
    expect(refused.target).toBe(canvasId);
  });

  it("is refused without `force`, even on a canvas that is down", async () => {
    await takedown();
    const res = await operate(`/api/operator/canvases/${canvasId}/purge`, {});
    expect(res.status).toBe(400);
    expect(((await res.json()) as { code: string }).code).toBe("no-force");
    expect(await daemon.store.purgedAt(canvasId)).toBeNull();
    expect((await ledger()).some((row) => row.act === "purge" && row.outcome === "no-force")).toBe(true);
  });

  it("refuses without a proof, like every other operator act — the same path, not a second one", async () => {
    await takedown();
    const res = await fetch(`${base}/api/operator/canvases/${canvasId}/purge`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...desk.headers },
      body: JSON.stringify({ force: true }),
    });
    expect(res.status).toBe(403);
    expect(((await res.json()) as { code: string }).code).toBe("no-operator-proof");
    expect(await daemon.store.purgedAt(canvasId)).toBeNull();
  });
});

// ---------------------------------------------------------------------------

describe("the bytes are gone and the id stays taken", () => {
  it("erases the files and the log, counts them, and leaves the tombstone", async () => {
    await attachEvidence();
    const down = await takedown();
    expect(down.reach.files).toBe(1);

    const answer = await purge();
    expect(answer.erased.files).toBe(1);
    expect(answer.erased.bytes).toBe(8);
    // project.create plus the blob is not an op; what is in the log is what
    // the owner did: one create.
    expect(answer.erased.ops).toBe(1);
    expect(answer.erased.objects).toBeGreaterThanOrEqual(3);
    expect(answer.takedown.purgedAt).toBeDefined();
    expect(answer.takedown.purged).toEqual(answer.erased);
    expect(answer.takedown.reason, "the takedown's record rides on").toBe("illegal-content");

    // The directory holds the tombstone and the two marks, nothing else.
    expect(await canvasDirListing()).toEqual(["project.json", "purged.json", "takendown.json"]);
    expect(await fs.readdir(path.join(home, "deleted-projects")).catch(() => [])).toEqual([]);
    expect(await daemon.store.load(canvasId)).toBeNull();
    expect(await daemon.store.listBlobs(canvasId)).toEqual([]);
    expect(await daemon.store.canvasExists(canvasId)).toBe(true);
    await expect(daemon.engine.getSnapshot(canvasId)).rejects.toThrow();
  });

  it("prints the four horizons — on a file home, the one every home has", async () => {
    await takedown();
    const answer = await purge();
    // A disk keeps nothing behind it: no bucket, no rewind, no export. What
    // is left to say is the one thing true of every backing.
    expect(answer.survives.map((h) => h.kind)).toEqual(["replicas"]);
    expect(answer.survives[0]!.days).toBeNull();
    expect(answer.survives[0]!.sentence).toMatch(/members' machines are theirs/);
    expect(answer.survives[0]!.sentence).toMatch(/none was relaying/);
    // And the ledger row holds what the verb printed.
    const row = (await ledger()).find((act) => act.act === "purge" && act.outcome === "done")!;
    expect(row.target).toBe(canvasId);
    expect((row.reach as { survives: { kind: string }[] }).survives.map((h) => h.kind)).toEqual(["replicas"]);
    expect((row.reach as { erased: { ops: number } }).erased.ops).toBe(1);
  });

  it("refuses `adopt` of the same id, and a create under it, forever", async () => {
    await takedown();
    await purge();
    // A teleport in, or a restored backup: creates, never merges, and this id
    // is taken by a tombstone.
    const entries: LogEntry[] = [
      {
        seq: 1,
        envelope: {
          id: "op_x",
          canvasId: null,
          actor: { id: "usr_priya", name: "Priya" },
          ts: "2026-09-01T00:00:00.000Z",
          op: { type: "project.create", canvasId, title: "Acme, again" },
        },
        inverse: null,
      },
    ];
    // Two layers refuse it, and both are asserted. The ROUTE is canvas-scoped,
    // so the door meets the takedown first and answers with the sentence —
    // *this was removed, and here is who to ask*, even to a teleport. Under
    // that, the ENGINE's own check — `canvasExists`, true for a tombstone —
    // refuses the adoption on its own, which is the layer that holds if the
    // registry were ever bypassed.
    const adopted = await fetch(`${base}/api/projects/${canvasId}/adopt`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...owner.headers },
      body: JSON.stringify({ entries }),
    });
    expect(adopted.status).toBe(403);
    const body = (await adopted.json()) as { error: string; reason: string };
    expect(body.reason).toBe(TAKEN_DOWN);
    expect(body.error).toMatch(/taken down by the operator/);
    await expect(daemon.engine.adopt(canvasId, entries)).rejects.toThrow(/already here/);
    expect(await canvasDirListing(), "and neither wrote anything").toEqual(["project.json", "purged.json", "takendown.json"]);

    const created = await fetch(`${base}/api/ops`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...owner.headers },
      body: JSON.stringify({
        canvasId: null,
        actor: { id: "usr_priya", name: "Priya" },
        op: { type: "project.create", canvasId, title: "Acme, a third time" },
      }),
    });
    expect(created.ok).toBe(false);
    expect(((await created.json()) as { code: string }).code).toBe("duplicate-id");
  });

  it("cannot be lifted, cannot be purged twice, and both survive a restart", async () => {
    await takedown();
    await purge();

    const lift = await operate(`/api/operator/canvases/${canvasId}/takedown`, { lift: true });
    expect(lift.status).toBe(409);
    const lifted = (await lift.json()) as { code: string; error: string };
    expect(lifted.code).toBe("purged");
    expect(lifted.error).toMatch(/nothing under the id to bring back/);
    expect(await daemon.store.takenDownAt(canvasId), "the flag was not cleared").not.toBeNull();

    const again = await operate(`/api/operator/canvases/${canvasId}/purge`, { force: true });
    expect(again.status).toBe(409);
    expect(((await again.json()) as { code: string }).code).toBe("already-purged");

    await daemon.close();
    await boot();
    const afterBoot = await operate(`/api/operator/canvases/${canvasId}/takedown`, { lift: true });
    expect(afterBoot.status).toBe(409);
    expect(((await afterBoot.json()) as { code: string }).code).toBe("purged");
    expect(await daemon.store.purgedAt(canvasId)).not.toBeNull();
    // And the home still refuses the canvas with the sentence, not a 404.
    const res = await fetch(`${base}/api/projects/${canvasId}/canvas`, { headers: member.headers });
    expect(res.status).toBe(403);
    expect(((await res.json()) as { reason: string }).reason).toBe(TAKEN_DOWN);
  });

  it("`show` says something true afterwards: the tombstone's title and maker, and the counts", async () => {
    // Phase 2's second Open entry. `reachOf` falls back to the store's record
    // when the snapshot cannot load, and on the file backing that record is
    // `project.json` — which a purge keeps precisely so this read can answer.
    await attachEvidence();
    await takedown();
    await purge();
    const res = await operate(`/api/operator/canvases/${canvasId}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as OperatorShowResponse;
    expect(body.reach.title).toBe("Acme quarterly");
    expect(body.reach.madeBy.name).toBe("Priya");
    expect(body.reach.files, "nothing under it now").toBe(0);
    expect(body.reach.bytes).toBe(0);
    expect(body.takedown!.purgedAt).toBeDefined();
    expect(body.takedown!.purged!.files).toBe(1);
    expect(body.takedown!.purged!.bytes).toBe(8);
    expect(body.takedown!.note, "the operator still reads his note").toBe("kai, 12 Sep");
  });
});

// ---------------------------------------------------------------------------

describe("what the people on it meet", () => {
  it("the owner's delete is refused with the sentence before AND after the purge — never `not found`", async () => {
    // Phase 2's first Open entry, answered: she stays refused. A delete is an
    // op appended to a log this home has closed, and after a purge there is no
    // log; and a delete that went through would broadcast `canvas-deleted`,
    // erasing her members' replicas — the one reach a takedown withholds from
    // the operator, and not one to hand the owner through a canvas the
    // operator closed. Her own copies are hers.
    const { takedown: row } = await takedown();
    const attempt = () =>
      fetch(`${base}/api/ops`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...owner.headers },
        body: JSON.stringify({
          canvasId,
          actor: { id: "usr_priya", name: "Priya" },
          op: { type: "project.delete" },
        }),
      });
    for (const when of ["before", "after"]) {
      if (when === "after") await purge();
      const res = await attempt();
      expect(res.status, when).toBe(403);
      const body = (await res.json()) as { error: string; code: string; reason: string };
      expect(body.code, when).toBe(NOT_ADMITTED);
      expect(body.reason, when).toBe(TAKEN_DOWN);
      expect(body.error, when).toBe(takedownSentence(row));
      expect(body.error, when).not.toMatch(/not found/);
    }
    // And no delete landed: the directory is the tombstone and the marks.
    expect(await canvasDirListing()).toEqual(["project.json", "purged.json", "takendown.json"]);
  });

  it("keeps the canvas in the owner's list with the sentence — the record, not a hole", async () => {
    const { takedown: row } = await takedown();
    await purge();
    const listed = (await (
      await fetch(`${base}${canvasesRoute()}`, { headers: owner.headers })
    ).json()) as Canvas[];
    expect(listed.map((canvas) => canvas.id)).toContain(canvasId);
    const notices = (await (
      await fetch(`${base}${TAKEDOWNS_ROUTE}`, { headers: owner.headers })
    ).json()) as TakedownsResponse;
    expect(notices.takedowns).toHaveLength(1);
    expect(notices.takedowns[0]!.sentence).toBe(takedownSentence(row));
    // The counts and the note are the operator's; the notice carries neither.
    expect(JSON.stringify(notices)).not.toMatch(/purged|kai, 12 Sep/);
  });

  it("a canvas that was never down is untouched by all of it — nothing changed for anyone else", async () => {
    const other = await makeCanvas("prj_another1", "Acme, later");
    await takedown();
    await purge();
    const res = await fetch(`${base}/api/projects/${other}/canvas`, { headers: owner.headers });
    expect(res.status).toBe(200);
    expect(await daemon.store.purgedAt(other)).toBeNull();
  });
});
