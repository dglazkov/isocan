import { useEffect, useRef, useState, type ReactNode } from "react";
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
  /**
   * **A checkable row: on or off, rather than a thing that happens.**
   *
   * Distinct from a label that reads its own state ("Turn off cursor glow"),
   * and better where the row belongs to a SET — inside the background
   * submenu, "Sticky" with a tick says what is true now and what clicking
   * would change, without the label moving under the pointer.
   *
   * `undefined` means this row is not checkable at all, which is not the same
   * as `false`.
   */
  checked?: boolean;
  /**
   * **Rows that live under this one.** A row with a submenu does nothing
   * itself: `run` is not called, the children are the whole point, and the
   * parent shows the current choice beside its own name so the answer is
   * legible without opening it.
   */
  submenu?: MenuEntry[];
  /** What the parent row shows to the right of its label — the chosen one,
   *  where a submenu names a set with a current member. */
  value?: string;
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
        ) : entry.submenu ? (
          <Submenu key={entry.label} entry={entry} marks={marks} onClose={onClose} />
        ) : (
          <button
            key={entry.label}
            role={entry.checked === undefined ? "menuitem" : "menuitemcheckbox"}
            aria-checked={entry.checked === undefined ? undefined : entry.checked}
            className={`context-item${entry.danger ? " danger" : ""}${entry.checked === true ? " checked" : ""}`}
            disabled={entry.disabled === true}
            onClick={() => {
              onClose();
              entry.run();
            }}
          >
            {marks && <span className="menu-icon">{entry.icon}</span>}
            <span>{entry.label}</span>
            {/* The tick is the only thing on the row that says what is TRUE
                rather than what would happen, so it sits where the eye scans
                for state — after the words, before the accelerator. */}
            {entry.checked !== undefined && (
              <span className="menu-check" aria-hidden>
                {entry.checked ? "✓" : ""}
              </span>
            )}
            {entry.shortcutFor && <kbd>{keyFor(entry.shortcutFor) ?? ""}</kbd>}
          </button>
        ),
      )}
    </div>
  );
}

/**
 * **A row whose children open beside it.**
 *
 * The first nested menu in this app, and it is deliberately small. It opens on
 * hover AND on click, because those are two different people: a pointer that
 * drifts across the row expects it, and a person who has just tabbed to it
 * needs a key that works. It closes when the pointer leaves the pair, not the
 * row, or the children would vanish on the way to them.
 *
 * The parent shows the current member beside its own name (`value`), so the
 * answer to "what is it now" needs no opening — which is the whole reason this
 * shape beats the cycling row it replaces: a row that cycles makes you click
 * three times to see three options, and never shows you the set.
 */
function Submenu({
  entry,
  marks,
  onClose,
}: {
  entry: MenuAction;
  marks: boolean;
  onClose: () => void;
}): ReactNode {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement | null>(null);
  const children = entry.submenu ?? [];

  /**
   * **Kept on screen, the way the parent menu keeps itself** (7 Sep 2026).
   *
   * The parent has clamped itself since it was written; the child shipped
   * without it and it took looking at the thing to notice — a `···` menu
   * opened near the bottom of the window put "Sticky" on the edge, and a
   * canvas is a surface people right-click anywhere on.
   *
   * Flips to the LEFT rather than sliding, when there is no room to the
   * right: a submenu that slides ends up covering the row it belongs to, and
   * then the pointer leaving the child crosses the parent and re-opens it.
   * Vertically it slides, because nothing is covered by moving up.
   */
  useEffect(() => {
    const el = panel.current;
    if (!open || !el) return;
    el.style.left = "";
    el.style.right = "";
    el.style.top = "";
    const r = el.getBoundingClientRect();
    if (r.right > window.innerWidth - 8) {
      el.style.left = "auto";
      el.style.right = "calc(100% + 4px)";
    }
    const over = el.getBoundingClientRect().bottom - (window.innerHeight - 8);
    if (over > 0) el.style.top = `${-5 - over}px`;
  }, [open, children.length]);
  return (
    <div
      className="context-sub"
      onPointerEnter={() => setOpen(true)}
      onPointerLeave={() => setOpen(false)}
    >
      <button
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={open}
        className={`context-item${open ? " open" : ""}`}
        disabled={entry.disabled === true}
        onClick={() => setOpen((was) => !was)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "Enter" || e.key === " ") setOpen(true);
          if (e.key === "ArrowLeft") setOpen(false);
        }}
      >
        {marks && <span className="menu-icon">{entry.icon}</span>}
        <span>{entry.label}</span>
        {entry.value !== undefined && <span className="menu-value">{entry.value}</span>}
        <span className="menu-more" aria-hidden>
          ›
        </span>
      </button>
      {open && (
        <div className="context-menu context-submenu" role="menu" ref={panel}>
          {children.map((child, i) =>
            "separator" in child ? (
              <div className="context-sep" key={`sep-${i}`}>
                {child.separator}
              </div>
            ) : (
              <button
                key={child.label}
                role={child.checked === undefined ? "menuitem" : "menuitemcheckbox"}
                aria-checked={child.checked === undefined ? undefined : child.checked}
                className={`context-item${child.checked === true ? " checked" : ""}`}
                disabled={child.disabled === true}
                onClick={() => {
                  onClose();
                  child.run();
                }}
              >
                <span>{child.label}</span>
                {child.checked !== undefined && (
                  <span className="menu-check" aria-hidden>
                    {child.checked ? "✓" : ""}
                  </span>
                )}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

/** Open and close from anywhere, the way the other popovers are driven. */
export function openContextMenu(at: { x: number; y: number }, entries: MenuEntry[]): void {
  useUiStore.getState().setContextMenu({ at, entries });
}
