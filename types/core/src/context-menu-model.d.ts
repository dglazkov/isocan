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
 * **Pure context-menu model** (Open Stitch phase 1B).
 *
 * Computes the right-click menu purely from `(targetKind, selectionCount,
 * context flags)` under the **"hide, never grey"** rule: a list of disabled
 * verbs is noise, so actions that do not apply are omitted altogether rather
 * than shown disabled. Every returned entry carries its canonical shortcut
 * (from `shortcuts.ts`) and CLI verb so menus, keys, and agents stay in lockstep.
 */
import type { BuiltinKind } from "./kinds.js";
/** Target clicked when opening a context menu: a built-in/module kind, a group, or the bare pane. */
type ContextMenuTargetKind = BuiltinKind | "group" | "pane" | (string & {});
/** Logical section divider for grouping context menu entries. */
type ContextMenuGroup = "edit" | "copy" | "size" | "group" | "view";
/** Canonical identifier for each context-menu action. */
type ContextMenuActionId = "rename" | "view" | "edit" | "copy" | "duplicate" | "paste" | "select-all" | "download" | "actual-size" | "fit-content" | "group" | "ungroup" | "auto-layout" | "remove-from-group" | "tidy" | "stack" | "spread" | "delete";
/** One applicable (always enabled) context menu item. */
interface ContextMenuAction {
    id: ContextMenuActionId;
    label: string;
    group: ContextMenuGroup;
    /** Canonical shortcut label read from `SHORTCUTS`, when one exists. */
    shortcut?: string;
    /** Corresponding CLI verb family for affordance parity. */
    cliVerb?: string;
}
/** Pure input snapshot describing what was right-clicked and the current selection state. */
interface ContextMenuInput {
    targetKind: ContextMenuTargetKind;
    selectionCount: number;
    /** True when the target (or selection) sits inside a parent group. */
    inGroup?: boolean;
    /** True when the clipboard currently holds pasteable canvas items. */
    hasClipboard?: boolean;
    /** True when the single target carries a natural pixel/viewport size for "Actual size". */
    hasNaturalSize?: boolean;
    /** True when a targeted group is currently stacked as a pile of cards. */
    isStacked?: boolean;
    /** True when the single target's content can be edited as text. */
    isEditableText?: boolean;
}
/**
 * Build the list of applicable context-menu actions for a right-click target.
 *
 * Never emits disabled/greyed actions: if an action does not apply to the
 * current target and selection, it is omitted.
 */
export declare function buildContextMenuModel(input: ContextMenuInput): ContextMenuAction[];
export {};
