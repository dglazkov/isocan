import { lazy, Suspense, useState } from "react";
import type { Actor } from "@isocan/core";
import { editableText, isDesignSystem } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { VersionContent } from "./ItemView.tsx";

/** The editor is its own chunk inside the cover's chunk: CodeMirror is the
 * heaviest thing the workbench owns, and a folded editor must not pay for
 * it. */
const StageEditor = lazy(() =>
  import("./StageEditor.tsx").then((m) => ({ default: m.StageEditor })),
);

/**
 * One artifact, rendered big and live — the stage both covers share.
 *
 * Full screen (`/i/:itemId`) and the workbench (`/w/:itemId`) are two frames
 * around the same question: show me this item. The rendering lives here so
 * the two addresses can never answer differently (workbench design doc,
 * "the stage").
 *
 * **Two panes, one header each, no third bar.** This grew chrome twice and
 * shed it twice: Preview/Edit/Split tabs became two toggles, and the toggle
 * ROW itself lasted a day — a strip of buttons above two panes that each
 * already had a header was three layers of chrome before any content. Now
 * each pane's own header carries its controls AND its fold, and a folded
 * pane leaves a slim rail on its edge whose whole face reopens it — the way
 * back stands exactly where the way out was.
 *
 * The stage never shows nothing: the sole open pane simply has no fold
 * control, so the empty state is unreachable rather than refused.
 *
 * What the preview shows follows the editor: the live DRAFT (rendered as
 * you type, for HTML) while the buffer is open, the saved current version
 * otherwise — and its header says which, because a preview that might be
 * either is a preview you cannot trust.
 *
 * The fold choice is remembered once per browser (`isocan.stage.panes`),
 * not per item — folding the preview is a statement about how you work, on
 * the minimap's ethic — and a fresh browser starts with both.
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
  // The open buffer, lifted from the editor so the preview pane can render
  // it. Null while the editor is folded or the type has no draft renderer.
  const [draft, setDraft] = useState<string | null>(null);

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

  const fold = (which: keyof Panes) => {
    const next = { ...panes, [which]: !panes[which] };
    if (!next.preview && !next.edit) return; // unreachable: the sole pane has no fold control
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

  // Not editable: one pane, no headers, no folds — a png has no editor to
  // put away, so it gets the whole stage without ceremony.
  if (!editable) return <div className="artifact-stage">{saved}</div>;

  const showDraft = panes.edit && draft !== null && current.mimeType === "text/html";

  return (
    <div className="artifact-stage">
      <div className="artifact-stage-body">
        {panes.edit ? (
          <Suspense fallback={<div className="page-note">Opening the editor…</div>}>
            <StageEditor
              key={item.id}
              canvasId={canvasId}
              item={item}
              actor={actor}
              onDraft={setDraft}
              onFold={panes.preview ? () => fold("edit") : undefined}
            />
          </Suspense>
        ) : (
          /* The folded editor's rail: its whole face is the way back, on the
             edge the pane folded to. */
          <button className="stage-rail left" onClick={() => fold("edit")} title="Open the editor">
            <span>Edit</span>
          </button>
        )}
        {panes.preview ? (
          <div className="stage-preview-pane">
            <div className="stage-pane-bar">
              <span className="stage-pane-name">
                {showDraft ? "Draft" : "Saved"}
                <i>
                  {showDraft
                    ? " — renders as you type; ⌘S makes it a version"
                    : ` — v${item.versions.length}`}
                </i>
              </span>
              <span className="spacer" />
              {panes.edit && (
                <button
                  className="stage-pane-fold"
                  onClick={() => fold("preview")}
                  title="Fold the preview away — the rail brings it back"
                  aria-label="Collapse the preview"
                >
                  »
                </button>
              )}
            </div>
            <div className="stage-pane-body">
              {showDraft ? (
                /* The DRAFT, live: srcdoc under the same lone allow-scripts
                   every item frame gets — an opaque origin, no cookie, no
                   API. Local by construction; nothing leaves the tab until
                   Save. */
                <iframe
                  className="html-view"
                  sandbox="allow-scripts"
                  srcDoc={draft ?? ""}
                  title={`draft of ${current.filename}`}
                />
              ) : (
                saved
              )}
            </div>
          </div>
        ) : (
          <button
            className="stage-rail right"
            onClick={() => fold("preview")}
            title="Open the preview"
          >
            <span>Preview</span>
          </button>
        )}
      </div>
    </div>
  );
}
