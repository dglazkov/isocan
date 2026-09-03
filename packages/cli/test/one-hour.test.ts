import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startDaemon, type Daemon } from "@isocan/server";
import { harnessVars } from "@isocan/api";
import { SPRINT_BOARD } from "@isocan/core";

/**
 * **The one-hour cut, played end to end over the wire** (sprint phase 6,
 * rehearsed). Phase 6 is a run with people, which no test can be; this is
 * the closest thing the suite can hold: every verb the facilitator's skill
 * names, in the order the skill calls them, against a real daemon, with the
 * board read back left to right at the end the way Scene 6 says a finished
 * sprint reads. One actor plays every chair, which is exactly what a real
 * run must not do — and why this is a rehearsal, not the run.
 */

const cliBin = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));
const kit = { id: "usr_kit", name: "Kit" };

let home: string;
let daemon: Daemon;
let base: string;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-hour-"));
  await fs.writeFile(path.join(home, "identity.json"), JSON.stringify({ ...kit, createdAt: new Date().toISOString() }));
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
  return new Promise((resolve) => child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr })));
}

async function ok(...args: string[]): Promise<Run> {
  const run = await isocan(...args);
  expect(run.code, `${args.join(" ")}\n${run.stderr}`).toBe(0);
  return run;
}

async function json(...args: string[]): Promise<any> {
  const run = await ok(...args, "--json");
  return JSON.parse(run.stdout);
}

describe("the one-hour cut", () => {
  it("plays from /sprint to the wrap, and the board reads left to right at the end", async () => {
    // Scene 0 — the board, and the brief.
    const room = await json("canvas", "create", "Sign-up in ten seconds");
    const S = room.canvasId as string;
    const laid = await json("sprint", "board", "--canvas", S);
    expect(laid.laid.length).toBe(SPRINT_BOARD.length);
    await json("sprint", "brief", "--goal", "Signing up feels like ten seconds", "--question", "Can we skip the password?", "--decider", "Maya", "--sketcher", "Theo", "--cut", "one hour", "--canvas", S);
    expect((await json("ls", "--in", "Brief", "--canvas", S)).length).toBe(1);
    const desk = await json("sprint", "desk", "Theo", "--canvas", S);

    // Scene 1 — HMW, then the target.
    await ok("sprint", "phase", "hmw", "10m", "--canvas", S);
    expect((await json("sprint", "--canvas", S)).area.title).toBe("Experts & HMW");
    const h1 = await json("text", "HMW skip the password entirely", "--paper", "yellow", "--in", "Experts", "--canvas", S);
    await json("text", "HMW use the phone's own name", "--paper", "yellow", "--in", "Experts", "--canvas", S);
    await ok("sprint", "phase", "target", "--canvas", S);
    await ok("react", "🎯", h1.itemId, "--canvas", S);
    await ok("mv", h1.itemId, "--in", "Target", "--canvas", S);
    expect((await json("ls", "--in", "Target", "--canvas", S)).length).toBe(1);

    // Scene 2 — sketching alone on the desk, handing in at the bell.
    await ok("sprint", "phase", "sketch", "30m", "--canvas", S);
    const a = await json("text", "Sketch A: one field", "--paper", "yellow", "--canvas", desk.canvasId);
    expect((await json("ls", "--in", "Sketches", "--canvas", S)).length).toBe(0);
    await json("copy", a.itemId, "--to", S, "--in", "Sketches", "--handin", "--canvas", desk.canvasId);
    const b = await json("text", "Sketch B: magic link", "--paper", "yellow", "--in", "Sketches", "--canvas", S);
    await ok("sprint", "handin", b.itemId, "--canvas", S);
    const sketched = await json("sprint", "--canvas", S);
    expect(sketched.handedIn.length).toBe(2);
    const wall = await json("ls", "--in", "Sketches", "--canvas", S);
    const A = wall.find((one: any) => one.title.startsWith("Sketch A")).id as string;
    const B = b.itemId as string;

    // Scene 3 — the wall on the Vote sheet; heat map; poll; supervote.
    await ok("sprint", "phase", "museum", "--canvas", S);
    await ok("mv", A, "--in", "Vote", "--canvas", S);
    await ok("mv", B, "--in", "Vote", "--canvas", S);
    await ok("format", "--in", "Vote", "--canvas", S);
    await ok("sprint", "phase", "heatmap", "5m", "--canvas", S);
    await ok("react", "🔴", A, "--at", "0.3,0.3", "--canvas", S);
    await ok("react", "🔴", B, "--at", "0.7,0.7", "--canvas", S);
    const heat = await json("sprint", "--canvas", S);
    expect(heat.hidesVotes).toBe(true);
    expect(heat.tally.map((row: any) => row.id).sort()).toEqual([A, B].sort());
    const onWall = await json("ls", "--in", "Vote", "--canvas", S);
    expect(onWall.find((one: any) => one.id === A).reactionPoints["🔴"][kit.id]).toEqual({ x: 0.3, y: 0.3 });
    await ok("sprint", "phase", "poll", "2m", "--canvas", S);
    await ok("react", "⭐", A, "--canvas", S);
    await ok("sprint", "phase", "supervote", "--canvas", S);
    await ok("react", "🏆", A, "--canvas", S);
    expect((await json("sprint", "--canvas", S)).tally[0].id).toBe(A);

    // Scene 3, still — the storyboard as a row of frames, and the deck.
    await ok("sprint", "phase", "storyboard", "--canvas", S);
    await json("area", "grid", "Storyboard", "1x3", "--canvas", S);
    await ok("mv", A, "--in", "Storyboard", "--cell", "1,1", "--canvas", S);
    await json("text", "frame two: the code arrives", "--paper", "yellow", "--in", "Storyboard", "--cell", "1,2", "--canvas", S);
    await ok("slides", "add", "--in", "Storyboard", "--canvas", S);

    // Scene 5 — five people, as a grid; one note per cell.
    await ok("sprint", "phase", "test", "--canvas", S);
    await json("area", "grid", "Test", "2x3", "--rows", "Ana,Ben", "--canvas", S);
    const cell = await json("text", "found the field at once", "--paper", "yellow", "--in", "Test", "--cell", "1,1", "--canvas", S);
    await ok("react", "✅", cell.itemId, "--canvas", S);

    // Scene 6 — the wrap, the record, the end.
    await ok("sprint", "phase", "wrap", "30m", "--canvas", S);
    await ok("recap", "--canvas", S);
    await ok("sprint", "end", "--canvas", S);
    expect((await json("sprint", "--canvas", S)).running).toBe(false);

    // The board reads left to right, with every phase's outcome on its sheet.
    const sheets = await json("area", "ls", "--canvas", S);
    const holds = Object.fromEntries(sheets.map((one: any) => [one.title, Number(one.holds)]));
    expect(sheets.map((one: any) => one.title)).toEqual(SPRINT_BOARD.map((one) => one.title));
    expect(holds).toMatchObject({
      Brief: 1,
      "Experts & HMW": 1,
      Target: 1,
      Sketches: 0,
      Vote: 1,
      Storyboard: 2,
      Test: 1,
    });
    // And the desk still holds the original sketch — a hand-in was a copy.
    expect((await json("ls", "--canvas", desk.canvasId)).length).toBe(1);
    // Fifty-odd CLI spawns against one daemon: twenty-some seconds alone,
    // and past the default budget when the whole suite is loading the
    // machine — which is not a failure of the sprint.
  }, 180_000);
});
