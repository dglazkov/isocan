import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { WebSocket } from "ws";
import type { CanvasSnapshotResponse, Grant, GrantResponse, GrantsResponse } from "@isocan/core";
import { grantsRoute, VIEW_ONLY } from "@isocan/core";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

/**
 * **Look, don't touch** (#88) — the roles question `identity-desk.md` left
 * open ("that waits for a scene that forces it"), answered by the scene that
 * forced it: a presentation (#87) whose viewers must not walk in and start
 * moving things.
 *
 * The mechanism under test, end to end: a grant may carry `capability:
 * "view"`; the door copies it onto the admission it writes; and every write
 * surface refuses a view admission with 403 `view-only` — the op chokepoint
 * by hand (its canvas travels in the body), and every canvas-scoped mutating
 * route by the one `onRequest` hook, so a route added next month is covered
 * by default. Reading is untouched: the snapshot, the oplog and the socket's
 * fan-out are exactly what a view admission is FOR.
 *
 * Fixtures are synthetic throughout: Acme, Priya, a stranger with a deck.
 */

const priya = { id: "usr_priya", name: "Priya" };
const CANVAS = "prj_acme";

let home: string;
let daemon: Daemon;
let base: string;
let owner: TestBadge;

const stranger = () => mintTestBadge(base);

async function op(badge: TestBadge, body: unknown): Promise<Response> {
  return fetch(`${base}/api/ops`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...badge.headers },
    body: JSON.stringify(body),
  });
}

const get = (badge: TestBadge, url: string) => fetch(`${base}${url}`, { headers: badge.headers });

const post = (badge: TestBadge, url: string, body: unknown) =>
  fetch(`${base}${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...badge.headers },
    body: JSON.stringify(body),
  });

async function makeCanvas(): Promise<void> {
  const made = await op(owner, {
    canvasId: null,
    actor: priya,
    op: { type: "project.create", canvasId: CANVAS, title: "Acme Sprint Board" },
  });
  if (!made.ok) throw new Error(`could not create the canvas: ${await made.text()}`);
}

const grantsOf = async (badge: TestBadge): Promise<Grant[]> =>
  (((await (await get(badge, grantsRoute(CANVAS))).json()) as GrantsResponse).grants);

/** Flip the link to `capability` in one POST — the replacement gesture. */
const shareLink = async (badge: TestBadge, capability: "edit" | "view"): Promise<GrantResponse> =>
  (await (
    await post(badge, grantsRoute(CANVAS), { subject: "link", capability })
  ).json()) as GrantResponse;

/** A write any admitted editor may make and no viewer may. */
const rename = (badge: TestBadge, actor = priya) =>
  op(badge, {
    canvasId: CANVAS,
    actor,
    op: { type: "project.update", patch: { title: "Not Acme" } },
  });

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-view-"));
  daemon = await startDaemon({ port: 0, home, auth: null });
  const address = daemon.app.server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  owner = await mintTestBadge(base);
  await owner.speakAs(priya);
});

afterEach(async () => {
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true });
});

describe("a view link grant", () => {
  it("admits a stranger to READ, and the read says so", async () => {
    await makeCanvas();
    await shareLink(owner, "view");
    const jordan = await stranger();
    const seen = await get(jordan, `/api/projects/${CANVAS}/canvas`);
    expect(seen.status).toBe(200);
    // The one fact about the reader that rides on the read: the client wears
    // the viewer face instead of discovering it as a refusal per gesture.
    expect(((await seen.json()) as CanvasSnapshotResponse).capability).toBe("view");
    // And the admission the door wrote carries it, because the door test
    // short-circuits on the admission ever after.
    const badge = (await daemon.desk.badge(jordan.badgeId))!;
    expect(badge.admissions[0]).toMatchObject({ canvasId: CANVAS, capability: "view" });
  });

  it("refuses the write with view-only — before it lands, like the door itself", async () => {
    await makeCanvas();
    await shareLink(owner, "view");
    const jordan = await stranger();
    const spectator = { id: "usr_jordan", name: "Jordan" };
    await jordan.speakAs(spectator);
    const wrote = await rename(jordan, spectator);
    expect(wrote.status).toBe(403);
    // NOT `not-admitted`: this badge is admitted, and "ask for the link" is
    // exactly the wrong remedy for somebody the link let in.
    expect(((await wrote.json()) as { code: string }).code).toBe(VIEW_ONLY);
    const snapshot = (await (
      await get(owner, `/api/projects/${CANVAS}/canvas`)
    ).json()) as CanvasSnapshotResponse;
    expect(snapshot.project.title).toBe("Acme Sprint Board");
  });

  it("refuses every canvas-scoped mutation by the hook, with nothing per-route", async () => {
    await makeCanvas();
    await shareLink(owner, "view");
    const jordan = await stranger();
    await get(jordan, `/api/projects/${CANVAS}/canvas`); // enter as a viewer
    for (const [url, body] of [
      [`/api/projects/${CANVAS}/undo`, { actor: priya }],
      [`/api/projects/${CANVAS}/gc`, {}],
      // A viewer who could share, or mint a pass, could hand out more than
      // they hold — the flat "anyone admitted may share" posture is for
      // editors.
      [grantsRoute(CANVAS), { subject: "link" }],
      [`/api/projects/${CANVAS}/passes`, {}],
      [`/api/projects/${CANVAS}/sessions`, { actor: priya, kind: "cli" }],
    ] as const) {
      const refused = await post(jordan, url, body);
      expect(refused.status, url).toBe(403);
      expect(((await refused.json()) as { code: string }).code, url).toBe(VIEW_ONLY);
    }
    // And the reads a viewer exists for are untouched.
    expect((await get(jordan, `/api/projects/${CANVAS}/oplog?since=0`)).status).toBe(200);
    expect((await get(jordan, grantsRoute(CANVAS))).status).toBe(200);
  });

  it("leaves the creator an editor — created outranks whatever the link says", async () => {
    await makeCanvas();
    await shareLink(owner, "view");
    const snapshot = (await (
      await get(owner, `/api/projects/${CANVAS}/canvas`)
    ).json()) as CanvasSnapshotResponse;
    expect(snapshot.capability).toBeUndefined();
    expect((await rename(owner)).status).toBe(200);
  });

  it("tells the SOCKET too — the hello carries the capability", async () => {
    await makeCanvas();
    await shareLink(owner, "view");
    const jordan = await stranger();
    const hello = await new Promise<{ type: string; capability?: string }>((resolve, reject) => {
      const ws = new WebSocket(`${base.replace("http:", "ws:")}/ws?canvasId=${CANVAS}`, {
        headers: jordan.headers,
      });
      ws.on("error", reject);
      ws.on("message", (data) => {
        resolve(JSON.parse(String(data)) as { type: string; capability?: string });
        ws.close();
      });
    });
    expect(hello.type).toBe("snapshot");
    expect(hello.capability).toBe("view");
  });
});

describe("replacing the link's capability", () => {
  it("is one POST, and it reaches the people already inside by re-rooting them", async () => {
    await makeCanvas();
    const jordan = await stranger();
    await get(jordan, `/api/projects/${CANVAS}/canvas`); // in, under the edit link
    const { grant, swept } = await shareLink(owner, "view");
    expect(grant.capability).toBe("view");
    // Re-rooted, not expelled: the new link still admits them — to look.
    expect(swept).toMatchObject({ expelled: 0 });
    expect((swept?.rerooted ?? 0)).toBeGreaterThanOrEqual(1);
    expect((await get(jordan, `/api/projects/${CANVAS}/canvas`)).status).toBe(200);
    const spectator = { id: "usr_jordan", name: "Jordan" };
    await jordan.speakAs(spectator);
    expect((await rename(jordan, spectator)).status).toBe(403);
    // One live row, and it is the view one: a toggle two people can flip must
    // not leave both truths standing.
    const live = (await grantsOf(owner)).filter((g) => g.revokedAt === undefined);
    expect(live.map((g) => [g.subject, g.capability ?? "edit"])).toEqual([["link", "view"]]);
  });

  it("back to edit re-roots the viewers UP — the same sweep, the other direction", async () => {
    await makeCanvas();
    await shareLink(owner, "view");
    const jordan = await stranger();
    await get(jordan, `/api/projects/${CANVAS}/canvas`);
    await shareLink(owner, "edit");
    const spectator = { id: "usr_jordan", name: "Jordan" };
    await jordan.speakAs(spectator);
    expect((await rename(jordan, spectator)).status).toBe(200);
  });

  it("re-asking for what already stands hands back the standing row", async () => {
    await makeCanvas();
    const before = (await grantsOf(owner))[0]!;
    const again = await shareLink(owner, "edit");
    expect(again.grant.id).toBe(before.id);
    expect(again.swept).toBeUndefined();
  });

  it("refuses a word that is not a capability", async () => {
    await makeCanvas();
    const asked = await post(owner, grantsRoute(CANVAS), { subject: "link", capability: "admin" });
    expect(asked.status).toBe(400);
    expect(((await asked.json()) as { code: string }).code).toBe("bad-grant");
  });
});

describe("the upgrade re-ask", () => {
  it("promotes a view admission the moment an edit grant would admit it", async () => {
    await makeCanvas();
    const jordan = await stranger();
    await get(jordan, `/api/projects/${CANVAS}/canvas`); // in, under the edit link
    // A view admission standing beside a live edit grant — the shape the
    // upgrade path exists for: prove-your-email-after-entering makes it
    // through attestation, and this makes it directly.
    const link = (await grantsOf(owner))[0]!;
    await daemon.desk.reroot(jordan.badgeId, CANVAS, { root: "grant", grantId: link.id }, "view");
    // The next ask re-runs the door test, finds the edit grant, re-roots up.
    const seen = await get(jordan, `/api/projects/${CANVAS}/canvas`);
    expect(((await seen.json()) as CanvasSnapshotResponse).capability).toBeUndefined();
    expect((await daemon.desk.badge(jordan.badgeId))!.admissions[0]!.capability).toBeUndefined();
  });
});
