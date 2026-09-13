import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createSign, generateKeyPairSync } from "node:crypto";
import { WebSocket } from "ws";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  BADGE_ENDED,
  badgeRoute,
  ENDED,
  NOT_ADMITTED,
  OPERATOR_PROOF_HEADER,
  PASS_MINTER_ENDED,
  PASS_REDEEM_ROUTE,
  passesRoute,
  WS_NOT_ADMITTED,
  type BadgeEnd,
  type MintPassResponse,
  type OperatorAct,
  type OperatorEndResponse,
  type OperatorLogResponse,
} from "@isocan/core";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

/**
 * **`isocan operator end`** — operator phase 4's second half, walked against a
 * real daemon with a real desk (journey 7, steps 1–5 as far as a daemon on
 * this machine can walk them; journey 12 step 1).
 *
 * The owner's path already closes the sockets, wakes the wait and refuses the
 * pass (`ended.test.ts`). What this file proves is the OPERATOR's part: the
 * target resolved by the id a report names — a badge, an actor, an address —
 * the reach listed before the act with the enrolments and the passes, the
 * tombstone carrying the operator's reason and address so the 401 reads
 * `operator` and the sentence names both, and the ledger row before every
 * answer, the preview included.
 *
 * The tokens are signed with a key pair this file generated, as
 * `takedown.test.ts` does. What needs a person: the browser half of the proof,
 * a second Google account, and the walk on dev — journey 7 on dev.isocan.io.
 *
 * Fixtures are synthetic: Acme, Priya, Sam, Olu.
 */

const PROJECT = "isocan-io-dev";
const auth = { project: PROJECT, apiKey: "browser-key-not-a-secret" };
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const keys = { kid_1: publicKey.export({ type: "spki", format: "pem" }) as string };
const OLU = "olu@example.test";

const priya = { id: "usr_priya", name: "Priya" };
const sam = { id: "usr_sam", name: "Sam" };
const CANVAS = "prj_acme";

let home: string;
let daemon: Daemon;
let base: string;
/** Priya, who made the canvas. */
let owner: TestBadge;
/** The operator's terminal: an ordinary badge, admitted to nothing. */
let desk: TestBadge;
/** Sam's laptop: the badge the reports are about. */
let laptop: TestBadge;

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
}

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-operator-end-"));
  await boot();
  owner = await mintTestBadge(base);
  await owner.speakAs(priya);
  desk = await mintTestBadge(base);
  const made = await op(owner, {
    canvasId: null,
    actor: priya,
    op: { type: "project.create", canvasId: CANVAS, title: "Acme quarterly" },
  });
  if (!made.ok) throw new Error(await made.text());
  // Sam arrives by the link and speaks as himself.
  laptop = await mintTestBadge(base);
  await laptop.speakAs(sam);
  expect((await get(laptop, `/api/projects/${CANVAS}`)).status).toBe(200);
});

afterEach(async () => {
  await daemon?.close();
  daemon = undefined as unknown as Daemon;
  await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

const get = (badge: TestBadge, url: string) => fetch(`${base}${url}`, { headers: badge.headers });

async function op(badge: TestBadge, body: unknown): Promise<Response> {
  return fetch(`${base}/api/ops`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...badge.headers },
    body: JSON.stringify(body),
  });
}

function idToken(email: string): string {
  const now = Math.floor(Date.now() / 1000);
  const b64 = (value: unknown): string => Buffer.from(JSON.stringify(value)).toString("base64url");
  const head = b64({ alg: "RS256", kid: "kid_1", typ: "JWT" });
  const body = b64({
    iss: `https://securetoken.google.com/${PROJECT}`,
    aud: PROJECT,
    sub: `uid_${email}`,
    iat: now - 60,
    exp: now + 3600,
    email,
    email_verified: true,
    auth_time: now - 30,
  });
  const signer = createSign("RSA-SHA256");
  signer.update(`${head}.${body}`);
  return `${head}.${body}.${signer.sign(privateKey).toString("base64url")}`;
}

/** The act: the badge through the door, the proof in one header. */
async function end(
  target: string,
  body: { reason?: string; note?: string; preview?: boolean; withEnrolments?: boolean } = {},
): Promise<Response> {
  return fetch(`${base}/api/operator/end/${encodeURIComponent(target)}`, {
    method: "POST",
    headers: { ...desk.headers, "Content-Type": "application/json", [OPERATOR_PROOF_HEADER]: idToken(OLU) },
    body: JSON.stringify(body),
  });
}

async function ended(target: string, body = {}): Promise<OperatorEndResponse> {
  const res = await end(target, { reason: "harassment", ...body });
  if (!res.ok) throw new Error(`end refused: ${await res.text()}`);
  return (await res.json()) as OperatorEndResponse;
}

const ledger = async (): Promise<OperatorAct[]> => {
  const res = await fetch(`${base}/api/operator/log`, {
    headers: { ...desk.headers, [OPERATOR_PROOF_HEADER]: idToken(OLU) },
  });
  return ((await res.json()) as OperatorLogResponse).acts;
};

/**
 * A pass on the canvas, minted by Sam's laptop. Naming Sam makes the redeemer
 * one of SAM's surfaces (it claims him), which the actor target reaches on
 * its own; naming nobody makes an ENROLMENT — a machine the laptop let in
 * that is not Sam — which is what outlives him.
 */
async function samsPass(as: { id: string } | null = null): Promise<string> {
  const minted = await fetch(`${base}${passesRoute(CANVAS)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...laptop.headers },
    body: JSON.stringify(as ? { actorId: as.id } : {}),
  });
  if (!minted.ok) throw new Error(`could not mint a pass: ${await minted.text()}`);
  return ((await minted.json()) as MintPassResponse).token;
}

async function redeem(token: string): Promise<TestBadge> {
  const badge = await mintTestBadge(base);
  const redeemed = await fetch(`${base}${PASS_REDEEM_ROUTE}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...badge.headers },
    body: JSON.stringify({ token }),
  });
  if (!redeemed.ok) throw new Error(`could not redeem: ${await redeemed.text()}`);
  return badge;
}

/** An agent Sam's laptop enrolled by pass, speaking as nobody: what outlives
 * the laptop unless the operator says otherwise. */
const samsAgent = () => samsPass().then(redeem);

/** Sam's phone: a second surface of Sam's, handed him by his laptop. */
const samsPhone = () => samsPass(sam).then(redeem);

/** A socket, open and having heard its hello. In an object, so the async
 * wrapper does not flatten the close promise into the wait. */
async function openSocket(badge: TestBadge): Promise<{ closed: Promise<[number, string]> }> {
  const ws = new WebSocket(`${base.replace("http:", "ws:")}/ws?canvasId=${CANVAS}`, { headers: badge.headers });
  const closed = new Promise<[number, string]>((resolve) => {
    ws.on("close", (code, reason) => resolve([code, String(reason)]));
  });
  await new Promise<void>((resolve, reject) => {
    ws.on("error", reject);
    ws.once("message", () => resolve());
  });
  return { closed };
}

const settle = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------

describe("the reach, listed before the act", () => {
  it("a preview names the badges, the enrolments and the passes, and ends nothing", async () => {
    const agent = await samsAgent();
    await samsPass(); // outstanding
    const res = await end(sam.id, { reason: "harassment", preview: true });
    expect(res.status).toBe(200);
    const answer = (await res.json()) as OperatorEndResponse;
    expect(answer.reach.target).toEqual({ kind: "actor", id: sam.id });
    expect(answer.reach.badges.map((b) => b.badgeId)).toEqual([laptop.badgeId]);
    expect(answer.reach.badges[0]!.actors).toEqual([{ id: sam.id, name: "Sam" }]);
    expect(answer.reach.badges[0]!.canvases).toBe(1);
    expect(answer.reach.enrolments.map((b) => b.badgeId)).toEqual([agent.badgeId]);
    // The spent pass is not outstanding; the fresh one is.
    expect(answer.reach.passes).toBe(1);
    expect(answer.ended).toEqual([]);
    expect(answer.sentence).toBeNull();
    // Nothing happened to anybody.
    expect((await get(laptop, `/api/projects/${CANVAS}`)).status).toBe(200);
    expect((await get(agent, `/api/projects/${CANVAS}`)).status).toBe(200);
    // But the preview is in the ledger — somebody with a proof asked.
    const row = (await ledger()).find((a) => a.act === "end" && a.target === sam.id)!;
    expect(row.outcome).toBe("previewed");
    expect(row.reason).toBe("harassment");
  });

  it("never lists the home: an id that names nobody reaches nobody", async () => {
    const res = await end("usr_nobody", { reason: "harassment", preview: true });
    expect(((await res.json()) as OperatorEndResponse).reach.badges).toEqual([]);
  });
});

describe("the act, by badge, by actor, by address", () => {
  it("by badge: the tab closes, the wait exits, the pass is refused, and the 401 names the operator", async () => {
    const { closed } = await openSocket(laptop);
    const seed = await fetch(`${base}/api/oplog/watch`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...laptop.headers },
      body: JSON.stringify({ only: [CANVAS], waitMs: 0 }),
    });
    const { cursors } = (await seed.json()) as { cursors: Record<string, number> };
    const parked = fetch(`${base}/api/oplog/watch`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...laptop.headers },
      body: JSON.stringify({ cursors, only: [CANVAS], waitMs: 20_000 }),
    });
    await settle(300);
    const outstanding = await samsPass();

    const answer = await ended(laptop.badgeId);
    expect(answer.reach.target.kind).toBe("badge");
    expect(answer.ended).toEqual([laptop.badgeId]);
    expect(answer.reached).toEqual({ sockets: 1, waits: 1 });
    expect(answer.sentence).toMatch(
      /^This surface was ended by the operator of this home on \d+ \w+ \d{4}: harassment\. Write to olu@example\.test\.$/,
    );

    // Step 3: the tab, the wait, the pass.
    expect(await closed).toEqual([WS_NOT_ADMITTED, ENDED]);
    const woken = await parked;
    expect(woken.status).toBe(403);
    const wokenBody = (await woken.json()) as { code: string; reason: string; error: string };
    expect(wokenBody.code).toBe(NOT_ADMITTED);
    expect(wokenBody.reason).toBe(ENDED);
    expect(wokenBody.error).toBe(answer.sentence);
    const stranger = await mintTestBadge(base);
    const redeemed = await fetch(`${base}${PASS_REDEEM_ROUTE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...stranger.headers },
      body: JSON.stringify({ token: outstanding }),
    });
    expect(redeemed.status).toBe(410);
    expect(((await redeemed.json()) as { code: string; error: string }).code).toBe(PASS_MINTER_ENDED);

    // Step 4's half the home owns: the 401 says the OPERATOR did it, with the
    // reason and the address — what the CLI refuses to re-badge on.
    const after = await get(laptop, `/api/projects/${CANVAS}`);
    expect(after.status).toBe(401);
    const body = (await after.json()) as { code: string; reason: string; error: string; ended: BadgeEnd };
    expect(body.code).toBe(BADGE_ENDED);
    expect(body.reason).toBe("operator");
    expect(body.ended).toMatchObject({ by: "operator", reason: "harassment", address: OLU });
    expect(body.error).toBe(answer.sentence);

    // Step 5: ending is not refusing. Sam can knock again, as a stranger.
    expect((await get(stranger, `/api/projects/${CANVAS}`)).status).toBe(200);
  });

  it("by actor: every badge claiming the person, and the enrolments only when asked", async () => {
    const agent = await samsAgent();
    // Sam's phone: a second surface of his, handed him by the laptop, and so
    // reached by the actor and not by the laptop's id.
    const phone = await samsPhone();
    const first = await ended(sam.id);
    expect(first.reach.badges.map((b) => b.badgeId).sort()).toEqual([laptop.badgeId, phone.badgeId].sort());
    expect(first.ended.sort()).toEqual([laptop.badgeId, phone.badgeId].sort());
    // The enrolment was listed and LEFT: innkeeper.md says it outlives its
    // creating badge, and the operator did not say otherwise.
    expect(first.reach.enrolments.map((b) => b.badgeId)).toEqual([agent.badgeId]);
    expect((await get(agent, `/api/projects/${CANVAS}`)).status).toBe(200);
    expect((await get(laptop, `/api/projects/${CANVAS}`)).status).toBe(401);
    expect((await get(phone, `/api/projects/${CANVAS}`)).status).toBe(401);
  });

  it("--with-enrolments ends what the target enrolled, with the same sentence", async () => {
    const agent = await samsAgent();
    const answer = await ended(sam.id, { withEnrolments: true });
    expect(answer.ended.sort()).toEqual([laptop.badgeId, agent.badgeId].sort());
    const after = await get(agent, `/api/projects/${CANVAS}`);
    expect(after.status).toBe(401);
    expect(((await after.json()) as { reason: string }).reason).toBe("operator");
  });

  it("by address: every live badge that proved it, through `badgesAttesting`", async () => {
    const phone = await mintTestBadge(base);
    const at = new Date().toISOString();
    for (const badge of [laptop, phone]) {
      await daemon.desk.attest(badge.badgeId, { attribute: "email:sam@example.test", verifiedVia: "magic-link", at });
    }
    const answer = await ended("email:sam@example.test");
    expect(answer.reach.target).toEqual({ kind: "address", id: "email:sam@example.test" });
    expect(answer.ended.sort()).toEqual([laptop.badgeId, phone.badgeId].sort());
    // A badge that proved a different address is untouched.
    expect((await get(owner, `/api/projects/${CANVAS}`)).status).toBe(200);
  });
});

describe("the record, and the refusals", () => {
  it("writes its row before it answers, settles it with what it did, and both rows read back", async () => {
    await ended(laptop.badgeId, { note: "report from kai" });
    const rows = (await ledger()).filter((a) => a.act === "end" && a.target === laptop.badgeId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ outcome: "done", reason: "harassment", note: "report from kai" });
    expect((rows[0]!.reach as { ended: string[] }).ended).toEqual([laptop.badgeId]);
    expect(rows[0]!.proof.attribute).toBe(`email:${OLU}`);
    expect(rows[0]!.badgeId).toBe(desk.badgeId);
  });

  it("needs a reason from the list, and records the refusal", async () => {
    const res = await end(laptop.badgeId, { reason: "because" });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { code: string }).code).toBe("no-reason");
    expect((await get(laptop, `/api/projects/${CANVAS}`)).status).toBe(200);
    expect((await ledger()).find((a) => a.act === "end")!.outcome).toBe("no-reason");
  });

  it("refuses an id that names no live badge, so an end is never silently nothing", async () => {
    await ended(laptop.badgeId);
    const again = await end(laptop.badgeId, { reason: "harassment" });
    expect(again.status).toBe(404);
    expect(((await again.json()) as { code: string }).code).toBe("nothing-to-end");
  });

  it("refuses a caller with no proof — an agent holding this CLI cannot end anybody", async () => {
    const res = await fetch(`${base}/api/operator/end/${laptop.badgeId}`, {
      method: "POST",
      headers: { ...owner.headers, "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "harassment" }),
    });
    expect(res.status).toBe(403);
    expect((await get(laptop, `/api/projects/${CANVAS}`)).status).toBe(200);
  });

  it("nothing changed for anyone else: a stranger still cannot end Priya's badge (journey 12)", async () => {
    const res = await fetch(`${base}${badgeRoute(owner.badgeId)}`, { method: "DELETE", headers: laptop.headers });
    expect(res.status).toBe(403);
    expect(((await res.json()) as { code: string }).code).toBe("not-your-badge");
  });

  it("survives a restart: the tombstone still says the operator, the reason and the address", async () => {
    await ended(laptop.badgeId);
    await daemon.close();
    await boot();
    const res = await get(laptop, `/api/projects/${CANVAS}`);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { reason: string; ended: BadgeEnd };
    expect(body.reason).toBe("operator");
    expect(body.ended.address).toBe(OLU);
    expect(body.ended.reason).toBe("harassment");
  });
});
