import { useId } from "react";
import type { UnderlayFacts } from "@isocan/core";
import { projectsOn, projectEdges } from "./manifest.ts";

export default function Edges({ canvas, drag, activateItem }: UnderlayFacts) {
  const marker = useId();
  const edges = projectsOn(canvas).flatMap((p) => projectEdges(canvas, p.id));
  if (!edges.length) return null;
  const at = (item: (typeof edges)[number]["from"]) => ({
    x:
      item.x + item.width / 2 + (drag?.itemIds.includes(item.id) ? drag.dx : 0),
    y:
      item.y +
      item.height / 2 +
      (drag?.itemIds.includes(item.id) ? drag.dy : 0),
  });
  return (
    <svg
      style={{
        position: "absolute",
        overflow: "visible",
        pointerEvents: "none",
        width: 1,
        height: 1,
      }}
      aria-hidden={!activateItem}
    >
      <defs>
        <marker
          id={marker}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--ink-soft)" />
        </marker>
      </defs>
      {edges.map((e, index) => {
        const a = at(e.from),
          b = at(e.to);
        const dx = b.x - a.x,
          dy = b.y - a.y;
        const start = Math.min(
          e.from.width / 2 / (Math.abs(dx) || 1),
          e.from.height / 2 / (Math.abs(dy) || 1),
        );
        const end = Math.min(
          e.to.width / 2 / (Math.abs(dx) || 1),
          e.to.height / 2 / (Math.abs(dy) || 1),
        );
        a.x += dx * start;
        a.y += dy * start;
        b.x -= dx * end;
        b.y -= dy * end;
        return (
          <g
            key={`${e.from.id}:${e.to.id}:${index}`}
            className={activateItem ? "anatomy-connection" : undefined}
            role={activateItem ? "button" : undefined}
            tabIndex={activateItem ? 0 : undefined}
            aria-label={
              activateItem
                ? `Explore ${e.to.title} via ${e.label || "connection"} from ${e.from.title}`
                : undefined
            }
            onPointerDown={
              activateItem ? (event) => event.stopPropagation() : undefined
            }
            onClick={
              activateItem
                ? (event) => {
                    event.stopPropagation();
                    activateItem(e.to.id);
                  }
                : undefined
            }
            onKeyDown={
              activateItem
                ? (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      event.stopPropagation();
                      activateItem(e.to.id);
                    }
                  }
                : undefined
            }
          >
            {activateItem && (
              <path
                className="anatomy-connection-hit"
                d={`M ${a.x} ${a.y} C ${(a.x + b.x) / 2} ${a.y}, ${(a.x + b.x) / 2} ${b.y}, ${b.x} ${b.y}`}
                fill="none"
                stroke="transparent"
                strokeWidth="16"
                vectorEffect="non-scaling-stroke"
                style={{ pointerEvents: "stroke", cursor: "pointer" }}
              />
            )}
            <path
              className="anatomy-connection-line"
              d={`M ${a.x} ${a.y} C ${(a.x + b.x) / 2} ${a.y}, ${(a.x + b.x) / 2} ${b.y}, ${b.x} ${b.y}`}
              fill="none"
              stroke="var(--ink-soft)"
              strokeOpacity=".4"
              strokeWidth="2"
              markerEnd={`url(#${marker})`}
              strokeDasharray={e.coupling === "loose" ? "6 5" : undefined}
            />
            {e.label && (
              <text
                x={(a.x + b.x) / 2}
                y={(a.y + b.y) / 2 - 8}
                fill="var(--ink-soft)"
                fontSize="12"
                textAnchor="middle"
                style={
                  activateItem
                    ? { pointerEvents: "auto", cursor: "pointer" }
                    : undefined
                }
              >
                {e.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
