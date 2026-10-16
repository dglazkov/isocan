import { afterEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  HOME_JOIN_ROUTE,
  HOMES_ROUTE,
  type Actor,
  type HomesResponse,
  type ParkClaimResponse,
} from "@isocan/core";
import type { SummaryDay, SummaryEntry } from "@isocan/core/semantic-zoom";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { FileDesk } from "../src/file-desk.ts";
import { FileStore } from "../src/file-store.ts";
import { SelfLinkError } from "../src/home-links.ts";
import * as p from "../src/paths.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

/**
 * **The Workstation boundary and self-link refusal (14 Oct 2026).**
 *
 * A hosted home (`ISOCAN_STORE === "cloud"` or `servesWorld === true`) has
 * `workstation === null`: it cannot act as a replica of another home, it keeps
 * no machine-local keys or workstation credentials on disk, and its durable
 * home state (park cursors, semantic-zoom summaries and stats, link-grant
 * migration marker) lives behind `Store` and `Desk` rather than in
 * `ISOCAN_HOME`. And every daemon — hosted or local workstation — refuses to
 * link to itself (`409 self-link`) on every door that binds a canvas to a
 * remote home (`POST /api/home/join`, `project.create { home }`, and
 * `POST /api/projects/:id/teleport`).
 */

const maya: Actor = { id: "usr_workstation_maya", name: "Maya" };

const dirs: string[] = [];
const daemons: Daemon[] = [];

async function tmp(prefix: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  dirs.push(dir);
  return dir;
}

function baseOf(daemon: Daemon): string {
  const address = daemon.app.server.address();
  return `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
}

function portOf(daemon: Daemon): number {
  const address = daemon.app.server.address();
  return typeof address === "object" && address ? address.port : 0;
}

async function request(
  base: string,
  badge: TestBadge,
  method: string,
  route: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<Response> {
  return fetch(base + route, {
    method,
    headers: {
      ...badge.headers,
      ...extraHeaders,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

afterEach(async () => {
  for (const d of daemons.splice(0).reverse()) {
    await d.close().catch(() => {});
  }
  await Promise.all(
    dirs.splice(0).map((d) => fs.rm(d, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })),
  );
});

describe("a hosted home has no Workstation and writes no state to ISOCAN_HOME", () => {
  it("keeps ISOCAN_HOME empty while Store and Desk carry durable home state across restarts", async () => {
    const emptyHome = await tmp("isocan-hosted-home-");
    const storeDir = await tmp("isocan-hosted-store-");
    const deskDir = await tmp("isocan-hosted-desk-");

    const store = new FileStore(storeDir);
    const desk = new FileDesk(deskDir);
    const daemon = await startDaemon({
      port: 0,
      home: emptyHome,
      store,
      desk,
      servesWorld: true,
    });
    daemons.push(daemon);

    expect(daemon.workstation).toBeNull();
    expect(daemon.homes).toBeNull();

    const base = baseOf(daemon);
    const badge = await mintTestBadge(base);
    await badge.speakAs(maya);

    const created = await request(base, badge, "POST", "/api/ops", {
      canvasId: null,
      actor: maya,
      op: { type: "project.create", canvasId: "prj_hosted", title: "Acme Hosted Board" },
    });
    expect(created.status, await created.clone().text()).toBe(200);

    // Park cursors and summary cache/stats go through Desk and Store, not ISOCAN_HOME.
    const claimed = await request(base, badge, "POST", "/api/park/claim", {
      canvasId: "prj_hosted",
      actorId: maya.id,
    });
    expect(claimed.status, await claimed.clone().text()).toBe(200);
    const claim = (await claimed.json()) as ParkClaimResponse;
    const delivered = await request(base, badge, "POST", "/api/park/delivered", {
      canvasId: "prj_hosted",
      actorId: maya.id,
      parkId: claim.parkId,
      tip: 1,
    });
    expect(delivered.status).toBe(200);

    const key = "a".repeat(64);
    const summary: SummaryEntry = {
      key,
      kind: "text",
      sourceIds: ["itm_1"],
      summary: "Acme summary.",
      words: 2,
      model: "claude-haiku-4-5-20251001",
      promptVersion: "v1",
      madeAt: "2026-10-14T12:00:00.000Z",
      madeFor: "home",
    };
    const day: SummaryDay = {
      day: "2026-10-14",
      calls: 1,
      inputTokens: 100,
      outputTokens: 12,
      makes: 1,
      hits: 0,
      stale: 0,
      overBudget: 0,
      byKind: {},
      byModel: {},
    };
    await daemon.store.putSummary("prj_hosted", summary);
    await daemon.desk.putSummaryDays("prj_hosted", {
      "2026-10-14": day,
    });

    const homesRes = await request(base, badge, "GET", HOMES_ROUTE);
    expect(homesRes.status).toBe(200);
    const homesBody = (await homesRes.json()) as HomesResponse;
    expect(homesBody).toEqual({ birth: null, canvases: { prj_hosted: null }, links: [] });

    // ISOCAN_HOME holds only the ephemeral pidfile while running — never
    // homes.json, park-cursors.json, summaries/, link-grants.migrated or keys.json.
    expect(await fs.readdir(emptyHome)).toEqual(["daemon.json"]);
    expect(await daemon.desk.linkGrantsMigrated()).toBe(true);
    expect(await fs.stat(p.parkCursorsFile(deskDir)).then(() => true, () => false)).toBe(true);

    // Simulate a container restart on a brand-new ephemeral ISOCAN_HOME over
    // the same durable Store and Desk.
    await daemon.close();
    daemons.pop();
    expect(await fs.readdir(emptyHome)).toEqual([]);

    const freshEphemeralHome = await tmp("isocan-hosted-home-2-");
    const restarted = await startDaemon({
      port: 0,
      home: freshEphemeralHome,
      store: new FileStore(storeDir),
      desk: new FileDesk(deskDir),
      servesWorld: true,
    });
    daemons.push(restarted);

    const restartedBase = baseOf(restarted);
    const resumedClaim = await request(restartedBase, badge, "POST", "/api/park/claim", {
      canvasId: "prj_hosted",
      actorId: maya.id,
    });
    expect(resumedClaim.status, await resumedClaim.clone().text()).toBe(200);
    expect((await resumedClaim.json()) as ParkClaimResponse).toMatchObject({
      cursor: 1,
      redeliverUpTo: null,
    });
    expect(await restarted.store.getSummary("prj_hosted", key)).toEqual(summary);
    expect(await restarted.desk.summaryDays("prj_hosted")).toEqual({
      "2026-10-14": day,
    });
    expect(await fs.readdir(freshEphemeralHome)).toEqual(["daemon.json"]);
  });
});

describe("a hosted home refuses replica links and self-links, and accepts local births at its own origin", () => {
  it("refuses /api/home/join and foreign project.create { home }, while accepting self-origin birth as local", async () => {
    const dir = await tmp("isocan-hosted-refusal-");
    const daemon = await startDaemon({ port: 0, home: dir, servesWorld: true });
    daemons.push(daemon);

    const base = baseOf(daemon);
    const port = portOf(daemon);
    const badge = await mintTestBadge(base);
    await badge.speakAs(maya);

    // 1. Joining a remote home on a hosted daemon -> 409 not-a-replica.
    const joinForeign = await request(base, badge, "POST", HOME_JOIN_ROUTE, {
      canvasId: "prj_remote",
      home: "https://other.invalid",
    });
    expect(joinForeign.status).toBe(409);
    expect(await joinForeign.json()).toMatchObject({ code: "not-a-replica" });

    // 2. Joining its own origin (both loopback and proxied public origin) -> 409 self-link.
    for (const selfHome of [base, `http://localhost:${port}`]) {
      const joinSelf = await request(base, badge, "POST", HOME_JOIN_ROUTE, {
        canvasId: "prj_self",
        home: selfHome,
      });
      expect(joinSelf.status, selfHome).toBe(409);
      expect(await joinSelf.json()).toMatchObject({ code: "self-link" });
    }
    // `fetch()` strips custom `Host` headers per the Fetch spec, so use
    // `app.inject()` to verify a request arriving on the LB's `Host`.
    const joinSelfLB = await daemon.app.inject({
      method: "POST",
      url: HOME_JOIN_ROUTE,
      headers: {
        ...badge.headers,
        host: "isocan.example",
        "x-forwarded-proto": "https",
        "content-type": "application/json",
      },
      payload: JSON.stringify({ canvasId: "prj_self", home: "https://isocan.example" }),
    });
    expect(joinSelfLB.statusCode).toBe(409);
    expect(joinSelfLB.json()).toMatchObject({ code: "self-link" });

    // 3. Creating a canvas naming a foreign home -> 409 not-a-replica.
    const createForeign = await request(base, badge, "POST", "/api/ops", {
      canvasId: null,
      actor: maya,
      home: "https://other.invalid",
      op: { type: "project.create", canvasId: "prj_foreign", title: "Foreign" },
    });
    expect(createForeign.status).toBe(409);
    expect(await createForeign.json()).toMatchObject({ code: "not-a-replica" });

    // 4. Creating a canvas naming this hosted home's own origin -> 200 local birth.
    const createSelf = await daemon.app.inject({
      method: "POST",
      url: "/api/ops",
      headers: {
        ...badge.headers,
        host: "isocan.example",
        "x-forwarded-proto": "https",
        "content-type": "application/json",
      },
      payload: JSON.stringify({
        canvasId: null,
        actor: maya,
        home: "https://isocan.example",
        op: { type: "project.create", canvasId: "prj_born_here", title: "Acme Born Here" },
      }),
    });
    expect(createSelf.statusCode, createSelf.body).toBe(200);
    expect(await daemon.store.canvasExists("prj_born_here")).toBe(true);

    // 5. Teleporting to itself -> 409 self-link.
    const teleportSelf = await request(base, badge, "POST", "/api/projects/prj_born_here/teleport", {
      to: base,
    });
    expect(teleportSelf.status).toBe(409);
    expect(await teleportSelf.json()).toMatchObject({ code: "self-link" });

    // 6. Redeeming a pass naming another home -> 409 not-a-replica.
    const redeemForeign = await request(base, badge, "POST", "/api/passes/redeem", {
      token: "pss_synthetic_token",
      home: "https://other.invalid",
    });
    expect(redeemForeign.status).toBe(409);
    expect(await redeemForeign.json()).toMatchObject({ code: "not-a-replica" });
  });
});

describe("a local workstation daemon refuses self-links on every door", () => {
  it("refuses linking to its own loopback port via 127.0.0.1 or localhost, leaving homes.json untouched", async () => {
    const dir = await tmp("isocan-workstation-self-");
    const daemon = await startDaemon({ port: 0, home: dir });
    daemons.push(daemon);

    expect(daemon.workstation).not.toBeNull();
    expect(daemon.homes).not.toBeNull();

    const base = baseOf(daemon);
    const port = portOf(daemon);
    const badge = await mintTestBadge(base);
    await badge.speakAs(maya);

    const created = await request(base, badge, "POST", "/api/ops", {
      canvasId: null,
      actor: maya,
      op: { type: "project.create", canvasId: "prj_local", title: "Acme Local" },
    });
    expect(created.status).toBe(200);

    for (const selfUrl of [`http://127.0.0.1:${port}`, `http://localhost:${port}`]) {
      const joinRes = await request(base, badge, "POST", HOME_JOIN_ROUTE, {
        canvasId: "prj_local",
        home: selfUrl,
      });
      expect(joinRes.status, `join ${selfUrl}`).toBe(409);
      expect(await joinRes.json()).toMatchObject({ code: "self-link" });

      const createRes = await request(base, badge, "POST", "/api/ops", {
        canvasId: null,
        actor: maya,
        home: selfUrl,
        op: { type: "project.create", canvasId: "prj_self_birth", title: "Self Birth" },
      });
      expect(createRes.status, `create ${selfUrl}`).toBe(409);
      expect(await createRes.json()).toMatchObject({ code: "self-link" });

      const teleportRes = await request(base, badge, "POST", "/api/projects/prj_local/teleport", {
        to: selfUrl,
      });
      expect(teleportRes.status, `teleport ${selfUrl}`).toBe(409);
      expect(await teleportRes.json()).toMatchObject({ code: "self-link" });

      await expect(daemon.homes!.bind("prj_direct", selfUrl)).rejects.toThrow(SelfLinkError);
      expect(() => daemon.homes!.linkFor(selfUrl)).toThrow(SelfLinkError);
    }

    expect(daemon.homes!.assignments()).toEqual({ prj_local: null });
  });
});
