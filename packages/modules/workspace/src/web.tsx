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

import { useState, type ComponentType } from "react";
import type { InspectorFacts, WebModule } from "@isocan/core";
import {
  WORKSPACE_PROPS,
  WORKSPACE_SYNC_ROUTE,
  workspaceModule,
  type WorkspaceSyncResponse,
} from "./core.ts";

export function WorkspaceInspector({ canvasId, item, host }: InspectorFacts) {
  const url = item.properties[WORKSPACE_PROPS.url];
  const kind = item.properties[WORKSPACE_PROPS.kind];
  const syncedAt = item.properties[WORKSPACE_PROPS.syncedAt];
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  if (!url) return null;

  async function onSync() {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    try {
      const res = await fetch(WORKSPACE_SYNC_ROUTE, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          canvasId,
          itemId: item.id,
          actor: host.viewer,
        }),
      });
      const body = (await res.json().catch(() => null)) as (Partial<WorkspaceSyncResponse> & { error?: string }) | null;
      if (!res.ok) throw new Error(body?.error ?? `sync failed (${res.status})`);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Could not sync document.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="workspace-inspector" aria-label="Workspace source">
      <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px" }}>
        <div>
          <strong>{kind ? kind.toUpperCase() : "Workspace"}</strong>{" "}
          <a href={url} target="_blank" rel="noopener noreferrer">
            Open source ↗
          </a>
        </div>
        {syncedAt ? <div style={{ opacity: 0.7 }}>Last synced: {syncedAt}</div> : null}
        {problem ? (
          <p role="alert" style={{ margin: 0 }}>
            {problem}
          </p>
        ) : null}
        <button type="button" className="btn" disabled={busy} onClick={() => void onSync()}>
          {busy ? "Syncing…" : "Sync now"}
        </button>
      </div>
    </section>
  );
}

export const workspaceWeb: WebModule<never, never, ComponentType<InspectorFacts>> = {
  core: workspaceModule,
  inspectors: [
    {
      kinds: ["document", "screen", "file"],
      label: "Workspace",
      component: WorkspaceInspector,
    },
  ],
};

export default workspaceWeb;
