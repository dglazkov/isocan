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

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { promises as fsp } from "node:fs";
import os from "node:os";
import path from "node:path";
import { startDaemon, type Daemon } from "@isocan/server/daemon";
import { cliEnv, runCli, runCliWithInput, type Run } from "./cli.ts";

/**
 * **`isocan keys ls|set|rm --mine`** (Open Stitch phase 0.3): manages per-user
 * BYOK keys against `/api/me/keys` on the active home. Never accepts a secret on
 * argv and never prints a secret to stdout or stderr.
 */

const SECRET = "fake-gemini-acme-CLI-MINE-DO-NOT-PRINT-4321";
const priya = { id: "usr_priya", name: "Priya" };

let home: string;
let daemon: Daemon;
let port: number;
const runs: Run[] = [];

const env = () =>
  cliEnv({
    ISOCAN_HOME: home,
    ISOCAN_PORT: String(port),
    GEMINI_API_KEY: undefined,
    ISOCAN_TEXT_API_KEY: undefined,
    TYPESAFE_API_KEY: undefined,
  });

const keys = async (args: string[]) => {
  const run = await runCli(["keys", ...args], { env: env(), cwd: home });
  runs.push(run);
  return run;
};

beforeAll(async () => {
  home = await fsp.mkdtemp(path.join(os.tmpdir(), "isocan-cli-userkeys-"));
  await fsp.writeFile(path.join(home, "identity.json"), JSON.stringify(priya));
  daemon = await startDaemon({ port: 0, home, auth: null, contentPort: "off" });
  const addr = daemon.app.server.address();
  port = typeof addr === "object" && addr ? addr.port : 0;
});

afterAll(async () => {
  await daemon?.close();
  await fsp.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  for (const run of runs) {
    expect(run.stdout).not.toContain(SECRET);
    expect(run.stderr).not.toContain(SECRET);
  }
});

describe("isocan keys --mine", () => {
  it("refuses a key on argv even with --mine", async () => {
    const run = await keys(["set", "gemini", SECRET, "--mine"]);
    expect(run.code).toBe(1);
    expect(run.stderr).toMatch(/refusing a key on the command line/);
  });

  it("sets from stdin, lists via ls --mine, and removes via rm --mine without ever printing the secret", async () => {
    const before = await keys(["ls", "--mine", "--json"]);
    expect(before.code, before.stderr).toBe(0);
    const beforeJson = JSON.parse(before.stdout) as { keys: Array<{ provider: string; present: boolean; source: string }> };
    expect(beforeJson.keys.find((k) => k.provider === "gemini")).toEqual({
      provider: "gemini",
      present: false,
      source: "none",
    });

    const set = await runCliWithInput(["keys", "set", "gemini", "--mine", "--json"], `${SECRET}\n`, { env: env(), cwd: home });
    runs.push(set);
    expect(set.code, set.stderr).toBe(0);
    expect(JSON.parse(set.stdout)).toEqual({
      provider: "gemini",
      version: 1,
      credentialRef: "user:usr_priya:gemini:v1",
    });

    const listed = await keys(["ls", "--mine"]);
    expect(listed.code, listed.stderr).toBe(0);
    expect(listed.stdout).toMatch(/gemini\s+v1/);
    expect(listed.stdout).toMatch(/user/);

    const rm = await keys(["rm", "gemini", "--mine", "--json"]);
    expect(rm.code, rm.stderr).toBe(0);
    expect(JSON.parse(rm.stdout)).toEqual({ provider: "gemini", removed: true });

    const rmAgain = await keys(["rm", "gemini", "--mine", "--json"]);
    expect(rmAgain.code, rmAgain.stderr).toBe(0);
    expect(JSON.parse(rmAgain.stdout)).toEqual({ provider: "gemini", removed: false });
  });
});
