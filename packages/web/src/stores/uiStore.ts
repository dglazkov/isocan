import { create } from "zustand";
import type { Viewport } from "../lib/viewport.ts";

export interface DragState {
  /** Every item riding this gesture — the whole selection for a group drag. */
  itemIds: string[];
  /** World-space delta applied to each dragged item while the gesture is live. */
  dx: number;
  dy: number;
  moved: boolean;
}

/** Live rubber-band rectangle in world coordinates (unnormalized corners). */
export interface MarqueeState {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface ResizeState {
  itemId: string;
  width: number;
  height: number;
}

export interface PendingComment {
  /** World coordinates of the click. */
  x: number;
  y: number;
  anchorItemId: string | null;
}

interface UiStore {
  viewport: Viewport;
  selectedItemIds: string[];
  fannedItemId: string | null;
  drag: DragState | null;
  resize: ResizeState | null;
  marquee: MarqueeState | null;
  enteredHtmlItemId: string | null;
  openThreadId: string | null;
  pendingComment: PendingComment | null;
  commentMode: boolean;
  trashOpen: boolean;
  setViewport: (viewport: Viewport) => void;
  /** Replace the selection with one item (or clear it). */
  select: (itemId: string | null) => void;
  setSelection: (itemIds: string[]) => void;
  toggleSelect: (itemId: string) => void;
  setFanned: (itemId: string | null) => void;
  setDrag: (drag: DragState | null) => void;
  setResize: (resize: ResizeState | null) => void;
  setMarquee: (marquee: MarqueeState | null) => void;
  setEnteredHtml: (itemId: string | null) => void;
  setOpenThread: (threadId: string | null) => void;
  setPendingComment: (pending: PendingComment | null) => void;
  setCommentMode: (on: boolean) => void;
  setTrashOpen: (open: boolean) => void;
}

/** Local-only UI state — never synced, deliberately per-client. */
export const useUiStore = create<UiStore>((set) => {
  // Fan-out and entered-HTML only make sense for a single-item selection.
  const selectionSideEffects = (s: UiStore, next: string[]) => ({
    selectedItemIds: next,
    fannedItemId: next.length === 1 && s.fannedItemId === next[0] ? s.fannedItemId : null,
    enteredHtmlItemId:
      next.length === 1 && s.enteredHtmlItemId === next[0] ? s.enteredHtmlItemId : null,
  });
  return {
    viewport: { tx: 0, ty: 0, scale: 1 },
    selectedItemIds: [],
    fannedItemId: null,
    drag: null,
    resize: null,
    marquee: null,
    enteredHtmlItemId: null,
    openThreadId: null,
    pendingComment: null,
    commentMode: false,
    trashOpen: false,
    setViewport: (viewport) => set({ viewport }),
    select: (itemId) => set((s) => selectionSideEffects(s, itemId === null ? [] : [itemId])),
    setSelection: (itemIds) => set((s) => selectionSideEffects(s, itemIds)),
    toggleSelect: (itemId) =>
      set((s) =>
        selectionSideEffects(
          s,
          s.selectedItemIds.includes(itemId)
            ? s.selectedItemIds.filter((id) => id !== itemId)
            : [...s.selectedItemIds, itemId],
        ),
      ),
    setFanned: (fannedItemId) => set({ fannedItemId }),
    setDrag: (drag) => set({ drag }),
    setResize: (resize) => set({ resize }),
    setMarquee: (marquee) => set({ marquee }),
    setEnteredHtml: (enteredHtmlItemId) => set({ enteredHtmlItemId }),
    setOpenThread: (openThreadId) => set({ openThreadId }),
    setPendingComment: (pendingComment) => set({ pendingComment }),
    setCommentMode: (commentMode) => set({ commentMode }),
    setTrashOpen: (trashOpen) => set({ trashOpen }),
  };
});
