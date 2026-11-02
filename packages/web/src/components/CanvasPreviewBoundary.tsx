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
