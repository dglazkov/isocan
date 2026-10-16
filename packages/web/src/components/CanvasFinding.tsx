import { useEffect, useState } from "react";
import { readRecents } from "../lib/recents.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";

/**
 * **The arrival screen while a canvas is being found and opened.**
 *
 * Shown first while `useCanvasHome` checks `/api/homes`, and held seamlessly
 * over the canvas until the snapshot (or IndexedDB replica) lands so the
 * screen dissolves straight from the drafting-table title card into the live
 * board rather than cutting through a tiny 14px note and an empty grid.
 */
export function CanvasFinding({
  canvasId,
  fadingOut = false,
}: {
  canvasId: string;
  fadingOut?: boolean;
}) {
  const recentTitle = readRecents().find((entry) => entry.id === canvasId)?.title ?? null;

  return (
    <div
      className={`canvas-finding${fadingOut ? " fading-out" : ""}`}
      role="status"
      aria-live="polite"
      aria-hidden={fadingOut || undefined}
    >
      <div className="canvas-finding-inner">
        <svg
          className="canvas-finding-emblem"
          viewBox="0 0 56 56"
          width="56"
          height="56"
          aria-hidden="true"
        >
          <g
            className="canvas-finding-ticks"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="round"
          >
            <path d="M10 6v5M7.5 8.5h5" />
            <path d="M46 6v5M43.5 8.5h5" />
            <path d="M10 45v5M7.5 47.5h5" />
            <path d="M46 45v5M43.5 47.5h5" />
          </g>
          <rect
            className="canvas-finding-card-back"
            x="11"
            y="14"
            width="26"
            height="20"
            rx="4"
          />
          <rect
            className="canvas-finding-card-front"
            x="19"
            y="22"
            width="26"
            height="20"
            rx="4"
          />
        </svg>
        <div className="canvas-finding-eyebrow">
          {recentTitle ? "Finding this canvas…" : "Opening canvas"}
        </div>
        <div className="canvas-finding-title">
          {recentTitle ?? "Finding this canvas…"}
        </div>
        <div className="canvas-finding-sub">
          {recentTitle
            ? "Setting out the board and syncing changes."
            : "Checking its home and setting out the board."}
        </div>
        <div className="canvas-finding-bar" aria-hidden="true">
          <div className="canvas-finding-bar-fill" />
        </div>
      </div>
    </div>
  );
}

function reducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;
}

/**
 * **Holds the arrival screen across `/api/homes` and the initial snapshot load,
 * then cross-fades out over the live board.**
 *
 * Mounted as a sibling of `CanvasSurface` (like `TabTitle`) so fading out and
 * unmounting the veil never re-renders the canvas chrome underneath.
 */
export function CanvasArrivalVeil({
  canvasId,
  asking,
}: {
  canvasId: string;
  asking: boolean;
}) {
  const storeReady = useCanvasStore(
    (s) =>
      s.record?.id === canvasId ||
      s.connection === "gone" ||
      s.connection === "refused" ||
      s.connection === "withdrawn" ||
      s.connection === "absent" ||
      s.connection === "taken-down" ||
      s.connection === "ended" ||
      s.connection === "refused-here" ||
      s.connection === "upgrade-required",
  );
  const settled = !asking && storeReady;
  const [visible, setVisible] = useState(() => !settled);

  useEffect(() => {
    if (!settled || !visible) return;
    if (reducedMotion()) {
      setVisible(false);
      return;
    }
    const timer = window.setTimeout(() => setVisible(false), 380);
    return () => window.clearTimeout(timer);
  }, [settled, visible]);

  if (!visible) return null;
  return <CanvasFinding canvasId={canvasId} fadingOut={settled} />;
}
