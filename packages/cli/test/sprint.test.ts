import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startDaemon, type Daemon } from "@isocan/server";
import { harnessVars } from "@isocan/api";

/**
 * **`isocan sprint`, end to end** (docs/research/2026-09-01-design-sprint.md).
 *
 * The claims worth a daemon: a phase line posted by the verb is what the
 * verb then reads back — no store in between, the Chat is the record; the
 * clock is derived from that comment's stamp; a word that is not a phase is
 * refused before anything is posted; a hand-in is a property the tally and
 * the count both see; a vote phase hides votes and `end` clears everything.
 * The pure derivations are in core's `sprint.test.ts`; this is the wire.
 */

const cliBin = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));
const nico = { id: "usr_nico", name: "Nico" };

let home: string;
let daemon: Daemon;
let base: string;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-sprint-"));
  await fs.writeFile(
    path.join(home, "identity.json"),
    JSON.stringify({ ...nico, createdAt: new Date().toISOString() }),
  );
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});

afterEach(async () => {
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true });
});

interface Run {
  code: number;
  stdout: string;
  stderr: string;
}

function isocan(...args: string[]): Promise<Run> {
  const env = { ...process.env };
  for (const name of harnessVars) delete env[name];
  const child: ChildProcess = spawn(process.execPath, [cliBin, ...args], {
    env: { ...env, ISOCAN_HOME: home, ISOCAN_PORT: new URL(base).port },
    cwd: home,
    stdio: ["ignore", "pipe", "pipe"],
  });
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

async function state(): Promise<any> {
  const run = await isocan("sprint", "--json");
  expect(run.code, run.stderr).toBe(0);
  return JSON.parse(run.stdout);
}

describe("the sprint's clock, over the wire", () => {
  it("runs a phase, hands in, tallies, and ends — all read back from the Chat", async () => {
    // A fresh home has no canvas; this directory gets one, and every command
    // below resolves to it the way an agent's would.
    const made = await isocan("canvas", "create", "Sprint room");
    expect(made.code, made.stderr).toBe(0);
    expect((await state()).running).toBe(false);

    // A word that is not a phase is refused, and nothing is posted.
    const bogus = await isocan("sprint", "phase", "brainstorm", "10m");
    expect(bogus.code).not.toBe(0);
    expect(bogus.stderr).toContain("not a phase");
    expect((await state()).running).toBe(false);

    const called = await isocan("sprint", "phase", "crazy8s", "8m", "one idea per frame");
    expect(called.code, called.stderr).toBe(0);
    expect(called.stdout).toContain("Crazy 8s");
    expect(called.stdout).toContain("8:00");

    let s = await state();
    expect(s.running).toBe(true);
    expect(s.phase).toBe("crazy8s");
    expect(s.kind).toBe("silent");
    expect(s.note).toBe("one idea per frame");
    expect(s.facilitatorId).toBe(nico.id);
    // Timed from the comment's daemon stamp: a little under the box, never over.
    expect(s.remainingSeconds).toBeGreaterThan(460);
    expect(s.remainingSeconds).toBeLessThanOrEqual(480);
    expect(s.hidesVotes).toBe(false);
    expect(s.handedIn).toEqual([]);

    // The phase line is a comment in the Chat — the record, not a store.
    const chat = await isocan("comment", "list", "--json");
    expect(chat.stdout).toContain("/sprint crazy8s 8m one idea per frame");

    // A sketch, handed in for the running phase, then a vote on it.
    await fs.writeFile(path.join(home, "sketch.html"), "<h1>Single column</h1>");
    const added = await isocan("add", "sketch.html", "--title", "Single column");
    expect(added.code, added.stderr).toBe(0);
    const handed = await isocan("sprint", "handin", "Single column");
    expect(handed.code, handed.stderr).toBe(0);
    expect(handed.stdout).toContain("handed in for crazy8s");
    s = await state();
    expect(s.handedIn.map((i: { title: string }) => i.title)).toEqual(["Single column"]);

    const heat = await isocan("sprint", "phase", "heatmap", "5m");
    expect(heat.code, heat.stderr).toBe(0);
    expect(heat.stdout).toContain("🔴");
    s = await state();
    expect(s.phase).toBe("heatmap");
    expect(s.kind).toBe("vote");
    expect(s.mark).toBe("🔴");
    expect(s.hidesVotes).toBe(true);

    const dot = await isocan("react", "🔴", "Single column");
    expect(dot.code, dot.stderr).toBe(0);
    const tally = await isocan("sprint", "tally", "--json");
    expect(tally.code, tally.stderr).toBe(0);
    expect(JSON.parse(tally.stdout)).toMatchObject([
      { title: "Single column", humans: 1, agents: 0, actorIds: [nico.id] },
    ]);
    // The wall a heat map is about is what was handed in for the last silent
    // phase, and the tally rides on the state read too.
    s = await state();
    expect(s.tally).toMatchObject([{ title: "Single column", humans: 1, agents: 0 }]);

    // A phase with no clock runs until the next one.
    await isocan("sprint", "phase", "museum");
    s = await state();
    expect(s.phase).toBe("museum");
    expect(s.remainingSeconds).toBeNull();
    expect(s.hidesVotes).toBe(false);

    const ended = await isocan("sprint", "end", "thanks all");
    expect(ended.code, ended.stderr).toBe(0);
    expect((await state()).running).toBe(false);
    // And ending twice is refused with a reason.
    const again = await isocan("sprint", "end");
    expect(again.code).not.toBe(0);
    expect(again.stderr).toContain("no sprint is running");
  }, 60_000);
});
