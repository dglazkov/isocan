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
export declare const PROJECT_TABS_STORAGE_KEY = "isocan.openTabs.v1";
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
export declare function emptyProjectTabs(): ProjectTabsState;
/**
 * Open a canvas tab: if `input.id` is already open, activate it in place and
 * refresh its title; otherwise append it and activate it.
 */
export declare function openProjectTab(state: ProjectTabsState, input: OpenProjectTabInput): ProjectTabsState;
/**
 * Close a canvas tab. If it was active, selects its right neighbour (or left
 * neighbour when closing the last tab, or `null` for Home when none remain).
 */
export declare function closeProjectTab(state: ProjectTabsState, id: string): ProjectTabsState;
/** Switch the active tab (`null` returns to Home; unknown ids are ignored). */
export declare function activateProjectTab(state: ProjectTabsState, id: string | null): ProjectTabsState;
/** Rename an open tab in place (blank titles are ignored). */
export declare function renameProjectTab(state: ProjectTabsState, id: string, title: string): ProjectTabsState;
/** Update the live activity indicator (`idle | saving | working | unread`) on a tab. */
export declare function setProjectTabActivity(state: ProjectTabsState, id: string, activity: TabActivity): ProjectTabsState;
/** Move the tab at `fromIndex` to `toIndex`, preserving active selection. */
export declare function reorderProjectTab(state: ProjectTabsState, fromIndex: number, toIndex: number): ProjectTabsState;
/**
 * Compute the next focused tab id when moving with Left (`-1`) or Right (`1`)
 * arrow keys inside `role="tablist"`. Wraps around cleanly.
 */
export declare function focusNextProjectTab(state: ProjectTabsState, currentId: string | null, direction: 1 | -1): string | null;
/** Serialize open tabs and order for persistence in `localStorage["isocan.openTabs.v1"]`. */
export declare function serializeProjectTabs(state: ProjectTabsState): string;
/**
 * Restore open tabs from a stored JSON string. Corrupt payloads return an empty
 * state, duplicate ids are dropped, and activity resets to `"idle"`.
 */
export declare function parseProjectTabs(raw: string | null | undefined): ProjectTabsState;
export {};
