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

import "../assets/styles.css";
import { useEffect, useState, type ComponentType } from "react";
import type { RendererFacts, WebModule } from "@isocan/core";
import { EXACT_INDEX_MIME, exactModule, parseIndex, type ExactIndex } from "./core.ts";

/**
 * **The web half, phase 0** (exact phase 0): the index item drawn as what it
 * is — the app's routes, as Contract declares them, and whether the web
 * build agreed. The screens are ordinary PNGs and need nothing of ours.
 * Live frames, the map and the device row are later phases; this half
 * arrives only with the `exact` experiment on.
 */
function IndexCard({ blobHash, readText }: RendererFacts) {
  const [state, setState] = useState<{ hash: string; index?: ExactIndex; problem?: string } | null>(null);
  useEffect(() => {
    let live = true;
    readText()
      .then((text) => { if (live) setState({ hash: blobHash, index: parseIndex(text) }); })
      .catch((err: unknown) => { if (live) setState({ hash: blobHash, problem: err instanceof Error ? err.message : String(err) }); });
    return () => { live = false; };
    // Keyed on the bytes, not the closure: the shell may hand a fresh `readText` per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blobHash]);
  if (!state || state.hash !== blobHash) return <div className="exact-index exact-note">Reading the index…</div>;
  if (!state.index) return <div className="exact-index exact-problem">{state.problem}</div>;
  const index = state.index;
  return (
    <div className="exact-index">
      <h3>{index.app.name}</h3>
      <p className="exact-note">
        {index.app.id} · Exact {index.exact.commit?.slice(0, 8) ?? "unknown"} · {index.routes.length} routes
      </p>
      <ul className="exact-routes">
        {index.routes.map((r) => (
          <li key={r.name} className={r.tab ? "exact-tab" : "exact-pushed"}>
            <span>{r.name}</span>
            <code>{r.pattern}</code>
          </li>
        ))}
      </ul>
      <p className={index.routesJson.equal ? "exact-note" : "exact-problem"}>
        {index.routesJson.equal ? "routes.json agrees" : "routes.json disagrees with Contract"}
      </p>
    </div>
  );
}

export const exactWeb: WebModule<never, ComponentType<RendererFacts>> = {
  core: exactModule,
  renderers: [{ mimes: [EXACT_INDEX_MIME], component: IndexCard }],
};

export default exactWeb;
