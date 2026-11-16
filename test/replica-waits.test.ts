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

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **A relay is waited on until it is current, never for one second.**
 *
 * Four server tests waited for a relay's replica with
 * `expect.poll(() => relay.store.canvasExists(id)).toBe(true)`: vitest's
 * default deadline of ONE second, on the middle of adoption rather than its
 * end. On a loaded `test:deep` run that failed — "Matcher did not succeed in
 * time" — in whichever of them the machine happened to be slowest for
 * (lessons.md #92). `packages/server/test/replica.ts` is the one way to wait
 * now: the home's `lastSeq`, on the replication deadline the home-link tests
 * already used. This reads the test sources so a fifth copy of the old line
 * fails here instead of on somebody's unrelated push.
 */
const root = fileURLToPath(new URL("..", import.meta.url));

function testFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "fixtures") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...testFiles(full));
    else if (/\.test\.ts$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe("waiting on a relay", () => {
  const files = [path.join(root, "test"), ...readdirSync(path.join(root, "packages")).map((p) => path.join(root, "packages", p, "test"))]
    .filter((dir) => { try { return readdirSync(dir).length >= 0; } catch { return false; } })
    .flatMap(testFiles);

  it("finds test files at all — a search over nothing always passes", () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it("never polls a relay's store on vitest's default deadline", () => {
    const offenders = files.filter((f) => f !== fileURLToPath(import.meta.url) && /expect\.poll\(\s*\(\)\s*=>\s*relay!?\.store\./.test(readFileSync(f, "utf8")));
    expect(
      offenders.map((f) => path.relative(root, f)),
      "use untilReplicaCurrent from packages/server/test/replica.ts — expect.poll gives up after one second",
    ).toEqual([]);
  });
});
