/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { useEffect, type ReactNode } from "react";
import { FloatingHandles, useFloatingBox } from "../lib/floatingbox.tsx";

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
  const float = useFloatingBox<HTMLDivElement>({ minWidth: 320, minHeight: 200 });

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
        ref={float.ref}
        className={`modal-card${wide ? " wide" : ""}`}
        style={float.style}
        role="dialog"
        aria-label={label}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <FloatingHandles box={float} />
        <header onPointerDown={float.onDragPointerDown} onDoubleClick={float.reset}>
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
