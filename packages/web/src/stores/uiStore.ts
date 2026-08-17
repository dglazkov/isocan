import { create } from "zustand";
import type { Viewport } from "../lib/viewport.ts";

/** The pointer tools on the right rail. */
export type Tool = "select" | "hand" | "comment";

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
  /** Item whose content owns the pointer (entered by double-click): an HTML
   * document or a projected browser item. */
  enteredItemId: string | null;
  openThreadId: string | null;
  pendingComment: PendingComment | null;
  /** The active pointer tool, chosen from the right rail. "select" is the
   * default (click + marquee); "hand" pans on drag; "comment" drops pins.
   * `commentMode` below is kept in lockstep as the derived convenience the
   * comment code already reads — the two never disagree. */
  activeTool: Tool;
  commentMode: boolean;
  trashOpen: boolean;
  /** The identity menu, opened by clicking your own face in the pile. */
  identityOpen: boolean;
  /** The ⌘K command bar: the friction-free lane to your emissary. */
  commandBarOpen: boolean;
  /** The docked main-thread panel (pill when closed). Persisted per project
   * by openMainPanel in MainThreadPanel — set only through it. */
  mainPanelOpen: boolean;
  /** Session being followed: the camera tracks their locus until the user
   * takes the wheel back (any manual pan/zoom/jump, or Esc). */
  followSessionId: string | null;
  setViewport: (viewport: Viewport) => void;
  /** Camera-driven viewport update from follow mode — the one mutation that
   * does not read as "the user grabbed the wheel", so it keeps the follow. */
  followViewport: (viewport: Viewport) => void;
  setFollow: (sessionId: string | null) => void;
  /** Replace the selection with one item (or clear it). */
  select: (itemId: string | null) => void;
  setSelection: (itemIds: string[]) => void;
  toggleSelect: (itemId: string) => void;
  setFanned: (itemId: string | null) => void;
  setDrag: (drag: DragState | null) => void;
  setResize: (resize: ResizeState | null) => void;
  setMarquee: (marquee: MarqueeState | null) => void;
  setEntered: (itemId: string | null) => void;
  setOpenThread: (threadId: string | null) => void;
  setPendingComment: (pending: PendingComment | null) => void;
  setActiveTool: (tool: Tool) => void;
  setCommentMode: (on: boolean) => void;
  setTrashOpen: (open: boolean) => void;
  setIdentityOpen: (open: boolean) => void;
  setCommandBarOpen: (open: boolean) => void;
  setMainPanelOpen: (open: boolean) => void;
}

/** Local-only UI state — never synced, deliberately per-client. */
export const useUiStore = create<UiStore>((set) => {
  // Fan-out and entered-HTML only make sense for a single-item selection.
  const selectionSideEffects = (s: UiStore, next: string[]) => ({
    selectedItemIds: next,
    fannedItemId: next.length === 1 && s.fannedItemId === next[0] ? s.fannedItemId : null,
    enteredItemId: next.length === 1 && s.enteredItemId === next[0] ? s.enteredItemId : null,
  });
  return {
    viewport: { tx: 0, ty: 0, scale: 1 },
    selectedItemIds: [],
    fannedItemId: null,
    drag: null,
    resize: null,
    marquee: null,
    enteredItemId: null,
    openThreadId: null,
    pendingComment: null,
    activeTool: "select",
    commentMode: false,
    trashOpen: false,
    identityOpen: false,
    commandBarOpen: false,
    mainPanelOpen: false,
    followSessionId: null,
    // Every existing caller of setViewport is a user gesture (wheel, drag,
    // zoom buttons, a jump) — each one hands the camera back to the user.
    setViewport: (viewport) => set({ viewport, followSessionId: null }),
    followViewport: (viewport) => set({ viewport }),
    setFollow: (followSessionId) => set({ followSessionId }),
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
    setEntered: (enteredItemId) => set({ enteredItemId }),
    setOpenThread: (openThreadId) => set({ openThreadId }),
    setPendingComment: (pendingComment) => set({ pendingComment }),
    // activeTool is the source of truth; commentMode is its "comment" facet,
    // set together so the two can never drift.
    setActiveTool: (activeTool) => set({ activeTool, commentMode: activeTool === "comment" }),
    setCommentMode: (commentMode) =>
      set((s) => ({
        commentMode,
        activeTool: commentMode ? "comment" : s.activeTool === "comment" ? "select" : s.activeTool,
      })),
    setTrashOpen: (trashOpen) => set({ trashOpen }),
    setIdentityOpen: (identityOpen) => set({ identityOpen }),
    setCommandBarOpen: (commandBarOpen) => set({ commandBarOpen }),
    setMainPanelOpen: (mainPanelOpen) => set({ mainPanelOpen }),
  };
});
