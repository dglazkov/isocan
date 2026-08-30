import { reservePort } from "../../../test/ports.ts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type {
  CanvasSnapshotResponse,
  MentionCandidate,
  PostOpResponse,
  PresenceSession,
} from "@isocan/core";
import {
  actorsAnswerTo,
  collectCanvasActors,
  extractMentions,
  grantRoute,
  grantsRoute,
} from "@isocan/core";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

/**
 * **Scene 3 — Jordan arrives, thin.**
 *
 * "She hits the door, picks her name — *an actor is minted on arrival, never
 * provisioned by the invite* — and she is standing on the populated canvas."
 * And then the beat the journey is emphatic about: "Only now does `@Jordan`
 * resolve. Nobody could mention her before she ever arrived, and that was
 * correct."
 *
 * Everything a browser is genuinely needed for — the cursor, the toast, the
 * `@` menu opening — is played in Chrome by the conductor. What is here is the
 * half a browser proves nothing about: that a badge holding no admission is
 * admitted by the link grant and nothing else, that the invite provisioned no
 * actor for her in advance, that the canvas she lands on is the populated one,
 * and that her name becomes mentionable at exactly the moment she arrives and
 * not before.
 *
 * Fixtures are synthetic: the journey's own cast on an Acme board.
 */

const priya = { id: "usr_priya", name: "Priya" };
const CANVAS = "prj_acme";

let home: string;
let daemon: Daemon;
let base: string;
let owner: TestBadge;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-arrival-"));
  daemon = await startDaemon({ port: await reservePort(), home });
  const address = daemon.app.server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  owner = await mintTestBadge(base);
  await owner.speakAs(priya);
  await seed();
});

afterEach(async () => {
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true });
});

async function op(badge: TestBadge, body: unknown): Promise<Response> {
  return fetch(`${base}/api/ops`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...badge.headers },
    body: JSON.stringify(body),
  });
}

/** A week of Priya's work: a canvas with something on it and a thread. */
async function seed(): Promise<void> {
  const acts: unknown[] = [
    { canvasId: null, actor: priya, op: { type: "project.create", canvasId: CANVAS, title: "Acme Sprint Board" } },
    {
      canvasId: CANVAS,
      actor: priya,
      op: {
        type: "item.add",
        itemId: "itm_row",
        version: { id: "ver_1", blobHash: "hash_1", mimeType: "text/markdown", filename: "row.md", size: 4 },
        width: 100,
        height: 60,
        placement: { x: 0, y: 0 },
      },
    },
    {
      canvasId: CANVAS,
      actor: priya,
      op: {
        type: "thread.create",
        threadId: "thr_1",
        x: 10,
        y: 10,
        anchorItemId: "itm_row",
        comment: { id: "cmt_1", body: "this row wants a second look" },
      },
    },
  ];
  for (const act of acts) {
    const res = await op(owner, act);
    if (!res.ok) throw new Error(`could not seed: ${await res.text()}`);
  }
}

const get = (badge: TestBadge, url: string) => fetch(`${base}${url}`, { headers: badge.headers });

async function snapshot(badge: TestBadge): Promise<CanvasSnapshotResponse> {
  const res = await get(badge, `/api/projects/${CANVAS}/canvas`);
  if (!res.ok) throw new Error(`the canvas refused: ${res.status} ${await res.text()}`);
  return (await res.json()) as CanvasSnapshotResponse;
}

/**
 * Who a composer on this canvas could mention, computed exactly the way both
 * clients compute it: everyone the canvas remembers, plus everyone with a live
 * session, under the names they answer to now (`lib/mentions.ts` in the web
 * app, `mentionCandidates` in the CLI — both are this, over core).
 */
async function mentionable(badge: TestBadge): Promise<MentionCandidate[]> {
  const state = await snapshot(badge);
  const candidates = actorsAnswerTo(collectCanvasActors(state.canvas), state.names);
  const sessions = (await get(badge, `/api/projects/${CANVAS}/sessions`).then((r) =>
    r.json(),
  )) as PresenceSession[];
  for (const session of sessions) {
    candidates.push(session.actor);
    if (session.label) candidates.push({ id: session.actor.id, name: session.label });
  }
  return candidates;
}

describe("Scene 3 — a thin arrival", () => {
  it("cannot be mentioned before she has ever been here", async () => {
    // The journey is explicit that this is CORRECT, not a gap: "you don't
    // @-mention someone into a room they've never entered — you invite them
    // through the outside channel."
    expect(extractMentions("@Jordan take a look?", await mentionable(owner))).toEqual([]);
  });

  it("is admitted by the link grant, holding no admission of her own", async () => {
    const jordan = await mintTestBadge(base); // a browser that has been nowhere
    const res = await get(jordan, `/api/projects/${CANVAS}/canvas`);
    expect(res.status).toBe(200);

    // And the admission it just earned is rooted in the grant that gave it —
    // phase 9's sweep grips exactly this, so a mis-rooted admission here is
    // one no revocation could ever find.
    const { grants } = (await get(jordan, grantsRoute(CANVAS)).then((r) => r.json())) as {
      grants: { id: string; subject: string }[];
    };
    const admissions = (await daemon.desk.badge(jordan.badgeId))!.admissions;
    expect(admissions).toEqual([
      expect.objectContaining({
        canvasId: CANVAS,
        provenance: { root: "grant", grantId: grants[0]!.id },
      }),
    ]);
  });

  it("lands on the POPULATED canvas — items, threads, and Priya's name on them", async () => {
    const jordan = await mintTestBadge(base);
    const state = await snapshot(jordan);
    expect(Object.keys(state.canvas.items)).toEqual(["itm_row"]);
    expect(state.canvas.threads["thr_1"]!.comments[0]!.body).toBe("this row wants a second look");
    expect(state.canvas.threads["thr_1"]!.createdBy.name).toBe("Priya");
  });

  it("mints her actor at the door — the invite provisioned nothing", async () => {
    const jordan = await mintTestBadge(base);
    // Nothing exists for her yet: the link grant admits a BADGE, and says
    // nothing about who is holding it.
    const before = (await get(jordan, "/api/actors?keys=web:jordan-tab").then((r) => r.json())) as unknown[];
    expect(before).toEqual([]);

    const claimed = await op(jordan, {
      canvasId: CANVAS,
      op: { type: "actor.claim", sessionKey: "web:jordan-tab", name: "Jordan" },
    });
    expect(claimed.status).toBe(200);
    const minted = ((await claimed.json()) as PostOpResponse).envelope.actor;
    expect(minted.name).toBe("Jordan");
    // A fresh id, made here, now — not one the sharer chose for her.
    expect(minted.id).not.toBe(priya.id);
    expect(minted.id).toMatch(/^usr_/);
  });

  it("resolves as @Jordan the moment she is here, and not one beat sooner", async () => {
    const jordan = await mintTestBadge(base);
    expect(extractMentions("@Jordan take a look?", await mentionable(owner))).toEqual([]);

    const claimed = await op(jordan, {
      canvasId: CANVAS,
      op: { type: "actor.claim", sessionKey: "web:jordan-tab", name: "Jordan" },
    });
    const her = ((await claimed.json()) as PostOpResponse).envelope.actor;
    // Standing on the canvas is what makes her mentionable — a session is the
    // browser's way of saying so, and it is what the facepile draws.
    const started = await fetch(`${base}/api/projects/${CANVAS}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...jordan.headers },
      body: JSON.stringify({ actor: her }),
    });
    expect(started.status).toBe(200);

    expect(extractMentions("@Jordan take a look?", await mentionable(owner))).toEqual([her.id]);
  });

  it("is turned away when the link is off — and her name never enters the room", async () => {
    const { grants } = (await get(owner, grantsRoute(CANVAS)).then((r) => r.json())) as {
      grants: { id: string }[];
    };
    await fetch(`${base}${grantRoute(CANVAS, grants[0]!.id)}`, {
      method: "DELETE",
      headers: owner.headers,
    });

    const jordan = await mintTestBadge(base);
    const refused = await get(jordan, `/api/projects/${CANVAS}/canvas`);
    expect(refused.status).toBe(403);
    expect(((await refused.json()) as { code: string }).code).toBe("not-admitted");

    // The door's refusal is the whole story: nothing about her reached the
    // canvas, so nobody on it can name her either.
    expect(extractMentions("@Jordan take a look?", await mentionable(owner))).toEqual([]);
  });
});
