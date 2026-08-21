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
  /** An annotation this comment is about, carried into the posted comment's
   * item references so an agent can find the ink that prompted it. */
  aboutItemId?: string;
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
  /** Item whose name is being edited in place — double-clicking the label, or
   * F2 on the selection. */
  renamingItemId: string | null;
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
  /** P is down: the ink is being held open, and everything drawn until it
   * comes back up belongs to one drawing. */
  penSession: boolean;
  /** The help panel (?): what the canvas answers to. */
  helpOpen: boolean;
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
  /** The minimap, which folds away into its corner. Remembered per browser:
   * someone who put it away wants it away tomorrow too. */
  minimapOpen: boolean;
  /** The docked files panel — the canvas as a list of files. Shares the left
   * dock with the main thread (see lib/panels.ts). */
  filesPanelOpen: boolean;
  /** The favourites bar on the right — the shortlist you jump from. */
  favouritesOpen: boolean;
  /** Item a panel row is pointing at right now: the canvas outlines it, so a
   * name in a list and a thing on the surface are visibly the same thing. */
  peekedItemId: string | null;
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
  setRenaming: (itemId: string | null) => void;
  setOpenThread: (threadId: string | null) => void;
  setPendingComment: (pending: PendingComment | null) => void;
  setSketchError: (message: string | null) => void;
  setPenSession: (open: boolean) => void;
  setHelpOpen: (open: boolean) => void;
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
  setMinimapOpen: (open: boolean) => void;
  setFilesPanelOpen: (open: boolean) => void;
  setFavouritesOpen: (open: boolean) => void;
  setPeeked: (itemId: string | null) => void;
}

const INK_KEY = "isocan.ink";
const MINIMAP_KEY = "isocan.minimap";

function readFlag(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : raw === "1";
  } catch {
    return fallback;
  }
}

function writeFlag(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, value ? "1" : "0");
  } catch {
    // Storage denied: the choice holds for this session and no longer.
  }
}

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
    renamingItemId: null,
    openThreadId: null,
    pendingComment: null,
    sketch: [],
    sketchError: null,
    penSession: false,
    helpOpen: false,
    inkColor: readInkColor(),
    activeTool: "select",
    commentMode: false,
    trashOpen: false,
    identityOpen: false,
    commandBarOpen: false,
    mainPanelOpen: false,
    minimapOpen: readFlag(MINIMAP_KEY, true),
    filesPanelOpen: false,
    favouritesOpen: false,
    peekedItemId: null,
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
    setRenaming: (renamingItemId) => set({ renamingItemId }),
    setOpenThread: (openThreadId) => set({ openThreadId }),
    setPendingComment: (pendingComment) => set({ pendingComment }),
    setSketchError: (sketchError) => set({ sketchError }),
    setPenSession: (penSession) => set({ penSession }),
    setHelpOpen: (helpOpen) => set({ helpOpen }),
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
    setFilesPanelOpen: (filesPanelOpen) => set({ filesPanelOpen }),
    setFavouritesOpen: (favouritesOpen) => set({ favouritesOpen }),
    setPeeked: (peekedItemId) => set({ peekedItemId }),
    setMinimapOpen: (minimapOpen) => {
      writeFlag(MINIMAP_KEY, minimapOpen);
      set({ minimapOpen });
    },
  };
});
