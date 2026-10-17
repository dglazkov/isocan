import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MutableRefObject, PointerEvent as ReactPointerEvent } from "react";

/** Edge or corner direction for interactive popup resizing. */
export type ResizeDir = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

/** Minimum dimensions enforced while resizing a floating popup. */
export interface FloatingBoxOptions {
  minWidth?: number;
  minHeight?: number;
}

/** State and pointer handlers returned by {@link useFloatingBox}. */
export interface FloatingBoxControls<T extends HTMLElement = HTMLElement> {
  ref: MutableRefObject<T | null>;
  style: CSSProperties;
  isMoved: boolean;
  isSized: boolean;
  onDragPointerDown: (e: ReactPointerEvent) => void;
  onResizePointerDown: (dir: ResizeDir, e: ReactPointerEvent) => void;
  reset: () => void;
}

interface BoxState {
  x: number;
  y: number;
  w: number | null;
  h: number | null;
}

const RESIZE_DIRS: readonly ResizeDir[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

function hasFilterOrTransform(value: string | undefined): boolean {
  return Boolean(value && value !== "none" && value !== "normal");
}

/**
 * Find the viewport origin of the CSS containing block for a `position: fixed`
 * element. Ancestors with `backdrop-filter`, `transform`, `filter`,
 * `perspective`, or `contain: paint/layout` capture fixed descendants.
 */
function findContainingBlockOrigin(el: HTMLElement): { x: number; y: number } {
  let p = el.parentElement;
  while (p && p !== document.documentElement) {
    const cs = window.getComputedStyle(p);
    const webkitBackdrop = cs.getPropertyValue("-webkit-backdrop-filter");
    const contain = cs.contain || "";
    const willChange = cs.willChange || "";
    if (
      hasFilterOrTransform(cs.transform) ||
      hasFilterOrTransform(cs.perspective) ||
      hasFilterOrTransform(cs.filter) ||
      hasFilterOrTransform(cs.backdropFilter) ||
      hasFilterOrTransform(webkitBackdrop) ||
      hasFilterOrTransform(p.style.backdropFilter) ||
      /\b(paint|layout|strict|content)\b/.test(contain) ||
      /\b(transform|perspective|filter|backdrop-filter)\b/.test(willChange)
    ) {
      const r = p.getBoundingClientRect();
      return { x: r.left, y: r.top };
    }
    p = p.parentElement;
  }
  return { x: 0, y: 0 };
}

/**
 * Make a floating popup or panel draggable and resizable in viewport space.
 * Until the user drags or resizes it, `style` is empty so CSS anchoring or
 * flexbox centering stays untouched.
 */
export function useFloatingBox<T extends HTMLElement = HTMLElement>(
  options?: FloatingBoxOptions,
): FloatingBoxControls<T> {
  const minW = options?.minWidth ?? 220;
  const minH = options?.minHeight ?? 120;
  const ref = useRef<T | null>(null);
  const [box, setBox] = useState<BoxState | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  const reset = useCallback(() => {
    cleanupRef.current?.();
    setBox(null);
  }, []);

  const onDragPointerDown = useCallback((e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest("button, input, textarea, select, a, [role='button']")) return;
    const el = ref.current;
    if (!el) return;

    e.preventDefault();
    e.stopPropagation();
    cleanupRef.current?.();

    const rect = el.getBoundingClientRect();
    const cb = findContainingBlockOrigin(el);
    const startX = e.clientX;
    const startY = e.clientY;
    const vw = window.innerWidth || 1280;
    const vh = window.innerHeight || 720;

    setBox((prev) => ({
      x: rect.left - cb.x,
      y: rect.top - cb.y,
      w: prev?.w ?? null,
      h: prev?.h ?? null,
    }));

    const onMove = (ev: PointerEvent) => {
      const rawLeft = rect.left + (ev.clientX - startX);
      const rawTop = rect.top + (ev.clientY - startY);
      const clampedLeft = Math.max(48 - rect.width, Math.min(vw - 48, rawLeft));
      const clampedTop = Math.max(4, Math.min(vh - 36, rawTop));
      setBox((prev) => ({
        x: clampedLeft - cb.x,
        y: clampedTop - cb.y,
        w: prev?.w ?? null,
        h: prev?.h ?? null,
      }));
    };

    const onEnd = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
      cleanupRef.current = null;
    };

    cleanupRef.current = onEnd;
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
  }, []);

  const onResizePointerDown = useCallback(
    (dir: ResizeDir, e: ReactPointerEvent) => {
      if (e.button !== 0) return;
      const el = ref.current;
      if (!el) return;

      e.preventDefault();
      e.stopPropagation();
      cleanupRef.current?.();

      const rect = el.getBoundingClientRect();
      const cb = findContainingBlockOrigin(el);
      const startX = e.clientX;
      const startY = e.clientY;
      const vw = window.innerWidth || 1280;
      const vh = window.innerHeight || 720;

      setBox({
        x: rect.left - cb.x,
        y: rect.top - cb.y,
        w: rect.width,
        h: rect.height,
      });

      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        let left = rect.left;
        let top = rect.top;
        let width = rect.width;
        let height = rect.height;

        if (dir.includes("e")) {
          width = Math.max(minW, Math.min(vw - rect.left - 4, rect.width + dx));
        }
        if (dir.includes("s")) {
          height = Math.max(minH, Math.min(vh - rect.top - 4, rect.height + dy));
        }
        if (dir.includes("w")) {
          const maxLeft = rect.right - minW;
          left = Math.max(4, Math.min(maxLeft, rect.left + dx));
          width = rect.right - left;
        }
        if (dir.includes("n")) {
          const maxTop = rect.bottom - minH;
          top = Math.max(4, Math.min(maxTop, rect.top + dy));
          height = rect.bottom - top;
        }

        setBox({
          x: left - cb.x,
          y: top - cb.y,
          w: width,
          h: height,
        });
      };

      const onEnd = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onEnd);
        window.removeEventListener("pointercancel", onEnd);
        cleanupRef.current = null;
      };

      cleanupRef.current = onEnd;
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onEnd);
      window.addEventListener("pointercancel", onEnd);
    },
    [minH, minW],
  );

  const style = useMemo<CSSProperties>(() => {
    if (!box) return {};
    const out: CSSProperties = {
      position: "fixed",
      left: `${Math.round(box.x)}px`,
      top: `${Math.round(box.y)}px`,
      right: "auto",
      bottom: "auto",
      margin: 0,
      transform: "none",
    };
    if (box.w !== null) {
      out.width = `${Math.round(box.w)}px`;
      out.maxWidth = "none";
    }
    if (box.h !== null) {
      out.height = `${Math.round(box.h)}px`;
      out.maxHeight = "none";
    }
    return out;
  }, [box]);

  const isMoved = box !== null;
  const isSized = box !== null && (box.w !== null || box.h !== null);

  return useMemo(
    () => ({
      ref,
      style,
      isMoved,
      isSized,
      onDragPointerDown,
      onResizePointerDown,
      reset,
    }),
    [style, isMoved, isSized, onDragPointerDown, onResizePointerDown, reset],
  );
}

/**
 * Top drag handle pill and eight perimeter resize hit strips rendered inside a
 * movable popup. Double-clicking the top handle resets position and size.
 */
export function FloatingHandles({
  box,
  resizable = true,
}: {
  box: Pick<FloatingBoxControls<HTMLElement>, "onDragPointerDown" | "onResizePointerDown" | "reset">;
  resizable?: boolean;
}) {
  return (
    <>
      <div
        className="float-handle float-drag-bar"
        onPointerDown={box.onDragPointerDown}
        onDoubleClick={box.reset}
        title="Drag to move · Double-click to reset"
      >
        <span className="float-drag-pill" aria-hidden="true" />
      </div>
      {resizable &&
        RESIZE_DIRS.map((dir) => (
          <div
            key={dir}
            className={`float-handle float-resize float-resize-${dir}`}
            onPointerDown={(e) => box.onResizePointerDown(dir, e)}
          >
            {dir === "se" && <span className="float-corner-grip" aria-hidden="true" />}
          </div>
        ))}
    </>
  );
}
