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

export const CLIPPER_PROPS = {
  sourceUrl: "clipper.sourceUrl",
  capturedAt: "clipper.capturedAt",
  kind: "clipper.kind",
} as const;

export const CLIPPER_CAPTURE_ROUTE = "/api/m/clipper/capture";

/** Maximum combined payload size accepted by the clipper route (4 MiB). */
export const CLIPPER_MAX_PAYLOAD_BYTES = 4 * 1024 * 1024;

export type ClipKind = "document" | "site" | "image";

export interface ClipCaptureRequest {
  canvasId: string;
  url: string;
  title?: string;
  selection?: string;
  html?: string;
  imageBase64?: string;
  mimeType?: string;
  actor?: Actor;
}

export interface ValidatedClipPayload {
  canvasId: string;
  url: string;
  title: string;
  kind: ClipKind;
  selection?: string;
  html?: string;
  imageBase64?: string;
  mimeType?: string;
  actor?: Actor;
}

export interface ClipCaptureResponse {
  itemId: string;
  kind: ClipKind;
  sourceUrl: string;
  capturedAt: string;
  mimeType: string;
}

/**
 * Validate a browser clipper capture payload.
 * Rejects non-HTTP(S) URLs (`javascript:`, `file:`, `data:`, etc.) and enforces payload byte caps.
 * Pure — shared across server, web, CLI, and tests.
 */
export function validateClipPayload(
  raw: unknown,
  maxBytes: number = CLIPPER_MAX_PAYLOAD_BYTES,
): { ok: true; payload: ValidatedClipPayload } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "clipper payload must be a JSON object" };
  }
  const body = raw as Partial<ClipCaptureRequest>;
  if (typeof body.canvasId !== "string" || !body.canvasId.trim()) {
    return { ok: false, error: "`canvasId` is required" };
  }
  if (typeof body.url !== "string" || !body.url.trim()) {
    return { ok: false, error: "`url` is required" };
  }
  let parsed: URL;
  try {
    parsed = new URL(body.url.trim());
  } catch {
    return { ok: false, error: "`url` must be a valid URL" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: `unsupported URL protocol "${parsed.protocol}" — only http: and https: are allowed` };
  }

  const selection = typeof body.selection === "string" ? body.selection : undefined;
  const html = typeof body.html === "string" ? body.html : undefined;
  const imageBase64 = typeof body.imageBase64 === "string" ? body.imageBase64.trim() : undefined;
  const mimeType = typeof body.mimeType === "string" && body.mimeType.trim() ? body.mimeType.trim() : undefined;

  const byteSize =
    (selection ? Buffer.byteLength(selection, "utf8") : 0) +
    (html ? Buffer.byteLength(html, "utf8") : 0) +
    (imageBase64 ? Math.ceil((imageBase64.length * 3) / 4) : 0);

  if (byteSize > maxBytes) {
    return { ok: false, error: `clip payload (${byteSize} bytes) exceeds the ${maxBytes}-byte limit` };
  }

  const kind: ClipKind = imageBase64 ? "image" : html ? "site" : "document";
  const title = (typeof body.title === "string" && body.title.trim()) || parsed.hostname + (parsed.pathname !== "/" ? parsed.pathname : "");

  return {
    ok: true,
    payload: {
      canvasId: body.canvasId.trim(),
      url: parsed.href,
      title,
      kind,
      ...(selection !== undefined ? { selection } : {}),
      ...(html !== undefined ? { html } : {}),
      ...(imageBase64 !== undefined ? { imageBase64 } : {}),
      ...(mimeType !== undefined ? { mimeType } : {}),
      ...(body.actor ? { actor: body.actor } : {}),
    },
  };
}

export const clipperModule: CoreModule = {
  name: "@isocan/clipper",
  propertyKeys: [CLIPPER_PROPS.sourceUrl, CLIPPER_PROPS.capturedAt, CLIPPER_PROPS.kind],
  contextPieces(canvas: CanvasContents): ContextPiece[] {
    const clips = Object.values(canvas.items)
      .filter((item) => Boolean(item.properties?.[CLIPPER_PROPS.sourceUrl]))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    if (clips.length === 0) return [];
    const list = clips.slice(0, 4).map((i) => i.title).join(", ");
    return [
      {
        name: "Web clips",
        source: "canvas",
        present: true,
        size: `${clips.length} clip${clips.length === 1 ? "" : "s"} — ${list}`,
        updatedAt: clips[0]!.updatedAt,
      },
    ];
  },
};

export default clipperModule;
