/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import "./AgentDock.css";
import { useMemo, useState, type CSSProperties } from "react";
import { roster, type Actor } from "@isocan/core";

/** Row shape returned by `@isocan/core`'s `roster()`. */
export type AgentDockRow = ReturnType<typeof roster>[number];
import { useCanvasStore } from "../../stores/canvasStore.ts";
import {
  agentDockSideFor,
  usePanelGeometry,
  usePromptDockPreference,
  type PromptDock,
} from "./usePanelGeometry.ts";

/** Accordion section keys inside `AgentDock` (OS1 ADR 0256). */
export type AgentDockSection = "notifications" | "agents" | null;

/** LocalStorage key persisting `AgentDock` custom pointer-dragged geometry. */
export const AGENT_DOCK_GEOMETRY_KEY = "isocan.shell.agentDockGeometry.v1";

export interface AgentDockNotification {
  id: string;
  title: string;
  detail?: string;
  unread?: boolean;
}

export interface AgentDockProps {
  canvasId: string;
  actor: Actor;
  /** Optional canvas title override (defaults to `canvasStore.record.title`). */
  orientationTitle?: string;
  /** Initial open accordion section (`'notifications' | 'agents' | null`). */
  initialSection?: AgentDockSection;
  /** Optional prompt dock override; otherwise follows shared `PromptDock` preference. */
  promptDock?: PromptDock;
  /** Optional roster rows override (defaults to core `roster()`). */
  rows?: readonly AgentDockRow[];
  /** Optional notifications list shown in the Notifications accordion. */
  notifications?: readonly AgentDockNotification[];
  /** Called when a notification row is activated. */
  onSelectNotification?: (id: string) => void;
  /** Called when an agent row is activated (e.g. follow/focus). */
  onSelectAgent?: (actorId: string) => void;
}

/**
 * Single top-right Stitch anchor stacking an orientation header, notifications
 * section, and live agent roster accordion (`openSection: 'notifications' | 'agents' | null`),
 * docking opposite a side-docked prompt bar with pointer-captured geometry
 * persistence (OS1 ADR 0256).
 */
export function AgentDock({
  actor,
  orientationTitle,
  initialSection = null,
  promptDock: promptDockOverride,
  rows: rowsOverride,
  notifications = [],
  onSelectNotification,
  onSelectAgent,
}: AgentDockProps) {
  const [storedPromptDock] = usePromptDockPreference();
  const promptDock = promptDockOverride ?? storedPromptDock;
  const dockSide = agentDockSideFor(promptDock);

  const [openSection, setOpenSection] = useState<AgentDockSection>(initialSection);
  const record = useCanvasStore((s) => s.record);
  const canvas = useCanvasStore((s) => s.canvas);
  const sessions = useCanvasStore((s) => s.sessions);

  const rows = useMemo<readonly AgentDockRow[]>(() => {
    if (rowsOverride) return rowsOverride;
    return roster(sessions, canvas, Date.now()).filter(
      (row) => !(row.state === "away" && row.actorId === actor.id),
    );
  }, [rowsOverride, sessions, canvas, actor.id]);

  const panel = usePanelGeometry({
    storageKey: AGENT_DOCK_GEOMETRY_KEY,
    defaults: { x: 960, y: 64, width: 300, height: 320 },
    minWidth: 240,
    maxWidth: 480,
    minHeight: 140,
    maxHeight: 680,
  });

  const title = orientationTitle ?? record?.title ?? "Canvas";
  const workingCount = rows.filter((r) => r.state === "working").length;
  const unreadCount = notifications.filter((n) => n.unread !== false).length;

  function toggleSection(section: Exclude<AgentDockSection, null>): void {
    setOpenSection((prev) => (prev === section ? null : section));
  }

  const customStyle: CSSProperties | undefined = panel.customized
    ? {
        left: panel.geometry.x,
        top: panel.geometry.y,
        width: panel.geometry.width,
        maxHeight: panel.geometry.height,
      }
    : undefined;

  return (
    <aside
      className="shell-agent-dock"
      aria-label="Agent dock"
      data-side={dockSide}
      data-open-section={openSection ?? "none"}
      data-custom-geometry={panel.customized ? "true" : "false"}
      style={customStyle}
    >
      <header
        className="shell-agent-dock-header"
        onPointerDown={panel.onDragPointerDown}
        title="Drag to reposition dock"
      >
        <div className="shell-agent-dock-orient">
          <span className="shell-agent-dock-title">{title}</span>
          <span className="shell-agent-dock-sub">
            {workingCount > 0
              ? `${workingCount} working · ${rows.length} agent${rows.length === 1 ? "" : "s"}`
              : `${rows.length} agent${rows.length === 1 ? "" : "s"} on canvas`}
          </span>
        </div>
        <div className="shell-agent-dock-actions">
          {panel.customized && (
            <button
              type="button"
              className="shell-agent-dock-reset"
              aria-label="Reset dock position"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={panel.reset}
            >
              Reset
            </button>
          )}
        </div>
      </header>

      <section className="shell-agent-dock-section" aria-label="Notifications">
        <button
          type="button"
          className="shell-agent-dock-trigger"
          aria-expanded={openSection === "notifications"}
          onClick={() => toggleSection("notifications")}
        >
          <span>{openSection === "notifications" ? "▾" : "▸"} Notifications</span>
          <span className="shell-agent-dock-badge">{unreadCount}</span>
        </button>
        {openSection === "notifications" && (
          <div className="shell-agent-dock-body" data-section="notifications">
            {notifications.length === 0 ? (
              <p className="shell-agent-dock-empty">Nothing waiting on you right now.</p>
            ) : (
              notifications.map((note) => (
                <button
                  key={note.id}
                  type="button"
                  className="shell-agent-dock-row"
                  onClick={() => onSelectNotification?.(note.id)}
                >
                  <span className="shell-agent-dock-row-main">
                    <span className="shell-agent-dock-row-name">{note.title}</span>
                    {note.detail && <span className="shell-agent-dock-row-meta">{note.detail}</span>}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </section>

      <section className="shell-agent-dock-section" aria-label="Agent roster">
        <button
          type="button"
          className="shell-agent-dock-trigger"
          aria-expanded={openSection === "agents"}
          onClick={() => toggleSection("agents")}
        >
          <span>{openSection === "agents" ? "▾" : "▸"} Agents</span>
          <span className="shell-agent-dock-badge">{rows.length}</span>
        </button>
        {openSection === "agents" && (
          <div className="shell-agent-dock-body" data-section="agents">
            {rows.length === 0 ? (
              <p className="shell-agent-dock-empty">No agents parked on this canvas yet.</p>
            ) : (
              rows.map((row) => (
                <button
                  key={row.actorId}
                  type="button"
                  className="shell-agent-dock-row"
                  onClick={() => onSelectAgent?.(row.actorId)}
                >
                  <span className="shell-agent-dock-row-main">
                    <span className="shell-agent-dock-row-name">{row.name}</span>
                    {row.primary?.status && (
                      <span className="shell-agent-dock-row-meta">{row.primary.status}</span>
                    )}
                  </span>
                  <span className="shell-agent-dock-state" data-state={row.state}>
                    {row.state}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </section>

      <div
        className="shell-agent-dock-resizer"
        aria-hidden="true"
        onPointerDown={panel.onResizePointerDown}
      />
    </aside>
  );
}

export default AgentDock;
