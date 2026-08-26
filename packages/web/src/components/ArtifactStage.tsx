import { lazy, Suspense, useState } from "react";
import type { Actor } from "@isocan/core";
import { editableText, isDesignSystem } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { VersionContent } from "./ItemView.tsx";

/** The editor is its own chunk inside the cover's chunk: CodeMirror is the
 * heaviest thing the workbench owns, and a collapsed editor must not pay
 * for it. */
const StageEditor = lazy(() =>
  import("./StageEditor.tsx").then((m) => ({ default: m.StageEditor })),
);

/**
 * One artifact, rendered big and live — the stage both covers share.
 *
 * Full screen (`/i/:itemId`) and the workbench (`/w/:itemId`) are two frames
 * around the same question: show me this item. The moment each frame grew
 * its own renderer they would start answering differently — a view reachable
 * at one of the product's own addresses and invisible at the other is the
 * two-products disease starting inside one app — so the rendering lives here
 * and the frames own only their chrome (workbench design doc, "the stage").
 *
 * **Two PANES, not three modes.** An editable artifact opens with preview
 * AND editor side by side, and each pane collapses from its own toggle —
 * which stays where it is, pressed or not, so the way back is the control
 * that took it away. It shipped as Preview/Edit/Split tabs first and the
 * tabs lasted a day: three names for the states of two switches, and the
 * default (Preview) hid the editor the whole feature exists for.
 *
 * The last open pane's toggle disables rather than emptying the stage —
 * a stage showing nothing is not a state, so it is unreachable.
 *
 * What the preview pane SHOWS depends on the editor: with the editor open
 * on an HTML artifact it is the live DRAFT (srcdoc, rendered as you type —
 * StageEditor owns it, since the draft is its buffer); with the editor
 * collapsed, or for content with no draft renderer, it is the saved current
 * version. Honest either way: the bar inside the editor names what is a
 * draft and what has landed.
 *
 * The choice is remembered once per browser (`isocan.stage.panes`), not per
 * item — folding the preview is a statement about how you work, not about
 * one file — on the minimap's ethic: someone who put it away wants it away
 * tomorrow too.
 *
 * **Preview is entered, always.** Inside a stage there is no drag to protect
 * and no double-click to teach.
 */

type Panes = { preview: boolean; edit: boolean };

const PANES_KEY = "isocan.stage.panes";

function readPanes(): Panes {
  try {
    const raw = localStorage.getItem(PANES_KEY);
    if (raw === "preview") return { preview: true, edit: false };
    if (raw === "edit") return { preview: false, edit: true };
  } catch {
    // Storage denied: the default stands.
  }
  return { preview: true, edit: true };
}

function writePanes(panes: Panes): void {
  try {
    localStorage.setItem(
      PANES_KEY,
      panes.preview && panes.edit ? "both" : panes.preview ? "preview" : "edit",
    );
  } catch {
    // The choice holds for this session and no longer.
  }
}

export function ArtifactStage({
  canvasId,
  itemId,
  actor,
}: {
  canvasId: string;
  itemId: string;
  actor: Actor;
}) {
  const item = useCanvasStore((s) => s.canvas?.items[itemId] ?? null);
  const loaded = useCanvasStore((s) => s.canvas !== null);
  const [panes, setPanes] = useState<Panes>(readPanes);

  // An address for an item this canvas does not have: somebody's link is old,
  // or the item was deleted while they were looking at it. Say which, rather
  // than a blank stage (the cheerful-wrong-address rule).
  if (!item) {
    return (
      <div className="page-note">
        {loaded
          ? "That item is not on this canvas any more — it may have been deleted."
          : "Finding that item…"}
      </div>
    );
  }

  const current = item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions[0]!;
  const editable = editableText(current.mimeType);

  const toggle = (which: keyof Panes) => {
    const next = { ...panes, [which]: !panes[which] };
    if (!next.preview && !next.edit) return; // the stage never shows nothing
    setPanes(next);
    writePanes(next);
  };

  const saved = (
    <VersionContent
      canvasId={canvasId}
      blobHash={current.blobHash}
      mimeType={current.mimeType}
      filename={current.filename}
      entered={true}
      designSystem={isDesignSystem(item)}
      reloadToken={0}
    />
  );

  // Not editable: one pane, no switches — a png has no editor to fold away.
  if (!editable) return <div className="artifact-stage">{saved}</div>;

  const showPreview = panes.preview;
  const showEdit = panes.edit;
  // StageEditor draft-previews HTML itself (the draft is its buffer); for
  // everything else the preview pane is the saved version beside the buffer.
  const editorOwnsPreview = showEdit && showPreview && current.mimeType === "text/html";

  return (
    <div className="artifact-stage">
      <div className="stage-panes" role="group" aria-label="Stage panes">
        <button
          className={`stage-pane${showPreview ? " on" : ""}`}
          aria-pressed={showPreview}
          disabled={showPreview && !showEdit}
          title={
            showPreview
              ? showEdit
                ? "Fold the preview away — this button brings it back"
                : "The only open pane holds the stage"
              : "Reopen the preview"
          }
          onClick={() => toggle("preview")}
        >
          Preview
        </button>
        <button
          className={`stage-pane${showEdit ? " on" : ""}`}
          aria-pressed={showEdit}
          disabled={showEdit && !showPreview}
          title={
            showEdit
              ? showPreview
                ? "Fold the editor away — this button brings it back"
                : "The only open pane holds the stage"
              : "Reopen the editor"
          }
          onClick={() => toggle("edit")}
        >
          Edit
        </button>
        <span className="stage-mode-hint">⌘S saves a version</span>
      </div>
      <div className="artifact-stage-body">
        {editorOwnsPreview ? (
          <Suspense fallback={<div className="page-note">Opening the editor…</div>}>
            <StageEditor key={item.id} canvasId={canvasId} item={item} actor={actor} split={true} />
          </Suspense>
        ) : (
          <>
            {showEdit && (
              <Suspense fallback={<div className="page-note">Opening the editor…</div>}>
                <StageEditor
                  key={item.id}
                  canvasId={canvasId}
                  item={item}
                  actor={actor}
                  split={false}
                />
              </Suspense>
            )}
            {showPreview && <div className="stage-saved-pane">{saved}</div>}
          </>
        )}
      </div>
    </div>
  );
}
