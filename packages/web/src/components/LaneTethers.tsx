import { useEffect, useState } from "react";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { type Tether, tetherFor } from "../lib/tether.ts";
import { placeableArea } from "../lib/spot.ts";

/**
 * **The dashed line from a message to the thing it made.**
 *
 * The chip says which item and which version; the line says *that one, over
 * there*, which is the thing a list of names cannot do on a canvas.
 *
 * **Suppressed entirely during a pan or a drag.** This is the rule that
 * matters most and it is not about performance. A dashed line re-measured
 * against a moving canvas trails whatever it is pointing at, so during the
 * one gesture where a person most needs to see where things are, the tethers
 * would be visibly wrong. They are hidden while the hand is down and come
 * back when it lifts, which reads as deliberate rather than broken.
 *
 * **Measured, not computed from layout.** Where a chip sits depends on how
 * long the messages above it are, whether the panel is scrolled, and how wide
 * somebody dragged the rail — none of which this can know. So it reads the
 * chips' actual rectangles and joins those to the items' screen positions.
 * The alternative is a line that is right until somebody scrolls.
 */
export function LaneTethers() {
  const canvas = useCanvasStore((s) => s.canvas);
  const viewport = useUiStore((s) => s.viewport);
  const drag = useUiStore((s) => s.drag);
  const panning = useUiStore((s) => s.panning);
  const resizing = useUiStore((s) => s.panelResizing);
  const [lines, setLines] = useState<Tether[]>([]);
  const quiet = drag !== null || panning || resizing;

  useEffect(() => {
    if (quiet || !canvas) {
      setLines([]);
      return;
    }
    const area = placeableArea();
    const measure = () => {
      const found: Tether[] = [];
      for (const el of document.querySelectorAll<HTMLElement>(".lane-chip[data-item]")) {
        const itemId = el.dataset.item;
        const item = itemId ? canvas.items[itemId] : undefined;
        if (!item) continue;
        const rect = el.getBoundingClientRect();
        // The chip's right edge: the line leaves where the arrow points.
        const line = tetherFor(
          { x: rect.right, y: rect.top + rect.height / 2 },
          item,
          viewport,
          area,
        );
        if (line) found.push(line);
      }
      setLines(found);
    };
    measure();
    // A scroll inside the panel moves the chips without changing anything
    // this component subscribes to, so it is watched directly. Capture,
    // because the scroll happens on the message list, not on the window.
    document.addEventListener("scroll", measure, true);
    return () => document.removeEventListener("scroll", measure, true);
  }, [canvas, viewport, quiet]);

  if (lines.length === 0) return null;
  return (
    <svg className="lane-tethers" aria-hidden>
      {lines.map((line) => (
        <line
          key={line.itemId}
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          className="lane-tether"
        />
      ))}
    </svg>
  );
}
