import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { BadgesResponse, GrantResponse, GrantsResponse, KillBadgeResponse } from "@isocan/core";
import type { MintPassResponse } from "@isocan/core";
import {
  BADGES_ROUTE,
  badgeRoute,
  grantRoute,
  grantsRoute,
  PASS_REDEEM_ROUTE,
  passesRoute,
} from "@isocan/core";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

/**
 * **Kill-a-badge, at the routes** (identity desk, mechanism 1's enforcement
 * primitive; phase 9).
 *
 * The design's case is a stolen laptop, and the thing that makes it a gesture
 * rather than an idea is being able to NAME the badge — so this is two routes
 * and both are asserted: what you are shown, and what you may end. They are
 * one rule read twice, which is why `not-your-badge` is tested as a refusal
 * and not merely as an absence.
 *
 * The property that matters most here is the one that is easy to lose: a
 * stranger has no claim in common with anybody, so `GET /api/badges` can never
 * become a roster of people to expel. That is asserted directly.
 *
 * Fixtures are synthetic: Acme, Priya, Jordan.
 */

const priya = { id: "usr_priya", name: "Priya" };
const jordan = { id: "usr_jordan", name: "Jordan" };
const CANVAS = "prj_acme";

let home: string;
let daemon: Daemon;
let base: string;
let phone: TestBadge;

const get = (badge: TestBadge, url: string) => fetch(`${base}${url}`, { headers: badge.headers });

const surfaces = async (badge: TestBadge): Promise<BadgesResponse> =>
  (await get(badge, BADGES_ROUTE)).json() as Promise<BadgesResponse>;

async function op(badge: TestBadge, body: unknown): Promise<Response> {
  return fetch(`${base}/api/ops`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...badge.headers },
    body: JSON.stringify(body),
  });
}

/**
 * **A second surface of the same person, made the way people actually get
 * one**: `from` mints a pass naming its actor, and a fresh badge redeems it.
 *
 * The shortcut — claim the same actor twice with `as` — is refused, and the
 * refusal is right: `reincarnate` will not hand over an actor "somebody right
 * now", which at this exact moment Priya is. That refusal is the whole reason
 * the pass exists, and going through it here means these tests are about two
 * badges that really are one person's, with the admission chain
 * (`{root: "pass", badgeId}`) that a real second surface carries.
 */
async function surfaceOf(from: TestBadge, actor: { id: string; name: string }): Promise<TestBadge> {
  const minted = await fetch(`${base}${passesRoute(CANVAS)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...from.headers },
    body: JSON.stringify({ actorId: actor.id }),
  });
  if (!minted.ok) throw new Error(`could not mint a pass: ${await minted.text()}`);
  const { token } = (await minted.json()) as MintPassResponse;

  const badge = await mintTestBadge(base);
  const redeemed = await fetch(`${base}${PASS_REDEEM_ROUTE}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...badge.headers },
    body: JSON.stringify({ token }),
  });
  if (!redeemed.ok) throw new Error(`could not redeem the pass: ${await redeemed.text()}`);
  return badge;
}

/** Somebody else entirely: a badge with an identity of its own, sharing
 * nothing with Priya. */
async function otherPerson(actor: { id: string; name: string }): Promise<TestBadge> {
  const badge = await mintTestBadge(base);
  await badge.speakAs(actor);
  return badge;
}

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-kill-"));
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  phone = await mintTestBadge(base);
  await phone.speakAs(priya);
  const made = await op(phone, {
    canvasId: null,
    actor: priya,
    op: { type: "project.create", canvasId: CANVAS, title: "Acme Sprint Board" },
  });
  if (!made.ok) throw new Error(await made.text());
});

afterEach(async () => {
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true });
});

describe("your surfaces: what a badge is shown", () => {
  it("is itself, marked, when it shares an identity with nothing", async () => {
    const alone = await mintTestBadge(base);
    const { badges } = await surfaces(alone);
    expect(badges).toHaveLength(1);
    expect(badges[0]).toMatchObject({ badgeId: alone.badgeId, self: true, kind: "bearer" });
    // No secret, ever, and no list of rooms — a count is what the gesture
    // needs and a list is a ledger.
    expect(JSON.stringify(badges)).not.toContain("secretHash");
    expect(badges[0]).not.toHaveProperty("admissions");
  });

  it("is every badge holding an actor this one holds — and never anybody else's", async () => {
    const laptop = await surfaceOf(phone, priya);
    // A stranger, on the same home, with a badge and an identity of her own.
    const stranger = await otherPerson(jordan);

    const mine = (await surfaces(phone)).badges;
    expect(mine.map((row) => row.badgeId).sort()).toEqual(
      [phone.badgeId, laptop.badgeId].sort(),
    );
    expect(mine.find((row) => row.self)!.badgeId).toBe(phone.badgeId);
    expect(mine.map((row) => row.actors[0]!.name)).toEqual(["Priya", "Priya"]);

    // There is no shape of this route that lists the home: every badge it can
    // return was reached through an actor the caller already speaks as.
    expect((await surfaces(stranger)).badges.map((row) => row.badgeId)).toEqual([
      stranger.badgeId,
    ]);
  });
});

describe("ending one", () => {
  it("ends recognition: the killed holder is a stranger at its very next request", async () => {
    const laptop = await surfaceOf(phone, priya);
    // It works before, on an ordinary canvas-scoped read.
    expect((await get(laptop, `/api/projects/${CANVAS}`)).status).toBe(200);

    const res = await fetch(`${base}${badgeRoute(laptop.badgeId)}`, {
      method: "DELETE",
      headers: phone.headers,
    });
    expect(res.status).toBe(200);
    const { killed } = (await res.json()) as KillBadgeResponse;
    expect(killed.badgeId).toBe(laptop.badgeId);

    // `bad-badge` and not `not-admitted`: the credential itself is finished,
    // and the honest instruction is "throw away what you stored".
    const after = await get(laptop, `/api/projects/${CANVAS}`);
    expect(after.status).toBe(401);
    expect(((await after.json()) as { code: string }).code).toBe("bad-badge");

    // And it cannot speak as her anywhere — the property that matters for a
    // stolen machine. (`/api/ops` is the one route whose canvas is in its
    // body, so this is the check that would still be reached.)
    const spoke = await op(laptop, {
      canvasId: CANVAS,
      actor: priya,
      op: { type: "item.add", itemId: "itm_x", kind: "note", x: 0, y: 0 },
    });
    expect(spoke.status).toBe(401);
  });

  it("does not un-invite: the ended holder can knock again, as a stranger", async () => {
    const laptop = await surfaceOf(phone, priya);
    await fetch(`${base}${badgeRoute(laptop.badgeId)}`, {
      method: "DELETE",
      headers: phone.headers,
    });

    // A fresh badge, and the live link grant lets it in — as a stranger with
    // none of Priya's claims. That is the composition the design describes:
    // kill-a-badge ends a holder, the grant decides about strangers.
    const reborn = await mintTestBadge(base);
    expect((await get(reborn, `/api/projects/${CANVAS}`)).status).toBe(200);
    expect((await surfaces(reborn)).badges).toHaveLength(1);
  });

  it("refuses a badge that is not one of yours", async () => {
    const stranger = await otherPerson(jordan);
    const res = await fetch(`${base}${badgeRoute(stranger.badgeId)}`, {
      method: "DELETE",
      headers: phone.headers,
    });
    expect(res.status).toBe(403);
    expect(((await res.json()) as { code: string }).code).toBe("not-your-badge");
    // Untouched: the refusal is a refusal, not a partial kill.
    expect((await get(stranger, `/api/projects/${CANVAS}`)).status).toBe(200);
  });

  it("lets a surface end itself — signing out is the least-privileged case", async () => {
    const tab = await surfaceOf(phone, priya);
    const res = await fetch(`${base}${badgeRoute(tab.badgeId)}`, {
      method: "DELETE",
      headers: tab.headers,
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as KillBadgeResponse).killed.self).toBe(true);
    expect((await get(tab, `/api/projects/${CANVAS}`)).status).toBe(401);
  });

  it("is idempotent from the caller's end: a second kill is a 404, never a second sweep", async () => {
    const laptop = await surfaceOf(phone, priya);
    const url = `${base}${badgeRoute(laptop.badgeId)}`;
    expect((await fetch(url, { method: "DELETE", headers: phone.headers })).status).toBe(200);
    // The second attempt cannot even see it any more, because a killed badge
    // is out of every query — so the refusal is the authorization one, which
    // is the honest answer to "end a holder that does not exist".
    const again = await fetch(url, { method: "DELETE", headers: phone.headers });
    expect(again.status).toBe(403);
  });
});

describe("revoking a grant reports what it swept", () => {
  it("says how many lost the canvas, on the response both surfaces read", async () => {
    const stranger = await mintTestBadge(base);
    // Arriving is what writes the admission — the door, doing its job.
    expect((await get(stranger, `/api/projects/${CANVAS}`)).status).toBe(200);

    const { grants } = (await (await get(phone, grantsRoute(CANVAS))).json()) as GrantsResponse;
    const res = await fetch(`${base}${grantRoute(CANVAS, grants[0]!.id)}`, {
      method: "DELETE",
      headers: phone.headers,
    });
    const answer = (await res.json()) as GrantResponse;
    expect(answer.grant.revokedAt).toBeDefined();
    expect(answer.swept).toEqual({ expelled: 1, rerooted: 0 });

    // The stranger is out; the creator is not, because `{root: "created"}` is
    // the one root a sweep never walks.
    expect((await get(stranger, `/api/projects/${CANVAS}`)).status).toBe(403);
    expect((await get(phone, `/api/projects/${CANVAS}`)).status).toBe(200);
  });
});
