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

import { afterEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import {
  CLIENT_FEATURES_HEADER,
  CURRENT_CLIENT_FEATURES,
  askTheDoor,
  bearerHeader,
  itemKind,
  newCanvasId,
  type Actor,
  type StoredBadge,
} from "@isocan/core";
import { CREDENTIAL_REF_PROP } from "@isocan/core/keys";
import { modelFor } from "@isocan/core/models";
import { startDaemon, type Daemon } from "../../../server/src/daemon.ts";
import {
  PROTOTYPE_BUILD_ROUTE,
  PROTOTYPE_PROPS,
  prototypeModule,
  validateSelfContainedHtml,
  type PrototypeBuildResponse,
} from "../src/core.ts";

const cleanup: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (cleanup.length > 0) {
    await cleanup.pop()!();
  }
});

async function mkHome(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-prototype-test-"));
  cleanup.push(() => fs.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));
  return dir;
}

function daemonBase(d: Daemon): string {
  return `http://127.0.0.1:${(d.app.server.address() as AddressInfo).port}`;
}

async function boot(home: string, opts: Parameters<typeof startDaemon>[0] = {}): Promise<Daemon> {
  const d = await startDaemon({
    home,
    port: 0,
    contentPort: "off",
    gcIntervalMs: 0,
    blobCheckIntervalMs: 0,
    ...opts,
  });
  cleanup.push(() => d.close());
  return d;
}

function authHeaders(badge: StoredBadge): Record<string, string> {
  return {
    ...bearerHeader(badge),
    [CLIENT_FEATURES_HEADER]: CURRENT_CLIENT_FEATURES,
    "Content-Type": "application/json",
  };
}

async function mintEditor(base: string): Promise<{ badge: StoredBadge; actor: Actor }> {
  const knocked = await askTheDoor(base);
  if (!("badge" in knocked)) throw new Error(`door refused: ${knocked.refused.error}`);
  const claimRes = await fetch(`${base}/api/ops`, {
    method: "POST",
    headers: authHeaders(knocked.badge),
    body: JSON.stringify({
      canvasId: null,
      actor: { id: "", name: "Acme Builder" },
      op: { type: "actor.claim", sessionKey: "test:acme-proto", name: "Acme Builder" },
    }),
  });
  expect(claimRes.status).toBe(200);
  const claimed = (await claimRes.json()) as { envelope: { actor: Actor } };
  return { badge: knocked.badge, actor: claimed.envelope.actor };
}

async function createCanvas(base: string, badge: StoredBadge, actor: Actor): Promise<string> {
  const canvasId = newCanvasId();
  const res = await fetch(`${base}/api/ops`, {
    method: "POST",
    headers: authHeaders(badge),
    body: JSON.stringify({
      canvasId: null,
      actor,
      op: { type: "project.create", canvasId, title: "Acme Prototype Canvas" },
    }),
  });
  expect(res.status).toBe(200);
  return canvasId;
}

describe("@isocan/prototype core", () => {
  it("validates self-contained HTML and rejects external untrusted scripts", () => {
    const fenced = validateSelfContainedHtml("```html\n<main><h1>Acme</h1></main>\n```");
    expect(fenced.ok).toBe(true);
    if (fenced.ok) expect(fenced.html).toContain("<!doctype html>");

    const bad = validateSelfContainedHtml('<html><body><script src="https://evil.example/x.js"></script></body></html>');
    expect(bad.ok).toBe(false);

    expect(validateSelfContainedHtml("just plain text without tags").ok).toBe(false);
  });
});

describe("@isocan/prototype server route", () => {
  it("builds quick/standard sandboxed HTML screens with modelFor('chat') and delegates app tier cleanly", async () => {
    const home = await mkHome();
    const FAKE_KEY = "acme-proto-secret-key-42";
    const expectedModel = modelFor("chat").id;
    let fetchCalls = 0;

    const fakeFetch: typeof fetch = async (input) => {
      fetchCalls++;
      expect(String(input)).toContain(`/models/${encodeURIComponent(expectedModel)}:generateContent`);
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: "```html\n<!doctype html><html><body><main><h1>Acme Timer</h1><button>Start</button></main></body></html>\n```",
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };

    const daemon = await boot(home, {
      modules: {
        prototype: { key: () => FAKE_KEY, fetch: fakeFetch },
      },
    });
    const base = daemonBase(daemon);
    const editor = await mintEditor(base);
    const canvasId = await createCanvas(base, editor.badge, editor.actor);

    // 1. quick tier -> builds screen item
    const quickRes = await fetch(`${base}${PROTOTYPE_BUILD_ROUTE}`, {
      method: "POST",
      headers: authHeaders(editor.badge),
      body: JSON.stringify({
        canvasId,
        prompt: "Minimalist Acme Pomodoro timer",
        tier: "quick",
        title: "Acme Timer",
        actor: editor.actor,
      }),
    });
    expect(quickRes.status).toBe(200);
    const quick = (await quickRes.json()) as PrototypeBuildResponse;
    expect(quick.delegated).toBe(false);
    if (quick.delegated) throw new Error("expected built response");
    expect(quick.tier).toBe("quick");
    expect(quick.model).toBe(expectedModel);
    expect(quick.credentialRef).toBe("env:gemini");

    const snap1 = await daemon.engine.getSnapshot(canvasId);
    const item = snap1.canvas.items[quick.itemId]!;
    expect(itemKind(item)).toBe("screen");
    expect(item.properties[PROTOTYPE_PROPS.tier]).toBe("quick");
    expect(item.properties[PROTOTYPE_PROPS.prompt]).toBe("Minimalist Acme Pomodoro timer");
    expect(item.properties[CREDENTIAL_REF_PROP]).toBe("env:gemini");
    expect(prototypeModule.contextPieces?.(snap1.canvas)[0]?.size).toContain("Acme Timer");

    // 2. Rebuild existing item -> stacks version 2
    const rebuildRes = await fetch(`${base}${PROTOTYPE_BUILD_ROUTE}`, {
      method: "POST",
      headers: authHeaders(editor.badge),
      body: JSON.stringify({
        canvasId,
        itemId: quick.itemId,
        prompt: "Minimalist Acme Pomodoro timer with presets",
        tier: "standard",
        actor: editor.actor,
      }),
    });
    expect(rebuildRes.status).toBe(200);
    const snap2 = await daemon.engine.getSnapshot(canvasId);
    expect(snap2.canvas.items[quick.itemId]!.versions).toHaveLength(2);
    expect(snap2.canvas.items[quick.itemId]!.properties[PROTOTYPE_PROPS.tier]).toBe("standard");

    // 3. app tier -> delegates without calling Gemini
    const beforeAppCalls = fetchCalls;
    const appRes = await fetch(`${base}${PROTOTYPE_BUILD_ROUTE}`, {
      method: "POST",
      headers: authHeaders(editor.badge),
      body: JSON.stringify({
        canvasId,
        prompt: "Full-stack Acme CRM app",
        tier: "app",
        actor: editor.actor,
      }),
    });
    expect(appRes.status).toBe(200);
    const app = (await appRes.json()) as PrototypeBuildResponse;
    expect(app).toEqual({
      delegated: true,
      tier: "app",
      route: "/api/m/workbench/start",
      hint: "App-tier prototypes run as a workbench agent session",
    });
    expect(fetchCalls).toBe(beforeAppCalls);
  });
});
