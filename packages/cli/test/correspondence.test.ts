import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { MintPassResponse, PostOpResponse, Canvas } from "@isocan/core";
import { PASS_REDEEM_ROUTE, passesRoute } from "@isocan/core";
import { startDaemon, type Daemon } from "@isocan/server";
import { harnessVars } from "../src/harness.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

/**
 * **Scene 4 — correspondence, across an internet.**
 *
 * The journey's beat 4: Jordan, thin at the home, writes a comment naming
 * Priya's agent. "The same broadcast reaches Priya's daemon, which checks its
 * parked waiters: a comment mentioning Isaac, on this canvas. `wait` returns."
 *
 * Phase 6 built the relay and phase 7 put a door in front of it, so almost
 * nothing new runs here — which is exactly why it is worth asserting. Two real
 * daemons, a real CLI parked in `isocan wait` against the replica, and a
 * stranger's badge at the home doing the writing. Everything in between is
 * production code: the home's single-writer pipeline, the replica's home
 * connection, the local oplog watch the park is blocked on.
 *
 * And beat 2, in the same shape: "Isaac does not stir: the comment names
 * Priya, and `wait` wakes only for its own name or the main thread." A relay
 * that woke every agent on every comment would pass a naive version of the
 * test above and be useless in a room with two people in it.
 *
 * Fixtures are synthetic: the journey's cast, on an Acme board.
 */

const cliBin = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));
const isaac = { id: "usr_isaac", name: "Isaac" };
const priya = { id: "usr_priya", name: "Priya" };
const CANVAS = "prj_acme";

let upstreamDir: string;
let laptopDir: string;
let work: string;
let homeDaemon: Daemon;
let laptop: Daemon;
let homeBase: string;
let owner: TestBadge;
/** A badge at the LAPTOP, for reading its own roster past the CLI. */
let local: TestBadge;

function baseOf(daemon: Daemon): string {
  const address = daemon.app.server.address();
  return `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
}

const portOf = (daemon: Daemon) => Number(new URL(baseOf(daemon)).port);

beforeEach(async () => {
  upstreamDir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-corr-home-"));
  laptopDir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-corr-laptop-"));
  work = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-corr-work-"));
  homeDaemon = await startDaemon({ port: 0, home: upstreamDir, birthHome: null });
  homeBase = baseOf(homeDaemon);

  owner = await mintTestBadge(homeBase);
  await owner.speakAs(priya);
  await atHome(owner, {
    canvasId: null,
    actor: priya,
    op: { type: "project.create", canvasId: CANVAS, title: "Acme Sprint Board" },
  });

  // Priya's machine: a replica of that home, and Isaac is who its CLI speaks
  // as (identity.json is the machine's person; here it is the agent's, which
  // is what an agent's `wait` runs under).
  await fs.writeFile(
    path.join(laptopDir, "identity.json"),
    JSON.stringify({ ...isaac, createdAt: new Date().toISOString() }),
  );
  laptop = await startDaemon({ port: 0, home: laptopDir, birthHome: homeBase, homePollMs: 50 });
  local = await mintTestBadge(baseOf(laptop));
  /**
   * **Scene 5 first, then Scene 4 — which is the order the journey puts them
   * in.**
   *
   * Until phase 8 stage 4 this line did not exist: the laptop enumerated the
   * home, the canvas's standing link grant made it visible to any badge, and
   * it replicated on its own. A replica now mirrors only what it was let into,
   * so the laptop is ENROLLED the way a second machine is actually enrolled —
   * a pass minted at the home for this canvas, redeemed through the laptop's
   * own daemon.
   *
   * That is not scaffolding around the test; it is the beat immediately before
   * the one under test. The conductor's manual play of this phase was exactly
   * this: `setup <address>#<pass>` on a second machine, then a mention typed
   * at the home waking an agent under the other roof.
   */
  const minted = await fetch(`${homeBase}${passesRoute(CANVAS)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...owner.headers },
    body: JSON.stringify({}),
  });
  if (!minted.ok) throw new Error(`minting a pass: ${await minted.text()}`);
  const { token } = (await minted.json()) as MintPassResponse;
  const redeemed = await fetch(`${baseOf(laptop)}${PASS_REDEEM_ROUTE}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...local.headers },
    body: JSON.stringify({ token }),
  });
  if (!redeemed.ok) throw new Error(`redeeming at the laptop: ${await redeemed.text()}`);
  await until(
    () => laptop.engine.listCanvases(),
    (canvases: Canvas[]) => canvases.some((p) => p.id === CANVAS),
    "the laptop to replicate the canvas",
  );
});

afterEach(async () => {
  await laptop.close();
  await homeDaemon.close();
  await Promise.allSettled(
    [upstreamDir, laptopDir, work].map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});

async function atHome(badge: TestBadge, body: unknown): Promise<PostOpResponse> {
  const res = await fetch(`${homeBase}/api/ops`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...badge.headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`the home refused: ${res.status} ${await res.text()}`);
  return (await res.json()) as PostOpResponse;
}

interface Run {
  code: number;
  stdout: string;
  stderr: string;
}

/** The real CLI on the laptop, speaking to the replica. */
function cli(...args: string[]): Promise<Run> {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ISOCAN_HOME: laptopDir,
    ISOCAN_PORT: String(portOf(laptop)),
  };
  for (const v of harnessVars) delete env[v];
  const child = spawn(process.execPath, [cliBin, ...args], { cwd: work, env, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (c) => (stdout += c));
  child.stderr.on("data", (c) => (stderr += c));
  return new Promise((resolve) =>
    child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr })),
  );
}

async function until<T>(fn: () => Promise<T>, ok: (value: T) => boolean, what: string): Promise<T> {
  const deadline = Date.now() + 15_000;
  for (;;) {
    const value = await fn().catch(() => null as T | null);
    if (value !== null && ok(value)) return value;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 25));
  }
}

/** Jordan: a badge at the home that has been nowhere, admitted by the link
 * grant, with an actor minted on arrival — Scene 3, in one function. */
async function jordanArrives(): Promise<{ badge: TestBadge; actor: { id: string; name: string } }> {
  const badge = await mintTestBadge(homeBase);
  const claimed = await atHome(badge, {
    canvasId: CANVAS,
    op: { type: "actor.claim", sessionKey: "web:jordan-tab", name: "Jordan" },
  });
  return { badge, actor: claimed.envelope.actor };
}

/** The laptop's own roster, which is where a park on the replica advertises. */
async function laptopSessions(): Promise<
  { actor: { id: string }; status: string | null; cursor: { x: number; y: number } | null }[]
> {
  const res = await fetch(`${baseOf(laptop)}/api/projects/${CANVAS}/sessions`, {
    headers: local.headers,
  });
  if (!res.ok) throw new Error(`the replica's roster refused: ${res.status}`);
  return (await res.json()) as never;
}

/** Wait for the park to advertise itself, so nothing races it. An agent with
 * no session is honestly invisible while parked, so the session comes first —
 * which is what a real agent does too (`session start`, then work, then park). */
async function parked(): Promise<void> {
  await until(laptopSessions, (list) => list.some((s) => s.status?.includes("waiting")), "the parked agent to show as waiting");
}

describe("Scene 4 — a comment at the home wakes an agent on a laptop", () => {
  it("wakes the parked agent it names, through the relay", async () => {
    expect((await cli("session", "start", "--canvas", CANVAS)).code).toBe(0);
    const run = cli("wait", "--json", "--canvas", CANVAS, "--timeout", "25");
    await parked();

    const jordan = await jordanArrives();
    await atHome(jordan.badge, {
      canvasId: CANVAS,
      actor: jordan.actor,
      op: {
        type: "thread.create",
        threadId: "thr_ask",
        x: 400,
        y: 250,
        anchorItemId: null,
        comment: {
          id: "cmt_ask",
          body: "@Isaac what happened to the row below this one?",
          mentions: [isaac.id],
        },
      },
    });

    const woke = await run;
    expect(woke.code, woke.stderr).toBe(0);
    const payload = JSON.parse(woke.stdout) as { reason: string; entries: { envelope: { op: { type: string } } }[] };
    // A summons, not a change: a person reached for this agent by name, from a
    // browser on the other side of the home.
    expect(payload.reason).toBe("summons");
    expect(payload.entries.at(-1)!.envelope.op.type).toBe("thread.create");

    // And the wake landed presence on the summoning thread, from the replica —
    // the whole point of "no `session start` needed after a wake", which is a
    // write that had to travel back up to the home to be seen there at all.
    const roster = await until(
      laptopSessions,
      (list) => list.some((s) => s.actor.id === isaac.id && s.cursor !== null),
      "the woken agent's cursor to land on the summoning thread",
    );
    expect(roster.find((s) => s.actor.id === isaac.id)!.cursor).toEqual({ x: 400, y: 250 });

    // …and the same face, relayed up to the home, is what Jordan's browser
    // draws: liveness lives within a daemon, correspondence runs between them.
    const atTheHome = await until(
      async () =>
        (await fetch(`${homeBase}/api/projects/${CANVAS}/sessions`, {
          headers: owner.headers,
        }).then((r) => r.json())) as { actor: { id: string } }[],
      (list) => list.some((s) => s.actor.id === isaac.id),
      "the agent's face to reach the home",
    );
    expect(atTheHome.some((s) => s.actor.id === isaac.id)).toBe(true);
  }, 90_000);

  it("does not stir for a comment that names somebody else", async () => {
    expect((await cli("session", "start", "--canvas", CANVAS)).code).toBe(0);
    const run = cli("wait", "--json", "--canvas", CANVAS, "--timeout", "5");
    await parked();

    const jordan = await jordanArrives();
    await atHome(jordan.badge, {
      canvasId: CANVAS,
      actor: jordan.actor,
      op: {
        type: "thread.create",
        threadId: "thr_priya",
        x: 10,
        y: 10,
        anchorItemId: null,
        comment: { id: "cmt_priya", body: "@Priya is this the right row?", mentions: [priya.id] },
      },
    });

    const slept = await run;
    // Exit 2 is the timeout: it heard the op and stayed parked, which is the
    // journey's "Isaac does not stir".
    expect(slept.code).toBe(2);
  }, 90_000);
});
