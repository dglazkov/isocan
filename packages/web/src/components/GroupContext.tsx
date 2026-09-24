import { useEffect, useMemo, useState } from "react";
import type { ContextContentPage, ContextManifest } from "@isocan/core";
import { fetchContextContent, fetchContextManifest } from "../lib/api.ts";
import { downloadItem } from "../lib/itemactions.ts";
import type { useMessageContext } from "../lib/messagecontext.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";

/** Complete identity and version disclosure is paged text, never a tree of content previews. */
export function ContextManifestView({ manifest, comment, initiallyOpen = false }: { manifest: ContextManifest; comment?: { threadId: string; commentId: string }; initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  const [offset, setOffset] = useState(0);
  const [face, setFace] = useState<"source" | "visual">("source");
  const [page, setPage] = useState<ContextContentPage | null>(null);
  const [error, setError] = useState("");
  const threadId = comment?.threadId; const commentId = comment?.commentId;
  useEffect(() => {
    if (!open) return;
    let cancelled = false; setPage(null); setError("");
    void fetchContextContent(manifest, offset, face, threadId && commentId ? { threadId, commentId } : undefined).then((answer) => { if (!cancelled) setPage(answer); }, (err: Error) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [manifest, offset, face, open, threadId, commentId]);
  const entries = manifest.entries.slice(offset, offset + 50);
  const roots = useMemo(() => {
    const entriesById = new Map(manifest.entries.map((entry) => [entry.itemId, entry]));
    // A repeated selected child remains in provenance, but its ancestor already supplies its chip.
    return manifest.rootIds.flatMap((id) => {
      const entry = entriesById.get(id);
      return entry && entry.depth > 0 ? [] : [`${entry?.kind === "group" ? "Group " : ""}${entry?.title ?? id}`];
    });
  }, [manifest]);
  const { included, excluded, unavailable } = manifest.counts;
  return <section className="group-context" aria-label={comment ? "Frozen message context" : "Message context preview"} onKeyDown={(event) => {
    // Disclosure controls keep their native Enter/arrow behavior; a composer
    // must not turn opening the manifest into sending the message.
    if (event.key === "Escape") { if (open) { setOpen(false); event.stopPropagation(); } }
    else event.stopPropagation();
  }}>
    <button type="button" className="group-context-summary" aria-expanded={open} onClick={() => setOpen(!open)}>
      <b>{roots.join(", ") || "Context"}</b> · {manifest.expandedIds.length} items
      <span>{included} included, {excluded} excluded{unavailable ? `, ${unavailable} unavailable` : ""}</span>
    </button>
    {open && <div className="group-context-disclosure">
      <p>{comment ? "Frozen when sent" : "Preview"} · revision {manifest.revision} · {manifest.expandedIds.length} total items</p>
      <p className="group-context-roots">Selected roots: {manifest.rootIds.join(", ")}</p>
      <label>Content face <select aria-label="Context content face" value={face} onChange={(event) => setFace(event.target.value as "source" | "visual")}><option value="source">Source</option><option value="visual">Visual</option></select></label>
      {error && <p role="alert">{error}</p>}
      {page && <p>This page: {page.counts.included} available, {page.counts.excluded} excluded, {page.counts.unavailable} unavailable.</p>}
      <ol start={offset + 1} aria-label="Complete context manifest">
        {entries.map((entry) => {
          const content = page?.entries.find((row) => row.itemId === entry.itemId);
          return <li key={entry.itemId} data-context-item-id={entry.itemId} style={{ paddingInlineStart: `${Math.min(entry.depth, 12) * 12}px` }}>
            <b>{entry.title}</b> <span>{entry.kind}{entry.excluded ? " · excluded" : ""}{entry.unavailable ? " · unavailable" : ""}</span>
            <small>{entry.itemId} · parent {entry.parentId ?? "canvas"}</small>
            {entry.annotation && <small>Attached to {entry.annotation.targetId}{entry.annotation.region ? ` · region ${entry.annotation.region}` : ""}</small>}
            <small>{entry.version ? `Version ${entry.version.id} · ${entry.version.filename} · ${entry.version.mimeType}` : "No current version"}</small>
            {entry.version && <small>Source: {entry.version.blobHash}</small>}
            {entry.version?.visual && <small>Visual: {entry.version.visual.filename ?? entry.version.filename} · {entry.version.visual.mimeType} · {entry.version.visual.blobHash}</small>}
            {entry.unavailable && <small>{entry.unavailable}</small>}
            {entry.threadIds.length > 0 && <small>Discussions: {entry.threadIds.join(", ")}</small>}
            {content?.status === "available" && content.blob ? <button type="button" onClick={() => void downloadItem(manifest.canvasId, content.blob!.blobHash, content.blob!.filename).catch((err: Error) => setError(err.message))}>Download {face}</button> : <small>{content?.reason ?? (content?.status === "excluded" ? "Excluded from this context" : page ? "Content unavailable" : "Checking content availability…")}</small>}
          </li>;
        })}
      </ol>
      <nav aria-label="Context pages"><button type="button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 50))}>Previous</button><span>{Math.min(offset + 1, manifest.entries.length)}–{Math.min(offset + 50, manifest.entries.length)} of {manifest.entries.length}</span><button type="button" disabled={offset + 50 >= manifest.entries.length} onClick={() => setOffset(offset + 50)}>Next</button></nav>
    </div>}
  </section>;
}

/** Readers can inspect explicit or ambient scope without opening an editing surface. */
export function LiveContextInspection({ canvasId, rootIds }: { canvasId: string; rootIds?: string[] }) {
  const [manifest, setManifest] = useState<ContextManifest | null>(null);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  // It follows the canvas, like the composer's preview: re-read once the
  // canvas has settled for a moment, never on a button a person must find.
  const lastSeq = useCanvasStore((state) => state.lastSeq);
  useEffect(() => {
    if (!manifest || lastSeq <= manifest.revision) return;
    const timer = setTimeout(() => setRefresh((value) => value + 1), 600);
    return () => clearTimeout(timer);
  }, [lastSeq, manifest]);
  const key = JSON.stringify([canvasId, rootIds]);
  useEffect(() => {
    let cancelled = false;
    const [id, roots] = JSON.parse(key) as [string, string[] | null];
    setManifest(null); setError("");
    void fetchContextManifest(id, roots ?? undefined).then((answer) => { if (!cancelled) setManifest(answer); }, (err: Error) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [key, refresh]);
  return <section aria-label="Inspect group context">
    <h3>{rootIds ? "Group context" : "Pinned context"}</h3>
    {error && <p role="alert">{error}</p>}
    {manifest ? <ContextManifestView key={`${key}:${refresh}`} manifest={manifest} /> : !error && <p>Loading complete context…</p>}
  </section>;
}

/** The same preview and explicit exclusion override precede every group-capable composer. */
export function MessageContextPreview({ context }: { context: ReturnType<typeof useMessageContext> }) {
  if (!context.enabled) return null;
  return <div className="message-context" onKeyDown={(event) => { if (event.key !== "Escape") event.stopPropagation(); }}>
    {context.loading && <p role="status">Loading complete context…</p>}
    {context.error && <p role="alert">{context.error}</p>}
    {context.manifest && <ContextManifestView key={`${context.manifest.revision}:${context.includeExcluded}:${context.manifest.rootIds.join(",")}`} manifest={context.manifest} />}
    {/* Each control appears only when it can do something: the override when
        something is excluded, Try again when the preview failed to load.
        Both used to render always, as bare browser defaults, and read as noise
        under every message that carried a selection. */}
    {/* The preview rebuilds itself when the canvas moves; only a failed load
        asks anything of the person. */}
    {context.error && <p className="message-context-note">
      The preview did not load.{" "}
      <button type="button" className="message-context-action" onClick={context.refresh}>Try again</button>
    </p>}
    {((context.manifest?.counts.excluded ?? 0) > 0 || context.includeExcluded) && <label className="message-context-note">
      <input type="checkbox" checked={context.includeExcluded} onChange={(event) => context.setIncludeExcluded(event.target.checked)} />
      Include the {context.manifest?.counts.excluded ?? 0} excluded {(context.manifest?.counts.excluded ?? 0) === 1 ? "item" : "items"} in this message
    </label>}
  </div>;
}
