import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { ApiError } from "@isocan/core";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";
import { DaemonRoutes } from "../../api/src/routes.ts";
import { fileBadgeStore } from "../src/badge-store.ts";

/**
 * **The cursor and hold routes require the actor** (docs/projects/room/design.md,
 * the claim rule; room phase 3). `/api/park/claim` and `/api/rc/hold` refuse,
 * with `not-your-actor`, an actor the presenting badge does not hold, as every
 * other route that names an actor does. That refusal is what a second rc on a
 * canvas reads for an agent another machine answers for; before it, the two
 * traded the agent's cursor through these routes.
 */

const CANVAS = "prj_acme";
const ADA = { id: "usr_ada", name: "Ada" };
const PERCY = { id: "act_percy", name: "Percy" };
const WREN = { id: "usr_wren", name: "Wren" };
const WENDY = { id: "act_wendy", name: "Wendy" };

let home: string;
let daemon: Daemon;
let base: string;
/** The first machine: Ada, and her agent Percy. */
let first: TestBadge;
/** The second machine: Wren, and her agent Wendy. */
let second: TestBadge;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-park-claim-rule-"));
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  first = await mintTestBadge(base);
  second = await mintTestBadge(base);
  await first.speakAs(ADA);
  await first.speakAs(PERCY, "agent:Percy");
  await second.speakAs(WREN);
  await second.speakAs(WENDY, "agent:Wendy");
  const created = await post(first, "/api/ops", {
    canvasId: null,
    actor: ADA,
    op: { type: "project.create", canvasId: CANVAS, title: "Acme Board" },
  });
  expect(created.status).toBe(200);
});

afterEach(async () => {
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

function post(badge: TestBadge, route: string, body: unknown): Promise<Response> {
  return fetch(`${base}${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...badge.headers },
    body: JSON.stringify(body),
  });
}

async function refusal(res: Response): Promise<{ status: number; code: string }> {
  const body = (await res.json()) as { code: string };
  return { status: res.status, code: body.code };
}

describe("an actor the badge does not hold", () => {
  it("parkClaim refuses it with not-your-actor, and the holder's park is undisturbed", async () => {
    const held = await post(first, "/api/park/claim", { canvasId: CANVAS, actorId: PERCY.id });
    expect(held.status).toBe(200);
    const { parkId } = (await held.json()) as { parkId: string };

    const refused = await post(second, "/api/park/claim", { canvasId: CANVAS, actorId: PERCY.id });
    expect(await refusal(refused)).toEqual({ status: 400, code: "not-your-actor" });

    // A refused claim adopted nothing: the holder's lease still writes.
    const delivered = await post(first, "/api/park/delivered", { canvasId: CANVAS, actorId: PERCY.id, parkId, tip: 1 });
    expect(delivered.status).toBe(200);
    // And the holder claiming again is unaffected by the refusal.
    expect((await post(first, "/api/park/claim", { canvasId: CANVAS, actorId: PERCY.id })).status).toBe(200);
    // The second badge parks its own agent.
    expect((await post(second, "/api/park/claim", { canvasId: CANVAS, actorId: WENDY.id })).status).toBe(200);
  });

  it("rcHold refuses a hold naming it, whole, and holds a badge's own agents", async () => {
    const refused = await post(second, "/api/rc/hold", { canvasId: CANVAS, actorIds: [WENDY.id, PERCY.id], waitMs: 0 });
    expect(await refusal(refused)).toEqual({ status: 400, code: "not-your-actor" });

    const answering = async () =>
      ((await (await fetch(`${base}/api/projects/${CANVAS}/rc`, { headers: first.headers })).json()) as {
        actorIds: string[];
      }).actorIds;
    // A refused hold holds nothing for anybody, even the agent it may hold.
    expect(await answering()).toEqual([]);

    expect((await post(second, "/api/rc/hold", { canvasId: CANVAS, actorIds: [WENDY.id], waitMs: 0 })).status).toBe(200);
    expect((await post(first, "/api/rc/hold", { canvasId: CANVAS, actorIds: [PERCY.id], waitMs: 0 })).status).toBe(200);
  });

  it("DaemonRoutes' one reclaim does not heal a park refused for another badge's actor, and does not loop", async () => {
    const client = new DaemonRoutes(base, fileBadgeStore(path.join(home, "second-machine"), base));
    let reclaims = 0;
    let claimed = 0;
    // What `resolveIdentity` registers: claim the machine's own person.
    const rue = { id: "usr_rue", name: "Rue" };
    client.reclaimWith(async () => {
      reclaims++;
      await client.claimActor({ type: "actor.claim", sessionKey: "home:rue", as: rue.id, name: rue.name });
      claimed++;
    });
    const parked = client.parkClaim({ canvasId: CANVAS, actorId: PERCY.id });
    await expect(parked).rejects.toBeInstanceOf(ApiError);
    await expect(parked).rejects.toMatchObject({ code: "not-your-actor" });
    // One reclaim (this first request went to the door, which re-claims on
    // the way back); the claim it made is the person, which does not make
    // this badge hold Percy, and the replay's refusal is thrown.
    expect(reclaims).toBe(1);
    expect(claimed).toBe(1);
    // With a badge in hand, the refusal itself asks for the one reclaim.
    const held = client.rcHold({ canvasId: CANVAS, actorIds: [PERCY.id], waitMs: 0 });
    await expect(held).rejects.toMatchObject({ code: "not-your-actor" });
    expect(reclaims).toBe(2);
    expect(claimed).toBe(2);
  });
});
