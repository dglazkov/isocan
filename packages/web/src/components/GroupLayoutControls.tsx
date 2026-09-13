import { useEffect, useState } from "react";
import type { Actor, GroupLayout, Item } from "@isocan/core";
import { captureGroupExpectations } from "@isocan/core";
import { readBlobText } from "../lib/api.ts";
import { changeCanvasGroup, PendingGroupWriteError, saveGroupBrief } from "../lib/canvasgroups.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";

/** The inspector distinguishes scaling a group, changing its frame, and reserving room for words. */
export function GroupLayoutControls({ canvasId, actor, item }: { canvasId: string; actor: Actor; item: Item }) {
  const project = useCanvasStore((state) => state.project);
  const canvas = useCanvasStore((state) => state.canvas);
  const expected = project && canvas ? captureGroupExpectations({ project, canvas }, [item.id]) : [];
  const [width, setWidth] = useState(item.width);
  const [height, setHeight] = useState(item.height);
  const [layout, setLayout] = useState<GroupLayout>(item.groupLayout ?? {});
  const [brief, setBrief] = useState<string | null>(null);
  const [briefDirty, setBriefDirty] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [queued, setQueued] = useState(false);
  const signature = JSON.stringify([item.x, item.y, item.width, item.height, item.groupLayout, item.currentVersionId]);
  const [baseline, setBaseline] = useState(signature);
  const changed = signature !== baseline;
  const currentBlobHash = item.versions.find((version) => version.id === item.currentVersionId)?.blobHash;
  useEffect(() => {
    let live = true;
    if (currentBlobHash && !briefDirty) void readBlobText(canvasId, currentBlobHash).then((body) => { if (live) setBrief(body); }).catch((error: Error) => { if (live) setError(error.message); });
    return () => { live = false; };
  }, [canvasId, currentBlobHash, briefDirty]);
  function reload(latest: Item) {
    setWidth(latest.width); setHeight(latest.height); setLayout(latest.groupLayout ?? {}); setBriefDirty(false);
    setBaseline(JSON.stringify([latest.x, latest.y, latest.width, latest.height, latest.groupLayout, latest.currentVersionId]));
  }
  async function apply(work: () => Promise<void>) {
    setError(""); setBusy(true);
    try { await work(); const latest = useCanvasStore.getState().canvas?.items[item.id]; if (latest) reload(latest); }
    catch (error) { setError((error as Error).message); if (error instanceof PendingGroupWriteError) setQueued(true); }
    finally { setBusy(false); }
  }
  function number(key: keyof GroupLayout, fallback: number, label: string, minimum = 0) {
    return <label>{label}<input aria-label={label} type="number" min={minimum} value={typeof layout[key] === "number" ? layout[key] : fallback} onChange={(event) => setLayout({ ...layout, [key]: Number(event.target.value) })} /></label>;
  }
  return <details className="group-layout-controls">
    <summary>Frame, layout and brief</summary>
    {changed && <p role="alert">This group changed while these values were open. <button type="button" onClick={() => reload(item)}>Reload current group</button></p>}
    <fieldset disabled={busy || queued || changed}>
      <legend>Resize frame only</legend>
      <label>Frame width<input aria-label="Group frame width" type="number" min="1" value={width} onChange={(event) => setWidth(Number(event.target.value))} /></label>
      <label>Frame height<input aria-label="Group frame height" type="number" min="1" value={height} onChange={(event) => setHeight(Number(event.target.value))} /></label>
      <p>Preserves member positions and sizes. The frame must enclose its contents.</p>
      <button type="button" onClick={() => void apply(() => changeCanvasGroup(canvasId, actor, { kind: "frame", itemId: item.id, box: { x: item.x, y: item.y, width, height }, expected }))}>Resize frame only</button>
    </fieldset>
    <fieldset disabled={busy || queued || changed}>
      <legend>Layout and label space</legend>
      {number("titleHeight", 56, "Title band", 1)}
      {number("briefHeight", 0, "Brief band")}
      {number("inset", 24, "Content inset")}
      {number("rowCount", layout.rows?.length || 1, "Grid rows", 1)}
      {number("columnCount", layout.columns?.length || 1, "Grid columns", 1)}
      <label>Row names<input aria-label="Grid row names" value={layout.rows?.join(", ") ?? ""} onChange={(event) => setLayout({ ...layout, rows: event.target.value ? event.target.value.split(",").map((name) => name.trim()) : [] })} /></label>
      <label>Column names<input aria-label="Grid column names" value={layout.columns?.join(", ") ?? ""} onChange={(event) => setLayout({ ...layout, columns: event.target.value ? event.target.value.split(",").map((name) => name.trim()) : [] })} /></label>
      {number("rowGutter", 120, "Row label gutter")}
      {number("columnGutter", 32, "Column label gutter")}
      <button type="button" onClick={() => void apply(() => changeCanvasGroup(canvasId, actor, { kind: "layout", itemId: item.id, layout }))}>Save layout</button>
      <button type="button" onClick={() => void apply(() => changeCanvasGroup(canvasId, actor, { kind: "layout", itemId: item.id, layout, tidy: true }))}>Tidy contents with layout</button>
    </fieldset>
    <fieldset disabled={busy || queued || changed || brief === null}>
      <legend>Edit brief</legend>
      <textarea aria-label="Edit group brief" value={brief ?? ""} onChange={(event) => { setBriefDirty(true); setBrief(event.target.value); }} />
      <p>The brief and its reserved band are saved together; member geometry stays in place.</p>
      <button type="button" onClick={() => void apply(() => saveGroupBrief(canvasId, actor, item.id, brief ?? "", layout.briefHeight || 120))}>Save brief</button>
    </fieldset>
    {error && <p role="alert">{error}</p>}
  </details>;
}
