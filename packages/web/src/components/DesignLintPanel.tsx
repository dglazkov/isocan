import { useCallback, useEffect, useRef, useState } from "react";
import type { Actor, AuditRange, CanvasSnapshotResponse } from "@isocan/core";
import { newOpId, newVersionId, workbenchItemPath } from "@isocan/core";
import type { ItemDesignAudit } from "@isocan/api/design-audit";
import { prepareDesignRepair, type DesignRepairBasis } from "@isocan/api/design-repair";
import { getSnapshot } from "../lib/api.ts";
import { captureDesignAuditRepair, designRepairIO, readDesignAudit, saveDesignRepair } from "../lib/design-audit.ts";
import { archiveDesignRepairDraft, designRepairDraftKey, keepDesignRepairDraft, readDesignRepairDraft, type DesignRepairDraft } from "../lib/design-repair-draft.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { everyWhileVisible } from "../lib/whilevisible.ts";
import { DesignContractSummary } from "./DesignContractSummary.tsx";
import "./design-lint.css";

interface CheckedDraft { text: string; item: ItemDesignAudit }

/** Source findings and saved repair intent have separate lifetimes: polling never rebases the editor's original capture. */
export function DesignLintPanel({ canvasId, itemId, actor, opened, text, baseVersionId, filename, dirty, saving, onSelect, onSaved, onBusyChange }: {
  canvasId: string; itemId: string; actor: Actor; opened: CanvasSnapshotResponse | null;
  text: string; baseVersionId: string; filename: string; dirty: boolean; saving: boolean;
  onSelect: (range: AuditRange, checkedText: string) => void;
  onSaved: (text: string, versionId: string) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const canvas = useCanvasStore(state => state.canvas);
  const key = designRepairDraftKey(canvasId, actor.id, itemId);
  const [checked, setChecked] = useState<CheckedDraft | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [draft, setDraft] = useState<DesignRepairDraft | null>(null);
  const draftRef = useRef<DesignRepairDraft | null>(null);
  const [loadingDraft, setLoadingDraft] = useState(true);
  const [recoveryError, setRecoveryError] = useState("");
  const [reviewed, setReviewed] = useState<DesignRepairBasis | null>(null);
  const [currentRepair, setCurrentRepair] = useState<{ status: string; reasons: string[] } | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const live = useRef(true);
  const repairRequest = useRef<AbortController | null>(null);
  const callbacks = useRef({ onSaved, onBusyChange });
  callbacks.current = { onSaved, onBusyChange };
  const keep = useCallback((value: DesignRepairDraft) => {
    keepDesignRepairDraft(localStorage, key, value);
    draftRef.current = value; setDraft(value);
  }, [key]);
  useEffect(() => { live.current = true; return () => { live.current = false; repairRequest.current?.abort(); }; }, []);
  useEffect(() => {
    const controller = new AbortController(); setLoadingDraft(true);
    void (async () => {
      const raw = localStorage.getItem(key);
      if (raw !== null) return readDesignRepairDraft(raw, canvasId, actor.id, itemId);
      if (!opened) throw new Error("The editor's original canvas capture is unavailable. Review current inputs explicitly before preparing a repair.");
      const basis = await captureDesignAuditRepair(canvasId, itemId, opened, controller.signal);
      return { schemaVersion: 1 as const, canvasId, actorId: actor.id, itemId, basis, editorBaseVersionId: basis.repair.target.artifact.versionId, pending: null, accepted: null };
    })().then(value => { if (!controller.signal.aborted) keep(value); }).catch(error => { if (!controller.signal.aborted) setRecoveryError(error instanceof Error ? error.message : String(error)); }).finally(() => { if (!controller.signal.aborted) setLoadingDraft(false); });
    return () => controller.abort();
  }, [key, canvasId, actor.id, itemId, opened, keep]);
  const pending = draft?.pending;
  const uncertain = !!pending && !pending.refused;
  useEffect(() => { callbacks.current.onBusyChange(repairing || uncertain || loadingDraft); }, [repairing, uncertain, loadingDraft]);
  useEffect(() => everyWhileVisible(() => setRefresh(n => n + 1), 10_000), []);
  useEffect(() => {
    const controller = new AbortController(); setRefreshing(true); setChecked(null); setUnavailable(null);
    const timer = setTimeout(() => {
      void readDesignAudit(canvasId, { itemIds: [itemId], draft: { itemId, text, label: filename, baseVersionId }, signal: controller.signal }).then(report => {
        if (controller.signal.aborted) return;
        const item = report.items.find(one => one.itemId === itemId);
        if (item) setChecked({ text, item }); else setUnavailable("This screen could not be checked.");
      }).catch(error => { if (!controller.signal.aborted) setUnavailable(error instanceof Error ? error.message : String(error)); }).finally(() => { if (!controller.signal.aborted) setRefreshing(false); });
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [canvasId, itemId, text, filename, baseVersionId, canvas, refresh]);

  useEffect(() => {
    if (!draft?.accepted) return;
    const controller = new AbortController(); setCurrentRepair(null);
    void designRepairIO(actor).repairs(canvasId, controller.signal).then(history => {
      if (controller.signal.aborted) return;
      const saved = history.repairs.find(one => one.opId === draft.accepted!.opId);
      setCurrentRepair(saved ? { status: saved.status, reasons: saved.reasons } : { status: "unavailable", reasons: ["The accepted repair's current history is unavailable."] });
    }).catch(error => { if (!controller.signal.aborted) setCurrentRepair({ status: "unavailable", reasons: [error instanceof Error ? error.message : String(error)] }); });
    return () => controller.abort();
  }, [draft?.accepted, canvasId, actor, canvas, refresh]);

  const item = checked?.text === text ? checked.item : null;
  const audited = item?.status === "audited" ? item : null;
  const reason = unavailable ?? (item?.status === "unavailable" ? item.reason : null);
  async function repair(retry = false) {
    const saved = draftRef.current;
    if (!saved || repairing || saving || (!retry && (!dirty || saved.pending || saved.accepted || saved.editorBaseVersionId !== baseVersionId))) return;
    const controller = new AbortController(); repairRequest.current = controller; setRepairing(true); setReceipt(null);
    try {
      const prepared = retry && saved.pending ? saved.pending.prepared : await prepareDesignRepair({ basis: saved.basis, text, actorId: actor.id, opId: newOpId(), versionId: newVersionId(), repairId: `repair_${crypto.randomUUID()}` });
      const intent = { ...saved, pending: { prepared, refused: false }, accepted: null };
      keep(intent); // A failed durable write prevents any network send, including retry.
      const result = await saveDesignRepair(actor, prepared, retry, controller.signal);
      if (!live.current) return;
      if (result.status === "accepted") {
        // Acceptance is retained before editor callbacks or fresh source reads.
        keep({ ...intent, pending: null, accepted: result });
        callbacks.current.onSaved(prepared.text, result.versionId);
        setReceipt(`Repair saved as one operation. ${result.consistency?.status === "current" ? "The follow-up source read was current; rendered task checks remain separate." : `Currentness ${result.consistency?.status ?? "unavailable"}. ${result.consistency?.reasons.join(" ") ?? "Recheck its inputs."}`}`);
        setRefresh(n => n + 1);
      } else {
        keep({ ...intent, pending: { prepared, refused: result.status === "refused" } });
        setReceipt(`${result.status === "pending" ? "Repair awaiting confirmation. Retry keeps the original text and IDs." : "Repair refused. Review current inputs before preparing another intent."} ${result.reason ?? ""}`);
      }
    } catch (error) { if (live.current) setReceipt(`Repair was not confirmed: ${error instanceof Error ? error.message : String(error)}. Saved intent and editor text remain available.`); }
    finally { if (live.current) setRepairing(false); repairRequest.current = null; }
  }
  async function inspectCurrent() {
    if (uncertain || repairing) return;
    setRepairing(true);
    try { const snapshot = await getSnapshot(canvasId); setReviewed(await captureDesignAuditRepair(canvasId, itemId, snapshot)); }
    catch (error) { setReceipt(error instanceof Error ? error.message : String(error)); }
    finally { setRepairing(false); }
  }
  function useReviewed() {
    if (!reviewed || uncertain) return;
    try {
      archiveDesignRepairDraft(localStorage, key, draftRef.current);
      keep({ schemaVersion: 1, canvasId, actorId: actor.id, itemId, basis: reviewed, editorBaseVersionId: baseVersionId, pending: null, accepted: null });
      setRecoveryError(""); setReviewed(null); setReceipt("Current inputs explicitly reviewed. Your editor text is retained; the next repair uses this captured source.");
    } catch (error) { setReceipt(error instanceof Error ? error.message : String(error)); }
  }
  return <section className="design-lint" aria-label="Design findings" aria-busy={refreshing}>
    <div className="design-lint-heading"><strong>Design check</strong><span className="spacer" />
      <button type="button" className="stage-editor-btn" onClick={() => setRefresh(n => n + 1)} disabled={repairing}>Refresh</button>
      {dirty && !pending && !draft?.accepted && <button type="button" className="stage-editor-btn primary" onClick={() => void repair()} disabled={!draft || loadingDraft || repairing || saving || draft.editorBaseVersionId !== baseVersionId}>Save repair</button>}
      {pending && <button type="button" className="stage-editor-btn primary" onClick={() => void repair(true)} disabled={repairing || saving}>Retry original repair</button>}
    </div>
    {loadingDraft && <p role="status">Reading the original repair capture…</p>}
    {recoveryError && <p role="alert">{recoveryError} Saved storage remains untouched until explicit recovery.</p>}
    {receipt && <p className="design-lint-receipt" role="status">{receipt}</p>}
    {draft?.accepted && <p role="status">Repair acceptance is saved. {currentRepair ? `Current evidence: ${currentRepair.status}. ${currentRepair.reasons.join(" ")}` : "Checking the repair’s current inputs…"} Refreshing source does not rerun its task.</p>}
    {pending && <details><summary>Original saved repair</summary><p>{pending.refused ? "Refused" : "Awaiting confirmation"} · {pending.prepared.opId}</p><pre>{pending.prepared.text}</pre></details>}
    {!uncertain && !loadingDraft && <button type="button" className="stage-editor-btn" onClick={() => void inspectCurrent()} disabled={repairing}>Review current repair inputs</button>}
    {reviewed && <details open><summary>Current inputs to review</summary><p>Screen: {reviewed.repair.target.title} · {reviewed.repair.target.artifact.versionId}</p><p>{reviewed.repair.target.description}</p><pre>{JSON.stringify({ properties: reviewed.repair.target.properties, scope: reviewed.repair.target.scope, governing: reviewed.repair.governing }, null, 2)}</pre><p>Your current editor text will be retained against these inputs.</p><button type="button" className="stage-editor-btn" onClick={useReviewed}>I reviewed these inputs; retain my edits</button></details>}
    {refreshing && <p role="status">Checking editor text…</p>}
    {reason && <p className="design-lint-unavailable" role="status">Check unavailable: {reason}</p>}
    {audited && <>
      <p className="design-lint-summary" data-design-findings={audited.diagnostics.length}>
        {audited.diagnostics.length} finding{audited.diagnostics.length === 1 ? "" : "s"} · {audited.coverage.checkedValues} checked value{audited.coverage.checkedValues === 1 ? "" : "s"} · {audited.coverage.checkedValues === 0 ? "no token values checked" : audited.coverage.complete ? "declared token coverage complete" : "partial token coverage"}
      </p>
      <p className="design-lint-provenance">Editor text · <a href={workbenchItemPath(audited.governing.canvasId, audited.governing.itemId)}>{audited.governing.name}</a>{audited.governing.inherited ? " (inherited)" : ""}</p>
      <details className="design-lint-source"><summary>Checked source and rules</summary>
        <p>Draft based on {baseVersionId}. Design {audited.governing.itemId} / {audited.governing.versionId} · canvas {audited.governing.canvasId} · rules {audited.ruleVersion}.</p>
        {audited.input && <p>Checked HTML: {audited.input.sha256} ({audited.input.size} bytes).</p>}
      </details>
      <DesignContractSummary policy={audited.policy} onSelect={range => onSelect(range, checked!.text)} />
      <ul className="design-lint-findings">
        {audited.diagnostics.map((finding, index) => <li key={`${finding.code}:${finding.range.start.offset}:${index}`} data-design-code={finding.code}>
          <button type="button" className="design-lint-location" onClick={() => onSelect(finding.range, checked!.text)} title="Select this value in the checked source">
            Line {finding.range.start.line}:{finding.range.start.column} · <code>{finding.actual}</code>
          </button>
          <p>{finding.explanation}</p>
          {finding.candidates.length > 0 && <details><summary>Suggested references — choose by meaning</summary>
            <ul>{finding.candidates.map(candidate => <li key={candidate.token}><code>{candidate.value}</code> — {candidate.explanation}
              {candidate.prerequisites.map(prerequisite => <p className="design-lint-prerequisite" key={prerequisite}>{prerequisite}</p>)}
            </li>)}</ul>
          </details>}
        </li>)}
      </ul>
      {audited.coverage.omittedCategories.length > 0 && <p>Undeclared categories are not checked: {audited.coverage.omittedCategories.join(", ")}.</p>}
      {audited.coverage.unexamined.length > 0 && <details open className="design-lint-coverage"><summary>{audited.coverage.unexamined.length} unexamined region{audited.coverage.unexamined.length === 1 ? "" : "s"}</summary>
        <ul>{audited.coverage.unexamined.map((region, index) => <li key={`${region.code}:${index}`}><button type="button" className="design-lint-location" onClick={() => onSelect(region.range, checked!.text)}>Line {region.range.start.line}</button> {region.explanation}</li>)}</ul>
      </details>}
      <p className="design-lint-footnote">Static token checks do not judge visual intent. Review the rendered screen after repairing.</p>
    </>}
  </section>;
}
