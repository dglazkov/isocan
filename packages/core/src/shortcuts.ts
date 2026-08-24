/**
 * Every key the canvas answers to, written down once.
 *
 * The list lives in core rather than in the overlay that shows it, because
 * three things need the same answer and must not drift: the help panel, the
 * `/help` command, and an agent asked "how do I do that without a mouse?".
 * A shortcut that exists in the code and not here is invisible; one that is
 * here and not in the code is a lie, which is worse. Both are cheap to check
 * against this file, and impossible to check against a screenshot.
 */

export interface Shortcut {
  /** As a person would say it, e.g. "⌘K" or "Shift-drag". Several when the
   * same act has more than one key. */
  keys: string[];
  /** What it does, in the imperative, from the user's side of the screen. */
  does: string;
  group: ShortcutGroup;
  /** The part that is not obvious from the name — a hold that differs from a
   * tap, a rule about when it applies. */
  note?: string;
}

export type ShortcutGroup = "Tools" | "Moving around" | "Items" | "Talking" | "Ink";

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  "Tools",
  "Moving around",
  "Items",
  "Ink",
  "Talking",
];

export const SHORTCUTS: Shortcut[] = [
  // ---- Tools ----
  { keys: ["V"], does: "Select", group: "Tools" },
  { keys: ["H", "Space"], does: "Hand — drag the canvas", group: "Tools", note: "Holding Space borrows it; let go and your tool comes back" },
  { keys: ["Z"], does: "Zoom — click an item to fit it, or drag a region", group: "Tools", note: "Tap to keep it, hold to borrow it" },
  { keys: ["P"], does: "Pen — draw on the canvas", group: "Tools", note: "HOLD P and everything you draw is ONE drawing, however long you take between strokes" },
  { keys: ["C"], does: "Comment — click anywhere to start a thread", group: "Tools" },
  { keys: ["Esc"], does: "Back out: stop watching, close a popover, drop the tool, deselect", group: "Tools", note: "One layer per press, outermost first — and how you get back to Select" },

  // ---- Moving around ----
  { keys: ["⌘+", "⌘−"], does: "Zoom in and out", group: "Moving around", note: "The canvas, never the browser" },
  { keys: ["F", "⇧2"], does: "Fit the selection", group: "Moving around", note: "With nothing selected, fits everything" },
  { keys: ["⌘0", "0", "⇧1"], does: "Fit everything", group: "Moving around" },
  { keys: ["⇧0"], does: "Actual size (100%)", group: "Moving around" },
  { keys: ["⌘←", "⌘→", "⌘↑", "⌘↓"], does: "Jump to the nearest item that way", group: "Moving around", note: "Only items clear of the edge you leave — something overlapping you is beside you, not above it" },
  { keys: ["Scroll", "Pinch"], does: "Pan and zoom", group: "Moving around" },

  // ---- Items ----
  { keys: ["←", "→", "↑", "↓"], does: "Nudge the selection", group: "Items" },
  { keys: ["⇧-drag"], does: "Snap harder to the guides", group: "Items", note: "Blue says aligned; purple says the gaps match" },
  { keys: ["F2", "Double-click the name"], does: "Rename", note: "The file follows the title", group: "Items" },
  { keys: ["S"], does: "Show the version stack", group: "Items", note: "On an item with more than one version. Escape or S again closes it" },
  { keys: ["⇧F"], does: "Fit the item to its content", group: "Items", note: "F fits the view to an item; ⇧F fits the item to what is in it. Several at once are settled so nothing overlaps" },
  { keys: ["Delete", "Backspace"], does: "Move the selection to the trash", group: "Items", note: "One undo for the whole selection" },
  { keys: ["⌘Z", "⌘⇧Z"], does: "Undo and redo", note: "Yours, not everyone's", group: "Items" },
  { keys: ["Scroll a selected item"], does: "Its content moves, not the canvas", group: "Items", note: "Only the wheel is handed over, so a drag still moves it. A page in a frame has to be entered first" },
  { keys: ["Double-click an item"], does: "Step inside it: scroll it, click its links", group: "Items" },
  { keys: ["⌥-click"], does: "Reach the item underneath", group: "Items" },
  { keys: ["Drag a box"], does: "Select several", group: "Items" },

  // ---- Ink ----
  { keys: ["⌘Z"], does: "Take back the last stroke", note: "While the ink is still wet", group: "Ink" },
  { keys: ["⏎"], does: "Settle the ink into an item now", note: "Rather than waiting out the pause", group: "Ink" },
  { keys: ["Draw over an item"], does: "Annotate it", note: "The mark travels with what it marks", group: "Ink" },

  // ---- Talking ----
  { keys: ["⌘K"], does: "Message your emissary from anywhere", group: "Talking" },
  { keys: ["⏎"], does: "Send it", group: "Talking", note: "⇧⏎ makes a new line instead; the composer grows to hold it and drops back to one line once sent" },
  { keys: ["⌘⏎"], does: "Send the comment you are writing", group: "Talking", note: "Works from a reply box too, where ⏎ is a new line" },
  { keys: ["@"], does: "Address someone", note: "They wake for it", group: "Talking" },
  { keys: ["#"], does: "Point at an item", note: "It rides along as a card", group: "Talking" },
  { keys: ["/"], does: "Ask for a known piece of work", group: "Talking", note: "At the start of a message only — that is the only place it counts" },
  { keys: ["?"], does: "This list", group: "Talking" },
];

/** The shortcuts of one group, in the order they were written — which is
 * roughly the order somebody learns them. */
export function shortcutsIn(group: ShortcutGroup): Shortcut[] {
  return SHORTCUTS.filter((shortcut) => shortcut.group === group);
}

/** The whole list as text, for a terminal or a comment: the same answer the
 * overlay gives, in the medium an agent can pass on. */
export function shortcutsAsText(): string {
  // The column is measured, not guessed: a fixed 24 ran "Double-click the
  // name" straight into its description, and the next long key would have done
  // it again. One width for the whole list so the descriptions line up.
  const keysOf = (s: Shortcut) => s.keys.join(" / ");
  const column = Math.max(...SHORTCUTS.map((s) => keysOf(s).length)) + 2;
  return SHORTCUT_GROUPS.map((group) => {
    const rows = shortcutsIn(group).map((s) => {
      const head = `  ${keysOf(s).padEnd(column)}${s.does}`;
      return s.note ? `${head}\n  ${"".padEnd(column)}${s.note}` : head;
    });
    return `${group}\n${rows.join("\n")}`;
  }).join("\n\n");
}
