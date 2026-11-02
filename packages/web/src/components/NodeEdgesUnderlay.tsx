import type { CanvasContents } from "@isocan/core";
import {
  EDGE_PROP_PREFIX,
  EDGES_PROP,
  declaredEdgesOf,
  directionalEdgeGeometry,
  edgePatch,
  nodeEdges,
  removeEdgePatch,
} from "@isocan/core";

export {
  EDGE_PROP_PREFIX,
  EDGES_PROP,
  declaredEdgesOf,
  edgePatch,
  removeEdgePatch,
};

/**
 * World-space directional edges declared by items on `canvas` (`edge:<key>` or
 * `edges` properties).
 */
export function NodeEdgesUnderlay({ canvas }: { canvas: CanvasContents }) {
  const edges = nodeEdges(canvas);
  if (edges.length === 0) return null;
  return (
    <svg
      className="node-edges-underlay"
      aria-label="Node directional edges"
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: 1,
        height: 1,
        overflow: "visible",
        pointerEvents: "none",
        color: "var(--muted)",
      }}
    >
      <defs>
        <marker
          id="isocan-node-edge-arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 1 L 9 5 L 0 9 z" fill="currentColor" />
        </marker>
      </defs>
      {edges.map(({ from, to, key, label }) => {
        const g = directionalEdgeGeometry(from, to);
        return (
          <g
            key={`${from.id}:${key}:${to.id}`}
            className="node-edge"
            data-edge-from={from.id}
            data-edge-to={to.id}
            data-edge-key={key}
          >
            <path
              className="node-edge-path"
              d={`M ${g.x1} ${g.y1} C ${g.cx1} ${g.cy1}, ${g.cx2} ${g.cy2}, ${g.x2} ${g.y2}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              markerEnd="url(#isocan-node-edge-arrow)"
            />
            {label && (
              <text
                className="node-edge-label"
                x={g.mx}
                y={g.my - 6}
                textAnchor="middle"
                fill="currentColor"
                fontSize={12}
              >
                {label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export default NodeEdgesUnderlay;
