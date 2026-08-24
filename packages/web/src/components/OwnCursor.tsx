import { useEffect, useRef } from "react";
import type { Actor } from "@isocan/core";
import { useUiStore } from "../stores/uiStore.ts";
import { actorColor } from "../lib/colors.ts";
import { actorName } from "../lib/names.ts";
import { ownCursorFits } from "../lib/owncursor.ts";

/**
 * Your own cursor, drawn the way everybody else sees it.
 *
 * On this canvas a pointer is a signed object: it carries your colour and your
 * name, and that is how you read a room. Your own was the one arrow that said
 * nothing — the OS drew it, so you were the only person on the canvas with no
 * name attached to your hand.
 *
 * ONLY UNDER THE SELECT TOOL. The other tools draw a cursor that is doing real
 * work — the Pen's nib, the Hand's grab, the Zoom's magnifier, the crosshair
 * that says a click starts a comment — and replacing those with a name chip
 * would trade a fact you need for a fact you already know. Under Select the
 * native cursor is an ordinary arrow, which is exactly what the chip replaces.
 *
 * The position is written straight to the DOM from a pointermove listener,
 * never through state: a cursor re-rendering React on every pixel is a cursor
 * that lags, and a lagging copy of your own hand is worse than none.
 *
 * AND ONLY WHERE NOTHING ELSE WANTS THE CURSOR. `cursor` is an inherited
 * property, so the viewport's `cursor: none` reaches every descendant that has
 * no opinion of its own, and stops at the first one that does — the titlebar's
 * grab, a resize handle's arrows, a button's pointer, an input's I-beam. That
 * makes the computed value the answer: `none` means the chip is the only
 * cursor here, anything else means the browser is already drawing one and a
 * second cursor beside it is just clutter. Asking the stylesheet beats keeping
 * a list of places to hide, which is a list that goes stale the next time
 * somebody adds a `cursor:` line — and did, for text fields.
 */
export function OwnCursor({ actor }: { actor: Actor }) {
  const tool = useUiStore((s) => s.activeTool);
  const commentMode = useUiStore((s) => s.commentMode);
  const ref = useRef<HTMLDivElement>(null);
  const shown = tool === "select" && !commentMode;

  useEffect(() => {
    if (!shown) return;
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    let at: { x: number; y: number } | null = null;

    const paint = () => {
      frame = 0;
      if (!at) return;
      el.style.transform = `translate(${at.x}px, ${at.y}px)`;
      el.style.opacity = "1";
    };
    // getComputedStyle per pixel would be wasteful and the answer only changes
    // when the pointer crosses onto something else, so it is asked once per
    // element and remembered.
    let last: Element | null = null;
    let fits = false;

    const hide = () => {
      el.style.opacity = "0";
      at = null;
      last = null;
    };
    const onMove = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (target !== last) {
        last = target;
        fits = target !== null && ownCursorFits(target, getComputedStyle(target).cursor);
      }
      if (!fits) {
        el.style.opacity = "0";
        at = null;
        return;
      }
      at = { x: e.clientX, y: e.clientY };
      if (!frame) frame = requestAnimationFrame(paint);
    };
    // Two ways to lose the pointer without a move telling you: out of the
    // window, and into an iframe. A site on the canvas is somebody else's
    // document and it takes the pointer events with it, so without this the
    // chip would stick to the edge of the frame for as long as you were
    // inside it.
    const onOut = (e: PointerEvent) => {
      const to = e.relatedTarget as Element | null;
      if (!to || to.tagName === "IFRAME") hide();
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerout", onOut, { passive: true });
    document.addEventListener("pointerleave", hide);
    window.addEventListener("blur", hide);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerout", onOut);
      document.removeEventListener("pointerleave", hide);
      window.removeEventListener("blur", hide);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [shown]);

  if (!shown) return null;
  const color = actorColor(actor.id);
  return (
    <div className="own-cursor" ref={ref} aria-hidden style={{ opacity: 0 }}>
      <svg width="18" height="20" viewBox="0 0 18 20">
        <path d="M1.5 0.5 L16 12 L9.2 12.8 L5.5 19 Z" fill={color} strokeWidth="1" />
      </svg>
      <span className="cursor-chip" style={{ background: color }}>
        {actorName(actor)}
      </span>
    </div>
  );
}
