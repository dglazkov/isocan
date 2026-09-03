import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { WebSocket } from "ws";
import type {
  CanvasSnapshotResponse,
  Grant,
  GrantResponse,
  GrantsResponse,
  GroupResponse,
  GroupsResponse,
  ServerMessage,
  SpaceResponse,
  SpacesResponse,
} from "@isocan/core";
import {
  grantRoute,
  grantsRoute,
  groupMemberRoute,
  groupRoute,
  GROUPS_ROUTE,
  groupSubject,
  spaceCanvasRoute,
  spaceGrantsRoute,
  spaceLinkRoute,
  SPACES_ROUTE,
  WS_NOT_ADMITTED,
} from "@isocan/core";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

/**
 * **The group** (roles phase 5; journeys 4 and 6): a named set of people
 * access is given to once. What is asserted here is the daemon's, never the
 * app's — every gate is a request from a badge holding the lower standing,
 * refused with the code the design names — and the door's branch:
 * membership is read from the desk at the door and copied nowhere, so a
 * member removed is one write and a sweep, and the sweep reaches every
 * canvas every live row on the group reaches, through the space's list for
 * a space row.
 *
 * This home has borrowed an attester in configuration only (nothing is
 * verified; proofs are written on the desk), because a group's members are
 * attested attributes and the home must be able to prove one.
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

const enter = (badge: TestBadge, canvasId: string) => get(badge, `/api/projects/${canvasId}/canvas`);
const rungIn = async (badge: TestBadge, canvasId: string): Promise<string | undefined> =>
  ((await (await enter(badge, canvasId)).json()) as CanvasSnapshotResponse).capability;

const prove = (badge: TestBadge, attribute: string) =>
  daemon.desk.attest(badge.badgeId, { attribute, verifiedVia: "magic-link", at: new Date().toISOString() });
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

async function makeGroup(name = "Design team", by: TestBadge = owner): Promise<GroupResponse["group"]> {
  const res = await post(by, GROUPS_ROUTE, { name });
  if (!res.ok) throw new Error(`could not make the group: ${await res.text()}`);
  return ((await res.json()) as GroupResponse).group;
}

async function addMember(groupId: string, attribute: string, by: TestBadge = owner): Promise<GroupResponse> {
  const res = await put(by, groupMemberRoute(groupId, attribute), {});
  if (!res.ok) throw new Error(`could not add ${attribute}: ${await res.text()}`);
  return (await res.json()) as GroupResponse;
}

async function removeMember(groupId: string, attribute: string, by: TestBadge = owner): Promise<GroupResponse> {
  const res = await del(by, groupMemberRoute(groupId, attribute));
  if (!res.ok) throw new Error(`could not remove ${attribute}: ${await res.text()}`);
  return (await res.json()) as GroupResponse;
}

async function makeSpace(name = "Design"): Promise<SpaceResponse["space"]> {
  const res = await post(owner, SPACES_ROUTE, { name });
  if (!res.ok) throw new Error(`could not make the space: ${await res.text()}`);
  return ((await res.json()) as SpaceResponse).space;
}

async function addTo(spaceId: string, canvasId: string): Promise<void> {
  const res = await put(owner, spaceCanvasRoute(spaceId, canvasId), {});
  if (!res.ok) throw new Error(`could not add ${canvasId}: ${await res.text()}`);
}

const grantsOn = async (canvasId: string): Promise<Grant[]> =>
  ((await (await get(owner, grantsRoute(canvasId))).json()) as GrantsResponse).grants;

async function linkOff(canvasId: string): Promise<void> {
  const link = (await grantsOn(canvasId)).find((g) => g.subject === "link");
  if (link) await del(owner, grantRoute(canvasId, link.id));
}

const inviteGroup = (canvasId: string, groupId: string, capability?: string, by: TestBadge = owner) =>
  post(by, grantsRoute(canvasId), { subject: groupSubject(groupId), ...(capability ? { capability } : {}) });

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-groups-"));
  made = 0;
  await boot();
  owner = await mintTestBadge(base);
  await owner.speakAs(priya);
});

afterEach(async () => {
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true });
});

describe("making a group", () => {
  it("needs a name and an actor; its maker lists it with members, a stranger sees nothing", async () => {
    const nameless = await post(owner, GROUPS_ROUTE, {});
    expect(nameless.status).toBe(400);
    expect((await body(nameless)).code).toBe("bad-group");
    const nobody = await stranger();
    const unmade = await post(nobody, GROUPS_ROUTE, { name: "Design team" });
    expect(unmade.status).toBe(400);
    expect((await body(unmade)).code).toBe("bad-group");

    const group = await makeGroup("  Design team ");
    expect(group.id).toMatch(/^ppl_/);
    expect(group.name).toBe("Design team");
    expect(group.createdBy).toBe(priya.id);
    expect(group.members).toEqual([]);
    expect(group.size).toBe(0);
    const mine = (await (await get(owner, GROUPS_ROUTE)).json()) as GroupsResponse;
    expect(mine.groups.map((g) => g.id)).toEqual([group.id]);
    expect(mine.groups[0]!.members).toEqual([]);
    // A private list: a stranger lists nothing and is told there is no such
    // group, the same answer as for one that never existed.
    expect(((await (await get(nobody, GROUPS_ROUTE)).json()) as GroupsResponse).groups).toEqual([]);
    for (const refused of [await get(nobody, groupRoute(group.id)), await get(nobody, groupRoute("ppl_never"))]) {
      expect(refused.status).toBe(404);
      expect((await body(refused)).code).toBe("group-not-found");
    }
  });

  it("names are unique among the groups one actor owns, and free for another", async () => {
    const first = await makeGroup("Design team");
    const again = await post(owner, GROUPS_ROUTE, { name: "design team" });
    expect(again.status).toBe(409);
    const why = await body(again);
    expect(why.code).toBe("group-name-taken");
    expect(why.error).toContain(first.id);
    const other = await stranger();
    await other.speakAs(jordan);
    expect((await post(other, GROUPS_ROUTE, { name: "Design team" })).status).toBe(200);
  });
});

describe("who is in it", () => {
  it("holds addresses, normalized, once each; refuses the link, a group, and a non-subject", async () => {
    const group = await makeGroup();
    for (const bad of ["link", "group:ppl_other", "everyone", "email:Jordan"]) {
      const refused = await put(owner, groupMemberRoute(group.id, bad), {});
      expect(refused.status, bad).toBe(400);
      expect((await body(refused)).code).toBe("bad-group");
    }
    const added = await addMember(group.id, "email:Jordan@Acme.Test");
    expect(added.group.members).toEqual([JORDAN]);
    expect(added.group.size).toBe(1);
    // Nothing reached: no row names the group yet.
    expect(added.reached).toBe(0);
    const twice = await addMember(group.id, JORDAN);
    expect(twice.group.members).toEqual([JORDAN]);
    expect(twice.reached).toBe(0);
    const removed = await removeMember(group.id, JORDAN);
    expect(removed.group.members).toEqual([]);
    expect((await removeMember(group.id, JORDAN)).reached).toBe(0);
  });

  it("only its maker may change it; a canvas owner using it sees its name and size and no members", async () => {
    const group = await makeGroup();
    await addMember(group.id, JORDAN);
    await addMember(group.id, SAM);
    // Jordan makes a canvas and invites Priya's group on it, by id.
    const jordanBadge = await holderOf(JORDAN);
    await jordanBadge.speakAs(jordan);
    const theirs = await makeCanvas(jordanBadge, jordan);
    expect((await inviteGroup(theirs, group.id, "edit", jordanBadge)).status).toBe(200);
    // Jordan may see the group — a live row on a canvas Jordan is in names
    // it — as its name and size, and nothing more (roles design, "Who sees
    // the members").
    const seen = (await (await get(jordanBadge, groupRoute(group.id))).json()) as GroupResponse;
    expect(seen.group).toMatchObject({ id: group.id, name: "Design team", size: 2 });
    expect("members" in seen.group).toBe(false);
    // And may change nothing about it.
    for (const refused of [
      await put(jordanBadge, groupMemberRoute(group.id, "email:nico@acme.test"), {}),
      await del(jordanBadge, groupMemberRoute(group.id, SAM)),
      await del(jordanBadge, groupRoute(group.id)),
    ]) {
      expect(refused.status).toBe(403);
      const why = await body(refused);
      expect(why.code).toBe("not-owner");
      expect(why.error).toContain("Priya");
    }
    // Priya's list still has the members.
    expect(((await (await get(owner, groupRoute(group.id))).json()) as GroupResponse).group.members).toEqual([JORDAN, SAM]);
  });

  it("a row may name only a live group; a bar may never name one", async () => {
    const canvasId = await makeCanvas();
    const missing = await inviteGroup(canvasId, "ppl_never");
    expect(missing.status).toBe(404);
    expect((await body(missing)).code).toBe("group-not-found");
    const group = await makeGroup();
    const barred = await post(owner, grantsRoute(canvasId), { subject: groupSubject(group.id), bars: true });
    expect(barred.status).toBe(400);
    const why = await body(barred);
    expect(why.code).toBe("bad-grant");
    expect(why.error).toMatch(/un-invite/);
    // A name is not a subject: the wire carries ids.
    const byName = await post(owner, grantsRoute(canvasId), { subject: "group:Design team" });
    expect(byName.status).toBe(400);
    expect((await body(byName)).code).toBe("bad-grant");
  });
});

describe("the door reads membership", () => {
  it("a canvas row on the group admits a member at the row's rung and refuses a non-member", async () => {
    const canvasId = await makeCanvas();
    await linkOff(canvasId);
    const group = await makeGroup();
    await addMember(group.id, JORDAN);
    const invited = (await (await inviteGroup(canvasId, group.id, "read")).json()) as GrantResponse;
    expect(invited.grant).toMatchObject({ canvasId, subject: groupSubject(group.id), capability: "read" });

    const jordanBadge = await holderOf(JORDAN);
    expect(await rungIn(jordanBadge, canvasId)).toBe("read");
    // The provenance names the ROW, never the group: membership is read at
    // the door and copied nowhere.
    const record = await daemon.desk.badge(jordanBadge.badgeId);
    expect(record!.admissions.find((row) => row.canvasId === canvasId)!.provenance).toEqual({
      root: "grant",
      grantId: invited.grant.id,
    });
    const sam = await holderOf(SAM);
    const refused = await enter(sam, canvasId);
    expect(refused.status).toBe(403);
    expect((await body(refused)).code).toBe("not-admitted");
    expect((await enter(await stranger(), canvasId)).status).toBe(403);
  });

  it("a space row on the group admits a member to every canvas in the space, with no other row naming them", async () => {
    const design = await makeSpace();
    const canvases = [await makeCanvas(), await makeCanvas(), await makeCanvas()];
    for (const id of canvases) await addTo(design.id, id);
    await post(owner, spaceLinkRoute(design.id), { capability: "off" });
    const group = await makeGroup();
    await addMember(group.id, JORDAN);
    await addMember(group.id, SAM);
    const invited = await post(owner, spaceGrantsRoute(design.id), { subject: groupSubject(group.id) });
    expect(invited.status, await invited.clone().text()).toBe(200);
    expect(((await invited.json()) as GrantResponse).reached).toBe(3);

    const jordanBadge = await holderOf(JORDAN);
    for (const id of canvases) expect(await rungIn(jordanBadge, id)).toBeUndefined(); // edit
    // Jordan sees the space through the group (journey 4 step 6's list).
    const seen = (await (await get(jordanBadge, SPACES_ROUTE)).json()) as SpacesResponse;
    expect(seen.spaces.map((s) => s.id)).toEqual([design.id]);
    // And a space owner who did not make the group sees its size only.
    const summary = (await (await get(jordanBadge, groupRoute(group.id))).json()) as GroupResponse;
    expect(summary.group.size).toBe(2);
    expect("members" in summary.group).toBe(false);
    // Somebody not in the group: refused on each.
    const nico = await holderOf("email:nico@acme.test");
    for (const id of canvases) expect((await enter(nico, id)).status).toBe(403);
  });

  it("removing a member expels them from every canvas a space row reaches, and a canvas with its link on re-admits them as a stranger", async () => {
    const design = await makeSpace();
    const canvases = [await makeCanvas(), await makeCanvas(), await makeCanvas()];
    for (const id of canvases) await addTo(design.id, id);
    await post(owner, spaceLinkRoute(design.id), { capability: "off" });
    const group = await makeGroup();
    await addMember(group.id, JORDAN);
    await post(owner, spaceGrantsRoute(design.id), { subject: groupSubject(group.id) });
    const jordanBadge = await holderOf(JORDAN);
    for (const id of canvases) expect((await enter(jordanBadge, id)).status).toBe(200);
    // One canvas's own link back on, at view (journey 6 step 2's "unless
    // its link is on").
    await post(owner, grantsRoute(canvases[2]!), { subject: "link", capability: "view" });

    // One write — the group's row again without Jordan — and the sweep
    // reaches the space's three canvases through the space row.
    const removed = await removeMember(group.id, JORDAN);
    expect(removed.group.members).toEqual([]);
    expect(removed.reached).toBe(3);
    // Out of two; on the third, re-rooted onto the link as a stranger.
    expect(removed.swept).toEqual({ expelled: 2, rerooted: 1 });
    expect((await enter(jordanBadge, canvases[0]!)).status).toBe(403);
    expect((await enter(jordanBadge, canvases[1]!)).status).toBe(403);
    expect(await rungIn(jordanBadge, canvases[2]!)).toBe("view");
    // The row itself is untouched: still live, still naming the group.
    const rows = ((await (await get(owner, spaceGrantsRoute(design.id))).json()) as GrantsResponse).grants;
    expect(rows.map((g) => g.subject)).toEqual([groupSubject(group.id)]);
  });

  it("a deleted group's rows admit nobody, and the delete sweeps what they reached", async () => {
    const canvasId = await makeCanvas();
    await linkOff(canvasId);
    const group = await makeGroup();
    await addMember(group.id, JORDAN);
    await inviteGroup(canvasId, group.id);
    const jordanBadge = await holderOf(JORDAN);
    expect((await enter(jordanBadge, canvasId)).status).toBe(200);

    const gone = (await (await del(owner, groupRoute(group.id))).json()) as GroupResponse;
    expect(gone.group.deletedAt).toBeDefined();
    expect(gone.reached).toBe(1);
    expect(gone.swept).toEqual({ expelled: 1, rerooted: 0 });
    expect((await enter(jordanBadge, canvasId)).status).toBe(403);
    // The row stays and says nothing; the group is out of the maker's list;
    // a second delete is nothing for its maker and not there for anybody
    // else.
    expect((await grantsOn(canvasId)).map((g) => g.subject)).toEqual([groupSubject(group.id)]);
    expect(((await (await get(owner, GROUPS_ROUTE)).json()) as GroupsResponse).groups).toEqual([]);
    expect((await del(owner, groupRoute(group.id))).status).toBe(200);
    expect((await del(await stranger(), groupRoute(group.id))).status).toBe(404);
    // And a new row may not name it.
    const stale = await inviteGroup(await makeCanvas(), group.id);
    expect(stale.status).toBe(404);
  });

  it("the member's agent, in through a pass, is expelled with them in the same sweep", async () => {
    const canvasId = await makeCanvas();
    await linkOff(canvasId);
    const group = await makeGroup();
    await addMember(group.id, JORDAN);
    await inviteGroup(canvasId, group.id);
    const jordanBadge = await holderOf(JORDAN);
    expect((await enter(jordanBadge, canvasId)).status).toBe(200);
    // Jordan's agent: a badge admitted on a pass Jordan minted — the root
    // the sweep resolves by the minter's outcome.
    const agent = await stranger();
    await daemon.desk.admit(agent.badgeId, canvasId, { root: "pass", badgeId: jordanBadge.badgeId });
    expect((await enter(agent, canvasId)).status).toBe(200);

    const removed = await removeMember(group.id, JORDAN);
    expect(removed.swept).toEqual({ expelled: 2, rerooted: 0 });
    expect((await enter(jordanBadge, canvasId)).status).toBe(403);
    expect((await enter(agent, canvasId)).status).toBe(403);
  });

  it("adding a member raises somebody already inside at read, delivered to their open socket as standing", async () => {
    const canvasId = await makeCanvas();
    await linkOff(canvasId);
    // Jordan is inside at `read` by a canvas row of their own.
    await post(owner, grantsRoute(canvasId), { subject: JORDAN, capability: "read" });
    const jordanBadge = await holderOf(JORDAN);
    expect(await rungIn(jordanBadge, canvasId)).toBe("read");
    const ws = new WebSocket(`${base.replace("http:", "ws:")}/ws?canvasId=${canvasId}`, {
      headers: jordanBadge.headers,
    });
    const heard: ServerMessage[] = [];
    const closed = new Promise<number>((resolve) => ws.on("close", (code) => resolve(code)));
    await new Promise<void>((resolve, reject) => {
      ws.on("error", reject);
      ws.on("message", (data) => {
        const message = JSON.parse(String(data)) as ServerMessage;
        if (heard.length === 0) resolve();
        heard.push(message);
      });
    });
    expect(heard[0]).toMatchObject({ type: "snapshot", capability: "read" });

    // The group is on the canvas at edit; Jordan is not in it yet.
    const group = await makeGroup();
    await inviteGroup(canvasId, group.id, "edit");
    expect(await rungIn(jordanBadge, canvasId)).toBe("read");
    // Then added: the write sweeps the one canvas the row reaches, the door
    // now gives edit through the group's row, and the open socket is told.
    const added = await addMember(group.id, JORDAN);
    expect(added.reached).toBe(1);
    expect(added.swept).toEqual({ expelled: 0, rerooted: 1 });
    await new Promise((resolve) => setTimeout(resolve, 150));
    const standing = heard.filter((m) => m.type === "standing");
    expect(standing).toEqual([{ type: "standing", capability: "edit" }]);
    expect(await rungIn(jordanBadge, canvasId)).toBeUndefined(); // edit
    // And removed again: the socket is closed as withdrawn — but the canvas
    // row at read still stands, so Jordan is re-rooted there, not expelled.
    const removed = await removeMember(group.id, JORDAN);
    expect(removed.swept).toEqual({ expelled: 0, rerooted: 1 });
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(heard.filter((m) => m.type === "standing").at(-1)).toEqual({ type: "standing", capability: "read" });
    ws.close();
    await closed;
  });

  it("a member inside on a canvas row alone is put out with the socket closed as withdrawn", async () => {
    const canvasId = await makeCanvas();
    await linkOff(canvasId);
    const group = await makeGroup();
    await addMember(group.id, JORDAN);
    await inviteGroup(canvasId, group.id);
    const jordanBadge = await holderOf(JORDAN);
    expect((await enter(jordanBadge, canvasId)).status).toBe(200);
    const ws = new WebSocket(`${base.replace("http:", "ws:")}/ws?canvasId=${canvasId}`, {
      headers: jordanBadge.headers,
    });
    const closed = new Promise<{ code: number; reason: string }>((resolve) =>
      ws.on("close", (code, reason) => resolve({ code, reason: String(reason) })),
    );
    await new Promise<void>((resolve, reject) => {
      ws.on("error", reject);
      ws.once("message", () => resolve());
    });
    await removeMember(group.id, JORDAN);
    expect(await closed).toEqual({ code: WS_NOT_ADMITTED, reason: "withdrawn" });
  });
});

describe("a home with no attester", () => {
  it("refuses a group row with no-attester, because its members could prove nothing here", async () => {
    const bareDir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-groups-bare-"));
    const bare = await startDaemon({ port: 0, home: bareDir, birthHome: null, auth: null });
    const address = bare.app.server.address();
    const bareBase = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
    try {
      const maker = await mintTestBadge(bareBase);
      await maker.speakAs(priya);
      const bPost = (url: string, payload: unknown) =>
        fetch(`${bareBase}${url}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...maker.headers },
          body: JSON.stringify(payload),
        });
      const born = await bPost("/api/ops", {
        canvasId: null,
        actor: priya,
        op: { type: "project.create", canvasId: "prj_bare", title: "Bare" },
      });
      expect(born.status).toBe(200);
      // The group itself may be made — it is a list — but no row may name it.
      const made = await bPost(GROUPS_ROUTE, { name: "Design team" });
      expect(made.status).toBe(200);
      const { group } = (await made.json()) as GroupResponse;
      const refused = await bPost(grantsRoute("prj_bare"), { subject: groupSubject(group.id) });
      expect(refused.status).toBe(400);
      const why = await body(refused);
      expect(why.code).toBe("no-attester");
      expect(why.error).toMatch(/cannot admit a group/);
    } finally {
      await bare.close();
      await fs.rm(bareDir, { recursive: true, force: true });
    }
  });
});

describe("on a replica", () => {
  it("forwards the group routes to the home, and a member write sweeps there", async () => {
    const replicaDir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-groups-replica-"));
    const replica = await startDaemon({ port: 0, home: replicaDir, birthHome: base, homePollMs: 50 });
    const address = replica.app.server.address();
    const replicaBase = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
    try {
      const cli = await mintTestBadge(replicaBase);
      await cli.speakAs(jordan);
      const r = (method: string, url: string, payload?: unknown) =>
        fetch(`${replicaBase}${url}`, {
          method,
          headers: {
            ...(payload === undefined ? {} : { "Content-Type": "application/json" }),
            ...cli.headers,
          },
          ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
        });
      const madeAtHome = await r("POST", GROUPS_ROUTE, { name: "Design team", actorId: jordan.id });
      expect(madeAtHome.status, await madeAtHome.clone().text()).toBe(200);
      const { group } = (await madeAtHome.json()) as GroupResponse;
      expect((await daemon.desk.group(group.id))?.createdBy).toBe(jordan.id);
      const listed = (await (await r("GET", GROUPS_ROUTE)).json()) as GroupsResponse;
      expect(listed.groups.map((g) => g.id)).toEqual([group.id]);
      const added = await r("PUT", groupMemberRoute(group.id, SAM), { actorId: jordan.id });
      expect(added.status, await added.clone().text()).toBe(200);
      expect((await daemon.desk.group(group.id))?.members).toEqual([SAM]);
      // A canvas born through the replica, shared with the group, entered
      // by a member at the home; then the member removed through the
      // replica, swept at the home.
      const born = await r("POST", "/api/ops", {
        canvasId: null,
        actor: jordan,
        op: { type: "project.create", canvasId: "prj_from_laptop", title: "Laptop-born" },
      });
      expect(born.status, await born.clone().text()).toBe(200);
      const shared = await r("POST", grantsRoute("prj_from_laptop"), { subject: groupSubject(group.id), actorId: jordan.id });
      expect(shared.status, await shared.clone().text()).toBe(200);
      // The link off through the replica too, so Sam is rooted at the
      // group's row and not at the older link.
      const link = (await daemon.desk.grantsFor("prj_from_laptop")).find((g) => g.subject === "link")!;
      expect((await r("DELETE", `${grantRoute("prj_from_laptop", link.id)}?actorId=${jordan.id}`)).status).toBe(200);
      const sam = await holderOf(SAM);
      expect((await enter(sam, "prj_from_laptop")).status).toBe(200);
      const removed = await r("DELETE", `${groupMemberRoute(group.id, SAM)}?actorId=${jordan.id}`);
      expect(removed.status, await removed.clone().text()).toBe(200);
      expect(((await removed.json()) as GroupResponse).swept).toEqual({ expelled: 1, rerooted: 0 });
      expect((await enter(sam, "prj_from_laptop")).status).toBe(403);
      const deleted = await r("DELETE", `${groupRoute(group.id)}?actorId=${jordan.id}`);
      expect(deleted.status, await deleted.clone().text()).toBe(200);
      expect((await daemon.desk.group(group.id))?.deletedAt).toBeDefined();
    } finally {
      await replica.close();
      await fs.rm(replicaDir, { recursive: true, force: true });
    }
  }, 30_000);
});
