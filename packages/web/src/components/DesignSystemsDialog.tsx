import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isGroupItem, newOpId, newVersionId, type Actor } from "@isocan/core";
import { projectDesignSystem, readDesignSystem, reconcileDesignProjection, prepareDesignReconciliation, parseDesignProjection, type DesignSystemRead, type DesignSystemTarget } from "@isocan/api/design-system";
import { designSystemIO } from "../lib/design-system.ts";
import { designSystemDraftText, switchDesignSystemDraft, newDesignSystemDraft, readDesignSystemDraft, type DesignSystemDraft, type DirectionFields } from "../lib/design-system-draft.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useCanEdit } from "../lib/capability.ts";
import { everyWhileVisible } from "../lib/whilevisible.ts";
import { Modal } from "./Modal.tsx";
import { DesignRecipeLibrary } from "./DesignRecipeLibrary.tsx";
import "./design-systems.css";

/** Downloaded working files retain the same projection manifest that the CLI reconciles. */
export function saveDesignFile(text: string, filename: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type })), link = document.createElement("a");
  link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** One lazy scope picker exposes governing facts, conditional working files and inspectable references. */
export function DesignSystemsDialog({ canvasId, actor, initialTarget, onClose }: { canvasId: string; actor: Actor; initialTarget: DesignSystemTarget; onClose: () => void }) {
  const [target, setTarget] = useState(initialTarget), body = useRef<HTMLDivElement>(null);
  const canvas = useCanvasStore((state) => state.canvas);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const controls = () => [...(body.current?.closest('[role="dialog"]')?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary') ?? [])].filter((element) => element.getClientRects().length > 0);
    controls()[0]?.focus();
    const key = (event: KeyboardEvent) => { if (event.key !== "Tab") return; const all = controls(), first = all[0], last = all.at(-1); if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } };
    window.addEventListener("keydown", key); return () => { window.removeEventListener("keydown", key); previous?.focus(); };
  }, []);
  const encoded = JSON.stringify(target);
  return <Modal label="Design system and references" title="Design system & references" onClose={onClose} wide><div className="design-systems" ref={body}>
    <label className="design-scope">Designing for<select aria-label="Design scope" value={encoded} onChange={(event) => setTarget(JSON.parse(event.target.value) as DesignSystemTarget)}><option value={JSON.stringify({ kind: "canvas" })}>Canvas · default and uncovered screens</option>{Object.values(canvas?.items ?? {}).filter(isGroupItem).map((item) => <option key={item.id} value={JSON.stringify({ kind: "group", groupId: item.id })}>Group · {item.title}</option>)}{Object.values(canvas?.items ?? {}).filter((item) => !isGroupItem(item)).map((item) => <option key={item.id} value={JSON.stringify({ kind: "item", itemId: item.id })}>Item · {item.title}</option>)}{target.kind === "point" && <option value={encoded}>Chosen canvas position</option>}</select></label>
    <SystemScope key={JSON.stringify([canvasId, actor.id, target])} canvasId={canvasId} actor={actor} target={target} />
  </div></Modal>;
}

function SystemScope({ canvasId, actor, target }: { canvasId: string; actor: Actor; target: DesignSystemTarget }) {
  const io = useMemo(() => designSystemIO(actor), [actor]);
  const seq = useCanvasStore((state) => state.lastSeq), past = useCanvasStore((state) => state.past), permitted = useCanEdit();
  const [read, setRead] = useState<DesignSystemRead | null>(null), [checking, setChecking] = useState(true), [readError, setReadError] = useState("");
  const [revision, setRevision] = useState(0), refresh = useCallback(() => setRevision((value) => value + 1), []);
  const [draft, setDraft] = useState<DesignSystemDraft | null>(null), draftRef = useRef(draft);
  const [restoring, setRestoring] = useState(true), [corrupt, setCorrupt] = useState(false), [storageError, setStorageError] = useState("");
  const [archived, setArchived] = useState<string[]>([]);
  const [busy, setBusy] = useState(false), busyRef = useRef(false), [notice, setNotice] = useState("");
  const storageKey = `isocan.design.system.v1:${JSON.stringify([canvasId, actor.id, target])}`;
  const keep = useCallback((next: DesignSystemDraft | null) => { draftRef.current = next; setDraft(next); try { if (next) localStorage.setItem(storageKey, JSON.stringify(next)); else localStorage.removeItem(storageKey); setStorageError(""); } catch { setStorageError("This working draft could not be kept for refresh. Keep this page open."); } }, [storageKey]);
  useEffect(() => { try { setArchived(Object.keys(localStorage).filter((key) => key.startsWith(`${storageKey}:archive:`)).sort().reverse()); } catch { setStorageError("Saved draft history could not be read."); } }, [storageKey]);
  useEffect(() => { let active = true; void (async () => { try { const raw = localStorage.getItem(storageKey); if (!raw) return; const saved = await readDesignSystemDraft(raw); if (saved.projection.destination.canvasId !== canvasId || JSON.stringify(saved.projection.destination.target) !== JSON.stringify(target)) throw new Error("The saved projection belongs to another scope."); if (active) { draftRef.current = saved; setDraft(saved); } } catch { if (active) setCorrupt(true); } finally { if (active) setRestoring(false); } })(); return () => { active = false; }; }, [storageKey, canvasId, target]);
  useEffect(() => everyWhileVisible(refresh, 10_000), [refresh]);
  useEffect(() => { const controller = new AbortController(); setChecking(true); setReadError(""); void readDesignSystem(io, { canvasId, target, signal: controller.signal }).then((value) => { if (!controller.signal.aborted) setRead(value); }).catch((error) => { if (!controller.signal.aborted) setReadError(error instanceof Error ? error.message : "The design system could not be read."); }).finally(() => { if (!controller.signal.aborted) setChecking(false); }); return () => controller.abort(); }, [io, canvasId, target, seq, revision]);
  const governing = read?.governing, editable = permitted && !past;
  const stale = !!draft && !!governing && (governing.status !== "available" || JSON.stringify(governing.artifact) !== JSON.stringify(draft.projection.source) || JSON.stringify(governing.metadata) !== JSON.stringify(draft.projection.expectedMetadata) || governing.exempt !== draft.projection.exempt);
  const act = async (work: () => Promise<void>) => { if (busyRef.current) return; busyRef.current = true; setBusy(true); setNotice(""); try { await work(); } catch (error) { setNotice(error instanceof Error ? error.message : "The action could not be completed."); } finally { busyRef.current = false; setBusy(false); } };
  const capture = (mode: DesignSystemDraft["mode"]) => act(async () => { keep(newDesignSystemDraft(await projectDesignSystem(io, { canvasId, target }), mode)); });
  const submit = () => act(async () => {
    const current = draftRef.current; if (!current) return;
    if (!editable) throw new Error("This canvas is read-only.");
    if (!current.pending && (stale || checking || readError)) throw new Error("Read and review the current source before saving this draft.");
    const prepared = current.pending ? current : { ...current, pending: { opId: newOpId(), versionId: newVersionId(), mode: current.mode, refused: false } };
    const request = await prepareDesignReconciliation({ projection: prepared.projection, opId: prepared.pending!.opId, versionId: prepared.pending!.versionId, retry: !!current.pending, text: designSystemDraftText(prepared) });
    keep(prepared);
    const result = await reconcileDesignProjection(io, request);
    if (result.status === "accepted") {
      keep(result.savedProjection ? newDesignSystemDraft(result.savedProjection, prepared.mode) : { ...prepared, pending: null });
      setNotice(`Saved one source version.${result.consistency?.status === "current" ? " Its governing context is current." : ` Content was saved; ${result.consistency?.reasons.join(" ") || "current consistency could not be confirmed."}`}`); refresh();
    } else { keep({ ...prepared, pending: { ...prepared.pending!, refused: result.status === "refused" } }); setNotice(`${result.status === "pending" ? "Awaiting confirmation." : "Save refused."} ${result.reason ?? "Your working draft and retry identity are retained."}`); }
  });
  const preserveAndClose = () => act(async () => {
    const current = draftRef.current; if (!current || current.pending) return;
    const archiveKey = `${storageKey}:archive:${new Date().toISOString()}:${newOpId()}`;
    // Preserve the full conditional base and incomplete fields before releasing the active editor.
    localStorage.setItem(archiveKey, JSON.stringify(current));
    setArchived((keys) => [archiveKey, ...keys]); keep(null);
    setNotice("The working draft is preserved in this browser. You can now open the current source or restore it below.");
  });
  const patchDirection = (patch: Partial<DirectionFields>) => { if (draft && !draft.pending) keep({ ...draft, direction: { ...draft.direction, ...patch } }); };
  const healthy = !checking && !readError;
  return <>
    {checking && <p role="status">Checking this scope’s design…</p>}{readError && <p role="alert">{readError} <button className="btn secondary" onClick={refresh}>Retry read</button></p>}
    {governing && <section className="design-scope-summary" aria-label="Governing design"><h3>{governing.status === "available" ? governing.title : governing.status === "unavailable" ? "Design context unavailable" : "No governing design document"}</h3><p>{governing.status === "available" ? governing.selection.reason : governing.reason}</p>{governing.exempt && <p>No written system is required on this canvas.{governing.artifact ? " The existing system still governs this scope." : " You can still record an optional direction."}</p>}
      {read?.standing && healthy && <p className="design-standing" data-design-standing={read.standing.standing}>{read.standing.standing === "fine" ? `${read.standing.screenCount} ${read.standing.screenCount === 1 ? "screen" : "screens"} in this scope.` : `${read.standing.uncoveredIds.length} ${read.standing.uncoveredIds.length === 1 ? "screen needs" : "screens need"} a reusable design direction${read.standing.standing === "overdue" ? " before expanding further" : ""}.`}</p>}
      {governing.selection.candidates.length > 1 && <p role="status">Multiple documents share the winning scope. The existing newest-document rule selects the one above.</p>}
      {read?.direction.status === "valid" && <div className="design-direction-summary"><strong>{read.direction.direction.stage === "accepted" ? "Accepted treatments · authored record" : "Provisional direction"}</strong><p>{read.direction.direction.rationale}</p><ol>{read.direction.direction.taskHierarchy.map((line, index) => <li key={index}>{line}</li>)}</ol><small>Written by {read.author?.name ?? "an unknown author"}. This declared stage is design documentation.</small><details><summary>Reusable treatments</summary>{read.direction.direction.treatments.map((treatment) => <p key={treatment.name}><strong>{treatment.name}</strong> · {treatment.guidance}<br /><small>{treatment.states.join(" · ")}</small></p>)}</details></div>}
      {read?.direction.status === "malformed" && <p role="alert">The direction could not be read: {read.direction.problems.join(" ")}</p>}
      <details><summary>Selection and exact source</summary><p>Winning level: {governing.selection.level}</p>{governing.selection.candidates.map((one) => <p key={one.artifact.itemId}>{one.title} · version {one.artifact.versionId}</p>)}{governing.artifact && <code>{JSON.stringify(governing.artifact, null, 2)}</code>}{governing.refusedSources.map((one) => <p key={`${one.canvasId}:${one.itemId}`}>{one.reason}</p>)}</details>
      {governing.status === "available" && !draft && !restoring && !corrupt && <div className="design-system-actions"><button className="btn secondary" disabled={!healthy || busy} onClick={() => void capture("document")}>Open working document</button>{editable && <button className="btn secondary" disabled={!healthy || busy || read?.direction.status === "malformed"} onClick={() => void capture("direction")}>{read?.direction.status === "valid" ? "Edit reusable direction" : "Record provisional direction"}</button>}</div>}
    </section>}
    {corrupt && <p role="alert">An earlier working draft could not be read. Its saved contents are preserved. <button className="btn secondary" onClick={() => { try { const raw = localStorage.getItem(storageKey); if (raw) localStorage.setItem(`${storageKey}:recovery:${Date.now()}`, raw); localStorage.removeItem(storageKey); setCorrupt(false); } catch { setStorageError("Free browser storage before preserving this draft and starting again."); } }}>Preserve old draft and start again</button></p>}
    {draft && <section className="design-working" aria-label="Working design document"><header><h3>{draft.mode === "direction" ? "Reusable direction" : "Working DESIGN.md"}</h3><button className="btn secondary" disabled={busy || !!draft.pending} onClick={() => void preserveAndClose()}>Preserve and close draft</button></header><p className="design-system-help">Editing {draft.projection.expectedMetadata.title}. Saving updates that source as one new version.</p>
      {stale && <p role="alert">The governing source changed after this draft began. Your words and original source are retained.</p>}
      <fieldset disabled={busy || !!draft.pending || !editable}>{draft.mode === "document" ? <label>Document text<textarea className="design-source" spellCheck={false} rows={16} value={draft.text} onChange={(event) => keep({ ...draft, text: event.target.value })} /></label> : <DirectionEditor fields={draft.direction} patch={patchDirection} />}</fieldset>
      {stale && governing?.status === "available" && <details><summary>Read the current source before reviewing</summary><pre>{governing.text}</pre></details>}
      {stale && !draft.pending && <button className="btn secondary" disabled={!healthy || busy} onClick={() => void act(async () => { const projection = await projectDesignSystem(io, { canvasId, target }); if (projection.source.canvasId !== draft.projection.source.canvasId || projection.source.itemId !== draft.projection.source.itemId || projection.source.home !== draft.projection.source.home) throw new Error("A different document now governs. Preserve and close this draft, then open the current source. A different document cannot be silently replaced."); keep({ ...draft, projection }); setNotice("Your changes now use the explicitly reviewed source version. Review their content before saving."); })}>I reviewed the current source; retain my edits</button>}
      {draft.pending && <p role="status">This save retains its original operation and version IDs.{draft.pending.refused && <button className="btn secondary" onClick={() => keep({ ...draft, pending: null })}>Edit after refusal</button>}</p>}
      <div className="design-system-actions"><button className="btn primary" disabled={!editable || busy || !draft.pending && (stale || !healthy)} onClick={() => void submit()}>{draft.pending ? "Retry exact save" : "Save source version"}</button><button className="btn secondary" disabled={busy} onClick={() => void act(async () => saveDesignFile(designSystemDraftText(draft), "DESIGN.md", "text/markdown"))}>Export DESIGN.md</button><button className="btn secondary" disabled={busy || !!draft.pending} onClick={() => void act(async () => keep(switchDesignSystemDraft(draft)))}>{draft.mode === "document" ? "Edit reusable direction" : "Edit full document"}</button><button className="btn secondary" onClick={() => saveDesignFile(JSON.stringify(draft.projection, null, 2), "DESIGN.projection.json", "application/json")}>Export source manifest</button></div>
      <label className="design-file">Load edited DESIGN.md<input type="file" accept=".md,.txt" disabled={busy || !!draft.pending || !editable} onChange={(event) => { const file = event.target.files?.[0]; if (file) void act(async () => { if (file.size > 1024 * 1024) throw new Error("The working document exceeds 1 MiB."); keep({ ...draft, mode: "document", text: await file.text() }); }); event.target.value = ""; }} /></label>
      <details><summary>Captured source version</summary><code>{JSON.stringify(draft.projection.source, null, 2)}</code><pre>{draft.projection.baseText}</pre></details>
    </section>}
    {!draft && !restoring && !corrupt && <label className="design-file">Open a working-file manifest<input type="file" accept=".json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void act(async () => { if (file.size > 2 * 1024 * 1024) throw new Error("The manifest is too large."); const projection = await parseDesignProjection(JSON.parse(await file.text())); if (projection.destination.canvasId !== canvasId || JSON.stringify(projection.destination.target) !== JSON.stringify(target)) throw new Error("Choose this manifest’s original canvas and scope before opening it."); keep(newDesignSystemDraft(projection, "document")); }); event.target.value = ""; }} /></label>}
    {archived.length > 0 && <details className="design-archived-drafts"><summary>Preserved working drafts ({archived.length})</summary><p>These retain their original source and incomplete edits. Restore one when the current editor is closed, or download its full draft record.</p>{archived.map((key, index) => <div className="design-system-actions" key={key}><span>Saved draft {archived.length - index}</span><button className="btn secondary" disabled={busy || !!draft} onClick={() => void act(async () => { const raw = localStorage.getItem(key); if (!raw) throw new Error("This preserved draft is unavailable."); keep(await readDesignSystemDraft(raw)); })}>Restore draft</button><button className="btn secondary" onClick={() => void act(async () => { const raw = localStorage.getItem(key); if (!raw) throw new Error("This preserved draft is unavailable."); saveDesignFile(raw, "DESIGN.draft.json", "application/json"); })}>Download draft record</button></div>)}</details>}
    {notice && <p role="status" className="design-system-notice">{notice}</p>}{storageError && <p role="alert">{storageError}</p>}
    <DesignRecipeLibrary canvasId={canvasId} actor={actor} target={target} canEdit={editable} onAdded={refresh} onDirection={(direction) => { if (draft && !draft.pending) { keep({ ...draft, mode: "direction", direction }); setNotice("Starting direction copied into your working draft. Adapt it to this task before saving."); } }} canAdapt={!!draft && !draft.pending && editable} />
  </>;
}

function DirectionEditor({ fields, patch }: { fields: DirectionFields; patch: (patch: Partial<DirectionFields>) => void }) {
  return <><p className="design-system-help">Record the choices that another screen should reuse. “Accepted” describes this authored record; it does not create a human preference.</p><label>Stage<select value={fields.stage} onChange={(event) => patch({ stage: event.target.value as DirectionFields["stage"] })}><option value="provisional">Provisional direction</option><option value="accepted">Accepted reusable treatments</option></select></label><label>Why this direction?<textarea rows={3} value={fields.rationale} onChange={(event) => patch({ rationale: event.target.value })} /></label><label>Task hierarchy, one step per line<textarea rows={3} value={fields.taskHierarchy} onChange={(event) => patch({ taskHierarchy: event.target.value })} /></label>{([['layout', 'Layout'], ['density', 'Information density'], ['typography', 'Type roles'], ['palettePurpose', 'Purpose of the palette']] as const).map(([field, label]) => <label key={field}>{label}<textarea rows={2} value={fields[field]} onChange={(event) => patch({ [field]: event.target.value })} /></label>)}<h4>Reusable interaction treatments</h4>{fields.treatments.map((one, index) => <div className="design-treatment" key={index}><label>Treatment name<input value={one.name} onChange={(event) => patch({ treatments: fields.treatments.map((value, i) => i === index ? { ...value, name: event.target.value } : value) })} /></label><label>When and how to use it<textarea rows={2} value={one.guidance} onChange={(event) => patch({ treatments: fields.treatments.map((value, i) => i === index ? { ...value, guidance: event.target.value } : value) })} /></label><label>States, separated by commas<input value={one.states} onChange={(event) => patch({ treatments: fields.treatments.map((value, i) => i === index ? { ...value, states: event.target.value } : value) })} /></label>{fields.treatments.length > 1 && <button className="btn secondary" type="button" onClick={() => patch({ treatments: fields.treatments.filter((_, i) => i !== index) })}>Remove treatment</button>}</div>)}{fields.treatments.length < 32 && <button className="btn secondary" type="button" onClick={() => patch({ treatments: [...fields.treatments, { name: "", guidance: "", states: "" }] })}>Add treatment</button>}<details><summary>Associated request</summary><label>Request ID, if known<input value={fields.requestId} onChange={(event) => patch({ requestId: event.target.value })} /></label></details></>;
}
