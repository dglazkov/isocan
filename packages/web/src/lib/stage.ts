import { useUiStore } from "../stores/uiStore.ts";

import { TRASH_WIDTH } from "../components/TrashPanel.tsx";
import { MARKS_WIDTH } from "../components/ReactionBar.tsx";

/** The gutter the marks dock floats in, from the window's right edge. */
const MARKS_GUTTER = 76;

/**
 * The part of the window the canvas actually has.
 *
 * Docked chrome covers real estate: the top bar always, a panel on the left
 * when one is open, the trash on the right. Anything that FRAMES something —
 * fit to screen, fit the selection, fly to an item, the edge rim — has to aim
 * at what is visible, or it centres the thing you asked for underneath the
 * panel you asked from.
 *
 * It was computed three different ways before this: a `reserved` parameter on
 * one function, `window.innerWidth + PANEL_WIDTH` in another, and the radar's
 * own insets in a third. One answer, in screen pixels.
 */

export const TOPBAR_HEIGHT = 48;

export interface Stage {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function stageRect(): Stage {
  const ui = useUiStore.getState();
  const left = ui.mainPanelOpen || ui.filesPanelOpen ? ui.panelWidth : 0;
  const right = ui.trashOpen
    ? TRASH_WIDTH
    : ui.marksOpen
      ? MARKS_WIDTH + MARKS_GUTTER
      : MARKS_GUTTER;
  return {
    x: left,
    y: TOPBAR_HEIGHT,
    width: Math.max(160, window.innerWidth - left - right),
    height: Math.max(160, window.innerHeight - TOPBAR_HEIGHT),
  };
}

/** The same fact as insets, for callers that think in edges. Only chrome that
 * is FULL-BLEED and opaque counts: the tool rail, the zoom controls and the
 * minimap all float with a gutter, and a 6px rim lives in that gutter quite
 * happily. */
export function stageInsets(): { top: number; right: number; bottom: number; left: number } {
  const ui = useUiStore.getState();
  const left = ui.mainPanelOpen || ui.filesPanelOpen ? ui.panelWidth : 0;
  const right = ui.trashOpen
    ? TRASH_WIDTH
    : ui.marksOpen
      ? MARKS_WIDTH + MARKS_GUTTER
      : 0;
  return {
    top: TOPBAR_HEIGHT,
    right,
    bottom: 0,
    left,
  };
}

