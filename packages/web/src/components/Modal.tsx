import { useEffect, type ReactNode } from "react";

/**
 * **The shell every full-screen overlay wears**, so there is one of them.
 *
 * `HelpPanel` had this shape first — a backdrop that closes on a click
 * outside, a card that does not, a header with a title and a ✕, and a body
 * that scrolls. What's new needed the identical thing, and the identical
 * thing written twice is precisely what `panelhead.test.ts` exists to stop:
 * *"one copy per directory, several doorways to it"*, applied one level up.
 * Two modals drift in the small ways nobody notices until they are beside
 * each other — a different close glyph, a different escape key, eight pixels
 * of padding.
 *
 * `Escape` and the backdrop click live here rather than in each caller,
 * because "this closes" is a property of being a modal and not a thing each
 * one should get to have an opinion about.
 */
export function Modal({
  label,
  title,
  onClose,
  wide,
  children,
}: {
  /** For a screen reader: what this dialog IS. */
  label: string;
  /** For everyone else: the same thing, in the header. */
  title: ReactNode;
  onClose: () => void;
  /** Wider, for content that reads badly in a column. */
  wide?: boolean;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    /* Closing on the backdrop and NOT on the card is the whole reason these
       are two elements; the stopPropagation is what keeps a click on the
       content from reaching the closer behind it. */
    <div className="modal-backdrop" onPointerDown={onClose}>
      <div
        className={`modal-card${wide ? " wide" : ""}`}
        role="dialog"
        aria-label={label}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <header>
          <b>{title}</b>
          <span className="spacer" />
          <button className="main-close" title="Close (Esc)" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        <div className="modal-scroll">{children}</div>
      </div>
    </div>
  );
}
