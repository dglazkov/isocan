import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CanvasSnapshotResponse } from "@isocan/core";
import { BROWSER_MIME } from "@isocan/core";
import { startDaemon, type Daemon } from "@isocan/server";
import { mintTestBadge, type TestBadge } from "./badge.ts";

/**
 * `isocan browse` projects a live site as an ordinary item whose blob is a
 * text/uri-list. These tests pin the contract end to end: the op is a plain
 * item.add any build understands, the blob's bytes are the normalized URL,
 * and a URL that isn't http(s) never reaches the canvas.
 */

const cliBin = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));
const nico = { id: "usr_nico", name: "Nico" };
/** Whoever set the fixture canvas up — not anybody the CLI speaks as. */
const seeder = { id: "usr_seed", name: "Seed" };

let home: string;
let daemon: Daemon;
let base: string;
let port: number;
/** The CLI badges itself; a test poking the daemon directly needs its own. */
let badge: TestBadge;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-browse-"));
  await fs.writeFile(
    path.join(home, "identity.json"),
    JSON.stringify({ ...nico, createdAt: new Date().toISOString() }),
  );
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  port = typeof address === "object" && address ? address.port : 0;
  base = `http://127.0.0.1:${port}`;
  badge = await mintTestBadge(base);
  // A badge speaks only for actors it claims (mechanism 5). The seeded
  // canvas is deliberately NOT the human's: `usr_nico` is the identity the
  // CLI under test claims for itself, and one actor may be claimed by one
  // session at a time, so a fixture holding it would be a second claimant.
  await badge.speakAs(seeder);

  await fetch(`${base}/api/ops`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...badge.headers },
    body: JSON.stringify({
      canvasId: null,
      actor: seeder,
      op: { type: "project.create", canvasId: "prj_1", title: "P" },
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
    // Not the repo root — a directory identity there would outrank the home
    // identity this test wrote. See wait.test.ts for the failure it caused.
    cwd: home,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => (stdout += chunk));
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => (stderr += chunk));
  return new Promise((resolve) =>
    child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr })),
  );
}

function snapshot(): Promise<CanvasSnapshotResponse> {
  return fetch(`${base}/api/projects/prj_1/canvas`, { headers: badge.headers }).then(
    (res) => res.json() as Promise<CanvasSnapshotResponse>,
  );
}

describe("isocan browse", () => {
  it("canvases a bare host:port as an ordinary item.add with a uri-list blob", async () => {
    const run = await isocan("browse", "localhost:9999", "--canvas", "prj_1", "--at", "100,50", "--json");
    expect(run.stderr).toBe("");
    expect(run.code).toBe(0);
    const out = JSON.parse(run.stdout) as { itemId: string; url: string };
    expect(out.url).toBe("http://localhost:9999/");

    const snap = await snapshot();
    const item = snap.canvas.items[out.itemId]!;
    expect(item).toBeDefined();
    expect(item.title).toBe("localhost:9999");
    expect(item.x).toBe(100);
    expect(item.y).toBe(50);
    expect(item.width).toBe(800);
    expect(item.height).toBe(600);
    const version = item.versions[0]!;
    expect(version.mimeType).toBe(BROWSER_MIME);
    expect(version.filename).toBe("localhost-9999.uri");

    const blob = await fetch(`${base}/api/projects/prj_1/blobs/${version.blobHash}`, {
      headers: badge.headers,
    });
    expect(await blob.text()).toBe("http://localhost:9999/\n");
  });

  it("refuses anything that isn't http(s), leaving the canvas untouched", async () => {
    const run = await isocan("browse", "file:///etc/passwd", "--canvas", "prj_1");
    expect(run.code).toBe(1);
    expect(run.stderr).toContain("only http");
    const snap = await snapshot();
    expect(Object.keys(snap.canvas.items)).toHaveLength(0);
  });
});
