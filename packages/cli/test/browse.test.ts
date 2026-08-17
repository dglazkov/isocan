import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CanvasSnapshotResponse } from "@isocan/core";
import { BROWSER_MIME } from "@isocan/core";
import { startDaemon, type Daemon } from "@isocan/server";

/**
 * `isocan browse` projects a live site as an ordinary item whose blob is a
 * text/uri-list. These tests pin the contract end to end: the op is a plain
 * item.add any build understands, the blob's bytes are the normalized URL,
 * and a URL that isn't http(s) never reaches the canvas.
 */

const cliBin = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));
const nico = { id: "usr_nico", name: "Nico" };

let home: string;
let daemon: Daemon;
let base: string;
let port: number;

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
    // Not the repo root — a directory identity there would outrank the home
    // identity this test wrote. See wait.test.ts for the failure it caused.
    cwd: home,
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

function snapshot(): Promise<CanvasSnapshotResponse> {
  return fetch(`${base}/api/projects/prj_1/canvas`).then(
    (res) => res.json() as Promise<CanvasSnapshotResponse>,
  );
}

describe("isocan browse", () => {
  it("projects a bare host:port as an ordinary item.add with a uri-list blob", async () => {
    const run = await isocan("browse", "localhost:9999", "--project", "prj_1", "--at", "100,50", "--json");
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

    const blob = await fetch(`${base}/api/projects/prj_1/blobs/${version.blobHash}`);
    expect(await blob.text()).toBe("http://localhost:9999/\n");
  });

  it("refuses anything that isn't http(s), leaving the canvas untouched", async () => {
    const run = await isocan("browse", "file:///etc/passwd", "--project", "prj_1");
    expect(run.code).toBe(1);
    expect(run.stderr).toContain("only http");
    const snap = await snapshot();
    expect(Object.keys(snap.canvas.items)).toHaveLength(0);
  });
});
