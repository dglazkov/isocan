import { lazy, Suspense, useState } from "react";
import type { Actor } from "@isocan/core";
import { editableText, isDesignSystem } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { VersionContent } from "./ItemView.tsx";

/** The editor is its own chunk inside the cover's chunk: CodeMirror is the
 * heaviest thing the workbench owns, and Preview must not pay for it. */
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
 * **Modes, not panes.** Editable content (text, by mime — `editableText` in
 * core) gets Preview / Edit / Split across the stage's top; a png simply has
 * no Edit tab rather than an empty box. The mode is the viewer's eye — plain
 * local state, reset per item — and the strip renders in BOTH covers because
 * it is part of the stage, not of a frame.
 *
 * **Preview is entered, always.** Inside a stage there is no drag to protect
 * and no double-click to teach — the frame asked for this item, so its links
 * work, its scroll is its own, and its scripts run.
 */
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
  const [mode, setMode] = useState<"preview" | "edit" | "split">("preview");

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
  const showing = editable ? mode : "preview";

  return (
    <div className="artifact-stage">
      {editable && (
        <div className="stage-modes" role="tablist" aria-label="Stage mode">
          {(["preview", "edit", "split"] as const).map((one) => (
            <button
              key={one}
              role="tab"
              aria-selected={showing === one}
              className={`stage-mode${showing === one ? " on" : ""}`}
              onClick={() => setMode(one)}
            >
              {one === "preview" ? "Preview" : one === "edit" ? "Edit" : "Split"}
            </button>
          ))}
          <span className="stage-mode-hint">⌘S saves a version</span>
        </div>
      )}
      <div className="artifact-stage-body">
        {showing === "preview" ? (
          <VersionContent
            canvasId={canvasId}
            blobHash={current.blobHash}
            mimeType={current.mimeType}
            filename={current.filename}
            entered={true}
            designSystem={isDesignSystem(item)}
            reloadToken={0}
          />
        ) : (
          <Suspense fallback={<div className="page-note">Opening the editor…</div>}>
            <StageEditor
              key={item.id}
              canvasId={canvasId}
              item={item}
              actor={actor}
              split={showing === "split"}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}
