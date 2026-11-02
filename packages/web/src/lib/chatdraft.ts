import { useCallback, useMemo } from "react";
import { create } from "zustand";
/** A layout change or closed panel must not discard an unsent conversation.
 * Memory only, partitioned by both canvas and actor; no desktop preference. */
const drafts = create<{ values: Record<string, string>; set: (key: string, value: string | ((old: string) => string)) => void }>((set) => ({
  values: {},
  set: (key, value) => set((state) => ({ values: { ...state.values, [key]: typeof value === "function" ? value(state.values[key] ?? "") : value } })),
}));
/** Share the unsent text between the phone and desktop frames of the same conversation. */
export function useChatDraft(canvasId: string, actorId: string) {
  const key = JSON.stringify([canvasId, actorId]);
  const value = drafts((s) => s.values[key] ?? "");
  const setDraft = useCallback((next: string | ((old: string) => string)) => drafts.getState().set(key, next), [key]);
  return useMemo(() => [value, setDraft] as const, [value, setDraft]);
}
