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

import type { Actor, CanvasContents, ContextPiece, CoreModule } from "@isocan/core";

export const WORKSPACE_PROPS = {
  kind: "workspace.kind",
  url: "workspace.url",
  docId: "workspace.docId",
  syncedAt: "workspace.syncedAt",
} as const;

export const WORKSPACE_IMPORT_ROUTE = "/api/m/workspace/import";
export const WORKSPACE_SYNC_ROUTE = "/api/m/workspace/sync";

export type WorkspaceKind = "docs" | "sheets" | "slides";

export interface ParsedWorkspaceUrl {
  kind: WorkspaceKind;
  docId: string;
  url: string;
  exportUrl: string;
  mimeType: "text/markdown" | "text/csv" | "text/html";
  extension: "md" | "csv" | "html";
}

export interface WorkspaceImportRequest {
  canvasId: string;
  url: string;
  title?: string;
  oauthToken?: string;
  actor?: Actor;
}

export interface WorkspaceImportResponse {
  itemId: string;
  versionId: string;
  kind: WorkspaceKind;
  docId: string;
  url: string;
  syncedAt: string;
  mimeType: string;
}

export interface WorkspaceSyncRequest {
  canvasId: string;
  itemId: string;
  oauthToken?: string;
  actor?: Actor;
}

export interface WorkspaceSyncResponse {
  itemId: string;
  versionId: string;
  kind: WorkspaceKind;
  docId: string;
  url: string;
  syncedAt: string;
  mimeType: string;
}

const PATH_PATTERNS: ReadonlyArray<{
  kind: WorkspaceKind;
  regex: RegExp;
  exportPath: (id: string) => string;
  mimeType: "text/markdown" | "text/csv" | "text/html";
  extension: "md" | "csv" | "html";
}> = [
  {
    kind: "docs",
    regex: /^\/document\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]{8,})/,
    exportPath: (id) => `https://docs.google.com/document/d/${id}/export?format=md`,
    mimeType: "text/markdown",
    extension: "md",
  },
  {
    kind: "sheets",
    regex: /^\/spreadsheets\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]{8,})/,
    exportPath: (id) => `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`,
    mimeType: "text/csv",
    extension: "csv",
  },
  {
    kind: "slides",
    regex: /^\/presentation\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]{8,})/,
    exportPath: (id) => `https://docs.google.com/presentation/d/${id}/export?format=html`,
    mimeType: "text/html",
    extension: "html",
  },
];

/**
 * Parse a Google Docs, Sheets, or Slides URL into its workspace kind, document ID, and export metadata.
 * Pure — shared across server, web, CLI, and tests.
 */
export function parseWorkspaceUrl(rawUrl: string): ParsedWorkspaceUrl | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  if (parsed.hostname !== "docs.google.com") return null;

  for (const entry of PATH_PATTERNS) {
    const match = entry.regex.exec(parsed.pathname);
    if (match?.[1]) {
      const docId = match[1];
      return {
        kind: entry.kind,
        docId,
        url: parsed.href,
        exportUrl: entry.exportPath(docId),
        mimeType: entry.mimeType,
        extension: entry.extension,
      };
    }
  }
  return null;
}

export const workspaceModule: CoreModule = {
  name: "@isocan/workspace",
  propertyKeys: [
    WORKSPACE_PROPS.kind,
    WORKSPACE_PROPS.url,
    WORKSPACE_PROPS.docId,
    WORKSPACE_PROPS.syncedAt,
  ],
  contextPieces(canvas: CanvasContents): ContextPiece[] {
    const linked = Object.values(canvas.items)
      .filter((item) => Boolean(item.properties?.[WORKSPACE_PROPS.docId]))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    if (linked.length === 0) return [];
    const summary = linked
      .slice(0, 4)
      .map((item) => `${item.title} (${item.properties[WORKSPACE_PROPS.kind] ?? "doc"})`)
      .join(", ");
    return [
      {
        name: "Workspace items",
        source: "canvas",
        present: true,
        size: `${linked.length} linked — ${summary}`,
        updatedAt: linked[0]!.updatedAt,
      },
    ];
  },
};

export default workspaceModule;
