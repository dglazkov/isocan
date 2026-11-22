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

import "./TopNav.css";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

const SettingsShell = lazy(() => import("./SettingsShell.tsx"));
import { useLocation, useMatch, useNavigate } from "react-router-dom";
import {
  CANVAS_ROUTE,
  MODULE_PAGE_ROUTE,
  MOTION_RENDER_ROUTE,
  canvasPath,
  newCanvasId,
  newSince,
  type Actor,
} from "@isocan/core";
import {
  PROJECT_TABS_STORAGE_KEY,
  activateProjectTab,
  closeProjectTab,
  focusNextProjectTab,
  openProjectTab,
  parseProjectTabs,
  renameProjectTab,
  serializeProjectTabs,
  setProjectTabActivity,
  type ProjectTabsState,
  type TabActivity,
} from "@isocan/core/project-tabs";
import { sendOp } from "../../lib/api.ts";
import { useCanvasStore } from "../../stores/canvasStore.ts";
import { useInboxStore } from "../../stores/inboxStore.ts";
import { useUiStore } from "../../stores/uiStore.ts";
import { HomeGlyph } from "../Glyphs.tsx";

function loadStoredTabs(): ProjectTabsState {
  try {
    return parseProjectTabs(localStorage.getItem(PROJECT_TABS_STORAGE_KEY));
  } catch {
    return parseProjectTabs(null);
  }
}

function saveStoredTabs(state: ProjectTabsState): void {
  try {
    localStorage.setItem(PROJECT_TABS_STORAGE_KEY, serializeProjectTabs(state));
  } catch {
    // Storage unavailable (private mode); keep tabs in memory for this session.
  }
}

/** Props for the lazy Stitch top navigation pill. */
export interface TopNavProps {
  actor: Actor;
  /** Optional right-cluster controls mounted inside the top pill. */
  rightSlot?: ReactNode;
  /** Optional controlled initial tab state (useful in tests). */
  initialState?: ProjectTabsState;
  /** Optional navigation override (defaults to react-router `navigate`). */
  onNavigate?: (path: string) => void;
  /** Optional create-canvas handler override. */
  onCreateCanvas?: () => Promise<{ id: string; title: string } | null>;
  /** Optional rename handler override. */
  onRenameCanvas?: (id: string, title: string) => Promise<void> | void;
  /** When true, creating a new canvas via `+` seeds the Welcome to Open Stitch card. */
  seedWelcome?: boolean;
}

/**
 * Compact Stitch-pill top navigation bar with persistent closable project tabs,
 * live activity marks, inline rename, keyboard arrow traversal, `+` new canvas,
 * and Hide-UI restore affordance.
 */
export function TopNav({
  actor,
  rightSlot,
  initialState,
  onNavigate,
  onCreateCanvas,
  onRenameCanvas,
  seedWelcome = false,
}: TopNavProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const canvasMatch = useMatch(`${CANVAS_ROUTE}/*`);
  const onModulePage = Boolean(useMatch(MODULE_PAGE_ROUTE));
  const onMotionRender = Boolean(useMatch(MOTION_RENDER_ROUTE));

  const activeCanvasId = canvasMatch?.params.canvasId ?? null;
  const record = useCanvasStore((s) => s.record);
  const queueLen = useCanvasStore((s) => s.queue.length);
  const sessions = useCanvasStore((s) => s.sessions);
  const capability = useCanvasStore((s) => s.capability);

  const inbox = useInboxStore((s) => (s.actorId === actor.id ? s.data : null));
  const uiHidden = useUiStore((s) => s.uiHidden);
  const toggleUiHidden = useUiStore((s) => s.toggleUiHidden);
  const setUiHidden = useUiStore((s) => s.setUiHidden);
  const setPaletteOpen = useUiStore((s) => s.setPaletteOpen);

  const [tabsState, setTabsState] = useState<ProjectTabsState>(() => initialState ?? loadStoredTabs());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const tabRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const go = useCallback(
    (path: string) => {
      if (onNavigate) onNavigate(path);
      else navigate(path);
    },
    [navigate, onNavigate],
  );

  const commitTabs = useCallback((updater: (prev: ProjectTabsState) => ProjectTabsState) => {
    setTabsState((prev) => {
      const next = updater(prev);
      saveStoredTabs(next);
      return next;
    });
  }, []);

  // Sync the currently open canvas route + record title into the persistent tab strip.
  const recordId = record?.id;
  const recordTitle = record?.title;
  useEffect(() => {
    if (pathname === "/") {
      commitTabs((prev) => (prev.activeId === null ? prev : activateProjectTab(prev, null)));
      return;
    }
    if (!activeCanvasId) return;
    const title = recordId === activeCanvasId ? recordTitle ?? null : null;
    commitTabs((prev) => {
      const existing = prev.tabs.find((t) => t.id === activeCanvasId);
      const nextTitle = title ?? existing?.title ?? "Untitled";
      if (existing && prev.activeId === activeCanvasId && existing.title === nextTitle) return prev;
      return openProjectTab(prev, { id: activeCanvasId, title: nextTitle, now: Date.now() });
    });
  }, [activeCanvasId, pathname, recordId, recordTitle, commitTabs]);

  // Reflect live saving / working / unread activity states onto open tabs.
  const unreadCanvases = useMemo(() => {
    if (!inbox) return new Set<string>();
    return new Set(newSince(inbox.entries, inbox.marks).map((entry) => entry.canvasId));
  }, [inbox]);

  const activeWorking = useMemo(
    () => sessions.some((session) => Boolean(session.status) || session.actor.id !== actor.id && Boolean(session.label)),
    [sessions, actor.id],
  );

  useEffect(() => {
    setTabsState((prev) => {
      let next = prev;
      for (const tab of prev.tabs) {
        let activity: TabActivity = "idle";
        if (tab.id === activeCanvasId && queueLen > 0) {
          activity = "saving";
        } else if (tab.id === activeCanvasId && activeWorking) {
          activity = "working";
        } else if (unreadCanvases.has(tab.id)) {
          activity = "unread";
        }
        next = setProjectTabActivity(next, tab.id, activity);
      }
      return next;
    });
  }, [activeCanvasId, queueLen, activeWorking, unreadCanvases]);

  if (onMotionRender || onModulePage || capability === "view") return null;

  if (uiHidden) {
    return (
      <button
        type="button"
        className="shell-restore-ui"
        title="Show interface (⌘\ or Esc)"
        aria-label="Show interface"
        onClick={() => setUiHidden(false)}
      >
        Show UI · ⌘\
      </button>
    );
  }

  // Only show the tab pill once at least one tab is open (or when rightSlot is provided).
  if (tabsState.tabs.length === 0 && !rightSlot && pathname === "/") return null;

  function handleSelectTab(id: string): void {
    commitTabs((prev) => activateProjectTab(prev, id));
    go(canvasPath(id));
  }

  function handleCloseTab(id: string): void {
    const next = closeProjectTab(tabsState, id);
    setTabsState(next);
    saveStoredTabs(next);
    if (tabsState.activeId === id) {
      go(next.activeId ? canvasPath(next.activeId) : "/");
    }
  }

  async function handleNewCanvas(): Promise<void> {
    if (creating) return;
    setCreating(true);
    try {
      if (onCreateCanvas) {
        const created = await onCreateCanvas();
        if (created) {
          commitTabs((prev) => openProjectTab(prev, { id: created.id, title: created.title, now: Date.now() }));
          go(canvasPath(created.id));
        }
        return;
      }
      const canvasId = newCanvasId();
      const title = "Untitled";
      await sendOp(null, actor, { type: "project.create", canvasId, title });
      if (seedWelcome) {
        const { seedWelcomeItem } = await import("./welcomeSeed.ts");
        await seedWelcomeItem(canvasId, actor).catch(() => {});
      }
      commitTabs((prev) => openProjectTab(prev, { id: canvasId, title, now: Date.now() }));
      go(canvasPath(canvasId));
    } finally {
      setCreating(false);
    }
  }

  async function commitRename(id: string): Promise<void> {
    const trimmed = draftTitle.trim();
    setEditingId(null);
    if (!trimmed) return;
    commitTabs((prev) => renameProjectTab(prev, id, trimmed));
    if (onRenameCanvas) {
      await onRenameCanvas(id, trimmed);
    } else {
      await sendOp(id, actor, { type: "project.update", patch: { title: trimmed } }).catch(() => {});
    }
  }

  function onTabKeyDown(e: KeyboardEvent<HTMLDivElement>, tabId: string): void {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const targetId = focusNextProjectTab(tabsState, tabId, e.key === "ArrowRight" ? 1 : -1);
      if (targetId) {
        tabRefs.current.get(targetId)?.focus();
      }
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleSelectTab(tabId);
    }
  }

  return (
    <>
    <div className="shell-topnav-wrap">
      <nav className="shell-topnav" aria-label="Open canvases">
        <button
          type="button"
          className={`shell-topnav-btn${tabsState.activeId === null ? " active" : ""}`}
          title="Home — all canvases"
          aria-label="Home"
          onClick={() => {
            commitTabs((prev) => activateProjectTab(prev, null));
            go("/");
          }}
        >
          <HomeGlyph size={14} />
        </button>

        <div className="shell-topnav-tablist" role="tablist" aria-label="Canvas tabs">
          {tabsState.tabs.map((tab) => {
            const active = tabsState.activeId === tab.id;
            const editing = editingId === tab.id;
            return (
              <div
                key={tab.id}
                ref={(el) => {
                  if (el) tabRefs.current.set(tab.id, el);
                  else tabRefs.current.delete(tab.id);
                }}
                role="tab"
                tabIndex={active ? 0 : -1}
                aria-selected={active}
                className={`shell-tab${active ? " active" : ""}`}
                onClick={() => {
                  if (!editing) handleSelectTab(tab.id);
                }}
                onDoubleClick={() => {
                  setEditingId(tab.id);
                  setDraftTitle(tab.title);
                }}
                onKeyDown={(e) => {
                  if (!editing) onTabKeyDown(e, tab.id);
                }}
              >
                {tab.activity !== "idle" && (
                  <span
                    className="shell-tab-dot"
                    data-activity={tab.activity}
                    title={tab.activity}
                    aria-label={tab.activity}
                  />
                )}
                {editing ? (
                  <input
                    className="shell-tab-rename"
                    aria-label="Rename canvas tab"
                    value={draftTitle}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    onBlur={() => void commitRename(tab.id)}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter") void commitRename(tab.id);
                      else if (e.key === "Escape") setEditingId(null);
                    }}
                  />
                ) : (
                  <span className="shell-tab-title">{tab.title}</span>
                )}
                <button
                  type="button"
                  className="shell-tab-close"
                  title={`Close ${tab.title}`}
                  aria-label={`Close ${tab.title}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCloseTab(tab.id);
                  }}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          className="shell-topnav-btn"
          title="New canvas"
          aria-label="New canvas"
          disabled={creating}
          onClick={() => void handleNewCanvas()}
        >
          +
        </button>

        <div className="shell-topnav-right">
          <button
            type="button"
            className="shell-topnav-btn"
            title="Command launcher (⌘K)"
            aria-label="Command launcher"
            onClick={() => setPaletteOpen("commands")}
          >
            ⌘K
          </button>
          <button
            type="button"
            className="shell-topnav-btn"
            title="Settings"
            aria-label="Settings"
            onClick={() => setSettingsOpen(true)}
          >
            Settings
          </button>
          <button
            type="button"
            className="shell-topnav-btn"
            title="Hide interface (⌘\)"
            aria-label="Hide interface"
            onClick={() => toggleUiHidden()}
          >
            ⌘\
          </button>
          {rightSlot}
        </div>
      </nav>
    </div>
    {settingsOpen && (
      <Suspense fallback={null}>
        <SettingsShell open={settingsOpen} actor={actor} onClose={() => setSettingsOpen(false)} />
      </Suspense>
    )}
    </>
  );
}

export default TopNav;
