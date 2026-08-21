import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startDaemon, type Daemon } from "@isocan/server";
import { harnessVars } from "../src/harness.ts";

/**
 * What `isocan share` refuses to do (#69).
 *
 * The dance itself is covered in provision.test.ts, against a fake cloud.
 * These are the guards in front of it — every one of them decides BEFORE any
 * cloud call, which is what makes them testable here and what makes them
 * worth having: each protects against creating a real Google Cloud project
 * that should not exist.
 */

const cliBin = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));

let home: string;
let work: string;
let daemon: Daemon;
let port: number;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-share-home-"));
  work = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-share-work-"));
  await fs.writeFile(
    path.join(home, "identity.json"),
    JSON.stringify({ id: "usr_nico", name: "Nico", createdAt: new Date().toISOString() }),
  );
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  port = typeof address === "object" && address ? address.port : 0;
});

afterEach(async () => {
  await daemon.close();
  for (const dir of [home, work]) await fs.rm(dir, { recursive: true, force: true });
});

function cli(cwd: string, ...args: string[]): Promise<{ code: number; stderr: string }> {
  const env: NodeJS.ProcessEnv = { ...process.env, ISOCAN_HOME: home, ISOCAN_PORT: String(port) };
  for (const v of harnessVars) delete env[v];
  const child = spawn(process.execPath, [cliBin, ...args], {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (c) => (stderr += c));
  return new Promise((resolve) =>
    child.on("close", (code) => resolve({ code: code ?? 0, stderr })),
  );
}

const marker = (dir: string) =>
  fs.readFile(path.join(dir, ".isocan", "project.json"), "utf8").then(JSON.parse);

describe("isocan share, before it touches Google", () => {
  it("will not share a canvas this directory is not bound to", async () => {
    await cli(work, "project", "create", "Roadmap");
    const shared = await cli(work, "share", "--yes");
    expect(shared.code).not.toBe(0);
    expect(shared.stderr).toMatch(/not bound to it/);
    expect(shared.stderr).toMatch(/isocan use/);
  }, 30_000);

  it("will not create a cloud project for a script that did not ask twice", async () => {
    await cli(work, "project", "create", "Roadmap");
    await cli(work, "use", "Roadmap");
    // No TTY to prompt at — an agent must say --yes on purpose, because the
    // thing on the other side of this is a real Google Cloud project.
    const shared = await cli(work, "share");
    expect(shared.code).not.toBe(0);
    expect(shared.stderr).toMatch(/--yes/);
  }, 30_000);

  it("will not mint a second remote for a canvas the marker says is already shared", async () => {
    await cli(work, "project", "create", "Roadmap");
    await cli(work, "use", "Roadmap");
    const bound = await marker(work);
    // A clone of a shared canvas: the marker travels with the repo and names
    // the host's project, but THIS home has never provisioned anything.
    await fs.writeFile(
      path.join(work, ".isocan", "project.json"),
      JSON.stringify({ ...bound, remote: { kind: "firestore", firebaseProject: "isocan-theirs" } }),
    );

    const shared = await cli(work, "share", "--yes");
    expect(shared.code).not.toBe(0);
    expect(shared.stderr).toMatch(/already shared/);
    expect(shared.stderr).toMatch(/isocan-theirs/);
    // The way back in, for a host whose home lost its record.
    expect(shared.stderr).toMatch(/--firebase-project isocan-theirs/);
    // And the stanza pointing at the host is untouched.
    expect((await marker(work)).remote.firebaseProject).toBe("isocan-theirs");
  }, 30_000);
});
