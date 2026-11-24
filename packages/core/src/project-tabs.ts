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

/**
 * **Project tabs state machine (`@isocan/core/project-tabs`).**
 *
 * Pure, dependency-free tab strip state for the top navigation pill: open,
 * close (selecting the neighbouring tab or returning Home), rename, activity
 * indicators, reorder, keyboard arrow-key focus traversal, and safe
 * serialization to `localStorage["isocan.openTabs.v1"]`.
 */

/** Browser storage key persisting open project tabs and their order. */
export const PROJECT_TABS_STORAGE_KEY = "isocan.openTabs.v1";

/** Live activity state shown on a project tab pill. */
export type TabActivity = "idle" | "saving" | "working" | "unread";

/** One open canvas tab in the top navigation bar. */
interface ProjectTab {
  readonly id: string;
  readonly title: string;
  readonly activity: TabActivity;
  readonly lastVisitedAt?: number;
}

/** Complete state of the top navigation project tab strip (`activeId === null` is Home). */
export interface ProjectTabsState {
  readonly tabs: readonly ProjectTab[];
  readonly activeId: string | null;
}

/** Input when opening or updating a project tab. */
interface OpenProjectTabInput {
  readonly id: string;
  readonly title: string;
  readonly activity?: TabActivity;
  readonly now?: number;
}

/** Create an empty project tabs state focused on Home. */
export function emptyProjectTabs(): ProjectTabsState {
  return { tabs: [], activeId: null };
}

/**
 * Open a canvas tab: if `input.id` is already open, activate it in place and
 * refresh its title; otherwise append it and activate it.
 */
export function openProjectTab(state: ProjectTabsState, input: OpenProjectTabInput): ProjectTabsState {
  const id = input.id.trim();
  if (!id) return state;
  const title = input.title.trim() || "Untitled";
  const existingIndex = state.tabs.findIndex((tab) => tab.id === id);
  if (existingIndex >= 0) {
    const existing = state.tabs[existingIndex]!;
    const updated: ProjectTab = {
      ...existing,
      title,
      activity: input.activity ?? existing.activity,
      ...(input.now !== undefined ? { lastVisitedAt: input.now } : {}),
    };
    const nextTabs = state.tabs.map((tab, i) => (i === existingIndex ? updated : tab));
    return { tabs: nextTabs, activeId: id };
  }
  const added: ProjectTab = {
    id,
    title,
    activity: input.activity ?? "idle",
    ...(input.now !== undefined ? { lastVisitedAt: input.now } : {}),
  };
  return { tabs: [...state.tabs, added], activeId: id };
}

/**
 * Close a canvas tab. If it was active, selects its right neighbour (or left
 * neighbour when closing the last tab, or `null` for Home when none remain).
 */
export function closeProjectTab(state: ProjectTabsState, id: string): ProjectTabsState {
  const index = state.tabs.findIndex((tab) => tab.id === id);
  if (index < 0) return state;
  const nextTabs = state.tabs.filter((tab) => tab.id !== id);
  if (state.activeId !== id) {
    return { tabs: nextTabs, activeId: state.activeId };
  }
  const neighbour = nextTabs[index] ?? nextTabs[index - 1] ?? null;
  return { tabs: nextTabs, activeId: neighbour ? neighbour.id : null };
}

/** Switch the active tab (`null` returns to Home; unknown ids are ignored). */
export function activateProjectTab(state: ProjectTabsState, id: string | null): ProjectTabsState {
  if (id === null) return { ...state, activeId: null };
  if (!state.tabs.some((tab) => tab.id === id)) return state;
  return { ...state, activeId: id };
}

/** Rename an open tab in place (blank titles are ignored). */
export function renameProjectTab(state: ProjectTabsState, id: string, title: string): ProjectTabsState {
  const trimmed = title.trim();
  if (!trimmed) return state;
  let changed = false;
  const nextTabs = state.tabs.map((tab) => {
    if (tab.id !== id || tab.title === trimmed) return tab;
    changed = true;
    return { ...tab, title: trimmed };
  });
  return changed ? { ...state, tabs: nextTabs } : state;
}

/** Update the live activity indicator (`idle | saving | working | unread`) on a tab. */
export function setProjectTabActivity(state: ProjectTabsState, id: string, activity: TabActivity): ProjectTabsState {
  let changed = false;
  const nextTabs = state.tabs.map((tab) => {
    if (tab.id !== id || tab.activity === activity) return tab;
    changed = true;
    return { ...tab, activity };
  });
  return changed ? { ...state, tabs: nextTabs } : state;
}

/** Move the tab at `fromIndex` to `toIndex`, preserving active selection. */
export function reorderProjectTab(state: ProjectTabsState, fromIndex: number, toIndex: number): ProjectTabsState {
  const count = state.tabs.length;
  if (fromIndex < 0 || fromIndex >= count || toIndex < 0 || toIndex >= count || fromIndex === toIndex) {
    return state;
  }
  const nextTabs = [...state.tabs];
  const [moved] = nextTabs.splice(fromIndex, 1);
  if (!moved) return state;
  nextTabs.splice(toIndex, 0, moved);
  return { ...state, tabs: nextTabs };
}

/**
 * Compute the next focused tab id when moving with Left (`-1`) or Right (`1`)
 * arrow keys inside `role="tablist"`. Wraps around cleanly.
 */
export function focusNextProjectTab(
  state: ProjectTabsState,
  currentId: string | null,
  direction: 1 | -1,
): string | null {
  const count = state.tabs.length;
  if (count === 0) return null;
  const currentIndex = currentId === null ? -1 : state.tabs.findIndex((tab) => tab.id === currentId);
  if (currentIndex < 0) {
    return direction === 1 ? state.tabs[0]!.id : state.tabs[count - 1]!.id;
  }
  const nextIndex = (currentIndex + direction + count) % count;
  return state.tabs[nextIndex]!.id;
}

/** Serialize open tabs and order for persistence in `localStorage["isocan.openTabs.v1"]`. */
export function serializeProjectTabs(state: ProjectTabsState): string {
  const payload = {
    v: 1,
    activeId: state.activeId,
    tabs: state.tabs.map((tab) => ({
      id: tab.id,
      title: tab.title,
      ...(tab.lastVisitedAt !== undefined ? { lastVisitedAt: tab.lastVisitedAt } : {}),
    })),
  };
  return JSON.stringify(payload);
}

/**
 * Restore open tabs from a stored JSON string. Corrupt payloads return an empty
 * state, duplicate ids are dropped, and activity resets to `"idle"`.
 */
export function parseProjectTabs(raw: string | null | undefined): ProjectTabsState {
  if (!raw) return emptyProjectTabs();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return emptyProjectTabs();
    const record = parsed as { tabs?: unknown; activeId?: unknown };
    if (!Array.isArray(record.tabs)) return emptyProjectTabs();
    const seen = new Set<string>();
    const tabs: ProjectTab[] = [];
    for (const item of record.tabs) {
      if (!item || typeof item !== "object") continue;
      const entry = item as { id?: unknown; title?: unknown; lastVisitedAt?: unknown };
      if (typeof entry.id !== "string") continue;
      const id = entry.id.trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const title = typeof entry.title === "string" && entry.title.trim() ? entry.title.trim() : "Untitled";
      const lastVisitedAt = typeof entry.lastVisitedAt === "number" && Number.isFinite(entry.lastVisitedAt)
        ? entry.lastVisitedAt
        : undefined;
      tabs.push({
        id,
        title,
        activity: "idle",
        ...(lastVisitedAt !== undefined ? { lastVisitedAt } : {}),
      });
    }
    const rawActive = typeof record.activeId === "string" ? record.activeId : null;
    const activeId = rawActive && seen.has(rawActive) ? rawActive : null;
    return { tabs, activeId };
  } catch {
    return emptyProjectTabs();
  }
}
