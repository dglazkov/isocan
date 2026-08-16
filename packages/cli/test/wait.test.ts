import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PresenceSession } from "@isocan/core";
import { startDaemon, type Daemon } from "@isocan/server";

/**
 * `wait` advertises itself as parked. These tests are about the retraction:
 * a canvas must never show an agent waiting for feedback when no process is
 * listening — not after a timeout, not after a wake, and above all not after
 * a daemon too old to answer `/api/oplog/watch` killed the wait outright.
 */

const cliBin = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));
const nico = { id: "usr_nico", name: "Nico" };
const dimitri = { id: "usr_dimitri", name: "Dimitri" };

let home: string;
let daemon: Daemon;
let base: string;
/** The stale-daemon simulation: a proxy that can 404 the watch route. */
let proxy: http.Server;
let proxyPort: number;
let blockWatch = false;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-wait-"));
  await fs.writeFile(
    path.join(home, "identity.json"),
    JSON.stringify({ ...nico, createdAt: new Date().toISOString() }),
  );
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;

  blockWatch = false;
  proxy = http.createServer((req, res) => {
    if (blockWatch && req.url === "/api/oplog/watch") {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "Not Found" }));
      return;
    }
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      const body = Buffer.concat(chunks);
      const type = req.headers["content-type"];
      void fetch(`${base}${req.url}`, {
        method: req.method ?? "GET",
        ...(type ? { headers: { "content-type": type } } : {}),
        ...(body.length > 0 ? { body } : {}),
      })
        .then(async (upstream) => {
          res.writeHead(upstream.status, {
            "content-type": upstream.headers.get("content-type") ?? "application/json",
          });
          res.end(Buffer.from(await upstream.arrayBuffer()));
        })
        .catch(() => res.destroy());
    });
  });
  await new Promise<void>((resolve) => proxy.listen(0, "127.0.0.1", resolve));
  const proxyAddress = proxy.address();
  proxyPort = typeof proxyAddress === "object" && proxyAddress ? proxyAddress.port : 0;

  await post("/api/ops", {
    projectId: null,
    actor: dimitri,
    op: { type: "project.create", projectId: "prj_1", title: "P" },
  });
});

afterEach(async () => {
  proxy.closeAllConnections();
  await new Promise<void>((resolve) => proxy.close(() => resolve()));
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true });
});

async function post(url: string, body: unknown): Promise<any> {
  const res = await fetch(`${base}${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json().catch(() => null);
}

function sessions(): Promise<PresenceSession[]> {
  return fetch(`${base}/api/projects/prj_1/sessions`).then(
    (res) => res.json() as Promise<PresenceSession[]>,
  );
}

interface Run {
  code: number;
  stdout: string;
  stderr: string;
}

function isocan(...args: string[]): Promise<Run> {
  const child = spawn(process.execPath, [cliBin, ...args], {
    env: { ...process.env, ISOCAN_HOME: home, ISOCAN_PORT: String(proxyPort) },
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

/** Poll until the predicate holds, so tests never race the parked process. */
async function until<T>(
  fn: () => Promise<T>,
  ok: (value: T) => boolean,
  what: string,
): Promise<T> {
  const deadline = Date.now() + 10_000;
  for (;;) {
    const value = await fn();
    if (ok(value)) return value;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 50));
  }
}

const waiting = (list: PresenceSession[]) => list.filter((s) => s.status?.includes("waiting"));

describe("isocan wait presence", () => {
  it("never advertises when the daemon cannot watch (pinned)", async () => {
    await isocan("session", "start", "--project", "prj_1");
    blockWatch = true;

    const run = await isocan("wait", "--project", "prj_1", "--timeout", "10");

    expect(run.code).toBe(1);
    expect(run.stderr).toContain("error:");
    expect(waiting(await sessions())).toEqual([]);
  }, 30_000);

  it("never advertises when the daemon cannot watch (unpinned)", async () => {
    blockWatch = true;

    const run = await isocan("wait", "--timeout", "10");

    expect(run.code).toBe(1);
    // No on-call session either: the whole home must see nobody listening.
    expect(await sessions()).toEqual([]);
  }, 30_000);

  it("clears the status when it times out", async () => {
    await isocan("session", "start", "--project", "prj_1");

    const run = await isocan("wait", "--project", "prj_1", "--timeout", "1");

    expect(run.code).toBe(2);
    expect(run.stderr).toContain("timed out");
    const [session] = await sessions();
    expect(session?.status ?? null).toBeNull();
  }, 30_000);

  it("clears the status when it wakes", async () => {
    await isocan("session", "start", "--project", "prj_1");
    const run = isocan("wait", "--project", "prj_1", "--timeout", "20", "--all-ops");

    // It really does show as parked while it is parked…
    await until(sessions, (list) => waiting(list).length === 1, "the parked status");
    await post("/api/ops", {
      projectId: "prj_1",
      actor: dimitri,
      op: { type: "project.update", patch: { title: "P2" } },
    });

    const done = await run;
    expect(done.code).toBe(0);
    // …and not a moment longer.
    const [session] = await sessions();
    expect(session?.status ?? null).toBeNull();
  }, 30_000);

  it("ends the on-call session when it times out", async () => {
    const run = await isocan("wait", "--timeout", "1");

    expect(run.code).toBe(2);
    expect(await sessions()).toEqual([]);
  }, 30_000);
});
