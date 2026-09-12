import { useEffect, useRef, useState, type ReactNode } from "react";

/** A pointer- and keyboard-resizable pane. The grid remains the source of its
 * actual bounds, including when a window resize changes its orientation. */
export function InspectorPane({
  children,
  width,
  height,
  resize,
  resetKey,
}: {
  resetKey?: string;
  children: ReactNode;
  width: number;
  height: number;
  resize: (axis: "width" | "height", value: number) => void;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => { const content = ref.current?.querySelector(".anatomy-inspector-content"); if (content) content.scrollTop = 0; }, [resetKey]);
  const gesture = useRef<{
    axis: "width" | "height";
    start: number;
    size: number;
  } | null>(null);
  const [narrow, setNarrow] = useState(() => window.innerWidth <= 760);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const changed = () => setNarrow(media.matches);
    media.addEventListener("change", changed);
    return () => media.removeEventListener("change", changed);
  }, []);
  const axis = narrow ? "height" : "width";
  function change(value: number) {
    const bounds = ref.current?.parentElement?.getBoundingClientRect();
    const max = narrow
      ? Math.max(120, (bounds?.height ?? 400) - 150)
      : Math.min(560, window.innerWidth * 0.45);
    resize(
      axis,
      Math.round(Math.max(narrow ? 120 : 220, Math.min(max, value))),
    );
  }
  return (
    <aside
      ref={ref}
      className="anatomy-inspector"
      aria-label="Concept inspector"
    >
      <div
        className="anatomy-inspector-resize"
        role="separator"
        tabIndex={0}
        aria-label="Resize inspector"
        aria-orientation={narrow ? "horizontal" : "vertical"}
        aria-valuemin={narrow ? 120 : 220}
        aria-valuemax={narrow ? Math.max(120, window.innerHeight) : 560}
        aria-valuenow={narrow ? height : width}
        title={
          narrow
            ? "Drag to resize. Use Up and Down arrows when focused."
            : "Drag to resize. Use Left and Right arrows when focused."
        }
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          event.currentTarget.focus();
          event.currentTarget.setPointerCapture(event.pointerId);
          gesture.current = {
            axis,
            start: narrow ? event.clientY : event.clientX,
            size: ref.current!.getBoundingClientRect()[axis],
          };
        }}
        onPointerMove={(event) => {
          const drag = gesture.current;
          if (!drag || drag.axis !== axis) return;
          change(
            drag.size + drag.start - (narrow ? event.clientY : event.clientX),
          );
        }}
        onPointerUp={(event) => {
          gesture.current = null;
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onLostPointerCapture={() => {
          gesture.current = null;
        }}
        onPointerCancel={() => {
          gesture.current = null;
        }}
        onKeyDown={(event) => {
          const direction = narrow
            ? { ArrowUp: 1, ArrowDown: -1 }
            : { ArrowLeft: 1, ArrowRight: -1 };
          const delta = direction[event.key as keyof typeof direction];
          if (!delta) return;
          event.preventDefault();
          event.stopPropagation();
          change(
            ref.current!.getBoundingClientRect()[axis] +
              delta * (event.shiftKey ? 50 : 20),
          );
        }}
      >
        <span />
      </div>
      <div className="anatomy-inspector-content">{children}</div>
    </aside>
  );
}
