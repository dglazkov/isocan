import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { WebSocket } from "ws";
import type { Capability, GrantResponse, ServerMessage, WatchLogResponse } from "@isocan/core";
import { grantsRoute, NOT_ADMITTED, WITHDRAWN, WS_NOT_ADMITTED } from "@isocan/core";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { sweepCanvas } from "../src/sweep.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

/**
 * **A change reaches the room** (roles design, "Reaching an open socket";
 * phase 2; journeys 2 and 3).
 *
 * Until this a rung change reached a person already inside only on their
 * next request. Now the room maps socket to badge, the sweep reports per
 * badge, and `ws.ts` turns each outcome into one of two things on that
 * badge's sockets and no other: a `standing` message with the new rung, or a
 * close with `WS_NOT_ADMITTED` and the reason `withdrawn`. The watch route,
 * which `isocan wait` long-polls, refuses an expelled badge the same way.
 *
 * Fixtures are synthetic: Acme, Priya, Jordan, Sam.
 */

const priya = { id: "usr_priya", name: "Priya" };
const CANVAS = "prj_acme";

let home: string;
let daemon: Daemon;
let base: string;
let owner: TestBadge;

const stranger = () => mintTestBadge(base);

const get = (badge: TestBadge, url: string) => fetch(`${base}${url}`, { headers: badge.headers });
const post = (badge: TestBadge, url: string, body: unknown) =>
  fetch(`${base}${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...badge.headers },
    body: JSON.stringify(body),
  });

async function makeCanvas(): Promise<void> {
  const made = await post(owner, "/api/ops", {
    canvasId: null,
    actor: priya,
    op: { type: "project.create", canvasId: CANVAS, title: "Acme Sprint Board" },
  });
  if (!made.ok) throw new Error(`could not create the canvas: ${await made.text()}`);
}

const shareLink = async (capability: Capability): Promise<GrantResponse> =>
  (await (await post(owner, grantsRoute(CANVAS), { subject: "link", capability })).json()) as GrantResponse;

/** Jordan, invited by name on the desk (this home has no attester) and proved. */
async function invited(badge: TestBadge, capability: Capability, id = "gnt_jordan"): Promise<void> {
  await daemon.desk.putGrant({
    id,
    canvasId: CANVAS,
    subject: "email:jordan@acme.test",
    grantedBy: owner.badgeId,
    at: new Date().toISOString(),
    ...(capability === "edit" ? {} : { capability }),
  });
  await daemon.desk.attest(badge.badgeId, {
    attribute: "email:jordan@acme.test",
    verifiedVia: "magic-link",
    at: new Date().toISOString(),
  });
}

/** An open socket, with everything the home says on it and how it ended. */
interface Tap {
  ws: WebSocket;
  heard: ServerMessage[];
  hello: ServerMessage;
  closed: Promise<{ code: number; reason: string }>;
}

async function open(badge: TestBadge): Promise<Tap> {
  const ws = new WebSocket(`${base.replace("http:", "ws:")}/ws?canvasId=${CANVAS}`, {
    headers: badge.headers,
  });
  const heard: ServerMessage[] = [];
  const closed = new Promise<{ code: number; reason: string }>((resolve) =>
    ws.on("close", (code, reason) => resolve({ code, reason: String(reason) })),
  );
  const hello = await new Promise<ServerMessage>((resolve, reject) => {
    ws.on("error", reject);
    ws.on("message", (data) => {
      const message = JSON.parse(String(data)) as ServerMessage;
      if (heard.length === 0) resolve(message);
      heard.push(message);
    });
  });
  return { ws, heard, hello, closed };
}

const standings = (tap: Tap) =>
  tap.heard.filter((m): m is Extract<ServerMessage, { type: "standing" }> => m.type === "standing");

const settle = () => new Promise((resolve) => setTimeout(resolve, 150));

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-standing-"));
  daemon = await startDaemon({ port: 0, home, auth: null });
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

describe("the standing message", () => {
  it("reaches exactly the re-rooted badge's connections, and no other", async () => {
    await shareLink("view");
    const jordan = await stranger();
    await invited(jordan, "read");
    const sam = await stranger();
    // Jordan holds two sockets; Sam, on the view link, one.
    const tab = await open(jordan);
    const phone = await open(jordan);
    const deck = await open(sam);
    expect((tab.hello as { capability?: string }).capability).toBe("read");
    expect((deck.hello as { capability?: string }).capability).toBe("view");

    // Jordan's row is raised to edit — the route's replacement, made on the
    // desk because this home cannot verify an address — and the sweep runs
    // through the daemon's own hub, which is what the route hands it.
    await daemon.desk.revokeGrant("gnt_jordan", new Date().toISOString(), owner.badgeId);
    await daemon.desk.putGrant({
      id: "gnt_jordan_edit",
      canvasId: CANVAS,
      subject: "email:jordan@acme.test",
      grantedBy: owner.badgeId,
      at: new Date().toISOString(),
    });
    expect(await sweepCanvas(daemon.desk, CANVAS, priya.id, daemon.sweeps.report)).toEqual({
      expelled: 0,
      rerooted: 1,
    });
    await settle();

    expect(standings(tab)).toEqual([{ type: "standing", capability: "edit" }]);
    expect(standings(phone)).toEqual([{ type: "standing", capability: "edit" }]);
    expect(standings(deck)).toEqual([]);
    for (const tap of [tab, phone, deck]) tap.ws.close();
  });

  it("is sent by the route that replaces the link, to the people on it", async () => {
    await shareLink("read");
    const sam = await stranger();
    const tap = await open(sam);
    expect((tap.hello as { capability?: string }).capability).toBe("read");

    const answer = await shareLink("edit");
    expect(answer.swept).toEqual({ expelled: 0, rerooted: 1 });
    await settle();
    expect(standings(tap)).toEqual([{ type: "standing", capability: "edit" }]);
    tap.ws.close();
  });

  it("moves the connection's own rung: a raised viewer's beat goes up, marked at the new rung", async () => {
    await shareLink("view");
    const sam = await stranger();
    const spectator = { id: "usr_sam", name: "Sam" };
    await sam.speakAs(spectator);
    const tap = await open(sam);
    // A view connection's beats are dropped.
    tap.ws.send(
      JSON.stringify({ type: "presence", sessionId: "cli_sam", actor: spectator, cursor: null, selection: [] }),
    );
    await settle();
    const before = (await (await get(owner, `/api/projects/${CANVAS}/sessions`)).json()) as { actor: { id: string } }[];
    expect(before.find((s) => s.actor.id === spectator.id)).toBeUndefined();

    await shareLink("read");
    await settle();
    expect(standings(tap)).toEqual([{ type: "standing", capability: "read" }]);
    tap.ws.send(
      JSON.stringify({ type: "presence", sessionId: "cli_sam", actor: spectator, cursor: null, selection: [] }),
    );
    await settle();
    const after = (await (await get(owner, `/api/projects/${CANVAS}/sessions`)).json()) as {
      actor: { id: string };
      capability?: string;
    }[];
    expect(after.find((s) => s.actor.id === spectator.id)).toMatchObject({ capability: "read" });
    tap.ws.close();
  });
});

describe("withdrawn", () => {
  it("closes an expelled badge's sockets with WS_NOT_ADMITTED and the reason, and no other", async () => {
    await shareLink("edit");
    const sam = await stranger();
    const jordan = await stranger();
    await invited(jordan, "edit");
    const samTap = await open(sam);
    const jordanTap = await open(jordan);
    // Jordan enters under the link too — the door names the older row of
    // one rung — so turning the link off re-roots her and expels Sam.
    const link = (await (await get(owner, grantsRoute(CANVAS))).json()) as { grants: { id: string; subject: string }[] };
    const off = await fetch(`${base}${grantsRoute(CANVAS)}/${link.grants.find((g) => g.subject === "link")!.id}`, {
      method: "DELETE",
      headers: owner.headers,
    });
    expect(off.status).toBe(200);
    expect(((await off.json()) as GrantResponse).swept).toEqual({ expelled: 1, rerooted: 1 });

    expect(await samTap.closed).toEqual({ code: WS_NOT_ADMITTED, reason: WITHDRAWN });
    await settle();
    expect(jordanTap.ws.readyState).toBe(WebSocket.OPEN);
    // Re-rooted to the same rung is not news.
    expect(standings(jordanTap)).toEqual([]);
    jordanTap.ws.close();
  });

  it("refuses the expelled badge's next watch with not-admitted and the reason — and wakes a poll to say so", async () => {
    await shareLink("edit");
    const sam = await stranger();
    // In, and parked: a long-poll naming the canvas.
    expect((await get(sam, `/api/projects/${CANVAS}/canvas`)).status).toBe(200);
    const parked = post(sam, "/api/oplog/watch", { cursors: { [CANVAS]: 1 }, waitMs: 20_000, only: [CANVAS] });
    await settle();
    const link = (await (await get(owner, grantsRoute(CANVAS))).json()) as { grants: { id: string; subject: string }[] };
    const started = Date.now();
    await fetch(`${base}${grantsRoute(CANVAS)}/${link.grants.find((g) => g.subject === "link")!.id}`, {
      method: "DELETE",
      headers: owner.headers,
    });
    const refused = await parked;
    // Told within the sweep, not at the end of the poll window.
    expect(Date.now() - started).toBeLessThan(5_000);
    expect(refused.status).toBe(403);
    expect(await refused.json()).toMatchObject({ code: NOT_ADMITTED, reason: WITHDRAWN });
    // And the next poll says the same, until the badge is let back in.
    const again = await post(sam, "/api/oplog/watch", { cursors: { [CANVAS]: 1 }, only: [CANVAS] });
    expect(again.status).toBe(403);
    expect(await again.json()).toMatchObject({ code: NOT_ADMITTED, reason: WITHDRAWN });

    await shareLink("edit");
    const back = await post(sam, "/api/oplog/watch", { cursors: { [CANVAS]: 1 }, only: [CANVAS] });
    expect(back.status).toBe(200);
    expect(((await back.json()) as WatchLogResponse).cursors[CANVAS]).toBeDefined();
  });

  it("answers a badge that was never inside with not-admitted and no reason", async () => {
    await shareLink("edit");
    const link = (await (await get(owner, grantsRoute(CANVAS))).json()) as { grants: { id: string; subject: string }[] };
    await fetch(`${base}${grantsRoute(CANVAS)}/${link.grants.find((g) => g.subject === "link")!.id}`, {
      method: "DELETE",
      headers: owner.headers,
    });
    const sam = await stranger();
    // A watch never refuses a badge that simply cannot hear a canvas — the
    // canvas is not in the answer — so the socket is where the plain refusal
    // shows.
    const tap = new WebSocket(`${base.replace("http:", "ws:")}/ws?canvasId=${CANVAS}`, {
      headers: sam.headers,
    });
    const closed = await new Promise<{ code: number; reason: string }>((resolve, reject) => {
      tap.on("error", reject);
      tap.on("close", (code, reason) => resolve({ code, reason: String(reason) }));
    });
    expect(closed.code).toBe(WS_NOT_ADMITTED);
    expect(closed.reason).not.toBe(WITHDRAWN);
  });
});
