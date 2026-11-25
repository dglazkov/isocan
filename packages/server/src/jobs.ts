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

import { promises as fs } from "node:fs";
import path from "node:path";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  JOB_PROP_KEYS,
  JOB_ROUTES,
  canRetryJob,
  isActiveJob,
  jobClearKeys,
  jobOf,
  jobProperties,
  newGroupId,
  newItemId,
  newJobId,
  newVersionId,
  type Actor,
  type ItemJob,
  type JobAbandonRequest,
  type JobArtifact,
  type JobHost,
  type JobPollState,
  type JobResponse,
  type JobRetryRequest,
  type JobSnapshot,
  type JobsListResponse,
  type ServerJobRunner,
  type StartJobSpec,
} from "@isocan/core";
import type { KeyProvider } from "@isocan/core/keys";
import { resolveKey } from "@isocan/core/keystore";
import type { Engine } from "./engine.ts";
import { readJson, writeFileAtomic } from "./fsutil.ts";
import type { HomeLinks } from "./home-links.ts";
import type { Store } from "./store.ts";
import { warnRefusedKeys } from "./text.ts";
import type { UserKeyStore } from "./user-keys.ts";

/**
 * **Home-polled async job manager** (Open Stitch phase 0.2).
 *
 * Owned by the home daemon. Slow generations (video, deep research, multi-step
 * synthesis) create a placeholder item immediately (`job.state = "running"`),
 * persist active jobs atomically to `<dataDir>/jobs.json`, and are polled by
 * the home — never the browser tab. When a job finishes, its bytes are stored
 * via `engine.putBlob` and landed as a new version via `item.addVersion` +
 * `item.update` (`job.state = "done"`). Retrying reads `job.request` off the
 * item and targets the SAME item so results stack as versions.
 */

/** Default interval in milliseconds between home job-runner polls. */
export const DEFAULT_JOB_POLL_MS = 2_000;

export class JobNotFoundError extends Error {
  readonly code = "job-not-found";
  constructor(jobId: string) {
    super(`job not found: ${jobId}`);
    this.name = "JobNotFoundError";
  }
}

export class JobConflictError extends Error {
  readonly code = "job-conflict";
  constructor(message: string) {
    super(message);
    this.name = "JobConflictError";
  }
}

export class JobBadRequestError extends Error {
  readonly code = "job-bad-request";
  constructor(message: string) {
    super(message);
    this.name = "JobBadRequestError";
  }
}

/** Injectable clock and timer primitives so tests can simulate slow jobs deterministically. */
export interface JobClock {
  now: () => number;
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
}

const DEFAULT_CLOCK: JobClock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => {
    const handle = setTimeout(fn, ms);
    if (typeof (handle as { unref?: () => void }).unref === "function") {
      (handle as { unref: () => void }).unref();
    }
    return handle;
  },
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/** Options passed via `DaemonOptions.jobs`. */
export interface JobDaemonOptions {
  /** Override persistence path (`null` disables disk persistence). */
  filePath?: string | null;
  /** Polling interval in milliseconds (default: 2000). */
  pollIntervalMs?: number;
  /** Injectable clock/timer for deterministic tests. */
  clock?: Partial<JobClock>;
  /** Pre-registered named runners (e.g. test fakes). */
  runners?: Readonly<Record<string, ServerJobRunner>>;
  /** Optional seams per runner kind. */
  runnerOptions?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  /** Optional fetch override for runners. */
  fetch?: typeof fetch;
  /** Optional key resolver override. */
  keyFor?: (provider: KeyProvider, badgeId: string) => Promise<string | null>;
}

/** Constructor options for `JobManager`, extending `JobDaemonOptions` with engine/store handles. */
export interface JobManagerOptions extends JobDaemonOptions {
  engine: Engine;
  store: Store;
  keysHome?: string | null;
  userKeys?: UserKeyStore | null;
  log?: (line: string) => void;
}

interface PersistedJobRecord {
  job: ItemJob;
  canvasId: string;
  itemId: string;
  title?: string;
  actor: Actor;
  badgeId: string;
  externalId?: string;
}

interface ActiveJobRecord extends PersistedJobRecord {
  timer?: unknown;
  polling?: boolean;
}

interface PersistedJobsFile {
  version: 1;
  jobs: PersistedJobRecord[];
}

function defaultPlaceholder(spec: StartJobSpec): { bytes: Buffer; mimeType: string; filename: string } {
  const safeKind = spec.kind.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "job";
  if (spec.placeholder) {
    return {
      bytes: Buffer.from(spec.placeholder.bytes ?? Buffer.from(`Generating ${spec.kind} (${spec.model})...\n`, "utf8")),
      mimeType: spec.placeholder.mimeType ?? "text/markdown",
      filename: spec.placeholder.filename ?? `${safeKind}-job.md`,
    };
  }
  return {
    bytes: Buffer.from(`Generating ${spec.kind} (${spec.model})...\n`, "utf8"),
    mimeType: "text/markdown",
    filename: `${safeKind}-job.md`,
  };
}

function safeParseRequest(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function toSnapshot(rec: Pick<PersistedJobRecord, "job" | "canvasId" | "itemId" | "title">): JobSnapshot {
  return {
    ...rec.job,
    canvasId: rec.canvasId,
    itemId: rec.itemId,
    ...(rec.title !== undefined ? { title: rec.title } : {}),
  };
}

export class JobManager {
  private readonly engine: Engine;
  private readonly store: Store;
  private readonly filePath: string | null;
  private readonly pollIntervalMs: number;
  private readonly clock: JobClock;
  private readonly keysHome: string | null;
  private readonly userKeys: UserKeyStore | null;
  private readonly fetchImpl: typeof fetch;
  private readonly customKeyFor: ((provider: KeyProvider, badgeId: string) => Promise<string | null>) | undefined;
  private readonly log: (line: string) => void;

  private readonly runners = new Map<string, ServerJobRunner>();
  private readonly runnerOptions = new Map<string, Readonly<Record<string, unknown>>>();
  private readonly records = new Map<string, ActiveJobRecord>();
  private readonly inFlight = new Set<Promise<void>>();
  private persistQueue: Promise<void> = Promise.resolve();
  private closed = false;

  constructor(options: JobManagerOptions) {
    this.engine = options.engine;
    this.store = options.store;
    this.filePath = options.filePath ?? null;
    this.pollIntervalMs = options.pollIntervalMs ?? DEFAULT_JOB_POLL_MS;
    this.clock = { ...DEFAULT_CLOCK, ...(options.clock ?? {}) };
    this.keysHome = options.keysHome ?? null;
    this.userKeys = options.userKeys ?? null;
    this.fetchImpl = options.fetch ?? fetch;
    this.customKeyFor = options.keyFor;
    this.log = options.log ?? ((line) => console.warn(`[isocan] jobs: ${line}`));

    if (options.runnerOptions) {
      for (const [kind, opts] of Object.entries(options.runnerOptions)) {
        this.runnerOptions.set(kind, opts);
      }
    }
    if (options.runners) {
      for (const [kind, runner] of Object.entries(options.runners)) {
        this.runners.set(kind, runner);
      }
    }
  }

  /** Register a named job runner (`kind → runner`), resuming any loaded active jobs of that kind. */
  registerRunner(kind: string, runner: ServerJobRunner, options?: Readonly<Record<string, unknown>>): void {
    this.runners.set(kind, runner);
    if (options) this.runnerOptions.set(kind, options);
    if (this.closed) return;
    for (const rec of this.records.values()) {
      if (rec.job.kind === kind && isActiveJob(rec.job) && rec.timer === undefined && !rec.polling) {
        this.schedulePoll(rec);
      }
    }
  }

  /** Load persisted active jobs from `<dataDir>/jobs.json` and resume polling. */
  async init(): Promise<void> {
    if (!this.filePath || this.closed) return;
    let parsed: PersistedJobsFile | null = null;
    try {
      parsed = await readJson<PersistedJobsFile>(this.filePath);
    } catch (err) {
      this.log(`ignoring unreadable jobs file ${this.filePath}: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }
    if (!parsed || !Array.isArray(parsed.jobs)) return;
    let pruned = false;
    for (const raw of parsed.jobs) {
      if (!raw || !raw.job || !isActiveJob(raw.job) || !raw.canvasId || !raw.itemId || !raw.actor?.id || !raw.badgeId) {
        pruned = true;
        continue;
      }
      // Reconcile against the canvas: if the item already reached a terminal state or vanished, drop it.
      const snapshot = await this.engine.getSnapshot(raw.canvasId).catch(() => null);
      const item = snapshot?.canvas.items[raw.itemId];
      const onItem = jobOf(item);
      if (!item || !onItem || onItem.id !== raw.job.id || !isActiveJob(onItem)) {
        pruned = true;
        continue;
      }
      const rec: ActiveJobRecord = {
        job: { ...onItem },
        canvasId: raw.canvasId,
        itemId: raw.itemId,
        ...(item.title !== undefined ? { title: item.title } : raw.title !== undefined ? { title: raw.title } : {}),
        actor: raw.actor,
        badgeId: raw.badgeId,
        ...(raw.externalId !== undefined ? { externalId: raw.externalId } : {}),
      };
      this.records.set(rec.job.id, rec);
      if (this.runners.has(rec.job.kind)) {
        this.schedulePoll(rec);
      }
    }
    if (pruned) await this.persist();
  }

  /** Stop all timers and drain in-flight polls and disk writes cleanly before shutdown. */
  async close(): Promise<void> {
    this.closed = true;
    for (const rec of this.records.values()) {
      this.clearTimer(rec);
    }
    if (this.inFlight.size > 0) {
      await Promise.allSettled([...this.inFlight]);
    }
    await this.persistQueue;
  }

  /** Start a new job: adds a placeholder item (or updates `spec.itemId`), starts the runner, and begins home polling. */
  async start(canvasId: string, actor: Actor, spec: StartJobSpec, badgeId: string): Promise<JobSnapshot> {
    const runner = this.runners.get(spec.kind);
    if (!runner) {
      throw new JobBadRequestError(`unknown job kind "${spec.kind}" — no runner is registered for it`);
    }
    if (!spec.provider || !spec.model) {
      throw new JobBadRequestError("a job requires both `provider` and `model`");
    }
    let requestJson: string;
    try {
      requestJson = JSON.stringify(spec.request ?? {});
    } catch {
      throw new JobBadRequestError("job `request` must be JSON-serializable");
    }
    await this.engine.requireActor(badgeId, actor.id);

    const jobId = newJobId();
    const startedAt = new Date(this.clock.now()).toISOString();
    const job: ItemJob = {
      id: jobId,
      state: "running",
      kind: spec.kind,
      provider: spec.provider,
      model: spec.model,
      request: requestJson,
      startedAt,
    };

    let itemId: string;
    let title: string;
    if (spec.itemId) {
      const snapshot = await this.engine.getSnapshot(canvasId);
      const existing = snapshot.canvas.items[spec.itemId];
      if (!existing) {
        throw new JobBadRequestError(`item not found on ${canvasId}: ${spec.itemId}`);
      }
      itemId = existing.id;
      title = spec.title ?? existing.title;
      await this.engine.submit({
        canvasId,
        actor,
        badgeId,
        op: {
          type: "item.update",
          itemId,
          patch: {
            ...(spec.title !== undefined ? { title: spec.title } : {}),
            properties: { ...(spec.properties ?? {}), ...jobProperties(job) },
            removeProperties: jobClearKeys(job),
          },
        },
      });
    } else {
      itemId = newItemId();
      title = spec.title ?? `${spec.kind} (${spec.model})`;
      const placeholder = defaultPlaceholder(spec);
      const blob = await this.engine.putBlob(
        canvasId,
        placeholder.bytes,
        { mimeType: placeholder.mimeType, filename: placeholder.filename },
        undefined,
        badgeId,
      );
      await this.engine.submit({
        canvasId,
        actor,
        badgeId,
        op: {
          type: "item.add",
          itemId,
          version: {
            id: newVersionId(),
            blobHash: blob.blobHash,
            mimeType: blob.mimeType,
            filename: placeholder.filename,
            size: blob.size,
          },
          width: spec.width ?? 480,
          height: spec.height ?? 320,
          placement: spec.placement ?? { x: 0, y: 0 },
          title,
          properties: { ...(spec.properties ?? {}), ...jobProperties(job) },
        },
      });
    }

    const record: ActiveJobRecord = {
      job,
      canvasId,
      itemId,
      title,
      actor,
      badgeId,
    };
    this.records.set(jobId, record);
    await this.persist();

    const host = this.hostFor(record);
    try {
      const started = await runner.start(
        {
          jobId,
          canvasId,
          itemId,
          kind: spec.kind,
          provider: spec.provider,
          model: spec.model,
          request: spec.request ?? {},
        },
        host,
      );
      if (started.externalId !== undefined) record.externalId = started.externalId;
      if (started.immediate) {
        await this.completeJob(record, started.immediate);
      } else if (!this.closed && isActiveJob(record.job)) {
        await this.persist();
        this.schedulePoll(record);
      }
    } catch (err) {
      await this.failJob(record, err instanceof Error ? err.message : String(err));
    }

    return toSnapshot(record);
  }

  /** Abandon an active job: stops polling, notifies `runner.abandon`, and marks `job.state = "abandoned"`. */
  async abandon(canvasId: string, jobId: string, actor: Actor, badgeId: string): Promise<JobSnapshot> {
    await this.engine.requireActor(badgeId, actor.id);
    const active = this.records.get(jobId);
    if (active && active.canvasId === canvasId) {
      if (active.job.state === "abandoned") return toSnapshot(active);
      if (!isActiveJob(active.job)) {
        throw new JobConflictError(`job ${jobId} is already ${active.job.state}`);
      }
      this.clearTimer(active);
      active.job.state = "abandoned";
      active.job.finishedAt = new Date(this.clock.now()).toISOString();
      const runner = this.runners.get(active.job.kind);
      if (runner?.abandon) {
        try {
          await runner.abandon(this.pollStateOf(active), this.hostFor(active));
        } catch (err) {
          this.log(`runner abandon error for ${jobId}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      await this.engine.submit({
        canvasId,
        actor,
        badgeId,
        op: {
          type: "item.update",
          itemId: active.itemId,
          patch: {
            properties: jobProperties(active.job),
            removeProperties: jobClearKeys(active.job),
          },
        },
      });
      await this.persist();
      return toSnapshot(active);
    }

    // Fall back to canvas item state if the job wasn't tracked in memory.
    const found = await this.findOnCanvas(canvasId, jobId);
    if (!found) throw new JobNotFoundError(jobId);
    if (found.job.state === "abandoned") return toSnapshot(found);
    if (!isActiveJob(found.job)) {
      throw new JobConflictError(`job ${jobId} is already ${found.job.state}`);
    }
    const abandoned: ItemJob = {
      ...found.job,
      state: "abandoned",
      finishedAt: new Date(this.clock.now()).toISOString(),
    };
    await this.engine.submit({
      canvasId,
      actor,
      badgeId,
      op: {
        type: "item.update",
        itemId: found.itemId,
        patch: {
          properties: jobProperties(abandoned),
          removeProperties: jobClearKeys(abandoned),
        },
      },
    });
    return { ...abandoned, canvasId, itemId: found.itemId, title: found.title };
  }

  /**
   * Retry a terminal job on the SAME item using its stored `job.request`, optionally swapping `model`.
   * The new result stacks as a new version via `item.addVersion`, preserving version history.
   */
  async retry(
    canvasId: string,
    jobId: string,
    actor: Actor,
    badgeId: string,
    overrides?: { model?: string },
  ): Promise<JobSnapshot> {
    const found = await this.findOnCanvas(canvasId, jobId);
    const fallback = !found ? this.records.get(jobId) : undefined;
    const target = found ?? (fallback && fallback.canvasId === canvasId ? fallback : null);
    if (!target) throw new JobNotFoundError(jobId);

    // Check current state on the item so we never clobber a job that is already running on it.
    const snapshot = await this.engine.getSnapshot(canvasId);
    const item = snapshot.canvas.items[target.itemId];
    if (!item) throw new JobNotFoundError(jobId);
    const currentOnItem = jobOf(item);
    if (currentOnItem && isActiveJob(currentOnItem)) {
      throw new JobConflictError(`item ${item.id} already has an active job (${currentOnItem.id}) — cancel it first`);
    }
    const sourceJob = currentOnItem?.id === jobId ? currentOnItem : target.job;
    if (!canRetryJob(sourceJob)) {
      if (isActiveJob(sourceJob)) {
        throw new JobConflictError(`job ${jobId} is still ${sourceJob.state} — cancel it before retrying`);
      }
      throw new JobBadRequestError(`job ${jobId} has no stored request payload to retry`);
    }

    let requestPayload: unknown;
    try {
      requestPayload = JSON.parse(sourceJob.request);
    } catch {
      throw new JobBadRequestError(`job ${jobId} carries an unreadable request payload`);
    }

    const nextModel = overrides?.model?.trim() || sourceJob.model;
    return this.start(
      canvasId,
      actor,
      {
        kind: sourceJob.kind,
        provider: sourceJob.provider,
        model: nextModel,
        request: requestPayload,
        itemId: item.id,
      },
      badgeId,
    );
  }

  /** List all jobs recorded on items of this canvas, newest first. */
  async list(canvasId: string): Promise<JobSnapshot[]> {
    const snapshot = await this.engine.getSnapshot(canvasId);
    const out: JobSnapshot[] = [];
    for (const item of Object.values(snapshot.canvas.items)) {
      const job = jobOf(item);
      if (!job) continue;
      out.push({
        ...job,
        canvasId,
        itemId: item.id,
        title: item.title,
      });
    }
    out.sort((a, b) => b.startedAt.localeCompare(a.startedAt) || b.id.localeCompare(a.id));
    return out;
  }

  /** Get one job's snapshot on this canvas, or `null` if unknown. */
  async get(canvasId: string, jobId: string): Promise<JobSnapshot | null> {
    const found = await this.findOnCanvas(canvasId, jobId);
    if (found) return toSnapshot(found);
    const rec = this.records.get(jobId);
    if (rec && rec.canvasId === canvasId) return toSnapshot(rec);
    return null;
  }

  /** Await all currently in-flight poll ticks and pending `jobs.json` writes. */
  async settled(): Promise<void> {
    while (this.inFlight.size > 0) {
      await Promise.allSettled([...this.inFlight]);
    }
    await this.persistQueue;
  }

  /** Run a single poll tick now (for one job or all active jobs). Useful in deterministic unit tests. */
  async tick(jobId?: string): Promise<void> {
    if (this.closed) return;
    const targets = jobId
      ? [this.records.get(jobId)].filter((r): r is ActiveJobRecord => Boolean(r))
      : [...this.records.values()];
    await Promise.all(targets.filter((r) => isActiveJob(r.job)).map((r) => this.pollOnce(r)));
  }

  private async findOnCanvas(
    canvasId: string,
    jobId: string,
  ): Promise<{ job: ItemJob; canvasId: string; itemId: string; title: string } | null> {
    const snapshot = await this.engine.getSnapshot(canvasId);
    for (const item of Object.values(snapshot.canvas.items)) {
      const job = jobOf(item);
      if (job && job.id === jobId) {
        return { job, canvasId, itemId: item.id, title: item.title };
      }
    }
    return null;
  }

  private schedulePoll(record: ActiveJobRecord): void {
    if (this.closed || !isActiveJob(record.job)) return;
    this.clearTimer(record);
    record.timer = this.clock.setTimeout(() => {
      record.timer = undefined;
      void this.pollOnce(record);
    }, this.pollIntervalMs);
  }

  private clearTimer(record: ActiveJobRecord): void {
    if (record.timer !== undefined) {
      this.clock.clearTimeout(record.timer);
      record.timer = undefined;
    }
  }

  private pollStateOf(record: ActiveJobRecord): JobPollState {
    return {
      jobId: record.job.id,
      canvasId: record.canvasId,
      itemId: record.itemId,
      kind: record.job.kind,
      provider: record.job.provider,
      model: record.job.model,
      request: safeParseRequest(record.job.request),
      ...(record.externalId !== undefined ? { externalId: record.externalId } : {}),
      startedAt: record.job.startedAt,
    };
  }

  private hostFor(record: ActiveJobRecord): JobHost {
    const runnerOpts = this.runnerOptions.get(record.job.kind) ?? {};
    const seamFetch = typeof runnerOpts.fetch === "function" ? (runnerOpts.fetch as typeof fetch) : undefined;
    const seamKey = typeof runnerOpts.key === "function" ? (runnerOpts.key as () => string | undefined) : undefined;
    return {
      keyFor: async (provider: KeyProvider) => {
        if (this.customKeyFor) return this.customKeyFor(provider, record.badgeId);
        if (this.userKeys && record.actor.id) {
          const mine = await this.userKeys.get(record.actor.id, provider).catch(() => null);
          if (mine) return mine.key;
        }
        if (seamKey) {
          const k = seamKey()?.trim();
          if (k) return k;
        }
        const found = warnRefusedKeys(() => resolveKey(provider, { home: this.keysHome }));
        return found?.key ?? null;
      },
      readBlob: async (canvasId: string, blobHash: string) => {
        const stream = await this.store.openBlob(canvasId, blobHash);
        if (!stream) return null;
        const chunks: Buffer[] = [];
        for await (const chunk of stream) chunks.push(Buffer.from(chunk as Uint8Array));
        return Buffer.concat(chunks);
      },
      fetch: seamFetch ?? this.fetchImpl,
      now: () => this.clock.now(),
      options: runnerOpts,
      log: (line) => this.log(`${record.job.kind}[${record.job.id}]: ${line}`),
    };
  }

  private pollOnce(record: ActiveJobRecord): Promise<void> {
    if (this.closed || !isActiveJob(record.job) || record.polling) return Promise.resolve();
    const runner = this.runners.get(record.job.kind);
    if (!runner) return Promise.resolve();
    record.polling = true;
    const work = (async () => {
      try {
        const result = await runner.poll(this.pollStateOf(record), this.hostFor(record));
        // Guard against abandon() or close() racing with an in-flight poll.
        if (this.closed || !isActiveJob(record.job)) return;
        if ("failed" in result) {
          await this.failJob(record, result.failed);
          return;
        }
        if (result.done) {
          await this.completeJob(record, result);
          return;
        }
        if (result.progress !== undefined && result.progress !== record.job.progress) {
          record.job.progress = result.progress;
          await this.engine.submit({
            canvasId: record.canvasId,
            actor: record.actor,
            badgeId: record.badgeId,
            op: {
              type: "item.update",
              itemId: record.itemId,
              patch: { properties: { [JOB_PROP_KEYS.progress]: result.progress } },
            },
          });
          await this.persist();
        }
        if (!this.closed && isActiveJob(record.job)) {
          this.schedulePoll(record);
        }
      } catch (err) {
        if (!this.closed && isActiveJob(record.job)) {
          await this.failJob(record, err instanceof Error ? err.message : String(err));
        }
      } finally {
        record.polling = false;
      }
    })();
    this.inFlight.add(work);
    void work.finally(() => this.inFlight.delete(work));
    return work;
  }

  private async completeJob(record: ActiveJobRecord, artifact: JobArtifact): Promise<void> {
    this.clearTimer(record);
    const blob = await this.engine.putBlob(
      record.canvasId,
      Buffer.from(artifact.bytes),
      { mimeType: artifact.mimeType, filename: artifact.filename },
      undefined,
      record.badgeId,
    );
    record.job.state = "done";
    record.job.finishedAt = new Date(this.clock.now()).toISOString();
    delete record.job.error;
    const group = newGroupId();
    await this.engine.submit({
      canvasId: record.canvasId,
      actor: record.actor,
      badgeId: record.badgeId,
      group,
      op: {
        type: "item.addVersion",
        itemId: record.itemId,
        version: {
          id: newVersionId(),
          blobHash: blob.blobHash,
          mimeType: blob.mimeType,
          filename: artifact.filename,
          size: blob.size,
        },
      },
    });
    await this.engine.submit({
      canvasId: record.canvasId,
      actor: record.actor,
      badgeId: record.badgeId,
      group,
      op: {
        type: "item.update",
        itemId: record.itemId,
        patch: {
          properties: jobProperties(record.job),
          removeProperties: jobClearKeys(record.job),
        },
      },
    });
    await this.persist();
  }

  private async failJob(record: ActiveJobRecord, message: string): Promise<void> {
    this.clearTimer(record);
    record.job.state = "failed";
    record.job.error = message || "job failed";
    record.job.finishedAt = new Date(this.clock.now()).toISOString();
    try {
      await this.engine.submit({
        canvasId: record.canvasId,
        actor: record.actor,
        badgeId: record.badgeId,
        op: {
          type: "item.update",
          itemId: record.itemId,
          patch: {
            properties: jobProperties(record.job),
            removeProperties: jobClearKeys(record.job),
          },
        },
      });
    } catch (err) {
      this.log(`failed to record failure for ${record.job.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
    await this.persist();
  }

  private persist(): Promise<void> {
    if (!this.filePath) return Promise.resolve();
    const target = this.filePath;
    const active: PersistedJobRecord[] = [];
    for (const rec of this.records.values()) {
      if (!isActiveJob(rec.job)) continue;
      active.push({
        job: { ...rec.job },
        canvasId: rec.canvasId,
        itemId: rec.itemId,
        ...(rec.title !== undefined ? { title: rec.title } : {}),
        actor: rec.actor,
        badgeId: rec.badgeId,
        ...(rec.externalId !== undefined ? { externalId: rec.externalId } : {}),
      });
    }
    const payload: PersistedJobsFile = { version: 1, jobs: active };
    const next = this.persistQueue.then(async () => {
      try {
        await fs.mkdir(path.dirname(target), { recursive: true });
        await writeFileAtomic(target, JSON.stringify(payload, null, 2));
      } catch (err) {
        this.log(`could not persist ${target}: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
    this.persistQueue = next;
    return next;
  }
}

interface JobRouteScope {
  jobs: JobManager;
  engine: Engine;
  homes: HomeLinks | null;
}

function actorFromBody(body: unknown): Actor | undefined {
  const raw = (body as { actor?: { id?: unknown; name?: unknown } } | null)?.actor;
  return raw && typeof raw.id === "string" && raw.id && typeof raw.name === "string"
    ? { id: raw.id, name: raw.name }
    : undefined;
}

async function resolveRouteActor(req: FastifyRequest, engine: Engine, body: unknown): Promise<Actor> {
  const fromBody = actorFromBody(body);
  if (fromBody) return fromBody;
  const bindings = await engine.actorBindings(req.badge!.badgeId, null);
  if (bindings.length > 0) return bindings[0]!.actor;
  throw new JobBadRequestError("an actor is required to mutate a job — claim an identity or pass `actor` in the body");
}

function sendJobError(reply: FastifyReply, err: unknown): FastifyReply {
  if (err instanceof JobNotFoundError) return reply.status(404).send({ error: err.message, code: err.code });
  if (err instanceof JobConflictError) return reply.status(409).send({ error: err.message, code: err.code });
  if (err instanceof JobBadRequestError) return reply.status(400).send({ error: err.message, code: err.code });
  throw err;
}

/**
 * Mount the canvas-scoped async job routes under `/api/projects/:id/jobs`.
 * Badge, admission, takedown, and edit-capability checks run in `http.ts`'s
 * `onRequest` hook for every `/api/projects/:id/*` route.
 */
export function registerJobRoutes(app: FastifyInstance, scope: JobRouteScope): void {
  const { jobs, engine, homes } = scope;

  app.get(JOB_ROUTES.list, async (req) => {
    const { id } = req.params as { id: string };
    const home = homes?.for(id) ?? null;
    if (home) return home.personalRequest<JobsListResponse>("GET", req.url);
    return { canvasId: id, jobs: await jobs.list(id) } satisfies JobsListResponse;
  });

  app.get(JOB_ROUTES.get, async (req, reply) => {
    const { id, jobId } = req.params as { id: string; jobId: string };
    const home = homes?.for(id) ?? null;
    if (home) return home.personalRequest<JobResponse>("GET", req.url);
    const job = await jobs.get(id, jobId);
    if (!job) return reply.status(404).send({ error: `job not found: ${jobId}`, code: "job-not-found" });
    return { job } satisfies JobResponse;
  });

  app.post(JOB_ROUTES.abandon, async (req, reply) => {
    const { id, jobId } = req.params as { id: string; jobId: string };
    const body = (req.body ?? {}) as JobAbandonRequest;
    const home = homes?.for(id) ?? null;
    if (home) return home.personalRequest<JobResponse>("POST", req.url, body, actorFromBody(body));
    try {
      const actor = await resolveRouteActor(req, engine, body);
      const job = await jobs.abandon(id, jobId, actor, req.badge!.badgeId);
      return { job } satisfies JobResponse;
    } catch (err) {
      return sendJobError(reply, err);
    }
  });

  app.post(JOB_ROUTES.retry, async (req, reply) => {
    const { id, jobId } = req.params as { id: string; jobId: string };
    const body = (req.body ?? {}) as JobRetryRequest;
    if (body.model !== undefined && typeof body.model !== "string") {
      return reply.status(400).send({ error: "`model` must be a string", code: "job-bad-request" });
    }
    const home = homes?.for(id) ?? null;
    if (home) return home.personalRequest<JobResponse>("POST", req.url, body, actorFromBody(body));
    try {
      const actor = await resolveRouteActor(req, engine, body);
      const job = await jobs.retry(
        id,
        jobId,
        actor,
        req.badge!.badgeId,
        body.model ? { model: body.model } : undefined,
      );
      return { job } satisfies JobResponse;
    } catch (err) {
      return sendJobError(reply, err);
    }
  });
}
