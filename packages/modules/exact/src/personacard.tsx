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

import type { RendererFacts } from "@isocan/core";
import { EXACT_PROPS } from "./core.ts";
import { parsePersonaRun } from "./persona.ts";

/**
 * **A persona's filmstrip** (exact phase 9; journey Scene 9): the run's
 * frames side by side, each under the step that led to it, the step the
 * driver could not do marked red with its words. The item is an ordinary
 * image whose versions are the frames; with the module gone the version
 * slider walks the same path.
 */
export function PersonaStrip({ item, url, blobHash, filename }: RendererFacts) {
  const run = parsePersonaRun(item?.properties?.[EXACT_PROPS.persona]);
  if (!item || !run) return <img className="img-view" src={url} alt={filename} draggable={false} />;
  const src = (versionId: string | null) => {
    const hash = item.versions.find((v) => v.id === versionId)?.blobHash;
    return hash ? (url.includes(blobHash) ? url.replace(blobHash, hash) : url) : null;
  };
  const frames = [{ op: "start", ok: true, said: null as string | null, frame: run.first }, ...run.steps];
  return (
    <div className="exact-persona" data-exact-persona={run.name} data-exact-verdict={run.verdict} data-exact-frames={frames.filter((f) => f.frame).length}>
      <div className="exact-proposal-head">
        <strong>{run.name} — {run.goal}</strong>
        <span className={run.verdict === "reached" ? "exact-note" : "exact-problem"}>{run.verdict === "reached" ? "reached the goal" : "got stuck"}: {run.note}</span>
      </div>
      <div className="exact-persona-strip">
        {frames.map((f, i) => {
          const s = src(f.frame);
          return (
            <figure key={i} className={f.ok ? "exact-persona-frame" : "exact-persona-frame exact-persona-broke"}>
              {s ? <img src={s} alt={`${run.name} after ${f.op}`} draggable={false} /> : <span className="exact-note">no frame</span>}
              <figcaption><code>{f.op}</code>{f.said ? <span className="exact-problem"> {f.said}</span> : null}</figcaption>
            </figure>
          );
        })}
      </div>
    </div>
  );
}
