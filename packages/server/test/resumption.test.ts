import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generateKeyPairSync, createSign } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  ATTEST_ROUTE,
  grantsRoute,
  grantRoute,
  type AttestOffer,
  type AttestResponse,
  type BadgesResponse,
  type GrantResponse,
  type GrantsResponse,
} from "@isocan/core";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

/**
 * **The half of phase 9 stage 1 could not demonstrate, demonstrated** — plus
 * the mechanism that pays for it (identity desk, mechanisms 3 and 6).
 *
 * Stage 1's finding said it plainly: *"the only subject a badge can satisfy
 * today is `link`, a canvas has exactly one live link row, and `email:` cannot
 * be granted until something can attest one. So the half of the sweep that
 * stops a revocation being a purge is real code with eleven tests and no
 * reachable surface."* Everything here is that surface arriving:
 *
 * - a badge PROVES an address (a real token, a real signature — see
 *   `attest.test.ts` for the verification's own suite);
 * - an `email:` grant is written, and the door genuinely admits on it;
 * - turning the link off expels the stranger and RE-ROOTS the person who was
 *   invited by name — the design's whole sentence, run end to end for the
 *   first time;
 * - and a second badge that proves the same address may RESUME the actor the
 *   first one claimed, which is the phase's Outcome sentence: *"a phone
 *   resumes its person by attestation."*
 *
 * The tokens are signed here with a key pair this file generated, and the
 * daemon is handed the public half through `signingKeys` — the one injected
 * seam, argued in `attest.ts`. Everything downstream of the signature is the
 * production path: the same `verifyIdToken`, the same `Desk.attest`, the same
 * `admittingGrant`, the same `sweepCanvas`.
 */

const PROJECT = "isocan-io-dev";
const auth = { project: PROJECT, apiKey: "browser-key-not-a-secret" };
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const keys = { kid_1: publicKey.export({ type: "spki", format: "pem" }) as string };

const CANVAS = "prj_desk";
const jordan = { id: "usr_jordan", name: "Jordan" };

let home: string;
let daemon: Daemon;
let base: string;
/** Priya, who made the canvas and does the sharing. */
let owner: TestBadge;

async function boot(attester: typeof auth | null): Promise<void> {
  daemon = await startDaemon({
    port: 0,
    home,
    homeUrl: null,
    auth: attester,
    signingKeys: async () => keys,
  });
  const address = daemon.app.server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  owner = await mintTestBadge(base);
  await owner.speakAs({ id: "usr_priya", name: "Priya" });
}

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-attest-"));
  await boot(auth);
});

afterEach(async () => {
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true });
});

/** A token exactly as Identity Platform mints one for this project. */
function idToken(email: string, provider = "password"): string {
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
    firebase: { sign_in_provider: provider },
  });
  const signer = createSign("RSA-SHA256");
  signer.update(`${head}.${body}`);
  return `${head}.${body}.${signer.sign(privateKey).toString("base64url")}`;
}

const b64 = (value: unknown): string => Buffer.from(JSON.stringify(value)).toString("base64url");

/**
 * A request from one badge.
 *
 * The content-type is sent only WITH a body, deliberately: a `DELETE`
 * declaring `application/json` and sending nothing is a Fastify parse error
 * (`FST_ERR_CTP_EMPTY_JSON_BODY`), which `http.ts` now answers as the 400 it
 * always was. A helper that set the header unconditionally would turn every
 * revocation in this file into a 400 whose body has no `swept` — and the
 * assertions would read as "the sweep did nothing" rather than "the request
 * never arrived". Which is exactly what happened while this file was being
 * written.
 */
const api = async (
  badge: TestBadge,
  method: string,
  route: string,
  body?: unknown,
): Promise<Response> =>
  fetch(`${base}${route}`, {
    method,
    headers: body !== undefined
      ? { "Content-Type": "application/json", ...badge.headers }
      : { ...badge.headers },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

/** Prove an address on a badge, through the route a browser drives. */
async function prove(badge: TestBadge, email: string): Promise<AttestResponse> {
  const res = await api(badge, "POST", ATTEST_ROUTE, { idToken: idToken(email) });
  if (!res.ok) throw new Error(`attest refused: ${await res.text()}`);
  return (await res.json()) as AttestResponse;
}

async function makeCanvas(): Promise<void> {
  const res = await api(owner, "POST", "/api/ops", {
    projectId: null,
    actor: { id: "usr_priya", name: "Priya" },
    op: { type: "project.create", projectId: CANVAS, title: "Acme board" },
  });
  if (!res.ok) throw new Error(`could not make the canvas: ${await res.text()}`);
}

const grants = async (badge: TestBadge): Promise<GrantsResponse> =>
  (await api(badge, "GET", grantsRoute(CANVAS))).json() as Promise<GrantsResponse>;

/** Ask for the canvas — the request the door judges. */
const knock = (badge: TestBadge): Promise<Response> =>
  api(badge, "GET", `/api/projects/${CANVAS}/canvas`);

describe("what a home has borrowed, over the wire", () => {
  it("offers the browser its project and key at run time, never baked in", async () => {
    const offer = (await (await api(owner, "GET", ATTEST_ROUTE)).json()) as AttestOffer;
    expect(offer.attesters).toEqual(["email"]);
    // The page is handed these by the home, which is what makes one image run
    // at dev.isocan.io, at isocan.io and on a laptop that has borrowed
    // nothing. A bundle with them compiled in would be a per-home artifact.
    expect(offer.auth).toEqual(auth);
    expect(offer.attestations).toEqual([]);
    expect(offer.resumable).toEqual([]);
  });

  it("answers honestly on a home that has borrowed nothing, and refuses both ends", async () => {
    await daemon.close();
    await boot(null);
    await makeCanvas();

    const offer = (await (await api(owner, "GET", ATTEST_ROUTE)).json()) as AttestOffer;
    expect(offer.attesters).toEqual([]);
    expect(offer.auth).toBeNull();

    // Nothing to verify against, so a token is refused rather than cheerfully
    // written into a ledger no door will ever read.
    const attested = await api(owner, "POST", ATTEST_ROUTE, { idToken: idToken("a@b.test") });
    expect(attested.status).toBe(400);
    expect(((await attested.json()) as { code: string }).code).toBe("no-attester");

    // And the grant side refuses with the same fact from the other direction:
    // a row that admits nobody while a dialog claims somebody was invited.
    const granted = await api(owner, "POST", grantsRoute(CANVAS), {
      subject: "email:jordan@acme.test",
    });
    expect(granted.status).toBe(400);
    expect(((await granted.json()) as { code: string }).code).toBe("no-attester");
  });

  it("writes the row onto the badge that presented the token, and nowhere else", async () => {
    const jo = await mintTestBadge(base);
    const written = await prove(jo, "Jordan@Acme.Test");
    // Normalized on the way in, once, so the door's equality never folds
    // anything at request time.
    expect(written.attestation.attribute).toBe("email:jordan@acme.test");
    expect(written.attestation.verifiedVia).toBe("magic-link");

    const mine = (await (await api(jo, "GET", ATTEST_ROUTE)).json()) as AttestOffer;
    expect(mine.attestations.map((row) => row.attribute)).toEqual(["email:jordan@acme.test"]);
    // Somebody else's badge is untouched: verifying decorates the badge the
    // holder already carries, and nothing else.
    const other = (await (await api(owner, "GET", ATTEST_ROUTE)).json()) as AttestOffer;
    expect(other.attestations).toEqual([]);
  });

  it("shows a person what each of their surfaces has proved", async () => {
    const jo = await mintTestBadge(base);
    await jo.speakAs(jordan);
    await prove(jo, "jordan@acme.test");
    const { badges } = (await (await api(jo, "GET", "/api/badges")).json()) as BadgesResponse;
    const self = badges.find((row) => row.self)!;
    expect(self.attested).toEqual(["email:jordan@acme.test"]);
  });
});

describe("an email grant admits the person it names", () => {
  it("refuses a badge that has proved nothing, and admits it the moment it has", async () => {
    await makeCanvas();
    // The link off first, so the ONLY way in is the name.
    const live = (await grants(owner)).grants.find((g) => g.subject === "link")!;
    await api(owner, "DELETE", grantRoute(CANVAS, live.id));

    const jo = await mintTestBadge(base);
    expect((await knock(jo)).status).toBe(403);

    const invited = await api(owner, "POST", grantsRoute(CANVAS), {
      subject: "email:jordan@acme.test",
    });
    expect(invited.status).toBe(200);
    // Still nothing: a grant is not an admission, and Jordan has proved
    // nothing yet. This is the beat stage 1 could describe and not reach.
    expect((await knock(jo)).status).toBe(403);

    await prove(jo, "jordan@acme.test");
    expect((await knock(jo)).status).toBe(200);

    // And the admission is rooted at the row that admitted her, which is what
    // revocation grips.
    const record = (await daemon.desk.badge(jo.badgeId))!;
    expect(record.admissions.find((a) => a.canvasId === CANVAS)!.provenance).toEqual({
      root: "grant",
      grantId: ((await invited.json()) as GrantResponse).grant.id,
    });
  });

  it("un-inviting somebody expels them", async () => {
    await makeCanvas();
    const link = (await grants(owner)).grants.find((g) => g.subject === "link")!;
    await api(owner, "DELETE", grantRoute(CANVAS, link.id));
    const invited = (await (
      await api(owner, "POST", grantsRoute(CANVAS), { subject: "email:jordan@acme.test" })
    ).json()) as GrantResponse;

    const jo = await mintTestBadge(base);
    await prove(jo, "jordan@acme.test");
    expect((await knock(jo)).status).toBe(200);

    const revoked = (await (
      await api(owner, "DELETE", grantRoute(CANVAS, invited.grant.id))
    ).json()) as GrantResponse;
    expect(revoked.swept).toEqual({ expelled: 1, rerooted: 0 });
    expect((await knock(jo)).status).toBe(403);
  });
});

describe("turning the link off keeps the people invited by name", () => {
  /**
   * **The sentence the whole sweep was built for, played out.**
   *
   * *"Revoking Jordan's email grant expels her tab, her daemon, and Nico in
   * one pass — while turning off the link expels only those no other grant
   * covers: it stops strangers without expelling the invited."*
   *
   * The second half had no reachable surface until this stage, because `link`
   * was the only subject a badge could satisfy and a canvas has exactly one
   * live link row. Here it is: a stranger on the link, Jordan on the link too
   * (it is the older row, so it is the one she is rooted at), an email grant
   * standing beside it — and one revocation that treats them differently.
   */
  it("expels the stranger and re-roots the invited, in one sweep", async () => {
    await makeCanvas();
    const link = (await grants(owner)).grants.find((g) => g.subject === "link")!;
    await api(owner, "POST", grantsRoute(CANVAS), { subject: "email:jordan@acme.test" });

    // Jordan proves her address and comes in. The LINK is the older row, so
    // `admittingGrant` roots her there — which is exactly the setup the design
    // warns about, and the reason re-rooting has to exist at all.
    const tab = await mintTestBadge(base);
    await prove(tab, "jordan@acme.test");
    expect((await knock(tab)).status).toBe(200);
    expect((await daemon.desk.badge(tab.badgeId))!.admissions[0]!.provenance).toEqual({
      root: "grant",
      grantId: link.id,
    });

    // Her daemon, enrolled by a pass from that tab — one hop down the chain
    // the sweep walks, and the badge stage 1's finding says was expelled a
    // moment before the tab re-rooted in the first implementation.
    const minted = (await (
      await api(tab, "POST", `/api/projects/${CANVAS}/passes`)
    ).json()) as { token: string };
    const laptop = await mintTestBadge(base);
    await api(laptop, "POST", "/api/passes/redeem", { token: minted.token });

    // And a stranger, who has proved nothing and is here on the link alone.
    const stranger = await mintTestBadge(base);
    expect((await knock(stranger)).status).toBe(200);

    const off = (await (
      await api(owner, "DELETE", grantRoute(CANVAS, link.id))
    ).json()) as GrantResponse;

    // The stranger is out. Jordan is still in, under the grant that invited
    // her by name — and so is her laptop, because a chain adopts its minter's
    // OUTCOME rather than its stale root.
    expect((await knock(stranger)).status).toBe(403);
    expect((await knock(tab)).status).toBe(200);
    expect((await knock(laptop)).status).toBe(200);
    expect((await daemon.desk.badge(tab.badgeId))!.admissions[0]!.provenance).toEqual({
      root: "grant",
      grantId: (await grants(owner)).grants.find((g) => g.subject.startsWith("email:"))!.id,
    });
    // Priya created it, so she is untouched; the owner's badge is the one root
    // a sweep never reconsiders.
    expect((await knock(owner)).status).toBe(200);
    // 1 expelled (the stranger), 1 re-rooted (Jordan's tab). Her laptop is
    // neither: its chain still resolves, so nothing was written for it.
    expect(off.swept).toEqual({ expelled: 1, rerooted: 1 });
  });
});

describe("a phone resumes its person by attestation", () => {
  /**
   * **Mechanism 6, and the tightening that makes it worth having.**
   *
   * The design's complaint about resumption was that it had it backwards:
   * *"today the honest path is refused (name taken) and the dishonest one
   * (`as:`) is open to anyone."* Both halves change here — the dishonest one
   * closes for a caller that cannot name the conversation, and the honest one
   * opens for a caller that can prove the inbox.
   */
  const beJordan = (badge: TestBadge, sessionKey: string): Promise<Response> =>
    api(badge, "POST", "/api/ops", {
      projectId: null,
      op: { type: "actor.claim", sessionKey, as: jordan.id },
    });

  it("refuses a stranger who knows the actor id, and admits the badge that proved the address", async () => {
    const laptop = await mintTestBadge(base);
    await laptop.speakAs(jordan);
    await prove(laptop, "jordan@acme.test");

    // A stranger who read Jordan's actor id off the canvas — they are in every
    // op envelope — and made up a session key. Before this stage they would
    // have been Jordan half an hour after she went quiet.
    const stranger = await mintTestBadge(base);
    const refused = await beJordan(stranger, "someone-else:1");
    expect(refused.status).toBe(400);
    const body = (await refused.json()) as { code: string; error: string };
    expect(body.code).toBe("name-taken");
    expect(body.error).toMatch(/another surface already speaks as them/);

    // Jordan's phone: same address, proved. The offer says so BEFORE she acts,
    // which is what lets a surface show a button rather than a refusal.
    const phone = await mintTestBadge(base);
    await prove(phone, "jordan@acme.test");
    const offer = (await (await api(phone, "GET", ATTEST_ROUTE)).json()) as AttestOffer;
    expect(offer.resumable).toEqual([jordan]);

    const resumed = await beJordan(phone, "web:phone-1");
    expect(resumed.status).toBe(200);
    expect(((await resumed.json()) as { envelope: { actor: unknown } }).envelope.actor).toEqual(
      jordan,
    );
    // Both surfaces are Jordan now, which is the point: what the offer
    // promised and what the reducer accepted are one computation.
    const { badges } = (await (await api(phone, "GET", "/api/badges")).json()) as BadgesResponse;
    expect(badges).toHaveLength(2);
    // And there is nothing left to resume — she is already this actor.
    const after = (await (await api(phone, "GET", ATTEST_ROUTE)).json()) as AttestOffer;
    expect(after.resumable).toEqual([]);
  });

  it("does not vouch across DIFFERENT addresses", async () => {
    const laptop = await mintTestBadge(base);
    await laptop.speakAs(jordan);
    await prove(laptop, "jordan@acme.test");

    // Somebody who proved an address of their own has proved nothing about
    // Jordan. The vouch is a shared attribute, not a signed-in-ness.
    const nico = await mintTestBadge(base);
    await prove(nico, "nico@acme.test");
    expect(((await (await api(nico, "GET", ATTEST_ROUTE)).json()) as AttestOffer).resumable).toEqual(
      [],
    );
    expect((await beJordan(nico, "web:nico-1")).status).toBe(400);
  });

  it("composes with kill-a-badge, in the order the two rules imply", async () => {
    /**
     * **The stolen-laptop case, with the phone standing where Jordan is.**
     *
     * It takes two gestures and the order is not arbitrary, which is worth
     * pinning because it is the first place these two mechanisms meet.
     * Kill-a-badge's rule is *a badge may end a badge that shares an IDENTITY
     * with it* — a claim on an actor this badge also claims — and phase 9
     * stage 1 chose that narrowness on purpose, so that a link-admitted
     * stranger could never end the sharer's recognition. A badge that has
     * only proved an address holds no claim yet, so it is not yet one of
     * Jordan's surfaces: it has to BE her first.
     *
     * Which is exactly the gesture attestation just made possible, and it is
     * the one the person wanted anyway. Prove the address, be Jordan on this
     * phone, end the laptop.
     */
    const laptop = await mintTestBadge(base);
    await laptop.speakAs(jordan);
    await prove(laptop, "jordan@acme.test");
    const phone = await mintTestBadge(base);
    await prove(phone, "jordan@acme.test");

    // Not yet: proving an address is not, on its own, claiming an identity.
    const early = await api(phone, "DELETE", `/api/badges/${laptop.badgeId}`);
    expect(early.status).toBe(403);
    expect(((await early.json()) as { code: string }).code).toBe("not-your-badge");

    // Be her — vouched by the shared attestation — and then end it.
    expect((await beJordan(phone, "web:phone-1")).status).toBe(200);
    const ended = await api(phone, "DELETE", `/api/badges/${laptop.badgeId}`);
    expect(ended.status).toBe(200);

    // A killed badge holds nothing and vouches for nobody: it is out of the
    // resumable listing and out of the query behind it.
    expect(await daemon.desk.badgesAttesting("email:jordan@acme.test")).toHaveLength(1);
    const { badges } = (await (await api(phone, "GET", "/api/badges")).json()) as BadgesResponse;
    expect(badges.map((row) => row.badgeId)).toEqual([phone.badgeId]);
  });
});
