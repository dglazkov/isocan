import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { SeenMarksResponse, SeenResponse } from "@isocan/core";
import { grantsRoute, PASS_REDEEM_ROUTE, passesRoute, SEEN_ROUTE, seenRoute } from "@isocan/core";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

/**
 * **Seen-marks over HTTP** — `docs/research/2026-09-12-seen-marks.md`.
 *
 * What is held here is everything the design promised that a pure function
 * could not prove: that the mark is a PERSON's and not a browser's (a second
 * machine of theirs finds it), that nobody else can see it, that a `read`-rung
 * viewer is never refused their own mark, and that a fold (`actor.join`) loses
 * nothing.
 */

const CANVAS = "prj_seen";
const ada = { id: "usr_ada", name: "Ada" };
const wasAda = { id: "usr_ada2", name: "Ada 2" };
const bo = { id: "usr_bo", name: "Bo" };

let home: string;
let daemon: Daemon;
let base: string;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-seen-"));
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});

afterEach(async () => {
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

const send = (badge: TestBadge, method: string, url: string, body?: unknown) =>
  fetch(`${base}${url}`, {
    method,
    headers: { "Content-Type": "application/json", ...badge.headers },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

const get = async <T>(badge: TestBadge, url: string): Promise<T> =>
  (await (await fetch(`${base}${url}`, { headers: badge.headers })).json()) as T;

const marksOf = (badge: TestBadge, actorId?: string) =>
  get<SeenMarksResponse>(badge, actorId ? `${SEEN_ROUTE}?actorId=${actorId}` : SEEN_ROUTE);

const mark = async (badge: TestBadge, actor: { id: string }, seq: number): Promise<SeenResponse> =>
  (await (await send(badge, "PUT", seenRoute(CANVAS), { seq, actorId: actor.id })).json()) as SeenResponse;

/** One canvas, made by Ada, with a comment on it. */
async function seed(badge: TestBadge): Promise<void> {
  await send(badge, "POST", "/api/ops", {
    canvasId: null,
    actor: ada,
    op: { type: "project.create", canvasId: CANVAS, title: "Acme" },
  });
  await send(badge, "POST", "/api/ops", {
    canvasId: CANVAS,
    actor: ada,
    op: {
      type: "thread.create",
      threadId: "thr_1",
      x: 0,
      y: 0,
      anchorItemId: null,
      comment: { body: "here we go" },
    },
  });
}

async function laptop(): Promise<TestBadge> {
  const badge = await mintTestBadge(base);
  await badge.speakAs(ada, "test:laptop");
  await seed(badge);
  return badge;
}

describe("a mark belongs to a person, not to a machine", () => {
  it("comes back on a second machine of the same person's", async () => {
    const first = await laptop();
    const { mark: written } = await mark(first, ada, 2);
    expect(written.seq).toBe(2);

    /**
     * The desktop: a different badge, the same person — and it becomes her
     * the way the product actually allows, with a pass. A second surface
     * cannot simply declare itself somebody (`name-taken`, mechanism 10),
     * which is exactly why this is the case worth holding: seen-marks follow
     * the PERSON across the machines the identity desk lets them be, and this
     * is the journey that produces one.
     */
    const { token } = (await (
      await send(first, "POST", passesRoute(CANVAS), { actorId: ada.id })
    ).json()) as { token: string };
    const desktop = await mintTestBadge(base);
    const redeemed = await send(desktop, "POST", PASS_REDEEM_ROUTE, { token });
    expect(redeemed.status, await redeemed.clone().text()).toBe(200);

    const { marks } = await marksOf(desktop, ada.id);
    expect(marks[CANVAS], "what the laptop saw, on the desktop").toEqual(written);
  });

  it("never goes backwards, whichever machine writes last", async () => {
    const badge = await laptop();
    const ahead = await mark(badge, ada, 7);
    const stale = await mark(badge, ada, 3);
    expect(stale.mark.seq, "the answer is the mark as it now stands").toBe(7);
    // And the revisit still counted: `at` moved even though the seq did not,
    // which is what "lately" is ordered by.
    expect(stale.mark.at >= ahead.mark.at).toBe(true);
  });

  it("survives a restart, because the desk is a log with a snapshot", async () => {
    const badge = await laptop();
    await mark(badge, ada, 4);
    await daemon.close();
    daemon = await startDaemon({ port: 0, home });
    const address = daemon.app.server.address();
    base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
    const { marks } = await marksOf(badge, ada.id);
    expect(marks[CANVAS]?.seq).toBe(4);
  });

  it("refuses a seq that is not one", async () => {
    const badge = await laptop();
    const bad = await send(badge, "PUT", seenRoute(CANVAS), { seq: "soon", actorId: ada.id });
    expect(bad.status).toBe(400);
  });
});

describe("nobody else can see it", () => {
  it("answers only for the actors the asking badge claims", async () => {
    const mine = await laptop();
    await mark(mine, ada, 2);

    // Bo is on the same canvas and holds their own badge. There is no route
    // that would hand them Ada's marks, and asking for her actor is refused
    // rather than answered — the privacy guarantee is the absence of a way
    // to ask (D5).
    const theirs = await mintTestBadge(base);
    await theirs.speakAs(bo, "test:bo");
    expect((await marksOf(theirs)).marks, "Bo's own ledger is empty").toEqual({});
    const asking = await fetch(`${base}${SEEN_ROUTE}?actorId=${ada.id}`, { headers: theirs.headers });
    expect(asking.ok, "asking for somebody else's marks is not a read this badge may make").toBe(false);
  });
});

describe("a viewer is never refused their own mark", () => {
  it("marks a canvas seen from the read rung, where an op would be refused", async () => {
    const owner = await laptop();
    // The link, at `read`: a viewer who may look and reply but not edit.
    await send(owner, "POST", grantsRoute(CANVAS), { subject: "link", capability: "read" });
    const viewer = await mintTestBadge(base);
    await viewer.speakAs(bo, "test:viewer");
    // Enter, so the badge holds an admission at that rung.
    await get(viewer, `/api/projects/${CANVAS}`);

    // The contrast that makes this test say something: an OP from this badge
    // is refused at the capability check in `POST /api/ops`, which is exactly
    // why a seen-mark could not have been one.
    const asOp = await send(viewer, "POST", "/api/ops", {
      canvasId: CANVAS,
      actor: bo,
      op: { type: "item.move", itemId: "itm_1", x: 1, y: 1 },
    });
    expect(asOp.status, "this badge is a viewer, and an op is a write").toBe(403);

    const { mark: written } = await mark(viewer, bo, 3);
    expect(written.seq, "a private note about your own attention is not an edit").toBe(3);
    expect((await marksOf(viewer, bo.id)).marks[CANVAS]?.seq).toBe(3);
  });
});

describe("a person who was two actors", () => {
  it("keeps the marks made under the id they stopped using", async () => {
    const badge = await mintTestBadge(base);
    await badge.speakAs(wasAda, "test:old");
    await badge.speakAs(ada, "test:new");
    await seed(badge);
    await mark(badge, wasAda, 2);

    // The fold: one badge that speaks for both, which is what `actor.join`
    // requires of it.
    const joined = await send(badge, "POST", "/api/ops", {
      canvasId: null,
      actor: ada,
      op: { type: "actor.join", from: wasAda.id, into: ada.id },
    });
    expect(joined.ok).toBe(true);

    // Read with no actor named: every actor this badge claims, merged.
    expect((await marksOf(badge)).marks[CANVAS]?.seq).toBe(2);
    // And a new mark lands on the id the person answers to now.
    await mark(badge, wasAda, 5);
    expect(await daemon.desk.seenOf(ada.id)).toMatchObject({ [CANVAS]: { seq: 5 } });
  });
});
