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
  newCanvasId,
  type Actor,
  type StoredBadge,
} from "@isocan/core";
import { startDaemon, type Daemon } from "../../../server/src/daemon.ts";
import {
  WORKSPACE_IMPORT_ROUTE,
  WORKSPACE_PROPS,
  WORKSPACE_SYNC_ROUTE,
  parseWorkspaceUrl,
  workspaceModule,
  type WorkspaceImportResponse,
  type WorkspaceSyncResponse,
} from "../src/core.ts";
import type { WorkspaceFetchSeam } from "../src/server.ts";

const cleanup: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (cleanup.length > 0) {
    await cleanup.pop()!();
  }
});

async function mkHome(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-workspace-test-"));
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
      actor: { id: "", name: "Acme Writer" },
      op: { type: "actor.claim", sessionKey: "test:acme-ws", name: "Acme Writer" },
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
      op: { type: "project.create", canvasId, title: "Acme Workspace Canvas" },
    }),
  });
  expect(res.status).toBe(200);
  return canvasId;
}

describe("@isocan/workspace core", () => {
  it("parses Google Docs, Sheets, and Slides URLs and rejects non-workspace URLs", () => {
    const doc = parseWorkspaceUrl("https://docs.google.com/document/d/1AcmeDocId123456/edit");
    expect(doc).toMatchObject({ kind: "docs", docId: "1AcmeDocId123456", mimeType: "text/markdown" });

    const sheet = parseWorkspaceUrl("https://docs.google.com/spreadsheets/u/0/d/1AcmeSheetId98765/edit#gid=0");
    expect(sheet).toMatchObject({ kind: "sheets", docId: "1AcmeSheetId98765", mimeType: "text/csv" });

    const slides = parseWorkspaceUrl("https://docs.google.com/presentation/d/1AcmeDeckId54321/edit");
    expect(slides).toMatchObject({ kind: "slides", docId: "1AcmeDeckId54321", mimeType: "text/html" });

    expect(parseWorkspaceUrl("https://example.com/document/d/12345678")).toBeNull();
    expect(parseWorkspaceUrl("javascript:alert(1)")).toBeNull();
  });
});

describe("@isocan/workspace server routes", () => {
  it("imports a Google Doc via workspaceFetch seam and stacks a new version on sync", async () => {
    const home = await mkHome();
    let revision = 1;
    let nowMs = Date.parse("2026-11-21T10:00:00.000Z");

    const workspaceFetch: WorkspaceFetchSeam = async (parsed) => {
      if (revision === 1) {
        return { title: "Acme Q4 Plan", content: `# Acme Q4 Plan (${parsed.docId})\nInitial draft.\n` };
      }
      return { title: "Acme Q4 Plan", content: `# Acme Q4 Plan (${parsed.docId})\nUpdated revision 2.\n` };
    };

    const daemon = await boot(home, {
      modules: {
        workspace: { workspaceFetch, now: () => nowMs },
      },
    });
    const base = daemonBase(daemon);
    const editor = await mintEditor(base);
    const canvasId = await createCanvas(base, editor.badge, editor.actor);

    const url = "https://docs.google.com/document/d/1AcmePlanDoc99999/edit";
    const impRes = await fetch(`${base}${WORKSPACE_IMPORT_ROUTE}`, {
      method: "POST",
      headers: authHeaders(editor.badge),
      body: JSON.stringify({ canvasId, url, actor: editor.actor }),
    });
    expect(impRes.status).toBe(200);
    const imported = (await impRes.json()) as WorkspaceImportResponse;
    expect(imported.kind).toBe("docs");
    expect(imported.docId).toBe("1AcmePlanDoc99999");
    expect(imported.syncedAt).toBe("2026-11-21T10:00:00.000Z");

    const snap1 = await daemon.engine.getSnapshot(canvasId);
    const item1 = snap1.canvas.items[imported.itemId]!;
    expect(item1.versions).toHaveLength(1);
    expect(item1.properties[WORKSPACE_PROPS.kind]).toBe("docs");
    expect(item1.properties[WORKSPACE_PROPS.docId]).toBe("1AcmePlanDoc99999");
    expect(item1.properties[WORKSPACE_PROPS.url]).toBe(url);
    expect(workspaceModule.contextPieces?.(snap1.canvas)[0]?.size).toContain("Acme Q4 Plan");

    // Advance revision and sync -> stacks version 2 via item.addVersion
    revision = 2;
    nowMs = Date.parse("2026-11-21T11:30:00.000Z");

    const syncRes = await fetch(`${base}${WORKSPACE_SYNC_ROUTE}`, {
      method: "POST",
      headers: authHeaders(editor.badge),
      body: JSON.stringify({ canvasId, itemId: imported.itemId, actor: editor.actor }),
    });
    expect(syncRes.status).toBe(200);
    const synced = (await syncRes.json()) as WorkspaceSyncResponse;
    expect(synced.versionId).not.toBe(imported.versionId);
    expect(synced.syncedAt).toBe("2026-11-21T11:30:00.000Z");

    const snap2 = await daemon.engine.getSnapshot(canvasId);
    const item2 = snap2.canvas.items[imported.itemId]!;
    expect(item2.versions).toHaveLength(2);
    expect(item2.currentVersionId).toBe(synced.versionId);
    expect(item2.properties[WORKSPACE_PROPS.syncedAt]).toBe("2026-11-21T11:30:00.000Z");
  });
});
