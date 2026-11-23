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
import { MODEL_ROLES, MODELS } from "@isocan/core/models";
import { cliEnv, runCli } from "./cli.ts";

/**
 * **`isocan models`** (Open Stitch phase 0.4), against the real binary: one
 * row per role from the manifest, the provider, and whether this home holds
 * a key for it — from `keys.json` or the environment — without ever printing
 * one. No daemon, no network. Fixtures are synthetic: made-up keys.
 */

const GEMINI = "fake-gemini-acme_CLI_DO_NOT_PRINT_1234567890gemi";
const ANTHROPIC = "sk-ant-fake_CLI_DO_NOT_PRINT_wxyz";
const SPENDER_ENV = ["TYPESAFE_API_KEY", "ISOCAN_TEXT_API_KEY", "ISOCAN_TEXT_PROVIDER", "ISOCAN_TEXT_MODEL", "ISOCAN_IMAGE_MODEL", "ISOCAN_SUMMARY_MODEL", "GEMINI_API_KEY"];

let home: string;
beforeAll(async () => {
  home = await fsp.mkdtemp(path.join(os.tmpdir(), "isocan-cli-models-"));
});
afterAll(async () => {
  await fsp.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

/** The child's environment: this home, none of the runner's own keys or model overrides. */
const env = (extra: NodeJS.ProcessEnv = {}) =>
  cliEnv({
    ISOCAN_HOME: home,
    ...Object.fromEntries(SPENDER_ENV.map((n) => [n, undefined])),
    ...Object.fromEntries(MODEL_ROLES.map((r) => [`ISOCAN_MODEL_${r.toUpperCase()}`, undefined])),
    ...extra,
  });

interface Row {
  role: string;
  model: string;
  provider: string;
  fallbacks: string[];
  implemented: boolean;
  source: "env" | "default";
  variable?: string;
  key: "env" | "file" | null | "n/a";
}

describe("isocan models", () => {
  it("lists every role with the manifest's id, and no key held in a fresh home", async () => {
    const json = await runCli(["models", "--json"], { env: env() });
    expect(json.code, json.stderr).toBe(0);
    const out = JSON.parse(json.stdout) as { models: Row[] };
    expect(out.models.map((r) => r.role)).toEqual([...MODEL_ROLES]);
    for (const row of out.models) {
      const entry = MODELS[row.role as keyof typeof MODELS];
      expect(row.model, row.role).toBe(entry.id);
      expect(row.source, row.role).toBe("default");
      expect(row.implemented, row.role).toBe(entry.implemented);
      expect(row.key, row.role).toBe(null);
    }
    expect(out.models.find((r) => r.role === "image")).toMatchObject({ model: "gemini-nano-banana-2.1", provider: "gemini" });
    expect(out.models.find((r) => r.role === "judge")).toMatchObject({ model: "jev-latest", provider: "typesafe" });

    const table = await runCli(["models"], { env: env() });
    expect(table.code, table.stderr).toBe(0);
    expect(table.stdout).toMatch(/^ROLE\s+MODEL\s+PROVIDER\s+KEY\s+FROM\s+STATUS/m);
    expect(table.stdout).toMatch(/^image\s+gemini-nano-banana-2\.1\s+gemini\s+no\s+default\s+wired/m);
    expect(table.stdout).toMatch(/^video\s+\S+\s+gemini\s+no\s+default\s+reserved/m);
    expect(table.stdout).toContain(path.join(home, "keys.json"));
  });

  it("says a key is held — from the file or the environment — and never prints it", async () => {
    await fsp.writeFile(path.join(home, "keys.json"), JSON.stringify({ gemini: { key: GEMINI, addedAt: "2026-10-01T00:00:00.000Z" } }), { mode: 0o600 });
    const run = await runCli(["models", "--json"], { env: env({ ISOCAN_TEXT_API_KEY: ANTHROPIC }) });
    expect(run.code, run.stderr).toBe(0);
    const rows = (JSON.parse(run.stdout) as { models: Row[] }).models;
    expect(rows.find((r) => r.role === "image")?.key).toBe("file");
    expect(rows.find((r) => r.role === "live")?.key).toBe("file");
    expect(rows.find((r) => r.role === "text")?.key).toBe("env");
    expect(rows.find((r) => r.role === "summary")?.key).toBe("env");
    expect(rows.find((r) => r.role === "judge")?.key).toBe(null);
    for (const secret of [GEMINI, ANTHROPIC]) {
      expect(run.stdout).not.toContain(secret);
      expect(run.stderr).not.toContain(secret);
    }

    const table = await runCli(["models"], { env: env({ ISOCAN_TEXT_API_KEY: ANTHROPIC }) });
    expect(table.stdout).toMatch(/^image\s+\S+\s+gemini\s+yes\s+default/m);
    expect(table.stdout).toMatch(/^text\s+\S+\s+anthropic\s+yes \(env\)\s+default/m);
    for (const secret of [GEMINI, ANTHROPIC]) expect(table.stdout + table.stderr).not.toContain(secret);
  });

  it("shows an override and which variable gave it", async () => {
    const run = await runCli(["models", "--json"], { env: env({ ISOCAN_MODEL_IMAGE: "gemini-3-pro-image", ISOCAN_TEXT_MODEL: "claude-sonnet-5-5" }) });
    expect(run.code, run.stderr).toBe(0);
    const rows = (JSON.parse(run.stdout) as { models: Row[] }).models;
    expect(rows.find((r) => r.role === "image")).toMatchObject({ model: "gemini-3-pro-image", source: "env", variable: "ISOCAN_MODEL_IMAGE" });
    expect(rows.find((r) => r.role === "text")).toMatchObject({ model: "claude-sonnet-5-5", source: "env", variable: "ISOCAN_TEXT_MODEL" });
    const table = await runCli(["models"], { env: env({ ISOCAN_MODEL_IMAGE: "gemini-3-pro-image" }) });
    expect(table.stdout).toMatch(/^image\s+gemini-3-pro-image\s+gemini\s+yes\s+ISOCAN_MODEL_IMAGE\s+wired/m);
  });
});
