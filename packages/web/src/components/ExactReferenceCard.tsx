import { useState } from "react";
import type { DesignArtifactRef, ItemVersion } from "@isocan/core";
import { blobUrl } from "../lib/api.ts";
import { useOnScreen } from "../lib/onscreen.ts";
import { useContentOrigin } from "../lib/contentBase.ts";
import { itemFrame } from "../lib/frame.ts";
import "./exact-reference.css";

type ReferenceVersion = Pick<ItemVersion, "mimeType" | "filename"> & Pick<Partial<ItemVersion>, "visual">;

/** A retained local version has a readable name and opens its exact bytes, even after the live item changes. */
export function LocalExactReferenceCard({ localCanvasId, artifact, version, name }: { localCanvasId: string; artifact: DesignArtifactRef; version?: ReferenceVersion | undefined; name?: string | undefined }) {
  const { ref, onScreen } = useOnScreen<HTMLDivElement>();
  const [failedIdentity, setFailedIdentity] = useState<string | null>(null);
  const identity = JSON.stringify(artifact);
  const failed = failedIdentity === identity;
  const label = name || version?.filename || "Attached reference";
  const hash = version?.visual?.blobHash ?? artifact.blobHash;
  const mimeType = version?.visual?.mimeType ?? version?.mimeType;
  // Only a writer-proven local retained reference may use this direct blob route.
  if (artifact.canvasId !== localCanvasId) return <p>This reference needs a permission-aware source read.</p>;
  const src = blobUrl(localCanvasId, hash);
  return <div ref={ref} className="exact-reference q-reference-preview">
    {onScreen && !failed && mimeType?.startsWith("image/") && <img src={src} alt={label} loading="lazy" onError={() => setFailedIdentity(identity)} />}
    {onScreen && mimeType === "text/html" && <ReferenceFrame canvasId={artifact.canvasId} hash={hash} name={label} />}
    {failed && <small role="status">Preview unavailable. You can still try opening the attachment.</small>}
    <a href={blobUrl(artifact.canvasId, artifact.blobHash)} target="_blank" rel="noopener noreferrer" download={version?.filename}>{label} · attached version</a>
    <details><summary>Reference details</summary><dl><dt>Canvas</dt><dd>{artifact.canvasId}</dd><dt>Item</dt><dd>{artifact.itemId}</dd><dt>Version</dt><dd>{artifact.versionId}</dd><dt>Content</dt><dd>{artifact.blobHash}</dd></dl></details>
  </div>;
}

function ReferenceFrame({ canvasId, hash, name }: { canvasId: string; hash: string; name: string }) {
  const origin = useContentOrigin(canvasId, [hash]);
  const frame = itemFrame(origin, canvasId, hash);
  return frame && <iframe title={`${name} preview`} src={frame.src} sandbox={frame.sandbox} tabIndex={-1} />;
}
