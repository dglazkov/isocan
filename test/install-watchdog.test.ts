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

import { it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// The dependency-free negative controls also run before npm ci exists. Keep
// them in the ordinary/CI suite union so a passing gate cannot omit them.
it("install watchdog and retry negative controls hold", () => {
  const run = spawnSync(process.execPath, ["--test", "scripts/install-watchdog.test.mjs"], {
    cwd: fileURLToPath(new URL("../", import.meta.url)), encoding: "utf8", timeout: 25_000,
    env: Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith("NODE_TEST_"))),
  });
  expect(run.error, `${run.stdout}\n${run.stderr}`).toBeUndefined();
  expect(run.status, `${run.stdout}\n${run.stderr}`).toBe(0);
  expect(run.stdout).toMatch(/# pass 22|ℹ pass 22/);
});
