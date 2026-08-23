import { useEffect, useRef } from "react";
import type { Actor } from "@isocan/core";
import { useUiStore } from "../stores/uiStore.ts";
import { actorColor } from "../lib/colors.ts";
import { actorName } from "../lib/names.ts";

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
    const onMove = (e: PointerEvent) => {
      // Over the panels and the top bar the OS cursor is the right one: those
      // are ordinary UI, and a name chip floating over a text field is noise.
      const overChrome = (e.target as HTMLElement | null)?.closest?.(
        ".toolbar, .main-panel, .files-panel, .trash-panel, .favourites, .tool-rail, .zoom-controls, .minimap-dock, .hover-card, .cmdbar-backdrop, .help-backdrop, .identity-backdrop",
      );
      if (overChrome) {
        el.style.opacity = "0";
        at = null;
        return;
      }
      at = { x: e.clientX, y: e.clientY };
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const onLeave = () => {
      el.style.opacity = "0";
      at = null;
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [shown]);

  if (!shown) return null;
  const color = actorColor(actor.id);
  return (
    <div className="own-cursor" ref={ref} aria-hidden style={{ opacity: 0 }}>
      <svg width="18" height="20" viewBox="0 0 18 20">
        <path d="M1.5 0.5 L16 12 L9.2 12.8 L5.5 19 Z" fill={color} stroke="#fff" strokeWidth="1" />
      </svg>
      <span className="cursor-chip" style={{ background: color }}>
        {actorName(actor)}
      </span>
    </div>
  );
}
