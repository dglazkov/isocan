import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { WebSocket } from "ws";
import type { FreeNameResponse, GrantResponse, GrantsResponse, LogEntry, Project } from "@isocan/core";
import { FREE_NAME_ROUTE, grantRoute, grantsRoute, ISOCAN_NAMES, WS_NOT_ADMITTED } from "@isocan/core";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import * as p from "../src/paths.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

/**
 * **The grant, and the door that finally refuses** (identity desk, mechanisms
 * 3 + 2; phase 7, stage 1).
 *
 * Phase 2 handed out badges and enforced nothing — "the address still admits",
 * written down rather than checked. Phase 3 marked the two policy lines and
 * left them. What is asserted here is the replacement: every canvas is born
 * with a standing **link grant**, the door tests that row instead of assuming
 * the address, revoking it stops the next arrival, and the refusal is a 403
 * of its own rather than the 401 that would send a perfectly good badge back
 * to the door forever.
 *
 * Fixtures are synthetic throughout: Acme, Priya, a stranger.
 */

const priya = { id: "usr_priya", name: "Priya" };
const CANVAS = "prj_acme";

let home: string;
let daemon: Daemon;
let base: string;
let owner: TestBadge;

async function boot(): Promise<void> {
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
}

/** A badge that has never been anywhere — Jordan's browser, before the link. */
const stranger = () => mintTestBadge(base);

async function op(badge: TestBadge, body: unknown): Promise<Response> {
  return fetch(`${base}/api/ops`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...badge.headers },
    body: JSON.stringify(body),
  });
}

async function makeCanvas(): Promise<void> {
  const made = await op(owner, {
    projectId: null,
    actor: priya,
    op: { type: "project.create", projectId: CANVAS, title: "Acme Sprint Board" },
  });
  if (!made.ok) throw new Error(`could not create the canvas: ${await made.text()}`);
}

const get = (badge: TestBadge, url: string) => fetch(`${base}${url}`, { headers: badge.headers });

const grantsOf = async (badge: TestBadge, projectId = CANVAS): Promise<GrantsResponse> =>
  (await get(badge, grantsRoute(projectId))).json() as Promise<GrantsResponse>;

async function revokeLink(badge: TestBadge): Promise<Response> {
  const { grants } = await grantsOf(badge);
  return fetch(`${base}${grantRoute(CANVAS, grants[0]!.id)}`, {
    method: "DELETE",
    headers: badge.headers,
  });
}

/** What a socket was told, so a refusal can be asserted as a close code. */
function socketClose(badge: TestBadge, projectId = CANVAS): Promise<number> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${base.replace("http:", "ws:")}/ws?projectId=${projectId}`, {
      headers: badge.headers,
    });
    ws.on("error", reject);
    ws.on("close", (code) => resolve(code));
    // A socket that is admitted never closes on its own; close it ourselves
    // and let the 1000/1005 say "this one got in".
    ws.on("message", () => ws.close());
  });
}

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-grants-"));
  await boot();
  owner = await mintTestBadge(base);
  await owner.speakAs(priya);
});

afterEach(async () => {
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true });
});

describe("a canvas is born with the link grant", () => {
  it("has exactly one, and it is the link — the status quo demoted to data", async () => {
    await makeCanvas();
    const { grants } = await grantsOf(owner);
    expect(grants).toHaveLength(1);
    expect(grants[0]).toMatchObject({
      canvasId: CANVAS,
      subject: "link",
      // The badge that made the canvas granted it, which is the honest
      // answer to "who opened this up?" on day one.
      grantedBy: owner.badgeId,
    });
    expect(grants[0]!.id).toMatch(/^gnt_/);
    expect(grants[0]!.revokedAt).toBeUndefined();
  });

  it("is desk state and NEVER an op — the oplog does not learn that grants exist", async () => {
    await makeCanvas();
    const before = (await (await get(owner, `/api/projects/${CANVAS}/oplog?since=0`)).json()) as LogEntry[];
    await fetch(`${base}${grantsRoute(CANVAS)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...owner.headers },
      body: JSON.stringify({ subject: "link" }),
    });
    await revokeLink(owner);
    const after = (await (await get(owner, `/api/projects/${CANVAS}/oplog?since=0`)).json()) as LogEntry[];
    // Sharing is "the first citizen of that second category" — daemon-API
    // parity, not an op. If a grant ever became one it would replicate to
    // every replica of this canvas, which is the one thing desk state must
    // never do.
    expect(after.map((entry) => entry.seq)).toEqual(before.map((entry) => entry.seq));
    expect(JSON.stringify(after)).not.toContain("gnt_");
  });
});

describe("the door", () => {
  it("admits a stranger under the link grant", async () => {
    await makeCanvas();
    const jordan = await stranger();
    expect((await get(jordan, `/api/projects/${CANVAS}/canvas`)).status).toBe(200);
  });

  it("refuses once the link is off — 403 with a code of its own, never a 401", async () => {
    await makeCanvas();
    await revokeLink(owner);
    const jordan = await stranger();
    const seen = await get(jordan, `/api/projects/${CANVAS}/canvas`);
    // Not 401: this badge is perfectly good, and telling it to go back to the
    // door would be a refresh loop minting credentials that cannot help.
    expect(seen.status).toBe(403);
    expect(((await seen.json()) as { code: string }).code).toBe("not-admitted");
  });

  it("refuses the WRITE before it lands, not after", async () => {
    await makeCanvas();
    await revokeLink(owner);
    const jordan = await stranger();
    await jordan.speakAs({ id: "usr_jordan", name: "Jordan" });
    const wrote = await op(jordan, {
      projectId: CANVAS,
      actor: { id: "usr_jordan", name: "Jordan" },
      op: { type: "project.rename", projectId: CANVAS, title: "Not Acme" },
    });
    expect(wrote.status).toBe(403);
    // `/api/ops` is the one route whose canvas is in the body rather than the
    // path, so the hook cannot cover it and the door is called by hand — in
    // the RIGHT ORDER. A refusal that arrives after the op has landed is not
    // a refusal.
    const snapshot = (await (await get(owner, `/api/projects/${CANVAS}/canvas`)).json()) as {
      project: Project;
      lastSeq: number;
    };
    expect(snapshot.project.title).toBe("Acme Sprint Board");
    expect(snapshot.lastSeq).toBe(1);
  });

  it("refuses the WS upgrade with 4402 — its own code, not the origin's", async () => {
    await makeCanvas();
    await revokeLink(owner);
    const jordan = await stranger();
    // 4403 is `WS_BAD_ORIGIN`. A reconnect loop that could not tell the two
    // apart would retry the one it cannot fix.
    expect(await socketClose(jordan)).toBe(WS_NOT_ADMITTED);
  });

  it("still lets in a badge that was already admitted — revocation stops arrivals, not attendees", async () => {
    await makeCanvas();
    const jordan = await stranger();
    expect((await get(jordan, `/api/projects/${CANVAS}/canvas`)).status).toBe(200);
    await revokeLink(owner);
    // The provenance sweep that expels an admitted badge is phase 9's: it has
    // to RE-RUN the door test per badge and re-root the ones another grant
    // still covers, or turning off the link would expel the people invited by
    // name. Until then, this is what revocation means and the test says so.
    expect((await get(jordan, `/api/projects/${CANVAS}/canvas`)).status).toBe(200);
    expect((await get(owner, `/api/projects/${CANVAS}/canvas`)).status).toBe(200);
  });

  it("answers 404 for a canvas that is not here, never 403", async () => {
    const jordan = await stranger();
    const seen = await get(jordan, "/api/projects/prj_nowhere/canvas");
    // The refusal is for canvases that exist and will not have you. Anything
    // else turns every mistyped id into "you are not admitted" about a canvas
    // that was never there.
    expect(seen.status).toBe(404);
    expect(((await seen.json()) as { code: string }).code).toBe("unknown-project");
  });

  it("lets the link back on, and the next stranger walks in", async () => {
    await makeCanvas();
    await revokeLink(owner);
    const shut = await stranger();
    expect((await get(shut, `/api/projects/${CANVAS}/canvas`)).status).toBe(403);

    const again = await fetch(`${base}${grantsRoute(CANVAS)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...owner.headers },
      body: JSON.stringify({ subject: "link" }),
    });
    expect(again.status).toBe(200);
    const { grant } = (await again.json()) as GrantResponse;
    // A NEW row: the revoked one is a tombstone, because provenance points at
    // it and phase 9's sweep has to be able to read what it is expelling from.
    expect(grant.revokedAt).toBeUndefined();
    const { grants } = await grantsOf(owner);
    expect(grants.map((row) => row.id)).toEqual([grant.id]);

    const later = await stranger();
    expect((await get(later, `/api/projects/${CANVAS}/canvas`)).status).toBe(200);
  });
});

describe("the grant API", () => {
  it("refuses `email:` and `repo:` by naming the phase that will serve them", async () => {
    await makeCanvas();
    for (const subject of ["email:jordan@example.com", "repo:github.com/acme/board"]) {
      const asked = await fetch(`${base}${grantsRoute(CANVAS)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...owner.headers },
        body: JSON.stringify({ subject }),
      });
      expect(asked.status, subject).toBe(400);
      const body = (await asked.json()) as { error: string; code: string };
      expect(body.code).toBe("bad-grant");
      // An `email:` row is one nothing can satisfy until a badge carries
      // attestations, so accepting it would write a grant that admits nobody
      // while the dialog said somebody had been invited.
      expect(body.error).toContain("phase 9");
    }
    // And the rows are not there.
    expect((await grantsOf(owner)).grants.map((row) => row.subject)).toEqual(["link"]);
  });

  it("refuses a subject that is not one at all", async () => {
    await makeCanvas();
    for (const subject of [undefined, "", "everyone", 42]) {
      const asked = await fetch(`${base}${grantsRoute(CANVAS)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...owner.headers },
        body: JSON.stringify({ subject }),
      });
      expect(asked.status, String(subject)).toBe(400);
    }
  });

  it("hands back the row that is already there rather than a second one", async () => {
    await makeCanvas();
    const born = (await grantsOf(owner)).grants[0]!;
    const again = await fetch(`${base}${grantsRoute(CANVAS)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...owner.headers },
      body: JSON.stringify({ subject: "link" }),
    });
    // Two live link grants on one canvas would mean revoking the link left
    // the link on — and the gesture is a toggle two people can flip at once.
    expect(((await again.json()) as GrantResponse).grant.id).toBe(born.id);
    expect((await grantsOf(owner)).grants).toHaveLength(1);
  });

  it("will not revoke a grant that belongs to another canvas", async () => {
    await makeCanvas();
    const other = await op(owner, {
      projectId: null,
      actor: priya,
      op: { type: "project.create", projectId: "prj_other", title: "Test Board" },
    });
    expect(other.status).toBe(200);
    const theirs = (await grantsOf(owner, "prj_other")).grants[0]!;
    const crossed = await fetch(`${base}${grantRoute(CANVAS, theirs.id)}`, {
      method: "DELETE",
      headers: owner.headers,
    });
    expect(crossed.status).toBe(404);
    expect((await grantsOf(owner, "prj_other")).grants[0]!.revokedAt).toBeUndefined();
  });

  it("is only for the admitted — the hook guards it like every project route", async () => {
    await makeCanvas();
    await revokeLink(owner);
    const jordan = await stranger();
    expect((await get(jordan, grantsRoute(CANVAS))).status).toBe(403);
    const shared = await fetch(`${base}${grantsRoute(CANVAS)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...jordan.headers },
      body: JSON.stringify({ subject: "link" }),
    });
    // A stranger who could turn the link back on would be a door with a
    // handle on the outside.
    expect(shared.status).toBe(403);
  });

  /**
   * A bodiless `DELETE` that still declares JSON, which is what a great many
   * HTTP clients send whether or not there is anything to send.
   *
   * The 500 this pins was **pre-existing, not a phase 7 regression**:
   * `DELETE /api/commands/:id` and `DELETE /api/presence/actors/:id` have both
   * answered `internal error` to this request since they were written. Fastify
   * refuses to parse an empty body under a JSON content-type
   * (`FST_ERR_CTP_EMPTY_JSON_BODY`, its own 400) and the error handler, which
   * matched only our error classes, collapsed that to a 500.
   *
   * It is pinned HERE because the revoke is the DELETE that stage 2 calls from
   * two surfaces — the Share dialog and the CLI verb — so this is the route
   * where "revoke failed: internal error" would actually be read by somebody,
   * and debugged from the wrong end.
   */
  it("answers a bodiless JSON DELETE with the 4xx it is, and still revokes", async () => {
    await makeCanvas();
    const link = (await grantsOf(owner)).grants[0]!;
    const revoked = await fetch(`${base}${grantRoute(CANVAS, link.id)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", ...owner.headers },
    });
    expect(revoked.status).toBe(400);
    const body = (await revoked.json()) as { error: string; code?: string };
    // The code, not the prose, is the contract: a caller can branch on it, and
    // it names the caller's mistake rather than reporting ours.
    expect(body.code).toBe("FST_ERR_CTP_EMPTY_JSON_BODY");
    expect(body.error).not.toBe("internal error");
    // Refused BEFORE the handler, so nothing happened to the grant.
    expect((await grantsOf(owner)).grants[0]!.revokedAt).toBeUndefined();

    // And the same DELETE without the empty-body claim still works, so the
    // handler's own answer is untouched — asserted at the door, which is the
    // only place a revoke means anything.
    expect((await revokeLink(owner)).status).toBe(200);
    expect((await get(await stranger(), `/api/projects/${CANVAS}/canvas`)).status).toBe(403);
  });
});

describe("what a badge may see", () => {
  it("stops listing a canvas whose link is off, and goes on listing it to those inside", async () => {
    await makeCanvas();
    const jordan = await stranger();
    const before = (await (await get(jordan, "/api/projects")).json()) as Project[];
    expect(before.map((project) => project.id)).toEqual([CANVAS]);
    // Listing is not entering, and it does not admit: what a badge "could get
    // into" is a different question from where it has been, and answering the
    // first by writing the second would hand every browsing badge an
    // admission to everything — which is the very scope mechanism 10 narrows
    // the name check to, and which phase 9's sweep would then have to expel.
    expect((await daemon.desk.badge(jordan.badgeId))!.admissions).toEqual([]);
    // So Jordan ENTERS, the way Scene 3 has her enter: by opening the canvas.
    expect((await get(jordan, `/api/projects/${CANVAS}/canvas`)).status).toBe(200);

    await revokeLink(owner);
    const outsider = await stranger();
    // Phase 6's debt: `HomeLink.sweep` polls this list and dials everything in
    // it, so an un-narrowed list is a replica mirroring strangers' canvases
    // onto a laptop. With the link off, there is nothing here to mirror.
    expect(await (await get(outsider, "/api/projects")).json()).toEqual([]);
    // And the badge that was already admitted still sees it — its admission,
    // not the grant, is what answers now.
    expect(
      ((await (await get(jordan, "/api/projects")).json()) as Project[]).map((pr) => pr.id),
    ).toEqual([CANVAS]);
  });
});

describe("actor.claim's projectId", () => {
  /**
   * Phase 3's hole, closed. A claim widens its own name-check scope by naming
   * the canvas it was made from — which under the old policy could only ever
   * reach a canvas the address would have admitted the asker to anyway. Under
   * a grant it has to be admission-checked, or "is this name taken here"
   * becomes a probe into a room you were never let into: the refusal NAMES the
   * holder and the canvas's title.
   */
  const claimPriya = (badge: TestBadge) =>
    op(badge, {
      projectId: null,
      op: { type: "actor.claim", sessionKey: "cli:probe", name: "Priya", projectId: CANVAS },
    });

  it("widens the name scope while a grant would admit the asker", async () => {
    await makeCanvas();
    const probe = await stranger();
    const refused = await claimPriya(probe);
    expect(refused.status).toBe(400);
    const body = (await refused.json()) as { code: string; error: string };
    expect(body.code).toBe("name-taken");
    expect(body.error).toContain("Acme Sprint Board");
  });

  it("does NOT widen it into a canvas the asker could not enter", async () => {
    await makeCanvas();
    await revokeLink(owner);
    const probe = await stranger();
    const taken = await claimPriya(probe);
    // The name is free as far as this badge can see, because the room it
    // named is one it was never let into — and the answer leaks neither the
    // holder nor the canvas's title.
    expect(taken.status).toBe(200);
    const { envelope } = (await taken.json()) as { envelope: { actor: { name: string } } };
    expect(envelope.actor.name).toBe("Priya");
  });
});

describe("a free name, for a badge that has been nowhere", () => {
  /**
   * **The bug phase 7.5 shipped, reproduced without a clock.**
   *
   * `GET /api/actors/free-name` is asked by a replica on behalf of a nameless
   * claimant, and the badge asking is the replica's own — brand new, admitted
   * to nothing. Scoped strictly to admissions, that badge's scope is EMPTY,
   * so the home answers with the first roster name: the one answer guaranteed
   * to collide the instant the claim is announced.
   *
   * It passed against a local home because a replica's sweep admits its badge
   * over loopback within milliseconds, so by claim time the scope was full.
   * Against a real home the claim won that race — and the refusal that came
   * back NAMED the canvas, because by then the badge HAD been admitted. That
   * asymmetry is what made it look like anything but a scope bug.
   *
   * So this asks the route directly, from a badge that has been nowhere. No
   * replica, no sweep, no timing: the condition, not the clock.
   */
  const freeName = async (badge: TestBadge): Promise<string> =>
    ((await (await get(badge, FREE_NAME_ROUTE)).json()) as FreeNameResponse).name;

  /** The first roster name, on a canvas — `heldNames` reads rosters, so a
   * claim alone would not put it in anybody's way. */
  async function canvasHeldByIsaac(): Promise<void> {
    const isaac = { id: "usr_isaac", name: ISOCAN_NAMES[0] };
    await owner.speakAs(isaac, "test:isaac");
    const made = await op(owner, {
      projectId: null,
      actor: isaac,
      op: { type: "project.create", projectId: CANVAS, title: "Acme Sprint Board" },
    });
    if (!made.ok) throw new Error(`could not create the canvas: ${await made.text()}`);
  }

  it("skips a name taken in a canvas the asker has not entered but could", async () => {
    await canvasHeldByIsaac();
    const fresh = await stranger();
    expect(await freeName(fresh)).not.toBe(ISOCAN_NAMES[0]);
    expect(await freeName(fresh)).toBe(ISOCAN_NAMES[1]);
  });

  it("does not admit the asker to anything by answering", async () => {
    await canvasHeldByIsaac();
    const fresh = await stranger();
    await freeName(fresh);
    // Same line the projects listing holds: what a badge COULD get into is a
    // different question from where it has been, and answering the first by
    // writing the second would hand every asking badge an admission to
    // everything — the scope mechanism 10 exists to narrow.
    expect((await daemon.desk.badge(fresh.badgeId))!.admissions).toEqual([]);
  });

  it("does not reach into a canvas the asker could not enter", async () => {
    await canvasHeldByIsaac();
    await revokeLink(owner);
    const fresh = await stranger();
    // With the link off the room is out of reach, so its roster is none of
    // this badge's business and the first roster name is free again. The
    // widening is the door's test, not "the whole home".
    expect(await freeName(fresh)).toBe(ISOCAN_NAMES[0]);
  });

  it("still answers an ADMITTED badge from what it is admitted to", async () => {
    await canvasHeldByIsaac();
    const inside = await stranger();
    expect((await get(inside, `/api/projects/${CANVAS}/canvas`)).status).toBe(200);
    await revokeLink(owner);
    // The link is off, so no grant would admit anybody now — but this badge
    // has already been in, and its admission is what answers. The widening
    // adds to the admissions; it never replaces them.
    expect(await freeName(inside)).toBe(ISOCAN_NAMES[1]);
    expect(await freeName(await stranger())).toBe(ISOCAN_NAMES[0]);
  });
});

describe("on a replica", () => {
  /**
   * A grant is desk state and desk state does not replicate — so the row that
   * decides who may enter a canvas lives at the HOME, and a laptop's own rows
   * say only who on that laptop may reach its copy. A share verb that edited
   * the laptop's ledger would report success while the link stayed on for the
   * world, which is why all three routes forward.
   */
  it("forwards the grant routes to the home rather than editing its own ledger", async () => {
    const replicaDir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-grants-replica-"));
    const replica = await startDaemon({ port: 0, home: replicaDir, homeUrl: base, homePollMs: 50 });
    const address = replica.app.server.address();
    const replicaBase = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
    try {
      // A different actor from the one the home's owner badge already claims:
      // two badges holding one actor is what a PASS is for, and passes are
      // phase 8 (phase 6 named this seam and it is not this phase's).
      const isaac = { id: "usr_isaac", name: "Isaac" };
      const cli = await mintTestBadge(replicaBase);
      await cli.speakAs(isaac);
      // Born through the replica, so born at the home — phase 6's demotion.
      const made = await fetch(`${replicaBase}/api/ops`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...cli.headers },
        body: JSON.stringify({
          projectId: null,
          actor: isaac,
          op: { type: "project.create", projectId: CANVAS, title: "Acme Sprint Board" },
        }),
      });
      expect(made.status, await made.clone().text()).toBe(200);

      // What the replica reports is the HOME's row, id and all.
      const theirs = (await (
        await fetch(`${replicaBase}${grantsRoute(CANVAS)}`, { headers: cli.headers })
      ).json()) as GrantsResponse;
      const atHome = await grantsOf(owner);
      expect(theirs.grants.map((row) => row.id)).toEqual(atHome.grants.map((row) => row.id));

      // And revoking through the replica turns the link off AT THE HOME.
      const off = await fetch(`${replicaBase}${grantRoute(CANVAS, theirs.grants[0]!.id)}`, {
        method: "DELETE",
        headers: cli.headers,
      });
      expect(off.status).toBe(200);
      expect((await grantsOf(owner)).grants).toEqual([]);
      const jordan = await stranger();
      expect((await get(jordan, `/api/projects/${CANVAS}/canvas`)).status).toBe(403);
    } finally {
      await replica.close();
      await fs.rm(replicaDir, { recursive: true, force: true });
    }
  }, 30_000);
});

describe("the one-time migration", () => {
  it("grants the link on every canvas that predates grants", async () => {
    /**
     * Every canvas already in the world has no grant row. If the door starts
     * refusing without one, every one of them becomes unreachable — not
     * degraded, gone. So this is simulated exactly: a desk with the rows taken
     * out, and a daemon started on top of it.
     */
    await makeCanvas();
    await daemon.close();

    const deskFile = p.badgesFile(home);
    const desk = JSON.parse(await fs.readFile(deskFile, "utf8")) as Record<string, unknown>;
    delete desk["grants"];
    await fs.writeFile(deskFile, JSON.stringify(desk));
    // The log would replay the grant back; a pre-phase-7 home has no such
    // lines at all, which is what this reproduces.
    await fs.writeFile(
      p.badgesLogFile(home),
      (await fs.readFile(p.badgesLogFile(home), "utf8"))
        .split("\n")
        .filter((line) => line && !line.includes('"type":"grant"'))
        .join("\n") + "\n",
    );
    await fs.rm(p.linkGrantsMigratedFile(home), { force: true });

    await boot();
    const jordan = await stranger();
    expect((await get(jordan, `/api/projects/${CANVAS}/canvas`)).status).toBe(200);
    const { grants } = await grantsOf(jordan);
    expect(grants).toHaveLength(1);
    // Not a badge id: nobody opened this canvas up, it predates the question.
    expect(grants[0]).toMatchObject({ subject: "link", grantedBy: "migration" });
  });

  it("does not run twice, and does not resurrect a link somebody turned off", async () => {
    await makeCanvas();
    await revokeLink(owner);
    await daemon.close();
    await fs.rm(p.linkGrantsMigratedFile(home), { force: true });
    await boot();

    // An "ensure" that looked only for a LIVE link row would helpfully turn
    // the link back on at every boot, which is the worst possible direction
    // for a lost file to fail in.
    const jordan = await stranger();
    expect((await get(jordan, `/api/projects/${CANVAS}/canvas`)).status).toBe(403);
    expect((await grantsOf(owner)).grants).toEqual([]);
  });
});
