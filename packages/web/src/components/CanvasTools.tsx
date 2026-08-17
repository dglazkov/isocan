import type { ReactNode } from "react";
import { type Tool, useUiStore } from "../stores/uiStore.ts";

/**
 * The tool rail (right edge): the pointer's mode, Figma-style. Select is the
 * default (click + marquee); Hand pans on drag (also momentary while Space is
 * held); Comment drops pins. The active tool is the store's `activeTool`; each
 * answers to a letter — Select=V, Hand=H, Zoom=Z, Comment=C — and Esc returns
 * to Select. (Version fan-out, once on V, lives on an item's version badge.)
 */

interface ToolDef {
  tool: Tool;
  label: string;
  hint: string;
  icon: ReactNode;
}

const CURSOR = (
  <svg viewBox="0 0 16 16" width="17" height="17" aria-hidden>
    <path
      d="M3 2.5 12.5 8l-4.2 1-2 4z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinejoin="round"
    />
  </svg>
);

const HAND = (
  <svg viewBox="0 0 16 16" width="17" height="17" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round">
    <path d="M5 8V4.2a1 1 0 0 1 2 0V7m0 0V3.2a1 1 0 0 1 2 0V7m0 0V4.2a1 1 0 0 1 2 0V8m0-1.3a1 1 0 0 1 2 0V10c0 2.2-1.8 4-4 4H8.6c-1 0-2-.5-2.7-1.3L3 9.4a1 1 0 0 1 1.5-1.3L5.6 9.2" />
  </svg>
);

const COMMENT = (
  <svg viewBox="0 0 16 16" width="17" height="17" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round">
    <path d="M2.5 4.5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H7l-3 3v-3h-.5a2 2 0 0 1-2-2z" />
  </svg>
);

const ZOOM = (
  <svg viewBox="0 0 16 16" width="17" height="17" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
    <circle cx="7" cy="7" r="4.2" />
    <path d="M10.2 10.2 14 14M7 5.2v3.6M5.2 7h3.6" />
  </svg>
);

const TOOLS: ToolDef[] = [
  { tool: "select", label: "Select", hint: "Select — V", icon: CURSOR },
  { tool: "hand", label: "Hand", hint: "Hand — H (or hold Space)", icon: HAND },
  { tool: "zoom", label: "Zoom", hint: "Zoom — Z (tap to latch, hold to zoom a region)", icon: ZOOM },
  { tool: "comment", label: "Comment", hint: "Comment — C", icon: COMMENT },
];

export function CanvasTools() {
  const activeTool = useUiStore((s) => s.activeTool);
  const setActiveTool = useUiStore((s) => s.setActiveTool);
  return (
    <div className="tool-rail" role="toolbar" aria-label="Canvas tools" aria-orientation="vertical">
      {TOOLS.map((t) => (
        <button
          key={t.tool}
          className={`tool-btn${activeTool === t.tool ? " active" : ""}`}
          title={t.hint}
          aria-label={t.label}
          aria-pressed={activeTool === t.tool}
          onClick={() => setActiveTool(t.tool)}
        >
          {t.icon}
        </button>
      ))}
    </div>
  );
}
