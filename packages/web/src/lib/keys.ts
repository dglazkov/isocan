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
