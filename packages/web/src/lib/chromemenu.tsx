import type React from "react";
import { openContextMenu } from "../components/ContextMenu.tsx";
import { useUiStore } from "../stores/uiStore.ts";
import { HIDEABLE, hideableEntry, hideChrome, showChrome, useChromeHidden } from "./hideable.ts";

export { useChromeHidden };

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
  openContextMenu({ x: e.clientX, y: e.clientY }, [
    {
      label: `Hide ${entry.name.toLowerCase()} — ${entry.stillReachable}`,
      run: () => hideChrome(id),
    },
  ]);
}
