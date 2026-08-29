import { allMapEdges, edgeAnchors, type Item } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";

/**
 * **The lines of every mind map on the canvas.**
 *
 * Derived, never stored: an edge is a property naming a parent, and the line
 * is worked out from wherever the two items are *right now*. That is what
 * makes a link follow a drag, and it means there is no edge geometry that can
 * fall out of step with the nodes.
 *
 * **World space, inside `.world`** — and this is the opposite call from the
 * lane's tether, for a reason worth stating. A tether joins a chip in a panel
 * to a thing on the canvas: two coordinate systems, so it must be drawn in
 * screen space or one end would scale away. Both ends of a map edge are
 * items. Drawing them in the world means they pan, zoom and scale with the
 * nodes for free, and no listener is needed to keep them in step.
 *
 * **Under the items**, because a node is chromeless text and a line drawn
 * over it would strike through the words.
 */
export function MapEdges() {
  const canvas = useCanvasStore((s) => s.canvas);
  const drag = useUiStore((s) => s.drag);
  if (!canvas) return null;
  const edges = allMapEdges(canvas);
  if (edges.length === 0) return null;

  // While a drag is live the item has not moved in the replica yet, so a node
  // rides the gesture's delta to stay under the hand — the same trick a
  // comment pin uses, and the reason a line does not lag the node it joins.
  const riding = (item: Item) => {
    const on = drag?.itemIds.includes(item.id) ? drag : null;
    return {
      x: item.x + (on?.dx ?? 0),
      y: item.y + (on?.dy ?? 0),
      width: item.width,
      height: item.height,
    };
  };

  const drawn = edges.map(({ from, to }) => ({
    key: `${from.id}->${to.id}`,
    ...edgeAnchors(riding(from), riding(to)),
  }));

  /**
   * **The SVG is sized to its own contents, and that is not a nicety.**
   *
   * The first version was `width: 0; height: 0; overflow: visible`, on the
   * assumption that an SVG root honours `overflow` the way a div does. It
   * does not: every line had a correct layout box and a correct stroke and
   * NONE of them painted — proved by turning the stroke red and 6px wide and
   * still seeing nothing. A zero-sized SVG clips its own painting.
   *
   * So the box is measured from the lines and the `viewBox` carries the world
   * origin, which means the coordinates below stay world coordinates and
   * every line sits inside its own viewport. Nothing relies on overflow.
   *
   * Padded by a few units so a perfectly vertical or horizontal run — two
   * nodes in a column, which a map reaches immediately — is not a zero-width
   * box that paints nothing for the same reason as before.
   */
  const PAD = 8;
  const xs = drawn.flatMap((d) => [d.x1, d.x2]);
  const ys = drawn.flatMap((d) => [d.y1, d.y2]);
  const minX = Math.min(...xs) - PAD;
  const minY = Math.min(...ys) - PAD;
  const width = Math.max(...xs) - minX + PAD;
  const height = Math.max(...ys) - minY + PAD;

  return (
    <svg
      className="map-edges"
      aria-hidden
      style={{ left: minX, top: minY, width, height }}
      viewBox={`${minX} ${minY} ${width} ${height}`}
    >
      {drawn.map((d) => (
        <line key={d.key} className="map-edge" x1={d.x1} y1={d.y1} x2={d.x2} y2={d.y2} />
      ))}
    </svg>
  );
}
