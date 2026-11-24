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

import { describe, expect, it } from "vitest";
import {
  JOB_PROP_KEYS,
  JOB_ROUTES,
  JOB_STATES,
  canRetryJob,
  isActiveJob,
  isJobState,
  jobAbandonRoute,
  jobClearKeys,
  jobOf,
  jobProperties,
  jobRetryRoute,
  jobRoute,
  jobsRoute,
  newJobId,
  type ItemJob,
} from "../src/index.ts";

describe("async job properties and helpers (@isocan/core/jobs)", () => {
  it("mints job_ ids and validates job states", () => {
    const id = newJobId();
    expect(id).toMatch(/^job_[A-Za-z0-9_-]{10}$/);
    for (const s of JOB_STATES) expect(isJobState(s)).toBe(true);
    expect(isJobState("pending")).toBe(false);
    expect(isJobState(null)).toBe(false);
  });

  it("round-trips ItemJob through jobProperties and jobOf", () => {
    const running: ItemJob = {
      id: "job_acme000001",
      state: "running",
      kind: "video",
      provider: "gemini",
      model: "veo-test-1",
      request: JSON.stringify({ prompt: "Acme launch clip" }),
      startedAt: "2026-11-19T10:00:00.000Z",
      progress: "50%",
    };
    const props = jobProperties(running);
    expect(props).toEqual({
      [JOB_PROP_KEYS.id]: "job_acme000001",
      [JOB_PROP_KEYS.state]: "running",
      [JOB_PROP_KEYS.kind]: "video",
      [JOB_PROP_KEYS.provider]: "gemini",
      [JOB_PROP_KEYS.model]: "veo-test-1",
      [JOB_PROP_KEYS.request]: '{"prompt":"Acme launch clip"}',
      [JOB_PROP_KEYS.startedAt]: "2026-11-19T10:00:00.000Z",
      [JOB_PROP_KEYS.progress]: "50%",
    });
    expect(jobOf({ properties: props })).toEqual(running);
    expect(jobClearKeys(running)).toEqual([JOB_PROP_KEYS.finishedAt, JOB_PROP_KEYS.error]);

    const failed: ItemJob = {
      ...running,
      state: "failed",
      finishedAt: "2026-11-19T10:00:30.000Z",
      error: "provider timed out",
    };
    delete failed.progress;
    expect(jobOf({ properties: jobProperties(failed) })).toEqual(failed);
    expect(jobClearKeys(failed)).toEqual([JOB_PROP_KEYS.progress]);
  });

  it("returns null from jobOf when an item carries no valid job", () => {
    expect(jobOf(null)).toBeNull();
    expect(jobOf({ properties: {} })).toBeNull();
    expect(jobOf({ properties: { [JOB_PROP_KEYS.id]: "job_only" } })).toBeNull();
    expect(jobOf({ properties: { [JOB_PROP_KEYS.id]: "job_bad", [JOB_PROP_KEYS.state]: "bogus" } })).toBeNull();
  });

  it("classifies active and retryable states", () => {
    const req = JSON.stringify({ prompt: "Acme scene" });
    expect(isActiveJob({ state: "queued" })).toBe(true);
    expect(isActiveJob({ state: "running" })).toBe(true);
    expect(isActiveJob({ state: "done" })).toBe(false);
    expect(isActiveJob({ state: "failed" })).toBe(false);
    expect(isActiveJob({ state: "abandoned" })).toBe(false);
    expect(isActiveJob(null)).toBe(false);

    expect(canRetryJob({ state: "queued", request: req })).toBe(false);
    expect(canRetryJob({ state: "running", request: req })).toBe(false);
    expect(canRetryJob({ state: "done", request: req })).toBe(true);
    expect(canRetryJob({ state: "failed", request: req })).toBe(true);
    expect(canRetryJob({ state: "abandoned", request: req })).toBe(true);
    expect(canRetryJob({ state: "failed", request: "" })).toBe(false);
    expect(canRetryJob(null)).toBe(false);
  });

  it("builds canvas-scoped job routes", () => {
    expect(JOB_ROUTES).toEqual({
      list: "/api/projects/:id/jobs",
      get: "/api/projects/:id/jobs/:jobId",
      abandon: "/api/projects/:id/jobs/:jobId/abandon",
      retry: "/api/projects/:id/jobs/:jobId/retry",
    });
    expect(jobsRoute("prj_acme")).toBe("/api/projects/prj_acme/jobs");
    expect(jobRoute("prj_acme", "job_1")).toBe("/api/projects/prj_acme/jobs/job_1");
    expect(jobAbandonRoute("prj_acme", "job_1")).toBe("/api/projects/prj_acme/jobs/job_1/abandon");
    expect(jobRetryRoute("prj_acme", "job_1")).toBe("/api/projects/prj_acme/jobs/job_1/retry");
  });
});
