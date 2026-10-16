import { useSyncExternalStore } from "react";

export const UI_TWEAKS_STORAGE_KEY = "isocan.uiTweaks";
export const UI_TWEAKS_PROP = "ui.tweaks";

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

export function useUiTweaksSignal(): UiTweaksSignal {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function openUiDevtools(piece?: string): void {
  emit({ open: true, ...(piece ? { piece } : {}), picking: false });
}

export function closeUiDevtools(): void {
  emit({ open: false, picking: false });
}

export function toggleUiDevtools(piece?: string): void {
  if (state.open && (!piece || state.piece === piece)) {
    closeUiDevtools();
  } else {
    openUiDevtools(piece);
  }
}

export function startUiPiecePicker(): void {
  emit({ open: true, picking: true });
}

export function stopUiPiecePicker(pickedPiece?: string): void {
  emit({ picking: false, ...(pickedPiece ? { open: true, piece: pickedPiece } : {}) });
}

export function notifyLocalUiTweaks(hasLocal: boolean): void {
  if (state.hasLocal !== hasLocal) emit({ hasLocal });
}
