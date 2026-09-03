import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { deck, deckStep, isDesignSystem, isTextItem, itemPath, isFramedItem } from "@isocan/core";
import { connectToCanvas, disconnect, useCanvasStore } from "../stores/canvasStore.ts";
import { VersionContent } from "./ItemView.tsx";
import { KindIcon } from "./KindIcon.tsx";
import { iconKindFor } from "../lib/kinds.ts";
import { isTyping } from "../lib/keys.ts";
import { flipTo } from "../lib/deckflip.ts";

/** The deck keys, exactly `FullScreen`'s (#87): a presenter's clicker sends
 * Page Up/Down, and both axes flip because the deck is linear. */
const FLIP_NEXT = new Set<string>(["ArrowRight", "ArrowDown", "PageDown"]);
const FLIP_PREV = new Set<string>(["ArrowLeft", "ArrowUp", "PageUp"]);

/** FullScreen's resting rhythm, kept in step with it: long enough that
 * reading a slide does not dismiss the chrome by accident, short enough to be
 * gone by the second slide of a talk. */
const REST_AFTER_MS = 2500;

/**
 * **The viewer face** (#88): what a view-only admission gets instead of the
 * canvas.
 *
 * A view admission is the presentation gesture — mark the slides (#87), flip
 * the link to "can view", hand out the address — so what it renders is the
 * DECK: the current item filling the screen, arrows to flip, and nothing
 * else. Deliberately not the canvas page with the controls filed off:
 * `identity-desk.md`'s rule about habits versus rules cuts both ways, and a
 * surface built from editing chrome hidden one flag at a time is a surface
 * where the next panel added forgets the flag. This face OFFERS nothing that
 * writes, and the home refuses anything that would anyway.
 *
 * There is no way out to the canvas, per the issue's own design: a viewer
 * shown "← Canvas" would be shown a door that opens onto the same look-only
 * room wearing editing chrome. The canvas address itself lands back here
 * (`CanvasSurface` hands view admissions to this component), so the deck is
 * simply what this canvas IS for a viewer.
 *
 * Identity is not asked for. A viewer casts no cursor, holds no seat in the
 * roster and stamps nothing — the home drops a view socket's presence beats —
 * so a name would be collected for no purpose it could serve. That is the
 * issue's "let people in without asking for a name", arriving as a
 * consequence of having nothing to attach a name to.
 */
export function Viewer({ canvasId, itemId }: { canvasId: string; itemId: string | null }) {
  const navigate = useNavigate();
  const canvas = useCanvasStore((s) => s.canvas);
  const title = useCanvasStore((s) => s.project?.title ?? null);
  const connection = useCanvasStore((s) => s.connection);

  // The stranger path connects here (no actor — nobody to announce); the
  // CanvasPage path arrives already connected, and reconnecting would drop a
  // live socket to redial it as the same badge.
  useEffect(() => {
    if (useCanvasStore.getState().canvasId === canvasId) return;
    connectToCanvas(canvasId, null);
    return disconnect;
  }, [canvasId]);

  // A canvas address is the deck's first slide, for a viewer: there is no
  // canvas view to land on, so the address everyone shares lands on the
  // presentation it names. `replace`, so Back leaves rather than bouncing.
  useEffect(() => {
    if (!canvas || itemId) return;
    const first = deck(canvas)[0];
    if (first) navigate(itemPath(canvasId, first.id), { replace: true });
  }, [canvas, itemId, canvasId, navigate]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if (!FLIP_NEXT.has(e.key) && !FLIP_PREV.has(e.key)) return;
      if (isTyping(e.target)) return;
      e.preventDefault();
      const now = useCanvasStore.getState().canvas;
      if (!now || !itemId) return;
      const forward = FLIP_NEXT.has(e.key);
      const next = deckStep(now, itemId, forward ? 1 : -1);
      if (!next) return; // the deck's edge: stay put rather than wrap
      // A screen or a site is an iframe, and an iframe photographs blank, so
      // animating one is a white flash on every flip. See `flipTo`.
      const here = now.items[itemId];
      flipTo(
        navigate,
        itemPath(canvasId, next.id),
        forward ? "next" : "prev",
        isFramedItem(next) || (here !== undefined && isFramedItem(here)),
      );
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  // FullScreen's resting chrome, same rhythm and same honesty: pointer
  // movement is the signal somebody wants the bar; a key press is the act of
  // presenting and must not blink it back.
  const [resting, setResting] = useState(false);
  useEffect(() => {
    let timer = window.setTimeout(() => setResting(true), REST_AFTER_MS);
    const wake = () => {
      setResting(false);
      clearTimeout(timer);
      timer = window.setTimeout(() => setResting(true), REST_AFTER_MS);
    };
    window.addEventListener("pointermove", wake, { passive: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointermove", wake);
    };
  }, []);

  if (
    connection === "refused" ||
    connection === "withdrawn" ||
    connection === "gone" ||
    connection === "absent"
  ) {
    return (
      <div className="page-note">
        {connection === "gone"
          ? "This canvas was deleted."
          : connection === "withdrawn"
            ? "Your access to this canvas was withdrawn."
            : "This canvas will not have you."}
      </div>
    );
  }
  const item = canvas?.items[itemId ?? ""] ?? null;
  const current = item
    ? (item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions[0])
    : null;
  const slides = canvas ? deck(canvas) : [];
  const at = item ? slides.findIndex((s) => s.id === item.id) : -1;

  return (
    <div className={`fullscreen${resting ? " resting" : ""}`}>
      <div className="fs-bar">
        <div className="floats fs-cluster">
          {title && <span className="fullscreen-title"><b>{title}</b></span>}
          {item && (
            <span className="fullscreen-title">
              <KindIcon className="kind-icon" kind={iconKindFor(item)} />
              {item.title}
            </span>
          )}
        </div>
        <span className="spacer" />
        {/* Where you are in the deck — the one navigation fact a viewer has
            no other way to read, since the canvas that would show the other
            slides is not offered. */}
        {at >= 0 && slides.length > 1 && (
          <div className="floats fs-cluster">
            <span className="fullscreen-title">
              {at + 1} / {slides.length}
            </span>
          </div>
        )}
      </div>
      <div className="fullscreen-stage">
        {!canvas ? (
          <div className="page-note">Finding the presentation…</div>
        ) : !item || !current ? (
          <div className="page-note">
            {itemId ? "That item is not on this canvas any more." : "Nothing here yet."}
          </div>
        ) : (
          <VersionContent
            canvasId={canvasId}
            blobHash={current.blobHash}
            mimeType={current.mimeType}
            filename={current.filename}
            entered={true}
            designSystem={isDesignSystem(item)}
            textNode={isTextItem(item)}
            reloadToken={0}
          />
        )}
      </div>
    </div>
  );
}
