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
import { promises as fsp } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { CanvasSnapshotResponse, Item } from "@isocan/core";
import {
  CREDENTIAL_REF_PROP,
  LIVE_TOKEN_ROUTE,
  USER_KEYS_IDENTITY_REQUIRED,
  USER_KEYS_ROUTE,
  USER_KEYS_UNAVAILABLE,
  type UserKeyRow,
  type UserKeysListing,
} from "@isocan/core/keys";
import { writeKey } from "@isocan/core/keystore";
import { IMAGE_ROUTE, type ImageResponse } from "@isocan/core/mood";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { MASTER_KEY_FILE_NAME, USER_KEYS_FILE_NAME, USER_KEYS_SECRET_ENV, UserKeyStore, UserKeysUnavailableError } from "../src/user-keys.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

/**
 * **Per-user BYOK keys + `credentialRef`** (Open Stitch phase 0.3):
 * - AES-256-GCM sealed storage on disk (`user-keys.json`, mode `0600`), never plaintext;
 * - User A's key is invisible to and unspendable by User B;
 * - User A's key overrides home/env keys per call and stamps `credentialRef`
 *   (`user:<actorId>:<provider>:v1`, bumping to `v2` on update);
 * - Deleting User A's key falls back cleanly to home/env keys;
 * - Hosted homes without `ISOCAN_KEYS_SECRET` answer 503; with it, BYOK works on hosted homes too.
 *
 * Synthetic fixtures only: Acme, Priya, Ravi, made-up keys.
 */

const PRIYA_GEMINI_V1 = "fake-gemini-acme-PRIYA-V1-DO-NOT-PRINT-1111";
const PRIYA_GEMINI_V2 = "fake-gemini-acme-PRIYA-V2-DO-NOT-PRINT-2222";
const HOME_GEMINI = "fake-gemini-acme-HOME-DO-NOT-PRINT-8888";
const ENV_GEMINI = "fake-gemini-acme-ENV-DO-NOT-PRINT-9999";
const ALL_SECRETS = [PRIYA_GEMINI_V1, PRIYA_GEMINI_V2, HOME_GEMINI, ENV_GEMINI];

const priya = { id: "usr_priya", name: "Priya" };
const ravi = { id: "usr_ravi", name: "Ravi" };
const CANVAS = "prj_acme_byok";
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

describe("UserKeyStore sealed storage (unit)", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fsp.mkdtemp(path.join(os.tmpdir(), "isocan-userkeys-unit-"));
  });

  afterEach(async () => {
    await fsp.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it("seals and unseals round-trip, never writing plaintext to disk, with 0600 modes and monotonic versions", async () => {
    const store = new UserKeyStore({ dataDir: dir, hosted: false, env: {} });
    const first = await store.set("usr_priya", "gemini", PRIYA_GEMINI_V1);
    expect(first).toEqual({
      provider: "gemini",
      version: 1,
      credentialRef: "user:usr_priya:gemini:v1",
    });

    const onDisk = await fsp.readFile(path.join(dir, USER_KEYS_FILE_NAME), "utf8");
    expect(onDisk).not.toContain(PRIYA_GEMINI_V1);
    expect(onDisk).not.toContain("1111");
    if (process.platform !== "win32") {
      expect((await fsp.stat(path.join(dir, USER_KEYS_FILE_NAME))).mode & 0o777).toBe(0o600);
      expect((await fsp.stat(path.join(dir, MASTER_KEY_FILE_NAME))).mode & 0o777).toBe(0o600);
    }

    const unsealed = await store.get("usr_priya", "gemini");
    expect(unsealed).toMatchObject({
      key: PRIYA_GEMINI_V1,
      version: 1,
      credentialRef: "user:usr_priya:gemini:v1",
    });
    expect(await store.get("usr_ravi", "gemini")).toBeNull();

    // Updating bumps version to v2; deleting preserves monotonic counter so next set is v3.
    const second = await store.set("usr_priya", "gemini", PRIYA_GEMINI_V2);
    expect(second).toEqual({ provider: "gemini", version: 2, credentialRef: "user:usr_priya:gemini:v2" });
    expect((await store.get("usr_priya", "gemini"))?.key).toBe(PRIYA_GEMINI_V2);

    expect(await store.delete("usr_priya", "gemini")).toBe(true);
    expect(await store.delete("usr_priya", "gemini")).toBe(false);
    expect(await store.get("usr_priya", "gemini")).toBeNull();

    const third = await store.set("usr_priya", "gemini", PRIYA_GEMINI_V1);
    expect(third.version).toBe(3);
    expect(third.credentialRef).toBe("user:usr_priya:gemini:v3");
  });

  it("binds ciphertext to userId/provider/version via GCM AAD so transplanted blobs fail to unseal", async () => {
    const store = new UserKeyStore({ dataDir: dir, hosted: false, secret: "acme-test-master-secret" });
    await store.set("usr_priya", "gemini", PRIYA_GEMINI_V1);

    const file = path.join(dir, USER_KEYS_FILE_NAME);
    const parsed = JSON.parse(await fsp.readFile(file, "utf8")) as { users: Record<string, Record<string, unknown>> };
    // Transplant Priya's sealed blob under Ravi's userId on disk.
    parsed.users.usr_ravi = { gemini: parsed.users.usr_priya!.gemini };
    await fsp.writeFile(file, JSON.stringify(parsed), { mode: 0o600 });

    await expect(store.get("usr_ravi", "gemini")).rejects.toThrow();
    expect((await store.get("usr_priya", "gemini"))?.key).toBe(PRIYA_GEMINI_V1);
  });

  it("refuses hosted homes without ISOCAN_KEYS_SECRET and never creates a local master key there", async () => {
    const store = new UserKeyStore({ dataDir: dir, hosted: true, env: {} });
    await expect(store.ensureConfigured()).rejects.toThrow(UserKeysUnavailableError);
    await expect(store.set("usr_priya", "gemini", PRIYA_GEMINI_V1)).rejects.toThrow(USER_KEYS_SECRET_ENV);
    await expect(fsp.stat(path.join(dir, MASTER_KEY_FILE_NAME))).rejects.toMatchObject({ code: "ENOENT" });
    // Reading an absent file returns null rather than breaking unrelated hosted calls.
    expect(await store.get("usr_priya", "gemini")).toBeNull();
  });
});

describe("HTTP /api/me/keys and per-call override on module routes", () => {
  let home: string;
  let daemon: Daemon;
  let base: string;
  let priyaBadge: TestBadge;
  let raviBadge: TestBadge;
  let seenKeys: string[];
  let bodies: string[];
  let logged: string[];
  let savedEnvGemini: string | undefined;

  const drawn = () =>
    new Response(
      JSON.stringify({
        id: "int_acme",
        object: "interaction",
        status: "completed",
        steps: [{ type: "model_output", content: [{ type: "image", mime_type: "image/png", data: PNG.toString("base64") }] }],
      }),
      { status: 200 },
    );

  beforeEach(async () => {
    savedEnvGemini = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    seenKeys = [];
    bodies = [];
    logged = [];
    for (const level of ["log", "warn", "error", "info"] as const) {
      vi.spyOn(console, level).mockImplementation((...args: unknown[]) => void logged.push(args.map(String).join(" ")));
    }
    home = await fsp.mkdtemp(path.join(os.tmpdir(), "isocan-userkeys-http-"));
    await fsp.writeFile(path.join(home, "identity.json"), JSON.stringify(priya));
    await writeKey(home, "gemini", HOME_GEMINI);
    const fakeFetch = (async (_url: string, init: RequestInit) => {
      const key = new Headers(init.headers).get("x-goog-api-key") ?? "";
      seenKeys.push(key);
      if (String(_url).includes("auth_tokens")) {
        return new Response(JSON.stringify({ name: "auth_tokens/acme-live-1" }), { status: 200 });
      }
      return drawn();
    }) as unknown as typeof fetch;

    daemon = await startDaemon({
      port: 0,
      home,
      auth: null,
      contentPort: "off",
      image: { fetch: fakeFetch, perMinute: 10 },
      liveToken: { fetch: fakeFetch, perMinute: 10 },
    });
    const addr = daemon.app.server.address();
    base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
    priyaBadge = await mintTestBadge(base);
    await priyaBadge.speakAs(priya);
    raviBadge = await mintTestBadge(base);
    await raviBadge.speakAs(ravi);

    const made = await fetch(`${base}/api/ops`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...priyaBadge.headers },
      body: JSON.stringify({ canvasId: null, actor: priya, op: { type: "project.create", canvasId: CANVAS, title: "Acme BYOK" } }),
    });
    expect(made.ok).toBe(true);
  });

  afterEach(async () => {
    await daemon.close();
    vi.restoreAllMocks();
    await fsp.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    if (savedEnvGemini === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = savedEnvGemini;
    for (const text of [...bodies, ...logged]) {
      for (const secret of ALL_SECRETS) expect(text).not.toContain(secret);
    }
  });

  async function api(badge: TestBadge | null, method: string, route: string, body?: unknown) {
    const res = await fetch(`${base}${route}`, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(badge ? badge.headers : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const text = await res.text();
    bodies.push(text);
    return { status: res.status, text, json: text ? JSON.parse(text) : null };
  }

  const rowOf = (listing: UserKeysListing, provider: string): UserKeyRow =>
    listing.keys.find((r) => r.provider === provider)!;

  const snapshot = async (): Promise<CanvasSnapshotResponse> => daemon.engine.getSnapshot(CANVAS);
  const itemsByRun = async (run: string): Promise<Item[]> =>
    Object.values((await snapshot()).canvas.items).filter((i) => i.properties.moodRun === run);

  it("refuses unauthenticated callers and anonymous badges with 401", async () => {
    const noBadge = await api(null, "GET", USER_KEYS_ROUTE);
    expect(noBadge.status).toBe(401);

    const anon = await mintTestBadge(base);
    const anonGet = await api(anon, "GET", USER_KEYS_ROUTE);
    expect(anonGet.status).toBe(401);
    expect(anonGet.json.code).toBe(USER_KEYS_IDENTITY_REQUIRED);

    const anonPut = await api(anon, "PUT", `${USER_KEYS_ROUTE}/gemini`, { key: PRIYA_GEMINI_V1 });
    expect(anonPut.status).toBe(401);
    expect(anonPut.json.code).toBe(USER_KEYS_IDENTITY_REQUIRED);
  });

  it("isolates User A's key from User B (User B sees none / gets 404 on delete and cannot spend User A's key)", async () => {
    const put = await api(priyaBadge, "PUT", `${USER_KEYS_ROUTE}/gemini`, { key: PRIYA_GEMINI_V1 });
    expect(put.status, put.text).toBe(200);
    expect(put.json).toEqual({
      provider: "gemini",
      version: 1,
      credentialRef: "user:usr_priya:gemini:v1",
    });

    // Priya sees her own key (present: true, source: "user"), never the plaintext.
    const priyaList = await api(priyaBadge, "GET", USER_KEYS_ROUTE);
    expect(priyaList.status).toBe(200);
    expect(rowOf(priyaList.json, "gemini")).toMatchObject({
      provider: "gemini",
      present: true,
      version: 1,
      source: "user",
    });
    expect(rowOf(priyaList.json, "gemini").updatedAt).toBeTruthy();

    // Ravi cannot see Priya's key, cannot delete it (404), and cannot spend it (403 owner-only on home key).
    const raviList = await api(raviBadge, "GET", USER_KEYS_ROUTE);
    expect(raviList.status).toBe(200);
    expect(rowOf(raviList.json, "gemini")).toEqual({
      provider: "gemini",
      present: false,
      source: "none",
    });

    const raviDel = await api(raviBadge, "DELETE", `${USER_KEYS_ROUTE}/gemini`);
    expect(raviDel.status).toBe(404);
    expect(raviDel.json.removed).toBe(false);

    const raviVoice = await api(raviBadge, "POST", LIVE_TOKEN_ROUTE, { canvasId: CANVAS });
    expect(raviVoice.status).toBe(403);
    expect(seenKeys).toEqual([]);
  });

  it("overrides home and env keys per call, stamps credentialRef v1 -> v2, and falls back cleanly after delete", async () => {
    // Baseline: with home key only, item stamps home:gemini.
    const baseline = await api(priyaBadge, "POST", IMAGE_ROUTE, { canvasId: CANVAS, actor: priya, prompt: "warm ceramic studio", n: 1 });
    expect(baseline.status, baseline.text).toBe(200);
    expect(seenKeys.at(-1)).toBe(HOME_GEMINI);
    const baseItems = await itemsByRun((baseline.json as ImageResponse).run);
    expect(baseItems).toHaveLength(1);
    expect(baseItems[0]!.properties[CREDENTIAL_REF_PROP]).toBe("home:gemini");

    // Set env key too: Priya's per-user key must override BOTH home and env keys.
    process.env.GEMINI_API_KEY = ENV_GEMINI;
    const put1 = await api(priyaBadge, "PUT", `${USER_KEYS_ROUTE}/gemini`, { key: PRIYA_GEMINI_V1 });
    expect(put1.status).toBe(200);
    expect(put1.json.credentialRef).toBe("user:usr_priya:gemini:v1");

    const run1 = await api(priyaBadge, "POST", IMAGE_ROUTE, { canvasId: CANVAS, actor: priya, prompt: "linocut print shop", n: 1 });
    expect(run1.status, run1.text).toBe(200);
    expect(seenKeys.at(-1)).toBe(PRIYA_GEMINI_V1);
    const items1 = await itemsByRun((run1.json as ImageResponse).run);
    expect(items1[0]!.properties[CREDENTIAL_REF_PROP]).toBe("user:usr_priya:gemini:v1");

    // Update Priya's key -> bumps to v2, next call uses V2 and stamps v2.
    const put2 = await api(priyaBadge, "PUT", `${USER_KEYS_ROUTE}/gemini`, { key: PRIYA_GEMINI_V2 });
    expect(put2.status).toBe(200);
    expect(put2.json).toEqual({ provider: "gemini", version: 2, credentialRef: "user:usr_priya:gemini:v2" });

    const run2 = await api(priyaBadge, "POST", IMAGE_ROUTE, { canvasId: CANVAS, actor: priya, prompt: "botanical conservatory", n: 1 });
    expect(run2.status, run2.text).toBe(200);
    expect(seenKeys.at(-1)).toBe(PRIYA_GEMINI_V2);
    const items2 = await itemsByRun((run2.json as ImageResponse).run);
    expect(items2[0]!.properties[CREDENTIAL_REF_PROP]).toBe("user:usr_priya:gemini:v2");

    // Delete Priya's key -> falls back cleanly to env key (env:gemini).
    const del = await api(priyaBadge, "DELETE", `${USER_KEYS_ROUTE}/gemini`);
    expect(del.status).toBe(200);
    expect(del.json).toEqual({ provider: "gemini", removed: true });

    const run3 = await api(priyaBadge, "POST", IMAGE_ROUTE, { canvasId: CANVAS, actor: priya, prompt: "paper bookshop", n: 1 });
    expect(run3.status, run3.text).toBe(200);
    expect(seenKeys.at(-1)).toBe(ENV_GEMINI);
    const items3 = await itemsByRun((run3.json as ImageResponse).run);
    expect(items3[0]!.properties[CREDENTIAL_REF_PROP]).toBe("env:gemini");

    // Remove env key -> falls back cleanly to home keys.json (home:gemini).
    delete process.env.GEMINI_API_KEY;
    const run4 = await api(priyaBadge, "POST", IMAGE_ROUTE, { canvasId: CANVAS, actor: priya, prompt: "stone courtyard", n: 1 });
    expect(run4.status, run4.text).toBe(200);
    expect(seenKeys.at(-1)).toBe(HOME_GEMINI);
    const items4 = await itemsByRun((run4.json as ImageResponse).run);
    expect(items4[0]!.properties[CREDENTIAL_REF_PROP]).toBe("home:gemini");
  });

  it("returns 503 on hosted homes without ISOCAN_KEYS_SECRET, and unlocks BYOK media on hosted homes when configured", async () => {
    const hostedDir = await fsp.mkdtemp(path.join(os.tmpdir(), "isocan-userkeys-hosted-"));
    const hostedSeen: string[] = [];
    const hostedFetch = (async (_url: string, init: RequestInit) => {
      hostedSeen.push(new Headers(init.headers).get("x-goog-api-key") ?? "");
      return new Response(JSON.stringify({ name: "auth_tokens/acme-hosted-1" }), { status: 200 });
    }) as unknown as typeof fetch;

    const unconfigured = await startDaemon({
      port: 0,
      home: hostedDir,
      auth: null,
      contentPort: "off",
      servesWorld: true,
      userKeys: { env: {} },
    });
    try {
      const addr = unconfigured.app.server.address();
      const hBase = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
      const badge = await mintTestBadge(hBase);
      await badge.speakAs(ravi);
      const res = await fetch(`${hBase}${USER_KEYS_ROUTE}`, { headers: badge.headers });
      expect(res.status).toBe(503);
      const json = (await res.json()) as { code: string; error: string };
      expect(json.code).toBe(USER_KEYS_UNAVAILABLE);
      expect(json.error).toContain(USER_KEYS_SECRET_ENV);
    } finally {
      await unconfigured.close();
    }

    const configured = await startDaemon({
      port: 0,
      home: hostedDir,
      auth: null,
      contentPort: "off",
      servesWorld: true,
      userKeys: { secret: "hosted-acme-secret-key" },
      liveToken: { fetch: hostedFetch, perMinute: 5 },
    });
    try {
      const addr = configured.app.server.address();
      const hBase = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
      const badge = await mintTestBadge(hBase);
      await badge.speakAs(ravi);
      const made = await fetch(`${hBase}/api/ops`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...badge.headers },
        body: JSON.stringify({ canvasId: null, actor: ravi, op: { type: "project.create", canvasId: "prj_acme_hosted", title: "Acme Hosted" } }),
      });
      expect(made.ok).toBe(true);

      // Hosted home has no operator Gemini key -> 503 before BYOK.
      const before = await fetch(`${hBase}${LIVE_TOKEN_ROUTE}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...badge.headers },
        body: JSON.stringify({ canvasId: "prj_acme_hosted" }),
      });
      expect(before.status).toBe(503);

      // Ravi stores his own Gemini key sealed in the hosted home -> voice route works with Ravi's key!
      const put = await fetch(`${hBase}${USER_KEYS_ROUTE}/gemini`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...badge.headers },
        body: JSON.stringify({ key: PRIYA_GEMINI_V1 }),
      });
      expect(put.status).toBe(200);

      const after = await fetch(`${hBase}${LIVE_TOKEN_ROUTE}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...badge.headers },
        body: JSON.stringify({ canvasId: "prj_acme_hosted" }),
      });
      expect(after.status).toBe(200);
      expect(hostedSeen).toEqual([PRIYA_GEMINI_V1]);
    } finally {
      await configured.close();
      await fsp.rm(hostedDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });
});
