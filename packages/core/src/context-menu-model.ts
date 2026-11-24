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

import type { BuiltinKind } from "./kinds.ts";
import { keyFor } from "./shortcuts.ts";

/** Target clicked when opening a context menu: a built-in/module kind, a group, or the bare pane. */
type ContextMenuTargetKind = BuiltinKind | "group" | "pane" | (string & {});

/** Logical section divider for grouping context menu entries. */
type ContextMenuGroup = "edit" | "copy" | "size" | "group" | "view";

/** Canonical identifier for each context-menu action. */
type ContextMenuActionId =
  | "rename"
  | "view"
  | "edit"
  | "copy"
  | "duplicate"
  | "paste"
  | "select-all"
  | "download"
  | "actual-size"
  | "fit-content"
  | "group"
  | "ungroup"
  | "auto-layout"
  | "remove-from-group"
  | "tidy"
  | "stack"
  | "spread"
  | "delete";

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

function action(
  id: ContextMenuActionId,
  label: string,
  group: ContextMenuGroup,
  shortcutDoes?: string,
  cliVerb?: string,
): ContextMenuAction {
  const shortcut = shortcutDoes ? keyFor(shortcutDoes) ?? undefined : undefined;
  return {
    id,
    label,
    group,
    ...(shortcut !== undefined ? { shortcut } : {}),
    ...(cliVerb !== undefined ? { cliVerb } : {}),
  };
}

/**
 * Build the list of applicable context-menu actions for a right-click target.
 *
 * Never emits disabled/greyed actions: if an action does not apply to the
 * current target and selection, it is omitted.
 */
export function buildContextMenuModel(input: ContextMenuInput): ContextMenuAction[] {
  const { targetKind, selectionCount } = input;

  // Bare pane (or empty selection): only pane-level verbs apply.
  if (targetKind === "pane" || selectionCount <= 0) {
    const pane: ContextMenuAction[] = [];
    if (input.hasClipboard) {
      pane.push(action("paste", "Paste", "copy", "Paste", "copy"));
    }
    pane.push(action("select-all", "Select all", "view"));
    return pane;
  }

  const single = selectionCount === 1;
  const isGroup = targetKind === "group";
  const actions: ContextMenuAction[] = [];

  if (single) {
    actions.push(action("rename", "Rename", "edit", "Rename", "set"));
    if (!isGroup) {
      actions.push(action("view", "View", "view", "View the selection", "get"));
    }
    const editable =
      input.isEditableText === true ||
      (input.isEditableText === undefined &&
        (targetKind === "text" || targetKind === "document" || targetKind === "screen"));
    if (editable) {
      actions.push(action("edit", "Edit", "edit", "Edit the selection", "edit"));
    }
  }

  actions.push(action("copy", "Copy", "copy", "Copy the selection", "copy"));
  actions.push(action("duplicate", "Duplicate", "copy", undefined, "copy"));

  if (single && !isGroup && targetKind !== "canvas") {
    actions.push(action("download", "Download", "copy", "Download", "get"));
  }

  const naturalEligible =
    input.hasNaturalSize === true ||
    (input.hasNaturalSize === undefined &&
      (targetKind === "image" || targetKind === "video" || targetKind === "screen"));
  if (single && !isGroup && naturalEligible) {
    actions.push(action("actual-size", "Actual size (100%)", "size", undefined, "set"));
  }

  if (isGroup || targetKind === "text" || targetKind === "document") {
    actions.push(action("fit-content", "Fit to content", "size", "Fit the item to its content", "fit"));
  }

  if (selectionCount >= 2 || (single && !isGroup)) {
    actions.push(action("group", "Group", "group", "Group selection", "canvas group wrap"));
  }

  if (isGroup) {
    actions.push(action("ungroup", "Ungroup", "group", "Ungroup", "canvas group ungroup"));
    if (input.isStacked) {
      actions.push(action("spread", "Spread group", "group", "Stack or spread the group", "canvas group stack"));
    } else {
      actions.push(action("stack", "Stack group", "group", "Stack or spread the group", "canvas group stack"));
    }
  }

  if (isGroup || selectionCount >= 2) {
    actions.push(action("auto-layout", "Auto layout", "group", undefined, "canvas group layout"));
    actions.push(action("tidy", "Tidy", "group", undefined, "tidy"));
  }

  if (input.inGroup) {
    actions.push(action("remove-from-group", "Remove from group", "group", undefined, "canvas group remove"));
  }

  actions.push(action("delete", "Delete", "edit", "Move the selection to the trash", "rm"));

  return actions;
}
