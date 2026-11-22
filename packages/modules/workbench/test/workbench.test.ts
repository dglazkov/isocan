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
  BROWSER_MIME,
  CLIENT_FEATURES_HEADER,
  CURRENT_CLIENT_FEATURES,
  askTheDoor,
  bearerHeader,
  newCanvasId,
  type Actor,
  type CanvasContents,
  type StoredBadge,
} from "@isocan/core";
import type {
  DevServerInfo,
  SessionArtifact,
  SessionDriver,
  SessionEvent,
  SessionModelInfo,
  SessionStartInput,
  SessionSummary,
} from "@isocan/core/session-driver";
import { startDaemon, type Daemon } from "../../../server/src/daemon.ts";
import {
  WORKBENCH_DEBUG_ROUTE,
  WORKBENCH_DRIVERS_ROUTE,
  WORKBENCH_EMIT_ROUTE,
  WORKBENCH_PROPS,
  WORKBENCH_SEND_ROUTE,
  WORKBENCH_SESSIONS_ROUTE,
  WORKBENCH_START_ROUTE,
  type WorkbenchDebugResponse,
  type WorkbenchDriversResponse,
  type WorkbenchEmitResponse,
  type WorkbenchSessionsResponse,
  type WorkbenchStartResponse,
} from "../src/core.ts";
import { DriverRegistry } from "../src/drivers/registry.ts";

class FakeSessionDriver implements SessionDriver {
  readonly id: string;
  readonly label: string;
  private seq = 0;
  private readonly sessions = new Map<string, SessionSummary>();
  private readonly listeners = new Map<string, Set<(event: SessionEvent) => void>>();
  readonly startedInputs: SessionStartInput[] = [];

  constructor(id: string, label: string) {
    this.id = id;
    this.label = label;
  }

  async available(): Promise<boolean> {
    return true;
  }

  async models(): Promise<SessionModelInfo[]> {
    return [{ id: `${this.id}-default`, label: `${this.label} Default`, default: true }];
  }

  async list(workspace?: string): Promise<SessionSummary[]> {
    const all = [...this.sessions.values()];
    return workspace ? all.filter((s) => s.workspace === workspace) : all;
  }

  async start(input: SessionStartInput): Promise<SessionSummary> {
    this.startedInputs.push(input);
    const id = `${this.id}_sess_${++this.seq}`;
    const now = new Date().toISOString();
    const summary: SessionSummary = {
      id,
      driver: this.id,
      title: input.title ?? `${this.label} #${this.seq}`,
      ...(input.workspace ? { workspace: input.workspace } : {}),
      status: "running",
      createdAt: now,
      updatedAt: now,
    };
    this.sessions.set(id, summary);
    this.listeners.set(id, new Set());
    return summary;
  }

  async send(sessionId: string, text: string): Promise<void> {
    const set = this.listeners.get(sessionId);
    if (!set) throw new Error(`missing session ${sessionId}`);
    const at = new Date().toISOString();
    if (text.includes("http://localhost:5173")) {
      const ev: SessionEvent = {
        kind: "dev_server_ready",
        sessionId,
        at,
        devServer: { url: "http://localhost:5173", port: 5173, host: "localhost", label: "Acme Vite" },
      };
      for (const fn of set) fn(ev);
    }
  }

  async approve(): Promise<void> {}
  async cancel(): Promise<void> {}

  tail(sessionId: string, onEvent: (event: SessionEvent) => void): () => void {
    const set = this.listeners.get(sessionId);
    if (!set) return () => {};
    set.add(onEvent);
    return () => set.delete(onEvent);
  }

  async artifacts(): Promise<SessionArtifact[]> {
    return [];
  }

  async devServers(): Promise<DevServerInfo[]> {
    return [];
  }
}

const cleanup: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (cleanup.length > 0) {
    await cleanup.pop()!();
  }
});

async function mkHome(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-workbench-test-"));
  cleanup.push(() => fs.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));
  return dir;
}

function daemonBase(d: Daemon): string {
  const addr = d.app.server.address() as AddressInfo;
  return `http://127.0.0.1:${addr.port}`;
}

function authHeaders(badge: StoredBadge, json = false): Record<string, string> {
  return {
    ...bearerHeader(badge),
    [CLIENT_FEATURES_HEADER]: CURRENT_CLIENT_FEATURES,
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
}

async function setupDaemonWithDrivers() {
  const home = await mkHome();
  const agDriver = new FakeSessionDriver("antigravity", "Antigravity");
  const ccDriver = new FakeSessionDriver("claude-code", "Claude Code");
  const registry = new DriverRegistry([agDriver, ccDriver]);

  const d = await startDaemon({
    home,
    port: 0,
    contentPort: "off",
    gcIntervalMs: 0,
    blobCheckIntervalMs: 0,
    modules: {
      workbench: { registry },
    },
  });
  cleanup.push(() => d.close());
  const base = daemonBase(d);

  const knocked = await askTheDoor(base);
  if (!("badge" in knocked)) throw new Error("door refused");
  const { badge } = knocked;

  const claimRes = await fetch(`${base}/api/ops`, {
    method: "POST",
    headers: authHeaders(badge, true),
    body: JSON.stringify({
      canvasId: null,
      actor: { id: "", name: "Acme Tester" },
      op: { type: "actor.claim", sessionKey: "test:acme-workbench", name: "Acme Tester" },
    }),
  });
  const claimed = (await claimRes.json()) as { envelope: { actor: Actor } };
  const actor = claimed.envelope.actor;

  const canvasId = newCanvasId();
  await fetch(`${base}/api/ops`, {
    method: "POST",
    headers: authHeaders(badge, true),
    body: JSON.stringify({
      canvasId: null,
      actor,
      op: { type: "project.create", canvasId, title: "Acme Workbench" },
    }),
  });

  return { base, badge, actor, canvasId, agDriver, ccDriver };
}

async function getSnapshot(base: string, badge: StoredBadge, canvasId: string): Promise<CanvasContents> {
  const res = await fetch(`${base}/api/projects/${canvasId}/canvas`, {
    headers: authHeaders(badge),
  });
  expect(res.status).toBe(200);
  const body = (await res.json()) as { canvas: CanvasContents };
  return body.canvas;
}

describe("@isocan/workbench", () => {
  it("supports multi-driver sessions and auto-materializes a site item on dev_server_ready", async () => {
    const { base, badge, actor, canvasId } = await setupDaemonWithDrivers();

    const driversRes = await fetch(`${base}${WORKBENCH_DRIVERS_ROUTE}?canvasId=${canvasId}`, {
      headers: authHeaders(badge),
    });
    expect(driversRes.status).toBe(200);
    const driversBody = (await driversRes.json()) as WorkbenchDriversResponse;
    expect(driversBody.drivers.map((d) => d.id)).toEqual(["antigravity", "claude-code"]);

    const startAg = await fetch(`${base}${WORKBENCH_START_ROUTE}`, {
      method: "POST",
      headers: authHeaders(badge, true),
      body: JSON.stringify({
        canvasId,
        driver: "antigravity",
        title: "Acme AG Session",
        workspace: "/tmp/acme-app",
        actor,
      }),
    });
    expect(startAg.status).toBe(201);
    const agBody = (await startAg.json()) as WorkbenchStartResponse;

    const startCc = await fetch(`${base}${WORKBENCH_START_ROUTE}`, {
      method: "POST",
      headers: authHeaders(badge, true),
      body: JSON.stringify({
        canvasId,
        driver: "claude-code",
        title: "Acme CC Session",
        actor,
      }),
    });
    expect(startCc.status).toBe(201);

    const sessionsRes = await fetch(`${base}${WORKBENCH_SESSIONS_ROUTE}?canvasId=${canvasId}`, {
      headers: authHeaders(badge),
    });
    expect(sessionsRes.status).toBe(200);
    const sessionsBody = (await sessionsRes.json()) as WorkbenchSessionsResponse;
    expect(sessionsBody.sessions).toHaveLength(2);

    // Trigger dev_server_ready on the Antigravity session
    const sendRes = await fetch(`${base}${WORKBENCH_SEND_ROUTE}`, {
      method: "POST",
      headers: authHeaders(badge, true),
      body: JSON.stringify({
        canvasId,
        driver: "antigravity",
        sessionId: agBody.session.id,
        text: "Ready at http://localhost:5173",
      }),
    });
    expect(sendRes.status).toBe(200);

    // Allow async tail handler to submit item.add
    await new Promise((r) => setTimeout(r, 80));

    const canvas = await getSnapshot(base, badge, canvasId);
    const items = Object.values(canvas.items);
    const siteItem = items.find((i) => i.versions.at(-1)?.mimeType === BROWSER_MIME);
    expect(siteItem).toBeDefined();
    expect(siteItem?.properties["parent"]).toBe(agBody.itemId);
    expect(siteItem?.properties[WORKBENCH_PROPS.sessionId]).toBe(agBody.session.id);
  });

  it("materializes OpenNode envelopes with edges and sourceRef upsert", async () => {
    const { base, badge, actor, canvasId } = await setupDaemonWithDrivers();

    const firstRes = await fetch(`${base}${WORKBENCH_EMIT_ROUTE}`, {
      method: "POST",
      headers: authHeaders(badge, true),
      body: JSON.stringify({
        canvasId,
        actor,
        spec: {
          $schema: "openstitch.node.v2",
          upsertBySourceRef: true,
          nodes: [
            { id: "n1", kind: "markdown", title: "Acme Spec", content: "v1", sourceRef: "spec:acme:1" },
            { id: "n2", kind: "sticky", title: "Acme Note", content: "Check", sourceRef: "note:acme:1" },
          ],
          edges: [{ from: "n1", to: "n2", label: "informs" }],
        },
      }),
    });
    expect(firstRes.status).toBe(200);
    const firstBody = (await firstRes.json()) as WorkbenchEmitResponse;
    expect(firstBody.itemIds).toHaveLength(2);
    expect(firstBody.edgeCount).toBe(1);

    // Upsert by sourceRef updates existing item instead of creating a new one
    const secondRes = await fetch(`${base}${WORKBENCH_EMIT_ROUTE}`, {
      method: "POST",
      headers: authHeaders(badge, true),
      body: JSON.stringify({
        canvasId,
        actor,
        spec: {
          $schema: "openstitch.node.v2",
          upsertBySourceRef: true,
          nodes: [
            { id: "n1", kind: "markdown", title: "Acme Spec v2", content: "v2", sourceRef: "spec:acme:1" },
          ],
        },
      }),
    });
    expect(secondRes.status).toBe(200);
    const secondBody = (await secondRes.json()) as WorkbenchEmitResponse;
    expect(secondBody.itemIds).toHaveLength(0);
    expect(secondBody.updatedIds).toContain(firstBody.itemIds[0]);

    const canvas = await getSnapshot(base, badge, canvasId);
    expect(Object.keys(canvas.items)).toHaveLength(2);
    expect(canvas.items[firstBody.itemIds[0]!]?.title).toBe("Acme Spec v2");
  });

  it("launches POST /debug on the chosen driver with item error and context graph", async () => {
    const { base, badge, actor, canvasId, ccDriver } = await setupDaemonWithDrivers();

    const emitRes = await fetch(`${base}${WORKBENCH_EMIT_ROUTE}`, {
      method: "POST",
      headers: authHeaders(badge, true),
      body: JSON.stringify({
        canvasId,
        actor,
        spec: {
          $schema: "openstitch.node.v1",
          nodes: [
            {
              id: "err1",
              kind: "markdown",
              title: "Acme Build Error",
              content: "TypeError: Cannot read properties of undefined",
              properties: { failure: "Build failed on line 42" },
            },
          ],
        },
      }),
    });
    const emitBody = (await emitRes.json()) as WorkbenchEmitResponse;
    const targetId = emitBody.itemIds[0]!;

    const debugRes = await fetch(`${base}${WORKBENCH_DEBUG_ROUTE}`, {
      method: "POST",
      headers: authHeaders(badge, true),
      body: JSON.stringify({
        canvasId,
        itemId: targetId,
        driver: "claude-code",
        mode: "fix",
        workspace: "/tmp/acme-app",
        actor,
      }),
    });
    expect(debugRes.status).toBe(201);
    const debugBody = (await debugRes.json()) as WorkbenchDebugResponse;
    expect(debugBody.targetItemId).toBe(targetId);
    expect(debugBody.session.driver).toBe("claude-code");
    expect(ccDriver.startedInputs.at(-1)?.prompt).toContain("Build failed on line 42");
  });
});
