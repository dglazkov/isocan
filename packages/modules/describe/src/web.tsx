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
  AGENT_DESCRIPTION_PROP,
  DESCRIBABLE_KINDS,
  DESCRIBE_ROUTE,
  describeModule,
  type DescribeItemRequest,
  type DescribeItemResponse,
} from "./core.ts";

/** Ask the home to describe an item and write `agentDescription` onto it. */
export async function requestDescribeItem(
  req: DescribeItemRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<DescribeItemResponse> {
  const res = await fetchImpl(DESCRIBE_ROUTE, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
  });
  const body = (await res.json().catch(() => null)) as (Partial<DescribeItemResponse> & { error?: string }) | null;
  if (!res.ok || typeof body?.agentDescription !== "string") {
    throw new Error(body?.error ?? `the home answered ${res.status}`);
  }
  return body as DescribeItemResponse;
}

function DescribeInspector({ canvasId, item, host }: InspectorFacts) {
  const existing = item.properties[AGENT_DESCRIPTION_PROP]?.trim() ?? "";
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function onDescribe() {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    try {
      await requestDescribeItem({
        canvasId,
        itemId: item.id,
        actor: host.viewer,
      });
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Could not describe item.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="describe-inspector" aria-label="Agent description">
      {existing ? (
        <p className="describe-text" data-testid="agent-description-text">
          {existing}
        </p>
      ) : (
        <p className="describe-empty">
          No agent description yet. Generate one so agents can reason about this item without viewing its pixels.
        </p>
      )}
      {problem && (
        <p className="describe-problem" role="alert">
          {problem}
        </p>
      )}
      <button
        type="button"
        className="btn"
        disabled={busy}
        onClick={() => void onDescribe()}
      >
        {busy ? "Describing…" : existing ? "Refresh agent description" : "Describe for agents"}
      </button>
    </section>
  );
}

export const describeWeb: WebModule<never, never, ComponentType<InspectorFacts>> = {
  core: describeModule,
  inspectors: [
    {
      kinds: [...DESCRIBABLE_KINDS],
      label: "Agent description",
      component: DescribeInspector,
    },
  ],
};

export default describeWeb;
