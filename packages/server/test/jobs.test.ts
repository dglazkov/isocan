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

import { afterEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import Fastify from "fastify";
import {
  CLIENT_FEATURES_HEADER,
  CURRENT_CLIENT_FEATURES,
  JOB_PROP_KEYS,
  askTheDoor,
  bearerHeader,
  jobAbandonRoute,
  jobOf,
  jobRetryRoute,
  jobRoute,
  jobsRoute,
  newCanvasId,
  type Actor,
  type JobPollResult,
  type JobResponse,
  type JobsListResponse,
  type ServerJobRunner,
  type ServerModule,
  type StoredBadge,
} from "@isocan/core";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { registerModuleRoutes } from "../src/module-routes.ts";
import { TextModel } from "../src/text.ts";
import type { JobClock } from "../src/jobs.ts";

/**
 * **Open Stitch phase 0.2 — Home-polled async jobs stored on items.**
 *
 * Proof:
 * (a) placeholder item appears immediately with `job.state === "running"`;
 * (b) closing / reconnecting a client (zero browser polling) does NOT stop the
 *     job — the home polls across a simulated 30s and lands the finished bytes
 *     as a new version on the item with `job.state === "done"`;
 * (c) `retry` with `{ model: "alt-model" }` re-runs the stored request on the
 *     SAME item and stacks a second completed version;
 * (d) `abandon` stops polling, notifies `runner.abandon`, and marks
 *     `job.state === "abandoned"`;
 * (e) active jobs persist to `<home>/jobs.json` and resume polling after a
 *     daemon restart;
 * (f) `ServerModule.jobs` and `ServerHost.startJob` wire cleanly through
 *     `module-routes.ts`.
 */

const cleanup: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (cleanup.length > 0) {
    const fn = cleanup.pop()!;
    await fn();
  }
});

/** Deterministic virtual clock whose timers advance manually (instant, zero flakiness). */
class VirtualClock implements JobClock {
  private currentMs: number;
  private nextId = 1;
  private timers = new Map<number, { due: number; fn: () => void }>();

  constructor(startIso = "2026-11-19T12:00:00.000Z") {
    this.currentMs = Date.parse(startIso);
  }

  now = (): number => this.currentMs;

  setTimeout = (fn: () => void, ms: number): unknown => {
    const id = this.nextId++;
    this.timers.set(id, { due: this.currentMs + ms, fn });
    return id;
  };

  clearTimeout = (handle: unknown): void => {
    this.timers.delete(handle as number);
  };

  pendingCount(): number {
    return this.timers.size;
  }

  /** Advance virtual time by `ms`, firing all due timers in chronological order and awaiting `settle` after each. */
  async advance(ms: number, settle: () => Promise<void>): Promise<void> {
    const target = this.currentMs + ms;
    while (true) {
      let nextKey: number | null = null;
      let nextDue = Infinity;
      for (const [id, t] of this.timers) {
        if (t.due <= target && t.due < nextDue) {
          nextDue = t.due;
          nextKey = id;
        }
      }
      if (nextKey === null) break;
      const entry = this.timers.get(nextKey)!;
      this.timers.delete(nextKey);
      this.currentMs = entry.due;
      entry.fn();
      await settle();
    }
    this.currentMs = target;
  }
}

async function mkHome(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-jobs-test-"));
  cleanup.push(() => fs.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));
  return dir;
}

function daemonBase(d: Daemon): string {
  const addr = d.app.server.address() as AddressInfo;
  return `http://127.0.0.1:${addr.port}`;
}

async function boot(home: string, opts: Parameters<typeof startDaemon>[0] = {}): Promise<Daemon> {
  const d = await startDaemon({
    home,
    port: 0,
    contentPort: "off",
    gcIntervalMs: 0,
    blobCheckIntervalMs: 0,
    ...opts,
  });
  cleanup.push(() => d.close());
  return d;
}

function authHeaders(badge: StoredBadge, json = false): Record<string, string> {
  return {
    ...bearerHeader(badge),
    [CLIENT_FEATURES_HEADER]: CURRENT_CLIENT_FEATURES,
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
}

async function mintEditor(base: string, sessionKey = "test:acme-editor"): Promise<{ badge: StoredBadge; badgeId: string; actor: Actor }> {
  const knocked = await askTheDoor(base);
  if (!("badge" in knocked)) throw new Error(`door refused: ${knocked.refused.error}`);
  const { badge } = knocked;
  const claimRes = await fetch(`${base}/api/ops`, {
    method: "POST",
    headers: authHeaders(badge, true),
    body: JSON.stringify({
      canvasId: null,
      actor: { id: "", name: "Acme Editor" },
      op: { type: "actor.claim", sessionKey, name: "Acme Editor" },
    }),
  });
  expect(claimRes.status).toBe(200);
  const claimed = (await claimRes.json()) as { envelope: { actor: Actor } };
  return { badge, badgeId: badge.badgeId, actor: claimed.envelope.actor };
}

async function createCanvas(base: string, badge: StoredBadge, actor: Actor): Promise<string> {
  const canvasId = newCanvasId();
  const res = await fetch(`${base}/api/ops`, {
    method: "POST",
    headers: authHeaders(badge, true),
    body: JSON.stringify({
      canvasId: null,
      actor,
      op: { type: "project.create", canvasId, title: "Acme Jobs Canvas" },
    }),
  });
  expect(res.status).toBe(200);
  return canvasId;
}

describe("home-polled async jobs (Phase 0.2)", () => {
  it("adds a placeholder immediately, survives client disconnect over simulated 30s, lands as a version, and retries with another model", async () => {
    const home = await mkHome();
    const clock = new VirtualClock("2026-11-19T12:00:00.000Z");
    const startedModels: string[] = [];
    const seenRequests: unknown[] = [];
    const pollCounts = new Map<string, number>();

    const slowRunner: ServerJobRunner = {
      async start(req) {
        startedModels.push(req.model);
        seenRequests.push(req.request);
        return { externalId: `ext_${req.jobId}` };
      },
      async poll(state, host): Promise<JobPollResult> {
        const count = (pollCounts.get(state.jobId) ?? 0) + 1;
        pollCounts.set(state.jobId, count);
        const elapsed = host.now() - Date.parse(state.startedAt);
        if (elapsed < 15_000) return { done: false };
        if (elapsed < 30_000) return { done: false, progress: "50%" };
        return {
          done: true,
          bytes: new TextEncoder().encode(`Rendered by ${state.model}: ${(state.request as { prompt: string }).prompt}`),
          mimeType: "text/plain",
          filename: `acme-${state.model}.txt`,
        };
      },
    };

    const daemon = await boot(home, {
      jobs: {
        pollIntervalMs: 10_000,
        clock,
        runners: { test: slowRunner },
      },
    });
    const base = daemonBase(daemon);
    const editor = await mintEditor(base);
    const canvasId = await createCanvas(base, editor.badge, editor.actor);

    // (a) Start job — placeholder item appears immediately with job.state === "running".
    const started = await daemon.jobs.start(
      canvasId,
      editor.actor,
      {
        kind: "test",
        provider: "gemini",
        model: "veo-acme-v1",
        request: { prompt: "Acme sunrise" },
        title: "Acme Clip",
      },
      editor.badgeId,
    );
    expect(started.state).toBe("running");
    expect(started.id).toMatch(/^job_/);
    expect(started.model).toBe("veo-acme-v1");

    const snap0 = await daemon.engine.getSnapshot(canvasId);
    const placeholder = snap0.canvas.items[started.itemId]!;
    expect(placeholder).toBeDefined();
    expect(placeholder.versions).toHaveLength(1);
    expect(jobOf(placeholder)).toMatchObject({
      id: started.id,
      state: "running",
      kind: "test",
      provider: "gemini",
      model: "veo-acme-v1",
    });

    // Simulate closing the browser tab completely (no client requests or sockets at all).
    // Advance 10s -> still running, no progress yet (no redundant item.update).
    await clock.advance(10_000, () => daemon.jobs.settled());
    // Advance another 10s (total 20s) -> runner reports progress: "50%".
    await clock.advance(10_000, () => daemon.jobs.settled());
    const midSnap = await daemon.engine.getSnapshot(canvasId);
    expect(jobOf(midSnap.canvas.items[started.itemId])?.progress).toBe("50%");
    expect(jobOf(midSnap.canvas.items[started.itemId])?.state).toBe("running");

    // Advance another 10s (total 30s) -> runner completes; home lands version 2 without any client.
    await clock.advance(10_000, () => daemon.jobs.settled());

    // (b) Reconnect as a fresh request — item now has version 2 and job.state === "done".
    const listRes = await fetch(`${base}${jobsRoute(canvasId)}`, { headers: authHeaders(editor.badge) });
    expect(listRes.status).toBe(200);
    const listed = (await listRes.json()) as JobsListResponse;
    expect(listed.jobs).toHaveLength(1);
    expect(listed.jobs[0]).toMatchObject({
      id: started.id,
      itemId: started.itemId,
      state: "done",
      model: "veo-acme-v1",
      finishedAt: "2026-11-19T12:00:30.000Z",
    });

    const doneSnap = await daemon.engine.getSnapshot(canvasId);
    const doneItem = doneSnap.canvas.items[started.itemId]!;
    expect(doneItem.versions).toHaveLength(2);
    const v2 = doneItem.versions[1]!;
    expect(v2.filename).toBe("acme-veo-acme-v1.txt");
    const blobRes = await fetch(`${base}/api/projects/${canvasId}/blobs/${v2.blobHash}`, {
      headers: authHeaders(editor.badge),
    });
    expect(await blobRes.text()).toBe("Rendered by veo-acme-v1: Acme sunrise");

    // (c) Retry with { model: "alt-model" } — re-runs stored request on SAME item, stacks a 3rd version!
    const retryRes = await fetch(`${base}${jobRetryRoute(canvasId, started.id)}`, {
      method: "POST",
      headers: authHeaders(editor.badge, true),
      body: JSON.stringify({ model: "alt-model" }),
    });
    expect(retryRes.status).toBe(200);
    const retried = ((await retryRes.json()) as JobResponse).job;
    expect(retried.id).not.toBe(started.id);
    expect(retried.itemId).toBe(started.itemId);
    expect(retried.model).toBe("alt-model");
    expect(retried.state).toBe("running");

    await clock.advance(30_000, () => daemon.jobs.settled());

    const afterRetrySnap = await daemon.engine.getSnapshot(canvasId);
    const retriedItem = afterRetrySnap.canvas.items[started.itemId]!;
    expect(retriedItem.versions).toHaveLength(3);
    expect(jobOf(retriedItem)).toMatchObject({
      id: retried.id,
      state: "done",
      model: "alt-model",
    });
    const v3 = retriedItem.versions[2]!;
    const blob3 = await fetch(`${base}/api/projects/${canvasId}/blobs/${v3.blobHash}`, {
      headers: authHeaders(editor.badge),
    });
    expect(await blob3.text()).toBe("Rendered by alt-model: Acme sunrise");
    expect(startedModels).toEqual(["veo-acme-v1", "alt-model"]);
    expect(seenRequests).toEqual([{ prompt: "Acme sunrise" }, { prompt: "Acme sunrise" }]);
  });

  it("abandons an active job, stops polling, invokes runner.abandon, and blocks concurrent retry", async () => {
    const home = await mkHome();
    const clock = new VirtualClock("2026-11-19T13:00:00.000Z");
    let polls = 0;
    const abandonedIds: string[] = [];

    const runner: ServerJobRunner = {
      async start(req) {
        return { externalId: `ext_${req.jobId}` };
      },
      async poll() {
        polls++;
        return { done: false, progress: `${polls * 10}%` };
      },
      async abandon(state) {
        abandonedIds.push(state.externalId ?? state.jobId);
      },
    };

    const daemon = await boot(home, {
      jobs: { pollIntervalMs: 5_000, clock, runners: { test: runner } },
    });
    const base = daemonBase(daemon);
    const editor = await mintEditor(base);
    const canvasId = await createCanvas(base, editor.badge, editor.actor);

    const started = await daemon.jobs.start(
      canvasId,
      editor.actor,
      { kind: "test", provider: "gemini", model: "acme-m1", request: { prompt: "long run" } },
      editor.badgeId,
    );

    await clock.advance(5_000, () => daemon.jobs.settled());
    expect(polls).toBe(1);

    // Retrying while still running is refused with 409.
    const conflictRes = await fetch(`${base}${jobRetryRoute(canvasId, started.id)}`, {
      method: "POST",
      headers: authHeaders(editor.badge, true),
      body: JSON.stringify({}),
    });
    expect(conflictRes.status).toBe(409);

    // Abandon stops polling and marks item job.state === "abandoned".
    const abandonRes = await fetch(`${base}${jobAbandonRoute(canvasId, started.id)}`, {
      method: "POST",
      headers: authHeaders(editor.badge, true),
      body: JSON.stringify({}),
    });
    expect(abandonRes.status).toBe(200);
    const abandoned = ((await abandonRes.json()) as JobResponse).job;
    expect(abandoned.state).toBe("abandoned");
    expect(abandonedIds).toEqual([`ext_${started.id}`]);
    expect(clock.pendingCount()).toBe(0);

    // Advancing time produces zero further polls.
    await clock.advance(60_000, () => daemon.jobs.settled());
    expect(polls).toBe(1);

    const getRes = await fetch(`${base}${jobRoute(canvasId, started.id)}`, { headers: authHeaders(editor.badge) });
    expect(getRes.status).toBe(200);
    expect(((await getRes.json()) as JobResponse).job.state).toBe("abandoned");

    const snap = await daemon.engine.getSnapshot(canvasId);
    expect(snap.canvas.items[started.itemId]?.properties[JOB_PROP_KEYS.state]).toBe("abandoned");
  });

  it("persists active jobs to <home>/jobs.json and resumes polling after a daemon restart", async () => {
    const home = await mkHome();
    const clock1 = new VirtualClock("2026-11-19T14:00:00.000Z");
    let phase: "running" | "done" = "running";

    const runner: ServerJobRunner = {
      async start(req) {
        return { externalId: `ext_${req.jobId}` };
      },
      async poll(state) {
        if (phase === "running") return { done: false, progress: "25%" };
        return {
          done: true,
          bytes: new TextEncoder().encode(`resumed:${state.externalId}`),
          mimeType: "text/plain",
          filename: "resumed.txt",
        };
      },
    };

    const d1 = await startDaemon({
      home,
      port: 0,
      contentPort: "off",
      gcIntervalMs: 0,
      blobCheckIntervalMs: 0,
      jobs: { pollIntervalMs: 5_000, clock: clock1, runners: { test: runner } },
    });
    const base1 = daemonBase(d1);
    const editor = await mintEditor(base1);
    const canvasId = await createCanvas(base1, editor.badge, editor.actor);

    const started = await d1.jobs.start(
      canvasId,
      editor.actor,
      { kind: "test", provider: "gemini", model: "acme-v1", request: { prompt: "survive restart" } },
      editor.badgeId,
    );
    await clock1.advance(5_000, () => d1.jobs.settled());
    await d1.close();

    // jobs.json exists on disk with the active job.
    const persistedRaw = JSON.parse(await fs.readFile(path.join(home, "jobs.json"), "utf8")) as {
      jobs: Array<{ job: { id: string; state: string } }>;
    };
    expect(persistedRaw.jobs).toHaveLength(1);
    expect(persistedRaw.jobs[0]!.job.id).toBe(started.id);

    // Boot a second daemon on the same home; runner completes on the resumed poll!
    phase = "done";
    const clock2 = new VirtualClock("2026-11-19T14:00:20.000Z");
    const d2 = await boot(home, {
      jobs: { pollIntervalMs: 5_000, clock: clock2, runners: { test: runner } },
    });
    expect(clock2.pendingCount()).toBe(1);
    await clock2.advance(5_000, () => d2.jobs.settled());

    const snap = await d2.engine.getSnapshot(canvasId);
    const item = snap.canvas.items[started.itemId]!;
    expect(jobOf(item)?.state).toBe("done");
    expect(item.versions).toHaveLength(2);
  });

  it("marks job failed with plain-language error when poll fails or throws, and wires ServerModule.jobs + ServerHost.startJob", async () => {
    const home = await mkHome();
    const clock = new VirtualClock("2026-11-19T15:00:00.000Z");
    let shouldFail = true;

    const fakeModule: ServerModule = {
      name: "@isocan/acme-fake-jobs",
      jobs: {
        "acme-synth": {
          async start() {
            return { externalId: "ext_synth_1" };
          },
          async poll(state) {
            if (shouldFail) return { failed: "upstream quota exceeded" };
            return {
              done: true,
              bytes: new TextEncoder().encode(`ok:${state.model}`),
              mimeType: "text/plain",
              filename: "synth.txt",
            };
          },
        },
      },
      routes: [
        {
          method: "POST",
          path: "start",
          spend: "none",
          async handler(req, host) {
            const body = req.body as { actor: Actor; prompt: string; model: string };
            const job = await host.startJob({
              canvasId: req.canvasId,
              actor: body.actor,
              spec: {
                kind: "acme-synth",
                provider: "gemini",
                model: body.model,
                request: { prompt: body.prompt },
                title: "Acme Synth",
              },
            });
            return { status: 200, body: { job } };
          },
        },
      ],
    };

    const daemon = await boot(home, { jobs: { pollIntervalMs: 1_000, clock } });
    const base = daemonBase(daemon);
    const editor = await mintEditor(base);
    const canvasId = await createCanvas(base, editor.badge, editor.actor);

    // Mount the fake ServerModule on a small Fastify app sharing daemon's engine/store/jobs.
    const modApp = Fastify();
    cleanup.push(() => modApp.close());
    modApp.addHook("onRequest", async (req) => {
      req.badge = await daemon.desk.badge(editor.badgeId);
    });
    registerModuleRoutes(
      modApp,
      {
        engine: daemon.engine,
        store: daemon.store,
        jobs: daemon.jobs,
        workstation: daemon.workstation,
        options: {},
        textModel: new TextModel({ keysHome: null }),
        textKeysHome: null,
        userKeys: null,
        claimsOf: async () => [],
        door: async () => {},
        notTheOwners: async () => null,
        personFor: async () => null,
        keysHomeOf: () => null,
      },
      [{ module: fakeModule }],
    );

    const startRes = await modApp.inject({
      method: "POST",
      url: "/api/m/acme-fake-jobs/start",
      payload: { canvasId, actor: editor.actor, prompt: "Acme tone", model: "acme-v1" },
    });
    expect(startRes.statusCode).toBe(200);
    const started = (startRes.json() as JobResponse).job;
    expect(started.state).toBe("running");

    await clock.advance(1_000, () => daemon.jobs.settled());
    const failedJob = await daemon.jobs.get(canvasId, started.id);
    expect(failedJob?.state).toBe("failed");
    expect(failedJob?.error).toBe("upstream quota exceeded");

    // Retrying clears the error and succeeds on the same item.
    shouldFail = false;
    const retried = await daemon.jobs.retry(canvasId, started.id, editor.actor, editor.badgeId, { model: "acme-v2" });
    await clock.advance(1_000, () => daemon.jobs.settled());
    const doneJob = await daemon.jobs.get(canvasId, retried.id);
    expect(doneJob?.state).toBe("done");
    expect(doneJob?.error).toBeUndefined();
    expect(doneJob?.model).toBe("acme-v2");
  });
});
