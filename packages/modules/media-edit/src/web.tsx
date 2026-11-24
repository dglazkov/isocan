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
  MEDIA_EDIT_FRAMES_ROUTE,
  MEDIA_EDIT_TRIM_ROUTE,
  mediaEditModule,
  type ClipFramesRequest,
  type ClipFramesResponse,
  type ClipOutputResponse,
  type ClipTrimRequest,
} from "./core.ts";

export async function requestClipTrim(
  req: ClipTrimRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<ClipOutputResponse> {
  const res = await fetchImpl(MEDIA_EDIT_TRIM_ROUTE, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
  });
  const body = (await res.json().catch(() => null)) as (Partial<ClipOutputResponse> & { error?: string }) | null;
  if (!res.ok || !body?.itemId) {
    throw new Error(body?.error ?? `trim failed (${res.status})`);
  }
  return body as ClipOutputResponse;
}

export async function requestClipFrames(
  req: ClipFramesRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<ClipFramesResponse> {
  const res = await fetchImpl(MEDIA_EDIT_FRAMES_ROUTE, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
  });
  const body = (await res.json().catch(() => null)) as (Partial<ClipFramesResponse> & { error?: string }) | null;
  if (!res.ok || !Array.isArray(body?.itemIds)) {
    throw new Error(body?.error ?? `frames extraction failed (${res.status})`);
  }
  return body as ClipFramesResponse;
}

function ClipInspector({ canvasId, item, host }: InspectorFacts) {
  const [startSec, setStartSec] = useState("0");
  const [endSec, setEndSec] = useState("3");
  const [fps, setFps] = useState("1");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const ver = item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions.at(-1);
  const isVideo = Boolean(ver?.mimeType.toLowerCase().startsWith("video/"));

  async function onTrim() {
    if (busy) return;
    const start = Number(startSec);
    const end = Number(endSec);
    if (!Number.isFinite(start) || start < 0 || !Number.isFinite(end) || end <= start) {
      setProblem("Enter a valid start and end time in seconds.");
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      const res = await requestClipTrim({
        canvasId,
        itemId: item.id,
        startSec: start,
        endSec: end,
        actor: host.viewer,
      });
      host.select([res.itemId]);
      host.reveal([res.itemId]);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Could not trim clip.");
    } finally {
      setBusy(false);
    }
  }

  async function onFrames() {
    if (busy) return;
    const parsedFps = Number(fps);
    if (!Number.isFinite(parsedFps) || parsedFps <= 0 || parsedFps > 30) {
      setProblem("FPS must be between 0 and 30.");
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      const res = await requestClipFrames({
        canvasId,
        itemId: item.id,
        fps: parsedFps,
        actor: host.viewer,
      });
      if (res.itemIds.length > 0) {
        host.select(res.itemIds);
        host.reveal(res.itemIds);
      }
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Could not extract frames.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="clip-inspector" aria-label="Clip editing">
      <div className="clip-trim-row">
        <label>
          Start (s)
          <input
            type="number"
            min="0"
            step="0.5"
            aria-label="Trim start seconds"
            value={startSec}
            onChange={(e) => setStartSec(e.target.value)}
            disabled={busy}
          />
        </label>
        <label>
          End (s)
          <input
            type="number"
            min="0.5"
            step="0.5"
            aria-label="Trim end seconds"
            value={endSec}
            onChange={(e) => setEndSec(e.target.value)}
            disabled={busy}
          />
        </label>
        <button type="button" className="btn primary" disabled={busy} onClick={() => void onTrim()}>
          {busy ? "Working…" : "Trim"}
        </button>
      </div>
      {isVideo ? (
        <div className="clip-frames-row">
          <label>
            FPS
            <input
              type="number"
              min="0.1"
              max="30"
              step="0.5"
              aria-label="Extract frames per second"
              value={fps}
              onChange={(e) => setFps(e.target.value)}
              disabled={busy}
            />
          </label>
          <button type="button" className="btn" disabled={busy} onClick={() => void onFrames()}>
            {busy ? "Working…" : "Extract frames"}
          </button>
        </div>
      ) : null}
      {problem ? (
        <p className="clip-problem" role="alert">
          {problem}
        </p>
      ) : null}
    </section>
  );
}

export const mediaEditWeb: WebModule<never, never, ComponentType<InspectorFacts>> = {
  core: mediaEditModule,
  inspectors: [
    {
      kinds: ["video", "audio"],
      label: "Clip edit",
      component: ClipInspector,
    },
  ],
};

export default mediaEditWeb;
