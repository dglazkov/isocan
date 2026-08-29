import { useUiStore } from "../stores/uiStore.ts";

/**
 * The part of the window the canvas actually has.
 *
 * Docked chrome covers real estate: the top bar always, a panel on the left
 * when one is open, the trash or the marks dock on the right. Anything that
 * FRAMES something — fit to screen, fit the selection, fly to an item, the
 * edge rim — has to aim at what is visible, or it centres the thing you asked
 * for underneath the panel you asked from.
 *
 * It was computed three different ways before this file: a `reserved`
 * parameter on one function, `window.innerWidth + PANEL_WIDTH` in another,
 * and the radar's own insets in a third. One answer, in screen pixels — and
 * the dock arithmetic is ONE function (`dockEdges`) that both public shapes
 * read, because the day this file held two hand-copied spellings of it they
 * immediately began to disagree about the right edge.
 *
 * This file also OWNS the dock widths. They used to live on the components
 * and be imported here, which read naturally and meant the geometry module
 * could not be imported by a test without dragging React components, the
 * canvas store and the api module behind it. The components import their
 * width from here instead: the stage is the one place that knows how much
 * window each dock takes.
 */

/**
 * What the header occupies: `--edge` plus a 34px cluster.
 *
 * It was 48 while the bar was a slab flush to the top. The clusters float at
 * the shared inset now, so the space they take begins at 20 and ends at 54 —
 * and this number is what stops framing parking an item under them, so it has
 * to be what they actually occupy rather than what the old bar did.
 */
export const TOPBAR_HEIGHT = 54;

/** The trash panel's docked width. `.trash-panel { width: 300px }` — the two
 * are one number with two homes, which is why the CSS is guarded. */
export const TRASH_WIDTH = 300;

/** The marks dock's width. Must equal `.marks { width: 232px }`. */
export const MARKS_WIDTH = 232;

/**
 * The gutter along the window's right edge that floating chrome lives in:
 * the marks dock floats `76px` in from the edge, and the tool rail
 * (`right: 14px; width: 52px` — 66px deep) stands inside the same strip.
 *
 * `stageRect` reserves it even when no dock is open, so framing never parks
 * an item under the rail. `stageInsets` deliberately does NOT (see below).
 */
export const MARKS_GUTTER = 76;

export interface Stage {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The slice of `uiStore` the stage reads — injectable so a test can hand in
 * a state instead of standing up the store and a window. */
export interface DockState {
  mainPanelOpen: boolean;
  filesPanelOpen: boolean;
  trashOpen: boolean;
  marksOpen: boolean;
  panelWidth: number;
}

/**
 * What the docks take from each side — the ONE derivation.
 *
 * `dockRight` is opaque chrome only: the trash panel or the marks dock.
 * Zero when neither is open, even though the rail still floats there —
 * whether the rail's gutter counts is the CALLER's question, and the two
 * callers answer it differently on purpose:
 *
 * - `stageRect` adds the gutter, because framing an item under the rail is
 *   parking it beneath chrome.
 * - `stageInsets` does not, because the radar's 6px rim lives in the gutter
 *   quite happily — a rim pushed 76px in from the edge would float in space.
 */
/**
 * The window strip a floating rail occupies: its own inset, plus its width.
 *
 * The panel moved off the edge, so the space it denies the canvas is no
 * longer just `panelWidth` — an item framed at exactly `panelWidth` would sit
 * 20px under the rail's left edge. A rail that floats still takes a strip;
 * floating changes where the strip starts, not that there is one.
 */
export const RAIL_INSET = 20;

/**
 * The rail when it is SHUT is not nothing — it is a 48px strip carrying the
 * unread count and the agents who are working. It floats over the canvas
 * exactly as the open rail does, so it takes a strip in exactly the same way,
 * and framing must refuse to park an item under it for the same reason.
 *
 * This is why `dockEdges` is the one derivation and the pan reads it rather
 * than measuring the rail itself: adding the strip changed what "the rail
 * takes" by 272px in every case at once, and framing, the stage rect, the
 * minimap, the hover cards and the phase-2 pan all followed from this line.
 */
export const STRIP_WIDTH = 48;

export function railSpan(panelWidth: number): number {
  return RAIL_INSET + panelWidth;
}

/**
 * The dock state as it stands right now, copied out of the store.
 *
 * Lives here rather than at the call site because this is the file that
 * decides what dock state MEANS: `railpan` needs a before-and-after pair to
 * measure a pan against, and a snapshot assembled somewhere else is a second
 * place that has to be updated when a dock is added.
 */
export function dockStateNow(): DockState {
  const { mainPanelOpen, filesPanelOpen, trashOpen, marksOpen, panelWidth } =
    useUiStore.getState();
  return { mainPanelOpen, filesPanelOpen, trashOpen, marksOpen, panelWidth };
}

export function dockEdges(ui: DockState): { left: number; dockRight: number } {
  return {
    left: railSpan(ui.mainPanelOpen || ui.filesPanelOpen ? ui.panelWidth : STRIP_WIDTH),
    dockRight: ui.trashOpen ? TRASH_WIDTH : ui.marksOpen ? MARKS_WIDTH + MARKS_GUTTER : 0,
  };
}

export function stageRect(
  ui: DockState = useUiStore.getState(),
  win: { innerWidth: number; innerHeight: number } = window,
): Stage {
  const { left, dockRight } = dockEdges(ui);
  // The gutter is a FLOOR on the right reservation, not an addition: an open
  // dock is already deeper than it.
  const right = Math.max(dockRight, MARKS_GUTTER);
  return {
    x: left,
    y: TOPBAR_HEIGHT,
    width: Math.max(160, win.innerWidth - left - right),
    height: Math.max(160, win.innerHeight - TOPBAR_HEIGHT),
  };
}

/** The same dock facts as edges, for callers that think in insets. Only
 * chrome that is FULL-BLEED and opaque counts here — see `dockEdges` for why
 * this one, unlike `stageRect`, leaves the rail's gutter out. */
export function stageInsets(
  ui: DockState = useUiStore.getState(),
): { top: number; right: number; bottom: number; left: number } {
  const { left, dockRight } = dockEdges(ui);
  return { top: TOPBAR_HEIGHT, right: dockRight, bottom: 0, left };
}
