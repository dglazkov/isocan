import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { CanvasSnapshotResponse, Operation } from "@isocan/core";
import { grantsRoute, newGroupId, SYSTEM_ACTOR } from "@isocan/core";
import { cleanupOps, cleanupSelection } from "@isocan/core/chatclean";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

/**
 * **Who may take a message out of the Chat, asked where it counts** (24 Sep
 * 2026). The reducer cannot know who owns a canvas — that is a badge's claims
 * and an admission's rung — so `/api/ops` asks, and these walk it end to end
 * over HTTP: the owner clears somebody else's words and the system voice's
 * notices; anybody else may withdraw only their own and is refused the rest
 * with `not-owner`; a bulk removal is one group and one undo restores it.
 *
 * Fixtures are synthetic: Acme, Priya who made it, Jordan who was let in.
 */

const priya = { id: "usr_priya", name: "Priya" };
const jordan = { id: "usr_jordan", name: "Jordan" };
const CANVAS = "prj_acme_chat";

let home: string;
let daemon: Daemon;
let base: string;
let owner: TestBadge;
let guest: TestBadge;

async function op(badge: TestBadge, actor: { id: string; name: string }, operation: Operation, group?: string) {
  const res = await fetch(`${base}/api/ops`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...badge.headers },
    body: JSON.stringify({ canvasId: CANVAS, actor, op: operation, ...(group ? { group } : {}) }),
  });
  return { status: res.status, json: (await res.json()) as { code?: string; error?: string } };
}

async function snapshot(): Promise<CanvasSnapshotResponse> {
  return (await (await fetch(`${base}/api/projects/${CANVAS}/canvas`, { headers: owner.headers })).json()) as CanvasSnapshotResponse;
}

const chatIds = async () => Object.values((await snapshot()).canvas.threads).find((t) => t.main)?.comments.map((c) => c.id) ?? [];

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-chatclean-"));
  daemon = await startDaemon({ port: 0, home, auth: null });
  const address = daemon.app.server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  owner = await mintTestBadge(base);
  await owner.speakAs(priya);
  const made = await fetch(`${base}/api/ops`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...owner.headers },
    body: JSON.stringify({ canvasId: null, actor: priya, op: { type: "project.create", canvasId: CANVAS, title: "Acme Launch" } }),
  });
  if (!made.ok) throw new Error(await made.text());
  await fetch(`${base}${grantsRoute(CANVAS)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...owner.headers },
    body: JSON.stringify({ subject: "link", capability: "edit" }),
  });
  guest = await mintTestBadge(base);
  await guest.speakAs(jordan);
  // The Chat: Priya, the system voice twice, Jordan.
  await op(owner, priya, { type: "thread.create", threadId: "thr_chat", anchorItemId: null, x: 0, y: 0, main: true, comment: { id: "c1", body: "Kick-off" } });
  await op(owner, SYSTEM_ACTOR, { type: "thread.reply", threadId: "thr_chat", comment: { id: "c2", body: "Scout couldn't answer — trajectory not found" } });
  await op(guest, jordan, { type: "thread.reply", threadId: "thr_chat", comment: { id: "c3", body: "Here" } });
  await op(owner, SYSTEM_ACTOR, { type: "thread.reply", threadId: "thr_chat", comment: { id: "c4", body: "Scout couldn't answer — again" } });
  await op(owner, priya, { type: "thread.reply", threadId: "thr_chat", comment: { id: "c5", body: "Thanks" } });
});

afterEach(async () => {
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

describe("removing a message from the Chat", () => {
  it("the owner removes somebody else's message", async () => {
    const res = await op(owner, priya, { type: "comment.remove", threadId: "thr_chat", commentId: "c3" });
    expect(res.status).toBe(200);
    expect(await chatIds()).toEqual(["c1", "c2", "c4", "c5"]);
  });

  it("the owner removes the system voice's notices, as one group that one undo restores in place", async () => {
    const t = Object.values((await snapshot()).canvas.threads).find((one) => one.main)!;
    const group = newGroupId();
    for (const one of cleanupOps(t, cleanupSelection(t, { kind: "system" }, priya.id, true).map((c) => c.id))) {
      expect((await op(owner, priya, one, group)).status).toBe(200);
    }
    expect(await chatIds()).toEqual(["c1", "c3", "c5"]);
    const undone = await fetch(`${base}/api/projects/${CANVAS}/undo`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...owner.headers },
      body: JSON.stringify({ actor: priya }),
    });
    expect(undone.status).toBe(200);
    expect(await chatIds()).toEqual(["c1", "c2", "c3", "c4", "c5"]);
  });

  it("anybody else is refused somebody else's message — at the home, with not-owner", async () => {
    const res = await op(guest, jordan, { type: "comment.remove", threadId: "thr_chat", commentId: "c2" });
    expect(res.status).toBe(403);
    expect(res.json.code).toBe("not-owner");
    expect(res.json.error).toMatch(/ask Priya, who owns this canvas/);
    const other = await op(guest, jordan, { type: "comment.remove", threadId: "thr_chat", commentId: "c1" });
    expect(other.status).toBe(403);
    expect(await chatIds()).toEqual(["c1", "c2", "c3", "c4", "c5"]);
  });

  it("anybody may withdraw their own", async () => {
    const res = await op(guest, jordan, { type: "comment.remove", threadId: "thr_chat", commentId: "c3" });
    expect(res.status).toBe(200);
    expect(await chatIds()).toEqual(["c1", "c2", "c4", "c5"]);
  });

  it("the last message out is refused as a comment.remove — the planner sends thread.delete instead", async () => {
    await op(owner, priya, { type: "thread.create", threadId: "thr_pin", anchorItemId: null, x: 5, y: 5, comment: { id: "p1", body: "Solo" } });
    const res = await op(owner, priya, { type: "comment.remove", threadId: "thr_pin", commentId: "p1" });
    expect(res.status).toBe(400);
    expect(res.json.code).toBe("last-comment");
  });

  it("comment.restore stays undo's alone", async () => {
    const res = await op(owner, priya, { type: "comment.restore", threadId: "thr_chat", comment: { id: "c9", author: priya, body: "x", createdAt: "2026-01-01T00:00:00.000Z" } });
    expect(res.status).toBe(400);
    expect(res.json.code).toBe("internal-op");
  });
});
