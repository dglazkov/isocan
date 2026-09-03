import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { WebSocket } from "ws";
import type {
  CanvasSnapshotResponse,
  FreeNameResponse,
  GrantResponse,
  GrantsResponse,
  LogEntry,
  Canvas,
  PresenceWhereResponse,
} from "@isocan/core";
import { PRESENCE_WHERE_ROUTE } from "@isocan/core";
import {
  FREE_NAME_ROUTE,
  grantRoute,
  grantsRoute,
  ISOCAN_NAMES,
  canvasesRoute,
  WS_NOT_ADMITTED,
} from "@isocan/core";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import * as p from "../src/paths.ts";
import type { AuthConfig } from "../src/attest.ts";
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
/** What this home has borrowed: nothing, except where a suite below says
 * otherwise (`beforeAll`, which runs before the `beforeEach` that boots). */
let auth: AuthConfig | null = null;

async function boot(): Promise<void> {
  // `auth: null` is this suite SAYING this home has borrowed nothing, rather
  // than relying on the machine it runs on not having `ISOCAN_AUTH_PROJECT`
  // set. A developer with a dev home configured in their shell would otherwise
  // watch the no-attester assertions below fail for a reason that has nothing
  // to do with the code — the same courtesy `birthHome: null` extends.
  daemon = await startDaemon({ port: 0, home, auth });
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
    canvasId: null,
    actor: priya,
    op: { type: "project.create", canvasId: CANVAS, title: "Acme Sprint Board" },
  });
  if (!made.ok) throw new Error(`could not create the canvas: ${await made.text()}`);
}

const get = (badge: TestBadge, url: string) => fetch(`${base}${url}`, { headers: badge.headers });

const grantsOf = async (badge: TestBadge, canvasId = CANVAS): Promise<GrantsResponse> =>
  (await get(badge, grantsRoute(canvasId))).json() as Promise<GrantsResponse>;

async function revokeLink(badge: TestBadge): Promise<Response> {
  const { grants } = await grantsOf(badge);
  return fetch(`${base}${grantRoute(CANVAS, grants[0]!.id)}`, {
    method: "DELETE",
    headers: badge.headers,
  });
}

/** What a socket was told, so a refusal can be asserted as a close code. */
function socketClose(badge: TestBadge, canvasId = CANVAS): Promise<number> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${base.replace("http:", "ws:")}/ws?canvasId=${canvasId}`, {
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
      canvasId: CANVAS,
      actor: { id: "usr_jordan", name: "Jordan" },
      op: { type: "project.rename", canvasId: CANVAS, title: "Not Acme" },
    });
    expect(wrote.status).toBe(403);
    // `/api/ops` is the one route whose canvas is in the body rather than the
    // path, so the hook cannot cover it and the door is called by hand — in
    // the RIGHT ORDER. A refusal that arrives after the op has landed is not
    // a refusal.
    const snapshot = (await (await get(owner, `/api/projects/${CANVAS}/canvas`)).json()) as {
      project: Canvas;
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

  it("EXPELS the badges it let in — phase 9's sweep, where phase 7 left a note", async () => {
    await makeCanvas();
    const jordan = await stranger();
    expect((await get(jordan, `/api/projects/${CANVAS}/canvas`)).status).toBe(200);
    await revokeLink(owner);
    // Phase 7 asserted the opposite here and said why: the sweep has to RE-RUN
    // the door test per badge and re-root the ones another grant still covers,
    // or turning off the link would expel the people invited by name. That is
    // built (`server/sweep.ts`, and `sweep.test.ts` for the shapes), so this
    // is now an expulsion.
    expect((await get(jordan, `/api/projects/${CANVAS}/canvas`)).status).toBe(403);
    // The badge that MADE the canvas is untouched: `{root: "created"}` is the
    // one root a sweep never walks.
    expect((await get(owner, `/api/projects/${CANVAS}/canvas`)).status).toBe(200);
  });

  it("answers 404 for a canvas that is not here, never 403", async () => {
    const jordan = await stranger();
    const seen = await get(jordan, "/api/projects/prj_nowhere/canvas");
    // The refusal is for canvases that exist and will not have you. Anything
    // else turns every mistyped id into "you are not admitted" about a canvas
    // that was never there.
    expect(seen.status).toBe(404);
    expect(((await seen.json()) as { code: string }).code).toBe("unknown-canvas");
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
  /**
   * **Two refusals, and the difference is the phase-9 seam being honest.**
   *
   * `email:` and `repo:` are REAL subjects now — the door checks them against
   * a badge's attestations, and `sweep.test.ts` proves it admits and re-roots
   * on them. What is still missing is an ATTESTER: nothing in stage 1 verifies
   * an email or a GitHub identity, because that needs a borrowed bench and a
   * cloud resource nobody may provision without asking. So the refusal moved
   * from core (a phase boundary) to `server/attest.ts` (a fact about this
   * home's configuration), and it says which of the two it is.
   */
  it("refuses a well-formed subject this home has no attester for, and says so", async () => {
    await makeCanvas();
    for (const subject of ["email:jordan@example.com", "repo:github.com/acme/board"]) {
      const asked = await fetch(`${base}${grantsRoute(CANVAS)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...owner.headers },
        body: JSON.stringify({ subject }),
      });
      expect(asked.status, subject).toBe(400);
      const body = (await asked.json()) as { error: string; code: string };
      // NOT `bad-grant`: the subject is fine, and a caller told "not a grant
      // subject" about a perfectly good address goes hunting for a typo that
      // is not there.
      expect(body.code).toBe("no-attester");
      expect(body.error).toMatch(/borrowed|cannot/);
      // Each kind says what it would take, because they are different things
      // to go and do: an email needs a borrowed sign-in, a repo needs a token
      // check nobody has built. Both end at the same remedy — the link.
      expect(body.error).toMatch(/Share the link/);
    }
    // And the rows are not there: a grant nothing can satisfy is a dialog
    // claiming somebody was invited when nobody was.
    expect((await grantsOf(owner)).grants.map((row) => row.subject)).toEqual(["link"]);
  });

  it("refuses a subject that is not one at all — a different answer, on purpose", async () => {
    await makeCanvas();
    for (const subject of [undefined, "", "everyone", 42, "email:Jordan"]) {
      const asked = await fetch(`${base}${grantsRoute(CANVAS)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...owner.headers },
        body: JSON.stringify({ subject }),
      });
      expect(asked.status, String(subject)).toBe(400);
      expect(((await asked.json()) as { code: string }).code, String(subject)).toBe("bad-grant");
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
      canvasId: null,
      actor: priya,
      op: { type: "project.create", canvasId: "prj_other", title: "Test Board" },
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

  it("is only for the admitted — the hook guards it like every canvas route", async () => {
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
    const before = (await (await get(jordan, "/api/projects")).json()) as Canvas[];
    expect(before.map((canvas) => canvas.id)).toEqual([CANVAS]);
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
    // And Jordan, who came in on that link, is gone from her own listing too —
    // phase 9's sweep, which took the admission that used to answer here.
    // Phase 7 asserted the opposite line and said the sweep would change it.
    expect(await (await get(jordan, "/api/projects")).json()).toEqual([]);
    // The badge that MADE the canvas still sees it: `{root: "created"}` is the
    // one root a sweep never walks, so an owner cannot revoke themselves out
    // of their own home.
    expect(
      ((await (await get(owner, "/api/projects")).json()) as Canvas[]).map((pr) => pr.id),
    ).toEqual([CANVAS]);
  });

  /**
   * **Two callers, two questions, one route** — phase 8 stage 4. See
   * `CanvasesReach`.
   *
   * The listing has always answered one question: "what could this badge walk
   * into?" A replica polls it to decide what to MIRROR, and those are not the
   * same question — a canvas whose link is merely on is one a person may open
   * and one a laptop has no business carrying. The caller states which, and
   * the wide answer stays the default, because narrowing it wholesale is the
   * worse bug: on a solo home a canvas created from the CLI is admitted to the
   * CLI's bearer badge while the person's tab carries a cookie badge that has
   * never been in it, so a narrowed listing would hide a person's own canvas
   * from their own front page.
   */
  it("narrows to admissions when the caller asks that question, and only then", async () => {
    await makeCanvas();
    const laptop = await stranger();

    // The default: the link would admit this badge, so the canvas is listed.
    // A person's front page, and what every client that says nothing gets —
    // including a replica built before this parameter existed.
    expect(
      (((await (await get(laptop, "/api/projects")).json()) as Canvas[])).map((pr) => pr.id),
    ).toEqual([CANVAS]);

    // The replica's question. Same badge, same instant, same canvas, same live
    // link grant — and nothing, because nobody has let this machine in.
    expect(await (await get(laptop, canvasesRoute("admitted"))).json()).toEqual([]);

    // Asking did not admit it either: a listing is not an entering, and the
    // narrow answer must not quietly become true by having been asked for.
    expect((await daemon.desk.badge(laptop.badgeId))!.admissions).toEqual([]);

    // Now let it in — the pass is the mechanism, and an admission is an
    // admission however it was written. The narrow answer changes; the wide
    // one does not, because it already said yes.
    await daemon.desk.admit(laptop.badgeId, CANVAS, { root: "created" });
    expect(
      (((await (await get(laptop, canvasesRoute("admitted"))).json()) as Canvas[])).map((pr) => pr.id),
    ).toEqual([CANVAS]);

    // A word that is not the narrowing word is the DEFAULT, not a silent
    // narrowing and not an error. There is exactly one spelling of the
    // parameter (`canvasesRoute`), so a near-miss can only come from somebody
    // hand-building the URL — and the safe way to be wrong about a listing is
    // to show a person too much of their own home rather than too little.
    const nobody = await stranger();
    expect(
      (((await (await get(nobody, "/api/projects?reach=admited")).json()) as Canvas[])).map(
        (pr) => pr.id,
      ),
    ).toEqual([CANVAS]);
  });
});

describe("actor.claim's canvasId", () => {
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
      canvasId: null,
      op: { type: "actor.claim", sessionKey: "cli:probe", name: "Priya", canvasId: CANVAS },
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

  /**
   * The name a fresh badge WOULD be handed, worn by somebody on a canvas —
   * `heldNames` reads rosters, so a claim alone would not put it in anybody's
   * way.
   *
   * Asked for rather than assumed. Allocation no longer walks the roster from
   * index 0 (it enters at a hashed point, so two scopes that cannot see each
   * other do not both reach for the same first name), which makes
   * `ISOCAN_NAMES[0]` no longer the answer to "what would this badge get".
   * These cases are about SCOPE — whether a room's roster is in reach — so
   * they have to park somebody on the name that is actually in the way, or
   * they prove nothing.
   */
  async function wouldGet(): Promise<string> {
    return freeName(await stranger());
  }
  async function canvasHeldBy(name: string): Promise<void> {
    const isaac = { id: "usr_isaac", name };
    await owner.speakAs(isaac, "test:isaac");
    const made = await op(owner, {
      canvasId: null,
      actor: isaac,
      op: { type: "project.create", canvasId: CANVAS, title: "Acme Sprint Board" },
    });
    if (!made.ok) throw new Error(`could not create the canvas: ${await made.text()}`);
  }

  it("skips a name taken in a canvas the asker has not entered but could", async () => {
    const wanted = await wouldGet();
    await canvasHeldBy(wanted);
    const fresh = await stranger();
    // It reached into a room this badge has never entered, found the name
    // worn, and moved on. That is the whole claim; which name it moved on TO
    // is the hash's business, not this test's.
    expect(await freeName(fresh)).not.toBe(wanted);
  });

  it("does not admit the asker to anything by answering", async () => {
    await canvasHeldBy(await wouldGet());
    const fresh = await stranger();
    await freeName(fresh);
    // Same line the canvases listing holds: what a badge COULD get into is a
    // different question from where it has been, and answering the first by
    // writing the second would hand every asking badge an admission to
    // everything — the scope mechanism 10 exists to narrow.
    expect((await daemon.desk.badge(fresh.badgeId))!.admissions).toEqual([]);
  });

  it("does not reach into a canvas the asker could not enter", async () => {
    const wanted = await wouldGet();
    await canvasHeldBy(wanted);
    await revokeLink(owner);
    const fresh = await stranger();
    // With the link off the room is out of reach, so its roster is none of
    // this badge's business and that name is free AGAIN — the same name the
    // case above proved it would skip. The widening is the door's test, not
    // "the whole home".
    expect(await freeName(fresh)).toBe(wanted);
  });

  it("still answers an ADMITTED badge from what it is admitted to", async () => {
    await canvasHeldBy(await wouldGet());
    await revokeLink(owner);
    // The link is off, so no grant would admit anybody now — but the badge
    // that MADE the canvas has an admission the sweep never walks, and that
    // admission is what answers. The widening adds to the admissions; it never
    // replaces them.
    //
    // The badge here is the creator's rather than a link-admitted stranger's,
    // and that is phase 9 showing through: a stranger who had merely been in
    // is SWEPT when the link goes off, so there is no longer any such thing as
    // "admitted by a grant that is gone".
    // Stated as the DIFFERENCE between the two, which is the whole point: the
    // owner can see the room's roster and moves off the worn name; a stranger
    // cannot reach the room, so the same name is free again for it.
    const wanted = await wouldGet();
    expect(await freeName(owner)).not.toBe(wanted);
    expect(await freeName(await stranger())).toBe(wanted);
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
    const replica = await startDaemon({ port: 0, home: replicaDir, birthHome: base, homePollMs: 50 });
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
          canvasId: null,
          actor: isaac,
          op: { type: "project.create", canvasId: CANVAS, title: "Acme Sprint Board" },
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
      // Read off the home's own desk rather than through a badge: the sweep
      // that rides on the revocation has just expelled every badge the link
      // let in, and `owner` — admitted a few lines above by asking for the
      // grants — is one of them. That is the phase-9 behaviour under test
      // elsewhere; here it would only be a confusing 403.
      expect((await daemon.desk.grantsFor(CANVAS)).every((row) => row.revokedAt)).toBe(true);
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

/**
 * **The cross-canvas presence read, and the gate it has to pass through.**
 *
 * `GET /api/presence/where` exists because the lens asks about a person and
 * presence is filed by canvas. That inversion is exactly where a leak would
 * come from: the per-canvas roster is guarded by the socket that carries it,
 * and a read that walks every room has no socket to be guarded by.
 *
 * A canvas list you may not see leaves you uninformed. A roster you may not
 * see tells you who is working with whom, which is a fact about somebody
 * else's canvas — so the rooms are filtered before anything about their
 * occupants is reported, and a room you cannot enter contributes nothing at
 * all, not even a count.
 */
describe("where everybody is, read across canvases", () => {
  const parkSession = (badge: TestBadge, canvasId: string, kind: "cli" | "rc") =>
    fetch(`${base}/api/projects/${canvasId}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...badge.headers },
      body: JSON.stringify({ actor: priya, kind }),
    });

  const whereOf = async (badge: TestBadge): Promise<PresenceWhereResponse> =>
    (await get(badge, PRESENCE_WHERE_ROUTE)).json() as Promise<PresenceWhereResponse>;

  it("reports a room the badge may enter", async () => {
    await makeCanvas();
    await parkSession(owner, CANVAS, "cli");
    const { where } = await whereOf(owner);
    expect(where.map((w) => [w.canvasId, w.actor.id, w.kind])).toEqual([
      [CANVAS, priya.id, "cli"],
    ]);
  });

  it("says nothing at all about a room the badge may not enter", async () => {
    await makeCanvas();
    await parkSession(owner, CANVAS, "cli");
    await revokeLink(owner);
    /* Not an empty row, not a count of faces, not the canvas id: "three
       people somewhere you cannot look" is still somebody else's business. */
    const { where } = await whereOf(await stranger());
    expect(where).toEqual([]);
  });

  it("carries the kind, because standing by is not being there", async () => {
    await makeCanvas();
    await parkSession(owner, CANVAS, "rc");
    const { where } = await whereOf(owner);
    expect(where[0]!.kind).toBe("rc");
  });
});

/**
 * **The bar** (roles design, "The bar"; roles phase 3; journey 3 steps 3–4).
 *
 * A row that says no. Written two ways — `POST …/grants` with `bars: true`,
 * and `DELETE …/grants/:id?bar=1`, which revokes and bars in one request —
 * and lifted the ordinary way. What is asserted is the door's answer, never
 * the row alone: a barred address is refused with `not-admitted` while the
 * same link admits a stranger; the creator cannot be barred, at the route
 * and at the door; and the DELETE's answer says whether the link would still
 * admit the person, which is the sentence both surfaces owe before *keep
 * them out* is offered.
 *
 * This home has borrowed an attester (configuration only — nothing is
 * verified here; the proofs are written on the desk), because a bar is held
 * to the same rule as an invitation: a row naming an address nobody here can
 * prove is a row with no effect, and the route refuses to write one.
 */
describe("the bar", () => {
  const sam = "email:sam@acme.test";
  beforeAll(() => {
    auth = { project: "acme-test", apiKey: "test-key" };
  });
  afterAll(() => {
    auth = null;
  });

  const post = (badge: TestBadge, url: string, body: unknown) =>
    fetch(`${base}${url}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...badge.headers },
      body: JSON.stringify(body),
    });
  const del = (badge: TestBadge, url: string) =>
    fetch(`${base}${url}`, { method: "DELETE", headers: badge.headers });
  const enter = (badge: TestBadge) => get(badge, `/api/projects/${CANVAS}/canvas`);
  const prove = (badge: TestBadge, attribute: string) =>
    daemon.desk.attest(badge.badgeId, { attribute, verifiedVia: "magic-link", at: new Date().toISOString() });
  /** A badge that has proved this address and nothing else. */
  const holderOf = async (attribute: string): Promise<TestBadge> => {
    const badge = await stranger();
    await prove(badge, attribute);
    return badge;
  };
  const liveRowsFor = async (subject: string) =>
    (await grantsOf(owner)).grants.filter((g) => g.subject === subject);
  const bar = async (subject: string) =>
    (await (await post(owner, grantsRoute(CANVAS), { subject, bars: true })).json()) as GrantResponse;
  const invite = async (subject: string, capability?: string) =>
    (await (
      await post(owner, grantsRoute(CANVAS), { subject, ...(capability ? { capability } : {}) })
    ).json()) as GrantResponse;
  const body = (res: Response) => res.json() as Promise<{ code?: string; error?: string }>;

  it("keeps a barred address out at the door with `not-admitted`, while the link admits a stranger", async () => {
    await makeCanvas();
    const holder = await holderOf(sam);
    expect((await enter(holder)).status).toBe(200); // in on the link, like anybody

    const written = await bar(sam);
    expect(written.grant).toMatchObject({ subject: sam, bars: true, grantedBy: owner.badgeId });
    expect(written.grant.capability).toBeUndefined();
    // The write swept, and the sweep met the bar: Sam was inside on the link
    // and is not any more.
    expect(written.swept).toEqual({ expelled: 1, rerooted: 0 });

    const refused = await enter(holder);
    expect(refused.status).toBe(403);
    expect((await body(refused)).code).toBe("not-admitted");
    expect(await socketClose(holder)).toBe(WS_NOT_ADMITTED);
    // The same link, the same moment, a stranger: the bar is about Sam.
    expect((await enter(await stranger())).status).toBe(200);
    // And the row is listed, as a row.
    expect(await liveRowsFor(sam)).toEqual([expect.objectContaining({ bars: true })]);
  });

  it("cannot bar the creator: the route refuses with the reason, and the door ignores such a row", async () => {
    await makeCanvas();
    await prove(owner, "email:priya@acme.test");
    const refused = await post(owner, grantsRoute(CANVAS), { subject: "email:priya@acme.test", bars: true });
    expect(refused.status).toBe(400);
    const why = await body(refused);
    expect(why.code).toBe("bad-grant");
    expect(why.error).toContain("cannot be kept out");
    expect(await liveRowsFor("email:priya@acme.test")).toEqual([]);

    // A row that got there anyway — written on the desk, past the route —
    // does nothing: the floor is asked before a bar takes effect. A second
    // badge of the creator's, proved and claiming them, walks in as owner.
    await daemon.desk.putGrant({
      id: "gnt_bar_priya",
      canvasId: CANVAS,
      subject: "email:priya@acme.test",
      grantedBy: "bdg_somebody",
      at: new Date().toISOString(),
      bars: true,
    });
    const phone = await holderOf("email:priya@acme.test");
    await phone.speakAs(priya);
    const seen = await enter(phone);
    expect(seen.status).toBe(200);
    expect(((await seen.json()) as CanvasSnapshotResponse).capability).toBe("own");
  });

  it("refuses to bar the link, however it is asked, and leaves the link on", async () => {
    await makeCanvas();
    const direct = await post(owner, grantsRoute(CANVAS), { subject: "link", bars: true });
    expect(direct.status).toBe(400);
    expect((await body(direct)).error).toMatch(/link cannot be kept out/);
    const link = (await grantsOf(owner)).grants.find((g) => g.subject === "link")!;
    const withRevoke = await del(owner, `${grantRoute(CANVAS, link.id)}?bar=1`);
    expect(withRevoke.status).toBe(400);
    expect((await body(withRevoke)).code).toBe("bad-grant");
    // Refused BEFORE anything was written: the link is exactly as it was.
    expect((await grantsOf(owner)).grants.find((g) => g.subject === "link")?.revokedAt).toBeUndefined();
    expect((await enter(await stranger())).status).toBe(200);
    // And a bar has no rung.
    const ranked = await post(owner, grantsRoute(CANVAS), { subject: sam, bars: true, capability: "read" });
    expect(ranked.status).toBe(400);
    expect((await body(ranked)).error).toMatch(/a bar has no rung/);
  });

  it("`?bar=1` revokes the row and writes the bar in one request, and the one sweep meets the bar", async () => {
    await makeCanvas();
    const invited = await invite(sam);
    const holder = await holderOf(sam);
    expect((await enter(holder)).status).toBe(200);

    const answer = (await (await del(owner, `${grantRoute(CANVAS, invited.grant.id)}?bar=1`)).json()) as GrantResponse;
    expect(answer.grant.id).toBe(invited.grant.id);
    expect(answer.grant.revokedAt).toBeDefined();
    expect(answer.bar).toMatchObject({ subject: sam, bars: true, canvasId: CANVAS });
    expect(answer.swept).toEqual({ expelled: 1, rerooted: 0 });
    // The bar is there, so nothing would still admit them — and the answer
    // does not pretend the link would.
    expect(answer.stillAdmittedBy).toBeUndefined();
    expect(await liveRowsFor(sam)).toEqual([expect.objectContaining({ id: answer.bar!.id, bars: true })]);
    expect((await enter(holder)).status).toBe(403);
  });

  it("says whether the link would still admit them, read off the rows after the revoke", async () => {
    await makeCanvas();
    const first = await invite(sam);
    const plain = (await (await del(owner, grantRoute(CANVAS, first.grant.id))).json()) as GrantResponse;
    expect(plain.stillAdmittedBy).toBe("link");
    expect(plain.bar).toBeUndefined();
    // With the link off, nothing would: the answer is silent.
    const link = (await grantsOf(owner)).grants.find((g) => g.subject === "link")!;
    const off = (await (await del(owner, grantRoute(CANVAS, link.id))).json()) as GrantResponse;
    expect(off.stillAdmittedBy).toBeUndefined();
    const second = await invite(sam);
    const alone = (await (await del(owner, grantRoute(CANVAS, second.grant.id))).json()) as GrantResponse;
    expect(alone.stillAdmittedBy).toBeUndefined();
  });

  it("replaces the live row, hands back a standing bar, and is replaced by an invitation", async () => {
    await makeCanvas();
    const invited = await invite(sam, "read");
    const first = await bar(sam);
    expect(first.grant.id).not.toBe(invited.grant.id);
    expect(await liveRowsFor(sam)).toEqual([expect.objectContaining({ id: first.grant.id, bars: true })]);
    // A bar over a bar is the row that is already there — the toggle's rule.
    const again = await bar(sam);
    expect(again.grant.id).toBe(first.grant.id);
    // Inviting them again is how a bar ends (journey 3 step 4): the bar is
    // tombstoned and the invitation admits.
    const back = await invite(sam);
    expect(back.grant.bars).toBeUndefined();
    expect(await liveRowsFor(sam)).toEqual([expect.objectContaining({ id: back.grant.id })]);
    expect((await enter(await holderOf(sam))).status).toBe(200);
  });

  it("is lifted by the ordinary DELETE, and the door admits them again", async () => {
    await makeCanvas();
    const written = await bar(sam);
    const holder = await holderOf(sam);
    expect((await enter(holder)).status).toBe(403);
    const lifted = (await (await del(owner, grantRoute(CANVAS, written.grant.id))).json()) as GrantResponse;
    expect(lifted.grant.revokedAt).toBeDefined();
    // Honest about what now admits them: the link is on.
    expect(lifted.stillAdmittedBy).toBe("link");
    expect((await enter(holder)).status).toBe(200);
    // A bar cannot be revoked "and barred": there is nothing to keep out.
    const twice = await del(owner, `${grantRoute(CANVAS, written.grant.id)}?bar=1`);
    expect(twice.status).toBe(400);
  });

  it("is an owner's write: an editor in on the link is refused with `not-owner`", async () => {
    await makeCanvas();
    const editor = await stranger();
    expect((await enter(editor)).status).toBe(200);
    const direct = await post(editor, grantsRoute(CANVAS), { subject: sam, bars: true });
    expect(direct.status).toBe(403);
    expect((await body(direct)).code).toBe("not-owner");
    const invited = await invite(sam);
    const withRevoke = await del(editor, `${grantRoute(CANVAS, invited.grant.id)}?bar=1`);
    expect(withRevoke.status).toBe(403);
    expect((await body(withRevoke)).code).toBe("not-owner");
    expect(await liveRowsFor(sam)).toEqual([expect.objectContaining({ id: invited.grant.id })]);
  });
});
