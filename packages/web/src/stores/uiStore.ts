import { create } from "zustand";
import type { InkPoint, InkStroke } from "@isocan/core";
import type { Guide, SpacingGuide } from "../lib/snap.ts";
import type { Viewport } from "../lib/viewport.ts";

/** The pointer tools on the right rail. */
export type Tool = "select" | "hand" | "comment" | "zoom" | "pen";

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
  /** World-space offset from the item's stored origin during the live preview.
   *  Non-zero when resizing from a corner that moves the origin (NW, NE, SW). */
  dx: number;
  dy: number;
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
  /** Alignment guides for the drag in hand: the lines the dragged box has
   * settled onto. World coordinates; empty when nothing is aligned. */
  guides: Guide[];
  /** Equal-gap measures for the same drag: "this side matches that side". */
  spacing: SpacingGuide[];
  /** Item whose content owns the pointer (entered by double-click): an HTML
   * document or a projected browser item. */
  enteredItemId: string | null;
  openThreadId: string | null;
  pendingComment: PendingComment | null;
  /** Ink drawn with the Pen that has not landed as an item YET. It lives in
   * world coordinates and is local for the moment between lifting the pen and
   * the settle timer firing, when `commitSketch` turns it into an ordinary
   * item (lib/sketch.ts). */
  sketch: InkStroke[];
  /** Why the last attempt to place a drawing failed, if it did. The ink stays
   * on screen and the bar offers a retry — a dropped daemon must not eat it. */
  sketchError: string | null;
  /** The Pen's color, or null for "whatever color I am" — the identity color
   * worn by your cursor and your face in the pile. Remembered per browser. */
  inkColor: string | null;
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
  setGuides: (guides: Guide[], spacing?: SpacingGuide[]) => void;
  setEntered: (itemId: string | null) => void;
  setOpenThread: (threadId: string | null) => void;
  setPendingComment: (pending: PendingComment | null) => void;
  setSketchError: (message: string | null) => void;
  /** Choose the ink; null goes back to your identity color. */
  setInkColor: (color: string | null) => void;
  /** Start a stroke — the pen went down. */
  beginStroke: (stroke: InkStroke) => void;
  /** The pen moved: another sample on the stroke in hand. */
  extendStroke: (point: InkPoint) => void;
  /** Take back the last stroke — ⌘Z while the ink is still wet. */
  undoStroke: () => void;
  clearSketch: () => void;
  setActiveTool: (tool: Tool) => void;
  setCommentMode: (on: boolean) => void;
  setTrashOpen: (open: boolean) => void;
  setIdentityOpen: (open: boolean) => void;
  setCommandBarOpen: (open: boolean) => void;
  setMainPanelOpen: (open: boolean) => void;
}

const INK_KEY = "isocan.ink";

/** The ink you last dipped into, if any. Only a literal hex survives the trip
 * back — the value ends up inside a saved SVG. */
function readInkColor(): string | null {
  try {
    const raw = localStorage.getItem(INK_KEY);
    return raw && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw) ? raw : null;
  } catch {
    return null;
  }
}

function writeInkColor(color: string | null): void {
  try {
    if (color === null) localStorage.removeItem(INK_KEY);
    else localStorage.setItem(INK_KEY, color);
  } catch {
    // A browser with storage denied still draws; it just forgets the choice.
  }
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
    guides: [],
    spacing: [],
    enteredItemId: null,
    openThreadId: null,
    pendingComment: null,
    sketch: [],
    sketchError: null,
    inkColor: readInkColor(),
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
    setGuides: (guides, spacing = []) => set({ guides, spacing }),
    setEntered: (enteredItemId) => set({ enteredItemId }),
    setOpenThread: (openThreadId) => set({ openThreadId }),
    setPendingComment: (pendingComment) => set({ pendingComment }),
    setSketchError: (sketchError) => set({ sketchError }),
    setInkColor: (inkColor) => {
      writeInkColor(inkColor);
      set({ inkColor });
    },
    beginStroke: (stroke) => set((s) => ({ sketch: [...s.sketch, stroke] })),
    extendStroke: (point) =>
      set((s) => {
        const last = s.sketch[s.sketch.length - 1];
        if (!last) return {};
        return {
          sketch: [...s.sketch.slice(0, -1), { ...last, points: [...last.points, point] }],
        };
      }),
    undoStroke: () => set((s) => ({ sketch: s.sketch.slice(0, -1) })),
    clearSketch: () => set({ sketch: [], sketchError: null }),
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
