import type { Item, UnderlayFacts } from "@isocan/core";
import { allMapEdges, edgeAnchors } from "./graph.ts";

/**
 * **The lines of every mind map on the canvas.**
 *
 * Derived, never stored: an edge is a property naming a parent, and the line
 * is worked out from wherever the two items are *right now*. That is what
 * makes a link follow a drag, and it means there is no edge geometry that can
 * fall out of step with the nodes.
 *
 * **World space, inside `.world`**, and the reason is worth keeping now that
 * the thing it used to be contrasted with is gone. A line whose ends live in
 * two coordinate systems — a chip in a panel and an item on the canvas — has
 * to be drawn in screen space and re-measured, or one end scales away; that
 * was the lane tether, removed because it read as a puzzle rather than a
 * connection. Both ends of a map edge are items, so drawing them in the world
 * means they pan, zoom and scale with the nodes for free, and nothing has to
 * listen to keep them in step.
 *
 * **Under the items**, because a node is chromeless text and a line drawn
 * over it would strike through the words.
 */
/**
 * **A branch, not a wire.**
 *
 * Straight segments were the first version and they read as a circuit
 * diagram: every line arrives at a node on a different diagonal, and a parent
 * with six children becomes a spray of spokes converging on one point. A mind
 * map is read as *branching*, and the thing that carries that is a line
 * leaving its parent along the parent's own axis and arriving at the child
 * along the child's.
 *
 * So: a cubic bezier whose control points sit on the axis `edgeAnchors`
 * chose. Both handles push out along the same axis, which is what makes the
 * curve leave and enter square-on and flow rather than kink.
 *
 * The handle length is **half the span**, which is the ratio that keeps a
 * curve looking like one curve at every distance — a fixed number is too
 * limp across a wide gap and too loopy across a narrow one. Clamped at the
 * bottom so two nodes almost touching still get a visible bend rather than a
 * segment, and at the top so a node dragged far away does not throw a handle
 * so long the line bows back past its own endpoint.
 */
function curve({ x1, y1, x2, y2, axis }: ReturnType<typeof edgeAnchors>): string {
  const span = Math.abs(axis === "x" ? x2 - x1 : y2 - y1);
  const reach = Math.min(Math.max(span * 0.5, 12), 160);
  const [c1x, c1y] = axis === "x" ? [x1 + Math.sign(x2 - x1 || 1) * reach, y1] : [x1, y1 + Math.sign(y2 - y1 || 1) * reach];
  const [c2x, c2y] = axis === "x" ? [x2 - Math.sign(x2 - x1 || 1) * reach, y2] : [x2, y2 - Math.sign(y2 - y1 || 1) * reach];
  return `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`;
}

/** Facts as props — the shell reads its stores once and hands them over
 *  (`ModuleUnderlays.tsx`), so this component knows core and React and
 *  nothing about where the canvas came from. */
export function MapEdges({ canvas, drag }: UnderlayFacts) {
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

  const drawn = edges.map(({ from, to }) => {
    const a = edgeAnchors(riding(from), riding(to));
    return { key: `${from.id}->${to.id}`, ...a, d: curve(a) };
  });

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
        <path key={d.key} className="map-edge" d={d.d} />
      ))}
    </svg>
  );
}
