import type { MenuEntry } from "../components/ContextMenu.tsx";
import { useUiStore } from "../stores/uiStore.ts";

/**
 * Open and close from anywhere, the way the other popovers are driven.
 *
 * Its own file so that opening a menu does not pin the menu into the first
 * paint: the three callers are all eager, and while this lived beside the
 * component, a static import of it carried `ContextMenu` and `Submenu` into
 * every visit. The component now arrives on the first right-click.
 */
export function openContextMenu(at: { x: number; y: number }, entries: MenuEntry[]): void {
  useUiStore.getState().setContextMenu({ at, entries });
}
