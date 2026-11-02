import { useEffect, useRef, useState } from "react";
import type { DesignArtifactRef, ItemVersion } from "@isocan/core";
import { useContentOrigin } from "../lib/contentBase.ts";
import { useFrameSrc } from "../lib/frame.ts";

/** A permission-checked exact local version can be tried without changing the draft choice. */
export function DesignComparisonPreview({ canvasId, artifact, version, title, onBack }: {
  canvasId: string; artifact: DesignArtifactRef; version: ItemVersion; title: string; onBack: () => void;
}) {
  if (artifact.canvasId !== canvasId || version.id !== artifact.versionId || version.blobHash !== artifact.blobHash) return <p role="alert">This version needs an authorized source preview. <button className="btn secondary" onClick={onBack}>Return to comparison</button></p>;
  if (version.mimeType !== "text/html") return <p role="status">This option does not support an interactive HTML preview. <button className="btn secondary" onClick={onBack}>Return to comparison</button></p>;
  return <ExactFrame canvasId={canvasId} artifact={artifact} version={version} title={title} onBack={onBack} />;
}

function ExactFrame({ canvasId, artifact, version, title, onBack }: { canvasId: string; artifact: DesignArtifactRef; version: ItemVersion; title: string; onBack: () => void }) {
  const origin = useContentOrigin(canvasId, [artifact.blobHash]);
  const frame = useFrameSrc(origin, canvasId, artifact.blobHash);
  const [loaded, setLoaded] = useState(false);
  const back = useRef<HTMLButtonElement>(null);
  useEffect(() => { back.current?.focus(); }, []);
  return <section className="design-comparison-try" aria-label={`Try ${title}`} data-comparison-preview={artifact.versionId}>
    <header><div><small>Trying an attached version · this does not choose it</small><h3>{title}</h3></div><button ref={back} className="btn secondary" onClick={onBack}>Return to comparison</button></header>
    <p className="design-comparison-help">Use the example’s own controls to try its task. Its notice describes where prototype data is kept.</p>
    {!loaded && <p role="status">Opening this exact version…</p>}
    {frame && <iframe className="design-comparison-frame" title={`Try ${title}`} src={frame.src} sandbox={`${frame.sandbox} allow-forms`} onLoad={() => setLoaded(true)} />}
    <footer><button className="btn secondary" onClick={onBack}>Return to comparison</button>{frame && <a href={frame.src} target="_blank" rel="noopener noreferrer">Open this exact version in a new tab</a>}<details><summary>Version details</summary><p>{version.filename}</p><code>{artifact.versionId}<br />{artifact.blobHash}</code></details></footer>
  </section>;
}
