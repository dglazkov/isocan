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

import type { Command } from "commander";
import { MODEL_ROLES, modelFor } from "@isocan/core";
import type { KeyFile } from "@isocan/core/keystore";
import { paths } from "@isocan/server";
import { printJson, printTable } from "./output.ts";

/**
 * **`isocan models` — which model answers each role on this machine**
 * (Open Stitch phase 0.4; the manifest is `@isocan/core/models`).
 *
 * One row per role: the id that would be asked now (the manifest's default,
 * or the environment variable that overrides it), who serves it, whether
 * this machine holds a key for that provider — in `keys.json` or the
 * environment, read the way every spender reads it — and whether anything
 * in this build spends the role yet. Read-only, and it needs no daemon.
 *
 * **Never a key.** It says `yes`, `no`, or which variable — the same rule
 * as `isocan keys ls`, which shows the last four and this shows nothing.
 *
 * The keystore is imported when the verb RUNS, as `keys` and `model` do, so
 * `isocan --version` loads nothing of it. The manifest comes from the core
 * barrel, which startup already holds (mood and semantic-zoom read it for
 * their defaults), so naming it here costs no module.
 */

const load = async () => ({ ...(await import("@isocan/core/keys")), ...(await import("@isocan/core/keystore")) });

/** The home keys.json lives in — the daemon's, so what this says is what the daemon would spend. */
function home(): string {
  return paths.isocanHome();
}

export function registerModels(program: Command): void {
  program
    .command("models")
    .description("Which model answers each role (text, summary, image, live, judge, …), who serves it, and whether this machine holds that provider's key — never the key itself")
    .addHelpText(
      "after",
      `
The manifest (@isocan/core/models) gives every kind of spend — a role — one
checkpoint and its fallbacks. ISOCAN_MODEL_<ROLE> (ISOCAN_MODEL_IMAGE,
ISOCAN_MODEL_LIVE, …) overrides a role; the older ISOCAN_TEXT_MODEL,
ISOCAN_IMAGE_MODEL and ISOCAN_SUMMARY_MODEL still work beneath it. A role
marked "reserved" has a default but nothing in this build spends it yet.

  isocan models                 # the table
  isocan models --json          # the same rows, for a script
  isocan keys                   # the keys themselves (last four, never more)`,
    )
    .action(async (_opts: unknown, cmd: Command) => {
      const m = await load();
      let stored: KeyFile = {};
      let refused: string | null = null;
      try {
        stored = m.readKeyFileSync(home()).keys;
      } catch (err) {
        refused = (err as Error).message;
      }
      const env = process.env;
      // A provider has a key when the environment sets one or the file holds one — `resolveKey`'s rule, without reading the file per row.
      const held = new Map<string, "env" | "file" | null>();
      for (const provider of m.KEY_PROVIDERS) {
        const fromEnv = m.envKeyFor(provider, env);
        held.set(provider, fromEnv ? "env" : stored[provider] ? "file" : null);
      }
      const keyFor = (provider: string): "env" | "file" | null | "n/a" => (held.has(provider) ? held.get(provider)! : "n/a");
      const rows = MODEL_ROLES.map((role) => {
        const r = modelFor(role, { env });
        return { role, model: r.id, provider: r.provider, fallbacks: r.fallbacks, implemented: r.implemented, source: r.source, ...(r.variable ? { variable: r.variable } : {}), key: keyFor(r.provider) };
      });
      if (cmd.optsWithGlobals().json) {
        printJson({ ...(refused ? { refused } : {}), models: rows });
      } else {
        printTable(
          rows.map((r) => ({
            role: r.role,
            model: r.model,
            provider: r.provider,
            key: r.key === "env" ? "yes (env)" : r.key === "file" ? "yes" : r.key === null ? "no" : "—",
            from: r.source === "env" ? r.variable! : "default",
            status: r.implemented ? "wired" : "reserved",
          })),
        );
        console.log(`\n${m.keysFile(home())} — set a key with \`isocan keys set <provider>\`; override a role with ISOCAN_MODEL_<ROLE>`);
      }
      if (refused) {
        console.error(refused);
        process.exitCode = 1;
      }
    });
}
