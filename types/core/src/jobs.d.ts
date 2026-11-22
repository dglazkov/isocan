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
import type { KeyProvider } from "./keys.js";
import type { Actor, Item } from "./model.js";
import type { Placement } from "./ops.js";
/**
 * **Home-polled async jobs stored on items** (Open Stitch phase 0.2).
 *
 * Slow generations (video, deep research, multi-step synthesis) must not die
 * when a browser tab closes. The home polls; the item carries the job's state
 * in its `properties` (`job.*`), using existing `item.add`, `item.update`, and
 * `item.addVersion` ops (zero new ops) so both web and CLI see live progress
 * and can retry ("try another model") without an agent turn.
 */
/** Lifecycle states of a home-polled async job stored on an item. */
export declare const JOB_STATES: readonly ["queued", "running", "done", "failed", "abandoned"];
type JobState = (typeof JOB_STATES)[number];
/** Type guard verifying that a string is a valid job lifecycle state. */
export declare function isJobState(value: unknown): value is JobState;
/** Item property keys that carry a job's state and retry payload. */
export declare const JOB_PROP_KEYS: {
    readonly id: "job.id";
    readonly state: "job.state";
    readonly kind: "job.kind";
    readonly provider: "job.provider";
    readonly model: "job.model";
    readonly request: "job.request";
    readonly startedAt: "job.startedAt";
    readonly finishedAt: "job.finishedAt";
    readonly progress: "job.progress";
    readonly error: "job.error";
};
/** Durable job record carried on a canvas item's `properties`. */
export interface ItemJob {
    id: string;
    state: JobState;
    kind: string;
    provider: string;
    model: string;
    /** JSON string of the stored request payload for retry / model swapping. */
    request: string;
    startedAt: string;
    finishedAt?: string;
    progress?: string;
    error?: string;
}
/** Read a job from an item's properties, or `null` when the item carries none. */
export declare function jobOf(item: Pick<Item, "properties"> | null | undefined): ItemJob | null;
/** Serialize an `ItemJob` into flat `job.*` item properties. */
export declare function jobProperties(job: ItemJob): Record<string, string>;
/** Optional `job.*` keys absent from `job`, for `item.update`'s `removeProperties`. */
export declare function jobClearKeys(job: ItemJob): string[];
/** True while a job is queued or actively being polled by the home. */
export declare function isActiveJob(job: Pick<ItemJob, "state"> | null | undefined): boolean;
/** True when a terminal job carries a stored request payload and can be re-run. */
export declare function canRetryJob(job: Pick<ItemJob, "state" | "request"> | null | undefined): boolean;
/** Route templates registered on the home daemon. */
export declare const JOB_ROUTES: {
    readonly list: "/api/projects/:id/jobs";
    readonly get: "/api/projects/:id/jobs/:jobId";
    readonly abandon: "/api/projects/:id/jobs/:jobId/abandon";
    readonly retry: "/api/projects/:id/jobs/:jobId/retry";
};
/** Path builder for listing async jobs on a canvas. */
export declare const jobsRoute: (canvasId: string) => string;
/** Path builder for reading one async job on a canvas. */
export declare const jobRoute: (canvasId: string, jobId: string) => string;
/** Path builder for abandoning an active async job. */
export declare const jobAbandonRoute: (canvasId: string, jobId: string) => string;
/** Path builder for retrying a terminal async job (optionally with another model). */
export declare const jobRetryRoute: (canvasId: string, jobId: string) => string;
/** Wire snapshot of a job on a canvas item. */
export interface JobSnapshot extends ItemJob {
    canvasId: string;
    itemId: string;
    title?: string;
}
/** Response body for `GET /api/projects/:id/jobs`. */
export interface JobsListResponse {
    canvasId: string;
    jobs: JobSnapshot[];
}
/** Response body for single-job status, abandon, and retry endpoints. */
export interface JobResponse {
    job: JobSnapshot;
}
/** Request body for `POST /api/projects/:id/jobs/:jobId/abandon`. */
export interface JobAbandonRequest {
    actor?: Actor;
}
/** Request body for `POST /api/projects/:id/jobs/:jobId/retry`. */
export interface JobRetryRequest {
    actor?: Actor;
    model?: string;
}
/** Bytes produced when an async job completes. */
export interface JobArtifact {
    bytes: Uint8Array;
    mimeType: string;
    filename: string;
}
/** Result returned by `ServerJobRunner.start`: either an external operation id or immediate bytes. */
export interface JobStartResult {
    externalId?: string;
    immediate?: JobArtifact;
}
/** Result returned by `ServerJobRunner.poll`: still running, completed artifact, or failure message. */
export type JobPollResult = {
    done: false;
    progress?: string;
} | ({
    done: true;
} & JobArtifact) | {
    failed: string;
};
/** Request context handed to `ServerJobRunner.start`. */
export interface JobStartInput {
    jobId: string;
    canvasId: string;
    itemId: string;
    kind: string;
    provider: string;
    model: string;
    request: unknown;
}
/** Persisted runner state handed to `ServerJobRunner.poll` and `.abandon`. */
export interface JobPollState extends JobStartInput {
    externalId?: string;
    startedAt: string;
}
/** Host capabilities handed to a job runner on `start`, `poll`, and `abandon`. */
export interface JobHost {
    keyFor: (provider: KeyProvider) => Promise<string | null>;
    readBlob: (canvasId: string, blobHash: string) => Promise<Uint8Array | null>;
    fetch: typeof fetch;
    now: () => number;
    options: Readonly<Record<string, unknown>>;
    log: (line: string) => void;
}
/** A named async job runner registered by a `ServerModule` or the home. */
export interface ServerJobRunner {
    start: (req: JobStartInput, host: JobHost) => Promise<JobStartResult>;
    poll: (state: JobPollState, host: JobHost) => Promise<JobPollResult>;
    abandon?: (state: JobPollState, host: JobHost) => Promise<void>;
}
/** Specification for starting an async job through `ServerHost.startJob` or `JobManager.start`. */
export interface StartJobSpec {
    kind: string;
    provider: string;
    model: string;
    request: unknown;
    /** Target an existing item (e.g. retry or replace); omitted adds a placeholder item. */
    itemId?: string;
    title?: string;
    width?: number;
    height?: number;
    placement?: Placement;
    placeholder?: {
        bytes?: Uint8Array;
        mimeType?: string;
        filename?: string;
    };
    properties?: Record<string, string>;
}
export {};
