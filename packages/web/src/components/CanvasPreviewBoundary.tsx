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

import { useEffect, useState, type ReactNode } from "react";
import { automaticCanvasTarget } from "@isocan/core";
import { automaticSource } from "../lib/personal.ts";

/** No renderer or persisted picture mounts before the source's authority classifies it. */
export function CanvasPreviewBoundary({ canvasId, source, destinationCanvasId, children }: { canvasId: string | null; source: string | null; destinationCanvasId: string; children: ReactNode }) {
  const target = automaticCanvasTarget(canvasId, source);
  const targetId = target.kind === "canvas" ? target.canvasId : null;
  const targetSource = target.kind === "canvas" ? target.source : null;
  const home = window.location.origin;
  const scope = `${home}:${destinationCanvasId}:${canvasId}:${source}`;
  const [answer, setAnswer] = useState<{ scope: string; kind: string } | null>(null);
  useEffect(() => {
    if (targetId === null) return;
    const controller = new AbortController();
    void automaticSource(targetId, targetSource, destinationCanvasId, controller.signal)
      .then((result) => { if (!controller.signal.aborted) setAnswer({ scope, kind: result.kind }); })
      .catch(() => { if (!controller.signal.aborted) setAnswer({ scope, kind: "unavailable" }); });
    return () => controller.abort();
  }, [scope, targetId, targetSource, destinationCanvasId]);
  if (target.kind === "none") return children;
  const kind = target.kind === "unavailable" ? "unavailable" : answer?.scope === scope ? answer.kind : null;
  if (kind === "ordinary") return children;
  return <div className="canvas-embed canvas-embed-note" data-preview-state={kind ?? "checking"}>
    {kind === "personal" ? "Personal canvas · no shared preview. Read permitted context in Context." : kind === "unavailable" ? "Preview unavailable — open the canvas at its home." : "Checking preview…"}
  </div>;
}
