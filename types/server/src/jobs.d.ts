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
import type { FastifyInstance } from "fastify";
import { type Actor, type JobSnapshot, type ServerJobRunner, type StartJobSpec } from "../../core/src/index.js";
import type { KeyProvider } from "../../core/src/keys.js";
import type { Engine } from "./engine.js";
import type { HomeLinks } from "./home-links.js";
import type { Store } from "./store.js";
import type { UserKeyStore } from "./user-keys.js";
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
export declare const DEFAULT_JOB_POLL_MS = 2000;
export declare class JobNotFoundError extends Error {
    readonly code = "job-not-found";
    constructor(jobId: string);
}
export declare class JobConflictError extends Error {
    readonly code = "job-conflict";
    constructor(message: string);
}
export declare class JobBadRequestError extends Error {
    readonly code = "job-bad-request";
    constructor(message: string);
}
/** Injectable clock and timer primitives so tests can simulate slow jobs deterministically. */
export interface JobClock {
    now: () => number;
    setTimeout: (fn: () => void, ms: number) => unknown;
    clearTimeout: (handle: unknown) => void;
}
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
export declare class JobManager {
    private readonly engine;
    private readonly store;
    private readonly filePath;
    private readonly pollIntervalMs;
    private readonly clock;
    private readonly keysHome;
    private readonly userKeys;
    private readonly fetchImpl;
    private readonly customKeyFor;
    private readonly log;
    private readonly runners;
    private readonly runnerOptions;
    private readonly records;
    private readonly inFlight;
    private persistQueue;
    private closed;
    constructor(options: JobManagerOptions);
    /** Register a named job runner (`kind → runner`), resuming any loaded active jobs of that kind. */
    registerRunner(kind: string, runner: ServerJobRunner, options?: Readonly<Record<string, unknown>>): void;
    /** Load persisted active jobs from `<dataDir>/jobs.json` and resume polling. */
    init(): Promise<void>;
    /** Stop all timers and drain in-flight polls and disk writes cleanly before shutdown. */
    close(): Promise<void>;
    /** Start a new job: adds a placeholder item (or updates `spec.itemId`), starts the runner, and begins home polling. */
    start(canvasId: string, actor: Actor, spec: StartJobSpec, badgeId: string): Promise<JobSnapshot>;
    /** Abandon an active job: stops polling, notifies `runner.abandon`, and marks `job.state = "abandoned"`. */
    abandon(canvasId: string, jobId: string, actor: Actor, badgeId: string): Promise<JobSnapshot>;
    /**
     * Retry a terminal job on the SAME item using its stored `job.request`, optionally swapping `model`.
     * The new result stacks as a new version via `item.addVersion`, preserving version history.
     */
    retry(canvasId: string, jobId: string, actor: Actor, badgeId: string, overrides?: {
        model?: string;
    }): Promise<JobSnapshot>;
    /** List all jobs recorded on items of this canvas, newest first. */
    list(canvasId: string): Promise<JobSnapshot[]>;
    /** Get one job's snapshot on this canvas, or `null` if unknown. */
    get(canvasId: string, jobId: string): Promise<JobSnapshot | null>;
    /** Await all currently in-flight poll ticks and pending `jobs.json` writes. */
    settled(): Promise<void>;
    /** Run a single poll tick now (for one job or all active jobs). Useful in deterministic unit tests. */
    tick(jobId?: string): Promise<void>;
    private findOnCanvas;
    private schedulePoll;
    private clearTimer;
    private pollStateOf;
    private hostFor;
    private pollOnce;
    private completeJob;
    private failJob;
    private persist;
}
interface JobRouteScope {
    jobs: JobManager;
    engine: Engine;
    homes: HomeLinks | null;
}
/**
 * Mount the canvas-scoped async job routes under `/api/projects/:id/jobs`.
 * Badge, admission, takedown, and edit-capability checks run in `http.ts`'s
 * `onRequest` hook for every `/api/projects/:id/*` route.
 */
export declare function registerJobRoutes(app: FastifyInstance, scope: JobRouteScope): void;
export {};
