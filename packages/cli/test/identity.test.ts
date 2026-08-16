import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PresenceSession } from "@isocan/core";
import { startDaemon, type Daemon } from "@isocan/server";

/**
 * Renaming yourself in the terminal has to reach the face the canvas is
 * already showing. Presence sessions are keyed by session id and snapshot
 * their actor, so without this the roster kept the old name until the session
 * expired — a canvas showing someone who no longer goes by that.
 */

const cliBin = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));
const nico = { id: "usr_nico", name: "Nico" };

let home: string;
let daemon: Daemon;
let base: string;
let port: number;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-identity-"));
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
  await fs.rm(home, { recursive: true, force: true });
});

function isocan(...args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  const child = spawn(process.execPath, [cliBin, ...args], {
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

function roster(): Promise<PresenceSession[]> {
  return fetch(`${base}/api/projects/prj_1/sessions`).then(
    (res) => res.json() as Promise<PresenceSession[]>,
  );
}

describe("isocan identity --name with a live session", () => {
  it("re-labels the live face immediately, keeping the same actor id", async () => {
    await isocan("session", "start", "--project", "prj_1");
    expect((await roster())[0]!.actor).toEqual(nico);

    const renamed = await isocan("identity", "--name", "Nico the Second");
    expect(renamed.code).toBe(0);

    const live = await roster();
    expect(live).toHaveLength(1); // renamed, not replaced
    expect(live[0]!.actor).toEqual({ id: nico.id, name: "Nico the Second" });
  });

  it("a later command re-states who is holding the session", async () => {
    await isocan("session", "start", "--project", "prj_1");
    // Rename behind the daemon's back: the file changes, nothing is pushed.
    await fs.writeFile(
      path.join(home, "identity.json"),
      JSON.stringify({ ...nico, name: "Renamed Offline", createdAt: new Date().toISOString() }),
    );
    expect((await roster())[0]!.actor.name).toBe("Nico");

    // Any command that narrates carries the current actor with it.
    await isocan("ls", "--project", "prj_1");
    expect((await roster())[0]!.actor).toEqual({ id: nico.id, name: "Renamed Offline" });
  });

  it("renaming without a session (or a daemon) still just works", async () => {
    const renamed = await isocan("identity", "--name", "Solo");
    expect(renamed.code).toBe(0);
    expect(renamed.stdout).toContain("Solo");
    expect(await roster()).toEqual([]);
  });
});
