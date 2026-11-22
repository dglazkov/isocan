/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { Command } from "commander";
import {
  newCanvasId,
  type Actor,
  type BadgeStore,
  type JobPollResult,
  type ServerJobRunner,
  type StoredBadge,
} from "@isocan/core";
import { DaemonRoutes } from "@isocan/api";
import { startDaemon, type Daemon } from "@isocan/server/daemon";
import type { Ctx } from "../src/ctx.ts";
import { registerJobs } from "../src/jobs.ts";

/**
 * **`isocan job ls|status|cancel|retry`** (Open Stitch phase 0.2), run in-process
 * through Commander against a real `startDaemon` and `DaemonRoutes` client.
 */

function memoryBadges(): BadgeStore {
  let stored: StoredBadge | null = null;
  return {
    async read() {
      return stored;
    },
    async keep(badge) {
      stored = badge;
    },
  };
}

let home: string;
let daemon: Daemon;
let client: DaemonRoutes;
let actor: Actor;
let badgeId: string;
let canvasId: string;
let completeNow = false;

const testRunner: ServerJobRunner = {
  async start(req) {
    return { externalId: `ext_${req.jobId}` };
  },
  async poll(state): Promise<JobPollResult> {
    if (!completeNow) return { done: false, progress: "40%" };
    return {
      done: true,
      bytes: new TextEncoder().encode(`cli-output:${state.model}`),
      mimeType: "text/plain",
      filename: `${state.model}.txt`,
    };
  },
};

beforeAll(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-cli-jobs-"));
  daemon = await startDaemon({
    home,
    port: 0,
    contentPort: "off",
    gcIntervalMs: 0,
    blobCheckIntervalMs: 0,
    jobs: {
      pollIntervalMs: 60_000, // driven explicitly via daemon.jobs.tick() for determinism
      runners: { test: testRunner },
    },
  });
  const badges = memoryBadges();
  const port = (daemon.app.server.address() as AddressInfo).port;
  client = new DaemonRoutes(`http://127.0.0.1:${port}`, badges);
  const claimed = await client.sendOp(null, { id: "", name: "Acme CLI" }, {
    type: "actor.claim",
    sessionKey: "test:cli-jobs",
    name: "Acme CLI",
  });
  actor = claimed.envelope.actor;
  badgeId = (await badges.read())!.badgeId;

  canvasId = newCanvasId();
  await client.sendOp(null, actor, {
    type: "project.create",
    canvasId,
    title: "Acme CLI Jobs",
  });
});

afterAll(async () => {
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
});

async function runJobCmd(...args: string[]): Promise<{ out: string; err: string; code: number }> {
  const outputs: string[] = [];
  const errors: string[] = [];
  vi.spyOn(console, "log").mockImplementation((val) => outputs.push(String(val)));
  vi.spyOn(console, "error").mockImplementation((val) => errors.push(String(val)));

  const program = new Command().option("--json");
  registerJobs(program, async (cmd) => {
    const opts = cmd.optsWithGlobals() as { json?: boolean };
    return {
      client,
      actor,
      canvasRef: canvasId,
      json: Boolean(opts.json),
    } as unknown as Ctx;
  });
  await program.parseAsync(["node", "isocan", ...args]);
  return {
    out: outputs.join("\n"),
    err: errors.join("\n"),
    code: Number(process.exitCode ?? 0),
  };
}

describe("isocan job ls|status|cancel|retry", () => {
  it("lists, inspects, cancels, and retries jobs with --model", async () => {
    // Empty canvas lists cleanly.
    const empty = await runJobCmd("job", "ls");
    expect(empty.code, empty.err).toBe(0);
    expect(empty.out).toContain(`no jobs on ${canvasId}`);

    // Start a job on the home daemon.
    completeNow = false;
    const job1 = await daemon.jobs.start(
      canvasId,
      actor,
      { kind: "test", provider: "gemini", model: "acme-v1", request: { prompt: "Acme hero" }, title: "Acme Hero" },
      badgeId,
    );
    await daemon.jobs.tick(job1.id);

    // `isocan job ls --json` & table output
    const lsJson = await runJobCmd("job", "ls", "--json");
    expect(lsJson.code, lsJson.err).toBe(0);
    const parsedList = JSON.parse(lsJson.out) as { jobs: Array<{ id: string; state: string; progress?: string }> };
    expect(parsedList.jobs).toHaveLength(1);
    expect(parsedList.jobs[0]).toMatchObject({ id: job1.id, state: "running", progress: "40%" });

    const lsTable = await runJobCmd("job", "ls");
    expect(lsTable.code, lsTable.err).toBe(0);
    expect(lsTable.out).toContain(job1.id);
    expect(lsTable.out).toContain("running");
    expect(lsTable.out).toContain("40%");

    // `isocan job status <jobId> --json` & human output
    const statusJson = await runJobCmd("job", "status", job1.id, "--json");
    expect(statusJson.code, statusJson.err).toBe(0);
    expect(JSON.parse(statusJson.out).job).toMatchObject({ id: job1.id, model: "acme-v1", state: "running" });

    const statusHuman = await runJobCmd("job", "status", job1.id);
    expect(statusHuman.code, statusHuman.err).toBe(0);
    expect(statusHuman.out).toContain(`${job1.id}  running (40%)`);
    expect(statusHuman.out).toContain("model: acme-v1");

    // `isocan job cancel <jobId>` abandons the active job
    const cancel = await runJobCmd("job", "cancel", job1.id, "--json");
    expect(cancel.code, cancel.err).toBe(0);
    expect(JSON.parse(cancel.out).job).toMatchObject({ id: job1.id, state: "abandoned" });

    // `isocan job retry <jobId> --model alt-model` re-runs on the same item
    completeNow = true;
    const retry = await runJobCmd("job", "retry", job1.id, "--model", "alt-model", "--json");
    expect(retry.code, retry.err).toBe(0);
    const retried = JSON.parse(retry.out).job as { id: string; itemId: string; model: string; state: string };
    expect(retried.id).not.toBe(job1.id);
    expect(retried.itemId).toBe(job1.itemId);
    expect(retried.model).toBe("alt-model");
    expect(retried.state).toBe("running");

    await daemon.jobs.tick(retried.id);
    const doneStatus = await runJobCmd("job", "status", retried.id, "--json");
    expect(doneStatus.code, doneStatus.err).toBe(0);
    expect(JSON.parse(doneStatus.out).job).toMatchObject({ id: retried.id, state: "done", model: "alt-model" });
  });
});
