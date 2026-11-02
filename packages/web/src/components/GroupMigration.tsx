import { useCallback, useEffect, useState } from "react";
import type { Actor, CanvasGroupMigrationPreview } from "@isocan/core";
import { fetchGroupMigration } from "../lib/api.ts";
import { useCanEdit } from "../lib/capability.ts";
import { sendEchoedResult, useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { Modal } from "./Modal.tsx";

/** How long a person waits before the dialog says something instead of spinning. */
const PREVIEW_DEADLINE_MS = 15_000;

/** Conversion is reviewed and committed at the home; this form never predicts a cutover. */
export function GroupMigration({ canvasId, actor }: { canvasId: string; actor: Actor }) {
  const dialog = useUiStore((state) => state.groupDialog);
  const mode = useCanvasStore((state) => state.record?.groupMode);
  const lastSeq = useCanvasStore((state) => state.lastSeq);
  const past = useCanvasStore((state) => state.past);
  const pendingMigration = useCanvasStore((state) => state.queue.find((write) => write.op.type === "group.change" && write.op.action.kind === "migrate"));
  const canEdit = useCanEdit();
  const [preview, setPreview] = useState<CanvasGroupMigrationPreview | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [queued, setQueued] = useState(false);
  const [converted, setConverted] = useState(false);
  const close = useCallback(() => { if (useUiStore.getState().groupDialog === dialog) useUiStore.getState().setGroupDialog(null); }, [dialog]);
  /**
   * **A preview that never arrives has to say so.**
   *
   * This read had no deadline, and neither does anything under it: `request`
   * calls `fetch` untimed, and on a 401 it knocks on the door first — another
   * untimed `fetch`. A home that accepts the connection and then goes quiet
   * left this dialog saying *Loading conversion preview…* with no error, no
   * timeout and nothing to do but close it, which is the shape
   * `docs/reviews/lessons.md` #6 is about: a hang that never fails is worse
   * than a slow thing that eventually does.
   *
   * Seen for real against a daemon sixteen hours older than the route
   * (`/api/projects/:id/groups/migration` landed with canvas-groups phase 5),
   * which answered the unknown path with a 401 and sent the client to a door
   * that never came back.
   *
   * Two halves, because either alone is half a fix. The signal cancels the
   * request this component owns. The deadline is what the PERSON sees, and it
   * fires wherever the wait is — including inside a recovery this signal
   * cannot reach. The message names the likely cause rather than the symptom:
   * on a laptop, the overwhelmingly common reason is a daemon older than the
   * feature.
   */
  useEffect(() => {
    const controller = new AbortController();
    let settled = false;
    setPreview(null); setError("");
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      controller.abort();
      setError(
        "The home did not answer in 15 seconds. If this is a local daemon it may be older than " +
          "the conversion route — `isocan restart` picks up the current code. Refresh the preview to try again.",
      );
    }, PREVIEW_DEADLINE_MS);
    void fetchGroupMigration(canvasId, controller.signal).then(
      (answer) => { if (!settled) { settled = true; clearTimeout(timer); setPreview(answer); } },
      (err: Error) => {
        if (settled) return;
        settled = true; clearTimeout(timer);
        setError(err.name === "AbortError" ? "The conversion preview was cancelled." : err.message);
      },
    );
    return () => { settled = true; clearTimeout(timer); controller.abort(); };
  }, [canvasId, refresh]);
  const stale = Boolean(preview && lastSeq > preview.revision);
  async function convert() {
    if (!preview || preview.status === "already-groups" || !canEdit || past || busy || queued || pendingMigration || stale || mode === "groups") return;
    setBusy(true); setError("");
    try {
      let result = await sendEchoedResult(canvasId, actor, { type: "group.change", action: { kind: "migrate", expectedRevision: preview.revision } });
      if (useCanvasStore.getState().canvasId !== canvasId) return;
      if (result.status === "queued") {
        setQueued(true);
        if (!result.completion) return;
        result = await result.completion;
        if (useCanvasStore.getState().canvasId !== canvasId) return;
        setQueued(false);
      }
      if (result.status === "refused") setError(`${result.message ?? "Conversion was refused."} Refresh the preview before trying again.`);
      else setConverted(true);
    } catch (err) { if (useCanvasStore.getState().canvasId === canvasId) setError((err as Error).message); }
    finally { setBusy(false); }
  }
  return <Modal label="Convert areas to groups" title="Convert areas to groups" wide onClose={close}>
    <div className="group-migration">
      <p>Groups have explicit members: moving or resizing a group carries its contents. Review the complete conversion before applying it.</p>
      {preview ? <MigrationReview key={preview.revision} preview={preview} /> : !error && <p role="status">Loading conversion preview…</p>}
      {stale && <p role="status">The canvas changed after this preview. Refresh it to review the current conversion.</p>}
      {error && <p role="alert">{error}</p>}
      {(queued || pendingMigration) && <p role="status">{pendingMigration?.accepted ? "Conversion accepted. Waiting for its ordered history." : "Conversion queued with its original preview revision. Wait for the home; it will refuse the request if the canvas has changed."}</p>}
      {converted || mode === "groups" || preview?.status === "already-groups" ? <p role="status">This canvas now uses groups. Close this preview to continue.</p> : <>
        <button className="btn" disabled={busy || queued} onClick={() => setRefresh((value) => value + 1)}>Refresh conversion preview</button>
        {canEdit && <button className="btn primary" disabled={!preview || busy || queued || Boolean(pendingMigration) || stale || Boolean(past)} onClick={() => void convert()}>{busy ? "Converting…" : "Convert canvas to groups"}</button>}
        {!canEdit && <p>You can inspect this preview. An editor must apply the conversion.</p>}
        {past && <p>Return to now before converting this canvas.</p>}
      </>}
    </div>
  </Modal>;
}

/** Complete ownership and repairs stay readable without mounting any item content. */
export function MigrationReview({ preview }: { preview: CanvasGroupMigrationPreview }) {
  const names = new Map([...preview.live, ...preview.trash].map((row) => [row.itemId, row.title]));
  const named = (id: string | null) => id ? `${names.get(id) ?? id} (${id})` : "Canvas root";
  return <div aria-label="Complete conversion preview">
    <p>Revision {preview.revision} · {preview.live.length} live records · {preview.trash.length} trash records · conversion version {preview.migrationVersion}</p>
    <p>Existing area frames become root groups. Overlapping frames do not become nested. Ordinary items choose the smallest area containing their centre, with stable ID ties; attached marks follow their live target.</p>
    <p>IDs, versions, discussions and existing board properties are retained. Item positions stay unchanged; every required frame or label repair is listed below.</p>
    <MigrationRows label="Live ownership" rows={preview.live} named={named} />
    <h3>Ambiguous geometric ownership ({preview.ambiguities.length})</h3>
    {preview.ambiguities.length ? <ul>{preview.ambiguities.map((row) => <li key={row.itemId}>{named(row.itemId)} → {named(row.chosenId)}. Candidates: {row.candidateIds.map(named).join(", ")}.</li>)}</ul> : <p>No ambiguous owners.</p>}
    <h3>Geometry and label repairs ({preview.repairs.length})</h3>
    {preview.repairs.length ? <ul>{preview.repairs.map((row) => <li key={`${row.location}:${row.itemId}`} data-migration-repair-id={row.itemId}>{named(row.itemId)} ({row.location}): {row.reasons.join("; ")}. {box(row.boxBefore)} → {box(row.boxAfter)}</li>)}</ul> : <p>No geometry repairs.</p>}
    <h3>Dangling annotations ({preview.danglingAnnotations.length})</h3>
    <p>Existing dangling links stay intact and are excluded from target-driven movement. They are not assigned to a nearby item.</p>
    {preview.danglingAnnotations.length > 0 && <ul>{preview.danglingAnnotations.map((id) => <li key={id}>{named(id)}</li>)}</ul>}
    <h3>Legacy trash</h3>
    <p>Trashed areas become frame-only group restores. Other legacy trash restores at the canvas root. Conversion does not invent a historical subtree or deletion cohort.</p>
    <MigrationRows label="Trash restore policy" rows={preview.trash} named={named} />
    <h3>History and undo boundary</h3>
    <p>Boundary at sequence {preview.history.undoBoundarySeq}: {preview.history.explanation}</p>
    <p>Historical timeline playback stays available. Undoing conversion must not strand later group-dependent live items, trash, or saved Undo and Redo candidates. Conversion never clears trash or discards history to make rollback possible.</p>
  </div>;
}

function box(value: CanvasGroupMigrationPreview["live"][number]["boxBefore"]): string { return `${value.width} × ${value.height} at ${value.x}, ${value.y}`; }
function MigrationRows({ label, rows, named }: { label: string; rows: CanvasGroupMigrationPreview["live"]; named: (id: string | null) => string }) {
  const [offset, setOffset] = useState(0);
  return <section aria-label={label}>
    <h3>{label} ({rows.length})</h3>
    <ol start={offset + 1}>{rows.slice(offset, offset + 50).map((row) => <li key={row.itemId} data-migration-item-id={row.itemId}>
      <b>{row.title}</b> · {row.itemId} · {row.kindBefore ?? "item"} → {row.kindAfter ?? "item"}
      <div>Parent: {named(row.parentBefore)} → {named(row.parentAfter)}</div>
      <div>{box(row.boxBefore)} → {box(row.boxAfter)}</div>
      {row.restorePolicy && <div>Restore: {row.restorePolicy === "frame-only" ? "group frame only, without an inferred subtree" : "canvas root"}</div>}
    </li>)}</ol>
    {rows.length > 50 && <nav aria-label={`${label} pages`}><button className="btn" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 50))}>Previous</button><span>{offset + 1}–{Math.min(offset + 50, rows.length)} of {rows.length}</span><button className="btn" disabled={offset + 50 >= rows.length} onClick={() => setOffset(offset + 50)}>Next</button></nav>}
  </section>;
}
