import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { canvasPath, isDesignSystem, itemUrl } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { VersionContent } from "./ItemView.tsx";
import { KindIcon } from "./KindIcon.tsx";
import { iconKindFor } from "../lib/kinds.ts";

/**
 * One item, filling the screen, live.
 *
 * **Why this is a route and not a mode.** What you are looking at is not a
 * mutation: your zoom is not my zoom, and an op for it would drag every open
 * tab to the same screen because one person pressed Enter. But local state
 * alone would make it unreachable by anyone else, and this is a canvas people
 * and agents share. A route is the third thing — private to your tab, and an
 * ADDRESS: Back leaves it for free, the bar holds what you are looking at, and
 * `isocan open <item>` can hand somebody the exact view it means.
 *
 * **The canvas stays mounted underneath.** This renders inside `CanvasPage`
 * rather than as a sibling route, so the socket, the presence session and the
 * viewport all survive: coming back is not a reload, and it lands you exactly
 * where you left, at the zoom you left. A separate route element would have
 * torn all of that down and rebuilt it, and "back to the canvas" would have
 * meant "back to the top of the canvas".
 *
 * **The content is entered, always.** Inside here there is no drag to protect
 * and no double-click to teach — the whole screen is the item, so its links
 * work, its scroll is its own, and its scripts run. That is the point of
 * asking for it.
 */
export function FullScreen({ projectId, itemId }: { projectId: string; itemId: string }) {
  const navigate = useNavigate();
  const item = useCanvasStore((s) => s.canvas?.items[itemId] ?? null);
  const loaded = useCanvasStore((s) => s.canvas !== null);

  const back = () => navigate(canvasPath(projectId));

  // Esc is the way out, and it is bound HERE rather than in the page's key
  // handler on purpose: full screen is the outermost layer, so it must answer
  // Esc before anything the canvas would have done with it. Capture, because
  // the item's own content may be focused and may stop the event on its way
  // up — a page in a frame is somebody else's code and it does not know about
  // our way home.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      back();
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  // An address for an item this canvas does not have. Somebody's link is old,
  // or the item was deleted while they were looking at it — say which, and
  // give them the door rather than a blank screen. (Phase 7's finding: this
  // system's default answer to a wrong address is a cheerful one.)
  if (!item) {
    return (
      <div className="fullscreen">
        <div className="fullscreen-bar">
          <button className="fullscreen-back" onClick={back}>
            ← Canvas
          </button>
        </div>
        <div className="page-note">
          {loaded
            ? "That item is not on this canvas any more — it may have been deleted."
            : "Finding that item…"}
        </div>
      </div>
    );
  }

  const current =
    item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions[0]!;

  return (
    <div className="fullscreen">
      <div className="fullscreen-bar">
        {/* The way back, and it says where back IS. An arrow alone would be a
            guess; "Canvas" is the answer to "where am I". */}
        <button className="fullscreen-back" onClick={back} title="Back to the canvas (Esc)">
          ← Canvas
        </button>
        <span className="fullscreen-title">
          <KindIcon className="kind-icon" kind={iconKindFor(item)} />
          <b>{item.title}</b>
          <i>{current.filename}</i>
        </span>
        {/* The address of this exact view. Copying it is the feature the route
            bought: a link to one screen, not to a canvas with a note about
            which screen to look at. */}
        <button
          className="fullscreen-copy"
          title="Copy a link to this screen"
          onClick={() => {
            void navigator.clipboard?.writeText(itemUrl(location.origin, projectId, item.id));
          }}
        >
          Copy link
        </button>
      </div>
      <div className="fullscreen-stage">
        <VersionContent
          projectId={projectId}
          blobHash={current.blobHash}
          mimeType={current.mimeType}
          filename={current.filename}
          entered={true}
          designSystem={isDesignSystem(item)}
          reloadToken={0}
        />
      </div>
    </div>
  );
}
