import { atLeast } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";

/**
 * **The read-only canvas** (roles design, "The read-only canvas"; phase 1).
 *
 * A `read` admission gets the editor with its writes hidden. Hidden, not
 * refused: the refusal is the daemon's (`view-only`, at the op chokepoint and
 * the canvas-scoped hook), and a reader who reaches a write anyway — a
 * shortcut this list missed — is refused there and sees the same sentence
 * they would have seen anyway. What the app owes is courtesy: not offering
 * gestures that will each come back refused, and not letting an item move
 * under a hand that cannot move it.
 *
 * One question, asked in one place: is what this tab holds at least `edit`.
 * `own` counts as editing; `read` and `view` do not. Every surface below asks
 * it through these two functions rather than comparing the rung itself, so
 * the ladder is compared in core and nowhere else.
 */
export function useCanEdit(): boolean {
  return useCanvasStore((s) => atLeast(s.capability, "edit"));
}

/** The same answer outside a render — event handlers, menus built as data. */
export function canEditNow(): boolean {
  return atLeast(useCanvasStore.getState().capability, "edit");
}

/**
 * **"Writes hidden" is a list, made once and checked by a test that walks
 * it** (the design's sentence). Each entry names a write a reader must not be
 * offered, the file that hides it, and the exact expression in that file
 * that does the hiding — so `readonly.test.ts` can read the source and prove
 * the gate is still there, entry by entry, rather than proving the list was
 * written down.
 *
 * What stays, and is deliberately NOT on this list: selection, pan, zoom, the
 * minimap, the context panel, the files panel, versions, history, following a
 * person, and the Share dialog's address. A reader is a reader of the whole
 * canvas.
 */
export const HIDDEN_WRITES: readonly { what: string; file: string; gate: string }[] = [
  {
    what: "the tool rail — the create actions: pen, text, comment, upload, site",
    file: "pages/CanvasPage.tsx",
    gate: "{canEdit && <CanvasTools",
  },
  {
    what: "renaming the canvas from its title",
    file: "components/CanvasCrumb.tsx",
    gate: "disabled={!canvas || !canEdit}",
  },
  {
    what: "dragging an item",
    file: "components/ItemView.tsx",
    gate: "if (!canEdit) {\n      // A reader selects; nothing moves under their hand.",
  },
  {
    what: "resizing an item — the corner handles",
    file: "components/ItemView.tsx",
    gate: "{soleSelection && !entered && canEdit && (",
  },
  {
    what: "renaming an item — the second press on its label, and F2",
    file: "components/ItemView.tsx",
    gate: "if (canEdit && target.closest(\".item-titlebar\"))",
  },
  {
    what: "the text composer — the text tool, and double-clicking a text node",
    file: "components/CanvasViewport.tsx",
    gate: "{canEdit && <TextComposer",
  },
  {
    what: "the stage composer — the editor pane, and editing a text node",
    file: "components/ArtifactStage.tsx",
    gate: "const editable = editableText(current.mimeType) && canEdit;",
  },
  {
    what: "the comment composer — a new thread",
    file: "components/CommentLayer.tsx",
    gate: "{pendingComment && canEdit && (",
  },
  {
    what: "the comment composer — a reply",
    file: "components/CommentLayer.tsx",
    gate: "{canEdit && (\n        <form",
  },
  {
    what: "reactions — adding one, and toggling one already worn",
    file: "components/Reactions.tsx",
    gate: "if (!canEdit) return; // a mark is an op, and the daemon would refuse it",
  },
  {
    what: "the trash — the panel, and its entry in the drawer",
    file: "pages/CanvasPage.tsx",
    gate: "{canEdit && <TrashPanel",
  },
  {
    what: "the context menu's mutating entries — cut, duplicate, rename, pin, slide, delete, paste, write text",
    file: "lib/menuentries.tsx",
    gate: "function offered(entries: MenuEntry[]): MenuEntry[]",
  },
  {
    what: "the command palette's mutating commands — the tools, format, tidy, and the slash commands that post",
    file: "lib/actions.ts",
    gate: "if (!canEditNow() && action.writes) return false;",
  },
  {
    what: "the Share dialog's controls other than the address — the link, its rung, inviting, un-inviting",
    file: "components/ShareDialog.tsx",
    gate: "{canEdit && (\n        <>\n          {/* The link grant",
  },
  {
    what: "undo and redo — the two buttons in the zoom bar",
    file: "components/ZoomControls.tsx",
    // The inner `!undoHidden` is chrome you can turn off — a person's own
    // hiding, inside the reader's gate, never instead of it.
    gate: "{canEdit && (\n        <>\n          {!undoHidden && (\n            <button\n              className=\"btn icon\"\n              title=\"Undo (⌘Z)\"",
  },
  {
    what: "the keyboard's writes — delete, paste, undo, nudge, the tool letters, ⇧C, ⇧F, F2",
    file: "pages/CanvasPage.tsx",
    gate: "if (!canEditNow() && writesByKey(e)) return;",
  },
  {
    what: "dropping files or a link onto the canvas",
    file: "components/CanvasViewport.tsx",
    gate: "if (!canEditNow()) return; // a reader has nowhere to put a file",
  },
];
