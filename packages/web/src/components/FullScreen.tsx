import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Actor } from "@isocan/core";
import { canvasPath, deckStep, itemPath, isFramedItem } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { ArtifactStage } from "./ArtifactStage.tsx";
import { KindIcon } from "./KindIcon.tsx";
import { CanvasPresence, CanvasTitle, ShareButton} from "./CanvasCrumb.tsx";
import { iconKindFor } from "../lib/kinds.ts";
import { findNextItem, type Direction } from "../lib/spatialnav.ts";
import { flipTo } from "../lib/deckflip.ts";
import { revealItem } from "../lib/zoomactions.ts";
import { isTyping } from "../lib/keys.ts";

const DIRECTIONS = new Set<string>(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

/** Bare keys that flip the deck (#87). Forward and back each answer to three
 * keys because a presenter's clicker sends Page Up/Down, and because "left/
 * right (and up/down)" is how the ask was written: the deck is LINEAR, in
 * reading order, so both axes flip rather than up/down meaning something
 * spatial that would strand a presenter at the end of a row. */
const FLIP_NEXT = new Set<string>(["ArrowRight", "ArrowDown", "PageDown"]);
const FLIP_PREV = new Set<string>(["ArrowLeft", "ArrowUp", "PageUp"]);

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
/** Still for this long and the chrome bows out. Long enough that reading a
 *  slide does not dismiss it by accident, short enough to be gone by the
 *  second slide of a talk. */
const REST_AFTER_MS = 2500;

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
        return;
      }
      // Bare arrows flip the deck (#87): the items marked as slides, in
      // reading order — or every item, with none marked, because a canvas of
      // screens is already a deck and marking narrows it rather than turning
      // it on. Linear where ⌘-arrows are spatial: a presenter at the end of a
      // row pressing → must land on the next row's first slide, not on the
      // edge. Which items and in what order is core's call (`deckStep`), so
      // the CLI's `isocan slides` and this walk cannot disagree about the
      // same deck.
      if (!e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey && (FLIP_NEXT.has(e.key) || FLIP_PREV.has(e.key))) {
        // Arrows in a text field move the caret — that field's business.
        if (isTyping(e.target)) return;
        e.preventDefault();
        e.stopPropagation(); // the canvas underneath would nudge its selection
        const canvas = useCanvasStore.getState().canvas;
        if (!canvas) return;
        const forward = FLIP_NEXT.has(e.key);
        const next = deckStep(canvas, itemId, forward ? 1 : -1);
        if (!next) return; // the deck's edge: stay put rather than wrap
        useUiStore.getState().select(next.id);
        revealItem(next.id);
        // The push, not a cut — the motion belongs to the deck flip alone;
        // ⌘-arrows above are a spatial walk and stay instant. Except for a
        // screen or a site: those are iframes, and an iframe photographs
        // blank, so animating one is a white flash. See `flipTo`.
        const here = canvas.items[itemId];
        flipTo(
          navigate,
          itemPath(canvasId, next.id),
          forward ? "next" : "prev",
          isFramedItem(next) || (here !== undefined && isFramedItem(here)),
        );
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  /**
   * **The chrome gets out of the way while you are presenting.**
   *
   * This view is used as a slideshow — ⌘← and ⌘→ walk the canvas — and a
   * permanent bar across the top of every slide is the one thing a slideshow
   * must not have. So it fades after a few still seconds and comes back the
   * moment the pointer moves.
   *
   * **A key press deliberately does NOT bring it back.** Flipping slides is
   * the act of presenting; if ⌘→ revealed the chrome, it would blink into
   * view on every slide, which is worse than leaving it up. Moving the mouse
   * is the honest signal that somebody wants a control.
   *
   * Focus brings it back regardless of the pointer: somebody arriving at
   * "← Canvas" by keyboard must be able to see where they are, and a focus
   * ring on an invisible button is the worst of both.
   */
  const [resting, setResting] = useState(false);
  useEffect(() => {
    let timer = window.setTimeout(() => setResting(true), REST_AFTER_MS);
    const wake = () => {
      setResting(false);
      clearTimeout(timer);
      timer = window.setTimeout(() => setResting(true), REST_AFTER_MS);
    };
    /**
     * **Typing into a FIELD wakes it; typing to flip a slide does not.**
     *
     * The rule above — a key press must not reveal the chrome — is about
     * presenting, where ⌘→ on every slide would blink the bar in and out. It
     * is wrong for the one person who is writing: `focusin` fires when they
     * click into the editor and then never again, so the chrome would fade
     * out over their own text while they typed under it. `isTyping` is the
     * same helper every other global handler asks before it acts.
     */
    const typingWake = (event: KeyboardEvent) => {
      if (isTyping(event.target)) wake();
    };
    window.addEventListener("pointermove", wake, { passive: true });
    window.addEventListener("focusin", wake);
    window.addEventListener("keydown", typingWake);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointermove", wake);
      window.removeEventListener("focusin", wake);
      window.removeEventListener("keydown", typingWake);
    };
  }, []);

  // The stage answers for the item — found, missing, or still loading — so
  // full screen and the workbench cannot drift apart about what an item looks
  // like (see ArtifactStage). The bar renders either way: the way back must
  // not depend on the item existing.
  return (
    <div className={`fullscreen${resting ? " resting" : ""}`}>
      <div className="fs-bar">
        {/* The way back, and it says where back IS. An arrow alone would be a
            guess; "Canvas" is the answer to "where am I". */}
        <div className="floats fs-cluster">
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
        </div>
        <span className="spacer" />
        <div className="floats fs-cluster">
        {/* No "Copy link" button: the address bar already holds the address of
            this exact view — that IS what the route bought — and a button that
            re-copies what the browser is already showing is chrome earning
            nothing. What belongs here instead is what this view had been
            throwing away: which canvas you are in, and who is in it. */}
        <ShareButton actor={actor} />
          <CanvasPresence actor={actor} onIdentity={onIdentity} />
        </div>
      </div>
      <div className="fullscreen-stage">
        <ArtifactStage canvasId={canvasId} itemId={itemId} actor={actor} surface="fullscreen" />
      </div>
    </div>
  );
}
