import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createSign, generateKeyPairSync } from "node:crypto";
import { WebSocket } from "ws";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ATTEST_ROUTE,
  grantsRoute,
  NO_OPERATOR_PROOF,
  OPERATOR_PROOF_HEADER,
  SPACES_ROUTE,
  spaceCanvasRoute,
  spaceGrantsRoute,
  WITHDRAWN,
  WS_NOT_ADMITTED,
  type GrantResponse,
  type GrantsResponse,
  type OperatorAct,
  type OperatorLogResponse,
  type OperatorRevokeResponse,
  type SpaceResponse,
} from "@isocan/core";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

/**
 * **`isocan operator revoke`** — operator phase 5, walked against a real
 * daemon with a real desk (journey 8, as far as a daemon on this machine can
 * walk it).
 *
 * The owner's revoke and its sweep are proved in `grants.test.ts` and
 * `sweep.test.ts`. What this file proves is the OPERATOR's part: the same
 * row turned off by the proof instead of `own`, on a canvas and on a space,
 * by the subject a report names, with `--bar`; the tombstone carrying
 * `revokedVia: "operator"` and the operator's half, so `GET …/grants` hands
 * both surfaces the sentence; the socket inside closing `withdrawn`, as an
 * owner's revoke closes it; the ledger row before every answer, refusals
 * included — and the acceptance's last line, that **the owner's act is the
 * owner's**: she turns the link back on with an ordinary grant write, no
 * proof, and the ledger holds the operator's row and not hers.
 *
 * The tokens are signed with a key pair this file generated, as
 * `operator-end.test.ts` does. What needs a person: the browser half of the
 * proof, the Share dialog in a real tab, and the walk on dev.
 *
 * Fixtures are synthetic: Acme, Priya, Jordan, Olu.
 */

const PROJECT = "isocan-io-dev";
const auth = { project: PROJECT, apiKey: "browser-key-not-a-secret" };
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const keys = { kid_1: publicKey.export({ type: "spki", format: "pem" }) as string };
const OLU = "olu@example.test";
const JORDAN = "jordan@example.test";

const priya = { id: "usr_priya", name: "Priya" };
const CANVAS = "prj_acme";

let home: string;
let daemon: Daemon;
let base: string;
/** Priya, who made the canvas. */
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
  });
  const address = daemon.app.server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
}

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-operator-revoke-"));
  await boot();
  owner = await mintTestBadge(base);
  await owner.speakAs(priya);
  desk = await mintTestBadge(base);
  await makeCanvas(CANVAS);
});

afterEach(async () => {
  await daemon?.close();
  daemon = undefined as unknown as Daemon;
  await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

const get = (badge: TestBadge, url: string) => fetch(`${base}${url}`, { headers: badge.headers });
const send = (badge: TestBadge, method: string, url: string, body: unknown = {}) =>
  fetch(`${base}${url}`, {
    method,
    headers: { "Content-Type": "application/json", ...badge.headers },
    body: JSON.stringify(body),
  });

async function makeCanvas(canvasId: string): Promise<void> {
  const made = await send(owner, "POST", "/api/ops", {
    canvasId: null,
    actor: priya,
    op: { type: "project.create", canvasId, title: `Acme ${canvasId}` },
  });
  if (!made.ok) throw new Error(await made.text());
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
async function revoke(
  target: string,
  body: { subject: string; reason?: string; note?: string; bar?: boolean },
  proof: string | null = idToken(OLU),
): Promise<Response> {
  return fetch(`${base}/api/operator/revoke/${encodeURIComponent(target)}`, {
    method: "POST",
    headers: {
      ...desk.headers,
      "Content-Type": "application/json",
      ...(proof ? { [OPERATOR_PROOF_HEADER]: proof } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function revoked(target: string, body: { subject: string; reason?: string; bar?: boolean }) {
  const res = await revoke(target, { reason: "spam", ...body });
  if (!res.ok) throw new Error(`revoke refused: ${await res.text()}`);
  return (await res.json()) as OperatorRevokeResponse;
}

/** The ledger, minus the rows that reading it writes. */
const ledger = async (): Promise<OperatorAct[]> => {
  const res = await fetch(`${base}/api/operator/log`, {
    headers: { ...desk.headers, [OPERATOR_PROOF_HEADER]: idToken(OLU) },
  });
  return ((await res.json()) as OperatorLogResponse).acts.filter((row) => row.act !== "log");
};

const grantsOf = async (url: string): Promise<GrantsResponse> =>
  (await (await get(owner, url)).json()) as GrantsResponse;

/** A stranger who proved an address, as a browser does at the sign-in page. */
async function proving(email: string): Promise<TestBadge> {
  const badge = await mintTestBadge(base);
  const res = await send(badge, "POST", ATTEST_ROUTE, { idToken: idToken(email) });
  if (!res.ok) throw new Error(`attest refused: ${await res.text()}`);
  return badge;
}

/** A socket, open and having heard its hello. In an object, so the async
 * wrapper does not flatten the close promise into the wait. */
async function openSocket(badge: TestBadge, canvasId = CANVAS): Promise<{ closed: Promise<[number, string]> }> {
  const ws = new WebSocket(`${base.replace("http:", "ws:")}/ws?canvasId=${canvasId}`, { headers: badge.headers });
  const closed = new Promise<[number, string]>((resolve) => {
    ws.on("close", (code, reason) => resolve([code, String(reason)]));
  });
  await new Promise<void>((resolve, reject) => {
    ws.on("error", reject);
    ws.once("message", () => resolve());
  });
  return { closed };
}

const SENTENCE = /^Turned off by the operator of this home on \d+ \w+ \d{4}: spam\. Write to olu@example\.test\.$/;

describe("the link, on a canvas (journey 8)", () => {
  it("turns it off with the proof in place of own: the tombstone says the operator, the stranger is shown out withdrawn", async () => {
    // Jordan came in by the link and has a tab open.
    const jordan = await mintTestBadge(base);
    expect((await get(jordan, `/api/projects/${CANVAS}`)).status).toBe(200);
    const tab = await openSocket(jordan);

    const answer = await revoked(CANVAS, { subject: "link" });
    expect(answer.target).toEqual({ kind: "canvas", id: CANVAS });
    expect(answer.reached).toBe(1);
    expect(answer.swept.expelled).toBe(1);
    expect(answer.sentence).toMatch(SENTENCE);
    // The row: the badge that carried the proof as `revokedBy`, as every desk
    // write records the surface — and `revokedVia` saying whose act it was,
    // with the operator's half beside it.
    expect(answer.grant.revokedBy).toBe(desk.badgeId);
    expect(answer.grant.revokedVia).toBe("operator");
    expect(answer.grant.revocation).toMatchObject({ reason: "spam", by: `email:${OLU}` });

    // Step 2: the sweep runs as it does for an owner. The tab closes
    // `withdrawn` — not `taken-down`, which is the canvas's word — and the
    // door refuses the next request; invited members (here, the owner) stay.
    expect(await tab.closed).toEqual([WS_NOT_ADMITTED, WITHDRAWN]);
    expect((await get(jordan, `/api/projects/${CANVAS}`)).status).toBe(403);
    expect((await get(owner, `/api/projects/${CANVAS}`)).status).toBe(200);
    expect((await get(await mintTestBadge(base), `/api/projects/${CANVAS}`)).status).toBe(403);

    // Step 3: what Priya's Share reads. No live link — and the tombstone,
    // handed over as `turnedOff` so the dialog and `isocan share` can say
    // the sentence instead of a badge id.
    const shown = await grantsOf(grantsRoute(CANVAS));
    expect(shown.grants.find((g) => g.subject === "link")).toBeUndefined();
    expect(shown.turnedOff).toHaveLength(1);
    expect(shown.turnedOff![0]).toMatchObject({ id: answer.grant.id, revokedVia: "operator" });

    // The ledger: one row, `revoke`, done, with the reason — and the row's
    // id is the one the tombstone points back at.
    const rows = await ledger();
    expect(rows.map((row) => row.act)).toEqual(["revoke"]);
    expect(rows[0]).toMatchObject({ target: CANVAS, reason: "spam", outcome: "done", badgeId: desk.badgeId });
    expect(answer.grant.revocation!.actId).toBe(rows[0]!.id);
    expect(rows[0]!.reach).toMatchObject({ subject: "link", reached: 1 });
  });

  it("the owner turns it back on: an ordinary grant, no proof, and NOT in the operator's ledger", async () => {
    await revoked(CANVAS, { subject: "link" });
    const before = await ledger();

    // Priya's Share toggle: `POST …/grants`, her badge, nothing else.
    const again = await send(owner, "POST", grantsRoute(CANVAS), { subject: "link" });
    expect(again.status, await again.clone().text()).toBe(200);
    const { grant } = (await again.json()) as GrantResponse;
    expect(grant.revokedAt).toBeUndefined();

    // The link is on and the notice is gone: a re-grant is a new row, as it
    // always was, and the operator's tombstone is no longer the last word.
    const shown = await grantsOf(grantsRoute(CANVAS));
    expect(shown.grants.map((g) => g.subject)).toContain("link");
    expect(shown.turnedOff).toBeUndefined();
    expect((await get(await mintTestBadge(base), `/api/projects/${CANVAS}`)).status).toBe(200);

    // The owner's act is the owner's: the ledger holds the operator's row and
    // not hers.
    const after = await ledger();
    expect(after.map((row) => row.id)).toEqual(before.map((row) => row.id));
    expect(after).toHaveLength(1);
  });

  it("survives a restart: the file desk replays the operator's half, not a plainer tombstone", async () => {
    const answer = await revoked(CANVAS, { subject: "link" });
    await daemon.close();
    await boot();
    const shown = await grantsOf(grantsRoute(CANVAS));
    expect(shown.turnedOff).toHaveLength(1);
    expect(shown.turnedOff![0]).toMatchObject({
      id: answer.grant.id,
      revokedVia: "operator",
      revocation: answer.grant.revocation,
    });
  });
});

describe("a named subject, on a space, with --bar", () => {
  let space: SpaceResponse["space"];
  let jordan: TestBadge;
  const SECOND = "prj_acme_2";

  beforeEach(async () => {
    await makeCanvas(SECOND);
    const made = await send(owner, "POST", SPACES_ROUTE, { name: "Design" });
    if (!made.ok) throw new Error(await made.text());
    space = ((await made.json()) as SpaceResponse).space;
    for (const canvasId of [CANVAS, SECOND]) {
      const added = await send(owner, "PUT", spaceCanvasRoute(space.id, canvasId), {});
      if (!added.ok) throw new Error(await added.text());
    }
    // Jordan is invited on the space by address, and proves it.
    const invited = await send(owner, "POST", spaceGrantsRoute(space.id), { subject: `email:${JORDAN}` });
    if (!invited.ok) throw new Error(await invited.text());
    jordan = await proving(JORDAN);
    for (const canvasId of [CANVAS, SECOND]) {
      expect((await get(jordan, `/api/projects/${canvasId}`)).status).toBe(200);
    }
  });

  it("reaches every canvas in the space, writes the bar as the owner's ?bar=1 does, and the ledger names the space", async () => {
    const tabs = [await openSocket(jordan, CANVAS), await openSocket(jordan, SECOND)];
    const answer = await revoked(space.id, { subject: `email:${JORDAN}`, bar: true });
    expect(answer.target).toEqual({ kind: "space", id: space.id });
    expect(answer.reached).toBe(2);
    expect(answer.swept.expelled).toBe(2);
    expect(answer.grant).toMatchObject({ spaceId: space.id, revokedVia: "operator" });
    expect(answer.bar).toMatchObject({ spaceId: space.id, subject: `email:${JORDAN}`, bars: true });

    for (const tab of tabs) expect(await tab.closed).toEqual([WS_NOT_ADMITTED, WITHDRAWN]);
    for (const canvasId of [CANVAS, SECOND]) {
      expect((await get(jordan, `/api/projects/${canvasId}`)).status).toBe(403);
    }

    // The space's Share: the bar live in `grants`, the invitation in
    // `turnedOff` with the sentence.
    const shown = await grantsOf(spaceGrantsRoute(space.id));
    expect(shown.grants.map((g) => g.id)).toEqual([answer.bar!.id]);
    expect(shown.turnedOff!.map((g) => g.id)).toEqual([answer.grant.id]);

    const rows = await ledger();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ act: "revoke", target: space.id, reason: "spam", outcome: "done" });
    expect(rows[0]!.reach).toMatchObject({ subject: `email:${JORDAN}`, bar: answer.bar!.id, reached: 2 });
  });

  it("the owner lifts the bar and re-invites, both without a proof, and the ledger does not grow", async () => {
    const answer = await revoked(space.id, { subject: `email:${JORDAN}`, bar: true });
    const before = await ledger();
    // Let back in: the bar's revoke is the ordinary DELETE (roles phase 3).
    const lifted = await fetch(`${base}${spaceGrantsRoute(space.id)}/${answer.bar!.id}`, {
      method: "DELETE",
      headers: owner.headers,
    });
    expect(lifted.status, await lifted.clone().text()).toBe(200);
    // Re-invite: a new row, and the operator's notice goes with it.
    const again = await send(owner, "POST", spaceGrantsRoute(space.id), { subject: `email:${JORDAN}` });
    expect(again.status, await again.clone().text()).toBe(200);
    const shown = await grantsOf(spaceGrantsRoute(space.id));
    expect(shown.turnedOff).toBeUndefined();
    expect((await get(jordan, `/api/projects/${SECOND}`)).status).toBe(200);
    expect((await ledger()).map((row) => row.id)).toEqual(before.map((row) => row.id));
  });
});

describe("the record, and the refusals", () => {
  it("needs a reason from the list, and records the refusal", async () => {
    const res = await revoke(CANVAS, { subject: "link", reason: "because" });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { code: string }).code).toBe("no-reason");
    // Nothing was turned off …
    expect((await grantsOf(grantsRoute(CANVAS))).grants.map((g) => g.subject)).toEqual(["link"]);
    // … and the ledger says somebody with a proof asked.
    expect((await ledger()).map((row) => [row.act, row.outcome])).toEqual([["revoke", "no-reason"]]);
  });

  it("refuses a subject with no live row, so a revoke is never silently nothing", async () => {
    const res = await revoke(CANVAS, { subject: `email:${JORDAN}`, reason: "spam" });
    expect(res.status).toBe(404);
    expect(((await res.json()) as { code: string }).code).toBe("nothing-to-revoke");
    expect((await ledger()).map((row) => row.outcome)).toEqual(["nothing-to-revoke"]);
  });

  it("refuses --bar on the link before anything is written, as the owner's route does", async () => {
    const res = await revoke(CANVAS, { subject: "link", reason: "spam", bar: true });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { code: string }).code).toBe("bad-grant");
    // The link stands: a refusal leaves the row exactly as it was.
    const shown = await grantsOf(grantsRoute(CANVAS));
    expect(shown.grants.map((g) => g.subject)).toEqual(["link"]);
    expect(shown.turnedOff).toBeUndefined();
  });

  it("refuses to revoke a bar — that would let somebody in, which is the owner's to do", async () => {
    const barred = await send(owner, "POST", grantsRoute(CANVAS), { subject: `email:${JORDAN}`, bars: true });
    expect(barred.status, await barred.clone().text()).toBe(200);
    const res = await revoke(CANVAS, { subject: `email:${JORDAN}`, reason: "spam" });
    expect(res.status).toBe(409);
    expect(((await res.json()) as { code: string }).code).toBe("is-a-bar");
    expect((await grantsOf(grantsRoute(CANVAS))).grants.some((g) => g.bars === true)).toBe(true);
  });

  it("refuses a caller with no proof and writes nothing — an agent holding this CLI cannot turn anything off", async () => {
    const res = await revoke(CANVAS, { subject: "link", reason: "spam" }, null);
    expect(res.status).toBe(403);
    expect(((await res.json()) as { code: string }).code).toBe(NO_OPERATOR_PROOF);
    expect((await grantsOf(grantsRoute(CANVAS))).grants.map((g) => g.subject)).toEqual(["link"]);
    expect(await ledger()).toEqual([]);
  });

  it("answers 404 for a canvas that is not here, and records that it was asked", async () => {
    const res = await revoke("prj_nowhere", { subject: "link", reason: "spam" });
    expect(res.status).toBe(404);
    expect(((await res.json()) as { code: string }).code).toBe("unknown-canvas");
    expect((await ledger()).map((row) => [row.target, row.outcome])).toEqual([["prj_nowhere", "unknown-canvas"]]);
  });
});
