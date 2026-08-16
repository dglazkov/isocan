import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PresenceSession, Project } from "@isocan/core";
import { startDaemon, stopDaemons, type Daemon } from "@isocan/server";

/**
 * Two parties share a machine: the person who owns it, and the agents working
 * in its directories. The person's name lives in the isocan home; an agent
 * names itself in the directory it works in. Neither can overwrite the other,
 * and a rename reaches the live face either way.
 */

const cliBin = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));
const nico = { id: "usr_nico", name: "Nico" };

let home: string;
/** Every run gets its own working directory: a CLI naming itself without a
 * TTY writes into the CWD now, and tests must not name the repo they run in. */
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

/** The CLI as an agent runs it: inside the working directory, with no TTY. */
function isocan(...args: string[]) {
  return runIn(work, ...args);
}

function runIn(
  cwd: string,
  ...args: string[]
): Promise<{ code: number; stdout: string; stderr: string }> {
  const child = spawn(process.execPath, [cliBin, ...args], {
    cwd,
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

const localIdentity = () =>
  fs
    .readFile(path.join(work, ".isocan", "identity.json"), "utf8")
    .then((raw) => JSON.parse(raw) as { id: string; name: string });

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
  it("--here names the agent for a directory and leaves the human alone", async () => {
    await isocan("identity", "--name", "Isaac", "--here");

    const isaac = await localIdentity();
    expect(isaac.name).toBe("Isaac");
    expect(isaac.id).not.toBe(nico.id);
    expect((await homeIdentity()).name).toBe("Nico"); // the person, untouched

    const who = await isocan("whoami");
    expect(who.stdout).toContain("Isaac");
    expect(who.stdout).toContain("in this directory");
  });

  it("an automated caller that forgets --here still doesn't rename the human", async () => {
    // The original bug: the skill said `identity --name`, every agent ran it,
    // and the last one to introduce itself became the user. With no TTY the
    // name lands in the working directory instead.
    const named = await isocan("identity", "--name", "Kenny");
    expect(named.code).toBe(0);
    expect((await localIdentity()).name).toBe("Kenny");
    expect((await homeIdentity()).name).toBe("Nico");
    expect(named.stderr).toContain("not the machine");
  });

  it("ops from that directory are the agent's; elsewhere they are the person's", async () => {
    const elsewhere = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-elsewhere-"));
    await isocan("identity", "--name", "Isaac", "--here");
    await isocan("project", "create", "Agent Canvas");
    await runIn(elsewhere, "project", "create", "Human Canvas");

    const by = Object.fromEntries((await projects()).map((p) => [p.title, p.createdBy.name]));
    expect(by["Agent Canvas"]).toBe("Isaac");
    expect(by["Human Canvas"]).toBe("Nico");
    await fs.rm(elsewhere, { recursive: true, force: true });
  });

  it("setup speaks for nobody — it names the agent it finds and stamps nothing", async () => {
    await isocan("identity", "--name", "Isaac", "--here");
    const before = await projects();
    const report = JSON.parse(
      (await isocan("setup", "--no-install", "--no-open", "--json")).stdout,
    );

    expect(report.agent).toContain("Isaac"); // seen, named as the agent, not used
    expect(report).not.toHaveProperty("identity"); // nobody had to be someone
    expect(await projects()).toEqual(before); // and nothing was created as them
  });

  it("--new makes you a different person instead of renaming this one", async () => {
    const before = await homeIdentity();
    await isocan("identity", "--name", "Dimitri", "--home", "--new");
    const after = await homeIdentity();
    expect(after.name).toBe("Dimitri");
    expect(after.id).not.toBe(before.id); // the agent's history stays the agent's
  });
});

describe("a rename reaches the live face", () => {
  it("immediately, keeping the same actor id", async () => {
    await isocan("identity", "--name", "Isaac", "--here");
    const isaac = await localIdentity();
    await isocan("session", "start", "--project", "prj_1");
    expect((await roster())[0]!.actor).toEqual({ id: isaac.id, name: "Isaac" });

    const renamed = await isocan("identity", "--name", "Isaac the Second", "--here");
    expect(renamed.code).toBe(0);

    const live = await roster();
    expect(live).toHaveLength(1); // renamed, not replaced
    expect(live[0]!.actor).toEqual({ id: isaac.id, name: "Isaac the Second" });
  });

  it("or on the next command, when the file changed behind the daemon's back", async () => {
    await isocan("identity", "--name", "Isaac", "--here");
    await isocan("session", "start", "--project", "prj_1");
    const isaac = await localIdentity();
    await fs.writeFile(
      path.join(work, ".isocan", "identity.json"),
      JSON.stringify({ ...isaac, name: "Renamed Offline" }),
    );
    expect((await roster())[0]!.actor.name).toBe("Isaac");

    // Any command that narrates carries the current actor with it.
    await isocan("ls", "--project", "prj_1");
    expect((await roster())[0]!.actor).toEqual({ id: isaac.id, name: "Renamed Offline" });
  });

  it("renaming without a session (or a daemon) still just works", async () => {
    const renamed = await isocan("identity", "--name", "Solo", "--here");
    expect(renamed.code).toBe(0);
    expect(renamed.stdout).toContain("Solo");
    expect(await roster()).toEqual([]);
  });
});
