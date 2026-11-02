import { useSyncExternalStore } from "react";

/** Browser localStorage key for local-only UI Devtools overrides. */
export const UI_TWEAKS_STORAGE_KEY = "isocan.uiTweaks";
/** Canvas property key for shared UI Devtools overrides (`project.update`). */
export const UI_TWEAKS_PROP = "ui.tweaks";

/** Live open/piece/picker state of the browser UI Devtools popover. */
export interface UiTweaksSignal {
  open: boolean;
  piece: string;
  picking: boolean;
  hasLocal: boolean;
}

function readHasLocal(): boolean {
  try {
    const raw = localStorage.getItem(UI_TWEAKS_STORAGE_KEY);
    return Boolean(raw && raw !== "{}" && raw.trim().length > 2);
  } catch {
    return false;
  }
}

let state: UiTweaksSignal = {
  open: false,
  piece: "glass",
  picking: false,
  hasLocal: typeof localStorage !== "undefined" ? readHasLocal() : false,
};

const listeners = new Set<() => void>();

function emit(patch: Partial<UiTweaksSignal>): void {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): UiTweaksSignal {
  return state;
}

/** Subscribe a React component to the UI Devtools open/piece/picker state. */
export function useUiTweaksSignal(): UiTweaksSignal {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Open the UI Devtools popover, optionally focused on a specific piece. */
export function openUiDevtools(piece?: string): void {
  emit({ open: true, ...(piece ? { piece } : {}), picking: false });
}

/** Close the UI Devtools popover and exit piece-picker mode. */
export function closeUiDevtools(): void {
  emit({ open: false, picking: false });
}

/** Toggle the UI Devtools popover (or switch to `piece` if another piece is open). */
export function toggleUiDevtools(piece?: string): void {
  if (state.open && (!piece || state.piece === piece)) {
    closeUiDevtools();
  } else {
    openUiDevtools(piece);
  }
}

/** Start interactive piece-picker mode (`⌖ Pick` on the canvas). */
export function startUiPiecePicker(): void {
  emit({ open: true, picking: true });
}

/** End interactive piece-picker mode and optionally select the picked piece. */
export function stopUiPiecePicker(pickedPiece?: string): void {
  emit({ picking: false, ...(pickedPiece ? { open: true, piece: pickedPiece } : {}) });
}

/** Update whether local browser overrides exist in `localStorage`. */
export function notifyLocalUiTweaks(hasLocal: boolean): void {
  if (state.hasLocal !== hasLocal) emit({ hasLocal });
}
