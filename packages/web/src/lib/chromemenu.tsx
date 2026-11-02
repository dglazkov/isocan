import type React from "react";
import { openContextMenu } from "./contextmenu.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { HIDEABLE, hideableEntry, hideChrome, showChrome, useChromeHidden } from "./hideable.ts";
import { openUiDevtools, startUiPiecePicker } from "./uitweaks.ts";

export { useChromeHidden };

const CHROME_PIECES: readonly { selector: string; id: string; label: string; glass?: boolean }[] = [
  { selector: ".toolbar", id: "toolbar", label: "Top Bar", glass: true },
  { selector: ".tool-rail", id: "rail", label: "Tool Rail", glass: true },
  { selector: ".zoom-controls", id: "zoom", label: "Zoom & Undo", glass: true },
  { selector: ".minimap-dock", id: "minimap", label: "Minimap", glass: true },
  { selector: ".panel-head, .rail-strip, .marks header, .trash-panel header", id: "dock", label: "Chat & Docks", glass: true },
];

/**
 * **Right-click a control → "Hide …"** — door 1 of chrome you can turn off.
 * The moment of irritation is the moment to act, and the menu says how to
 * get the thing back before it goes: *Hide undo and redo — ⌘Z still undoes;
 * Settings brings the buttons back*. The same context-menu component the
 * items use, over the registry entry under the pointer.
 */
/**
 * **Right-click the area → "Show …"** — door 2. The zoom cluster's empty
 * edge, or the rail's gap, is itself the way back for somebody who
 * remembers roughly where the thing was. Offered only when something in
 * that area is hidden; otherwise the right-click is left alone, so an area
 * with nothing to show does not grow a menu that says nothing.
 */
export function showMenu(e: React.MouseEvent, where: string): void {
  const hidden = HIDEABLE.filter((entry) => entry.where === where && useUiStore.getState().hiddenChrome.includes(entry.id));
  if (hidden.length === 0) return;
  e.preventDefault();
  e.stopPropagation();
  openContextMenu(
    { x: e.clientX, y: e.clientY },
    hidden.map((entry) => ({ label: `Show ${entry.name.toLowerCase()}`, run: () => showChrome(entry.id) })),
  );
}

export function hideMenu(e: React.MouseEvent, id: string): void {
  const entry = hideableEntry(id);
  if (!entry) return;
  e.preventDefault();
  e.stopPropagation();
  const target = e.target instanceof Element ? e.target : null;
  const piece = CHROME_PIECES.find((p) => target?.closest(p.selector));
  openContextMenu({ x: e.clientX, y: e.clientY }, [
    {
      label: `Hide ${entry.name.toLowerCase()} — ${entry.stillReachable}`,
      run: () => hideChrome(id),
    },
    ...(piece
      ? [
          { separator: "" },
          { label: `Tweak ${piece.label}…`, run: () => openUiDevtools(piece.id) },
        ]
      : []),
  ]);
}

/** Context-menu handler for chrome regions that offer `"Tweak <Piece>…"` in UI Devtools. */
export function chromeTweakMenu(e: React.MouseEvent): void {
  const target = e.target instanceof Element ? e.target : null;
  if (!target || target.closest("input, textarea, select, [contenteditable='true']")) return;
  const piece = CHROME_PIECES.find((p) => target.closest(p.selector));
  if (!piece) return;

  const current = useUiStore.getState().contextMenu;
  if (e.defaultPrevented) {
    if (current && !current.entries.some((row) => "label" in row && row.label.startsWith("Tweak "))) {
      openContextMenu(current.at, [
        ...current.entries,
        { separator: "" },
        { label: `Tweak ${piece.label}…`, run: () => openUiDevtools(piece.id) },
      ]);
    }
    return;
  }

  e.preventDefault();
  e.stopPropagation();
  openContextMenu({ x: e.clientX, y: e.clientY }, [
    { label: `Tweak ${piece.label}…`, run: () => openUiDevtools(piece.id) },
    ...(piece.glass
      ? [{ label: "Tweak Floating Glass…", run: () => openUiDevtools("glass") }]
      : []),
    { separator: "" },
    { label: "Pick any piece to tweak…", run: () => startUiPiecePicker() },
  ]);
}
