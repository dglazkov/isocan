import type { ReactNode } from "react";

/**
 * **One header for every dock panel.**
 *
 * The Personas panel shipped with its icon sitting on top of its own title, no
 * padding and no rule beneath it — and the reason is the whole argument for
 * this file. Five panels each hand-rolled a `<header>`, and four of them had
 * their own CSS rule to lay it out. Those four rules were **byte-identical**:
 *
 *     display: flex; align-items: center; gap: 7px; flex: none;
 *     padding: 10px 14px; border-bottom: 1px solid var(--line-soft);
 *
 * Personas was the fifth panel and never got a copy. It borrowed `.files-glyph`
 * and `.files-count`, which are standalone classes and worked — but the layout
 * lived in `.files-panel header`, a DESCENDANT rule, and the Personas panel is
 * not a `.files-panel`. So the header fell back to `display: block` and the
 * glyph collided with the word. The one line it did have,
 * `.personas-panel header .spacer { flex: 1 }`, assumed a flex container that
 * nothing created — a rule written for a layout that was never there.
 *
 * That is the failure mode of copied structure: the copy is correct on the day
 * it is made and there is nothing anywhere that notices when the next one is
 * not. A shared component cannot half-arrive. The panels differ in what they
 * put IN the header — a hint, a count, nothing — so those are slots; the frame
 * is not negotiable, which is the point.
 *
 * `Trash` deliberately keeps its own: it has no glyph and no hint, its close is
 * a different control, and dressing it as a dock panel would be a redesign
 * rather than a repair.
 */
export function PanelHead({
  glyph,
  name,
  hint,
  hintTitle,
  count,
  onClose,
  closeLabel,
  closeTitle = "Close",
}: {
  glyph: ReactNode;
  name: string;
  /** The panel's one-line "what is this", when it has one. */
  hint?: string;
  /** The full sentence, when the hint is a truncation of it. */
  hintTitle?: string;
  /** How many of the thing the panel lists, when that is worth saying. */
  count?: number;
  onClose: () => void;
  /** What a screen reader hears — "Close the files panel", not "Close". */
  closeLabel: string;
  closeTitle?: string;
}) {
  return (
    <header className="panel-head">
      <span className="panel-glyph">{glyph}</span>
      <b>{name}</b>
      {/* The hint truncates rather than wraps: these panels are draggable down
          to a narrow column, and a subtitle that pushes the header onto two
          lines costs more than it explains. The full sentence rides on the
          `title` when there is more of it. */}
      {hint !== undefined && (
        <i className="panel-hint" {...(hintTitle ? { title: hintTitle } : {})}>
          {hint}
        </i>
      )}
      {count !== undefined && count > 0 && <span className="panel-count">{count}</span>}
      <span className="spacer" />
      {/* At the far edge, on every panel: a ✕ that floats next to the subtitle
          reads as part of the sentence rather than as a control. */}
      <button className="main-close" title={closeTitle} aria-label={closeLabel} onClick={onClose}>
        ✕
      </button>
    </header>
  );
}
