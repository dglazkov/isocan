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
  RESEARCH_JOB_KIND,
  RESEARCH_PROPS,
  RESEARCH_RUN_ROUTE,
  parseResearchSources,
  researchModule,
  type ResearchRunRequest,
  type ResearchRunResponse,
} from "./core.ts";

/** Start a home-polled research job on this canvas. */
export async function requestResearchRun(
  req: ResearchRunRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<ResearchRunResponse> {
  const res = await fetchImpl(RESEARCH_RUN_ROUTE, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
  });
  const body = (await res.json().catch(() => null)) as (Partial<ResearchRunResponse> & { error?: string }) | null;
  if (!res.ok || !body?.job || !body?.itemId) {
    throw new Error(body?.error ?? `the home answered ${res.status}`);
  }
  return body as ResearchRunResponse;
}

function ResearchInspector({ canvasId, item, host }: InspectorFacts) {
  const job = jobOf(item);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  if (!job || job.kind !== RESEARCH_JOB_KIND) {
    return (
      <section className="research-inspector" aria-label="Research job">
        <p className="research-empty">No research job attached to this item.</p>
      </section>
    );
  }

  const query = item.properties[RESEARCH_PROPS.query] ?? "";
  const deep = item.properties[RESEARCH_PROPS.deep] === "true";
  const sources = parseResearchSources(item.properties[RESEARCH_PROPS.sources]);

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
      setProblem(err instanceof Error ? err.message : "Could not cancel research job.");
    } finally {
      setBusy(false);
    }
  }

  async function onRetry() {
    if (busy || !job) return;
    setBusy(true);
    setProblem(null);
    try {
      const res = await fetch(jobRetryRoute(canvasId, job.id), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ actor: host.viewer }),
      });
      const data = (await res.json().catch(() => null)) as (Partial<JobResponse> & { error?: string }) | null;
      if (!res.ok) throw new Error(data?.error ?? `retry failed (${res.status})`);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Could not retry research job.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="research-inspector" aria-label="Research job" data-job-state={job.state}>
      <div className="research-badge">
        <strong>{job.state}</strong>
        {job.progress ? <span> · {job.progress}</span> : null}
        {deep ? <span> · deep</span> : null}
        <span> · {job.model}</span>
      </div>
      {query ? <p className="research-query">{query}</p> : null}
      {sources.length > 0 ? (
        <ul className="research-sources" aria-label="Research sources">
          {sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.title}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      {job.error ? (
        <p className="research-error" role="alert">
          {job.error}
        </p>
      ) : null}
      {problem ? (
        <p className="research-problem" role="alert">
          {problem}
        </p>
      ) : null}
      <div className="research-actions">
        {isActiveJob(job) ? (
          <button type="button" className="btn" disabled={busy} onClick={() => void onCancel()}>
            {busy ? "Cancelling…" : "Cancel"}
          </button>
        ) : null}
        {canRetryJob(job) ? (
          <button type="button" className="btn primary" disabled={busy} onClick={() => void onRetry()}>
            {busy ? "Retrying…" : "Retry"}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function ResearchRunDialog({ canvasId, args, canEdit, host }: DialogFacts) {
  const [query, setQuery] = useState(args.trim());
  const [deep, setDeep] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canEdit || busy || !query.trim()) return;
    setBusy(true);
    setProblem(null);
    try {
      const res = await requestResearchRun({
        canvasId,
        query: query.trim(),
        ...(deep ? { deep: true } : {}),
        actor: host.viewer,
      });
      host.select([res.itemId]);
      host.reveal([res.itemId]);
      host.close();
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Could not start research job.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="research-dialog" onSubmit={(e) => void onSubmit(e)}>
      <label className="research-field">
        Query
        <textarea
          rows={3}
          aria-label="Research query"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Compare offline-first CRDT libraries for collaborative canvases"
          disabled={!canEdit || busy}
        />
      </label>
      <label className="research-deep-toggle">
        <input
          type="checkbox"
          checked={deep}
          onChange={(e) => setDeep(e.target.checked)}
          disabled={!canEdit || busy}
        />
        <span>Deep synthesis</span>
      </label>
      {problem ? (
        <p className="research-problem" role="alert">
          {problem}
        </p>
      ) : null}
      <div className="research-actions">
        <button type="button" className="btn" onClick={host.close} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className="btn primary" disabled={!canEdit || busy || !query.trim()}>
          {busy ? "Starting…" : "Run research"}
        </button>
      </div>
    </form>
  );
}

export const researchWeb: WebModule<
  never,
  never,
  ComponentType<InspectorFacts>,
  never,
  never,
  ComponentType<DialogFacts>
> = {
  core: researchModule,
  inspectors: [
    {
      kinds: ["document"],
      label: "Research",
      component: ResearchInspector,
    },
  ],
  actions: [
    {
      id: "research.run",
      name: "Run research",
      hint: "start a home-polled grounded research job on this canvas",
      opens: "research-run",
    },
  ],
  dialogs: [
    {
      id: "research-run",
      title: "Run research",
      component: ResearchRunDialog,
    },
  ],
};

export default researchWeb;
