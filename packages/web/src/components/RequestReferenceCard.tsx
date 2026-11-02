import { useEffect, useState } from "react";
import type { DesignArtifactRef } from "@isocan/core";
import { readDesignRequestReference } from "@isocan/api/design-request";
import { designRequestReadIO } from "../lib/design-request.ts";
import { useOnScreen } from "../lib/onscreen.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { everyWhileVisible } from "../lib/whilevisible.ts";
import "./exact-reference.css";

/** Request references are fetched through source policy before an ephemeral preview or download is offered. */
export function RequestReferenceCard({ canvasId, requestId, artifact }: { canvasId: string; requestId: string; artifact: DesignArtifactRef }) {
  const { ref, onScreen } = useOnScreen<HTMLDivElement>();
  const seq = useCanvasStore((state) => state.lastSeq);
  const [revision, setRevision] = useState(0);
  const [loaded, setLoaded] = useState<{ title: string; filename: string; source: string; preview: string | null } | null>(null);
  const [error, setError] = useState("");
  const key = JSON.stringify(artifact);
  useEffect(() => everyWhileVisible(() => setRevision((value) => value + 1), 10_000), []);
  useEffect(() => {
    if (!onScreen) { setLoaded(null); return; }
    const controller = new AbortController(); const urls: string[] = [];
    setLoaded(null); setError("");
    const makeUrl = (bytes: Uint8Array, type: string) => { const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type })); urls.push(url); return url; };
    void (async () => {
      const value = await readDesignRequestReference(designRequestReadIO, { canvasId, requestId, artifact: JSON.parse(key) as DesignArtifactRef, signal: controller.signal });
      let preview: string | null = null;
      controller.signal.throwIfAborted();
      const source = makeUrl(value.bytes, value.version.mimeType);
      if (value.version.mimeType.startsWith("image/")) preview = source;
      else if (value.version.visual?.mimeType.startsWith("image/")) {
        const face = await readDesignRequestReference(designRequestReadIO, { canvasId, requestId, artifact: value.artifact, face: "visual", signal: controller.signal });
        controller.signal.throwIfAborted();
        preview = makeUrl(face.bytes, face.version.visual!.mimeType);
      }
      if (!controller.signal.aborted) setLoaded({ title: value.title, filename: value.version.filename, source, preview });
    })().catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "This reference is unavailable."); });
    return () => { controller.abort(); urls.forEach((url) => URL.revokeObjectURL(url)); };
  }, [canvasId, requestId, key, onScreen, seq, revision]);
  return <div ref={ref} className="exact-reference" data-request-reference={artifact.versionId}>
    {loaded?.preview && <img src={loaded.preview} alt={loaded.title} />}
    {loaded ? <a href={loaded.source} download={loaded.filename} target="_blank" rel="noopener noreferrer">{loaded.title} · attached version</a> : error ? <p role="status">Reference unavailable: {error} <button className="btn secondary" onClick={() => setRevision((value) => value + 1)}>Retry reference</button></p> : <span>Reading attached reference…</span>}
    <details><summary>Reference details</summary><dl><dt>Source</dt><dd>{artifact.home}</dd><dt>Canvas</dt><dd>{artifact.canvasId}</dd><dt>Item</dt><dd>{artifact.itemId}</dd><dt>Version</dt><dd>{artifact.versionId}</dd><dt>Content</dt><dd>{artifact.blobHash}</dd></dl></details>
  </div>;
}
