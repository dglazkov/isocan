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
interface KeyTarget {
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
 * **Has the person selected words the browser is about to copy?**
 *
 * `isTyping` answers "is the caret in a field", which is a different
 * question and the one ⌘C used to ask. Selecting the text OF A COMMENT and
 * pressing ⌘C copied the selected ITEM instead: a rendered comment is a
 * `<p>`, not an input, so nothing was being "typed into" and the canvas
 * shortcut fired over the top of the most familiar gesture in the browser.
 *
 * The honest condition is whether the browser already has something to copy.
 * Canvas items carry `user-select: none`, so a live selection can only have
 * come from a panel — the Chat, a comment, a dialog — and in every one of
 * those the words are what somebody meant.
 *
 * Takes the selection as an argument so the rule can be tested without a DOM.
 */
export function hasTextSelection(selection?: { isCollapsed?: boolean; toString(): string } | null): boolean {
  const sel = selection === undefined ? globalThis.getSelection?.() : selection;
  if (!sel || sel.isCollapsed) return false;
  return sel.toString().trim() !== "";
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
 * Only ⌘K and ⌘O cross — the launcher, and the switcher that is its second
 * face, are deliberately open from anywhere: leaving for another canvas is
 * the one act that makes sense whatever is covering this one, and it acts on
 * nothing here. Esc is not decided here: a cover owns its own way home, bound in
 * capture phase so it answers before the canvas could. ⌘-arrows are the same
 * shape — full screen answers them itself (the next screen that way, still
 * full screen), in capture, so they never reach this gate. Everything else —
 * arrows, undo, zoom, tools, Delete — waits for the canvas to be visible.
 *
 * Takes a plain object as well as a real event, so the rule can be tested
 * without a DOM.
 */
interface CoverKey {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
}

export function crossesCover(e: CoverKey): boolean {
  const key = e.key.toLowerCase();
  return Boolean(e.metaKey || e.ctrlKey) && (key === "k" || key === "o");
}
