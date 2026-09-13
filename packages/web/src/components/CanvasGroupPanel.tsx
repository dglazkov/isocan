import { useEffect, useState } from "react";
import type { Actor, Item } from "@isocan/core";
import { groupAncestors, groupChildren, groupContentBox, groupDescendants, groupSelectionRoots, isGroupItem, itemPath } from "@isocan/core";
import { useNavigate } from "react-router-dom";
import { sendEchoed, useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { PendingGroupWriteError, changeCanvasGroup, createCanvasGroup, enterCanvasGroup, groupTask, removeFromCanvasGroup, selectGroupContents } from "../lib/canvasgroups.ts";
import { useCanEdit } from "../lib/capability.ts";
import { screenToWorld } from "../lib/viewport.ts";
import { Modal } from "./Modal.tsx";

/** One form supplies creation, membership picking and an inspectable member roster. */
export function CanvasGroupPanel({ canvasId, actor }: { canvasId: string; actor: Actor }) {
  const dialog = useUiStore((s) => s.groupDialog);
  if (!dialog) return null;
  return <GroupDialog key={`${dialog.kind}:${dialog.groupId ?? dialog.itemIds.join()}`} canvasId={canvasId} actor={actor} dialog={dialog} />;
}
function GroupDialog({ canvasId, actor, dialog }: { canvasId: string; actor: Actor; dialog: NonNullable<ReturnType<typeof useUiStore.getState>["groupDialog"]> }) {
  const canvas = useCanvasStore((s) => s.canvas);
  const canEdit = useCanEdit();
  const navigate = useNavigate();
  const group = dialog.groupId ? canvas?.items[dialog.groupId] : undefined;
  const [title, setTitle] = useState(group?.title ?? "Untitled group");
  const [brief, setBrief] = useState("");
  const [destination, setDestination] = useState(dialog.groupId ?? "");
  const [picked, setPicked] = useState<string[]>(dialog.itemIds);
  const [place, setPlace] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);
  const close = () => useUiStore.getState().setGroupDialog(null);
  const groups = Object.values(canvas?.items ?? {}).filter(isGroupItem);
  const targets = groups.filter((candidate) => !picked.some((id) => id === candidate.id || (canvas && groupAncestors(canvas, candidate.id).some((parent) => parent.id === id))));
  const missingSelection = dialog.itemIds.filter((id) => !canvas?.items[id]);
  const creationRoots = canvas && missingSelection.length === 0 ? groupSelectionRoots(canvas, dialog.itemIds) : [];
  const members = group && canvas ? groupChildren(canvas, group.id) : [];
  const descendants = group && canvas ? groupDescendants(canvas, group.id) : [];
  const content = group ? groupContentBox(group) : null;
  // A remotely dissolved frame stops being an editable inspector.
  useEffect(() => { if (dialog.kind === "inspect" && canvas && !group) close(); }, [canvas, group, dialog.kind]);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      if (dialog.kind === "create") {
        if (missingSelection.length) throw new Error(`${missingSelection.length} selected items are no longer on the canvas. Close this form and choose the selection again.`);
        const view = useUiStore.getState().viewport;
        const at = dialog.at ?? screenToWorld(view, window.innerWidth / 2, window.innerHeight / 2);
        await createCanvasGroup(canvasId, actor, title, brief, dialog.itemIds, at);
      } else if (dialog.kind === "add") {
        if (!destination || picked.length === 0) throw new Error("Choose a group and at least one item.");
        await changeCanvasGroup(canvasId, actor, { kind: "reparent", itemIds: picked, containerId: destination, place });
      } else if (group && title.trim() !== group.title) {
        await sendEchoed(canvasId, actor, { type: "item.update", itemId: group.id, patch: { title: title.trim() || group.title } });
      }
      close();
    } catch (err) { setError((err as Error).message); if (err instanceof PendingGroupWriteError) setPending(true); }
    finally { setBusy(false); }
  }
  return <Modal label="Canvas group" title={dialog.kind === "create" ? (dialog.itemIds.length ? "Group selection" : "New group") : dialog.kind === "add" ? "Add to group" : group?.title ?? "Group"} onClose={close}>
    <form className="canvas-group-form" onSubmit={submit}>
      {dialog.kind !== "add" && <label>Name<input aria-label="Group name" autoFocus value={title} readOnly={!canEdit} onChange={(e) => setTitle(e.target.value)} /></label>}
      {dialog.kind === "create" && <>
        <label>Brief<textarea aria-label="Group brief" value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="What belongs together?" /></label>
        {missingSelection.length > 0 && <p role="alert">{missingSelection.length} selected items are no longer on the canvas. Close this form and choose the selection again.</p>}
        <p>{dialog.itemIds.length ? `${creationRoots.length} selected roots keep their positions.` : "An empty frame in the current scope."}</p>
      </>}
      {dialog.kind === "add" && <>
        <label>Destination<select aria-label="Destination group" value={destination} onChange={(e) => setDestination(e.target.value)}><option value="">Choose a group</option>{targets.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.id}</option>)}</select></label>
        {targets.length === 0 && <p>No eligible destination group. Create another group first.</p>}
        {dialog.itemIds.length === 0 && <fieldset><legend>Items to add</legend>{Object.values(canvas?.items ?? {}).filter((item) => item.id !== destination && !(canvas?.items[destination] && groupAncestors(canvas, destination).some((parent) => parent.id === item.id))).map((item) => <label key={item.id}><input type="checkbox" checked={picked.includes(item.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, item.id] : picked.filter((id) => id !== item.id))} />{item.title}</label>)}</fieldset>}
        <label><input type="checkbox" checked={place} onChange={(e) => setPlace(e.target.checked)} />Arrange additions in clear space</label>
        <p>{picked.length} selected · positions are preserved unless arrangement is chosen.</p>
      </>}
      {dialog.kind === "inspect" && group && <>
        <p>{members.length} direct members · {descendants.length} total descendants</p>
        <p>Parent: {group.containerId ? <button type="button" onClick={() => { enterCanvasGroup(group.containerId!); close(); }}>{canvas?.items[group.containerId]?.title}</button> : "Canvas"}</p>
        <p>Content: {content?.width} × {content?.height} at {content?.x}, {content?.y}</p>
        <div className="canvas-group-controls">
          <button type="button" onClick={() => { selectGroupContents(group.id); close(); }}>Select contents</button>
          <button type="button" onClick={() => { navigate(itemPath(canvasId, group.id)); close(); }}>Open brief</button>
          {canEdit && <><button type="button" onClick={() => groupTask(() => changeCanvasGroup(canvasId, actor, { kind: "frame", itemId: group.id, fit: true }))}>Fit frame to contents</button><button type="button" onClick={() => groupTask(() => changeCanvasGroup(canvasId, actor, { kind: "layout", itemId: group.id, layout: group.groupLayout ?? {}, tidy: true }))}>Tidy contents</button><button type="button" onClick={() => useUiStore.getState().setGroupDialog({ kind: "add", groupId: group.id, itemIds: [] })}>Add items…</button></>}
        </div>
        <ul aria-label="Group members">{members.map((item: Item) => <li key={item.id}><button type="button" onClick={() => { enterCanvasGroup(group.id); useUiStore.getState().select(item.id); close(); }}>{item.title}{isGroupItem(item) ? " (group)" : ""}</button>{canEdit && <button type="button" aria-label={`Remove ${item.title} from group`} onClick={() => groupTask(() => removeFromCanvasGroup(canvasId, actor, [item.id]))}>Remove</button>}</li>)}</ul>
      </>}
      {error && <p role="alert">{error}</p>}
      {canEdit && <button className="btn primary" type="submit" disabled={busy || pending || missingSelection.length > 0}>{busy ? "Working…" : dialog.kind === "create" ? "Create group" : dialog.kind === "add" ? "Add to group" : "Save name"}</button>}
    </form>
  </Modal>;
}
