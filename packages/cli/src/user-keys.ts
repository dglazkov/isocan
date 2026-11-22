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
import { ApiError } from "@isocan/core";
import type { KeyProvider } from "@isocan/core/keys";
import { makeCtx } from "./ctx.ts";
import { printJson, printTable } from "./output.ts";

/**
 * **`isocan keys ls|set|rm --mine`** — per-user BYOK keys sealed on the active
 * home (`/api/me/keys`; Open Stitch phase 0.3). Lazy-imported from `keys.ts`
 * only when `--mine` is passed so `isocan --version` loads zero extra chunks.
 *
 * Never prints secret values; relies on `keys.ts` to read the key from stdin or
 * a hidden prompt (never argv).
 */

export async function listMineKeys(cmd: Command): Promise<void> {
  const ctx = await makeCtx(cmd);
  const listing = await ctx.client.listUserKeys();
  if (ctx.json) {
    printJson({ home: ctx.client.base, ...listing });
    return;
  }
  printTable(
    listing.keys.map((row) => ({
      provider: row.provider,
      mine: row.present ? `v${row.version}` : "not set",
      updated: row.updatedAt ? row.updatedAt.slice(0, 10) : "",
      active: row.source,
    })),
  );
  console.log(`\nhome: ${ctx.client.base}`);
}

export async function setMineKey(cmd: Command, provider: KeyProvider, key: string): Promise<void> {
  const ctx = await makeCtx(cmd);
  const saved = await ctx.client.setUserKey(provider, key);
  if (ctx.json) {
    printJson(saved);
    return;
  }
  console.log(`${saved.provider}: stored sealed for your account (v${saved.version}, ${saved.credentialRef}) on ${ctx.client.base}`);
}

export async function removeMineKey(cmd: Command, provider: KeyProvider): Promise<void> {
  const ctx = await makeCtx(cmd);
  let removed: boolean;
  try {
    ({ removed } = await ctx.client.deleteUserKey(provider));
  } catch (err) {
    if (err instanceof ApiError && err.status === 404 && err.code === "no-user-key") {
      removed = false;
    } else {
      throw err;
    }
  }
  if (ctx.json) {
    printJson({ provider, removed });
    return;
  }
  console.log(
    removed
      ? `${provider}: removed per-user key from ${ctx.client.base}`
      : `${provider}: no stored per-user key on ${ctx.client.base} — nothing to remove`,
  );
}
