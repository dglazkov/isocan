/**
 * **The in-place edits the stage holds while a person types** — their shapes
 * and how a new one folds into the pending list. Split from `textPatch.ts`
 * (which locates and splices them) so the stage carries these from first
 * paint and the parser-side half arrives only when somebody saves.
 */

/** One committed in-place text edit. */
export interface TextEdit {
  /** Which text node, counted in document order over the whole document —
   * the one number the frame and the parser can both compute. */
  ordinal: number;
  /** What the node said when it was clicked. A check, never a search. */
  from: string;
  to: string;
}

/**
 * One committed attribute edit — stage 2, element properties. The panel
 * writes `style` and `class`; the shape is any attribute, because the
 * splice does not care which.
 */
export interface AttrEdit {
  kind: "attr";
  /** Which element, counted in document order over the whole document
   *  (`createTreeWalker(SHOW_ELEMENT)` on the frame's side). */
  ordinal: number;
  /** Lowercased tag name, checked against the source so a moved file
   *  cannot land a style on the wrong kind of thing. */
  tag: string;
  name: string;
  /** The attribute's value when the element was selected; null when it had
   *  none. A check, never a search. */
  from: string | null;
  /** The value to write; null removes the attribute. */
  to: string | null;
}

export type InPlaceEdit = TextEdit | AttrEdit;

export function isAttrEdit(edit: InPlaceEdit): edit is AttrEdit {
  return (edit as AttrEdit).kind === "attr";
}

/**
 * Fold a new edit into the pending list.
 *
 * By ordinal (and, for an attribute, by name), which is what the parser
 * upgrade simplified: the same node edited twice is one entry — the ORIGINAL
 * `from` the file still holds, mapped to the latest `to` — and an edit that
 * returns a node to what it said disappears. The V0 chained these by
 * matching strings, which could not tell two nodes saying the same thing
 * apart.
 */
export function foldEdit<E extends InPlaceEdit>(pending: readonly E[], edit: E): E[] {
  const next = [...pending];
  const same = (one: InPlaceEdit) =>
    isAttrEdit(one) === isAttrEdit(edit) &&
    one.ordinal === edit.ordinal &&
    (!isAttrEdit(one) || !isAttrEdit(edit) || one.name === edit.name);
  const at = next.findIndex(same);
  if (at === -1) return edit.from === edit.to ? next : [...next, edit];
  const original = next[at]!.from;
  if (original === edit.to) next.splice(at, 1);
  else next[at] = { ...edit, from: original } as E;
  return next;
}
