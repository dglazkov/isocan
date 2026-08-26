import { isDesignSystem } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { VersionContent } from "./ItemView.tsx";

/**
 * One artifact, rendered big and live — the stage both covers share.
 *
 * Full screen (`/i/:itemId`) and the workbench (`/w/:itemId`) are two frames
 * around the same question: show me this item, entered. The moment each frame
 * grew its own renderer they would start answering differently — a view
 * reachable at one of the product's own addresses and invisible at the other
 * is the two-products disease starting inside one app — so the rendering
 * lives here and the frames own only their chrome (workbench design doc,
 * "the stage").
 *
 * **Entered, always.** Inside a stage there is no drag to protect and no
 * double-click to teach — the frame asked for this item, so its links work,
 * its scroll is its own, and its scripts run.
 */
export function ArtifactStage({ canvasId, itemId }: { canvasId: string; itemId: string }) {
  const item = useCanvasStore((s) => s.canvas?.items[itemId] ?? null);
  const loaded = useCanvasStore((s) => s.canvas !== null);

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
  return (
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
}
