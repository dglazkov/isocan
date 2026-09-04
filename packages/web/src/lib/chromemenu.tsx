import type React from "react";
import { openContextMenu } from "../components/ContextMenu.tsx";
import { hideableEntry, hideChrome, useChromeHidden } from "./hideable.ts";

export { useChromeHidden };

/**
 * **Right-click a control → "Hide …"** — door 1 of chrome you can turn off.
 * The moment of irritation is the moment to act, and the menu says how to
 * get the thing back before it goes: *Hide undo and redo — ⌘Z still undoes;
 * Settings brings the buttons back*. The same context-menu component the
 * items use, over the registry entry under the pointer.
 */
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
