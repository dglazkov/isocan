import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { CanvasSnapshotResponse, LogEntry, PresenceSession } from "@isocan/core";
import { inboxOn, namesFor } from "@isocan/core";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

/**
 * **Two actors become one person** at the single writer (`actor.join`,
 * multi-identity phase 5) — journey 6's last step, over HTTP.
 *
 * The claim check is the whole authorization: a badge that speaks for only
 * one of the two is refused with the op's own code. After a join from a badge
 * that speaks for both, every reader answers for the old id as the person —
 * names, colours, marks, presence, the inbox, undo — and the log still
 * carries the id each op was written with. The registry survives a restart,
 * because the join replays from the actors log like a colour does.
 */

const CANVAS = "prj_join";
const dimitri = { id: "usr_d1", name: "Dimitri" };
const second = { id: "usr_d2", name: "Dimitri 2" };
const stranger = { id: "usr_stranger", name: "Stranger" };
/** A teammate on the same canvas, who mentions Dimitri 2 once. */
const kenny = { id: "usr_kenny", name: "Kenny" };

let home: string;
let daemon: Daemon;
let base: string;

async function boot(): Promise<void> {
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
}

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-join-"));
  await boot();
});

afterEach(async () => {
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true });
});

const post = (badge: TestBadge, url: string, body: unknown) =>
  fetch(`${base}${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...badge.headers },
    body: JSON.stringify(body),
  });

const get = async <T>(badge: TestBadge, url: string): Promise<T> =>
  (await (await fetch(`${base}${url}`, { headers: badge.headers })).json()) as T;

const codeOf = async (res: Response) => ((await res.json()) as { code?: string }).code;

const joinOp = (from: string, into: string) => ({ type: "actor.join", from, into });

/** The laptop after journey 6 step 4: one badge that speaks for both. It
 * speaks for Kenny too, so the fixture needs no second admission: Kenny is
 * here only to write the one comment that mentions Dimitri 2. */
async function laptop(): Promise<TestBadge> {
  const badge = await mintTestBadge(base);
  await badge.speakAs(second, "web:laptop-persona-2");
  await badge.speakAs(dimitri, "web:laptop-persona-1");
  await badge.speakAs(kenny, "test:kenny");
  return badge;
}

/** A canvas with a comment from Kenny mentioning Dimitri 2, then an item
 * Dimitri 2 placed and moved, and a colour and mark each actor chose. */
async function seed(badge: TestBadge): Promise<void> {
  await post(badge, "/api/ops", {
    canvasId: null,
    actor: dimitri,
    op: { type: "project.create", canvasId: CANVAS, title: "Join" },
  });
  await post(badge, "/api/ops", {
    canvasId: CANVAS,
    actor: kenny,
    op: {
      type: "thread.create",
      threadId: "thr_1",
      x: 0,
      y: 0,
      anchorItemId: null,
      comment: { body: "can you check this?", mentions: [second.id] },
    },
  });
  await post(badge, "/api/ops", {
    canvasId: CANVAS,
    actor: second,
    op: {
      type: "item.add",
      itemId: "itm_1",
      version: { id: "ver_1", blobHash: "h", mimeType: "text/markdown", filename: "a.md", size: 1 },
      width: 10,
      height: 10,
      placement: { x: 0, y: 0 },
    },
  });
  await post(badge, "/api/ops", {
    canvasId: CANVAS,
    actor: second,
    op: { type: "item.move", itemId: "itm_1", x: 50, y: 50 },
  });
  await post(badge, "/api/ops", {
    canvasId: null,
    actor: second,
    op: { type: "actor.setColor", actorId: second.id, color: "#0f8a80" },
  });
  await post(badge, "/api/ops", {
    canvasId: null,
    actor: dimitri,
    op: { type: "actor.setColor", actorId: dimitri.id, color: "#c93a55" },
  });
  await post(badge, "/api/ops", {
    canvasId: null,
    actor: dimitri,
    op: { type: "actor.setMark", actorId: dimitri.id, mark: "🦊" },
  });
}

describe("who may send it", () => {
  it("a badge that speaks for only one of the two is refused with the op's code", async () => {
    const mine = await laptop();
    await seed(mine);
    const theirs = await mintTestBadge(base);
    await theirs.speakAs(stranger);

    // Speaking as themselves, folding Dimitri 2 into themselves: the badge
    // does not claim `from`.
    const steal = await post(theirs, "/api/ops", {
      canvasId: null,
      actor: stranger,
      op: joinOp(second.id, stranger.id),
    });
    expect(steal.status).toBe(400);
    expect(await codeOf(steal)).toBe("bad-join");
    // The other way round: the badge does not claim `into`.
    const give = await post(theirs, "/api/ops", {
      canvasId: null,
      actor: stranger,
      op: joinOp(stranger.id, dimitri.id),
    });
    expect(await codeOf(give)).toBe("bad-join");
    // Nothing was written.
    expect(await get(mine, "/api/names")).toMatchObject({ [second.id]: "Dimitri 2" });
  });

  it("the reducer's own refusals come back with their codes", async () => {
    const mine = await laptop();
    await seed(mine);
    const self = await post(mine, "/api/ops", {
      canvasId: null,
      actor: dimitri,
      op: joinOp(dimitri.id, dimitri.id),
    });
    expect(await codeOf(self)).toBe("bad-join");
    const unknown = await post(mine, "/api/ops", {
      canvasId: null,
      actor: dimitri,
      op: joinOp("usr_nobody", dimitri.id),
    });
    expect(await codeOf(unknown)).toBe("bad-join"); // the badge does not claim it either
  });
});

describe("after the join", () => {
  let mine: TestBadge;

  beforeEach(async () => {
    mine = await laptop();
    await seed(mine);
    const joined = await post(mine, "/api/ops", {
      canvasId: null,
      actor: dimitri,
      op: joinOp(second.id, dimitri.id),
    });
    expect(joined.status).toBe(200);
  });

  it("names, colours and marks resolve the old id to the person", async () => {
    expect(await get(mine, "/api/names")).toMatchObject({
      [second.id]: "Dimitri",
      [dimitri.id]: "Dimitri",
    });
    expect(await get(mine, "/api/colors")).toMatchObject({
      [second.id]: "#c93a55",
      [dimitri.id]: "#c93a55",
    });
    expect(await get(mine, "/api/marks")).toMatchObject({ [second.id]: "🦊" });
    const snapshot = await get<CanvasSnapshotResponse>(mine, `/api/projects/${CANVAS}/canvas`);
    expect(snapshot.joined).toEqual({ [second.id]: dimitri.id });
    expect(snapshot.names[second.id]).toBe("Dimitri");
  });

  it("the log still carries the id each op was written with", async () => {
    const log = await get<LogEntry[]>(mine, `/api/projects/${CANVAS}/oplog`);
    const added = log.find((entry) => entry.envelope.op.type === "item.add")!;
    expect(added.envelope.actor).toEqual(second);
    const snapshot = await get<CanvasSnapshotResponse>(mine, `/api/projects/${CANVAS}/canvas`);
    expect(snapshot.canvas.items["itm_1"]!.createdBy).toEqual(second);
  });

  it("a cycle is refused once the first join stands", async () => {
    const back = await post(mine, "/api/ops", {
      canvasId: null,
      actor: dimitri,
      op: joinOp(dimitri.id, second.id),
    });
    expect(await codeOf(back)).toBe("bad-join");
  });

  it("Dimitri's undo reaches the op Dimitri 2 wrote", async () => {
    // Dimitri himself has written nothing on this canvas: without the join
    // there would be nothing to undo, and the daemon says so.
    const undone = await post(mine, `/api/projects/${CANVAS}/undo`, { actor: dimitri });
    expect(undone.status).toBe(200);
    const snapshot = await get<CanvasSnapshotResponse>(mine, `/api/projects/${CANVAS}/canvas`);
    // The move (50,50) is reversed; the item is back where it was added.
    expect(snapshot.canvas.items["itm_1"]).toMatchObject({ x: 0, y: 0 });
    // A second undo reaches the add itself; Kenny's thread is not his to undo.
    expect((await post(mine, `/api/projects/${CANVAS}/undo`, { actor: dimitri })).status).toBe(200);
    const again = await get<CanvasSnapshotResponse>(mine, `/api/projects/${CANVAS}/canvas`);
    expect(again.canvas.items["itm_1"]).toBeUndefined();
    expect(again.canvas.threads["thr_1"]).toBeDefined();
    expect((await post(mine, `/api/projects/${CANVAS}/undo`, { actor: dimitri })).status).not.toBe(200);
  });

  it("a comment mentioning Dimitri 2 is in Dimitri's inbox", async () => {
    const snapshot = await get<CanvasSnapshotResponse>(mine, `/api/projects/${CANVAS}/canvas`);
    const entries = inboxOn(
      snapshot.canvas,
      dimitri,
      namesFor(dimitri),
      CANVAS,
      "Join",
      snapshot.joined,
    );
    expect(entries.map((e) => [e.threadId, e.reason])).toEqual([["thr_1", "mentioned"]]);
  });

  it("a session still beating as Dimitri 2 is listed as Dimitri", async () => {
    const started = await post(mine, `/api/projects/${CANVAS}/sessions`, { actor: second });
    expect(started.status).toBe(200);
    const sessions = await get<PresenceSession[]>(mine, `/api/projects/${CANVAS}/sessions`);
    expect(sessions.map((s) => s.actor)).toEqual([dimitri]);
  });

  it("the released name may be claimed by somebody new", async () => {
    const theirs = await mintTestBadge(base);
    const claimed = await post(theirs, "/api/ops", {
      canvasId: null,
      op: { type: "actor.claim", sessionKey: "codex:s-new", name: "Dimitri 2" },
    });
    expect(claimed.status).toBe(200);
    const { envelope } = (await claimed.json()) as { envelope: { actor: { id: string } } };
    expect(envelope.actor.id).not.toBe(second.id); // a new actor, not the folded one
  });

  it("survives a restart: the join replays from the actors log", async () => {
    await daemon.close();
    await boot();
    // The badge outlives the process — the desk is on disk — so the same
    // headers ask the reborn daemon.
    expect(await get(mine, "/api/names")).toMatchObject({ [second.id]: "Dimitri" });
    const snapshot = await get<CanvasSnapshotResponse>(mine, `/api/projects/${CANVAS}/canvas`);
    expect(snapshot.joined).toEqual({ [second.id]: dimitri.id });
    // And the file the registry is saved to carries it whole.
    const saved = JSON.parse(await fs.readFile(path.join(home, "actors.json"), "utf8")) as {
      joined?: Record<string, string>;
    };
    expect(saved.joined).toEqual({ [second.id]: dimitri.id });
  });
});
