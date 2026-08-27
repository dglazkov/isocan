import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { Actor } from "@isocan/core";
import { canvasPath, itemPath } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { ArtifactStage } from "./ArtifactStage.tsx";
import { KindIcon } from "./KindIcon.tsx";
import { CanvasPresence, CanvasTitle } from "./CanvasCrumb.tsx";
import { iconKindFor } from "../lib/kinds.ts";
import { findNextItem, type Direction } from "../lib/spatialnav.ts";
import { revealItem } from "../lib/zoomactions.ts";
import { isTyping } from "../lib/keys.ts";

const DIRECTIONS = new Set<string>(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

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
export function FullScreen({
  canvasId,
  itemId,
  actor,
  onIdentity,
}: {
  canvasId: string;
  itemId: string;
  actor: Actor;
  onIdentity: (actor: Actor | null) => void;
}) {
  const navigate = useNavigate();
  const item = useCanvasStore((s) => s.canvas?.items[itemId] ?? null);

  const back = () => navigate(canvasPath(canvasId));

  // Esc is the way out, and it is bound HERE rather than in the page's key
  // handler on purpose: full screen is the outermost layer, so it must answer
  // Esc before anything the canvas would have done with it. Capture, because
  // the item's own content may be focused and may stop the event on its way
  // up — a page in a frame is somebody else's code and it does not know about
  // our way home.
  //
  // ⌘-arrows are the cover's too: the same walk the canvas answers with ⌘←→↑↓
  // — findNextItem, one home — but the destination stays full screen, so a row
  // of screens becomes a slideshow you steer. Each press is a NAVIGATION like
  // the Enter that got you here: the address bar holds the screen you are on,
  // and Back retraces your steps. The selection and the camera underneath
  // follow along, so Esc drops you at the screen you ended on, not the one you
  // started from.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        back();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && DIRECTIONS.has(e.key)) {
        // ⌘← in a text field is "start of line" — that field's business.
        if (isTyping(e.target)) return;
        e.preventDefault();
        e.stopPropagation(); // the canvas page would only have to drop it anyway
        const canvas = useCanvasStore.getState().canvas;
        const current = canvas?.items[itemId];
        if (!canvas || !current) return;
        const next = findNextItem(current, Object.values(canvas.items), e.key as Direction);
        if (!next) return; // the edge of the canvas: stay put rather than wrap
        useUiStore.getState().select(next.id);
        revealItem(next.id);
        navigate(itemPath(canvasId, next.id));
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  // The stage answers for the item — found, missing, or still loading — so
  // full screen and the workbench cannot drift apart about what an item looks
  // like (see ArtifactStage). The bar renders either way: the way back must
  // not depend on the item existing.
  return (
    <div className="fullscreen">
      <div className="fullscreen-bar">
        {/* The way back, and it says where back IS. An arrow alone would be a
            guess; "Canvas" is the answer to "where am I". */}
        <button className="fullscreen-back" onClick={back} title="Back to the canvas (Esc)">
          ← Canvas
        </button>
        <CanvasTitle actor={actor} />
        {item && (
          <span className="fullscreen-title">
            <KindIcon className="kind-icon" kind={iconKindFor(item)} />
            <b>{item.title}</b>
            <i>{item.versions.find((v) => v.id === item.currentVersionId)?.filename}</i>
          </span>
        )}
        <span className="spacer" />
        {/* No "Copy link" button: the address bar already holds the address of
            this exact view — that IS what the route bought — and a button that
            re-copies what the browser is already showing is chrome earning
            nothing. What belongs here instead is what this view had been
            throwing away: which canvas you are in, and who is in it. */}
        <CanvasPresence actor={actor} onIdentity={onIdentity} />
      </div>
      <div className="fullscreen-stage">
        <ArtifactStage canvasId={canvasId} itemId={itemId} actor={actor} surface="fullscreen" />
      </div>
    </div>
  );
}
