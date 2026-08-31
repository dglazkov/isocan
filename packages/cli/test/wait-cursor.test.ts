import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PresenceSession } from "@isocan/core";
import { startDaemon, type Daemon } from "@isocan/server";
import { mintTestBadge, type TestBadge } from "./badge.ts";

/**
 * **The durable cursor** (on-demand phase 1, journey 3's plain-park half):
 * a park's place in the log survives the process. These are the phase's
 * proofs, end to end — a real CLI, killed for real:
 *
 * - a killed park resumes from its stored cursor; nothing in the gap is
 *   missed, and nobody types `--since`
 * - a wake advances the cursor only on completion — a park that dies after
 *   delivering hands the batch out again, marked `redelivered`, never as new
 * - a death after the reply but before any advance does NOT re-present the
 *   answered comment: the reply in the log is the completion evidence
 * - two readers on one actor's row: the newest adopts, the displaced park
 *   stands down (exit 3) without emitting a single entry
 *
 * The row's arithmetic is pinned at the unit in `server/test/park.test.ts`;
 * what these buy is the walk itself.
 */

const cliBin = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));
const nico = { id: "usr_nico", name: "Nico" };
const dimitri = { id: "usr_dimitri", name: "Dimitri" };

let home: string;
let daemon: Daemon;
let base: string;
let badge: TestBadge;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-cursor-"));
  await fs.writeFile(
    path.join(home, "identity.json"),
    JSON.stringify({ ...nico, createdAt: new Date().toISOString() }),
  );
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  badge = await mintTestBadge(base);
  await badge.speakAs(dimitri);
  await post("/api/ops", {
    canvasId: null,
    actor: dimitri,
    op: { type: "project.create", canvasId: "prj_1", title: "P" },
  });
});

afterEach(async () => {
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true });
});

async function post(url: string, body: unknown): Promise<any> {
  const res = await fetch(`${base}${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...badge.headers },
    body: JSON.stringify(body),
  });
  return res.json().catch(() => null);
}

function sessions(): Promise<PresenceSession[]> {
  return fetch(`${base}/api/projects/prj_1/sessions`, { headers: badge.headers }).then(
    (res) => res.json() as Promise<PresenceSession[]>,
  );
}

interface Run {
  code: number;
  stdout: string;
  stderr: string;
}

function port(): string {
  return new URL(base).port;
}

function spawnCli(...args: string[]): ChildProcess {
  return spawn(process.execPath, [cliBin, ...args], {
    env: { ...process.env, ISOCAN_HOME: home, ISOCAN_PORT: port() },
    cwd: home,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function collect(child: ChildProcess): Promise<Run> {
  let stdout = "";
  let stderr = "";
  child.stdout!.setEncoding("utf8");
  child.stdout!.on("data", (chunk) => (stdout += chunk));
  child.stderr!.setEncoding("utf8");
  child.stderr!.on("data", (chunk) => (stderr += chunk));
  return new Promise((resolve) =>
    child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr })),
  );
}

function isocan(...args: string[]): Promise<Run> {
  return collect(spawnCli(...args));
}

async function until<T>(fn: () => Promise<T>, ok: (value: T) => boolean, what: string): Promise<T> {
  const deadline = Date.now() + 10_000;
  for (;;) {
    const value = await fn();
    if (ok(value)) return value;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 50));
  }
}

const waiting = (list: PresenceSession[]) => list.filter((s) => s.status?.includes("waiting"));

const summonNico = (threadId: string, body: string) =>
  post("/api/ops", {
    canvasId: "prj_1",
    actor: dimitri,
    op: {
      type: "thread.create",
      threadId,
      x: 0,
      y: 0,
      anchorItemId: null,
      comment: { id: `cmt_${threadId}`, body, mentions: [nico.id] },
    },
  });

/** Park, wait for it to advertise, then hand control back with the child. */
async function parked(...args: string[]): Promise<{ child: ChildProcess; run: Promise<Run> }> {
  const child = spawnCli("wait", "--json", "--canvas", "prj_1", ...args);
  const run = collect(child);
  await until(sessions, (list) => waiting(list).length >= 1, "the park to advertise");
  return { child, run };
}

describe("the cursor survives the process (journey 3, the plain-park half)", () => {
  it("a park killed mid-gap resumes from its stored cursor — nothing missed, no --since", async () => {
    await isocan("session", "start", "--canvas", "prj_1");
    const { child } = await parked("--timeout", "30");

    // kill -9: no teardown, no goodbye — the cursor must not die with it.
    child.kill("SIGKILL");
    await new Promise((r) => setTimeout(r, 200));
    await summonNico("th_gap", "@Nico this landed while nobody was listening");

    const woke = await isocan("wait", "--json", "--canvas", "prj_1", "--timeout", "20");
    expect(woke.code).toBe(0);
    const payload = JSON.parse(woke.stdout);
    expect(payload.reason).toBe("summons");
    expect(payload.entries).toHaveLength(1);
    expect(payload.entries[0].envelope.op.threadId).toBe("th_gap");
    // Killed BEFORE any delivery: the comment arrives as new, unmarked.
    expect(payload.entries[0].redelivered).toBeUndefined();
  }, 30_000);

  it("a park that dies after delivering hands the batch out again — marked, never as new", async () => {
    await isocan("session", "start", "--canvas", "prj_1");
    const { run } = await parked("--timeout", "20");
    await summonNico("th_again", "@Nico are you there?");
    const first = await run;
    expect(first.code).toBe(0);
    expect(JSON.parse(first.stdout).entries[0].redelivered).toBeUndefined();

    // The process exited after delivering and no reply ever landed — to the
    // row, that IS a turn that died. The next park gets the batch again,
    // flagged, which is also the proof the wake alone advanced nothing.
    const second = await isocan("wait", "--json", "--canvas", "prj_1", "--timeout", "20");
    expect(second.code).toBe(0);
    const payload = JSON.parse(second.stdout);
    expect(payload.entries[0].envelope.op.threadId).toBe("th_again");
    expect(payload.entries[0].redelivered).toBe(true);

    // …and the marked redelivery is the last: coming back to park after it
    // settles the batch (the door's bound), so the third park sits quiet.
    const third = await isocan("wait", "--json", "--canvas", "prj_1", "--timeout", "3");
    expect(third.code).toBe(2);
  }, 40_000);

  it("a reply is completion — dying before any advance does not re-present the comment", async () => {
    await isocan("session", "start", "--canvas", "prj_1");
    const { run } = await parked("--timeout", "20");
    await summonNico("th_done", "@Nico one question");
    expect((await run).code).toBe(0);

    // The turn answers, then "dies" — no park follows, nothing advances.
    const reply = await isocan("--canvas", "prj_1", "comment", "reply", "th_done", "answered!");
    expect(reply.code).toBe(0);

    // The reply in the log is the evidence: the next park does not see the
    // answered comment again, as new or otherwise.
    const next = await isocan("wait", "--json", "--canvas", "prj_1", "--timeout", "3");
    expect(next.code).toBe(2);
  }, 40_000);
});

describe("one cursor, one reader — the newest park adopts", () => {
  it("the displaced park stands down (exit 3) without emitting; the adopter delivers", async () => {
    await isocan("session", "start", "--canvas", "prj_1");
    const older = await parked("--timeout", "30");
    // A second park as the same actor on the same canvas adopts the row.
    // Both advertise on the same session, so presence cannot say when the
    // adoption happened — the row's lease on disk can: it changes hands.
    const leaseOnDisk = async () => {
      const raw = await fs
        .readFile(path.join(home, "park-cursors.json"), "utf8")
        .catch(() => "{}");
      return (Object.values(JSON.parse(raw))[0] as { parkId?: string } | undefined)?.parkId ?? "";
    };
    const olderLease = await leaseOnDisk();
    const newer = await parked("--timeout", "30");
    await until(leaseOnDisk, (lease) => lease !== olderLease, "the newer park to adopt the row");

    await summonNico("th_two", "@Nico who answers?");

    // Both wake from the watch; only the adopter's lease survives the
    // delivery write. The displaced one says so and emits nothing.
    const displaced = await older.run;
    expect(displaced.code).toBe(3);
    expect(displaced.stderr).toContain("another park adopted");
    expect(displaced.stdout).toBe("");

    const winner = await newer.run;
    expect(winner.code).toBe(0);
    expect(JSON.parse(winner.stdout).entries[0].envelope.op.threadId).toBe("th_two");
  }, 40_000);
});
