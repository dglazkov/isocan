import { create } from "zustand";
import type { Viewport } from "../lib/viewport.ts";

export interface DragState {
  itemId: string;
  /** World-space position override while the gesture is live. */
  x: number;
  y: number;
  moved: boolean;
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
  selectedItemId: string | null;
  fannedItemId: string | null;
  drag: DragState | null;
  resize: ResizeState | null;
  enteredHtmlItemId: string | null;
  openThreadId: string | null;
  pendingComment: PendingComment | null;
  commentMode: boolean;
  trashOpen: boolean;
  setViewport: (viewport: Viewport) => void;
  select: (itemId: string | null) => void;
  setFanned: (itemId: string | null) => void;
  setDrag: (drag: DragState | null) => void;
  setResize: (resize: ResizeState | null) => void;
  setEnteredHtml: (itemId: string | null) => void;
  setOpenThread: (threadId: string | null) => void;
  setPendingComment: (pending: PendingComment | null) => void;
  setCommentMode: (on: boolean) => void;
  setTrashOpen: (open: boolean) => void;
}

/** Local-only UI state — never synced, deliberately per-client. */
export const useUiStore = create<UiStore>((set) => ({
  viewport: { tx: 0, ty: 0, scale: 1 },
  selectedItemId: null,
  fannedItemId: null,
  drag: null,
  resize: null,
  enteredHtmlItemId: null,
  openThreadId: null,
  pendingComment: null,
  commentMode: false,
  trashOpen: false,
  setViewport: (viewport) => set({ viewport }),
  select: (selectedItemId) =>
    set((s) => ({
      selectedItemId,
      fannedItemId: s.fannedItemId === selectedItemId ? s.fannedItemId : null,
      enteredHtmlItemId: s.enteredHtmlItemId === selectedItemId ? s.enteredHtmlItemId : null,
    })),
  setFanned: (fannedItemId) => set({ fannedItemId }),
  setDrag: (drag) => set({ drag }),
  setResize: (resize) => set({ resize }),
  setEnteredHtml: (enteredHtmlItemId) => set({ enteredHtmlItemId }),
  setOpenThread: (openThreadId) => set({ openThreadId }),
  setPendingComment: (pendingComment) => set({ pendingComment }),
  setCommentMode: (commentMode) => set({ commentMode }),
  setTrashOpen: (trashOpen) => set({ trashOpen }),
}));
