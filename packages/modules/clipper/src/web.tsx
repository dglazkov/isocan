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

import type { ComponentType } from "react";
import type { InspectorFacts, WebModule } from "@isocan/core";
import { CLIPPER_PROPS, clipperModule } from "./core.ts";

export function ClipperInspector({ item }: InspectorFacts) {
  const sourceUrl = item.properties[CLIPPER_PROPS.sourceUrl];
  const capturedAt = item.properties[CLIPPER_PROPS.capturedAt];
  if (!sourceUrl) return null;

  return (
    <section className="clipper-inspector" aria-label="Web clip source">
      <div style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px" }}>
        <div style={{ wordBreak: "break-all" }}>
          <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
            {sourceUrl} ↗
          </a>
        </div>
        {capturedAt ? <div style={{ opacity: 0.7 }}>Captured: {capturedAt}</div> : null}
      </div>
    </section>
  );
}

export const clipperWeb: WebModule<never, never, ComponentType<InspectorFacts>> = {
  core: clipperModule,
  inspectors: [
    {
      kinds: ["document", "screen", "image", "file"],
      label: "Clipper",
      component: ClipperInspector,
    },
  ],
};

export default clipperWeb;
