import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { BEYOND_CEILING, newCanvasId, newCommentId, newItemId, newThreadId, newVersionId, type Actor, type Operation } from "@isocan/core";
import type { Daemon } from "@isocan/server";
import { startDaemon } from "@isocan/server/daemon";
import { ApiError, DaemonClient } from "@isocan/api";

/**
 * **A critic's ceiling, held by the home** (critique phase 2). An enrolled
 * critic's row carries `ceiling: note`; every op it sends straight to the
 * daemon — no CLI in the way, `DaemonClient.sendOp` — is refused with
 * `beyond-ceiling` unless it is a note on an item, a reply or a reaction,
 * and nothing is written. It cannot lift its own ceiling; the person who set
 * it can, and withdrawing the critic does. And it holds at the HOME for an op
 * a replica forwards, because the replica does not apply ops — the home does.
 *
 * Two daemons in one process, for `home-link.test.ts`'s reason: the thing
 * under test is what the home says to an op that arrives by forward.
 * Synthetic throughout.
 */

interface Rig {
  daemons: Daemon[];
  dirs: string[];
}
let rig: Rig;

const baseOf = (daemon: Daemon) => {
  const address = daemon.app.server.address();
  return `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
};

async function dir(tag: string): Promise<string> {
  const d = await fs.mkdtemp(path.join(os.tmpdir(), `isocan-ceiling-${tag}-`));
  rig.dirs.push(d);
  return d;
}

beforeEach(() => {
  rig = { daemons: [], dirs: [] };
});

afterEach(async () => {
  // Replicas first, then the home they dial.
  for (const d of [...rig.daemons].reverse()) await d.close().catch(() => {});
  await Promise.all(rig.dirs.map((d) => fs.rm(d, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })));
});

/**
 * One machine's badge with two actors on it — a person and the critic they
 * enrolled — the way an agent rides its machine's badge (agent-custody).
 * The person makes a canvas with one screen, enrols the critic, and caps it.
 */
async function machine(base: string, cap = true) {
  const client = new DaemonClient(base, await dir("client"));
  const ada: Actor = (await client.claimActor({ type: "actor.claim", sessionKey: "web:acme-ada", name: "Ada" })).envelope.actor;
  const critic: Actor = (await client.claimActor({ type: "actor.claim", sessionKey: "codex:acme-critic", name: "Quiet Hands" })).envelope.actor;
  const canvasId = newCanvasId();
  await client.sendOp(null, ada, { type: "project.create", canvasId, title: "Acme" });
  const upload = await client.uploadBlob(canvasId, Buffer.from("<main>Acme checkout</main>", "utf8"), "text/html", "checkout.html");
  const screen = newItemId();
  await client.sendOp(canvasId, ada, {
    type: "item.add",
    itemId: screen,
    version: { id: newVersionId(), blobHash: upload.blobHash, mimeType: "text/html", filename: "checkout.html", size: upload.size },
    width: 400,
    height: 800,
    placement: { x: 0, y: 0 },
    title: "Acme checkout",
  } as Operation);
  await client.sendOp(canvasId, ada, { type: "agent.enroll", agent: critic });
  if (cap) await client.sendOp(canvasId, ada, { type: "agent.ceiling", actorId: critic.id, ceiling: "note" });
  return { client, ada, critic, canvasId, screen, blobHash: upload.blobHash, size: upload.size };
}

type Machine = Awaited<ReturnType<typeof machine>>;

const lastSeq = async (m: Machine) => (await m.client.snapshot(m.canvasId)).lastSeq;

/** The refusal an op meets, or null when it lands. */
async function refusal(m: Machine, actor: Actor, op: Operation): Promise<ApiError | null> {
  try {
    await m.client.sendOp(m.canvasId, actor, op);
    return null;
  } catch (err) {
    if (err instanceof ApiError) return err;
    throw err;
  }
}

const edit = (m: Machine): Operation => ({
  type: "item.addVersion",
  itemId: m.screen,
  version: { id: newVersionId(), blobHash: m.blobHash, mimeType: "text/html", filename: "checkout.html", size: m.size },
} as Operation);

const note = (m: Machine): Operation => ({
  type: "thread.create",
  threadId: newThreadId(),
  x: 248,
  y: 648,
  anchorItemId: m.screen,
  comment: { id: newCommentId(), body: "**Risk** · question 2 — What could go?\n\nTwo filled buttons compete. Keep Pay." },
} as Operation);

describe("a critic's ceiling, sent straight to the daemon", () => {
  it("refuses every edit with beyond-ceiling and writes nothing; notes, replies and reactions land", async () => {
    const home = await startDaemon({ port: 0, home: await dir("home") });
    rig.daemons.push(home);
    const m = await machine(baseOf(home));
    const before = await lastSeq(m);
    const refusedOps: Operation[] = [
      edit(m),
      { type: "item.move", itemId: m.screen, x: 40, y: 40 },
      { type: "project.update", patch: { title: "Acme, critiqued" } },
      { type: "item.update", itemId: m.screen, patch: { title: "Fixed checkout" } } as Operation,
      // A thread pinned to no item is not a note on a screen.
      { ...note(m), anchorItemId: null, x: 900, y: 900 } as Operation,
    ];
    for (const op of refusedOps) {
      const err = await refusal(m, m.critic, op);
      expect(err?.code, op.type).toBe(BEYOND_CEILING);
      expect(err?.message).toMatch(/^Quiet Hands is a critic on this canvas: it may pin notes on items, reply in threads and react, and nothing else/);
      expect(err?.message).toMatch(/nothing was written\. Ada can lift that with `isocan critic release Quiet Hands`\.$/);
    }
    expect(await lastSeq(m)).toBe(before);
    expect(Object.keys((await m.client.snapshot(m.canvasId)).canvas.items)).toEqual([m.screen]);

    const pinned = note(m) as Extract<Operation, { type: "thread.create" }>;
    expect(await refusal(m, m.critic, pinned)).toBeNull();
    expect(await refusal(m, m.critic, { type: "thread.reply", threadId: pinned.threadId, comment: { id: newCommentId(), body: "Done — 1 note." } })).toBeNull();
    expect(await refusal(m, m.critic, { type: "item.react", itemId: m.screen, emoji: "👀", on: true, at: { x: 0.6, y: 0.8 } })).toBeNull();
    expect(await refusal(m, m.critic, { type: "item.react", itemId: m.screen, emoji: "👍", on: true })).toBeNull();
    expect(await lastSeq(m)).toBe(before + 4);
    // The person on the same badge is not capped: the ceiling is the critic's.
    expect(await refusal(m, m.ada, edit(m))).toBeNull();
  });

  it("cannot be lifted by the critic, by its own op or its undo; the person who set it lifts it, and the agent edits again", async () => {
    const home = await startDaemon({ port: 0, home: await dir("home") });
    rig.daemons.push(home);
    const m = await machine(baseOf(home));
    await m.client.sendOp(m.canvasId, m.critic, note(m));
    const before = await lastSeq(m);
    const lift = await refusal(m, m.critic, { type: "agent.ceiling", actorId: m.critic.id, ceiling: null });
    expect(lift?.code).toBe(BEYOND_CEILING);
    // Nor by stepping out of its standing, nor by re-enrolling itself bare.
    expect((await refusal(m, m.critic, { type: "agent.withdraw", actorId: m.critic.id }))?.code).toBe(BEYOND_CEILING);
    expect((await refusal(m, m.critic, { type: "agent.enroll", agent: m.critic }))?.code).toBe(BEYOND_CEILING);
    // Its undo would remove its own note: an op it may not write.
    await expect(m.client.undo(m.canvasId, m.critic)).rejects.toMatchObject({ code: BEYOND_CEILING });
    expect(await lastSeq(m)).toBe(before);
    expect((await m.client.snapshot(m.canvasId)).canvas.agents?.[m.critic.id]).toMatchObject({ ceiling: "note", ceilingBy: { id: m.ada.id } });

    // A re-enrolment by the person keeps it: only release and withdraw lift.
    await m.client.sendOp(m.canvasId, m.ada, { type: "agent.enroll", agent: m.critic });
    expect((await m.client.snapshot(m.canvasId)).canvas.agents?.[m.critic.id]?.ceiling).toBe("note");
    expect((await refusal(m, m.critic, edit(m)))?.code).toBe(BEYOND_CEILING);

    await m.client.sendOp(m.canvasId, m.ada, { type: "agent.ceiling", actorId: m.critic.id, ceiling: null });
    expect((await m.client.snapshot(m.canvasId)).canvas.agents?.[m.critic.id]?.ceiling).toBeUndefined();
    expect(await refusal(m, m.critic, edit(m))).toBeNull();
  });

  it("goes with the row on withdraw, so the same agent enrolled again (not as a critic) can edit", async () => {
    const home = await startDaemon({ port: 0, home: await dir("home") });
    rig.daemons.push(home);
    const m = await machine(baseOf(home));
    expect((await refusal(m, m.critic, edit(m)))?.code).toBe(BEYOND_CEILING);
    await m.client.sendOp(m.canvasId, m.ada, { type: "agent.withdraw", actorId: m.critic.id });
    await m.client.sendOp(m.canvasId, m.ada, { type: "agent.enroll", agent: m.critic });
    expect((await m.client.snapshot(m.canvasId)).canvas.agents?.[m.critic.id]?.ceiling).toBeUndefined();
    expect(await refusal(m, m.critic, edit(m))).toBeNull();
  });

  it("an enrolment that is not a critic's carries no ceiling", async () => {
    const home = await startDaemon({ port: 0, home: await dir("home") });
    rig.daemons.push(home);
    const m = await machine(baseOf(home), false);
    expect(await refusal(m, m.critic, edit(m))).toBeNull();
  });
});

describe("a critic's ceiling, at the home, for an op a replica forwards", () => {
  it("is refused by the home with the home's code and sentence, and neither log moves", async () => {
    const homeDir = await dir("home");
    const home = await startDaemon({ port: 0, home: homeDir });
    rig.daemons.push(home);
    // A replica: every canvas it makes is born at the home, and every write
    // to one is forwarded there — it applies nothing of its own.
    const replica = await startDaemon({ port: 0, home: await dir("replica"), birthHome: baseOf(home), homePollMs: 50 });
    rig.daemons.push(replica);
    const m = await machine(baseOf(replica));
    // The canvas lives at the home: the home holds the row that decides.
    const homeView = await home.engine.getSnapshot(m.canvasId);
    expect(homeView.canvas.agents?.[m.critic.id]?.ceiling).toBe("note");
    const homeBefore = homeView.lastSeq;
    const replicaBefore = await lastSeq(m);

    const err = await refusal(m, m.critic, edit(m));
    expect(err?.code).toBe(BEYOND_CEILING);
    expect(err?.message).toMatch(/^Quiet Hands is a critic on this canvas/);
    expect((await home.engine.getSnapshot(m.canvasId)).lastSeq).toBe(homeBefore);
    expect(await lastSeq(m)).toBe(replicaBefore);

    // Its note still goes the whole way.
    await m.client.sendOp(m.canvasId, m.critic, note(m));
    expect((await home.engine.getSnapshot(m.canvasId)).lastSeq).toBe(homeBefore + 1);
  });
});
