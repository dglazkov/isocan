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

import { useState, type ComponentType, type FormEvent } from "react";
import {
  canRetryJob,
  isActiveJob,
  jobAbandonRoute,
  jobOf,
  jobRetryRoute,
  type DialogFacts,
  type InspectorFacts,
  type JobResponse,
  type WebModule,
} from "@isocan/core";
import {
  VIDEO_GENERATE_ROUTE,
  VIDEO_JOB_KIND,
  VIDEO_PROPS,
  videoModule,
  type VideoGenerateRequest,
  type VideoGenerateResponse,
} from "./core.ts";

/** Start a home-polled video generation job on this canvas. */
export async function requestVideoGenerate(
  req: VideoGenerateRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<VideoGenerateResponse> {
  const res = await fetchImpl(VIDEO_GENERATE_ROUTE, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
  });
  const body = (await res.json().catch(() => null)) as (Partial<VideoGenerateResponse> & { error?: string }) | null;
  if (!res.ok || !body?.job || !body?.itemId) {
    throw new Error(body?.error ?? `the home answered ${res.status}`);
  }
  return body as VideoGenerateResponse;
}

function VideoJobInspector({ canvasId, item, host }: InspectorFacts) {
  const job = jobOf(item);
  const [busy, setBusy] = useState(false);
  const [modelOverride, setModelOverride] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  if (!job || job.kind !== VIDEO_JOB_KIND) {
    return (
      <section className="video-job-inspector" aria-label="Video job">
        <p className="video-job-empty">No video generation job attached to this item.</p>
      </section>
    );
  }

  const prompt = item.properties[VIDEO_PROPS.prompt] ?? "";

  async function onCancel() {
    if (busy || !job) return;
    setBusy(true);
    setProblem(null);
    try {
      const res = await fetch(jobAbandonRoute(canvasId, job.id), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ actor: host.viewer }),
      });
      const data = (await res.json().catch(() => null)) as (Partial<JobResponse> & { error?: string }) | null;
      if (!res.ok) throw new Error(data?.error ?? `cancel failed (${res.status})`);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Could not cancel job.");
    } finally {
      setBusy(false);
    }
  }

  async function onRetry() {
    if (busy || !job) return;
    setBusy(true);
    setProblem(null);
    try {
      const model = modelOverride.trim();
      const res = await fetch(jobRetryRoute(canvasId, job.id), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ actor: host.viewer, ...(model ? { model } : {}) }),
      });
      const data = (await res.json().catch(() => null)) as (Partial<JobResponse> & { error?: string }) | null;
      if (!res.ok) throw new Error(data?.error ?? `retry failed (${res.status})`);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Could not retry job.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="video-job-inspector" aria-label="Video job" data-job-state={job.state}>
      <div className="video-job-badge">
        <strong>{job.state}</strong>
        {job.progress ? <span> · {job.progress}</span> : null}
        <span> · {job.model}</span>
      </div>
      {prompt ? <p className="video-job-prompt">{prompt}</p> : null}
      {job.error ? (
        <p className="video-job-error" role="alert">
          {job.error}
        </p>
      ) : null}
      {problem ? (
        <p className="video-job-problem" role="alert">
          {problem}
        </p>
      ) : null}
      <div className="video-job-actions">
        {isActiveJob(job) ? (
          <button type="button" className="btn" disabled={busy} onClick={() => void onCancel()}>
            {busy ? "Cancelling…" : "Cancel"}
          </button>
        ) : null}
        {canRetryJob(job) ? (
          <>
            <input
              type="text"
              aria-label="Retry model override"
              placeholder={job.model}
              value={modelOverride}
              onChange={(e) => setModelOverride(e.target.value)}
              disabled={busy}
            />
            <button type="button" className="btn primary" disabled={busy} onClick={() => void onRetry()}>
              {busy ? "Retrying…" : "Retry"}
            </button>
          </>
        ) : null}
      </div>
    </section>
  );
}

function VideoGenerateDialog({ canvasId, selection, args, canEdit, host }: DialogFacts) {
  const [prompt, setPrompt] = useState(args.trim());
  const [model, setModel] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const sourceItemId = selection.length === 1 ? selection[0] : undefined;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canEdit || busy || !prompt.trim()) return;
    setBusy(true);
    setProblem(null);
    try {
      const res = await requestVideoGenerate({
        canvasId,
        prompt: prompt.trim(),
        ...(sourceItemId ? { fromItem: sourceItemId } : {}),
        ...(model.trim() ? { model: model.trim() } : {}),
        actor: host.viewer,
      });
      host.select([res.itemId]);
      host.reveal([res.itemId]);
      host.close();
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Could not start video generation.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="video-dialog" onSubmit={(e) => void onSubmit(e)}>
      {sourceItemId ? (
        <p className="video-source">
          Animating selected item <code>{sourceItemId}</code>
        </p>
      ) : null}
      <label className="video-field">
        Prompt
        <textarea
          rows={3}
          aria-label="Video prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Drone shot rising over a foggy coastal lighthouse at dawn"
          disabled={!canEdit || busy}
        />
      </label>
      <label className="video-field">
        Model (optional)
        <input
          type="text"
          aria-label="Video model"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="default from manifest"
          disabled={!canEdit || busy}
        />
      </label>
      {problem ? (
        <p className="video-problem" role="alert">
          {problem}
        </p>
      ) : null}
      <div className="video-actions">
        <button type="button" className="btn" onClick={host.close} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className="btn primary" disabled={!canEdit || busy || !prompt.trim()}>
          {busy ? "Starting…" : "Generate video"}
        </button>
      </div>
    </form>
  );
}

export const videoWeb: WebModule<
  never,
  never,
  ComponentType<InspectorFacts>,
  never,
  never,
  ComponentType<DialogFacts>
> = {
  core: videoModule,
  inspectors: [
    {
      kinds: ["video", "document"],
      label: "Video job",
      component: VideoJobInspector,
    },
  ],
  actions: [
    {
      id: "video.generate",
      name: "Generate video",
      hint: "start a home-polled video generation job on this canvas",
      opens: "video-generate",
    },
  ],
  dialogs: [
    {
      id: "video-generate",
      title: "Generate video",
      component: VideoGenerateDialog,
    },
  ],
};

export default videoWeb;
