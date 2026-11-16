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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileBadgeStore } from "@isocan/server";
import { ApiError, DaemonRoutes } from "../src/routes.ts";

let home: string;

beforeEach(async () => {
  home = await mkdtemp(path.join(os.tmpdir(), "isocan-badge-recovery-"));
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

describe("a definitive refusal while recovering a badge", () => {
  it.each([
    { status: 403, code: "not-admitted", error: "Acme home refuses this network. Write to acme@example.invalid." },
    { status: 429, code: "mint-limited", error: "Acme home is metering new badges. Try again in 60 seconds." },
  ])("reports the door's $status and never retries the group write", async (refusal) => {
    const client = new DaemonRoutes("https://acme.invalid", fileBadgeStore(home, "https://acme.invalid"));
    const reclaim = vi.fn(async () => {});
    client.reclaimWith(reclaim);
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ error: "a badge is required — ask the door for one", code: "no-badge" }, { status: 401 }))
      .mockResolvedValueOnce(Response.json(refusal, { status: refusal.status }));
    vi.stubGlobal("fetch", request);

    const result = client.changeGroup("c_acme", { id: "usr_acme", name: "Acme" }, { kind: "ungroup", itemIds: ["itm_acme"] }, "op_acme");
    await expect(result).rejects.toBeInstanceOf(ApiError);
    await expect(result).rejects.toMatchObject({ status: refusal.status, code: refusal.code, message: refusal.error });

    // The initial write was rejected before admission. Recovery reaches the
    // real door helper, and its refusal ends the act without a second write.
    expect(request.mock.calls.map(([url, options]) => [url, options?.method])).toEqual([
      ["https://acme.invalid/api/ops", "POST"],
      ["https://acme.invalid/api/door", "POST"],
    ]);
    expect(JSON.parse(String(request.mock.calls[0]![1]?.body))).toMatchObject({
      canvasId: "c_acme", opId: "op_acme", op: { type: "group.change", action: { kind: "ungroup", itemIds: ["itm_acme"] } },
    });
    expect(JSON.parse(String(request.mock.calls[1]![1]?.body))).toEqual({ carrier: "bearer" });
    expect(reclaim).not.toHaveBeenCalled();
    expect(await readdir(home)).toEqual([]);
  });
});
