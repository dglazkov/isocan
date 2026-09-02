import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

/**
 * **A canvas can move home** (`docs/research/2026-09-01-teleport.md`).
 *
 * The log IS the canvas: the snapshot is what you get by folding it, and the
 * reducer is deterministic, so a home holding the same entries holds the same
 * canvas. Teleport is therefore a replay rather than a migration — and the
 * entries go VERBATIM, which is the part these tests are really about.
 */
const dion = { id: "usr_dion", name: "Dion" };
const CANVAS = "prj_moving";

let hereDir: string;
let thereDir: string;
let here: Daemon;
let there: Daemon;
let badge: TestBadge;

const baseOf = (d: Daemon) => {
  const a = d.app.server.address();
  return `http://127.0.0.1:${typeof a === "object" && a ? a.port : 0}`;
};

const post = (b: TestBadge, base: string, url: string, body: unknown) =>
  fetch(`${base}${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...b.headers },
    body: JSON.stringify(body),
  });

beforeEach(async () => {
  hereDir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-tp-here-"));
  thereDir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-tp-there-"));
  there = await startDaemon({ port: 0, home: thereDir });
  here = await startDaemon({ port: 0, home: hereDir, homePollMs: 50 });
  badge = await mintTestBadge(baseOf(here));
  await badge.speakAs(dion);
  const made = await post(badge, baseOf(here), "/api/ops", {
    canvasId: null,
    actor: dion,
    op: { type: "project.create", canvasId: CANVAS, title: "Moving Day" },
  });
  expect(made.status, await made.text()).toBe(200);
});

afterEach(async () => {
  await here?.close();
  await there?.close();
  await Promise.allSettled(
    [hereDir, thereDir].map((d) => fs.rm(d, { recursive: true, force: true })),
  );
});

const teleport = async (to: string, dryRun: boolean) => {
  const res = await post(badge, baseOf(here), `/api/projects/${CANVAS}/teleport`, { to, dryRun });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
};

describe("teleport", () => {
  it("says what would move, and moves nothing", async () => {
    const before = (await here.store.load(CANVAS))!.entries;
    const dry = await teleport(baseOf(there), true);
    expect(dry.body.moved).toBe(false);
    expect(dry.body.entries).toBe(before.length);
    // The far home has not heard of it, and this one still owns it.
    expect(await there.store.canvasExists(CANVAS)).toBe(false);
    expect(((await here.store.load(CANVAS))!.entries).length).toBe(before.length);
  });

  it("moves the canvas, and the far home folds the same state", async () => {
    await post(badge, baseOf(here), "/api/ops", {
      canvasId: CANVAS,
      actor: dion,
      op: { type: "project.update", patch: { description: "packed" } },
    });
    const mine = (await here.store.load(CANVAS))!.entries;

    const moved = await teleport(baseOf(there), false);
    expect(moved.status, JSON.stringify(moved.body)).toBe(200);
    expect(moved.body.moved).toBe(true);

    const theirs = (await there.store.load(CANVAS))!.entries;
    expect(theirs.map((e) => e.seq)).toEqual(mine.map((e) => e.seq));
  });

  it("keeps the timestamps, which a replay through the write path would not", async () => {
    /**
     * The reason `adopt` exists rather than a loop over `submitOp`.
     * `PostOpRequest` carries no `ts` — deliberately, since a client that
     * stamps its own time is a client that can lie about when something
     * happened — so a canvas replayed the ordinary way arrives correctly
     * ordered and entirely re-dated: every comment, every version, every
     * item stamped at the moment of the move.
     */
    const mine = (await here.store.load(CANVAS))!.entries;
    await teleport(baseOf(there), false);
    const theirs = (await there.store.load(CANVAS))!.entries;
    expect(theirs.map((e) => e.envelope.ts)).toEqual(mine.map((e) => e.envelope.ts));
  });

  it("keeps the adopt route behind the door, like every other canvas write", async () => {
    /**
     * A route that writes a whole log verbatim is the widest surface this
     * feature adds, so what guards it matters more than what it does. It is
     * canvas-scoped, so the door guards it: a badge with no way into this
     * canvas is refused before `adopt` is reached at all.
     */
    const mine = (await here.store.load(CANVAS))!.entries;
    await teleport(baseOf(there), false);
    const stranger = await mintTestBadge(baseOf(there));
    await stranger.speakAs({ id: "usr_nobody", name: "Nobody" });
    const tried = await post(stranger, baseOf(there), `/api/projects/${CANVAS}/adopt`, {
      entries: mine,
    });
    expect((await tried.json() as { code?: string }).code).toBe("not-admitted");
  });

  it("creates, and never merges into a canvas that is already here", async () => {
    // Asked of the engine directly, because the door refuses first and this
    // is a fact about `adopt` rather than about admission. Merging two orders
    // is the thing the research argues is a different product.
    const mine = (await here.store.load(CANVAS))!.entries;
    await expect(here.engine.adopt(CANVAS, mine)).rejects.toThrow(/already here/);
  });

  it("refuses to send a canvas this daemon does not home", async () => {
    // Only a home can send one. A replica forwarding somebody else's canvas
    // would be moving a thing it does not hold.
    await teleport(baseOf(there), false);
    const relay = await teleport(baseOf(there), false);
    expect(JSON.stringify(relay.body)).toContain("not homed here");
  });
});
