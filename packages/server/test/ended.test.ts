import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { WebSocket } from "ws";
import {
  BADGE_ENDED,
  badgeRoute,
  ENDED,
  endedSentence,
  formatBadgeToken,
  NOT_ADMITTED,
  PASS_MINTER_ENDED,
  PASS_REDEEM_ROUTE,
  passesRoute,
  WS_NO_BADGE,
  WS_NOT_ADMITTED,
  type BadgeEnd,
  type KillBadgeResponse,
  type MintPassResponse,
  type ServerMessage,
} from "@isocan/core";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

/**
 * **End a surface, and mean it** — operator phase 4's first half, the one that
 * fixes the OWNER's path and ships alone, walked against a real daemon.
 *
 * `design.md` ("What exists, exactly") found four gaps by reading and none by
 * a test: after `isocan badges --kill`, the dead badge's own sockets stayed
 * open and kept receiving broadcasts (the sweep reports only what `badgesIn`
 * returns, and a dead badge is not among them); a parked `/api/oplog/watch`
 * was not woken; a pass the dead badge had minted was still redeemable; and
 * the 401 its holder met said *this home does not know that badge*, which is
 * what a wiped home says too. Each is a bug in the stolen-laptop gesture that
 * has shipped since multiuser phase 9, and each is asserted here as a fact
 * about a process rather than a claim about a code path.
 *
 * The acceptance is *end a laptop's badge from a phone while the laptop has a
 * tab open and a wait parked: the tab closes, the wait exits, the laptop's
 * outstanding pass is refused*. The phone and the laptop here are two badges
 * of one person, made the way people actually get a second surface — a pass
 * from the first, redeemed by the second — so the kill is authorised by the
 * same rule the route enforces for everyone (`mySurfaces`), not by a fixture
 * standing in for it.
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

async function op(badge: TestBadge, body: unknown): Promise<Response> {
  return fetch(`${base}/api/ops`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...badge.headers },
    body: JSON.stringify(body),
  });
}

/** A pass for Priya on the canvas, minted by `from`. */
async function mintPass(from: TestBadge): Promise<string> {
  const minted = await fetch(`${base}${passesRoute(CANVAS)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...from.headers },
    body: JSON.stringify({ actorId: priya.id }),
  });
  if (!minted.ok) throw new Error(`could not mint a pass: ${await minted.text()}`);
  return ((await minted.json()) as MintPassResponse).token;
}

async function redeem(badge: TestBadge, token: string): Promise<Response> {
  return fetch(`${base}${PASS_REDEEM_ROUTE}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...badge.headers },
    body: JSON.stringify({ token }),
  });
}

/** A second surface of the same person, the way people get one. */
async function surfaceOf(from: TestBadge): Promise<TestBadge> {
  const token = await mintPass(from);
  const badge = await mintTestBadge(base);
  const redeemed = await redeem(badge, token);
  if (!redeemed.ok) throw new Error(`could not redeem the pass: ${await redeemed.text()}`);
  return badge;
}

async function kill(by: TestBadge, badgeId: string): Promise<KillBadgeResponse> {
  const res = await fetch(`${base}${badgeRoute(badgeId)}`, { method: "DELETE", headers: by.headers });
  if (!res.ok) throw new Error(`kill refused: ${await res.text()}`);
  return (await res.json()) as KillBadgeResponse;
}

/** A socket on the canvas, open and having heard its hello. */
async function openSocket(
  badge: TestBadge,
): Promise<{ ws: WebSocket; heard: ServerMessage[]; closed: Promise<[number, string]> }> {
  const ws = new WebSocket(`${base.replace("http:", "ws:")}/ws?canvasId=${CANVAS}`, {
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

/** A socket the door closes on the handshake: the close, without a hello. */
function dial(badge: TestBadge): Promise<[number, string]> {
  const ws = new WebSocket(`${base.replace("http:", "ws:")}/ws?canvasId=${CANVAS}`, {
    headers: badge.headers,
  });
  return new Promise((resolve) => {
    ws.on("close", (code, reason) => resolve([code, String(reason)]));
    ws.on("error", () => {});
  });
}

/**
 * A watch parked at the tip, the way `isocan wait` holds one.
 *
 * Handed back inside an object, deliberately: an `async` function that
 * `return`ed the fetch promise would have it FLATTENED, so `await park()`
 * would wait out the whole poll before the kill was even sent — which is how
 * the first run of this file spent twenty seconds proving nothing.
 */
async function park(badge: TestBadge, only: string[] | null): Promise<{ answer: Promise<Response> }> {
  const seed = await fetch(`${base}/api/oplog/watch`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...badge.headers },
    body: JSON.stringify({ ...(only ? { only } : {}), waitMs: 0 }),
  });
  const { cursors } = (await seed.json()) as { cursors: Record<string, number> };
  const answer = fetch(`${base}/api/oplog/watch`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...badge.headers },
    body: JSON.stringify({ cursors, ...(only ? { only } : {}), waitMs: 20_000 }),
  });
  // Let the poll get as far as parking before the act.
  await settle(300);
  return { answer };
}

const settle = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-ended-"));
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
  await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

// ---------------------------------------------------------------------------

describe("the owner's path: a laptop ended from a phone", () => {
  it("closes the laptop's open tab with `ended` — not `withdrawn`, and not silence", async () => {
    const laptop = await surfaceOf(phone);
    const tab = await openSocket(laptop);
    // A stranger on the same canvas, whose socket must NOT be touched: the
    // kill is per badge, and a stranger is not that badge.
    const stranger = await mintTestBadge(base);
    const other = await openSocket(stranger);

    const answer = await kill(phone, laptop.badgeId);
    const [code, reason] = await tab.closed;
    expect(code).toBe(WS_NOT_ADMITTED);
    expect(reason).toBe(ENDED);
    // Counted at the moment of acting, for the verb to print.
    expect(answer.reached).toEqual({ sockets: 1, waits: 0 });

    // The stranger heard nothing and is still connected.
    expect(other.ws.readyState).toBe(WebSocket.OPEN);
    other.ws.close();
  });

  it("wakes the laptop's parked wait and refuses it with the sentence, so `isocan wait` exits", async () => {
    const laptop = await surfaceOf(phone);
    const { answer: parked } = await park(laptop, [CANVAS]);

    const answer = await kill(phone, laptop.badgeId);
    const res = await parked;
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string; code: string; reason: string; ended: BadgeEnd };
    expect(body.code).toBe(NOT_ADMITTED);
    expect(body.reason).toBe(ENDED);
    // The home's own words: the date, and — for the holder's own end — no
    // operator and no address, because there is nobody to write to.
    expect(body.ended.by).toBe("holder");
    expect(body.error).toBe(endedSentence(body.ended));
    expect(body.error).toMatch(/^This surface was ended on \d+ \w+ \d{4} from another of its holder's surfaces\.$/);
    expect(answer.reached?.waits).toBe(1);
  });

  it("wakes a home-wide wait too — an end is per badge, not per room", async () => {
    const laptop = await surfaceOf(phone);
    const { answer: parked } = await park(laptop, null);
    await kill(phone, laptop.badgeId);
    const res = await parked;
    expect(res.status).toBe(403);
    expect(((await res.json()) as { reason: string }).reason).toBe(ENDED);
  });

  it("refuses a pass the laptop minted an hour ago, unspent, with the tombstone's sentence", async () => {
    const laptop = await surfaceOf(phone);
    const outstanding = await mintPass(laptop);
    await kill(phone, laptop.badgeId);

    const stranger = await mintTestBadge(base);
    const res = await redeem(stranger, outstanding);
    expect(res.status).toBe(410);
    const body = (await res.json()) as { error: string; code: string };
    expect(body.code).toBe(PASS_MINTER_ENDED);
    expect(body.error).toMatch(/This surface was ended on/);
    // Unspent: a second try meets the same refusal, never `pass-spent`. (The
    // stranger can still get in by the live link — ending is not refusing,
    // and the link is the grant's business, not the dead minter's.)
    const again = await redeem(stranger, outstanding);
    expect(again.status).toBe(410);
    expect(((await again.json()) as { code: string }).code).toBe(PASS_MINTER_ENDED);
    // And a pass from the surviving surface still works — the refusal is
    // about the minter, not about passes.
    expect((await redeem(stranger, await mintPass(phone))).status).toBe(200);
  });

  it("answers the laptop's next request with the tombstone's reason, not `bad-badge`", async () => {
    const laptop = await surfaceOf(phone);
    await kill(phone, laptop.badgeId);

    const res = await get(laptop, `/api/projects/${CANVAS}`);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string; code: string; reason: string; ended: BadgeEnd };
    expect(body.code).toBe(BADGE_ENDED);
    expect(body.reason).toBe("holder");
    expect(body.ended.badgeId).toBe(laptop.badgeId);
    expect(body.error).toBe(body.ended.sentence);
    // The one route whose canvas is in its body meets the same hook.
    const spoke = await op(laptop, {
      canvasId: CANVAS,
      actor: priya,
      op: { type: "item.add", itemId: "itm_x", kind: "note", x: 0, y: 0 },
    });
    expect(spoke.status).toBe(401);
    expect(((await spoke.json()) as { code: string }).code).toBe(BADGE_ENDED);
  });

  it("says nothing about the tombstone to a caller that can only spell the id", async () => {
    const laptop = await surfaceOf(phone);
    await kill(phone, laptop.badgeId);
    const guessing = { Authorization: `Bearer ${formatBadgeToken(laptop.badgeId, "not-the-secret")}` };
    const res = await fetch(`${base}/api/projects/${CANVAS}`, { headers: guessing });
    expect(res.status).toBe(401);
    expect(((await res.json()) as { code: string }).code).toBe("bad-badge");
  });

  it("closes a redial from the dead badge with `ended`, not `badge required`", async () => {
    const laptop = await surfaceOf(phone);
    await kill(phone, laptop.badgeId);
    const [code, reason] = await dial(laptop);
    expect(code).toBe(WS_NOT_ADMITTED);
    expect(reason).toBe(ENDED);
    // A badge from nowhere still gets the door's answer, as before.
    const nobody = {
      badgeId: "bdg_nobody",
      token: "",
      headers: { Authorization: "Bearer bdg_nobody.x" },
      speakAs: async () => {},
    } satisfies TestBadge;
    expect((await dial(nobody))[0]).toBe(WS_NO_BADGE);
  });

  it("does all of it at once: tab, wait and pass, from one kill", async () => {
    const laptop = await surfaceOf(phone);
    const tab = await openSocket(laptop);
    const { answer: parked } = await park(laptop, [CANVAS]);
    const outstanding = await mintPass(laptop);

    const answer = await kill(phone, laptop.badgeId);
    expect(answer.reached).toEqual({ sockets: 1, waits: 1 });
    expect((await tab.closed)[1]).toBe(ENDED);
    expect((await parked).status).toBe(403);
    expect((await redeem(await mintTestBadge(base), outstanding)).status).toBe(410);
  });

  it("nothing changed for anyone else: a stranger still cannot end Priya's badge (journey 12)", async () => {
    const laptop = await surfaceOf(phone);
    const stranger = await mintTestBadge(base);
    await stranger.speakAs(jordan);
    const res = await fetch(`${base}${badgeRoute(laptop.badgeId)}`, {
      method: "DELETE",
      headers: stranger.headers,
    });
    expect(res.status).toBe(403);
    expect(((await res.json()) as { code: string }).code).toBe("not-your-badge");
    expect((await get(laptop, `/api/projects/${CANVAS}`)).status).toBe(200);
  });

  it("survives a restart: the tombstone's reason is durable", async () => {
    const laptop = await surfaceOf(phone);
    await kill(phone, laptop.badgeId);
    await daemon.close();
    daemon = await startDaemon({ port: 0, home });
    const address = daemon.app.server.address();
    base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
    const res = await get(laptop, `/api/projects/${CANVAS}`);
    expect(res.status).toBe(401);
    expect(((await res.json()) as { code: string }).code).toBe(BADGE_ENDED);
  });
});
