import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { WebSocket } from "ws";
import type {
  Capability,
  CanvasSnapshotResponse,
  Grant,
  GrantResponse,
  GrantsResponse,
  PresenceSession,
  ServerMessage,
  WatchLogResponse,
} from "@isocan/core";
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
const shareLink = async (badge: TestBadge, capability: Capability): Promise<GrantResponse> =>
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

/**
 * **The canvas with the writes hidden** (roles phase 1, journey 1). `read` is
 * the rung between the deck and the editor: the same admission to read as
 * `view`, rendered as the canvas itself. What the daemon enforces between the
 * two is nothing — both read the oplog and neither writes — so every case
 * here that is about a refusal is the SAME refusal `view` gets, with the code
 * unchanged and the message widened. What differs is what the home tells the
 * client (`capability: "read"` on the read and the hello) and that a reader
 * appears in presence, marked as reading.
 */
describe("a read link grant", () => {
  it("names the owner in the refusal — ask Priya, who owns it", async () => {
    await makeCanvas();
    await shareLink(owner, "read");
    const jordan = await stranger();
    await jordan.speakAs(spectator);
    const refused = await rename(jordan, spectator);
    expect(refused.status).toBe(403);
    const body = (await refused.json()) as { code?: string; error?: string };
    expect(body.code).toBe(VIEW_ONLY);
    expect(body.error).toContain("ask Priya, who owns it");
  });

  const spectator = { id: "usr_jordan", name: "Jordan" };

  it("admits a stranger to READ, and the read says `read`", async () => {
    await makeCanvas();
    await shareLink(owner, "read");
    const jordan = await stranger();
    const seen = await get(jordan, `/api/projects/${CANVAS}/canvas`);
    expect(seen.status).toBe(200);
    expect(((await seen.json()) as CanvasSnapshotResponse).capability).toBe("read");
    const badge = (await daemon.desk.badge(jordan.badgeId))!;
    expect(badge.admissions[0]).toMatchObject({ canvasId: CANVAS, capability: "read" });
  });

  it("refuses the write with the SAME code, and a message that says read", async () => {
    await makeCanvas();
    await shareLink(owner, "read");
    const jordan = await stranger();
    await jordan.speakAs(spectator);
    const wrote = await rename(jordan, spectator);
    expect(wrote.status).toBe(403);
    const body = (await wrote.json()) as { code: string; error: string };
    // Old clients branch on the code and keep working; the sentence is the
    // design's: you may read this canvas but not change it.
    expect(body.code).toBe(VIEW_ONLY);
    expect(body.error).toMatch(/you may read this canvas/);
  });

  it("is refused by the hook on every canvas-scoped mutation, like view", async () => {
    await makeCanvas();
    await shareLink(owner, "read");
    const jordan = await stranger();
    await get(jordan, `/api/projects/${CANVAS}/canvas`);
    for (const [url, body] of [
      [`/api/projects/${CANVAS}/undo`, { actor: priya }],
      [grantsRoute(CANVAS), { subject: "link" }],
      [`/api/projects/${CANVAS}/passes`, {}],
    ] as const) {
      const refused = await post(jordan, url, body);
      expect(refused.status, url).toBe(403);
      expect(((await refused.json()) as { code: string }).code, url).toBe(VIEW_ONLY);
    }
    expect((await get(jordan, `/api/projects/${CANVAS}/oplog?since=0`)).status).toBe(200);
  });

  it("tells the SOCKET `read`, and a reader's beat goes up marked as reading", async () => {
    await makeCanvas();
    await shareLink(owner, "read");
    const jordan = await stranger();
    await jordan.speakAs(spectator);
    const ws = new WebSocket(`${base.replace("http:", "ws:")}/ws?canvasId=${CANVAS}`, {
      headers: jordan.headers,
    });
    const hello = await new Promise<ServerMessage>((resolve, reject) => {
      ws.on("error", reject);
      ws.once("message", (data) => resolve(JSON.parse(String(data)) as ServerMessage));
    });
    expect(hello.type).toBe("snapshot");
    expect((hello as { capability?: string }).capability).toBe("read");
    // A person looking over your shoulder is a fact about the room: the
    // beat is accepted, and the session carries the rung the SERVER set —
    // the beat itself said nothing about it.
    ws.send(
      JSON.stringify({
        type: "presence",
        sessionId: "cli_jordan_tab",
        actor: spectator,
        cursor: { x: 1, y: 2 },
        selection: [],
      }),
    );
    const roster = await pollUntil(async () => {
      const sessions = (await (
        await get(owner, `/api/projects/${CANVAS}/sessions`)
      ).json()) as PresenceSession[];
      return sessions.find((s) => s.actor.id === spectator.id) ?? null;
    });
    ws.close();
    expect(roster).toMatchObject({ kind: "web", capability: "read" });
  });

  it("keeps a VIEW connection out of presence, as before", async () => {
    await makeCanvas();
    await shareLink(owner, "view");
    const jordan = await stranger();
    await jordan.speakAs(spectator);
    const ws = new WebSocket(`${base.replace("http:", "ws:")}/ws?canvasId=${CANVAS}`, {
      headers: jordan.headers,
    });
    await new Promise<void>((resolve, reject) => {
      ws.on("error", reject);
      ws.once("message", () => resolve());
    });
    ws.send(
      JSON.stringify({
        type: "presence",
        sessionId: "cli_jordan_deck",
        actor: spectator,
        cursor: null,
        selection: [],
      }),
    );
    // Give a beat that WOULD be accepted time to land, then assert it did not.
    await new Promise((resolve) => setTimeout(resolve, 150));
    const sessions = (await (
      await get(owner, `/api/projects/${CANVAS}/sessions`)
    ).json()) as PresenceSession[];
    ws.close();
    expect(sessions.find((s) => s.actor.id === spectator.id)).toBeUndefined();
  });

  it("re-asks the door for a reader, up to whatever the door now gives", async () => {
    await makeCanvas();
    // The link admits to edit; the admission says read. The next ask
    // re-runs the door and raises the reader — the same re-ask a viewer
    // gets, widened to every rung below edit.
    const jordan = await stranger();
    await get(jordan, `/api/projects/${CANVAS}/canvas`);
    const link = (await grantsOf(owner))[0]!;
    await daemon.desk.reroot(jordan.badgeId, CANVAS, { root: "grant", grantId: link.id }, "read");
    const seen = await get(jordan, `/api/projects/${CANVAS}/canvas`);
    expect(((await seen.json()) as CanvasSnapshotResponse).capability).toBeUndefined();
  });

  it("raises a viewer only as far as the door goes — a read link makes a reader", async () => {
    await makeCanvas();
    await shareLink(owner, "read");
    const jordan = await stranger();
    await get(jordan, `/api/projects/${CANVAS}/canvas`);
    const link = (await grantsOf(owner)).find((g) => g.revokedAt === undefined)!;
    await daemon.desk.reroot(jordan.badgeId, CANVAS, { root: "grant", grantId: link.id }, "view");
    const seen = await get(jordan, `/api/projects/${CANVAS}/canvas`);
    expect(((await seen.json()) as CanvasSnapshotResponse).capability).toBe("read");
    await jordan.speakAs(spectator);
    expect((await rename(jordan, spectator)).status).toBe(403);
  });
});

/**
 * **`own` round-trips, and counts as editing.** Phase 1 builds nothing that
 * `own` gates — that is phase 2 — but every storage and wire path writes any
 * rung that is not edit, so a row at `own` written today reads back as `own`
 * tomorrow rather than as edit.
 */
describe("an own grant", () => {
  it("is accepted, stored, copied onto the admission, and admits to writing", async () => {
    await makeCanvas();
    const { grant } = await shareLink(owner, "own");
    expect(grant.capability).toBe("own");
    expect((await grantsOf(owner)).find((g) => g.revokedAt === undefined)?.capability).toBe("own");
    const jordan = await stranger();
    const seen = await get(jordan, `/api/projects/${CANVAS}/canvas`);
    expect(((await seen.json()) as CanvasSnapshotResponse).capability).toBe("own");
    expect((await daemon.desk.badge(jordan.badgeId))!.admissions[0]!.capability).toBe("own");
    const spectator = { id: "usr_jordan", name: "Jordan" };
    await jordan.speakAs(spectator);
    expect((await rename(jordan, spectator)).status).toBe(200);
  });
});

/**
 * **The creator stays when the link goes** (roles journey 1, step 2). The
 * creator's floor is applied at the door, and the sweep IS the door re-run:
 * a second badge claiming the creator — the browser tab, on a canvas made
 * from a terminal — that entered by the link is re-rooted at `created` and
 * keeps the canvas; the stranger beside it is expelled.
 */
describe("the creator's floor", () => {
  it("keeps the creator's other badge through `--link off`, and expels the stranger", async () => {
    await makeCanvas();
    const tab = await stranger();
    await tab.speakAs(priya);
    expect((await get(tab, `/api/projects/${CANVAS}/canvas`)).status).toBe(200);
    const passerby = await stranger();
    expect((await get(passerby, `/api/projects/${CANVAS}/canvas`)).status).toBe(200);

    const link = (await grantsOf(owner)).find((g) => g.subject === "link")!;
    const off = await fetch(`${base}${grantsRoute(CANVAS)}/${link.id}`, {
      method: "DELETE",
      headers: owner.headers,
    });
    expect(((await off.json()) as GrantResponse).swept).toEqual({ expelled: 1, rerooted: 1 });

    expect((await get(tab, `/api/projects/${CANVAS}/canvas`)).status).toBe(200);
    expect((await rename(tab)).status).toBe(200);
    const admission = (await daemon.desk.badge(tab.badgeId))!.admissions[0]!;
    expect(admission.provenance).toEqual({ root: "created" });
    expect((await get(passerby, `/api/projects/${CANVAS}/canvas`)).status).toBe(403);
  });

  it("admits the creator's other badge at the door with no row at all", async () => {
    await makeCanvas();
    const link = (await grantsOf(owner)).find((g) => g.subject === "link")!;
    await fetch(`${base}${grantsRoute(CANVAS)}/${link.id}`, { method: "DELETE", headers: owner.headers });
    const tab = await stranger();
    await tab.speakAs(priya);
    const seen = await get(tab, `/api/projects/${CANVAS}/canvas`);
    expect(seen.status).toBe(200);
    // The floor is own, and it rides the read like any rung that is not edit.
    expect(((await seen.json()) as CanvasSnapshotResponse).capability).toBe("own");
    expect((await get(await stranger(), `/api/projects/${CANVAS}/canvas`)).status).toBe(403);
  });
});

/**
 * **The oplog watch checks admission per canvas** (roles phase 1, closing
 * the hole the design named: it used to check none, so any badge on the
 * home could read any canvas's oplog through it).
 */
describe("POST /api/oplog/watch", () => {
  it("reports only the canvases the door would admit the badge to", async () => {
    await makeCanvas();
    const link = (await grantsOf(owner)).find((g) => g.subject === "link")!;
    const heard = async (badge: TestBadge): Promise<string[]> =>
      Object.keys(((await (await post(badge, "/api/oplog/watch", { only: [CANVAS] })).json()) as WatchLogResponse).cursors);
    // The link is on: a stranger hears it, without entering.
    expect(await heard(await stranger())).toEqual([CANVAS]);
    await fetch(`${base}${grantsRoute(CANVAS)}/${link.id}`, { method: "DELETE", headers: owner.headers });
    // Off: a stranger hears nothing about it, and the creator still does.
    expect(await heard(await stranger())).toEqual([]);
    expect(await heard(owner)).toEqual([CANVAS]);
  });
});

/** Ask until it answers, for presence that lands a beat after the send. */
async function pollUntil<T>(ask: () => Promise<T | null>, tries = 40): Promise<T | null> {
  for (let i = 0; i < tries; i++) {
    const found = await ask();
    if (found !== null) return found;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return null;
}

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

/**
 * **Whose link it is** — the gap #88 left, found by somebody falling into it.
 *
 * An account that had not made the canvas pressed "Can view", and the sweep
 * that re-roots everybody at the surviving grant took THEM with it: into a
 * canvas they could now only look at, with the control that would undo it
 * behind the edit they had just given away. Every editor could do that, to
 * everybody, including themselves — and the way out was to be somebody else.
 *
 * So the capability is the owner's alone. Ownership is `project.createdBy`,
 * which every canvas has already carried since the first one, and it is
 * checked against the badge's CLAIMS rather than one badge id: the canvas may
 * have been made from a terminal and the link pressed in a browser, which is
 * precisely the shape that produced the report.
 */
describe("changing what the link admits to", () => {
  const jordan = { id: "usr_jordan", name: "Jordan" };

  /** An editor who did not make this canvas: in on the link, and able to write. */
  async function editorWhoDoesNotOwnIt(): Promise<TestBadge> {
    const badge = await stranger();
    await badge.speakAs(jordan);
    // In on the (edit) link, and really an editor — so what refuses below is
    // ownership and not some other missing permission.
    expect((await rename(badge, jordan)).status).toBe(200);
    return badge;
  }

  it("is refused for an editor who did not make the canvas", async () => {
    await makeCanvas();
    const other = await editorWhoDoesNotOwnIt();
    const answer = await post(other, grantsRoute(CANVAS), { subject: "link", capability: "view" });
    expect(answer.status).toBe(403);
    const body = (await answer.json()) as { code?: string; error?: string };
    expect(body.code).toBe("not-owner");
    // The refusal names who to ask, because "no" alone leaves somebody stuck.
    expect(body.error).toContain("Priya");
  });

  it("leaves the link exactly as it was when it refuses", async () => {
    // The damage was never the button; it was the sweep behind it.
    await makeCanvas();
    const other = await editorWhoDoesNotOwnIt();
    await post(other, grantsRoute(CANVAS), { subject: "link", capability: "view" });
    const link = (await grantsOf(owner)).find((g) => g.subject === "link");
    expect(link?.capability).toBeUndefined(); // absent means edit
    // And the person who tried it can still work, rather than having demoted
    // themselves out of the room.
    expect((await rename(other, jordan)).status).toBe(200);
  });

  it("is allowed for the person who made it", async () => {
    await makeCanvas();
    const answer = await post(owner, grantsRoute(CANVAS), { subject: "link", capability: "view" });
    expect(answer.status).toBe(200);
    expect((await grantsOf(owner)).find((g) => g.subject === "link")?.capability).toBe("view");
  });

  /**
   * **Every write to grants is an owner's** (roles phase 2). Until this an
   * editor could invite at edit and turn the link off; the research's
   * argument stood — an editor who can invite is an owner with extra steps —
   * and this is the one deliberate change in behaviour for existing users.
   */
  it("refuses an editor an invitation, and the link's off switch, with NOT_OWNER naming the owner", async () => {
    await makeCanvas();
    const other = await editorWhoDoesNotOwnIt();
    const invited = await post(other, grantsRoute(CANVAS), { subject: "email:sam@acme.test" });
    expect(invited.status).toBe(403);
    const body = (await invited.json()) as { code?: string; error?: string };
    expect(body.code).toBe("not-owner");
    expect(body.error).toContain("ask Priya, who owns this canvas");
    const link = (await grantsOf(owner)).find((g) => g.subject === "link")!;
    const off = await fetch(`${base}${grantsRoute(CANVAS)}/${link.id}`, {
      method: "DELETE",
      headers: other.headers,
    });
    expect(off.status).toBe(403);
    expect(((await off.json()) as { code?: string }).code).toBe("not-owner");
    // And the link is exactly as it was.
    expect((await grantsOf(owner)).find((g) => g.subject === "link")?.revokedAt).toBeUndefined();
    // The editor still edits: a refusal changed nothing about them.
    expect((await rename(other, jordan)).status).toBe(200);
  });

  it("lets a person invited at `own` set the link and turn it off, like the creator", async () => {
    await makeCanvas();
    const badge = await stranger();
    await badge.speakAs(jordan);
    // The row is written on the desk — this home has no attester to prove an
    // address through — and the proof is written on her badge the same way.
    await daemon.desk.putGrant({
      id: "gnt_jordan_own",
      canvasId: CANVAS,
      subject: "email:jordan@acme.test",
      grantedBy: owner.badgeId,
      at: new Date().toISOString(),
      capability: "own",
    });
    await daemon.desk.attest(badge.badgeId, {
      attribute: "email:jordan@acme.test",
      verifiedVia: "magic-link",
      at: new Date().toISOString(),
    });
    const seen = await get(badge, `/api/projects/${CANVAS}/canvas`);
    expect(((await seen.json()) as CanvasSnapshotResponse).capability).toBe("own");
    // What only an owner may do, done by the second owner.
    expect((await post(badge, grantsRoute(CANVAS), { subject: "link", capability: "read" })).status).toBe(200);
    const link = (await grantsOf(owner)).find((g) => g.subject === "link" && g.revokedAt === undefined)!;
    expect(link.capability).toBe("read");
    const off = await fetch(`${base}${grantsRoute(CANVAS)}/${link.id}`, {
      method: "DELETE",
      headers: badge.headers,
    });
    expect(off.status).toBe(200);
    // The creator's standing is not a row, so there is nothing of theirs to
    // remove — and the creator still owns the canvas with the link off.
    expect((await grantsOf(owner)).filter((g) => g.revokedAt === undefined)).toEqual([
      expect.objectContaining({ id: "gnt_jordan_own" }),
    ]);
    expect((await post(owner, grantsRoute(CANVAS), { subject: "link" })).status).toBe(200);
  });

  it("refuses a row naming the creator's own address as redundant", async () => {
    await makeCanvas();
    await daemon.desk.attest(owner.badgeId, {
      attribute: "email:priya@acme.test",
      verifiedVia: "magic-link",
      at: new Date().toISOString(),
    });
    const answer = await post(owner, grantsRoute(CANVAS), { subject: "email:priya@acme.test" });
    expect(answer.status).toBe(400);
    const body = (await answer.json()) as { code?: string; error?: string };
    expect(body.code).toBe("bad-grant");
    expect(body.error).toContain("Priya's own address");
  });

  it("raises an invited person's rung with one POST, and the sweep moves them", async () => {
    await makeCanvas();
    await shareLink(owner, "view");
    const badge = await stranger();
    await daemon.desk.putGrant({
      id: "gnt_jordan_read",
      canvasId: CANVAS,
      subject: "email:jordan@acme.test",
      grantedBy: owner.badgeId,
      at: new Date().toISOString(),
      capability: "read",
    });
    await daemon.desk.attest(badge.badgeId, {
      attribute: "email:jordan@acme.test",
      verifiedVia: "magic-link",
      at: new Date().toISOString(),
    });
    await get(badge, `/api/projects/${CANVAS}/canvas`);
    // The route refuses an email subject on a home with no attester, so the
    // replacement is made the way the route makes it and the sweep is run
    // through the daemon's own hub — the same sweep the route runs.
    await daemon.desk.revokeGrant("gnt_jordan_read", new Date().toISOString(), owner.badgeId);
    await daemon.desk.putGrant({
      id: "gnt_jordan_edit",
      canvasId: CANVAS,
      subject: "email:jordan@acme.test",
      grantedBy: owner.badgeId,
      at: new Date().toISOString(),
    });
    const { sweepCanvas } = await import("../src/sweep.ts");
    expect(await sweepCanvas(daemon.desk, CANVAS, priya.id, daemon.sweeps.report)).toEqual({
      expelled: 0,
      rerooted: 1,
    });
    const seen = await get(badge, `/api/projects/${CANVAS}/canvas`);
    expect(((await seen.json()) as CanvasSnapshotResponse).capability).toBeUndefined();
  });
});
