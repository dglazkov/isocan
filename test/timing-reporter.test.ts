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

import { expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { TestModule, Vitest } from "vitest/node";
import TimingReporter from "./timing-reporter.ts";

it.each([3, undefined])("records shard metadata and per-file diagnostics with maxWorkers=%s", (maxWorkers) => {
  const root = mkdtempSync(path.join(tmpdir(), "isocan-timing-reporter-"));
  try {
    const reporter = new TimingReporter();
    reporter.onInit({ config: { root, shard: { index: 2, count: 4 }, maxWorkers, testNamePattern: /one test/ } } as Vitest);
    const mod = {
      moduleId: path.join(root, "test/acme.test.ts"),
      ok: () => true,
      children: { allTests: () => [1, 2] },
      diagnostic: () => ({ duration: 12.4 }),
    } as unknown as TestModule;
    reporter.onTestRunEnd([mod], [], "passed");
    const profile = JSON.parse(readFileSync(path.join(root, ".isocan/test-profile.json"), "utf8"));
    expect(profile).toMatchObject({
      files: 1, tests: 2, failed: 0, workers: maxWorkers ?? expect.any(Number), shard: "2/4", filtered: true,
      reason: "passed", errors: 0, node: process.version,
      fileDurations: [{ file: "test/acme.test.ts", ms: 12, passed: true }],
    });
    const history = JSON.parse(readFileSync(path.join(root, ".isocan/timings.jsonl"), "utf8"));
    expect(history.shard).toBe("2/4");
    expect(history.workers).toBe(profile.workers);
    expect(history.workers).toBeGreaterThan(0);
  } finally { rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
});
