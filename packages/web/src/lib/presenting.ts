import { deck, deckStep, type CanvasContents, type Item } from "@isocan/core";

/**
 * **The slide's frame, when it is holding the keyboard.**
 *
 * Full screen hears its keys — the arrows, Esc, N — on the page's own window.
 * A slide is somebody's page in a cross-origin frame, and once focus is
 * inside it (a click on the slide; a return to the tab that lands there) its
 * key presses go to that page and never reach ours: the deck stopped turning
 * and Esc stopped leaving. The frame is the one place focus must not stay
 * while presenting, and this finds it.
 */
export function stageFrameHolding(doc: Document): HTMLIFrameElement | null {
  const active = doc.activeElement;
  if (!active || active.tagName !== "IFRAME") return null;
  return active.closest(".fullscreen-stage") ? (active as HTMLIFrameElement) : null;
}

/**
 * Take the keyboard back from the slide. The click that put focus there has
 * already gone to the slide by then — a click is delivered where the pointer
 * is, not where focus is — so its links and buttons still work; only a text
 * field inside a slide loses its caret, which presenting has no use for.
 */
export function reclaimKeyboard(doc: Document): boolean {
  const frame = stageFrameHolding(doc);
  if (!frame) return false;
  frame.blur();
  doc.defaultView?.focus();
  return true;
}

/** Seconds between slides when the deck turns itself, unless the presenter says otherwise. */
export const AUTO_ADVANCE_DEFAULT_S = 10;
const AUTO_ADVANCE_MIN_S = 2;
const AUTO_ADVANCE_MAX_S = 600;

/** A presenter's typed interval, held to something a deck can run at. */
export function autoAdvanceSeconds(value: unknown): number {
  if (typeof value === "string" && !value.trim()) return AUTO_ADVANCE_DEFAULT_S;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return AUTO_ADVANCE_DEFAULT_S;
  return Math.min(AUTO_ADVANCE_MAX_S, Math.max(AUTO_ADVANCE_MIN_S, Math.round(n)));
}

/**
 * **Where the deck turns to on its own: the next slide, and from the last,
 * the first.** The arrows stop at the deck's edge on purpose — a presenter
 * pressing → once too often must not be thrown back to the title — but a deck
 * left running is a loop by asking. Null when there is nowhere else to go.
 */
export function nextInLoop(canvas: CanvasContents, itemId: string): Item | null {
  const next = deckStep(canvas, itemId, 1) ?? deck(canvas)[0] ?? null;
  return next && next.id !== itemId ? next : null;
}
