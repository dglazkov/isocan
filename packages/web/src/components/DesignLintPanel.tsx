import { useEffect, useRef, useState } from "react";
import type { Actor, AuditRange } from "@isocan/core";
import { workbenchItemPath } from "@isocan/core";
import type { ItemDesignAudit } from "@isocan/api/design-audit";
import { getSnapshot } from "../lib/api.ts";
import { readDesignAudit, saveDesignRepair } from "../lib/design-audit.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { everyWhileVisible } from "../lib/whilevisible.ts";
import "./design-lint.css";

interface CheckedDraft { text: string; item: ItemDesignAudit }

/** Findings belong to exact editor bytes; changing a draft or its governing context invalidates them. */
export function DesignLintPanel({ canvasId, itemId, actor, text, baseVersionId, filename, dirty, saving, onSelect, onSaved, onBusyChange }: {
  canvasId: string;
  itemId: string;
  actor: Actor;
  text: string;
  baseVersionId: string;
  filename: string;
  dirty: boolean;
  saving: boolean;
  onSelect: (range: AuditRange, checkedText: string) => void;
  onSaved: (text: string, versionId: string) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const canvas = useCanvasStore(state => state.canvas);
  const [checked, setChecked] = useState<CheckedDraft | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [pending, setPending] = useState<{ text: string; versionId: string; blobHash: string } | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const live = useRef(true);
  const repairRequest = useRef<AbortController | null>(null);
  const callbacks = useRef({ onSaved, onBusyChange });
  callbacks.current = { onSaved, onBusyChange };
  useEffect(() => { live.current = true; return () => { live.current = false; repairRequest.current?.abort(); }; }, []);
  useEffect(() => {
    // Linked canvases have their own operation streams. Refresh while visible,
    // then the repair transaction reads them again immediately before commit.
    return everyWhileVisible(() => setRefresh(n => n + 1), 10_000);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setRefreshing(true);
    setChecked(null);
    setUnavailable(null);
    const timer = setTimeout(() => {
      void readDesignAudit(canvasId, { itemIds: [itemId], draft: { itemId, text, label: filename, baseVersionId }, signal: controller.signal }).then(report => {
        if (controller.signal.aborted) return;
        const item = report.items.find(one => one.itemId === itemId);
        if (item) setChecked({ text, item });
        else setUnavailable("This screen could not be checked.");
      }).catch(error => {
        if (!controller.signal.aborted) setUnavailable(error instanceof Error ? error.message : String(error));
      }).finally(() => { if (!controller.signal.aborted) setRefreshing(false); });
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [canvasId, itemId, text, filename, baseVersionId, canvas, refresh]);

  useEffect(() => {
    if (!pending) return;
    const controller = new AbortController();
    let reading = false;
    const stop = everyWhileVisible(() => {
      if (reading) return;
      reading = true;
      // Optimistic canvas state already includes queued writes. Only a fresh
      // home snapshot can establish acceptance when the original receipt was lost.
      void getSnapshot(canvasId, controller.signal).then(snapshot => {
        if (controller.signal.aborted) return;
        const current = snapshot.canvas.items[itemId];
        const version = current?.versions.find(one => one.id === pending.versionId && one.blobHash === pending.blobHash);
        if (!version) return; // absence is not an authoritative refusal
        callbacks.current.onSaved(pending.text, pending.versionId);
        callbacks.current.onBusyChange(false);
        setPending(null);
        setReceipt(`Queued repair confirmed as one version.${current?.currentVersionId !== pending.versionId ? " A newer version is already current." : ""} Findings are being refreshed.`);
        setRefresh(n => n + 1);
      }).catch(() => { /* Pending remains honest while the home cannot answer. */ }).finally(() => { reading = false; });
    }, 5_000);
    return () => { stop(); controller.abort(); };
  }, [canvasId, itemId, pending]);

  const item = checked?.text === text ? checked.item : null;
  const audited = item?.status === "audited" ? item : null;
  const reason = unavailable ?? (item?.status === "unavailable" ? item.reason : null);
  async function repair() {
    if (!audited || !checked || checked.text !== text || repairing || pending || saving || !dirty) return;
    const controller = new AbortController();
    repairRequest.current = controller;
    setRepairing(true);
    onBusyChange(true);
    let awaitingConfirmation = false;
    setReceipt(null);
    try {
      const result = await saveDesignRepair(canvasId, actor, {
        itemId, text, filename, expectedVersionId: baseVersionId,
        expectedGoverning: audited.governing, expectedRuleVersion: audited.ruleVersion, signal: controller.signal,
        onQueued: () => { if (live.current) setReceipt("Repair queued — awaiting home confirmation. Your draft is still here."); },
      });
      if (!live.current) return;
      if (result.status === "refused") {
        setReceipt(`Repair not saved: ${result.reason} Your draft is still here.`);
        return;
      }
      if (result.status === "pending") {
        awaitingConfirmation = true;
        setPending({ text, versionId: result.versionId, blobHash: result.blobHash });
        setReceipt(`Repair awaiting confirmation (${result.versionId}). ${result.reason} Your draft is still here; check the version history before retrying.`);
        return;
      }
      onSaved(text, result.versionId);
      const after = result.after;
      const remaining = after.status === "available" ? after.report.items.find(one => one.itemId === itemId) : null;
      const detail = after.status === "unavailable" ? `The saved screen could not be rechecked: ${after.reason}`
        : remaining?.status === "audited" ? `${remaining.diagnostics.length} findings remain; ${remaining.coverage.checkedValues === 0 ? "no token values checked" : remaining.coverage.complete ? "declared token coverage complete" : "some styling remains unexamined"}.`
        : "The saved screen's check is unavailable.";
      setReceipt(`Repair saved as one version. ${detail}${result.governingChanged ? " The governing design changed during save; review the refreshed findings." : ""}${result.superseded ? " A newer screen version has already arrived." : ""}`);
      setRefresh(n => n + 1);
    } catch (error) {
      if (live.current) setReceipt(`Repair was not confirmed: ${error instanceof Error ? error.message : String(error)} Your draft is still here.`);
    } finally {
      if (live.current) { setRepairing(false); if (!awaitingConfirmation) onBusyChange(false); }
      repairRequest.current = null;
    }
  }

  return <section className="design-lint" aria-label="Design findings" aria-busy={refreshing}>
    <div className="design-lint-heading">
      <strong>Design check</strong>
      <span className="spacer" />
      <button type="button" className="stage-editor-btn" onClick={() => setRefresh(n => n + 1)} disabled={repairing}>Refresh</button>
      {dirty && <button type="button" className="stage-editor-btn primary" onClick={() => void repair()} disabled={!audited || refreshing || repairing || !!pending || saving} title="Check this draft against fresh context, then save only if its starting version is still current">{repairing ? "Saving repair…" : "Save repair"}</button>}
    </div>
    {receipt && <p className="design-lint-receipt" role="status">{receipt}</p>}
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
