import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createSign, generateKeyPairSync } from "node:crypto";
import { WebSocket } from "ws";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  NOT_ADMITTED,
  OPERATOR_PROOF_HEADER,
  PASS_REDEEM_ROUTE,
  TAKEDOWNS_ROUTE,
  TAKEN_DOWN,
  WITHDRAWN,
  WS_NOT_ADMITTED,
  canvasesRoute,
  grantRevokeRoute,
  grantsRoute,
  takedownSentence,
  type GrantsResponse,
  type OperatorAct,
  type OperatorLogResponse,
  type OperatorLookResponse,
  type OperatorShowResponse,
  type OperatorTakedownResponse,
  type ServerMessage,
  type TakedownsResponse,
  type Canvas,
  LINK,
} from "@isocan/core";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import * as p from "../src/paths.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

/**
 * **Look, and take it down** — operator phase 2, walked against a real daemon
 * with a real file store and a real desk.
 *
 * The load-bearing distinction the whole phase turns on is **taking down is
 * not deleting**, and nearly every assertion below is a way of checking that
 * something which would be true of a delete is NOT true here: the socket close
 * carries `taken-down` rather than `canvas-deleted`, the canvas stays in the
 * list, the store's directory is untouched, `show` still answers, and a lift
 * brings back a canvas with the same `lastSeq` it had. Any one of those
 * flipping would be a takedown that looks like a delete to a reader, a replica
 * or a test — which the brief names as the bug.
 *
 * The tokens are signed here with a key pair this file generated, exactly as
 * `operator.test.ts` does. Everything downstream of the signature is the
 * production path.
 *
 * **What needs a person, and is therefore not here**: the browser half of a
 * look (the prove page and the loopback hand-over), a second Google account,
 * the CDN edge, and a second machine's daemon actually holding a replica. The
 * replica's half is exercised at the seam it meets — the close code and its
 * reason — because that one string is the whole of what a linked daemon reads
 * to decide between keeping its copy and erasing it.
 */

const PROJECT = "isocan-io-dev";
const auth = { project: PROJECT, apiKey: "browser-key-not-a-secret" };
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const keys = { kid_1: publicKey.export({ type: "spki", format: "pem" }) as string };

const OLU = "olu@example.test";

let home: string;
let daemon: Daemon;
let base: string;
/** Priya, who made the canvas. */
let owner: TestBadge;
/** The operator's terminal: an ordinary badge, admitted to nothing. */
let desk: TestBadge;
/** Jordan's tab, and Olu's browser: two more ordinary badges. */
let member: TestBadge;
let browser: TestBadge;
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
  browser = await mintTestBadge(base);
}

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-takedown-"));
  await boot();
  canvasId = await makeCanvas();
});

afterEach(async () => {
  await daemon?.close();
  daemon = undefined as unknown as Daemon;
  await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

function idToken(email: string, options: { authTimeMs?: number } = {}): string {
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
    auth_time: Math.floor((options.authTimeMs ?? Date.now()) / 1000),
  });
  const signer = createSign("RSA-SHA256");
  signer.update(`${head}.${body}`);
  return `${head}.${body}.${signer.sign(privateKey).toString("base64url")}`;
}

const b64 = (value: unknown): string => Buffer.from(JSON.stringify(value)).toString("base64url");

/** An operator act: the badge through the door, the proof in one header. */
async function operate(
  route: string,
  body?: unknown,
  options: { proof?: string; as?: TestBadge } = {},
): Promise<Response> {
  const carrier = options.as ?? desk;
  return fetch(`${base}${route}`, {
    ...(body === undefined ? {} : { method: "POST", body: JSON.stringify(body) }),
    headers: {
      ...carrier.headers,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      [OPERATOR_PROOF_HEADER]: options.proof ?? idToken(OLU),
    },
  });
}

async function makeCanvas(): Promise<string> {
  const id = "prj_reported1";
  const res = await fetch(`${base}/api/ops`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...owner.headers },
    body: JSON.stringify({
      canvasId: null,
      actor: { id: "usr_priya", name: "Priya" },
      op: { type: "project.create", canvasId: id, title: "Acme quarterly" },
    }),
  });
  if (!res.ok) throw new Error(`could not make a canvas: ${await res.text()}`);
  return id;
}

async function turnTheLinkOff(): Promise<void> {
  const listed = await fetch(`${base}${grantsRoute(canvasId)}`, { headers: owner.headers });
  const { grants } = (await listed.json()) as GrantsResponse;
  const link = grants.find((grant) => grant.subject === LINK)!;
  await fetch(`${base}${grantRevokeRoute(canvasId, link.id)}`, {
    method: "DELETE",
    headers: owner.headers,
  });
}

/** Take it down, and hand back what the verb would print. */
async function takedown(
  body: { reason?: string; note?: string; lift?: boolean } = { reason: "stolen-content" },
): Promise<OperatorTakedownResponse> {
  const res = await operate(`/api/operator/canvases/${canvasId}/takedown`, body);
  if (!res.ok) throw new Error(`takedown refused: ${await res.text()}`);
  return (await res.json()) as OperatorTakedownResponse;
}

const ledger = async (): Promise<OperatorAct[]> =>
  ((await (await operate("/api/operator/log")).json()) as OperatorLogResponse).acts;

// ---------------------------------------------------------------------------

describe("the look: the operator gets in, and nobody is told", () => {
  it("mints a pass that redeems into `view` — so it is not in presence, by the rule for every viewer", async () => {
    await turnTheLinkOff();
    // The operator's browser is an ordinary badge, refused like anyone
    // (journey 12 step 3).
    expect(
      (await fetch(`${base}/api/projects/${canvasId}/canvas`, { headers: browser.headers })).status,
    ).toBe(403);

    const res = await operate(`/api/operator/canvases/${canvasId}/look`, {
      reason: "report from kai",
    });
    expect(res.status).toBe(200);
    const look = (await res.json()) as OperatorLookResponse;
    expect(look.reach.title).toBe("Acme quarterly");
    // An hour, not the proof's ten minutes: a proof is for an act, a look is
    // the act.
    const window = Date.parse(look.until) - Date.now();
    expect(window).toBeGreaterThan(55 * 60_000);
    expect(window).toBeLessThanOrEqual(60 * 60_000);

    const redeemed = await fetch(`${base}${PASS_REDEEM_ROUTE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...browser.headers },
      body: JSON.stringify({ token: look.token }),
    });
    expect(redeemed.status).toBe(200);

    // In, and at `view`: reads everything, writes nothing.
    expect(
      (await fetch(`${base}/api/projects/${canvasId}/canvas`, { headers: browser.headers })).status,
    ).toBe(200);
    const wrote = await fetch(`${base}/api/ops`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...browser.headers },
      body: JSON.stringify({
        canvasId,
        actor: { id: "usr_olu", name: "Olu" },
        op: { type: "item.add", itemId: "itm_x", x: 0, y: 0, kind: "text" },
      }),
    });
    expect(wrote.status, "a look reads; it never writes").toBe(403);

    // The admission the desk wrote is the one the design names.
    const record = await daemon.desk.badge(browser.badgeId);
    const admission = record!.admissions.find((row) => row.canvasId === canvasId)!;
    expect(admission.provenance).toEqual({ root: "operator", until: look.until });
    expect(admission.capability).toBe("view");
  });

  it("is not in presence, because no `view` connection is", async () => {
    const look = (await (
      await operate(`/api/operator/canvases/${canvasId}/look`, { reason: "report from kai" })
    ).json()) as OperatorLookResponse;
    await fetch(`${base}${PASS_REDEEM_ROUTE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...browser.headers },
      body: JSON.stringify({ token: look.token }),
    });
    const socket = await openSocket(browser);
    // A beat from a `view` connection is dropped rather than closing the
    // socket: it is doing its legitimate job, which is watching.
    socket.ws.send(
      JSON.stringify({ type: "presence", sessionId: "s1", actor: { id: "usr_olu", name: "Olu" } }),
    );
    await settle(200);
    expect(daemon.presence.roster(canvasId)).toEqual([]);
    socket.ws.close();
  });

  it("ends on its own, and then the operator meets the refusal any stranger gets", async () => {
    await turnTheLinkOff();
    /**
     * Journey 2 step 3. The clock is not waited out — the admission is written
     * with an `until` in the past, which is the same state an hour produces,
     * and is the only part of this the door actually reads.
     */
    await daemon.desk.admit(
      browser.badgeId,
      canvasId,
      { root: "operator", until: new Date(Date.now() - 1000).toISOString() },
      "view",
    );
    const res = await fetch(`${base}/api/projects/${canvasId}/canvas`, {
      headers: browser.headers,
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code: string; reason?: string };
    expect(body.code).toBe(NOT_ADMITTED);
    // The refusal ANY STRANGER gets: no reason, because a reason would tell
    // somebody on the other side of the address that a look had happened.
    expect(body.reason).toBeUndefined();
  });

  it("a second look after the first has expired is written, not silently dropped", async () => {
    // `desk.admit` used to refuse whenever a row for the canvas existed, which
    // was right while every admission was live until revoked. An expired look
    // must be REPLACED, or the second look answers "done" and does nothing.
    await daemon.desk.admit(
      browser.badgeId,
      canvasId,
      { root: "operator", until: new Date(Date.now() - 1000).toISOString() },
      "view",
    );
    const look = (await (
      await operate(`/api/operator/canvases/${canvasId}/look`, { reason: "kai again" })
    ).json()) as OperatorLookResponse;
    await fetch(`${base}${PASS_REDEEM_ROUTE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...browser.headers },
      body: JSON.stringify({ token: look.token }),
    });
    const record = await daemon.desk.badge(browser.badgeId);
    const rows = record!.admissions.filter((row) => row.canvasId === canvasId);
    expect(rows, "one row per canvas, replaced rather than doubled").toHaveLength(1);
    expect(rows[0]!.provenance).toEqual({ root: "operator", until: look.until });
    expect(
      (await fetch(`${base}/api/projects/${canvasId}/canvas`, { headers: browser.headers })).status,
    ).toBe(200);
  });

  it("the sweep leaves it alone, as it leaves `created`", async () => {
    const look = (await (
      await operate(`/api/operator/canvases/${canvasId}/look`, { reason: "report from kai" })
    ).json()) as OperatorLookResponse;
    await fetch(`${base}${PASS_REDEEM_ROUTE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...browser.headers },
      body: JSON.stringify({ token: look.token }),
    });
    // Turning the link off sweeps the canvas — which is exactly the moment a
    // root the sweep does not recognise gets expelled by the pass fallthrough.
    await turnTheLinkOff();
    const record = await daemon.desk.badge(browser.badgeId);
    expect(record!.admissions.some((row) => row.canvasId === canvasId)).toBe(true);
    expect(
      (await fetch(`${base}/api/projects/${canvasId}/canvas`, { headers: browser.headers })).status,
      "a revocation somebody else made must not end the operator's look",
    ).toBe(200);
  });

  it("needs a reason, and the reason is in the ledger", async () => {
    const refused = await operate(`/api/operator/canvases/${canvasId}/look`, {});
    expect(refused.status).toBe(400);
    expect(((await refused.json()) as { code: string }).code).toBe("no-reason");

    await operate(`/api/operator/canvases/${canvasId}/look`, { reason: "report from kai" });
    const rows = await ledger();
    const look = rows.find((row) => row.act === "look" && row.outcome === "done")!;
    expect(look.target).toBe(canvasId);
    expect(look.reason).toBe("report from kai");
    expect(look.proof.attribute).toBe(`email:${OLU}`);
    // And the refusal is a row too — somebody asked, at a moment.
    expect(rows.some((row) => row.act === "look" && row.outcome === "no-reason")).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe("taking down is not deleting", () => {
  it("stops the home serving it, and leaves everything where it is", async () => {
    const before = await daemon.store.load(canvasId);
    expect(before).not.toBeNull();

    const answer = await takedown({ reason: "stolen-content", note: "kai, 12 Sep" });
    expect(answer.takedown.reason).toBe("stolen-content");
    expect(answer.takedown.by).toBe(`email:${OLU}`);

    // The store refuses it exactly where it refuses a delete...
    expect(await daemon.store.load(canvasId)).toBeNull();
    expect(await daemon.store.takenDownAt(canvasId)).toBe(answer.takedown.at);
    // ...and the canvas is still THERE. A delete moves the directory aside.
    expect(await daemon.store.canvasExists(canvasId)).toBe(true);
    expect((await daemon.store.listCanvases()).map((canvas) => canvas.id)).toEqual([canvasId]);
    expect(
      await fs.stat(p.oplogFile(home, canvasId)).then(
        () => true,
        () => false,
      ),
      "the log is untouched, which is why a lift replays it as it was",
    ).toBe(true);
    // And the directory is where it always was, rather than parked under
    // `deleted-projects/` — the file backing's delete is a rename.
    expect(await fs.readdir(path.join(home, "deleted-projects")).catch(() => [])).toEqual([]);
  });

  it("refuses every canvas route WITH THE SENTENCE, never a 404", async () => {
    /**
     * The design's whole message: *never silence, never `not found` for
     * something that was taken down.* The difference between *there is nothing
     * here* and *this was removed, and here is who to ask* is the phase.
     */
    const { takedown: row } = await takedown();
    for (const route of [
      `/api/projects/${canvasId}/canvas`,
      `/api/projects/${canvasId}/oplog`,
      `/api/projects/${canvasId}/grants`,
    ]) {
      const res = await fetch(`${base}${route}`, { headers: member.headers });
      expect(res.status, route).toBe(403);
      const body = (await res.json()) as { error: string; code: string; reason: string };
      expect(body.code, route).toBe(NOT_ADMITTED);
      expect(body.reason, route).toBe(TAKEN_DOWN);
      expect(body.error, route).toBe(takedownSentence(row));
      expect(body.error).toMatch(/taken down by the operator of this home/);
      expect(body.error).toMatch(/stolen content/);
      expect(body.error).toContain(OLU);
      expect(body.error, "not a delete, and not a withdrawal").not.toMatch(/not found|withdrawn/);
    }
  });

  it("refuses the OWNER too — this is the home's act, not a change to her access", async () => {
    await takedown();
    const res = await fetch(`${base}/api/projects/${canvasId}/canvas`, { headers: owner.headers });
    expect(res.status).toBe(403);
    expect(((await res.json()) as { reason: string }).reason).toBe(TAKEN_DOWN);
  });

  it("refuses an op with the sentence, at the route the door hook cannot cover", async () => {
    /**
     * `/api/ops` carries its canvas in the BODY, so `CANVAS_API_ROUTE` does not
     * match it. Without its own line the engine refuses one layer down as
     * *canvas not found* — the one sentence a takedown must never produce.
     * Found by opening the owner's canvas list in a browser and noticing the
     * Delete button still on the greyed card.
     */
    const { takedown: row } = await takedown();
    const res = await fetch(`${base}/api/ops`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...owner.headers },
      body: JSON.stringify({
        canvasId,
        actor: { id: "usr_priya", name: "Priya" },
        op: { type: "project.delete" },
      }),
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string; reason: string };
    expect(body.reason).toBe(TAKEN_DOWN);
    expect(body.error).toBe(takedownSentence(row));
    expect(body.error).not.toMatch(/not found/);
  });

  it("closes open sockets with `taken-down` — never `canvas-deleted`, which means forget your copy", async () => {
    const socket = await openSocket(member);
    const answer = await takedown();
    const [code, reason] = await socket.closed;
    expect(code).toBe(WS_NOT_ADMITTED);
    expect(reason).toBe(TAKEN_DOWN);
    /**
     * **The assertion the whole phase turns on.** `home-link.ts` erases its
     * own copy when it hears `canvas-deleted` and keeps it on a 4402; a tab
     * drops its IndexedDB replica on the first and keeps it on the second. So
     * this one message not being sent is the difference between a takedown and
     * the operator reaching into somebody's laptop.
     */
    expect(socket.heard.map((m) => m.type)).not.toContain("canvas-deleted");
    expect(answer.reach.sockets).toBe(1);
  });

  it("wakes a parked wait and refuses it with the sentence, so the CLI exits and does not re-park", async () => {
    // Seeded at the tip, which is what `isocan wait` holds once it is parked:
    // a cursor with entries behind it answers at once and never parks at all.
    const seeded = (await (
      await fetch(`${base}/api/oplog/watch`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...member.headers },
        body: JSON.stringify({ only: [canvasId], waitMs: 0 }),
      })
    ).json()) as { cursors: Record<string, number> };
    const parked = fetch(`${base}/api/oplog/watch`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...member.headers },
      body: JSON.stringify({ cursors: seeded.cursors, only: [canvasId], waitMs: 20_000 }),
    });
    // Let the poll get as far as parking before the act.
    await settle(300);
    const answer = await takedown();
    const res = await parked;
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string; code: string; reason: string };
    expect(body.code).toBe(NOT_ADMITTED);
    expect(body.reason).toBe(TAKEN_DOWN);
    expect(body.error).toBe(takedownSentence(answer.takedown));
    expect(answer.reach.waits, "counted at the moment of acting").toBe(1);
  });

  it("ends the rc holds parked on that canvas", async () => {
    const held = fetch(`${base}/api/rc/hold`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...member.headers },
      body: JSON.stringify({ canvasId, actorIds: ["usr_jordan"], waitMs: 20_000 }),
    });
    await settle(300);
    const answer = await takedown();
    const res = await held;
    expect(res.status, "the hold ends as a timeout does, with no asks").toBe(200);
    expect(answer.reach.holds).toBe(1);
  });

  it("drops the engine's copy, so a signed content read is refused at the origin at once", async () => {
    /**
     * The acceptance's *a signed URL minted a minute before is refused by the
     * origin*. The origin's only existence gate is `engine.getSnapshot(id)` on
     * the serve path — so what is asserted here is that the engine no longer
     * holds the canvas, which is what makes that read refuse. Reading it
     * through the hosted content origin needs isocan.store and is the ⚑ half.
     */
    await fetch(`${base}/api/projects/${canvasId}/canvas`, { headers: owner.headers });
    await takedown();
    await expect(daemon.engine.getSnapshot(canvasId)).rejects.toThrow();
  });

  it("keeps the canvas in the list, carrying the sentence, for the people who were inside", async () => {
    const { takedown: row } = await takedown();
    // Journey 4 step 3: it is THERE, with the sentence, and it does not open.
    const listed = (await (
      await fetch(`${base}${canvasesRoute()}`, { headers: owner.headers })
    ).json()) as Canvas[];
    expect(listed.map((canvas) => canvas.id)).toContain(canvasId);

    const notices = (await (
      await fetch(`${base}${TAKEDOWNS_ROUTE}`, { headers: owner.headers })
    ).json()) as TakedownsResponse;
    expect(notices.takedowns).toHaveLength(1);
    expect(notices.takedowns[0]!.canvasId).toBe(canvasId);
    expect(notices.takedowns[0]!.sentence).toBe(takedownSentence(row));
    // The note is the operator's and reaches no surface.
    expect(JSON.stringify(notices)).not.toContain("kai, 12 Sep");
  });

  it("answers one canvas to anybody, because the door already says it", async () => {
    // A replica that has just been refused asks this to learn the sentence,
    // and so does a tab. Narrowing it would make *here is who to ask* depend
    // on which surface you were standing on.
    await turnTheLinkOff();
    const { takedown: row } = await takedown();
    const stranger = await mintTestBadge(base);
    const res = await fetch(`${base}${TAKEDOWNS_ROUTE}?canvas=${canvasId}`, {
      headers: stranger.headers,
    });
    const body = (await res.json()) as TakedownsResponse;
    expect(body.takedowns[0]!.sentence).toBe(takedownSentence(row));
    // The LISTING is narrowed, though: it would otherwise be a roster of this
    // home's takedowns handed to anybody who asked.
    const listing = (await (
      await fetch(`${base}${TAKEDOWNS_ROUTE}`, { headers: stranger.headers })
    ).json()) as TakedownsResponse;
    expect(listing.takedowns).toEqual([]);
  });

  it("prints the CDN line only at a home that has an edge", async () => {
    // A local daemon has no content origin, and a `gcloud` line printed to
    // somebody on a laptop is noise dressed as an instruction.
    const answer = await takedown();
    expect(answer.cdn).toBeNull();
  });

  it("survives a restart: the flag is durable and the registry is re-read at boot", async () => {
    await takedown();
    await daemon.close();
    await boot();
    const res = await fetch(`${base}/api/projects/${canvasId}/canvas`, { headers: member.headers });
    expect(res.status).toBe(403);
    expect(((await res.json()) as { reason: string }).reason).toBe(TAKEN_DOWN);
  });

  it("refuses a reason that is not a category, because the reason is what people are shown", async () => {
    const res = await operate(`/api/operator/canvases/${canvasId}/takedown`, {
      reason: "because I say so",
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; code: string };
    expect(body.code).toBe("no-reason");
    expect(body.error).toContain("stolen-content");
    // Refused, and in the ledger: somebody asked this home to act.
    expect((await ledger()).some((row) => row.act === "takedown" && row.outcome === "no-reason"))
      .toBe(true);
  });

  it("refuses a second takedown, and a lift of a canvas that is not down", async () => {
    await takedown();
    const again = await operate(`/api/operator/canvases/${canvasId}/takedown`, {
      reason: "spam",
    });
    expect(again.status).toBe(409);
    expect(((await again.json()) as { code: string }).code).toBe("already-taken-down");

    const other = await makeOtherCanvas();
    const lift = await fetch(`${base}/api/operator/canvases/${other}/takedown`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...desk.headers,
        [OPERATOR_PROOF_HEADER]: idToken(OLU),
      },
      body: JSON.stringify({ lift: true }),
    });
    expect(lift.status).toBe(409);
    expect(((await lift.json()) as { code: string }).code).toBe("not-taken-down");
  });

  it("writes its ledger row before it answers, with the reason and the note", async () => {
    await takedown({ reason: "stolen-content", note: "kai, 12 Sep" });
    const row = (await ledger()).find((act) => act.act === "takedown")!;
    expect(row.outcome).toBe("done");
    expect(row.target).toBe(canvasId);
    expect(row.reason).toBe("stolen-content");
    expect(row.note).toBe("kai, 12 Sep");
    expect(row.proof.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(row)).not.toContain("eyJ");
  });

  it("still answers `show`, which is what the operator reads when the reporter writes back", async () => {
    // Phase 1's open finding: `show` on a canvas that is not servable was a
    // 404 with nothing to say. This is where the answer comes from.
    await takedown({ reason: "stolen-content", note: "kai, 12 Sep" });
    const res = await operate(`/api/operator/canvases/${canvasId}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as OperatorShowResponse;
    expect(body.reach.title).toBe("Acme quarterly");
    expect(body.reach.madeBy.name).toBe("Priya");
    expect(body.takedown!.reason).toBe("stolen-content");
    // The operator is the one reader the note was written for.
    expect(body.takedown!.note).toBe("kai, 12 Sep");
  });
});

// ---------------------------------------------------------------------------

describe("a mistake, undone", () => {
  it("`--lift` brings it all back, and the log holds both rows", async () => {
    const opened = await fetch(`${base}/api/projects/${canvasId}/canvas`, {
      headers: owner.headers,
    });
    const beforeSeq = ((await opened.json()) as { lastSeq: number }).lastSeq;

    await takedown({ reason: "stolen-content" });
    const lifted = await takedown({ lift: true });
    expect(lifted.takedown.liftedAt).toBeDefined();
    // The row is KEPT, so both halves are readable afterwards.
    expect(lifted.takedown.reason).toBe("stolen-content");

    expect(await daemon.store.takenDownAt(canvasId)).toBeNull();
    const back = await fetch(`${base}/api/projects/${canvasId}/canvas`, { headers: owner.headers });
    expect(back.status).toBe(200);
    expect(((await back.json()) as { lastSeq: number }).lastSeq, "the log replays as it was").toBe(
      beforeSeq,
    );

    const rows = await ledger();
    expect(rows.filter((row) => row.act === "takedown" && row.outcome === "done")).toHaveLength(1);
    expect(rows.filter((row) => row.act === "lift" && row.outcome === "done")).toHaveLength(1);
    // Each with its proof: journey 5 step 3.
    expect(rows.filter((row) => row.act === "lift")[0]!.proof.attribute).toBe(`email:${OLU}`);
  });

  it("a socket opened after the lift connects, as it did before", async () => {
    await takedown();
    await takedown({ lift: true });
    const socket = await openSocket(member);
    expect(socket.heard[0]!.type).toBe("snapshot");
    socket.ws.close();
  });
});

// ---------------------------------------------------------------------------

describe("nothing changed for anyone else", () => {
  it("a delete is still the owner's, and still says `canvas-deleted`", async () => {
    // Journey 12 step 2. The two acts must stay tellable apart on the wire,
    // and this is the half that must NOT have changed.
    const socket = await openSocket(member);
    await fetch(`${base}/api/ops`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...owner.headers },
      body: JSON.stringify({
        canvasId,
        actor: { id: "usr_priya", name: "Priya" },
        op: { type: "project.delete" },
      }),
    });
    await settle(200);
    expect(socket.heard.map((m) => m.type)).toContain("canvas-deleted");
    expect(await daemon.store.load(canvasId)).toBeNull();
    expect(await daemon.store.listCanvases()).toEqual([]);
  });

  it("a revoked grant still closes a socket as `withdrawn`, not as `taken-down`", async () => {
    await fetch(`${base}${grantsRoute(canvasId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...owner.headers },
      body: JSON.stringify({ subject: `email:jordan@example.test` }),
    });
    await fetch(`${base}/api/projects/${canvasId}/canvas`, { headers: member.headers });
    const socket = await openSocket(member);
    await turnTheLinkOff();
    const [code, reason] = await socket.closed;
    expect(code).toBe(WS_NOT_ADMITTED);
    expect(reason).toBe(WITHDRAWN);
  });
});

// ---------------------------------------------------------------------------

async function makeOtherCanvas(): Promise<string> {
  const id = "prj_another1";
  await fetch(`${base}/api/ops`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...owner.headers },
    body: JSON.stringify({
      canvasId: null,
      actor: { id: "usr_priya", name: "Priya" },
      op: { type: "project.create", canvasId: id, title: "Acme, later" },
    }),
  });
  return id;
}

/** A socket on the canvas, open and having heard its hello. */
async function openSocket(
  badge: TestBadge,
): Promise<{ ws: WebSocket; heard: ServerMessage[]; closed: Promise<[number, string]> }> {
  const ws = new WebSocket(`${base.replace("http:", "ws:")}/ws?canvasId=${canvasId}`, {
    headers: badge.headers,
  });
  const heard: ServerMessage[] = [];
  const closed = new Promise<[number, string]>((resolve) => {
    ws.on("close", (code, reason) => resolve([code, String(reason)]));
  });
  await new Promise<void>((resolve, reject) => {
    ws.on("error", reject);
    ws.on("message", (data) => {
      heard.push(JSON.parse(String(data)) as ServerMessage);
      if (heard.length === 1) resolve();
    });
  });
  return { ws, heard, closed };
}

const settle = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
