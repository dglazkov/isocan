import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Project } from "@isocan/core";
import { startDaemon, stopDaemons, type Daemon } from "@isocan/server";

/**
 * `isocan setup` is the whole "cd anywhere, run one thing" promise (#42): the
 * skill where every agent looks, the CLI they run, the daemon serving the app.
 *
 * What it deliberately does NOT do is make a canvas. That would stamp one with
 * whoever typed the command — usually an agent, acting for a person who has
 * not said their name yet. The browser is where the human names themselves.
 * These drive the real binary: the thing a stranger's `npx` would run.
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
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  port = typeof address === "object" && address ? address.port : 0;
});

afterEach(async () => {
  await daemon.close();
  // The CLI restarts a daemon it finds stale, and that replacement is
  // detached: closing the handle we started is not enough to leave the
  // machine as we found it.
  await stopDaemons(port, home).catch(() => {});
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
  it("leaves the skill, its doorway, and a running app — and no canvas", async () => {
    const done = await isocan("setup", "--no-install", "--no-open", "--json");
    expect(done.code).toBe(0);

    // The skill, where the cross-agent convention says it lives.
    const skill = path.join(work, ".agents/skills/isocan-collab/SKILL.md");
    expect(await fs.readFile(skill, "utf8")).toMatch(/^name: isocan-collab$/m);

    // …reachable by Claude Code through a relative symlink, not a copy.
    const doorway = path.join(work, ".claude/skills/isocan-collab");
    expect((await fs.lstat(doorway)).isSymbolicLink()).toBe(true);
    expect(path.isAbsolute(await fs.readlink(doorway))).toBe(false);
    expect(await fs.realpath(doorway)).toBe(await fs.realpath(path.dirname(skill)));

    const report = JSON.parse(done.stdout) as Record<string, string>;
    expect(report.app).toBe(`http://127.0.0.1:${port}`);
    expect(report).not.toHaveProperty("canvas");
    expect(await projects()).toEqual([]); // the human makes that, in the app
  });

  it("needs no identity at all — nobody is named on the way through", async () => {
    const done = await isocan("setup", "--no-install", "--no-open");
    expect(done.code).toBe(0);
    expect(done.stderr).toBe("");
    // Nothing minted a name for the person who has not chosen one yet.
    await expect(fs.stat(path.join(home, "identity.json"))).rejects.toThrow();
    await expect(fs.stat(path.join(work, ".isocan"))).rejects.toThrow();
  });

  it("is idempotent — a second run reports the skill as current", async () => {
    await isocan("setup", "--no-install", "--no-open");
    const again = await isocan("setup", "--no-install", "--no-open", "--json");
    expect(again.code).toBe(0);
    expect((JSON.parse(again.stdout) as Record<string, string>).skill).toContain("current");
  });

  it("reports a skill someone has edited instead of quietly overwriting it", async () => {
    await isocan("setup", "--no-install", "--no-open");
    const skill = path.join(work, ".agents/skills/isocan-collab/SKILL.md");
    await fs.appendFile(skill, "\nlocal note\n");

    const second = JSON.parse((await isocan("setup", "--no-install", "--no-open", "--json")).stdout);
    expect(second.skill).toContain("differs");
    expect(await fs.readFile(skill, "utf8")).toContain("local note");

    const forced = JSON.parse(
      (await isocan("setup", "--no-install", "--no-open", "--force", "--json")).stdout,
    );
    expect(forced.skill).toContain("refreshed");
    expect(await fs.readFile(skill, "utf8")).not.toContain("local note");
  });

  it("a canvas made afterwards belongs to whoever made it", async () => {
    // The point of not creating one: this canvas is the person's, named by
    // them, not a directory-shaped guess owned by a passing agent.
    await isocan("setup", "--no-install", "--no-open");
    await fetch(`http://127.0.0.1:${port}/api/ops`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: null,
        actor: nico,
        op: { type: "project.create", projectId: "prj_1", title: "Reading Room" },
      }),
    });
    const [canvas] = await projects();
    expect(canvas!.createdBy.name).toBe("Nico");
  });
});
