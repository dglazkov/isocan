import { useEffect, useRef, type ReactNode } from "react";
import { keyFor } from "@isocan/core";
import { useUiStore } from "../stores/uiStore.ts";

/**
 * **Right-click: the acts you can already do, where your hand already is.**
 *
 * Every entry here is a door to something the canvas could already do — a
 * key, a double-click, a CLI verb — with two exceptions that a person expects
 * on a menu and would never think to ask for: **Download** and **Copy link**.
 * A menu is not a place to invent vocabulary; it is a place to stop requiring
 * people to have read the shortcut list.
 *
 * Which is why the accelerators are not spelled here. `keyFor` reads them
 * from `SHORTCUTS` in core — the same list the `?` overlay and
 * `isocan shortcuts` print — so a menu cannot promise a key that has been
 * rebound somewhere else. An act with no key simply shows none, which is most
 * of them.
 */

export interface MenuAction {
  label: string;
  /** The thing's own mark, where it has one. Only the rail's three panels do:
   *  an icon on every row would be decoration, and an icon on the rows that
   *  name a SURFACE is the same mark you will see on the surface when it
   *  opens. */
  icon?: ReactNode;
  /** The `does` text of the shortcut this act corresponds to, if it has one —
   *  the accelerator is looked up rather than written. */
  shortcutFor?: string;
  run: () => void;
  /** Offered but not available right now — shown, dimmed, so the menu's shape
   *  does not change under the pointer between one open and the next. */
  disabled?: boolean;
  danger?: boolean;
  /** This entry changes the canvas. On the read-only canvas (roles phase 1)
   *  it is not offered at all — not dimmed, because a reader is not "not
   *  right now", they are never — see `offered` in menuentries. */
  writes?: boolean;
}

export type MenuEntry = MenuAction | { separator: string };

export function ContextMenu({
  at,
  entries,
  onClose,
}: {
  at: { x: number; y: number };
  entries: MenuEntry[];
  onClose: () => void;
}): ReactNode {
  const box = useRef<HTMLDivElement | null>(null);
  /* Whether THIS menu has marks at all. If it does, the rows without one keep
     an empty slot so every label starts at the same x; if it does not — the
     right-click menu on an item — nothing is indented for a column that is
     not there. */
  const marks = entries.some((entry) => "icon" in entry && entry.icon !== undefined);

  useEffect(() => {
    // Anything that is not a press inside the menu closes it — including a
    // scroll or a second right-click, which are both ways of saying "not
    // this". Capture, because the canvas stops presses on the way down.
    function away(e: Event) {
      const el = box.current;
      if (el && e.target instanceof Node && el.contains(e.target)) return;
      onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation(); // Escape closes the menu, not the selection behind it
        onClose();
      }
    }
    document.addEventListener("pointerdown", away, true);
    document.addEventListener("wheel", away, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", away, true);
      document.removeEventListener("wheel", away, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [onClose]);

  /**
   * Kept on screen: a right-click near the bottom or the right edge would
   * otherwise open a menu half of which cannot be reached. Measured after
   * mount rather than guessed from a row count, because the entry list is not
   * fixed.
   */
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const overRight = r.right - (window.innerWidth - 8);
    const overBottom = r.bottom - (window.innerHeight - 8);
    if (overRight > 0) el.style.left = `${Math.max(8, at.x - overRight)}px`;
    if (overBottom > 0) el.style.top = `${Math.max(8, at.y - overBottom)}px`;
  }, [at.x, at.y, entries.length]);

  return (
    <div
      className={`context-menu${marks ? " has-icons" : ""}`}
      ref={box}
      role="menu"
      style={{ left: at.x, top: at.y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {entries.map((entry, i) =>
        "separator" in entry ? (
          <div className="context-sep" key={`sep-${i}`}>
            {entry.separator}
          </div>
        ) : (
          <button
            key={entry.label}
            role="menuitem"
            className={`context-item${entry.danger ? " danger" : ""}`}
            disabled={entry.disabled === true}
            onClick={() => {
              onClose();
              entry.run();
            }}
          >
            {marks && <span className="menu-icon">{entry.icon}</span>}
            <span>{entry.label}</span>
            {entry.shortcutFor && <kbd>{keyFor(entry.shortcutFor) ?? ""}</kbd>}
          </button>
        ),
      )}
    </div>
  );
}

/** Open and close from anywhere, the way the other popovers are driven. */
export function openContextMenu(at: { x: number; y: number }, entries: MenuEntry[]): void {
  useUiStore.getState().setContextMenu({ at, entries });
}
