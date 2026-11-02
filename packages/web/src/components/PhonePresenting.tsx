import { useEffect, useMemo, useState } from "react";
import { deck } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { isTyping } from "../lib/keys.ts";
import { PresentationNotes } from "./PresentationNotes.tsx";

/**
 * **Presenting from a phone: the one bar both presentation faces wear** (#182
 * stage 2).
 *
 * `FullScreen` (a presenter on their own canvas) and `Viewer` (an audience
 * member on a view link) each drew this bar inline, word for word, with its
 * own copy of the notes state and the lazy notes sheet. It is one component
 * now, loaded only when a phone presents — so neither face carries it in the
 * entry chunk, and the two cannot drift.
 *
 * What a phone presenter has that a keyboard presenter does not need:
 *
 * - **Where you are in the deck.** The tap zones are invisible and a phone has
 *   no slide sorter, so "3 / 12" is the only way to know how far is left. It
 *   sits under the slide, not in the bar, which the title needs.
 * - **The browser's own chrome gone.** On a phone the address bar and the
 *   tabs are a fifth of the screen. Where the platform offers the Fullscreen
 *   API (Android Chrome does; iPhone Safari offers it to video only, so the
 *   button simply is not there) one tap hands the slide the whole glass, and
 *   the Exit button leaves it again on the way out.
 * - **Notes as a sheet**, and N still toggles them when a keyboard is attached.
 */
export function PhonePresenting({ canvasId, itemId, title, onExit }: { canvasId: string; itemId: string | null; title: string; onExit: () => void }) {
  const [notes, setNotes] = useState(false);
  const [glass, setGlass] = useState(false);
  const canvas = useCanvasStore((s) => s.canvas);
  const slides = useMemo(() => (canvas ? deck(canvas) : []), [canvas]);
  const at = slides.findIndex((s) => s.id === itemId);

  useEffect(() => {
    const changed = () => setGlass(document.fullscreenElement !== null);
    // N, the speaker notes: FullScreen answers it on a wide screen and leaves
    // a phone's to this bar, which owns the sheet (see SHORTCUTS in core).
    const key = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || (e.key !== "n" && e.key !== "N") || isTyping(e.target)) return;
      e.preventDefault();
      setNotes((open) => !open);
    };
    document.addEventListener("fullscreenchange", changed);
    window.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("fullscreenchange", changed);
      window.removeEventListener("keydown", key, true);
    };
  }, []);

  const exit = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    onExit();
  };

  return <>
    <div className="fs-bar mobile-presentation-bar">
      <button onClick={exit} aria-label="Exit presentation">Back</button>
      <strong>{title}</strong>
      <button onClick={() => setNotes(!notes)} aria-pressed={notes}>Notes</button>
      {document.fullscreenEnabled && <button
        onClick={() => void (glass ? document.exitFullscreen() : document.documentElement.requestFullscreen())}
        aria-label={glass ? "Leave full screen" : "Full screen"}
      >
        {glass ? "↙" : "↗"}
      </button>}
    </div>
    {at >= 0 && slides.length > 1 && <span className="present-position" aria-label={`Slide ${at + 1} of ${slides.length}`}>{at + 1} / {slides.length}</span>}
    {notes && <PresentationNotes canvasId={canvasId} itemId={itemId} onClose={() => setNotes(false)} />}
  </>;
}
