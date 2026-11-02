import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { dragChat, placeChat } from "../lib/chatmove.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";

/**
 * **The docked Chat's way to the bottom**: its "Move to bottom" button, and
 * the press on its header that starts a drag (`lib/chatmove.ts`).
 *
 * Lazy, beside the dock rather than in the panel itself (it arrives with
 * `ChatBar.tsx`, after the first paint): none of it is needed to draw the
 * Chat. It finds the docked header whenever the dock shows the Chat, portals
 * into it the way `ChatTidy` does, and listens on it natively.
 */
export function ChatHandle({ canvasId }: { canvasId: string }) {
  const open = useUiStore((s) => s.mainPanelOpen);
  const loaded = useCanvasStore((s) => s.canvas !== null);
  const [head, setHead] = useState<HTMLElement | null>(null);

  // After the commit that drew (or removed) the dock — and again for each
  // canvas, whose panel is a fresh one.
  useLayoutEffect(
    () => setHead(open && loaded ? document.querySelector<HTMLElement>(".main-panel > .panel-head") : null),
    [open, loaded, canvasId],
  );

  // Pick the Chat up by its header — anywhere but its buttons, which stay
  // buttons. A press that never travels is still just a press.
  useEffect(() => {
    if (!head) return;
    const press = (e: PointerEvent) => {
      if (e.button !== 0 || (e.target as Element).closest("button")) return;
      e.preventDefault();
      dragChat(canvasId, { x: e.clientX, y: e.clientY }, head.closest<HTMLElement>(".main-panel"));
    };
    head.addEventListener("pointerdown", press);
    return () => head.removeEventListener("pointerdown", press);
  }, [head, canvasId]);

  return (
    head &&
        createPortal(
          <button
            type="button"
            className="main-close chat-move"
            title="Move to bottom"
            aria-label="Move the Chat to the bottom"
            onClick={() => placeChat(canvasId, "bottom")}
          >
            <svg viewBox="0 0 16 16" width={13} height={13} aria-hidden fill="none" stroke="currentColor" strokeWidth={1.5}>
              <rect x="1.5" y="2.5" width="13" height="11" rx="2" />
              <path d="M5 10.5h6" />
            </svg>
          </button>,
          head,
        )
  );
}
