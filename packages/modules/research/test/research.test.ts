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
  jobOf,
  newCanvasId,
  type Actor,
  type StoredBadge,
} from "@isocan/core";
import { CREDENTIAL_REF_PROP } from "@isocan/core/keys";
import { startDaemon, type Daemon } from "../../../server/src/daemon.ts";
import type { JobClock } from "../../../server/src/jobs.ts";
import {
  RESEARCH_JOB_KIND,
  RESEARCH_PROPS,
  RESEARCH_RUN_ROUTE,
  formatResearchMarkdown,
  parseResearchSources,
  researchFilename,
  validateResearchQuery,
  type ResearchRunResponse,
} from "../src/core.ts";

const cleanup: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (cleanup.length > 0) {
    const fn = cleanup.pop()!;
    await fn();
  }
});

class VirtualClock implements JobClock {
  private currentMs: number;
  private nextId = 1;
  private timers = new Map<number, { due: number; fn: () => void }>();

  constructor(startIso = "2026-11-21T12:00:00.000Z") {
    this.currentMs = Date.parse(startIso);
  }

  now = (): number => this.currentMs;

  setTimeout = (fn: () => void, ms: number): unknown => {
    const id = this.nextId++;
    this.timers.set(id, { due: this.currentMs + ms, fn });
    return id;
  };

  clearTimeout = (handle: unknown): void => {
    this.timers.delete(handle as number);
  };

  async advance(ms: number, settle: () => Promise<void>): Promise<void> {
    const target = this.currentMs + ms;
    while (true) {
      let nextKey: number | null = null;
      let nextDue = Infinity;
      for (const [id, t] of this.timers) {
        if (t.due <= target && t.due < nextDue) {
          nextDue = t.due;
          nextKey = id;
        }
      }
      if (nextKey === null) break;
      const entry = this.timers.get(nextKey)!;
      this.timers.delete(nextKey);
      this.currentMs = entry.due;
      entry.fn();
      await settle();
    }
    this.currentMs = target;
  }
}

async function mkHome(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-research-test-"));
  cleanup.push(() => fs.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));
  return dir;
}

function daemonBase(d: Daemon): string {
  const addr = d.app.server.address() as AddressInfo;
  return `http://127.0.0.1:${addr.port}`;
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

function authHeaders(badge: StoredBadge, json = false): Record<string, string> {
  return {
    ...bearerHeader(badge),
    [CLIENT_FEATURES_HEADER]: CURRENT_CLIENT_FEATURES,
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
}

async function mintEditor(base: string, sessionKey = "test:acme-research"): Promise<{ badge: StoredBadge; actor: Actor }> {
  const knocked = await askTheDoor(base);
  if (!("badge" in knocked)) throw new Error(`door refused: ${knocked.refused.error}`);
  const { badge } = knocked;
  const claimRes = await fetch(`${base}/api/ops`, {
    method: "POST",
    headers: authHeaders(badge, true),
    body: JSON.stringify({
      canvasId: null,
      actor: { id: "", name: "Acme Editor" },
      op: { type: "actor.claim", sessionKey, name: "Acme Editor" },
    }),
  });
  expect(claimRes.status).toBe(200);
  const claimed = (await claimRes.json()) as { envelope: { actor: Actor } };
  return { badge, actor: claimed.envelope.actor };
}

async function createCanvas(base: string, badge: StoredBadge, actor: Actor): Promise<string> {
  const canvasId = newCanvasId();
  const res = await fetch(`${base}/api/ops`, {
    method: "POST",
    headers: authHeaders(badge, true),
    body: JSON.stringify({
      canvasId: null,
      actor,
      op: { type: "project.create", canvasId, title: "Acme Research Canvas" },
    }),
  });
  expect(res.status).toBe(200);
  return canvasId;
}

describe("@isocan/research core", () => {
  it("validates queries, formats cited markdown, and parses sources", () => {
    expect(validateResearchQuery("  Acme battery chemistry  ")).toEqual({ ok: true, query: "Acme battery chemistry" });
    expect(validateResearchQuery("   ").ok).toBe(false);
    expect(researchFilename("Acme Widget Benchmarks!")).toBe("acme-widget-benchmarks-report.md");

    const md = formatResearchMarkdown("Acme Query", "Summary findings.", [
      { title: "Acme Whitepaper", url: "https://acme.example/paper" },
    ]);
    expect(md).toContain("# Acme Query");
    expect(md).toContain("Summary findings.");
    expect(md).toContain("- [Acme Whitepaper](https://acme.example/paper)");

    expect(parseResearchSources(JSON.stringify([{ title: "Acme", url: "https://acme.example" }]))).toEqual([
      { title: "Acme", url: "https://acme.example" },
    ]);
  });
});

describe("@isocan/research server route + home-polled job runner", () => {
  it("creates placeholder immediately (202), polls to completion, and lands cited markdown version", async () => {
    const home = await mkHome();
    const clock = new VirtualClock("2026-11-21T14:00:00.000Z");
    const FAKE_KEY = "acme-research-secret-KEY-7777";
    let pollCount = 0;

    const fakeFetch: typeof fetch = async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (method === "POST" && url.endsWith("/v1beta/interactions")) {
        const body = JSON.parse(String(init?.body ?? "{}")) as { deep?: boolean; tools?: unknown[] };
        expect(body.deep).toBe(true);
        expect(body.tools).toEqual([{ type: "google_search" }]);
        return new Response(
          JSON.stringify({ id: "res_acme_1", status: "in_progress" }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (method === "GET" && url.endsWith("/v1beta/interactions/res_acme_1")) {
        pollCount++;
        if (pollCount === 1) {
          return new Response(
            JSON.stringify({ id: "res_acme_1", status: "in_progress", progress: "reading sources" }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        return new Response(
          JSON.stringify({
            id: "res_acme_1",
            status: "completed",
            output_text: "Acme widgets improved efficiency by 34% in controlled tests.",
            groundingMetadata: {
              groundingChunks: [
                { web: { uri: "https://acme.example/study-1", title: "Acme Efficiency Study" } },
                { web: { uri: "https://test.example/benchmark", title: "Test Benchmark Report" } },
              ],
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      throw new Error(`unexpected fetch: ${method} ${url}`);
    };

    const daemon = await boot(home, {
      jobs: { pollIntervalMs: 4_000, clock },
      modules: { research: { key: () => FAKE_KEY, fetch: fakeFetch } },
    });
    const base = daemonBase(daemon);
    const editor = await mintEditor(base);
    const canvasId = await createCanvas(base, editor.badge, editor.actor);

    const startRes = await fetch(`${base}${RESEARCH_RUN_ROUTE}`, {
      method: "POST",
      headers: authHeaders(editor.badge, true),
      body: JSON.stringify({
        canvasId,
        query: "Acme widget efficiency benchmarks",
        deep: true,
        actor: editor.actor,
      }),
    });
    expect(startRes.status).toBe(202);
    const started = (await startRes.json()) as ResearchRunResponse;
    expect(started.itemId).toBe(started.job.itemId);
    expect(started.job.kind).toBe(RESEARCH_JOB_KIND);
    expect(started.job.state).toBe("running");

    // Placeholder item exists immediately
    const snap0 = await daemon.engine.getSnapshot(canvasId);
    const placeholder = snap0.canvas.items[started.itemId]!;
    expect(placeholder).toBeDefined();
    expect(placeholder.versions).toHaveLength(1);
    expect(placeholder.properties[RESEARCH_PROPS.query]).toBe("Acme widget efficiency benchmarks");
    expect(placeholder.properties[RESEARCH_PROPS.deep]).toBe("true");
    expect(placeholder.properties[CREDENTIAL_REF_PROP]).toBe("env:gemini");

    // First poll updates progress
    await clock.advance(4_000, () => daemon.jobs.settled());
    const snap1 = await daemon.engine.getSnapshot(canvasId);
    expect(jobOf(snap1.canvas.items[started.itemId])?.progress).toBe("reading sources");
    expect(jobOf(snap1.canvas.items[started.itemId])?.state).toBe("running");

    // Second poll finishes and lands cited Markdown report as version 2
    await clock.advance(4_000, () => daemon.jobs.settled());
    const snap2 = await daemon.engine.getSnapshot(canvasId);
    const doneItem = snap2.canvas.items[started.itemId]!;
    expect(jobOf(doneItem)?.state).toBe("done");
    expect(doneItem.versions).toHaveLength(2);
    const v2 = doneItem.versions[1]!;
    expect(v2.mimeType).toBe("text/markdown");
    expect(v2.filename).toMatch(/\.md$/);

    const dlRes = await fetch(`${base}/api/projects/${canvasId}/blobs/${v2.blobHash}`, {
      headers: authHeaders(editor.badge),
    });
    const reportMd = await dlRes.text();
    expect(reportMd).toContain("# Acme widget efficiency benchmarks");
    expect(reportMd).toContain("Acme widgets improved efficiency by 34%");
    expect(reportMd).toContain("- [Acme Efficiency Study](https://acme.example/study-1)");
    expect(reportMd).toContain("- [Test Benchmark Report](https://test.example/benchmark)");
  });

  it("scrubs key material when research polling fails", async () => {
    const home = await mkHome();
    const clock = new VirtualClock("2026-11-21T15:00:00.000Z");
    const SECRET_KEY = "acme-research-SECRET-DO-NOT-LEAK";

    const fakeFetch: typeof fetch = async (input, init) => {
      const url = String(input);
      if (init?.method === "POST" && url.endsWith("/v1beta/interactions")) {
        return new Response(JSON.stringify({ id: "res_acme_fail", status: "in_progress" }), { status: 200 });
      }
      return new Response(
        JSON.stringify({ error: { message: `unauthorized key ${SECRET_KEY}` } }),
        { status: 403 },
      );
    };

    const daemon = await boot(home, {
      jobs: { pollIntervalMs: 1_000, clock },
      modules: { research: { key: () => SECRET_KEY, fetch: fakeFetch } },
    });
    const base = daemonBase(daemon);
    const editor = await mintEditor(base, "test:acme-research-fail");
    const canvasId = await createCanvas(base, editor.badge, editor.actor);

    const startRes = await fetch(`${base}${RESEARCH_RUN_ROUTE}`, {
      method: "POST",
      headers: authHeaders(editor.badge, true),
      body: JSON.stringify({
        canvasId,
        query: "Acme failure test",
        actor: editor.actor,
      }),
    });
    expect(startRes.status).toBe(202);
    const started = (await startRes.json()) as ResearchRunResponse;

    await clock.advance(1_000, () => daemon.jobs.settled());
    const snap = await daemon.engine.getSnapshot(canvasId);
    const failedJob = jobOf(snap.canvas.items[started.itemId]);
    expect(failedJob?.state).toBe("failed");
    expect(failedJob?.error).toContain("[key]");
    expect(failedJob?.error).not.toContain(SECRET_KEY);
  });
});
