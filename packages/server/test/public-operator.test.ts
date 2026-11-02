import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createSign, generateKeyPairSync } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  ATTEST_ROUTE, BADGE_ENDED, NOT_ADMITTED, OPERATOR_PROOF_HEADER,
  PUBLIC_CANVASES_ROUTE, REFUSED, grantsRoute, publicListingRoute,
  type Grant, type PublicCanvasesResponse,
} from "@isocan/core";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

// Generated signatures exercise the real operator proof verifier without an
// external account. Every policy change below goes through its HTTP route.
const PROJECT = "demo-isocan-public-operator";
const OPERATOR = "olu@example.test";
const VISITOR = "rowan@example.test";
const PERSON = { id: "usr_public_maya", name: "Maya" };
const CANVAS = "prj_public_operator";
const TITLE = "Acme published example";
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const keys = { public_proof: publicKey.export({ type: "spki", format: "pem" }) as string };

let home: string;
let daemon: Daemon;
let base: string;
let owner: TestBadge;
let operator: TestBadge;
let link: Grant;

async function boot(): Promise<void> {
  daemon = await startDaemon({
    home, port: 0, birthHome: null, contentPort: "off", servesWorld: true,
    auth: { project: PROJECT, apiKey: "synthetic-browser-key" },
    operators: [`email:${OPERATOR}`], signingKeys: async () => keys,
  });
  const address = daemon.app.server.address();
  if (!address || typeof address === "string") throw new Error("missing test listener");
  base = `http://127.0.0.1:${address.port}`;
}

function idToken(email: string): string {
  const now = Math.floor(Date.now() / 1000);
  const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const head = b64({ alg: "RS256", kid: "public_proof", typ: "JWT" });
  const body = b64({
    iss: `https://securetoken.google.com/${PROJECT}`, aud: PROJECT, sub: `uid_${email}`,
    iat: now - 60, exp: now + 3600, auth_time: now - 30, email, email_verified: true,
  });
  const signer = createSign("RSA-SHA256");
  signer.update(`${head}.${body}`);
  return `${head}.${body}.${signer.sign(privateKey).toString("base64url")}`;
}

function request(badge: TestBadge | null, route: string, method = "GET", body?: unknown): Promise<Response> {
  return fetch(base + route, {
    method, headers: { ...badge?.headers, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function accepted(response: Response): Promise<void> {
  expect(response.status, await response.clone().text()).toBe(200);
}

async function operate(route: string, body: unknown): Promise<Response> {
  const response = await fetch(base + route, {
    method: "POST", headers: { ...operator.headers, "Content-Type": "application/json", [OPERATOR_PROOF_HEADER]: idToken(OPERATOR) },
    body: JSON.stringify(body),
  });
  await accepted(response);
  return response;
}

async function catalogue(badge: TestBadge | null = null): Promise<PublicCanvasesResponse> {
  const response = await request(badge, PUBLIC_CANVASES_ROUTE);
  await accepted(response);
  return response.json() as Promise<PublicCanvasesResponse>;
}

const advertised = () => ({ canvases: [{ id: CANVAS, title: TITLE, home: base, capability: "view" }] });
const prove = (badge: TestBadge) => request(badge, ATTEST_ROUTE, "POST", { idToken: idToken(VISITOR) });
const refuse = (subject: string, lift = false) => operate(`/api/operator/refuse/${encodeURIComponent(subject)}`, lift ? { lift: true } : { reason: "spam" });

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-public-operator-"));
  await boot();
  owner = await mintTestBadge(base); await owner.speakAs(PERSON);
  operator = await mintTestBadge(base);
  await accepted(await request(owner, "/api/ops", "POST", {
    canvasId: null, actor: PERSON, op: { type: "project.create", canvasId: CANVAS, title: TITLE },
  }));
  const shared = await request(owner, grantsRoute(CANVAS), "POST", { subject: "link", capability: "view", actorId: PERSON.id });
  await accepted(shared);
  link = ((await shared.json()) as { grant: Grant }).grant;
  await accepted(await request(owner, publicListingRoute(CANVAS, link.id), "PUT", { listed: true, actorId: PERSON.id }));
  expect(await catalogue()).toEqual(advertised());
});

afterEach(async () => {
  vi.restoreAllMocks();
  await daemon?.close();
  await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

it("actual takedown hides a warmed published canvas, lift restores its decision, and purge survives restart", async () => {
  await accepted(await request(owner, `/api/projects/${CANVAS}/canvas`));
  const route = `/api/operator/canvases/${CANVAS}`;
  await operate(`${route}/takedown`, { reason: "stolen-content" });
  expect(await catalogue()).toEqual({ canvases: [] });
  expect(await catalogue(owner)).toEqual({ canvases: [] });
  await operate(`${route}/takedown`, { lift: true });
  expect(await catalogue()).toEqual(advertised());
  expect((await daemon.desk.grantsFor(CANVAS)).find((grant) => grant.id === link.id)?.listing?.listed).toBe(true);
  await operate(`${route}/takedown`, { reason: "illegal-content" });
  await operate(`${route}/purge`, { force: true });
  expect(await catalogue()).toEqual({ canvases: [] });
  await daemon.close(); await boot();
  expect(await catalogue()).toEqual({ canvases: [] });
  expect(await daemon.store.purgedAt(CANVAS)).toEqual(expect.any(String));
});

it("a real network refusal denies anonymous and badged catalogue reads before querying listings, then lifts", async () => {
  const visitor = await mintTestBadge(base);
  await refuse("net:127.0.0.0/8");
  const candidates = vi.spyOn(daemon.desk, "listedGrants");
  for (const badge of [null, visitor]) {
    const response = await request(badge, PUBLIC_CANVASES_ROUTE);
    expect(response.status).toBe(403);
    const body = await response.json() as { error: string };
    expect(body).toMatchObject({ code: NOT_ADMITTED, reason: REFUSED });
    expect(body.error).toContain(OPERATOR);
    expect(JSON.stringify(body)).not.toContain(TITLE);
  }
  expect(candidates).not.toHaveBeenCalled();
  await refuse("net:127.0.0.0/8", true);
  expect(await catalogue(visitor)).toEqual(advertised());
  expect(await catalogue()).toEqual(advertised());
});

it("refusing an attested address ends its catalogue credential, prevents re-attestation, and lifts deliberately", async () => {
  const visitor = await mintTestBadge(base); await accepted(await prove(visitor));
  expect(await catalogue(visitor)).toEqual(advertised());
  // Hold one real request after badge resolution. Ending the stored badge
  // cannot erase its in-flight copy; the aggregate's live refusal check must
  // still stop that copy before it reads any published rows.
  let release!: () => void;
  let arrived!: () => void;
  const resumed = new Promise<void>((resolve) => { release = resolve; });
  const paused = new Promise<void>((resolve) => { arrived = resolve; });
  const originalTouch = daemon.desk.touch.bind(daemon.desk);
  const candidates = vi.spyOn(daemon.desk, "listedGrants");
  const touch = vi.spyOn(daemon.desk, "touch").mockImplementation(async (id, at) => {
    await originalTouch(id, at);
    if (id === visitor.badgeId) { arrived(); await resumed; }
  });
  const inFlight = request(visitor, PUBLIC_CANVASES_ROUTE);
  try {
    await Promise.race([paused, inFlight.then(() => { throw new Error("catalogue bypassed the badge witness"); })]);
    await refuse(`email:${VISITOR}`);
  } finally { release(); touch.mockRestore(); }
  const denied = await inFlight;
  expect(denied.status).toBe(403);
  const refusal = await denied.json();
  expect(refusal).toMatchObject({ code: NOT_ADMITTED, reason: REFUSED });
  expect(JSON.stringify(refusal)).not.toContain(TITLE);
  expect(candidates).not.toHaveBeenCalled();
  candidates.mockRestore();
  const response = await request(visitor, PUBLIC_CANVASES_ROUTE);
  expect(response.status).toBe(401);
  const body = await response.json();
  expect(body).toMatchObject({ code: BADGE_ENDED, reason: "operator", ended: { by: "operator", address: OPERATOR } });
  expect(JSON.stringify(body)).not.toContain(TITLE);
  const fresh = await mintTestBadge(base);
  const refused = await prove(fresh);
  expect(refused.status).toBe(403);
  expect(await refused.json()).toMatchObject({ code: NOT_ADMITTED, reason: REFUSED });
  expect(await catalogue()).toEqual(advertised());
  await refuse(`email:${VISITOR}`, true);
  await accepted(await prove(fresh));
  expect(await catalogue(fresh)).toEqual(advertised());
  expect((await request(visitor, PUBLIC_CANVASES_ROUTE)).status).toBe(401); // Lifting does not revive an ended surface.
});

it("a concrete bar hides the listed row only from its attested holder, without unpublishing it", async () => {
  const visitor = await mintTestBadge(base); await accepted(await prove(visitor));
  expect(await catalogue(visitor)).toEqual(advertised());
  const response = await request(owner, grantsRoute(CANVAS), "POST", { subject: `email:${VISITOR}`, bars: true, actorId: PERSON.id });
  await accepted(response);
  const bar = ((await response.json()) as { grant: Grant }).grant;
  expect(await catalogue(visitor)).toEqual({ canvases: [] });
  expect(await catalogue()).toEqual(advertised());
  expect((await request(visitor, `/api/projects/${CANVAS}/canvas`)).status).toBe(403);
  await accepted(await request(owner, `${grantsRoute(CANVAS)}/${bar.id}?actorId=${PERSON.id}`, "DELETE"));
  expect(await catalogue(visitor)).toEqual(advertised());
});

it("an operator-ended badge receives the attributed refusal on the catalogue, including after restart", async () => {
  const visitor = await mintTestBadge(base);
  await operate(`/api/operator/end/${visitor.badgeId}`, { reason: "harassment" });
  const expectEnded = async () => {
    const response = await request(visitor, PUBLIC_CANVASES_ROUTE);
    expect(response.status).toBe(401);
    const body = await response.json() as { error: string };
    expect(body).toMatchObject({ code: BADGE_ENDED, reason: "operator", ended: { by: "operator", reason: "harassment", address: OPERATOR } });
    expect(body.error).toContain("This surface was ended by the operator");
    expect(JSON.stringify(body)).not.toContain(TITLE);
    expect(await catalogue()).toEqual(advertised());
  };
  await expectEnded();
  await daemon.close(); await boot();
  await expectEnded();
});
