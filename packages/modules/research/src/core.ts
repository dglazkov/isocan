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

import { titleSlug, type Actor, type CoreModule, type JobSnapshot } from "@isocan/core";

/** Home route that starts an async home-polled research job. */
export const RESEARCH_RUN_ROUTE = "/api/m/research/run";

/** Job kind key registered on `ServerModule.jobs` and stored in `job.kind`. */
export const RESEARCH_JOB_KIND = "research";

/** Item property keys owned by `@isocan/research`. */
export const RESEARCH_PROPS = {
  query: "research.query",
  deep: "research.deep",
  sources: "research.sources",
} as const;

/** Maximum query length accepted by `POST /api/m/research/run`. */
export const RESEARCH_MAX_QUERY_LENGTH = 2000;

/** A single cited source link attached to a research report. */
export interface ResearchSource {
  title: string;
  url: string;
}

/** Request payload for `POST /api/m/research/run`. */
export interface ResearchRunRequest {
  canvasId: string;
  query: string;
  deep?: boolean;
  model?: string;
  actor?: Actor;
}

/** Response payload returned with HTTP 202 by `POST /api/m/research/run`. */
export interface ResearchRunResponse {
  job: JobSnapshot;
  itemId: string;
}

/** Validate a research query string. */
export function validateResearchQuery(
  raw: unknown,
): { ok: true; query: string } | { ok: false; error: string } {
  if (typeof raw !== "string") {
    return { ok: false, error: "a research request carries a non-empty `query`" };
  }
  const query = raw.trim();
  if (!query) {
    return { ok: false, error: "a research request carries a non-empty `query`" };
  }
  if (query.length > RESEARCH_MAX_QUERY_LENGTH) {
    return {
      ok: false,
      error: `research \`query\` is at most ${RESEARCH_MAX_QUERY_LENGTH} characters (got ${query.length})`,
    };
  }
  return { ok: true, query };
}

/** Safe `.md` filename derived from the research query. */
export function researchFilename(query: string): string {
  const slug = titleSlug(query, { max: 40, ascii: true });
  return `${slug || "research"}-report.md`;
}

/** Format a completed research answer and its grounding sources into Markdown. */
export function formatResearchMarkdown(
  query: string,
  body: string,
  sources: readonly ResearchSource[],
): string {
  const lines: string[] = [`# ${query}`, "", body.trim()];
  if (sources.length > 0) {
    lines.push("", "## Sources", "");
    for (const s of sources) {
      const label = s.title.trim() || s.url;
      lines.push(`- [${label}](${s.url})`);
    }
  }
  return lines.join("\n") + "\n";
}

/** Parse serialized `research.sources` JSON property into source entries. */
export function parseResearchSources(raw: string | undefined): ResearchSource[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: ResearchSource[] = [];
    for (const entry of parsed) {
      if (entry && typeof entry === "object") {
        const rec = entry as { title?: unknown; url?: unknown };
        if (typeof rec.url === "string" && rec.url.trim()) {
          out.push({
            title: typeof rec.title === "string" && rec.title.trim() ? rec.title.trim() : rec.url.trim(),
            url: rec.url.trim(),
          });
        }
      }
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * **The record both surfaces register** (Open Stitch phase 3).
 *
 * Owns `research.query`, `research.deep`, and `research.sources`.
 */
export const researchModule: CoreModule = {
  name: "@isocan/research",
  propertyKeys: [RESEARCH_PROPS.query, RESEARCH_PROPS.deep, RESEARCH_PROPS.sources],
};

export default researchModule;
