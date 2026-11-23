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
  PROTOTYPE_BUILD_ROUTE,
  PROTOTYPE_PROPS,
  isPrototypeTier,
  prototypeModule,
  type PrototypeBuildResponse,
} from "./core.ts";

export function PrototypeInspector({ canvasId, item, host }: InspectorFacts) {
  const tierRaw = item.properties[PROTOTYPE_PROPS.tier];
  const prompt = item.properties[PROTOTYPE_PROPS.prompt];
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  if (!tierRaw) return null;
  const tier = isPrototypeTier(tierRaw) ? tierRaw : "quick";

  async function onRebuild() {
    if (busy || !prompt) return;
    setBusy(true);
    setProblem(null);
    try {
      const res = await fetch(PROTOTYPE_BUILD_ROUTE, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          canvasId,
          itemId: item.id,
          prompt,
          tier,
          actor: host.viewer,
        }),
      });
      const body = (await res.json().catch(() => null)) as (Partial<PrototypeBuildResponse> & { error?: string }) | null;
      if (!res.ok) throw new Error(body?.error ?? `rebuild failed (${res.status})`);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Could not rebuild prototype.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="prototype-inspector" aria-label="Prototype details">
      <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px" }}>
        <div>
          <span
            className="prototype-tier-badge"
            style={{
              display: "inline-block",
              padding: "2px 6px",
              borderRadius: "4px",
              border: "1px solid currentColor",
              fontWeight: 600,
              textTransform: "uppercase",
              fontSize: "10px",
            }}
          >
            {tier}
          </span>
        </div>
        {prompt ? <p style={{ margin: 0, opacity: 0.8 }}>{prompt}</p> : null}
        {problem ? (
          <p role="alert" style={{ margin: 0 }}>
            {problem}
          </p>
        ) : null}
        {prompt && tier !== "app" ? (
          <button type="button" className="btn" disabled={busy} onClick={() => void onRebuild()}>
            {busy ? "Rebuilding…" : "Rebuild"}
          </button>
        ) : null}
      </div>
    </section>
  );
}

export const prototypeWeb: WebModule<never, never, ComponentType<InspectorFacts>> = {
  core: prototypeModule,
  inspectors: [
    {
      kinds: ["screen"],
      label: "Prototype",
      component: PrototypeInspector,
    },
  ],
};

export default prototypeWeb;
