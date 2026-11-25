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

import {
  newItemId,
  newOpId,
  newVersionId,
  type Actor,
  type ModuleRequest,
  type ModuleResponse,
  type ServerHost,
  type ServerModule,
} from "@isocan/core";
import {
  WORKSPACE_PROPS,
  parseWorkspaceUrl,
  type ParsedWorkspaceUrl,
  type WorkspaceImportRequest,
  type WorkspaceImportResponse,
  type WorkspaceSyncRequest,
  type WorkspaceSyncResponse,
} from "./core.ts";

const BAD_REQUEST = "workspace-bad-request";
const UPSTREAM = "workspace-upstream";

export type WorkspaceFetchSeam = (
  parsed: ParsedWorkspaceUrl,
  opts: { oauthToken?: string },
) => Promise<{ content: string | Uint8Array; title?: string; mimeType?: string }>;

async function resolveActor(actor: Actor | undefined, host: ServerHost): Promise<Actor | null> {
  if (actor) {
    await host.speaksFor(actor.id);
    return { id: actor.id, name: actor.name };
  }
  return (await host.defaultActor?.()) ?? null;
}

async function fetchWorkspaceDocument(
  parsed: ParsedWorkspaceUrl,
  oauthToken: string | undefined,
  host: ServerHost,
): Promise<{ ok: true; bytes: Uint8Array; title?: string; mimeType: string } | { ok: false; response: ModuleResponse }> {
  const scrub = (s: string) => (oauthToken ? s.split(oauthToken).join("[token]") : s);
  const seam = host.options.workspaceFetch as WorkspaceFetchSeam | undefined;

  try {
    if (typeof seam === "function") {
      const result = await seam(parsed, { ...(oauthToken ? { oauthToken } : {}) });
      const bytes = typeof result.content === "string" ? new TextEncoder().encode(result.content) : result.content;
      return {
        ok: true,
        bytes,
        ...(result.title ? { title: result.title } : {}),
        mimeType: result.mimeType ?? parsed.mimeType,
      };
    }

    const headers: Record<string, string> = {};
    if (oauthToken) headers["authorization"] = `Bearer ${oauthToken}`;
    const res = await host.fetch(parsed.exportUrl, { method: "GET", headers });
    if (!res.ok) {
      return {
        ok: false,
        response: {
          status: 502,
          body: { error: scrub(`workspace export failed (${res.status}) for ${parsed.kind}:${parsed.docId}`), code: UPSTREAM },
        },
      };
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    return {
      ok: true,
      bytes: buf,
      mimeType: parsed.mimeType,
    };
  } catch (err) {
    return {
      ok: false,
      response: {
        status: 502,
        body: {
          error: scrub(`workspace fetch failed: ${err instanceof Error ? err.message : String(err)}`),
          code: UPSTREAM,
        },
      },
    };
  }
}

function checkImport({ body: raw }: { body: unknown }): ModuleResponse | null {
  const body = raw as Partial<WorkspaceImportRequest> | null;
  const bad = (error: string): ModuleResponse => ({ status: 400, body: { error, code: BAD_REQUEST } });
  if (!body || typeof body !== "object") return bad("request body must be a JSON object");
  if (typeof body.canvasId !== "string" || !body.canvasId.trim()) return bad("`canvasId` is required");
  if (typeof body.url !== "string" || !parseWorkspaceUrl(body.url)) {
    return bad("`url` must be a valid Google Docs, Sheets, or Slides URL");
  }
  return null;
}

async function handleImport(req: ModuleRequest, host: ServerHost): Promise<ModuleResponse> {
  const body = req.body as WorkspaceImportRequest;
  const parsed = parseWorkspaceUrl(body.url);
  if (!parsed) {
    return { status: 400, body: { error: "invalid workspace URL", code: BAD_REQUEST } };
  }
  const actor = await resolveActor(body.actor, host);
  if (!actor) {
    return { status: 400, body: { error: "an actor is required to import a workspace document", code: BAD_REQUEST } };
  }

  const fetched = await fetchWorkspaceDocument(parsed, body.oauthToken, host);
  if (!fetched.ok) return fetched.response;

  const filename = `workspace-${parsed.kind}-${parsed.docId}.${parsed.extension}`;
  const blob = await host.putBlob(req.canvasId, fetched.bytes, {
    mimeType: fetched.mimeType,
    filename,
  });

  const syncedAt = new Date(host.now()).toISOString();
  const itemId = newItemId();
  const versionId = newVersionId();
  const title = body.title?.trim() || fetched.title?.trim() || `${parsed.kind.toUpperCase()}: ${parsed.docId.slice(0, 12)}`;

  await host.submit({
    canvasId: req.canvasId,
    actor,
    op: {
      type: "item.add",
      itemId,
      title,
      width: 480,
      height: 360,
      placement: { x: 0, y: 0 },
      version: {
        id: versionId,
        blobHash: blob.blobHash,
        mimeType: fetched.mimeType,
        filename,
        size: blob.size,
      },
      properties: {
        [WORKSPACE_PROPS.kind]: parsed.kind,
        [WORKSPACE_PROPS.docId]: parsed.docId,
        [WORKSPACE_PROPS.url]: parsed.url,
        [WORKSPACE_PROPS.syncedAt]: syncedAt,
      },
    },
  });

  return {
    status: 200,
    body: {
      itemId,
      versionId,
      kind: parsed.kind,
      docId: parsed.docId,
      url: parsed.url,
      syncedAt,
      mimeType: fetched.mimeType,
    } satisfies WorkspaceImportResponse,
  };
}

function checkSync({ body: raw }: { body: unknown }): ModuleResponse | null {
  const body = raw as Partial<WorkspaceSyncRequest> | null;
  const bad = (error: string): ModuleResponse => ({ status: 400, body: { error, code: BAD_REQUEST } });
  if (!body || typeof body !== "object") return bad("request body must be a JSON object");
  if (typeof body.canvasId !== "string" || !body.canvasId.trim()) return bad("`canvasId` is required");
  if (typeof body.itemId !== "string" || !body.itemId.trim()) return bad("`itemId` is required");
  return null;
}

async function handleSync(req: ModuleRequest, host: ServerHost): Promise<ModuleResponse> {
  const body = req.body as WorkspaceSyncRequest;
  const actor = await resolveActor(body.actor, host);
  if (!actor) {
    return { status: 400, body: { error: "an actor is required to sync a workspace item", code: BAD_REQUEST } };
  }

  const snapshot = await host.canvas(req.canvasId);
  const item = snapshot.canvas.items[body.itemId.trim()];
  if (!item) {
    return { status: 404, body: { error: `item not found: ${body.itemId}`, code: BAD_REQUEST } };
  }
  const sourceUrl = item.properties?.[WORKSPACE_PROPS.url];
  const parsed = sourceUrl ? parseWorkspaceUrl(sourceUrl) : null;
  if (!parsed) {
    return {
      status: 400,
      body: { error: `item ${item.id} does not carry a valid workspace.url`, code: BAD_REQUEST },
    };
  }

  const fetched = await fetchWorkspaceDocument(parsed, body.oauthToken, host);
  if (!fetched.ok) return fetched.response;

  const filename = `workspace-${parsed.kind}-${parsed.docId}.${parsed.extension}`;
  const blob = await host.putBlob(req.canvasId, fetched.bytes, {
    mimeType: fetched.mimeType,
    filename,
  });
  const syncedAt = new Date(host.now()).toISOString();
  const versionId = newVersionId();
  const group = newOpId();

  await host.submit({
    canvasId: req.canvasId,
    actor,
    group,
    op: {
      type: "item.addVersion",
      itemId: item.id,
      version: {
        id: versionId,
        blobHash: blob.blobHash,
        mimeType: fetched.mimeType,
        filename,
        size: blob.size,
      },
    },
  });

  await host.submit({
    canvasId: req.canvasId,
    actor,
    group,
    op: {
      type: "item.update",
      itemId: item.id,
      patch: {
        properties: {
          [WORKSPACE_PROPS.syncedAt]: syncedAt,
        },
      },
    },
  });

  return {
    status: 200,
    body: {
      itemId: item.id,
      versionId,
      kind: parsed.kind,
      docId: parsed.docId,
      url: parsed.url,
      syncedAt,
      mimeType: fetched.mimeType,
    } satisfies WorkspaceSyncResponse,
  };
}

export const workspaceServer: ServerModule = {
  name: "@isocan/workspace",
  routes: [
    {
      method: "POST",
      path: "import",
      spend: "none",
      bodyLimit: 32 * 1024,
      says: {
        badRequest: { code: BAD_REQUEST, error: "a workspace import names `canvasId` and `url`" },
      },
      check: checkImport,
      handler: handleImport,
    },
    {
      method: "POST",
      path: "sync",
      spend: "none",
      bodyLimit: 16 * 1024,
      says: {
        badRequest: { code: BAD_REQUEST, error: "a workspace sync names `canvasId` and `itemId`" },
      },
      check: checkSync,
      handler: handleSync,
    },
  ],
};

export default workspaceServer;
