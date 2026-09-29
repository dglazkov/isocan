import { isEmbedded, isEmbeddedChatHidden } from "@isocan/core";
import { useUiStore } from "../stores/uiStore.ts";
import { RAIL_PAN_MS, panForDockChange } from "./railpan.ts";
import { dockStateNow } from "./stage.ts";

/**
 * The query string this window was LOADED with, read on first ask and kept.
 * Being framed is a fact about how the host opened the window, not about the
 * route: the app's own navigation (`/i/<item>`, `/w`) drops the query, and
 * the Chat dock must not come back — nor the host bridge go quiet — the
 * moment somebody opens an item full screen inside the pane.
 */
let loadedSearch: string | undefined;
function searchAtLoad(): string {
  loadedSearch ??= typeof window !== "undefined" ? window.location.search : "";
  return loadedSearch;
}

/**
 * Whether a host pane framed this window (`?embed=1`,
 * `docs/projects/jetski/design.md`) — the gate on the host bridge.
 */
export function embeddedNow(search = searchAtLoad()): boolean {
  return isEmbedded(search);
}

/**
 * Whether this window keeps its own Chat dock off because the host pane that
 * framed it already owns the conversation column (`?embed=1` without
 * `chat=on`).
 */
export function chatHiddenNow(search = searchAtLoad()): boolean {
  return isEmbeddedChatHidden(search);
}

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
 *
 * Inside a pane that hides the Chat (`chatHiddenNow`), asking for `"main"`
 * closes the dock instead, and is NOT remembered: nobody chose "closed", and
 * a stored one would outlive the pane — into the person's own tabs, in any
 * browser that does not partition a frame's storage.
 */
export function openPanel(canvasId: string, panel: Panel | null, pan = true, remember = true): void {
  const folded = panel === "main" && chatHiddenNow();
  const next = folded ? null : panel;
  if (remember && !folded) for (const which of ["main", "files", "agents", "context", "personas"] as const) {
    try {
      localStorage.setItem(KEY[which](canvasId), next === which ? "open" : "closed");
    } catch {
      // Private mode — the panels still work, they just forget.
    }
  }
  const before = dockStateNow();
  const ui = useUiStore.getState();
  ui.setMainPanelOpen(next === "main");
  ui.setFilesPanelOpen(next === "files");
  ui.setAgentsPanelOpen(next === "agents");
  ui.setContextPanelOpen(next === "context");
  ui.setPersonasPanelOpen(next === "personas");
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
