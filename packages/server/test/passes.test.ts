import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type {
  GrantsResponse,
  LogEntry,
  MintPassResponse,
  RedeemPassResponse,
} from "@isocan/core";
import {
  grantRoute,
  grantsRoute,
  PASS_EXPIRED,
  PASS_REDEEM_ROUTE,
  PASS_SPENT,
  PASS_TTL_MS,
  PASS_UNKNOWN,
  passesRoute,
  UNKNOWN_ROUTE,
} from "@isocan/core";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { HomeRefusedError } from "../src/home-link.ts";
import { mintPass } from "../src/passes.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

/**
 * **The escalation pass** (journey, Scene 5; identity desk, mechanism 1's
 * collapse of 7 and 8; phase 8, stage 1).
 *
 * Jordan is standing on a canvas in a tab the home admitted. She wants her own
 * machine in here — so the tab she is already trusted in mints a short-lived,
 * single-use pass, and the surface that redeems it comes away **admitted** and
 * **holding her identity**. Credentials flow outward from an admitted session;
 * nothing is typed inward at a door, and nobody self-claims a worn name.
 *
 * What is asserted here is the Proof's four things — single-use, short TTL,
 * named claim, admission-only form — plus the two that make them mean
 * something: that the minter must hold what it endows, and that the redeemed
 * badge can then **do something it could not do a moment earlier**. Recording
 * an admission and enforcing one are different, and only the second is worth
 * shipping.
 *
 * Fixtures are synthetic throughout: Acme, Priya, Jordan.
 */

const priya = { id: "usr_priya", name: "Priya" };
const jordan = { id: "usr_jordan", name: "Jordan" };
/** Jordan's agent, born on her machine — an actor no badge at the home holds. */
const nico = { id: "usr_nico", name: "Nico" };
const CANVAS = "prj_acme";

let home: string;
let daemon: Daemon;
let base: string;
/** Priya: made the canvas, so her badge is admitted with `{root: "created"}`. */
let owner: TestBadge;

/** A badge that has never been anywhere. Jordan's browser; Jordan's laptop. */
const fresh = () => mintTestBadge(base);

async function post(badge: TestBadge, url: string, body: unknown): Promise<Response> {
  return fetch(`${base}${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...badge.headers },
    body: JSON.stringify(body),
  });
}

const get = (badge: TestBadge, url: string) => fetch(`${base}${url}`, { headers: badge.headers });

async function makeCanvas(): Promise<void> {
  const made = await post(owner, "/api/ops", {
    canvasId: null,
    actor: priya,
    op: { type: "project.create", canvasId: CANVAS, title: "Acme Sprint Board" },
  });
  if (!made.ok) throw new Error(`could not create the canvas: ${await made.text()}`);
}

/** Turn the link off, so admission stops being free and the pass has to work
 * for its living. Every assertion about "could not before" needs this. */
async function revokeLink(): Promise<void> {
  const { grants } = (await (await get(owner, grantsRoute(CANVAS))).json()) as GrantsResponse;
  const off = await fetch(`${base}${grantRoute(CANVAS, grants[0]!.id)}`, {
    method: "DELETE",
    headers: owner.headers,
  });
  if (!off.ok) throw new Error(`could not revoke the link: ${await off.text()}`);
}

const mint = (badge: TestBadge, actorId?: string) =>
  post(badge, passesRoute(CANVAS), actorId ? { actorId } : {});

const redeem = (badge: TestBadge, token: string) =>
  post(badge, PASS_REDEEM_ROUTE, { token });

async function body<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

/** One synthetic item, in the shape the reducer wants. */
const item = (itemId: string) => ({
  type: "item.add" as const,
  itemId,
  version: {
    id: `ver_${itemId}`,
    blobHash: `h_${itemId}`,
    mimeType: "text/markdown",
    filename: `${itemId}.md`,
    size: 4,
  },
  width: 100,
  height: 80,
  placement: { x: 5, y: 6 },
});

/** Jordan, arriving thin: her tab enters on the link and claims her name. */
async function jordansTab(): Promise<TestBadge> {
  const tab = await fresh();
  const seen = await get(tab, `/api/projects/${CANVAS}/canvas`); // admitted by the link
  if (!seen.ok) throw new Error(`Jordan could not reach the canvas: ${await seen.text()}`);
  await tab.speakAs(jordan, "web:jordan");
  return tab;
}

/** Poll until something is true, or say what we were waiting for — a timeout
 * with no evidence teaches people to re-run (lessons.md). */
async function waitFor(ready: () => Promise<boolean>, what: string, ms = 5000): Promise<void> {
  const until = Date.now() + ms;
  for (;;) {
    if (await ready()) return;
    if (Date.now() > until) throw new Error(`timed out after ${ms}ms waiting for ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-passes-"));
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  owner = await mintTestBadge(base);
  await owner.speakAs(priya);
  await makeCanvas();
});

afterEach(async () => {
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true });
});

describe("minting is for the admitted, and only for what they hold", () => {
  it("refuses a badge that is not admitted to the canvas", async () => {
    await revokeLink();
    const stranger = await fresh();
    const refused = await mint(stranger);
    // 403 and not 401: the badge is perfectly good, it is simply not in this
    // room, and sending it back to the door would mint credentials forever.
    expect(refused.status).toBe(403);
    expect((await body<{ code: string }>(refused)).code).toBe("not-admitted");
  });

  it("refuses to endow a claim the minter does not hold", async () => {
    // Priya is admitted and may mint all she likes — but she is not Jordan,
    // and a pass that handed over somebody else's identity would be
    // impersonation with a wrapper on it. The refusal is mechanism 5's own,
    // spoken by the check that already exists.
    const refused = await mint(owner, jordan.id);
    expect(refused.status).toBe(400);
    expect((await body<{ code: string }>(refused)).code).toBe("not-your-actor");
  });

  it("hands the token over once, keeps no secret, and expires in fifteen minutes", async () => {
    const tab = await jordansTab();
    const res = await mint(tab, jordan.id);
    expect(res.status, await res.clone().text()).toBe(200);
    const { pass, token } = await body<MintPassResponse>(res);

    // `<passId>.<secret>` — the badge's dot idiom, one parser for both.
    expect(token.startsWith(`${pass.id}.`)).toBe(true);
    expect(pass.id).toMatch(/^pss_/);
    // The row that crosses the wire carries no secret in any spelling.
    expect(JSON.stringify(pass)).not.toContain(token.slice(pass.id.length + 1));
    expect(pass).not.toHaveProperty("secretHash");
    expect(pass).toMatchObject({ canvasId: CANVAS, mintedBy: tab.badgeId, actorId: jordan.id });
    expect(Date.parse(pass.expiresAt) - Date.parse(pass.createdAt)).toBe(PASS_TTL_MS);
    // Fifteen minutes is a copy-a-command-and-walk-to-a-terminal number; if
    // somebody changes it, this says so out loud rather than at 3am.
    expect(PASS_TTL_MS).toBe(15 * 60 * 1000);
  });

  it("is desk state and NEVER an op — the oplog does not learn that passes exist", async () => {
    const tab = await jordansTab();
    const before = await body<LogEntry[]>(await get(owner, `/api/projects/${CANVAS}/oplog?since=0`));
    const { token } = await body<MintPassResponse>(await mint(tab, jordan.id));
    await redeem(await fresh(), token);
    const after = await body<LogEntry[]>(await get(owner, `/api/projects/${CANVAS}/oplog?since=0`));
    // A pass is an innkeeper's row, like a grant. Nothing about who may enter
    // a canvas belongs in the history every replica gets a copy of.
    expect(after.map((entry) => entry.seq)).toEqual(before.map((entry) => entry.seq));
  });
});

describe("redeeming: the surface arrives knowing who it is", () => {
  it("admits the redeemer and hands over the named claim — and it could do neither before", async () => {
    const tab = await jordansTab();
    /**
     * **The pass is minted BEFORE the link goes off, and phase 9 is why.**
     *
     * Jordan's tab came in on the link, so revoking it now SWEEPS her — she
     * cannot mint anything from a canvas she has just been expelled from, and
     * minting is canvas-scoped precisely so that only an admitted badge can.
     * The order here is the honest one and it makes a sharper point than the
     * old order did: a pass is a desk ROW with a life of its own, so it
     * outlives the admission that produced it. That is what "admitted
     * whatever the link says" actually rests on.
     */
    const { token } = await body<MintPassResponse>(await mint(tab, jordan.id));
    await revokeLink();
    const laptop = await fresh();

    // Before: not in the room, and nobody.
    const shut = await get(laptop, `/api/projects/${CANVAS}/canvas`);
    expect(shut.status).toBe(403);
    const notHer = await post(laptop, "/api/ops", {
      canvasId: CANVAS,
      actor: jordan,
      op: item("itm_1"),
    });
    expect(notHer.status).toBe(403);

    const redeemed = await redeem(laptop, token);
    expect(redeemed.status, await redeemed.clone().text()).toBe(200);
    expect(await body<RedeemPassResponse>(redeemed)).toEqual({ canvasId: CANVAS, actor: jordan });

    // After: in the room — the only assertion that proves the admission is
    // real rather than recorded.
    expect((await get(laptop, `/api/projects/${CANVAS}/canvas`)).status).toBe(200);
    // And speaking as her. This is the half a recorded admission cannot fake:
    // the reducer stamps `usr_jordan` on the op, and mechanism 5 let it.
    const wrote = await post(laptop, "/api/ops", {
      canvasId: CANVAS,
      actor: jordan,
      op: item("itm_1"),
    });
    expect(wrote.status, await wrote.clone().text()).toBe(200);

    // Two badges, one actor — "Jordan's tab and her daemon", which `bindClaim`
    // has anticipated since phase 3. Neither is unseated by the other.
    expect((await daemon.desk.claimsOf(tab.badgeId)).map((row) => row.actorId)).toContain(jordan.id);
    const handed = await daemon.desk.claimsOf(laptop.badgeId);
    expect(handed.map((row) => row.actorId)).toEqual([jordan.id]);
    // A handoff carries no session key: nobody presented one, and a string the
    // home cannot verify has no business in the one field it must not trust.
    expect(handed[0]!.sessionKey).toBeUndefined();
  });

  it("lets the endowed badge key the identity it was handed, while the minter's tab is live", async () => {
    const tab = await jordansTab();
    // A live face on the canvas, wearing Jordan — the condition `reincarnate`
    // refuses `as` under, and the condition that HOLDS at the moment a pass is
    // redeemed, because the tab that minted it is still open.
    const session = await post(tab, `/api/projects/${CANVAS}/sessions`, { actor: jordan });
    expect(session.status, await session.clone().text()).toBe(200);

    const laptop = await fresh();
    const { token } = await body<MintPassResponse>(await mint(tab, jordan.id));
    expect((await redeem(laptop, token)).status).toBe(200);

    // The CLI on the new machine names its conversation, as it always does.
    // Without this, the second surface could never rename itself, and a
    // replica's `ensureClaim` would be refused after every daemon restart —
    // the handed claim would be unusable by the only mechanism that uses it.
    const keyed = await post(laptop, "/api/ops", {
      canvasId: null,
      op: { type: "actor.claim", sessionKey: "claude-code:s-1", as: jordan.id },
    });
    expect(keyed.status, await keyed.clone().text()).toBe(200);
    expect((await body<LogEntry>(keyed)).envelope.actor).toEqual(jordan);
    // One row per actor per badge: the handoff became the keyed claim rather
    // than sitting beside it.
    const rows = await daemon.desk.claimsOf(laptop.badgeId);
    expect(rows.map((row) => [row.actorId, row.sessionKey])).toEqual([
      [jordan.id, "claude-code:s-1"],
    ]);

    // And a stranger still cannot: the widening is about a badge that was
    // HANDED this actor, never about the actor being popular.
    const thief = await fresh();
    const stolen = await post(thief, "/api/ops", {
      canvasId: null,
      op: { type: "actor.claim", sessionKey: "claude-code:s-2", as: jordan.id },
    });
    expect(stolen.status).toBe(400);
    expect((await body<{ code: string }>(stolen)).code).toBe("name-taken");
  });

  it("writes provenance the sweep can walk: {root: pass, badgeId of the MINTER}", async () => {
    const tab = await jordansTab();
    const laptop = await fresh();
    const { token } = await body<MintPassResponse>(await mint(tab, jordan.id));
    expect((await redeem(laptop, token)).status).toBe(200);

    // Phase 9's sweep walks admissions whose root names a revoked grant and
    // re-runs the door test on each; a pass-derived admission is reached by
    // following this badge id back to the badge that vouched it in. Mis-root
    // it and the sweep is silently incomplete — `desk.ts` says so where the
    // type is declared, which is why this is asserted rather than assumed.
    const record = await daemon.desk.badge(laptop.badgeId);
    expect(record!.admissions).toHaveLength(1);
    expect(record!.admissions[0]).toMatchObject({
      canvasId: CANVAS,
      provenance: { root: "pass", badgeId: tab.badgeId },
    });
  });

  it("the admission-only form admits a surface that then claims its OWN actor", async () => {
    // Scene 6's shape: Inna's instruction line admits a cloud agent, and the
    // agent is Sonia rather than Inna. Also day-one `isocan open`, before the
    // human has an actor to resume at all.
    await revokeLink();
    const sandbox = await fresh();
    const { pass, token } = await body<MintPassResponse>(await mint(owner));
    expect(pass.actorId).toBeUndefined();

    const answer = await body<RedeemPassResponse>(await redeem(sandbox, token));
    expect(answer).toEqual({ canvasId: CANVAS });
    expect((await get(sandbox, `/api/projects/${CANVAS}/canvas`)).status).toBe(200);

    // Nobody was handed over, so the surface names itself — and is handed a
    // free name, not Priya's.
    const claimed = await post(sandbox, "/api/ops", {
      canvasId: null,
      op: { type: "actor.claim", sessionKey: "cloud:sonia", name: "Sonia" },
    });
    expect(claimed.status, await claimed.clone().text()).toBe(200);
    const { envelope } = await body<LogEntry>(claimed);
    expect(envelope.actor.name).toBe("Sonia");
    expect(envelope.actor.id).not.toBe(priya.id);
  });
});

describe("a pass is single-use and short-lived, and says which it was", () => {
  it("cannot be redeemed twice", async () => {
    const tab = await jordansTab();
    const { token } = await body<MintPassResponse>(await mint(tab, jordan.id));
    expect((await redeem(await fresh(), token)).status).toBe(200);

    const again = await redeem(await fresh(), token);
    // 409 and a code of its own: the answer will never change, so a client
    // must not retry — and "already used" is a different sentence from "no
    // such pass", which is the whole point of separating them.
    expect(again.status).toBe(409);
    const refusal = await body<{ code: string; error: string }>(again);
    expect(refusal.code).toBe(PASS_SPENT);
    expect(refusal.error).toContain("already redeemed");
  });

  it("refuses one that has aged out, and says so as its own answer", async () => {
    // Minted twenty minutes ago and written straight to the desk: the clock is
    // the thing under test, and a test that waited fifteen minutes for it
    // would be a test nobody runs.
    const stale = mintPass({
      canvasId: CANVAS,
      mintedBy: owner.badgeId,
      now: new Date(Date.now() - 20 * 60_000).toISOString(),
    });
    await daemon.desk.putPass(stale.record);

    const refused = await redeem(await fresh(), stale.token);
    expect(refused.status).toBe(410); // Gone: it existed, and it is over
    expect((await body<{ code: string }>(refused)).code).toBe(PASS_EXPIRED);
    // Expiry is judged, not swept: the row is still there, unspent.
    expect((await daemon.desk.pass(stale.record.id))!.redeemedAt).toBeUndefined();
  });

  it("answers the same way for a pass that never existed and a secret that does not match", async () => {
    const tab = await jordansTab();
    const { pass, token } = await body<MintPassResponse>(await mint(tab, jordan.id));

    const nonsense = await redeem(await fresh(), "pss_nothing.notasecret");
    expect(nonsense.status).toBe(404);
    expect((await body<{ code: string }>(nonsense)).code).toBe(PASS_UNKNOWN);

    // A real id with a wrong secret gets the SAME answer, deliberately: the
    // alternative is a guessing oracle over 256 bits, bought for a distinction
    // nobody could act on.
    const forged = await redeem(await fresh(), `${pass.id}.wrong`);
    expect(forged.status).toBe(404);
    expect((await body<{ code: string }>(forged)).code).toBe(PASS_UNKNOWN);

    // A mistyped token does not burn the good one: everything cheap happens
    // before the one irreversible step.
    expect((await redeem(await fresh(), token)).status).toBe(200);
  });

  it("gives exactly one winner when two surfaces redeem at the same instant", async () => {
    const tab = await jordansTab();
    const { token } = await body<MintPassResponse>(await mint(tab, jordan.id));
    const [a, b] = await Promise.all([fresh(), fresh()]);
    const [first, second] = await Promise.all([redeem(a, token), redeem(b, token)]);
    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 409]);

    // And only the winner got in. Two badges admitted by a pass that invited
    // one is the bug the desk's transaction exists to make impossible.
    const admitted = await Promise.all(
      [a, b].map(async (badge) => (await daemon.desk.badge(badge.badgeId))!.admissions.length),
    );
    expect(admitted.sort()).toEqual([0, 1]);
  });
});

describe("an unmatched /api path says so, in JSON, with a code", () => {
  /**
   * Phase 7.5's open finding, closed here because phase 8 is when it stops
   * being theoretical: a replica now asks its home to redeem a pass, and a
   * home deployed before this phase has no such route. Until now an unmatched
   * `/api/` path fell through to the SPA handler and answered **200 with the
   * web app**, which made a replica's version negotiation correct only because
   * parsing HTML as JSON throws.
   */
  it("answers 404 and a code, for every method", async () => {
    for (const method of ["GET", "POST", "DELETE"]) {
      const res = await fetch(`${base}/api/actors/free-name-that-never-was`, {
        method,
        headers: owner.headers,
      });
      expect(res.status, method).toBe(404);
      expect(res.headers.get("content-type"), method).toContain("application/json");
      const refusal = await body<{ code: string; error: string }>(res);
      expect(refusal.code, method).toBe(UNKNOWN_ROUTE);
      // Legible from the far end of a version skew, which is who asks.
      expect(refusal.error, method).toContain("older than the route");
    }
  });

  it("makes a replica's version negotiation fail LEGIBLY instead of by accident", async () => {
    // The concrete case phase 7.5 named: a replica asks its home for a name
    // that is free there (`GET /api/actors/free-name`), and a home older than
    // that route has no such route. Until now the answer was HTML with a 200
    // on it, and the fallback worked only because `res.json()` threw.
    //
    // Now the home refuses in JSON with a code — so `HomeLink.freeName` raises
    // `HomeRefusedError`, which is a refusal a caller can read — and the
    // fallback that matters still holds: a nameless claim on a replica is
    // allocated locally rather than failing.
    const replicaDir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-passes-old-"));
    const replica = await startDaemon({ port: 0, home: replicaDir, birthHome: base, homePollMs: 50 });
    const address = replica.app.server.address();
    const replicaBase = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
    try {
      // What talking to a home that predates the route looks like from here.
      const missing = await fetch(`${base}/api/actors/free-name`, {
        method: "POST", // the route exists for GET; POST is "no such route"
        headers: owner.headers,
      });
      expect(missing.status).toBe(404);
      expect((await body<{ code: string }>(missing)).code).toBe(UNKNOWN_ROUTE);

      // And the same shape at the seam that consumes it: `api()` turns that
      // body into a `HomeRefusedError` carrying the home's own code, which is
      // what an older home now looks like from a replica. Injected rather than
      // deployed, because the other way to get one is to check out phase 7.
      let asked = false;
      replica.homes.link(base)!.freeName = async () => {
        asked = true;
        throw new HomeRefusedError(404, "no such route", UNKNOWN_ROUTE);
      };

      const cli = await mintTestBadge(replicaBase);
      const claimed = await fetch(`${replicaBase}/api/ops`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...cli.headers },
        body: JSON.stringify({ canvasId: null, op: { type: "actor.claim", sessionKey: "cli:new" } }),
      });
      expect(claimed.status, await claimed.clone().text()).toBe(200);
      expect((await body<LogEntry>(claimed)).envelope.actor.name).toBeTruthy();
      expect(asked).toBe(true);
    } finally {
      await replica.close();
      await fs.rm(replicaDir, { recursive: true, force: true });
    }
  });

  it("leaves the routes that DO exist alone", async () => {
    // The guard is a prefix test, so the thing worth checking is that it does
    // not swallow the real routes beside it.
    expect((await get(owner, "/api/healthz")).status).toBe(200);
    expect((await get(owner, `/api/projects/${CANVAS}/canvas`)).status).toBe(200);
    // A canvas that is not here is still a 404 about a CANVAS, not about a
    // route — different code, and a caller acts on them differently.
    const missing = await get(owner, "/api/projects/prj_nope/canvas");
    expect(missing.status).toBe(404);
    expect((await body<{ code: string }>(missing)).code).toBe("unknown-canvas");
  });
});

describe("on a replica", () => {
  /**
   * **Scene 5's actual shape**: Jordan is in a tab at the home, and the thing
   * that redeems is a daemon on her own laptop.
   *
   * Both halves of that are asserted here, because both are needed and neither
   * is obvious:
   *
   * - **It forwards.** The pass row lives at the home's desk, and single-use
   *   is only single across the desk that holds the row. Redeeming locally
   *   would spend nothing and admit nobody where it counts.
   * - **It also writes locally.** The badge the home endows is this DAEMON's
   *   badge at the home; the badge in front of the redeem route is the CLI's
   *   badge on this machine, and mechanism 5's local half checks the local
   *   claims table. Without the local row, Jordan's agent would be admitted at
   *   the home and told `not-your-actor` by her own laptop.
   *
   * And one thing is deliberately NOT written: a local admission. A replicated
   * canvas gets a local link grant when it lands (`ensureHomeLinkGrant` — "who
   * on THIS machine may reach the local copy"), so the local door admits the
   * CLI badge on its own. That was the conductor's reading of what "correct"
   * means here, and this test is where it stopped being a reading: the local
   * badge has no admission of its own and reaches the canvas anyway.
   */
  it("forwards the redemption, and leaves the local ledger correct", async () => {
    const tab = await jordansTab();
    // Minted first, then the link goes off — see the note on the redemption
    // test above: a tab that came in on the link is swept when the link is
    // revoked, and a pass is a desk row that outlives the admission that
    // produced it. With the link off, nothing but that row can let this
    // machine in, which is what makes the assertions below about the pass.
    const { pass, token } = await body<MintPassResponse>(await mint(tab, jordan.id));
    await revokeLink();

    const replicaDir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-passes-replica-"));
    const replica = await startDaemon({ port: 0, home: replicaDir, birthHome: base, homePollMs: 50 });
    const address = replica.app.server.address();
    const replicaBase = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
    try {
      const cli = await mintTestBadge(replicaBase);

      // Before: this machine has never heard of the canvas. A replica's
      // 404 is "not replicated (yet)", which is the honest local answer.
      expect((await fetch(`${replicaBase}/api/projects/${CANVAS}/canvas`, { headers: cli.headers })).status).toBe(404);

      const redeemed = await fetch(`${replicaBase}${PASS_REDEEM_ROUTE}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...cli.headers },
        body: JSON.stringify({ token }),
      });
      expect(redeemed.status, await redeemed.clone().text()).toBe(200);
      expect(await body<RedeemPassResponse>(redeemed)).toEqual({ canvasId: CANVAS, actor: jordan });

      // Spent at the HOME's desk, which is the only desk that ever held the
      // row and therefore the only one that could refuse a second redemption.
      expect((await daemon.desk.pass(pass.id))!.redeemedAt).toBeDefined();
      expect(await replica.desk.pass(pass.id)).toBeNull();

      // The local claim row: written for the badge in front of the route, with
      // no session key, so the CLI on this machine may speak as Jordan.
      const local = await replica.desk.claimsOf(cli.badgeId);
      expect(local.map((row) => row.actorId)).toEqual([jordan.id]);
      // And the local registry learned her name, which no op had yet carried
      // to this machine.
      const names = (await (await fetch(`${replicaBase}/api/names`, { headers: cli.headers })).json()) as Record<string, string>;
      expect(names[jordan.id]).toBe("Jordan");

      // The canvas arrives: the home badge's new admission puts it in
      // `GET /api/projects` for this replica, the sweep dials it, and the
      // store fills in. This is the pass replacing discovery-by-enumeration —
      // the link is OFF, so nothing else could have listed it.
      await waitFor(async () => {
        const res = await fetch(`${replicaBase}/api/projects/${CANVAS}/canvas`, { headers: cli.headers });
        return res.status === 200;
      }, "the canvas to replicate after redemption");

      // No local admission was written for the CLI badge: what let it in was
      // the local link grant the replicated canvas brought with it.
      const record = await replica.desk.badge(cli.badgeId);
      expect(record!.admissions.map((a) => a.provenance.root)).toEqual(["grant"]);

      // And it can write as Jordan, all the way through: local check, forward,
      // the home's badge-level check, the home's single writer.
      const wrote = await fetch(`${replicaBase}/api/ops`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...cli.headers },
        body: JSON.stringify({ canvasId: CANVAS, actor: jordan, op: item("itm_replica") }),
      });
      expect(wrote.status, await wrote.clone().text()).toBe(200);
      const atHome = await body<LogEntry[]>(await get(owner, `/api/projects/${CANVAS}/oplog?since=0`));
      expect(atHome.some((entry) => entry.envelope.actor.id === jordan.id)).toBe(true);
    } finally {
      await replica.close();
      await fs.rm(replicaDir, { recursive: true, force: true });
    }
  });

  it("does not mint passes of its own — the row belongs to the desk that answers the door", async () => {
    const replicaDir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-passes-replica2-"));
    const replica = await startDaemon({ port: 0, home: replicaDir, birthHome: base, homePollMs: 50 });
    const address = replica.app.server.address();
    const replicaBase = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
    try {
      const cli = await mintTestBadge(replicaBase);
      // An actor born on THIS machine — Nico, Jordan's agent. Not Priya: she
      // is already claimed by a badge at the home, and a replica whose human
      // is also a tab at the home cannot announce her without a pass of its
      // own. That is the seam `HomeLink.announceActor` has named since phase 6
      // ("two badges holding one actor is what a PASS is for"), and phase 8 is
      // what makes it closable — by enrolling that machine, which is exactly
      // the flow the test above plays.
      await cli.speakAs(nico, "cli:nico");
      /**
       * The machine is ENROLLED before it can mint anything, which since phase
       * 8 stage 4 is the only way a replica comes to hold a canvas at all: it
       * mirrors what it was let into, and nothing had let this one in. (The
       * link grant is still on here — that used to be enough, by way of the
       * home listing itself to any badge that asked, and it deliberately is
       * not any more.)
       */
      const admission = await body<MintPassResponse>(await mint(owner));
      const joined = await fetch(`${replicaBase}${PASS_REDEEM_ROUTE}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...cli.headers },
        body: JSON.stringify({ token: admission.token }),
      });
      expect(joined.status, await joined.clone().text()).toBe(200);
      await waitFor(async () => {
        const res = await fetch(`${replicaBase}/api/projects/${CANVAS}/canvas`, { headers: cli.headers });
        return res.status === 200;
      }, "the canvas to replicate");

      const res = await fetch(`${replicaBase}${passesRoute(CANVAS)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...cli.headers },
        body: JSON.stringify({ actorId: nico.id }),
      });
      expect(res.status, await res.clone().text()).toBe(200);
      const { pass, token } = await body<MintPassResponse>(res);

      // The row is the HOME's — it is on the home's desk, not the replica's,
      // and it is redeemable there. A laptop minting its own passes would be
      // handing out admissions to a door it does not answer.
      expect(await daemon.desk.pass(pass.id)).not.toBeNull();
      expect(await replica.desk.pass(pass.id)).toBeNull();
      expect((await redeem(await fresh(), token)).status).toBe(200);
    } finally {
      await replica.close();
      await fs.rm(replicaDir, { recursive: true, force: true });
    }
  });
});
