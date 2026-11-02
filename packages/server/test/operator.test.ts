import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createSign, generateKeyPairSync } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  NO_OPERATOR,
  NO_OPERATOR_PROOF,
  NOT_OPERATOR,
  OPERATOR_PROOF_HEADER,
  PROOF_STALE,
  type OperatorAct,
  type OperatorLogResponse,
  type OperatorShowResponse,
  type GrantsResponse,
  grantsRoute,
  grantRevokeRoute,
  LINK,
} from "@isocan/core";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { operatorAbsence, resolveOperators } from "../src/operator.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

/**
 * **The operator, proved** — operator phase 1, walked against a real daemon.
 *
 * The tokens are signed here with a key pair this file generated and the
 * daemon is handed the public half through `signingKeys`, exactly as
 * `resumption.test.ts` does: the one injected seam, argued in `attest.ts`.
 * Everything downstream of the signature is the production path — the same
 * `verifyIdToken`, the same `ISOCAN_OPERATORS` comparison, the same desk, the
 * same routes.
 *
 * What is proved here is everything in the phase's acceptance that does not
 * need a browser, a Google account or dev.isocan.io:
 *
 * - `show` on a canvas the operator was **never admitted to** prints its
 *   reach, and changes nothing;
 * - an address that is not on the list is refused **with that address named**;
 * - a sign-in older than the window is refused **saying how long ago**, and it
 *   is a different refusal from the one above;
 * - a home with **no attester** answers every operator route with one sentence
 *   saying so, and a home with an attester and no list says the other one;
 * - **every act writes its ledger row before it answers** — the project's one
 *   rule — including the refusals, so both acts are in `log`.
 *
 * What needs a person is the browser half: the prove page, the loopback
 * hand-over, and a second Google account. Those are the ⚑ steps.
 */

const PROJECT = "isocan-io-dev";
const auth = { project: PROJECT, apiKey: "browser-key-not-a-secret" };
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const keys = { kid_1: publicKey.export({ type: "spki", format: "pem" }) as string };

const OLU = "olu@example.test";
const ANA = "ana@example.test";

let home: string;
let daemon: Daemon;
let base: string;
/** Priya, who made the canvas. The operator is never admitted to it. */
let owner: TestBadge;
/** The operator's own surface: an ordinary badge, admitted to nothing. */
let desk: TestBadge;
let canvasId: string;

async function boot(options: { attester?: typeof auth | null; operators?: string[] } = {}) {
  daemon = await startDaemon({
    port: 0,
    home,
    birthHome: null,
    auth: options.attester === undefined ? auth : options.attester,
    operators: options.operators ?? [`email:${OLU}`],
    signingKeys: async () => keys,
  });
  const address = daemon.app.server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  owner = await mintTestBadge(base);
  await owner.speakAs({ id: "usr_priya", name: "Priya" });
  desk = await mintTestBadge(base);
}

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-operator-"));
});

afterEach(async () => {
  // Guarded: the pure describes below never boot one, and a teardown that
  // threw there would report a passing unit test as a failure.
  await daemon?.close();
  daemon = undefined as unknown as Daemon;
  await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

/**
 * A token as Identity Platform mints one, with an `auth_time` this test
 * chooses. The default is "a moment ago", which is what a person who just
 * signed in has.
 */
function idToken(email: string, options: { authTimeMs?: number | null } = {}): string {
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: "RS256", kid: "kid_1", typ: "JWT" });
  const authTime =
    options.authTimeMs === null
      ? {}
      : { auth_time: Math.floor((options.authTimeMs ?? Date.now()) / 1000) };
  const body = b64({
    iss: `https://securetoken.google.com/${PROJECT}`,
    aud: PROJECT,
    sub: `uid_${email}`,
    iat: now - 60,
    exp: now + 3600,
    email,
    email_verified: true,
    firebase: { sign_in_provider: "google.com" },
    ...authTime,
  });
  const signer = createSign("RSA-SHA256");
  signer.update(`${head}.${body}`);
  return `${head}.${body}.${signer.sign(privateKey).toString("base64url")}`;
}

const b64 = (value: unknown): string => Buffer.from(JSON.stringify(value)).toString("base64url");

/** An operator request: the badge through the door, the proof in one header. */
const act = async (route: string, proof?: string): Promise<Response> =>
  fetch(`${base}${route}`, {
    headers: {
      ...desk.headers,
      ...(proof !== undefined ? { [OPERATOR_PROOF_HEADER]: proof } : {}),
    },
  });

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

/**
 * Close the canvas, so "a canvas the operator was never admitted to" is the
 * real thing rather than a phrase. A new canvas carries a live link grant and
 * the address admits — that is isocan's model — so a badge with the id gets in
 * like anybody, operator or not. Turning the link off is what makes the next
 * assertion mean something.
 */
async function turnTheLinkOff(): Promise<void> {
  const listed = await fetch(`${base}${grantsRoute(canvasId)}`, { headers: owner.headers });
  const { grants } = (await listed.json()) as GrantsResponse;
  const link = grants.find((grant) => grant.subject === LINK);
  if (!link) throw new Error("a fresh canvas should have a link grant");
  const off = await fetch(`${base}${grantRevokeRoute(canvasId, link.id)}`, {
    method: "DELETE",
    headers: owner.headers,
  });
  if (!off.ok) throw new Error(`could not turn the link off: ${await off.text()}`);
}

describe("ISOCAN_OPERATORS, read beside the attester", () => {
  it("is empty when nothing is set — a daemon with no operator, which is every one in this repo", () => {
    expect(resolveOperators({})).toEqual([]);
    expect(resolveOperators({ ISOCAN_OPERATORS: "   " })).toEqual([]);
  });

  it("normalizes, because the comparison at request time is equality", () => {
    // `Olu@Example.Test` and `olu@example.test` are one mailbox. A list that
    // kept both spellings would be an operator who is sometimes not one, and
    // the failure would be invisible: the variable is set, the address is
    // right, and nothing matches.
    expect(resolveOperators({ ISOCAN_OPERATORS: "email:Olu@Example.Test" })).toEqual([
      "email:olu@example.test",
    ]);
  });

  it("takes a comma list, and folds a repeat", () => {
    expect(
      resolveOperators({ ISOCAN_OPERATORS: `email:${OLU}, email:${ANA} ,email:${OLU}` }),
    ).toEqual([`email:${OLU}`, `email:${ANA}`]);
  });
});

describe("a home with nobody to prove to", () => {
  it("says it has borrowed no attester, and what setting one up takes", async () => {
    // Journey 11 step 2, as a unit before it is a route: the sentence names
    // both variables, so whoever is reading it knows what to go and do.
    const why = operatorAbsence(null, [`email:${OLU}`]);
    expect(why).toMatch(/borrows no attester/);
    expect(why).toMatch(/ISOCAN_AUTH_PROJECT/);
    expect(why).toMatch(/ISOCAN_OPERATORS/);
  });

  it("says the OTHER thing when it has an attester and an empty list", () => {
    // Two homes reach this, and answering both with one sentence would leave
    // whoever configured the second one reading about the first.
    const why = operatorAbsence(auth, []);
    expect(why).toMatch(/names nobody as its operator/);
    expect(why).not.toMatch(/borrows no attester/);
  });

  it("answers every operator route with it, on a real daemon", async () => {
    // The refusal is on the PREFIX, in the door hook, so a verb added in
    // phase 2 cannot forget it. Both of phase 1's routes are asked here, and
    // neither handler is reached.
    await boot({ attester: null });
    canvasId = await makeCanvas();
    for (const route of [`/api/operator/canvases/${canvasId}`, "/api/operator/log"]) {
      const res = await act(route, idToken(OLU));
      expect(res.status, route).toBe(400);
      const body = (await res.json()) as { error: string; code: string };
      expect(body.code, route).toBe(NO_OPERATOR);
      expect(body.error, route).toMatch(/borrows no attester/);
    }
  });

  it("and does it for a home whose list is empty, in the other words", async () => {
    await boot({ operators: [] });
    const res = await act("/api/operator/log", idToken(OLU));
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toMatch(/names nobody as its operator/);
  });
});

describe("proving it, per act", () => {
  beforeEach(async () => {
    await boot();
    canvasId = await makeCanvas();
  });

  it("shows what the home holds under an id the operator was never admitted to", async () => {
    /**
     * Journey 1 step 4, and the load-bearing half is what is NOT here: this
     * badge has no admission to this canvas and never gets one. The operator
     * routes are not canvas-scoped, so the door's admission hook does not run
     * — which is the whole point, and is why `show` is the first verb.
     */
    await turnTheLinkOff();
    expect(
      (await fetch(`${base}/api/projects/${canvasId}/canvas`, { headers: desk.headers })).status,
      "the operator's badge is an ordinary badge (journey 12), refused like anyone",
    ).toBe(403);

    const res = await act(`/api/operator/canvases/${canvasId}`, idToken(OLU));
    expect(res.status).toBe(200);
    const { reach } = (await res.json()) as OperatorShowResponse;
    expect(reach.canvasId).toBe(canvasId);
    expect(reach.title).toBe("Acme quarterly");
    expect(reach.madeBy.name).toBe("Priya");
    expect(reach.badges).toBe(1); // Priya's, who made it. Not the operator's.
    expect(reach.sockets).toBe(0);
    expect(reach.files).toBe(0);
    expect(reach.bytes).toBe(0);
    expect(reach.replicas).toEqual([]);
    // A number, never a list: "no names of people other than the maker" is the
    // journey's line, and a roster is the thing this surface must never grow.
    expect(typeof reach.badges).toBe("number");
  });

  it("refuses an address that is not on the list, NAMING the address that was proved", async () => {
    // Journey 1 step 5, verbatim in spirit: Olu's colleague runs the same
    // command and proves her own address. Naming it is the refusal's whole
    // content — a person with two accounts needs to know which one arrived.
    const res = await act(`/api/operator/canvases/${canvasId}`, idToken(ANA));
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string; code: string };
    expect(body.code).toBe(NOT_OPERATOR);
    expect(body.error).toContain(ANA);
    expect(body.error).toMatch(/named in its configuration/);
  });

  it("refuses a sign-in older than the window, saying how long ago", async () => {
    // Journey 1 step 6: ten minutes later the browser asks again. Eleven
    // minutes here, because the boundary is the thing being asserted.
    const stale = idToken(OLU, { authTimeMs: Date.now() - 11 * 60_000 });
    const res = await act(`/api/operator/canvases/${canvasId}`, stale);
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string; code: string };
    expect(body.code).toBe(PROOF_STALE);
    expect(body.error).toMatch(/you signed in 11m ago/);
    expect(body.error).toMatch(/10m/);
  });

  it("still honours one from nine minutes ago — the window is a window", async () => {
    const res = await act(
      `/api/operator/canvases/${canvasId}`,
      idToken(OLU, { authTimeMs: Date.now() - 9 * 60_000 }),
    );
    expect(res.status).toBe(200);
  });

  it("treats a stranger's stale sign-in as a stranger, not as a stale proof", async () => {
    // The order of the two checks is the message. Telling somebody who is not
    // the operator that their proof was merely STALE would tell them a fresh
    // one would have worked.
    const res = await act(
      `/api/operator/canvases/${canvasId}`,
      idToken(ANA, { authTimeMs: Date.now() - 11 * 60_000 }),
    );
    expect(((await res.json()) as { code: string }).code).toBe(NOT_OPERATOR);
  });

  it("refuses a token with no auth_time, because absent is not 'just now'", async () => {
    const res = await act(
      `/api/operator/canvases/${canvasId}`,
      idToken(OLU, { authTimeMs: null }),
    );
    expect(res.status).toBe(403);
    expect(((await res.json()) as { code: string }).code).toBe(PROOF_STALE);
  });

  it("refuses a request carrying no proof at all — the one an agent meets", async () => {
    // Journey 10's shape at the route: a caller holding only a badge. The code
    // is its own, because `not-operator` names an address and there is none.
    const res = await act(`/api/operator/canvases/${canvasId}`);
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string; code: string };
    expect(body.code).toBe(NO_OPERATOR_PROOF);
    expect(body.error).toMatch(/nothing on a badge to borrow/);
  });

  it("refuses a badge-less caller as the door does, before it says anything about operators", async () => {
    // The order of two facts: a caller with no badge is told about the badge,
    // which is what it must fix before the operator answer is even reachable.
    const res = await fetch(`${base}/api/operator/log`);
    expect(res.status).toBe(401);
  });

  it("writes no operator standing anywhere — there is nothing to borrow", async () => {
    // Decision D2, asserted where it would show: after a successful act, the
    // badge that carried it has exactly the attestations it had before, which
    // is none. This is what makes journey 10 step 3 true.
    await act(`/api/operator/canvases/${canvasId}`, idToken(OLU));
    const offer = await (await fetch(`${base}/api/attest`, { headers: desk.headers })).json();
    expect((offer as { attestations: unknown[] }).attestations).toEqual([]);
  });
});

describe("the ledger — every act writes its row before it answers", () => {
  beforeEach(async () => {
    await boot();
    canvasId = await makeCanvas();
  });

  const log = async (query = ""): Promise<OperatorAct[]> => {
    const res = await act(`/api/operator/log${query}`, idToken(OLU));
    if (!res.ok) throw new Error(`log refused: ${await res.text()}`);
    return ((await res.json()) as OperatorLogResponse).acts;
  };

  it("records a look, with what proved it and which surface carried it", async () => {
    await act(`/api/operator/canvases/${canvasId}`, idToken(OLU));
    const rows = await log();
    const shown = rows.find((row) => row.act === "show");
    expect(shown).toBeDefined();
    expect(shown!.target).toBe(canvasId);
    expect(shown!.outcome).toBe("done");
    expect(shown!.proof.attribute).toBe(`email:${OLU}`);
    // The badge is on the row: "the request still carries its badge through
    // the door unchanged, so the ledger knows which surface carried the proof".
    expect(shown!.badgeId).toBe(desk.badgeId);
    // A hash, never the token. The ledger is a record, not a place a live
    // credential is kept.
    expect(shown!.proof.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(shown)).not.toContain("eyJ");
  });

  it("records the REFUSAL too — both acts are in the log", async () => {
    /**
     * The phase's acceptance says *both acts are in `log`*, and this is the
     * decision that makes it true: a refused act is the interesting one. An
     * address the home does not recognise, at a moment, asking this home to
     * act, is the single thing an operator ledger exists to be able to answer
     * about afterwards.
     */
    await act(`/api/operator/canvases/${canvasId}`, idToken(OLU));
    await act(`/api/operator/canvases/${canvasId}`, idToken(ANA));
    const rows = await log();
    const shows = rows.filter((row) => row.act === "show");
    expect(shows).toHaveLength(2);
    expect(shows.map((row) => row.outcome).sort()).toEqual(["done", NOT_OPERATOR].sort());
    expect(shows.find((row) => row.outcome === NOT_OPERATOR)!.proof.attribute).toBe(
      `email:${ANA}`,
    );
  });

  it("records a stale proof as stale, so 'they tried again later' is readable", async () => {
    await act(`/api/operator/canvases/${canvasId}`, idToken(OLU, { authTimeMs: Date.now() - 11 * 60_000 }));
    expect((await log()).some((row) => row.outcome === PROOF_STALE)).toBe(true);
  });

  it("writes NOTHING for a token that does not verify — nobody proved anything", async () => {
    // There is no address to name and no act to attribute, so a row would be a
    // record of a stranger's ability to post a string.
    const before = (await log()).length;
    const res = await act(`/api/operator/canvases/${canvasId}`, "not.a.jwt");
    expect(res.status).toBe(400);
    // One row more, and it is this `log` call itself — never the bad token.
    const after = await log();
    expect(after.filter((row) => row.act === "show")).toHaveLength(0);
    expect(after.length).toBe(before + 1);
  });

  it("is itself an act: reading the log is in the log", async () => {
    // Not recursive — the row goes down before the read, so it is never in its
    // own answer — and it is the property the design asks for about a LOOK: an
    // act is never unrecorded, even when it is unannounced.
    const first = await log();
    // Its OWN row is the newest one in the answer, saying `attempted`: the row
    // goes down before the act runs, and this act is the reading. The rule,
    // visible rather than hidden.
    expect(first.filter((row) => row.act === "log")).toHaveLength(1);
    expect(first[0]!.outcome).toBe("attempted");
    const second = await log();
    expect(second.filter((row) => row.act === "log")).toHaveLength(2);
    // And the first one has since settled — a row still saying `attempted` on
    // a later read is a crash, which is the whole reason it is two writes.
    expect(second.filter((row) => row.outcome === "attempted")).toHaveLength(1);
  });

  it("narrows to one target, which is how a report is answered", async () => {
    await act(`/api/operator/canvases/${canvasId}`, idToken(OLU));
    const rows = await log(`?target=${canvasId}`);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.target === canvasId)).toBe(true);
  });

  it("survives a restart, because the row is durable before the answer", async () => {
    // The whole reason it is a logged desk row rather than memory: an act
    // whose record was lost is a power that was exercised and cannot be
    // accounted for.
    await act(`/api/operator/canvases/${canvasId}`, idToken(OLU));
    await daemon.close();
    await boot();
    const rows = await log();
    expect(rows.some((row) => row.act === "show" && row.target === canvasId)).toBe(true);
  });

  it("is read by the operator and nobody else — the log needs the same proof", async () => {
    const res = await act("/api/operator/log", idToken(ANA));
    expect(res.status).toBe(403);
    expect(((await res.json()) as { code: string }).code).toBe(NOT_OPERATOR);
  });
});
