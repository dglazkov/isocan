/**
 * Is this keystroke going into text?
 *
 * The canvas has single-letter shortcuts, so every global key handler has to
 * ask this before acting or typing "please" reaches for the Pen. It was
 * written out three times, and the fourth place — a KEYUP handler — forgot,
 * which is how pressing "p" in a comment box selected the Pen: the keydown was
 * ignored and the keyup was not.
 *
 * Works on a plain object as well as a real element, so the rule can be tested
 * without a DOM.
 */
export interface KeyTarget {
  tagName?: string;
  isContentEditable?: boolean;
  closest?: (selector: string) => unknown;
}

const TYPING_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

export function isTyping(target: EventTarget | KeyTarget | null | undefined): boolean {
  const el = target as KeyTarget | null | undefined;
  if (!el) return false;
  if (el.tagName && TYPING_TAGS.has(el.tagName.toUpperCase())) return true;
  if (el.isContentEditable) return true;
  // A click inside a rich-text editor lands on a child of the editable node,
  // which is not itself editable — ask the ancestors too.
  if (typeof el.closest === "function") {
    return el.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]') !== null;
  }
  return false;
}

/**
 * Does this keystroke cross a cover?
 *
 * A cover route (`itemPath` — FullScreen today, the workbench next)
 * hides the canvas without unmounting it, and Enter navigates there with the
 * selection intact. A canvas shortcut that fires underneath acts on things
 * nobody can see, against the exact item being viewed: Delete under full
 * screen deleted the thing on screen and landed on "that item is not on this
 * canvas any more". So while a cover is up, the page's key handler asks this
 * FIRST and drops whatever does not cross.
 *
 * Only ⌘K crosses — the lane to your emissary is deliberately open from
 * anywhere. Esc is not decided here: a cover owns its own way home, bound in
 * capture phase so it answers before the canvas could. Everything else —
 * arrows, undo, zoom, tools, Delete — waits for the canvas to be visible.
 *
 * Takes a plain object as well as a real event, so the rule can be tested
 * without a DOM.
 */
export interface CoverKey {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
}

export function crossesCover(e: CoverKey): boolean {
  return Boolean(e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
}
