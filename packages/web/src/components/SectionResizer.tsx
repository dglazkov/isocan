import { useCallback, useMemo, useState } from "react";

/** A per-browser section height, clamped so neither the section nor what is
 * under it can be starved. */
export function useSectionHeight(key: string, fallback: number): [number, (h: number) => void] {
  const clamp = (h: number) =>
    Math.min(Math.max(Math.round(h), 96), Math.round(window.innerHeight * 0.6));
  const [h, setH] = useState(() => {
    try {
      const raw = Number(localStorage.getItem(key));
      return Number.isFinite(raw) && raw > 0 ? clamp(raw) : fallback;
    } catch {
      return fallback;
    }
  });
  // Both halves stable: a fresh tuple and a fresh setter out of a hook is the
  // hazard `test/stablehooks.test.ts` names, and this one is handed to a
  // resizer that could reasonably key an effect on it.
  const set = useCallback(
    (next: number) => {
      const clamped = Math.min(Math.max(Math.round(next), 96), Math.round(window.innerHeight * 0.6));
      try {
        localStorage.setItem(key, String(clamped));
      } catch {
        // holds for this session and no longer
      }
      setH(clamped);
    },
    [key],
  );
  return useMemo((): [number, (h: number) => void] => [h, set], [h, set]);
}

/** The grab-edge under a section — PanelResizer's manners (pointer capture,
 * a strip not a border) turned sideways for heights. */
export function SectionResizer({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (h: number) => void;
  label: string;
}) {
  return (
    <div
      className="wb-section-resizer"
      role="separator"
      aria-orientation="horizontal"
      aria-label={label}
      aria-valuenow={value}
      tabIndex={0}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        const handle = e.currentTarget as HTMLElement;
        handle.setPointerCapture(e.pointerId);
        const startY = e.clientY;
        const startH = value;
        const onMove = (ev: PointerEvent) => onChange(startH + (ev.clientY - startY));
        const onUp = (ev: PointerEvent) => {
          handle.releasePointerCapture(ev.pointerId);
          handle.removeEventListener("pointermove", onMove);
          handle.removeEventListener("pointerup", onUp);
          handle.removeEventListener("pointercancel", onUp);
        };
        handle.addEventListener("pointermove", onMove);
        handle.addEventListener("pointerup", onUp);
        handle.addEventListener("pointercancel", onUp);
      }}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 64 : 16;
        if (e.key === "ArrowUp") {
          e.preventDefault();
          onChange(value - step);
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          onChange(value + step);
        }
      }}
    />
  );
}
