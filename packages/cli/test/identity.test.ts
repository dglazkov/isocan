import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PresenceSession, Project } from "@isocan/core";
import { startDaemon, stopDaemons, type Daemon } from "@isocan/server";
import { harnessVars } from "../src/harness.ts";

/**
 * Two parties share a machine: the person who owns it, and the agents working
 * in its sessions. The person's name lives in the isocan home; an agent names
 * itself against the session id its harness exports. Neither can overwrite
 * the other, and a rename reaches the live face either way.
 */

const cliBin = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));
const nico = { id: "usr_nico", name: "Nico" };

let home: string;
let work: string;
let daemon: Daemon;
let base: string;
let port: number;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-identity-"));
  work = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-identity-work-"));
  await fs.writeFile(
    path.join(home, "identity.json"),
    JSON.stringify({ ...nico, createdAt: new Date().toISOString() }),
  );
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  port = typeof address === "object" && address ? address.port : 0;
  base = `http://127.0.0.1:${port}`;

  await fetch(`${base}/api/ops`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId: null,
      actor: nico,
      op: { type: "project.create", projectId: "prj_1", title: "P" },
    }),
  });
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

/**
 * The CLI as some party runs it: no TTY, inside the working directory. The
 * suite itself runs under some harness or other, so every session variable is
 * cleared before the caller's are set — a bare `isocan({})` is a process no
 * harness launched, which is how the human's scripts run.
 */
function isocan(session: Record<string, string>, ...args: string[]) {
  const env: NodeJS.ProcessEnv = { ...process.env, ISOCAN_HOME: home, ISOCAN_PORT: String(port) };
  for (const v of harnessVars) delete env[v];
  Object.assign(env, session);
  const child = spawn(process.execPath, [cliBin, ...args], {
    cwd: work,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  child.stderr.on("data", (chunk) => (stderr += chunk));
  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve) =>
    child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr })),
  );
}

const claude = (id: string) => ({ CLAUDE_CODE_SESSION_ID: id });

const homeIdentity = () =>
  fs
    .readFile(path.join(home, "identity.json"), "utf8")
    .then((raw) => JSON.parse(raw) as { id: string; name: string });

function roster(): Promise<PresenceSession[]> {
  return fetch(`${base}/api/projects/prj_1/sessions`).then(
    (res) => res.json() as Promise<PresenceSession[]>,
  );
}

const projects = (): Promise<Project[]> =>
  fetch(`${base}/api/projects`).then((r) => r.json() as Promise<Project[]>);

describe("two parties, two identity slots", () => {
  it("an automated caller with no session is refused a name, not handed a slot", async () => {
    // The original bug, twice over: the machine slot made the last agent to
    // introduce itself the user; the directory slot handed its name to
    // whoever walked in next. A process nobody launched gets an error, not
    // somewhere quieter to write.
    const named = await isocan({}, "identity", "--name", "Kenny");
    expect(named.code).not.toBe(0);
    expect(named.stderr).toContain("no harness session");
    expect((await homeIdentity()).name).toBe("Nico"); // the person, untouched
    await expect(fs.access(path.join(work, ".isocan"))).rejects.toThrow(); // and no file invented
  });

  it("ops with a session are the agent's; without one they are the person's", async () => {
    await isocan(claude("s-1"), "identity", "--name", "Isaac", "--session");
    await isocan(claude("s-1"), "project", "create", "Agent Canvas");
    await isocan({}, "project", "create", "Human Canvas");

    const by = Object.fromEntries((await projects()).map((p) => [p.title, p.createdBy.name]));
    expect(by["Agent Canvas"]).toBe("Isaac");
    expect(by["Human Canvas"]).toBe("Nico");
  });

  it("--new makes you a different person instead of renaming this one", async () => {
    const before = await homeIdentity();
    await isocan({}, "identity", "--name", "Dimitri", "--home", "--new");
    const after = await homeIdentity();
    expect(after.name).toBe("Dimitri");
    expect(after.id).not.toBe(before.id); // the agent's history stays the agent's
  });
});

describe("a rename reaches the live face", () => {
  it("immediately, keeping the same actor id", async () => {
    await isocan(claude("s-1"), "identity", "--name", "Isaac", "--session");
    await isocan(claude("s-1"), "session", "start", "--project", "prj_1");
    const [live] = await roster();
    const isaac = live!.actor;
    expect(isaac.name).toBe("Isaac");

    const renamed = await isocan(
      claude("s-1"),
      "identity",
      "--name",
      "Isaac the Second",
      "--session",
    );
    expect(renamed.code).toBe(0);

    const after = await roster();
    expect(after).toHaveLength(1); // renamed, not replaced
    expect(after[0]!.actor).toEqual({ id: isaac.id, name: "Isaac the Second" });
  });

  it("or on the next command, when the file changed behind the daemon's back", async () => {
    await isocan(claude("s-1"), "identity", "--name", "Isaac", "--session");
    await isocan(claude("s-1"), "session", "start", "--project", "prj_1");
    const [live] = await roster();
    const isaac = live!.actor;

    const agentsFile = path.join(home, "agents.json");
    const registry = JSON.parse(await fs.readFile(agentsFile, "utf8")) as {
      sessions: Record<string, { name: string }>;
    };
    registry.sessions["claude-code:s-1"]!.name = "Renamed Offline";
    await fs.writeFile(agentsFile, JSON.stringify(registry));
    expect((await roster())[0]!.actor.name).toBe("Isaac");

    // Any command that narrates carries the current actor with it.
    await isocan(claude("s-1"), "ls", "--project", "prj_1");
    expect((await roster())[0]!.actor).toEqual({ id: isaac.id, name: "Renamed Offline" });
  });

  it("renaming without a session (or a daemon) still just works", async () => {
    const renamed = await isocan({}, "identity", "--name", "Solo", "--home");
    expect(renamed.code).toBe(0);
    expect(renamed.stdout).toContain("Solo");
    expect(await roster()).toEqual([]);
  });
});
