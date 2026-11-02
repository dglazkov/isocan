import { useEffect, useMemo, useState } from "react";
import type { Actor, DesignBrief } from "@isocan/core";
import { newVersionId } from "@isocan/core";
import { parseDesignBrief } from "@isocan/core/design-brief";
import {
  BRIEF_MODES,
  briefCard,
  briefChanges,
  briefEditPatch,
  briefReread,
  rereadAnswer,
  rereadAsk,
  rereadAsked,
  type BriefCardLine,
  type BriefEdit,
  type RereadScreen,
} from "@isocan/core/brief-card";
import type { DesignRequestView } from "@isocan/api/design-request";
import { readBlobText } from "../lib/api.ts";
import { useDesignMutation } from "../lib/design-request-draft.ts";
import { postToMain } from "../lib/mainthread.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import "./brief-card.css";

/**
 * **The brief, as a card** (proactive-agent phase 5, design §7) — the face a
 * design request's brief item wears on the canvas, above the task's own
 * controls: Making, For, Should feel, Never, Constraints, Right now (core
 * `briefCard`). A line the person said has a solid rule; one somebody
 * inferred has a pencil rule and **Right** / **Wrong** in place.
 *
 * Every edit is the brief's own update (`design brief --update`, through
 * `useDesignMutation`), so the brief stays the record and its history names
 * the person. **An edit changes nothing on the canvas; it only re-reads**:
 * under the lines, every screen is sorted into *assumed the old line*,
 * *matters more now* and *still holds* (core `briefReread`, derived on every
 * render), and the edit asks the canvas's lead, in the Chat, for its call and
 * ONE clarifying question — the ordinary summons, as Explain's Critique is.
 * With nobody to answer, the card says the re-read waits.
 *
 * Its controls follow the canvas's grammar for an item's content: drawn when
 * the person has stepped inside the item (double-click), which is when the
 * face is handed an actor; until then the card says how.
 *
 * Lives in `DesignRecordFace`'s lazy chunk: a canvas with no brief loads none of it.
 */
/**
 * Versions of a brief this tab's own edits made, each waiting to ask the lead
 * for its re-read once it arrives. Module-wide, not a ref: a new version of
 * the brief remounts the item's face (it is keyed by version), and the ask
 * must survive that.
 */
const toAsk = new Set<string>();

export function BriefCard({ canvasId, actor, row, canEdit, onChanged }: { canvasId: string; actor: Actor | null; row: DesignRequestView; canEdit: boolean; onChanged: () => void }) {
  const canvas = useCanvasStore((s) => s.canvas);
  const brief = row.brief;
  const card = useMemo(() => briefCard(brief, canvas ?? undefined), [brief, canvas]);
  const editable = canEdit && !!actor && row.allowedActions.includes("update");
  const [editing, setEditing] = useState<{ cite: string; act: "wrong" | "set"; text: string } | null>(null);
  const mutation = useDesignMutation(canvasId, actor, `brief-card:${brief.requestId}`, () => {
    setEditing(null);
    onChanged();
  });

  // The brief one version back: what this version's edit changed is read against it.
  const item = canvas?.items[row.ref.itemId];
  const at = item?.versions.findIndex((v) => v.id === row.ref.versionId) ?? -1;
  const prior = at > 0 ? item!.versions[at - 1] : undefined;
  const [before, setBefore] = useState<{ versionId: string; brief: DesignBrief } | null>(null);
  useEffect(() => {
    if (!prior?.designRecord) return;
    const controller = new AbortController();
    void readBlobText(canvasId, prior.blobHash, controller.signal)
      .then((text) => !controller.signal.aborted && setBefore({ versionId: row.ref.versionId, brief: parseDesignBrief(JSON.parse(text)) }))
      .catch(() => { /* No re-read rather than a wrong one. */ });
    return () => controller.abort();
  }, [canvasId, prior?.blobHash, prior?.designRecord, row.ref.versionId]);

  const where = { itemId: row.ref.itemId, versionId: row.ref.versionId };
  const changes = useMemo(() => (before?.versionId === row.ref.versionId ? briefChanges(before.brief, brief) : []), [before, brief, row.ref.versionId]);
  const answer = canvas && changes.length ? rereadAnswer(canvas, where) : null;
  const asked = canvas && changes.length ? rereadAsked(canvas, where) : false;
  const reread = useMemo(() => {
    if (!canvas || !changes.length) return null;
    const receipts = row.receipts.map((r) => ({ outputItemId: r.receipt.output.kind === "canvas" ? r.receipt.output.artifact.itemId : null, briefVersionId: r.receipt.brief.versionId }));
    return briefReread(canvas, brief, changes, { afterVersionId: row.ref.versionId, receipts, matters: answer?.matters ?? [] });
  }, [canvas, brief, changes, row.receipts, row.ref.versionId, answer]);

  // Who would answer the re-read: the night watch's own reading of the lead.
  const [lead, setLead] = useState<{ lead: Actor | null; cannot: string | null } | null>(null);
  const waiting = !!actor && !!reread && !answer && !asked;
  useEffect(() => {
    if (!waiting || !actor) return;
    let live = true;
    void import("../lib/goodnight.ts")
      .then((m) => m.goodnightLead(canvasId, actor.id))
      .then((found) => live && setLead({ lead: found.lead, cannot: found.cannot?.replace(" to work overnight", "") ?? null }))
      .catch(() => live && setLead({ lead: null, cannot: "the canvas's agents could not be read" }));
    return () => { live = false; };
  }, [canvasId, actor, waiting, row.ref.versionId]);

  // Our own edit made this version: ask the lead, once, if it can answer.
  useEffect(() => {
    if (!actor || !reread || asked || answer || !lead || !toAsk.has(row.ref.versionId)) return;
    toAsk.delete(row.ref.versionId);
    if (!lead.lead || lead.cannot) return;
    void postToMain(canvasId, actor, rereadAsk(lead.lead, where, reread), [row.ref.itemId]).catch(() => { /* The card still says the re-read waits. */ });
  });

  const edit = (line: BriefCardLine, change: BriefEdit) => {
    const patch = briefEditPatch(brief, line, change);
    if ("refused" in patch) return;
    // The version this edit will make is named by us, so the ask can follow it.
    const versionId = newVersionId();
    if (change.act !== "right") toAsk.add(versionId);
    void mutation.run({ type: "design.request", action: { kind: "update", brief: row.ref, epoch: brief.epoch, versionId, patch } });
  };

  const how = (l: BriefCardLine) => (l.origin === "sensed" ? "read from the canvas" : l.origin === "context" ? "from context" : "assumed");
  return <section className="brief-card" data-brief-card={brief.requestId} aria-label="The brief">
    <header><small>The brief</small><small>Asked to {card.intent}</small></header>
    <ul className="brief-lines">
      {card.lines.map((l) => <li key={l.key} className="brief-line" data-brief-line={l.cite} data-said={l.said ? "" : undefined} data-inferred={!l.said && l.value !== null ? "" : undefined}>
        <span className="brief-line-label">{l.label}</span>
        <span className="brief-line-value">{l.value ?? <em>not said yet</em>}{!l.said && l.value !== null && <small> · {how(l)}</small>}</span>
        {editable && !editing && <span className="brief-line-acts">
          {!l.said && l.value !== null
            ? <><button className="btn" data-brief-right disabled={mutation.busy} onClick={() => edit(l, { act: "right" })}>Right</button><button className="btn" data-brief-wrong disabled={mutation.busy} onClick={() => setEditing({ cite: l.cite, act: "wrong", text: "" })}>Wrong</button></>
            : <button className="btn" data-brief-edit disabled={mutation.busy} onClick={() => setEditing({ cite: l.cite, act: "set", text: l.value ?? "" })}>Edit</button>}
        </span>}
        {editing?.cite === l.cite && <form className="brief-line-editor" onSubmit={(e) => { e.preventDefault(); edit(l, { act: editing.act, value: editing.text }); }}>
          <label>{editing.act === "wrong" ? `What should “${l.label}” say?` : `“${l.label}”, in your words`}
            <input autoFocus onFocus={(e) => e.currentTarget.select()} value={editing.text} placeholder={l.key === "now" ? BRIEF_MODES.join(", ") : ""} onChange={(e) => setEditing({ ...editing, text: e.target.value })} />
          </label>
          {l.key === "now" && <span className="brief-line-modes">{BRIEF_MODES.filter((m) => m !== l.value).map((m) => <button type="button" className="btn" key={m} onClick={() => edit(l, { act: editing.act, value: m })}>{m}</button>)}</span>}
          <footer>
            <button type="button" className="btn" onClick={() => setEditing(null)}>Cancel</button>
            {editing.act === "wrong" && l.factId && <button type="button" className="btn" data-brief-remove onClick={() => edit(l, { act: "wrong" })}>Just remove it</button>}
            <button className="btn primary" data-brief-save disabled={!editing.text.trim() || mutation.busy}>Save</button>
          </footer>
        </form>}
      </li>)}
    </ul>
    {canEdit && !actor && card.lines.some((l) => !l.said && l.value !== null) && <p className="brief-quiet" data-brief-enter>Step inside the card (double-click) to say Right or Wrong.</p>}
    {card.quiet > 0 && <p className="brief-quiet">{card.quiet} more inferred {card.quiet === 1 ? "line waits" : "lines wait"}: the card shows four at a time.</p>}
    {mutation.error && <p role="alert">{mutation.error}</p>}
    {reread && <section className="brief-reread" data-brief-reread aria-label="The re-read">
      <h4>After {item?.versions[at]?.createdBy.name ?? "somebody"} changed {reread.changes.map((c) => `“${c.label}”`).join(", ")}</h4>
      <p className="brief-reread-note">Nothing on the canvas changed. Each screen, re-read:</p>
      <Pile kind="old" title="Assumed the old line" rows={reread.old} />
      <Pile kind="more" title="Matters more now" rows={reread.more} empty={answer ? "none" : "the lead's call"} />
      <Pile kind="holds" title="Still holds" rows={reread.holds} />
      {answer
        ? <p className="brief-reread-question" data-reread-question><b>{answer.by.name} asks:</b> {answer.question}</p>
        : asked
          ? <p className="brief-reread-wait" data-reread-asked>Asked the lead; its question has not come yet.</p>
          : lead?.cannot
            ? <p className="brief-reread-wait" data-reread-waits>The re-read waits: {lead.cannot}.</p>
            : null}
    </section>}
  </section>;
}

function Pile({ kind, title, rows, empty = "none" }: { kind: string; title: string; rows: RereadScreen[]; empty?: string }) {
  return <div className="brief-pile" data-reread={kind}>
    <b>{title}</b>
    {rows.length ? <ul>{rows.map((r) => <li key={r.itemId} data-reread-item={r.itemId}>{r.title}{r.because && <small> — {r.because}</small>}</li>)}</ul> : <span> {empty}</span>}
  </div>;
}
