import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type {
  CanvasSnapshotResponse,
  Canvas,
  Grant,
  GrantResponse,
  GrantsResponse,
  SpaceCanvasResponse,
  SpaceLinkResponse,
  SpaceResponse,
  SpacesResponse,
} from "@isocan/core";
import {
  grantRoute,
  grantsRoute,
  spaceCanvasRoute,
  spaceGrantRoute,
  spaceGrantsRoute,
  spaceLinkRoute,
  spaceRoute,
  SPACES_ROUTE,
} from "@isocan/core";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

/**
 * **The space** (roles phase 4; journeys 4, 5 and 7's space half): a named
 * set of canvases access is set on once. What is asserted here is the
 * daemon's, never the app's — every gate is a request from a badge holding
 * the lower standing, refused with the code the design names — and the
 * merged door: a row on the space admits to every canvas in it, a canvas's
 * own rows can only add to what the space gives, a bar on the space refuses,
 * and the space's creator holds the floor.
 *
 * This home has borrowed an attester in configuration only (nothing is
 * verified; proofs are written on the desk), because a space has no link
 * row and every row on it is answered by attestation.
 *
 * Fixtures are synthetic: Acme, Priya, Jordan, Sam.
 */

const priya = { id: "usr_priya", name: "Priya" };
const jordan = { id: "usr_jordan", name: "Jordan" };
const JORDAN = "email:jordan@acme.test";
const SAM = "email:sam@acme.test";

let home: string;
let daemon: Daemon;
let base: string;
let owner: TestBadge;

async function boot(): Promise<void> {
  daemon = await startDaemon({
    port: 0,
    home,
    birthHome: null,
    auth: { project: "acme-test", apiKey: "test-key" },
  });
  const address = daemon.app.server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
}

const stranger = () => mintTestBadge(base);

const post = (badge: TestBadge, url: string, body: unknown) =>
  fetch(`${base}${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...badge.headers },
    body: JSON.stringify(body),
  });
const put = (badge: TestBadge, url: string, body: unknown) =>
  fetch(`${base}${url}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...badge.headers },
    body: JSON.stringify(body),
  });
const del = (badge: TestBadge, url: string) =>
  fetch(`${base}${url}`, { method: "DELETE", headers: badge.headers });
const get = (badge: TestBadge, url: string) => fetch(`${base}${url}`, { headers: badge.headers });
const body = (res: Response) => res.json() as Promise<{ code?: string; error?: string }>;

/** Enter a canvas: the door's answer, as a status. */
const enter = (badge: TestBadge, canvasId: string) => get(badge, `/api/projects/${canvasId}/canvas`);
const rungIn = async (badge: TestBadge, canvasId: string): Promise<string | undefined> =>
  ((await (await enter(badge, canvasId)).json()) as CanvasSnapshotResponse).capability;

const prove = (badge: TestBadge, attribute: string) =>
  daemon.desk.attest(badge.badgeId, { attribute, verifiedVia: "magic-link", at: new Date().toISOString() });
/** A badge that has proved this address and nothing else. */
const holderOf = async (attribute: string): Promise<TestBadge> => {
  const badge = await stranger();
  await prove(badge, attribute);
  return badge;
};

let made = 0;
async function makeCanvas(by: TestBadge = owner, actor = priya): Promise<string> {
  const canvasId = `prj_acme_${++made}`;
  const res = await post(by, "/api/ops", {
    canvasId: null,
    actor,
    op: { type: "project.create", canvasId, title: `Acme board ${made}` },
  });
  if (!res.ok) throw new Error(`could not create the canvas: ${await res.text()}`);
  return canvasId;
}

async function makeSpace(name = "Design", by: TestBadge = owner): Promise<SpaceResponse["space"]> {
  const res = await post(by, SPACES_ROUTE, { name });
  if (!res.ok) throw new Error(`could not make the space: ${await res.text()}`);
  return ((await res.json()) as SpaceResponse).space;
}

async function addTo(spaceId: string, canvasId: string, by: TestBadge = owner): Promise<SpaceCanvasResponse> {
  const res = await put(by, spaceCanvasRoute(spaceId, canvasId), {});
  if (!res.ok) throw new Error(`could not add ${canvasId}: ${await res.text()}`);
  return (await res.json()) as SpaceCanvasResponse;
}

const spacesSeenBy = async (badge: TestBadge): Promise<string[]> =>
  ((await (await get(badge, SPACES_ROUTE)).json()) as SpacesResponse).spaces.map((s) => s.id);

const grantsOn = async (canvasId: string): Promise<Grant[]> =>
  ((await (await get(owner, grantsRoute(canvasId))).json()) as GrantsResponse).grants;
const linkOn = async (canvasId: string): Promise<Grant | undefined> =>
  (await grantsOn(canvasId)).find((g) => g.subject === "link");

/** Turn a canvas's own link off, as the owner. */
async function linkOff(canvasId: string): Promise<void> {
  const link = await linkOn(canvasId);
  if (link) await del(owner, grantRoute(canvasId, link.id));
}

async function inviteOnSpace(
  spaceId: string,
  subject: string,
  capability?: string,
  by: TestBadge = owner,
): Promise<Response> {
  return post(by, spaceGrantsRoute(spaceId), { subject, ...(capability ? { capability } : {}) });
}

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-spaces-"));
  made = 0;
  await boot();
  owner = await mintTestBadge(base);
  await owner.speakAs(priya);
});

afterEach(async () => {
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true });
});

describe("making a space", () => {
  it("needs a name and an actor, and the creator sees it while a stranger sees nothing", async () => {
    const nameless = await post(owner, SPACES_ROUTE, {});
    expect(nameless.status).toBe(400);
    expect((await body(nameless)).code).toBe("bad-space");

    const nobody = await stranger(); // claims no actor
    const unmade = await post(nobody, SPACES_ROUTE, { name: "Design" });
    expect(unmade.status).toBe(400);
    expect((await body(unmade)).code).toBe("bad-space");

    const space = await makeSpace("  Design ");
    expect(space.id).toMatch(/^spc_/);
    expect(space.name).toBe("Design"); // trimmed
    expect(space.createdBy).toBe(priya.id);
    expect(space.canvasIds).toEqual([]);
    expect(await spacesSeenBy(owner)).toEqual([space.id]);
    // A space with no rows is visible to nobody else: making one is a
    // private act until it is shared.
    expect(await spacesSeenBy(nobody)).toEqual([]);
  });

  it("names are unique among the spaces one actor owns, and free for another actor", async () => {
    const first = await makeSpace("Design");
    const again = await post(owner, SPACES_ROUTE, { name: "design" });
    expect(again.status).toBe(409);
    const why = await body(again);
    expect(why.code).toBe("space-name-taken");
    expect(why.error).toContain(first.id);
    const other = await stranger();
    await other.speakAs(jordan);
    const theirs = await post(other, SPACES_ROUTE, { name: "Design" });
    expect(theirs.status).toBe(200);
  });
});

describe("what a space holds", () => {
  it("adds a canvas with `own` on both, refuses a canvas already in another space, and is idempotent", async () => {
    const design = await makeSpace("Design");
    const research = await makeSpace("Research");
    const canvasId = await makeCanvas();

    const added = await addTo(design.id, canvasId);
    expect(added.space.canvasIds).toEqual([canvasId]);
    expect(added.reached).toBe(1);
    expect((await daemon.desk.spaceOf(canvasId))?.id).toBe(design.id);

    // A canvas is in at most one space.
    const twice = await put(owner, spaceCanvasRoute(research.id, canvasId), {});
    expect(twice.status).toBe(409);
    const why = await body(twice);
    expect(why.code).toBe("canvas-in-space");
    expect(why.error).toContain(design.id);

    // Adding it where it already is changes nothing and refuses nothing.
    const same = await addTo(design.id, canvasId);
    expect(same.reached).toBe(0);
    expect(same.space.canvasIds).toEqual([canvasId]);

    // A canvas that is not here is a 404, and one this badge does not own is
    // refused as not-owner even by the space's owner.
    expect((await put(owner, spaceCanvasRoute(design.id, "prj_nope"), {})).status).toBe(404);
    const theirs = await stranger();
    await theirs.speakAs(jordan);
    const jordansCanvas = await makeCanvas(theirs, jordan);
    const notMine = await put(owner, spaceCanvasRoute(design.id, jordansCanvas), {});
    expect(notMine.status).toBe(403);
    expect((await body(notMine)).code).toBe("not-owner");
  });

  it("refuses every write from below `own` on the space, and hides the space from those who may not see it", async () => {
    const design = await makeSpace("Design");
    const canvasId = await makeCanvas();
    await addTo(design.id, canvasId);
    // An editor of the space: a live row at edit names Jordan.
    expect((await inviteOnSpace(design.id, JORDAN, "edit")).status).toBe(200);
    const editor = await holderOf(JORDAN);
    await editor.speakAs(jordan);
    // May see it, may read its rows…
    expect(await spacesSeenBy(editor)).toEqual([design.id]);
    expect((await get(editor, spaceGrantsRoute(design.id))).status).toBe(200);
    // …and may change nothing about it.
    const refusals = [
      await inviteOnSpace(design.id, SAM, "edit", editor),
      await put(editor, spaceCanvasRoute(design.id, canvasId), {}),
      await del(editor, spaceCanvasRoute(design.id, canvasId)),
      await del(editor, spaceRoute(design.id)),
      await post(editor, spaceLinkRoute(design.id), { capability: "off" }),
    ];
    for (const refused of refusals) {
      expect(refused.status).toBe(403);
      const why = await body(refused);
      expect(why.code).toBe("not-owner");
      expect(why.error).toContain("Priya");
    }
    // A badge the space knows nothing about is told there is no such space —
    // the same answer as for one that never existed, so a canvas invitee
    // learns nothing about the space around it.
    const outsider = await stranger();
    for (const refused of [
      await get(outsider, spaceGrantsRoute(design.id)),
      await inviteOnSpace(design.id, SAM, "edit", outsider),
      await del(outsider, spaceRoute(design.id)),
      await get(outsider, spaceGrantsRoute("spc_never")),
    ]) {
      expect(refused.status).toBe(404);
      expect((await body(refused)).code).toBe("space-not-found");
    }
  });
});

describe("the merged door", () => {
  it("a row on the space admits to every canvas in it, with no row on any canvas", async () => {
    const design = await makeSpace("Design");
    const a = await makeCanvas();
    const b = await makeCanvas();
    await addTo(design.id, a);
    await addTo(design.id, b);
    await linkOff(a);
    await linkOff(b);
    const invited = (await (await inviteOnSpace(design.id, JORDAN, "edit")).json()) as GrantResponse;
    expect(invited.grant).toMatchObject({ spaceId: design.id, subject: JORDAN });
    expect(invited.reached).toBe(2);

    const jordanBadge = await holderOf(JORDAN);
    expect(await rungIn(jordanBadge, a)).toBeUndefined(); // edit
    expect((await enter(jordanBadge, b)).status).toBe(200);
    // The provenance names the space's row, whichever scope it came from.
    const record = await daemon.desk.badge(jordanBadge.badgeId);
    expect(record!.admissions.find((row) => row.canvasId === a)!.provenance).toEqual({
      root: "grant",
      grantId: invited.grant.id,
    });
    // Nobody else: the space's row is about Jordan.
    expect((await enter(await stranger(), a)).status).toBe(403);
    // And Jordan sees the space, and the two canvases, and the canvas list
    // for a stranger has neither.
    expect(await spacesSeenBy(jordanBadge)).toEqual([design.id]);
    const listed = (await (await get(jordanBadge, "/api/projects")).json()) as Canvas[];
    expect(listed.map((c) => c.id).sort()).toEqual([a, b].sort());
  });

  it("a canvas row below the space's rung is written and does not lower; the highest wins across both", async () => {
    const design = await makeSpace("Design");
    const a = await makeCanvas();
    await addTo(design.id, a);
    await linkOff(a);
    await inviteOnSpace(design.id, JORDAN, "edit");
    // Journey 4 step 6, the other way round: the canvas says read, the space
    // says edit, and the space's rung holds.
    const lower = await post(owner, grantsRoute(a), { subject: JORDAN, capability: "read" });
    expect(lower.status).toBe(200);
    const jordanBadge = await holderOf(JORDAN);
    expect(await rungIn(jordanBadge, a)).toBeUndefined(); // edit, from the space
    // Raise the canvas's row above the space's, and the canvas's holds.
    await post(owner, grantsRoute(a), { subject: JORDAN, capability: "own" });
    expect(await rungIn(jordanBadge, a)).toBe("own");
  });

  it("a bar on the space refuses on every canvas, whatever the canvas's own rows say", async () => {
    const design = await makeSpace("Design");
    const a = await makeCanvas();
    await addTo(design.id, a);
    // Sam is invited on the canvas at edit, and the link is on besides.
    await post(owner, grantsRoute(a), { subject: SAM });
    const sam = await holderOf(SAM);
    expect((await enter(sam, a)).status).toBe(200);
    const barred = (await (
      await post(owner, spaceGrantsRoute(design.id), { subject: SAM, bars: true })
    ).json()) as GrantResponse;
    expect(barred.grant).toMatchObject({ spaceId: design.id, bars: true });
    // The write swept every canvas in the space, and the sweep met the bar.
    expect(barred.swept).toEqual({ expelled: 1, rerooted: 0 });
    expect(barred.reached).toBe(1);
    const refused = await enter(sam, a);
    expect(refused.status).toBe(403);
    expect((await body(refused)).code).toBe("not-admitted");
    // A stranger is admitted by the same link: the bar is about Sam.
    expect((await enter(await stranger(), a)).status).toBe(200);
    // Lifting it is the ordinary DELETE on the space's row.
    expect((await del(owner, spaceGrantRoute(design.id, barred.grant.id))).status).toBe(200);
    expect((await enter(sam, a)).status).toBe(200);
  });

  it("the space's creator holds the floor over a canvas somebody else made, and loses it when the canvas leaves", async () => {
    const design = await makeSpace("Design");
    // Jordan makes a canvas and is made an owner of the space, so Jordan may
    // add it: `own` on both.
    const jordanBadge = await holderOf(JORDAN);
    await jordanBadge.speakAs(jordan);
    const theirs = await makeCanvas(jordanBadge, jordan);
    await linkOff(theirs).catch(() => {});
    const jordansLink = (await (await get(jordanBadge, grantsRoute(theirs))).json()) as GrantsResponse;
    await del(jordanBadge, grantRoute(theirs, jordansLink.grants[0]!.id));
    expect((await inviteOnSpace(design.id, JORDAN, "own")).status).toBe(200);
    await addTo(design.id, theirs, jordanBadge);

    // Priya's second surface: claims Priya, proved nothing, named by no row.
    const phone = await stranger();
    await phone.speakAs(priya);
    expect(await rungIn(phone, theirs)).toBe("own");
    const record = await daemon.desk.badge(phone.badgeId);
    expect(record!.admissions.find((row) => row.canvasId === theirs)!.provenance).toEqual({
      root: "space",
      spaceId: design.id,
    });
    // And as an owner, Priya may invite on a canvas she never touched
    // (journey 7 step 3).
    expect((await post(phone, grantsRoute(theirs), { subject: SAM })).status).toBe(200);

    // The canvas leaves the space: the floor is re-asked by the sweep and
    // Priya, who holds no row on Jordan's canvas, is put out.
    const removed = (await (await del(jordanBadge, spaceCanvasRoute(design.id, theirs))).json()) as SpaceCanvasResponse;
    expect(removed.space.canvasIds).toEqual([]);
    expect(removed.swept.expelled).toBeGreaterThanOrEqual(1);
    const gone = await enter(phone, theirs);
    expect(gone.status).toBe(403);
  });
});

describe("the space's rows", () => {
  it("refuses `link` as a subject, and the every-canvas link is the loop that sets each canvas's row", async () => {
    const design = await makeSpace("Design");
    const canvases = [await makeCanvas(), await makeCanvas(), await makeCanvas()];
    for (const id of canvases) await addTo(design.id, id);
    const asRow = await post(owner, spaceGrantsRoute(design.id), { subject: "link" });
    expect(asRow.status).toBe(400);
    expect((await body(asRow)).code).toBe("bad-space");

    // Journey 4 step 4: off, in one gesture, and the answer names three.
    const off = (await (await post(owner, spaceLinkRoute(design.id), { capability: "off" })).json()) as SpaceLinkResponse;
    expect(off.reached).toBe(3);
    expect(off.changed).toBe(3);
    expect(off.canvasIds.sort()).toEqual([...canvases].sort());
    for (const id of canvases) {
      expect(await linkOn(id)).toBeUndefined();
      expect((await enter(await stranger(), id)).status).toBe(403);
    }
    // Each link row was revoked with Priya's badge as the revoker.
    for (const id of canvases) {
      const rows = await daemon.desk.grantsFor(id);
      expect(rows.find((g) => g.subject === "link")!.revokedBy).toBe(owner.badgeId);
    }
    // Off again reaches three and changes nothing.
    const again = (await (await post(owner, spaceLinkRoute(design.id), { capability: "off" })).json()) as SpaceLinkResponse;
    expect(again).toMatchObject({ reached: 3, changed: 0 });

    // Journey 5: one canvas's own link back on at view — the floor is not
    // the ceiling — and a stranger sees that deck and is refused on the
    // other two.
    await post(owner, grantsRoute(canvases[0]!), { subject: "link", capability: "view" });
    const client = await stranger();
    expect(await rungIn(client, canvases[0]!)).toBe("view");
    expect((await enter(client, canvases[1]!)).status).toBe(403);
    expect((await enter(client, canvases[2]!)).status).toBe(403);
    // The client's canvas list is that one canvas, and their spaces list is
    // empty (journey 5's acceptance line).
    const listed = (await (await get(client, "/api/projects")).json()) as Canvas[];
    expect(listed.map((c) => c.id)).toEqual([canvases[0]]);
    expect(await spacesSeenBy(client)).toEqual([]);

    // A rung on the every-canvas link writes a row on each, replacing what
    // stands, and `own` is refused.
    const read = (await (await post(owner, spaceLinkRoute(design.id), { capability: "read" })).json()) as SpaceLinkResponse;
    expect(read).toMatchObject({ reached: 3, changed: 3 });
    for (const id of canvases) expect((await linkOn(id))?.capability).toBe("read");
    const owning = await post(owner, spaceLinkRoute(design.id), { capability: "own" });
    expect(owning.status).toBe(400);
  });

  it("a write on the space sweeps every canvas in it and reports the count reached", async () => {
    const design = await makeSpace("Design");
    const canvases = [await makeCanvas(), await makeCanvas()];
    for (const id of canvases) await addTo(design.id, id);
    await post(owner, spaceLinkRoute(design.id), { capability: "off" });
    const invited = (await (await inviteOnSpace(design.id, JORDAN, "read")).json()) as GrantResponse;
    const jordanBadge = await holderOf(JORDAN);
    for (const id of canvases) expect(await rungIn(jordanBadge, id)).toBe("read");
    // Raised on the space: both canvases are swept and both admissions are
    // re-rooted onto the new row — a change that reaches the room.
    const raised = (await (await inviteOnSpace(design.id, JORDAN, "edit")).json()) as GrantResponse;
    expect(raised.reached).toBe(2);
    expect(raised.swept).toEqual({ expelled: 0, rerooted: 2 });
    expect(raised.grant.id).not.toBe(invited.grant.id);
    // Revoked on the space: both are put out.
    const revoked = (await (await del(owner, spaceGrantRoute(design.id, raised.grant.id))).json()) as GrantResponse;
    expect(revoked.reached).toBe(2);
    expect(revoked.swept).toEqual({ expelled: 2, rerooted: 0 });
    expect(revoked.stillAdmittedBy).toBeUndefined();
    for (const id of canvases) expect((await enter(jordanBadge, id)).status).toBe(403);
  });

  it("removing a canvas from the space refuses the space's invitee on it", async () => {
    const design = await makeSpace("Design");
    const a = await makeCanvas();
    await addTo(design.id, a);
    await linkOff(a);
    await inviteOnSpace(design.id, JORDAN, "edit");
    const jordanBadge = await holderOf(JORDAN);
    expect((await enter(jordanBadge, a)).status).toBe(200);
    const removed = (await (await del(owner, spaceCanvasRoute(design.id, a))).json()) as SpaceCanvasResponse;
    expect(removed.reached).toBe(1);
    expect(removed.swept).toEqual({ expelled: 1, rerooted: 0 });
    expect(await daemon.desk.spaceOf(a)).toBeNull();
    const refused = await enter(jordanBadge, a);
    expect(refused.status).toBe(403);
    // Removing it again is nothing, not an error.
    const again = (await (await del(owner, spaceCanvasRoute(design.id, a))).json()) as SpaceCanvasResponse;
    expect(again.reached).toBe(0);
  });

  it("deleting the space leaves every canvas with its own rows, sweeps each, and stops listing it", async () => {
    const design = await makeSpace("Design");
    const a = await makeCanvas();
    const b = await makeCanvas();
    await addTo(design.id, a);
    await addTo(design.id, b);
    await linkOff(a); // b keeps its link
    await inviteOnSpace(design.id, JORDAN, "edit");
    const jordanBadge = await holderOf(JORDAN);
    expect((await enter(jordanBadge, a)).status).toBe(200);
    expect((await enter(jordanBadge, b)).status).toBe(200);

    const gone = (await (await del(owner, spaceRoute(design.id))).json()) as SpaceCanvasResponse;
    expect(gone.space.deletedAt).toBeDefined();
    expect(gone.reached).toBe(2);
    // Put out of a. On b Jordan was rooted at the LINK, not the space's row
    // — among rows of one rung the older wins, and b's link is older — so
    // the root stands and nothing is rewritten.
    expect(gone.swept).toEqual({ expelled: 1, rerooted: 0 });
    expect(await daemon.desk.spaceOf(a)).toBeNull();
    expect(await spacesSeenBy(owner)).toEqual([]);
    expect((await enter(jordanBadge, a)).status).toBe(403);
    expect((await enter(jordanBadge, b)).status).toBe(200);
    // Idempotent for its owner; not there for anybody else.
    expect((await del(owner, spaceRoute(design.id))).status).toBe(200);
    expect((await del(await stranger(), spaceRoute(design.id))).status).toBe(404);
  });

  it("`stillAdmittedBy` says `space` when the space's row would still admit the subject", async () => {
    const design = await makeSpace("Design");
    const a = await makeCanvas();
    await addTo(design.id, a);
    await inviteOnSpace(design.id, JORDAN, "edit");
    const onCanvas = (await (await post(owner, grantsRoute(a), { subject: JORDAN, capability: "read" })).json()) as GrantResponse;
    const removed = (await (await del(owner, grantRoute(a, onCanvas.grant.id))).json()) as GrantResponse;
    // The space wins over the link as the answer: it is the more specific one.
    expect(removed.stillAdmittedBy).toBe("space");
    const jordanBadge = await holderOf(JORDAN);
    expect((await enter(jordanBadge, a)).status).toBe(200);
    // A subject the space does not name falls back to the link's answer.
    const sam = (await (await post(owner, grantsRoute(a), { subject: SAM })).json()) as GrantResponse;
    const samRemoved = (await (await del(owner, grantRoute(a, sam.grant.id))).json()) as GrantResponse;
    expect(samRemoved.stillAdmittedBy).toBe("link");
  });
});

describe("born in a space", () => {
  it("writes no link grant, adds the newborn to the space, and refuses `spaceId` beside anything else", async () => {
    const design = await makeSpace("Design");
    const born = await post(owner, "/api/ops", {
      canvasId: null,
      actor: priya,
      spaceId: design.id,
      op: { type: "project.create", canvasId: "prj_newborn", title: "Born locked" },
    });
    expect(born.status, await born.clone().text()).toBe(200);
    expect(await daemon.desk.grantsFor("prj_newborn")).toEqual([]);
    expect((await daemon.desk.space(design.id))!.canvasIds).toEqual(["prj_newborn"]);
    // A locked space stays locked as it grows: a stranger is refused, the
    // creator is admitted by the floor, and the space's invitee walks in.
    expect((await enter(await stranger(), "prj_newborn")).status).toBe(403);
    // The creator: the bootstrap admission (no rung on the wire — roles
    // phase 1's finding) and `own` where it matters, on an owner's write.
    expect((await enter(owner, "prj_newborn")).status).toBe(200);
    expect((await post(owner, grantsRoute("prj_newborn"), { subject: SAM })).status).toBe(200);
    await inviteOnSpace(design.id, JORDAN, "edit");
    expect((await enter(await holderOf(JORDAN), "prj_newborn")).status).toBe(200);

    // The shape: only beside a create, and only into a space the actor owns.
    const moved = await post(owner, "/api/ops", {
      canvasId: "prj_newborn",
      actor: priya,
      spaceId: design.id,
      op: { type: "project.update", patch: { title: "Renamed" } },
    });
    expect(moved.status).toBe(400);
    expect((await body(moved)).code).toBe("bad-op");
    const theirs = await stranger();
    await theirs.speakAs(jordan);
    const notOwned = await post(theirs, "/api/ops", {
      canvasId: null,
      actor: jordan,
      spaceId: design.id,
      op: { type: "project.create", canvasId: "prj_intruder", title: "Not mine" },
    });
    expect(notOwned.status).toBe(404); // a space Jordan may not see
    expect(await daemon.store.canvasExists("prj_intruder")).toBe(false);
    const unknown = await post(owner, "/api/ops", {
      canvasId: null,
      actor: priya,
      spaceId: "spc_never",
      op: { type: "project.create", canvasId: "prj_nowhere", title: "Nowhere" },
    });
    expect(unknown.status).toBe(404);
    expect((await body(unknown)).code).toBe("space-not-found");
  });
});

describe("on a replica", () => {
  /**
   * A space is desk state at the home, so every space route forwards
   * through the one home — including a birth into a space, whose `spaceId`
   * rides up with the create so the home writes no link grant.
   */
  it("forwards the space routes to the home, births included", async () => {
    const replicaDir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-spaces-replica-"));
    const replica = await startDaemon({ port: 0, home: replicaDir, birthHome: base, homePollMs: 50 });
    const address = replica.app.server.address();
    const replicaBase = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
    try {
      const cli = await mintTestBadge(replicaBase);
      await cli.speakAs(jordan);
      const rPost = (url: string, payload: unknown) =>
        fetch(`${replicaBase}${url}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...cli.headers },
          body: JSON.stringify(payload),
        });
      const madeAtHome = await rPost(SPACES_ROUTE, { name: "Design", actorId: jordan.id });
      expect(madeAtHome.status, await madeAtHome.clone().text()).toBe(200);
      const { space } = (await madeAtHome.json()) as SpaceResponse;
      expect((await daemon.desk.space(space.id))?.createdBy).toBe(jordan.id);
      // Listed through the replica, from the home.
      const listed = (await (await fetch(`${replicaBase}${SPACES_ROUTE}`, { headers: cli.headers })).json()) as SpacesResponse;
      expect(listed.spaces.map((s) => s.id)).toEqual([space.id]);
      // Born through the replica into the space: no link row at the home.
      const born = await rPost("/api/ops", {
        canvasId: null,
        actor: jordan,
        spaceId: space.id,
        op: { type: "project.create", canvasId: "prj_from_laptop", title: "Laptop-born" },
      });
      expect(born.status, await born.clone().text()).toBe(200);
      expect(await daemon.desk.grantsFor("prj_from_laptop")).toEqual([]);
      expect((await daemon.desk.space(space.id))!.canvasIds).toEqual(["prj_from_laptop"]);
      expect((await enter(await stranger(), "prj_from_laptop")).status).toBe(403);
      // And a write on the space, forwarded, sweeps at the home.
      const shared = await rPost(spaceGrantsRoute(space.id), { subject: SAM, actorId: jordan.id });
      expect(shared.status, await shared.clone().text()).toBe(200);
      expect(((await shared.json()) as GrantResponse).reached).toBe(1);
    } finally {
      await replica.close();
      await fs.rm(replicaDir, { recursive: true, force: true });
    }
  }, 30_000);

  it("refuses on a mixed rig, naming the homes", async () => {
    const otherDir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-spaces-h2-"));
    const rigDir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-spaces-rig-"));
    const other = await startDaemon({ port: 0, home: otherDir, birthHome: null });
    const rig = await startDaemon({ port: 0, home: rigDir, birthHome: null, homePollMs: 50 });
    const baseOf = (d: Daemon) => {
      const a = d.app.server.address();
      return `http://127.0.0.1:${typeof a === "object" && a ? a.port : 0}`;
    };
    try {
      const rigBadge = await mintTestBadge(baseOf(rig));
      await rigBadge.speakAs(jordan);
      // Two links and no birth default: one canvas born at each home.
      for (const [i, target] of [base, baseOf(other)].entries()) {
        const res = await fetch(`${baseOf(rig)}/api/ops`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...rigBadge.headers },
          body: JSON.stringify({
            canvasId: null,
            actor: jordan,
            home: target,
            op: { type: "project.create", canvasId: `prj_rig_${i}`, title: `At home ${i}` },
          }),
        });
        expect(res.status, await res.clone().text()).toBe(200);
      }
      const refused = await fetch(`${baseOf(rig)}${SPACES_ROUTE}`, { headers: rigBadge.headers });
      expect(refused.status).toBe(409);
      const why = await body(refused);
      expect(why.code).toBe("ambiguous-home");
      expect(why.error).toContain(base);
      expect(why.error).toContain(baseOf(other));
    } finally {
      await rig.close();
      await other.close();
      await Promise.allSettled([otherDir, rigDir].map((d) => fs.rm(d, { recursive: true, force: true })));
    }
  }, 30_000);
});
