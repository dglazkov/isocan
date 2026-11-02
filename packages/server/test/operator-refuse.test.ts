import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createSign, generateKeyPairSync } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ATTEST_ROUTE,
  BADGE_ENDED,
  DOOR_ROUTE,
  NOT_ADMITTED,
  OPERATOR_PROOF_HEADER,
  REFUSED,
  type DoorResponse,
  type OperatorAct,
  type OperatorLogResponse,
  type OperatorRefuseResponse,
} from "@isocan/core";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

/**
 * **`isocan operator refuse` — refuse at the door** (operator phase 6; journey
 * 9), walked against a real daemon with a real desk, as far as a daemon on
 * this machine can walk it. What needs a person and two real networks on dev
 * is the ⚑ walk; everything a local daemon can prove is proved here:
 *
 * - the registry loaded at boot and surviving a restart;
 * - a refused address turned away at `/api/attest` with the sentence;
 * - refusing an address ends every badge that proved it, with the sentence;
 * - a refused `net:` turned away at the mint meter with the sentence;
 * - a refused `actor:` turned away at `actor.claim`;
 * - `--for` expiring on a clock the test moves, and `--lift`.
 *
 * The clock is injectable (`refusalsNow`), so `--for 10m` gone on its own is
 * one the test advances past rather than waits for. The daemon binds
 * loopback, so the mint meter keys on `127.0.0.1` — which is why the network
 * refusals name `127.0.0.0/8`: a knock from this test IS from that network.
 *
 * Tokens are signed with a key pair this file generated, as the takedown and
 * end suites do. Fixtures are synthetic: Acme, Priya, Sam, Olu.
 */

const PROJECT = "isocan-io-dev";
const auth = { project: PROJECT, apiKey: "browser-key-not-a-secret" };
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const keys = { kid_1: publicKey.export({ type: "spki", format: "pem" }) as string };
const OLU = "olu@example.test";
const SAM = "sam@example.test";
const priya = { id: "usr_priya", name: "Priya" };
const CANVAS = "prj_acme";

let home: string;
let daemon: Daemon;
let base: string;
let clock: number;
let owner: TestBadge;
/** The operator's terminal: an ordinary badge, admitted to nothing. */
let desk: TestBadge;

async function boot() {
  daemon = await startDaemon({
    port: 0,
    home,
    birthHome: null,
    auth,
    operators: [`email:${OLU}`],
    signingKeys: async () => keys,
    refusalsNow: () => clock,
  });
  const address = daemon.app.server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
}

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-operator-refuse-"));
  clock = Date.now();
  await boot();
  owner = await mintTestBadge(base);
  await owner.speakAs(priya);
  desk = await mintTestBadge(base);
  const made = await fetch(`${base}/api/ops`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...owner.headers },
    body: JSON.stringify({
      canvasId: null,
      actor: priya,
      op: { type: "project.create", canvasId: CANVAS, title: "Acme quarterly" },
    }),
  });
  if (!made.ok) throw new Error(await made.text());
});

afterEach(async () => {
  await daemon?.close();
  daemon = undefined as unknown as Daemon;
  await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

function idToken(email: string): string {
  const now = Math.floor(clock / 1000);
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

/** The act: the operator's badge through the door, the proof in one header. */
async function refuse(
  subject: string,
  body: { reason?: string; note?: string; for?: string; lift?: boolean } = {},
): Promise<Response> {
  return fetch(`${base}/api/operator/refuse/${encodeURIComponent(subject)}`, {
    method: "POST",
    headers: { ...desk.headers, "Content-Type": "application/json", [OPERATOR_PROOF_HEADER]: idToken(OLU) },
    body: JSON.stringify(body),
  });
}

async function refused(subject: string, body = {}): Promise<OperatorRefuseResponse> {
  const res = await refuse(subject, { reason: "harassment", ...body });
  if (!res.ok) throw new Error(`refuse refused: ${await res.text()}`);
  return (await res.json()) as OperatorRefuseResponse;
}

/** Prove an address at `/api/attest`, as a browser would after a sign-in. */
async function prove(badge: TestBadge, email: string): Promise<Response> {
  return fetch(`${base}${ATTEST_ROUTE}`, {
    method: "POST",
    headers: { ...badge.headers, "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: idToken(email) }),
  });
}

/** Knock for a fresh bearer badge, and hand back the raw response. */
async function knock(): Promise<Response> {
  return fetch(`${base}${DOOR_ROUTE}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ carrier: "bearer" }),
  });
}

const ledger = async (): Promise<OperatorAct[]> => {
  const res = await fetch(`${base}/api/operator/log`, {
    headers: { ...desk.headers, [OPERATOR_PROOF_HEADER]: idToken(OLU) },
  });
  return ((await res.json()) as OperatorLogResponse).acts;
};

// ---------------------------------------------------------------------------

describe("proving a refused address", () => {
  it("is refused at /api/attest with the home's sentence, and never written", async () => {
    await refused(`email:${SAM}`);
    const badge = await mintTestBadge(base);
    const res = await prove(badge, SAM);
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code: string; reason: string; error: string };
    expect(body.code).toBe(NOT_ADMITTED);
    expect(body.reason).toBe(REFUSED);
    expect(body.error).toContain(`will not admit ${SAM}`);
    expect(body.error).toContain("Write to olu@example.test");
    // A different address proves fine — the refusal is one address, not all.
    const ok = await prove(badge, "kai@example.test");
    expect(ok.status).toBe(200);
  });
});

describe("refusing an address ends every badge that proved it", () => {
  it("ends the badge, names the operator on its 401, and the reach counts it", async () => {
    // Sam's laptop proves the address and is admitted to the canvas.
    const laptop = await mintTestBadge(base);
    expect((await prove(laptop, SAM)).status).toBe(200);
    expect((await fetch(`${base}/api/projects/${CANVAS}`, { headers: laptop.headers })).status).toBe(200);

    const answer = await refused(`email:${SAM}`);
    expect(answer.reach.kind).toBe("email");
    expect(answer.reach.ended).toContain(laptop.badgeId);
    expect(answer.sentence).toContain(`will not admit ${SAM}`);

    // The laptop's next request meets the ended 401, naming the operator.
    const after = await fetch(`${base}/api/projects/${CANVAS}`, { headers: laptop.headers });
    expect(after.status).toBe(401);
    const body = (await after.json()) as { code: string; reason: string; error: string };
    expect(body.code).toBe(BADGE_ENDED);
    expect(body.reason).toBe("operator");
    expect(body.error).toContain("This surface was ended by the operator");
  });
});

describe("a network refused at the mint meter", () => {
  it("turns away a knock with the sentence, and lets it through once --for expires", async () => {
    // Loopback keys the meter on 127.0.0.1, so this test's own knock is inside.
    const answer = await refused("net:127.0.0.0/8", { reason: "spam", for: "10m" });
    expect(answer.reach.kind).toBe("net");
    expect(answer.refusal.expiresAt).toBeTruthy();

    const turned = await knock();
    expect(turned.status).toBe(403);
    const body = (await turned.json()) as { code: string; reason: string; error: string };
    expect(body.code).toBe(NOT_ADMITTED);
    expect(body.reason).toBe(REFUSED);
    expect(body.error).toContain("will not admit 127.0.0.0/8");

    // Move the clock past the ten minutes: the refusal is gone on its own.
    clock += 11 * 60_000;
    const back = await knock();
    expect(back.status).toBe(200);
    expect(((await back.json()) as DoorResponse).badgeId).toBeTruthy();
  });

  it("a network defaults to a day when --for is not given", async () => {
    const answer = await refused("net:127.0.0.0/8", { reason: "spam" });
    const ms = Date.parse(answer.refusal.expiresAt!) - clock;
    expect(ms).toBeGreaterThan(23 * 3_600_000);
    expect(ms).toBeLessThanOrEqual(24 * 3_600_000);
  });
});

describe("a refused actor cannot come back", () => {
  it("refuses actor.claim {as} with the home's sentence", async () => {
    // Sam is a live actor: a badge speaks as him.
    const laptop = await mintTestBadge(base);
    await laptop.speakAs({ id: "usr_sam", name: "Sam" });
    await refused("actor:usr_sam");

    // A modified client re-claims the name on a fresh badge — refused.
    const other = await mintTestBadge(base);
    const res = await fetch(`${base}/api/ops`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...other.headers },
      body: JSON.stringify({
        canvasId: null,
        op: { type: "actor.claim", sessionKey: "s-evil", as: "usr_sam", name: "Sam" },
      }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string; error: string };
    expect(body.code).toBe(REFUSED);
    expect(body.error).toContain("will not admit usr_sam");
  });
});

describe("--lift, and the record", () => {
  it("lifts a refusal so the address proves again, keeping both acts in the ledger", async () => {
    await refused(`email:${SAM}`);
    const badge = await mintTestBadge(base);
    expect((await prove(badge, SAM)).status).toBe(403);

    const lift = await refuse(`email:${SAM}`, { lift: true });
    expect(lift.status).toBe(200);
    const fresh = await mintTestBadge(base);
    expect((await prove(fresh, SAM)).status).toBe(200);

    const rows = (await ledger()).filter((a) => a.act === "refuse" && a.target === `email:${SAM}`);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.outcome === "done")).toBe(true);
    expect(rows.some((r) => (r.reach as { lifted?: boolean } | undefined)?.lifted)).toBe(true);
  });

  it("writes the row before it answers and settles it, and refuses a bad subject and a missing reason", async () => {
    const bad = await refuse("net:garbage", { reason: "spam" });
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as { code: string }).code).toBe("bad-subject");

    const noReason = await refuse(`email:${SAM}`, {});
    expect(noReason.status).toBe(400);
    expect(((await noReason.json()) as { code: string }).code).toBe("no-reason");
    // Refused, and in the ledger: somebody with a proof asked this home to act.
    expect((await ledger()).some((r) => r.act === "refuse" && r.outcome === "no-reason")).toBe(true);

    const nothing = await refuse(`email:${SAM}`, { lift: true });
    expect(nothing.status).toBe(409);
    expect(((await nothing.json()) as { code: string }).code).toBe("nothing-to-lift");
  });
});

describe("the registry survives a restart", () => {
  it("re-reads the refusals from the desk at boot", async () => {
    await refused(`email:${SAM}`, { note: "kai's report" });
    await daemon.close();
    await boot();
    const badge = await mintTestBadge(base);
    const res = await prove(badge, SAM);
    expect(res.status).toBe(403);
    expect(((await res.json()) as { reason: string }).reason).toBe(REFUSED);
  });
});

describe("a home with no operator", () => {
  it("refuses the whole operator prefix, so refuse is unreachable without one", async () => {
    const bare = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-refuse-noop-"));
    const plain = await startDaemon({ port: 0, home: bare, birthHome: null });
    try {
      const addr = plain.app.server.address();
      const at = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
      const b = await mintTestBadge(at);
      const res = await fetch(`${at}/api/operator/refuse/${encodeURIComponent(`email:${SAM}`)}`, {
        method: "POST",
        headers: { ...b.headers, "Content-Type": "application/json", [OPERATOR_PROOF_HEADER]: "x" },
        body: JSON.stringify({ reason: "spam" }),
      });
      expect(res.status).toBe(400);
      expect(((await res.json()) as { code: string }).code).toBe("no-operator");
    } finally {
      await plain.close();
      await fs.rm(bare, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });
});
