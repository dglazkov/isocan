import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { CanvasSnapshotResponse, Operation, WatchLogResponse } from "@isocan/core";
import { clickFromMessage, clickOp, dispatchReason, grantsRoute, namesFor } from "@isocan/core";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

/**
 * **A prototype click, through the door** (`prototype-click.ts`). The person's
 * click lands as a comment on the item's thread and reaches the agent that
 * published the screen by the road `isocan wait` reads; an agent's own click
 * is refused, and a second press on the same control inside the window is
 * refused as the same request.
 *
 * Fixtures are synthetic: Priya clicks; Percy, a claude-code agent, published
 * the Acme prototype.
 */
const priya = { id: "usr_priya", name: "Priya" };
const percy = { id: "usr_percy", name: "Percy" };
const CANVAS = "prj_acme_proto";
const press = { type: "isocan:click", element: "home.hero.cta", label: "Get started", screen: "home" };

let home: string;
let daemon: Daemon;
let base: string;
let person: TestBadge;
let agent: TestBadge;

async function op(badge: TestBadge, actor: { id: string; name: string }, operation: Operation) {
  const res = await fetch(`${base}/api/ops`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...badge.headers },
    body: JSON.stringify({ canvasId: CANVAS, actor, op: operation }),
  });
  return { status: res.status, json: (await res.json()) as { code?: string } };
}

async function snapshot(): Promise<CanvasSnapshotResponse> {
  return (await (await fetch(`${base}/api/projects/${CANVAS}/canvas`, { headers: person.headers })).json()) as CanvasSnapshotResponse;
}

async function click(badge: TestBadge, actor: { id: string; name: string }, message: Record<string, string> = press) {
  return op(badge, actor, clickOp((await snapshot()).canvas, clickFromMessage(message, "itm_proto")!, actor.id));
}

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-click-"));
  daemon = await startDaemon({ port: 0, home, auth: null });
  const address = daemon.app.server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  person = await mintTestBadge(base);
  await person.speakAs(priya, "web:per-1");
  agent = await mintTestBadge(base);
  await agent.speakAs(percy, "claude-code:s-1");
  const made = await fetch(`${base}/api/ops`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...agent.headers },
    body: JSON.stringify({ canvasId: null, actor: percy, op: { type: "project.create", canvasId: CANVAS, title: "Acme Prototype" } }),
  });
  if (!made.ok) throw new Error(await made.text());
  await fetch(`${base}${grantsRoute(CANVAS)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...agent.headers },
    body: JSON.stringify({ subject: "link", capability: "edit" }),
  });
  const added = await op(agent, percy, {
    type: "item.add",
    itemId: "itm_proto",
    version: { id: "ver_proto", blobHash: "hash_proto", mimeType: "text/html", filename: "prototype.html", size: 10 },
    width: 400,
    height: 800,
    placement: { x: 0, y: 0 },
  });
  if (added.status !== 200) throw new Error(JSON.stringify(added.json));
});

afterEach(async () => {
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

describe("a prototype click at /api/ops", () => {
  it("lands on the item's thread and wakes the publisher's park, not the person's", async () => {
    expect((await click(person, priya)).status).toBe(200);
    const watched = (await (await fetch(`${base}/api/oplog/watch`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...agent.headers },
      body: JSON.stringify({ cursors: { [CANVAS]: 0 }, only: [CANVAS], waitMs: 1 }),
    })).json()) as WatchLogResponse;
    const entry = watched.entries.find((e) => e.envelope.op.type === "thread.create")!;
    expect(entry.envelope.actor.id).toBe(priya.id);
    expect(entry.envelope.op).toMatchObject({ anchorItemId: "itm_proto", comment: { click: { itemId: "itm_proto", element: "home.hero.cta", label: "Get started", screen: "home" } } });
    const { canvas } = await snapshot();
    expect(dispatchReason(entry.envelope.op, priya.id, { actorId: percy.id, names: namesFor(percy) }, canvas)).toBe("mentioned");
    expect(dispatchReason(entry.envelope.op, priya.id, { actorId: priya.id, names: namesFor(priya) }, canvas)).toBeNull();
  });

  it("refuses an agent's click", async () => {
    expect(await click(agent, percy)).toMatchObject({ status: 403, json: { code: "agent-click" } });
    expect(Object.keys((await snapshot()).canvas.threads)).toEqual([]);
  });

  it("refuses a second press on the same control inside the window, and takes a different one", async () => {
    expect((await click(person, priya)).status).toBe(200);
    expect(await click(person, priya)).toMatchObject({ status: 429, json: { code: "click-coalesced" } });
    expect((await click(person, priya, { ...press, element: "home.nav.pricing", label: "Pricing" })).status).toBe(200);
    const comments = Object.values((await snapshot()).canvas.threads).flatMap((t) => t.comments);
    expect(comments.map((c) => c.click?.element)).toEqual(["home.hero.cta", "home.nav.pricing"]);
  });
});
