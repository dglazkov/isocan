import { useUiStore } from "../stores/uiStore.ts";

/**
 * The left dock holds one panel at a time — the main thread or the files —
 * because two 320px panels leave a canvas that is mostly panel. Opening one
 * closes the other, and BOTH choices are remembered together: a stored "open"
 * for a panel that was pushed aside would fight the next reload.
 */

export type Panel = "main" | "files";

const KEY: Record<Panel, (canvasId: string) => string> = {
  main: (canvasId) => `isocan.mainpanel.${canvasId}`,
  files: (canvasId) => `isocan.filespanel.${canvasId}`,
};

/** Which panel is showing, or null for none. */
export function openPanel(canvasId: string, panel: Panel | null): void {
  for (const which of ["main", "files"] as const) {
    try {
      localStorage.setItem(KEY[which](canvasId), panel === which ? "open" : "closed");
    } catch {
      // Private mode — the panels still work, they just forget.
    }
  }
  const ui = useUiStore.getState();
  ui.setMainPanelOpen(panel === "main");
  ui.setFilesPanelOpen(panel === "files");
}

/** What was showing last time, if anything was ever chosen here. */
export function storedPanel(canvasId: string): Panel | null | undefined {
  try {
    if (localStorage.getItem(KEY.main(canvasId)) === "open") return "main";
    if (localStorage.getItem(KEY.files(canvasId)) === "open") return "files";
    return localStorage.getItem(KEY.main(canvasId)) === null ? undefined : null;
  } catch {
    return undefined;
  }
}
