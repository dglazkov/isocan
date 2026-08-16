import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Project } from "@isocan/core";
import { startDaemon, type Daemon } from "@isocan/server";

/**
 * `isocan setup` is the whole "cd anywhere, run one thing" promise (#42): the
 * skill where every agent looks, a canvas to work on, a daemon serving it.
 * These drive the real binary — the thing a stranger's `npx` would run.
 */

const cliBin = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));
const nico = { id: "usr_nico", name: "Nico" };

let home: string;
let work: string;
let daemon: Daemon;
let port: number;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-setup-home-"));
  work = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-setup-work-"));
  await fs.writeFile(
    path.join(home, "identity.json"),
    JSON.stringify({ ...nico, createdAt: new Date().toISOString() }),
  );
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  port = typeof address === "object" && address ? address.port : 0;
});

afterEach(async () => {
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true });
  await fs.rm(work, { recursive: true, force: true });
});

function isocan(...args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  const child = spawn(process.execPath, [cliBin, ...args], {
    cwd: work,
    // --no-install: a test may not reach out and globally install anything.
    env: { ...process.env, ISOCAN_HOME: home, ISOCAN_PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  child.stderr.on("data", (chunk) => (stderr += chunk));
  return new Promise((resolve) =>
    child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr })),
  );
}

const projects = (): Promise<Project[]> =>
  fetch(`http://127.0.0.1:${port}/api/projects`).then((r) => r.json() as Promise<Project[]>);

describe("isocan setup", () => {
  it("leaves a directory ready: the skill, its doorway, and a canvas", async () => {
    const done = await isocan("setup", "--no-install", "--json");
    expect(done.code).toBe(0);

    // The skill, where the cross-agent convention says it lives.
    const skill = path.join(work, ".agents/skills/isocan-collab/SKILL.md");
    const body = await fs.readFile(skill, "utf8");
    expect(body).toMatch(/^name: isocan-collab$/m);

    // …reachable by Claude Code through a relative symlink, not a copy.
    const doorway = path.join(work, ".claude/skills/isocan-collab");
    expect((await fs.lstat(doorway)).isSymbolicLink()).toBe(true);
    expect(path.isAbsolute(await fs.readlink(doorway))).toBe(false);
    expect(await fs.realpath(doorway)).toBe(await fs.realpath(path.dirname(skill)));

    // A canvas named for the directory, and it is now the default.
    const canvas = (await projects())[0]!;
    expect(canvas.title).toBe(path.basename(work));
    const config = JSON.parse(await fs.readFile(path.join(home, "config.json"), "utf8"));
    expect(config.defaultProjectId).toBe(canvas.id);

    const report = JSON.parse(done.stdout) as Record<string, string>;
    expect(report.canvas).toContain(canvas.id);
  });

  it("is idempotent — running it again reuses the canvas and keeps the skill", async () => {
    await isocan("setup", "--no-install");
    const again = await isocan("setup", "--no-install", "--json");
    expect(again.code).toBe(0);
    const report = JSON.parse(again.stdout) as Record<string, string>;
    expect(report.skill).toContain("current");
    expect(report.canvas).toContain("reused");
    expect(await projects()).toHaveLength(1);
  });

  it("reports a skill someone has edited instead of quietly overwriting it", async () => {
    await isocan("setup", "--no-install");
    const skill = path.join(work, ".agents/skills/isocan-collab/SKILL.md");
    await fs.appendFile(skill, "\nlocal note\n");

    const second = JSON.parse((await isocan("setup", "--no-install", "--json")).stdout);
    expect(second.skill).toContain("differs");
    expect(await fs.readFile(skill, "utf8")).toContain("local note");

    const forced = JSON.parse((await isocan("setup", "--no-install", "--force", "--json")).stdout);
    expect(forced.skill).toContain("refreshed");
    expect(await fs.readFile(skill, "utf8")).not.toContain("local note");
  });

  it("--canvas names it, --no-canvas leaves the home alone", async () => {
    await isocan("setup", "--no-install", "--no-canvas");
    expect(await projects()).toEqual([]);

    await isocan("setup", "--no-install", "--canvas", "Reading Room");
    expect((await projects()).map((p) => p.title)).toEqual(["Reading Room"]);
  });
});
