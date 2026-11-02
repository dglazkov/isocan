import { create } from "zustand";
import type { TextAnchorResolution } from "@isocan/core";

/** Derived coordinates in the item's own layout, never shared or persisted. */
type TextAnchorView = { resolution: TextAnchorResolution; versionId: string; x?: number; y?: number };
interface AnchorViews { views: Record<string, TextAnchorView>; put: (id: string, view: TextAnchorView | null) => void }
/** The rendered document measures pins; the canvas and thread panel read them. */
export const useTextAnchorStore = create<AnchorViews>((set) => ({ views: {}, put: (id, view) => set(state => {
  if (JSON.stringify(state.views[id] ?? null) === JSON.stringify(view)) return state;
  const views = { ...state.views }; if (view) views[id] = view; else delete views[id];
  return { views };
}) }));
