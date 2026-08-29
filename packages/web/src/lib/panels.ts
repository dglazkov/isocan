import { useUiStore } from "../stores/uiStore.ts";
import { RAIL_PAN_MS, panForDockChange } from "./railpan.ts";
import { dockStateNow } from "./stage.ts";

/**
 * The left dock holds one panel at a time — the main thread or the files —
 * because two 320px panels leave a canvas that is mostly panel. Opening one
 * closes the other, and BOTH choices are remembered together: a stored "open"
 * for a panel that was pushed aside would fight the next reload.
 */

export type Panel = "main" | "files" | "agents" | "context" | "personas";

const KEY: Record<Panel, (canvasId: string) => string> = {
  main: (canvasId) => `isocan.mainpanel.${canvasId}`,
  files: (canvasId) => `isocan.filespanel.${canvasId}`,
  agents: (canvasId) => `isocan.agentspanel.${canvasId}`,
  context: (canvasId) => `isocan.contextpanel.${canvasId}`,
  personas: (canvasId) => `isocan.personaspanel.${canvasId}`,
};

/**
 * Widen or narrow the rail, and slide the canvas with it.
 *
 * The rail's own edge is the one under the hand, so the canvas has to track
 * it frame for frame — hence no easing here. Every way of changing the width
 * arrives through this one door: the drag, the arrow keys, Home, and the
 * double-click reset. The workbench's own column passes its own `onChange`
 * and is untouched, which is correct: it is a real column that reflows, not
 * a floating rail that borrows a pan.
 */
export function setRailWidth(width: number): void {
  const before = dockStateNow();
  useUiStore.getState().setPanelWidth(width);
  panForDockChange(before);
}

/**
 * Which panel is showing, or null for none.
 *
 * `pan` is false for exactly one caller: the mount restore. A rail that comes
 * back open on load has a viewport that is ALREADY correct — the stored
 * position was stored with the rail open — so panning it would scroll the
 * canvas sideways on every single load, and twice as far on the second one.
 * It is a parameter rather than a check inside here because "is this the
 * first render" is not a thing this function can honestly know.
 */
export function openPanel(canvasId: string, panel: Panel | null, pan = true): void {
  for (const which of ["main", "files", "agents", "context", "personas"] as const) {
    try {
      localStorage.setItem(KEY[which](canvasId), panel === which ? "open" : "closed");
    } catch {
      // Private mode — the panels still work, they just forget.
    }
  }
  const before = dockStateNow();
  const ui = useUiStore.getState();
  ui.setMainPanelOpen(panel === "main");
  ui.setFilesPanelOpen(panel === "files");
  ui.setAgentsPanelOpen(panel === "agents");
  ui.setContextPanelOpen(panel === "context");
  ui.setPersonasPanelOpen(panel === "personas");
  if (pan) panForDockChange(before, RAIL_PAN_MS);
}

/** What was showing last time, if anything was ever chosen here. */
export function storedPanel(canvasId: string): Panel | null | undefined {
  try {
    if (localStorage.getItem(KEY.main(canvasId)) === "open") return "main";
    if (localStorage.getItem(KEY.files(canvasId)) === "open") return "files";
    if (localStorage.getItem(KEY.agents(canvasId)) === "open") return "agents";
    if (localStorage.getItem(KEY.context(canvasId)) === "open") return "context";
    if (localStorage.getItem(KEY.personas(canvasId)) === "open") return "personas";
    return localStorage.getItem(KEY.main(canvasId)) === null ? undefined : null;
  } catch {
    return undefined;
  }
}
