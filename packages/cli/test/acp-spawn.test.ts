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

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import os from "node:os";
import { AcpAgentProcess } from "../src/acp.ts";

/**
 * **An adapter that cannot start fails its turn, not the rc** (cleanup phase
 * 1, TS-4).
 *
 * `acpAdapters` in config.json names a command a person typed, so a typo is an
 * ordinary input. A child process that cannot be spawned emits `'error'`, and
 * an `'error'` nobody listens for is thrown — out of `isocan rc`, which holds
 * every canvas it parks on. What it costs now is `spawn` rejecting with words
 * that name the command, which the turn reports as its failure.
 *
 * Its own file rather than `acp.test.ts`, which starts a daemon per case and
 * sits in the deep lane: this needs neither, and a guard this cheap belongs
 * where `npm test` runs it.
 */

const uncaught: unknown[] = [];
const onUncaught = (err: unknown) => void uncaught.push(err);

beforeEach(() => {
  uncaught.length = 0;
  process.on("uncaughtException", onUncaught);
});

afterEach(() => {
  process.off("uncaughtException", onUncaught);
});

describe("an adapter command that does not exist", () => {
  it("rejects the spawn with the command's name, and throws nothing past it", async () => {
    const spawned = AcpAgentProcess.spawn(
      { harness: "acme", command: "isocan-no-such-adapter", args: ["--acp"] },
      { cwd: os.tmpdir(), env: { PATH: process.env.PATH ?? "" } },
    ).then(
      (agent) => {
        agent.close();
        return "started";
      },
      (err: Error) => err.message,
    );
    // Bounded: on the unfixed code the throw lands inside the child's exit
    // handling, before `'close'` — so nothing ever rejects the handshake, and
    // the turn would have waited out its two-minute deadline had the process
    // survived to.
    const said = await Promise.race([
      spawned,
      new Promise<string>((resolve) => setTimeout(() => resolve("never settled"), 5_000)),
    ]);
    // A moment for anything that escaped to land where it would have.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(uncaught.map(String)).toEqual([]);
    expect(said).toContain("isocan-no-such-adapter");
    expect(said).toContain("could not be started");
    expect(said).toContain("ENOENT");
  });
});
