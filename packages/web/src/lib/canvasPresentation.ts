import { createContext, useContext, useSyncExternalStore } from "react";
import type { PresentationStore } from "./presentationStore.ts";

/** Animation is available only beneath the workspace that requested it. */
export const CanvasPresentation = createContext<PresentationStore | null>(null);
const empty = () => null;
const noop = () => () => {};
/** Subscribe visible geometry consumers without touching the shared replica. */
export function usePresentation() {
  const store = useContext(CanvasPresentation);
  return useSyncExternalStore(store?.subscribe ?? noop, store?.snapshot ?? empty, empty);
}

// The app mounts one native canvas. Imperative camera/gesture commands read the
// same transient geometry as React consumers, without writing into the replica.
let active: PresentationStore | null = null;
/** Register the currently mounted workspace for imperative gesture commands. */
export function activatePresentation(store: PresentationStore) {
  active = store;
  return () => { if (active === store) active = null; };
}
/** Keep a grabbed item under the pointer when a gesture interrupts a transition. */
export function freezePresentation() { active?.freeze(); }
/** Imperative gestures need the frame under the pointer, not a captured render. */
export function currentPresentation() { return active?.snapshot() ?? null; }
