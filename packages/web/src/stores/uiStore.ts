import { create } from "zustand";
import type { InkPoint, InkStroke, TextFace, TextStyle } from "@isocan/core";
import type { Clipboard } from "../lib/clipboard.ts";
import type { Guide, SpacingGuide } from "../lib/snap.ts";
import type { Viewport } from "../lib/viewport.ts";

/** The pointer tools on the right rail. */
export type Tool = "select" | "hand" | "comment" | "zoom" | "pen" | "text";

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

/** A text node being typed — before it exists, or while it is re-worded. */
export interface PendingText {
  /** World coordinates of the node's top-left. */
  x: number;
  y: number;
  /** The node being re-worded, or null for one that does not exist yet. */
  itemId: string | null;
  /** What it says now, so an edit opens on the words rather than on nothing. */
  body: string;
  /** The box to open at, when editing an existing node. */
  width?: number;
  height?: number;
  /** The ladder step and face being typed in. Local until the node commits,
   *  so choosing a size shows you the size before it is everyone's. */
  style: TextStyle;
  face: TextFace;
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
  /** Where the Text tool is about to put words, or the node whose words are
   * being re-typed. Local by design: an unfinished sentence is nobody else's
   * business, and it becomes everyone's the moment it commits as an item.
   * `itemId` null = a new node at (x, y); set = editing that one in place. */
  pendingText: PendingText | null;
  /** Copied items, held by the app rather than by the system clipboard — see
   *  `lib/clipboard.ts` for why. Survives navigating to another canvas in
   *  this tab, which is what makes pasting across canvases work. */
  clipboard: Clipboard | null;
  /** The step and face the next new text node opens with — this client's
   *  memory of what you were last writing in, never a canvas fact. */
  lastTextStyle: TextStyle;
  lastTextFace: TextFace;
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
  /** The Share dialog, beside the pile — who may be here, next to who is. */
  shareOpen: boolean;
  /** The ⌘K command bar: the friction-free lane to your emissary. */
  commandBarOpen: boolean;
  /** The docked main-thread panel (pill when closed). Persisted per canvas
   * by openMainPanel in MainThreadPanel — set only through it. */
  mainPanelOpen: boolean;
  /** The minimap, which folds away into its corner. Remembered per browser:
   * someone who put it away wants it away tomorrow too. */
  minimapOpen: boolean;
  /** The docked files panel — the canvas as a list of files. Shares the left
   * dock with the main thread (see lib/panels.ts). */
  filesPanelOpen: boolean;
  /** The marks dock on the right — the canvas grouped by reaction. */
  marksOpen: boolean;
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
  setPendingText: (pending: PendingText | null) => void;
  setClipboard: (clipboard: Clipboard | null) => void;
  setLastText: (style: TextStyle, face: TextFace) => void;
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
  setShareOpen: (open: boolean) => void;
  setCommandBarOpen: (open: boolean) => void;
  setMainPanelOpen: (open: boolean) => void;
  setMinimapOpen: (open: boolean) => void;
  setFilesPanelOpen: (open: boolean) => void;
  setMarksOpen: (open: boolean) => void;
  setPeeked: (itemId: string | null) => void;
  /** How wide the docked left panel is, in screen pixels. */
  panelWidth: number;
  setPanelWidth: (width: number) => void;
  /** The workbench's agent column — same rules as `panelWidth`, its own
   * key: the two views are sized for different jobs. */
  wbAgentsWidth: number;
  setWbAgentsWidth: (width: number) => void;
  /** True only while the edge is being dragged — see `setPanelResizing`. */
  panelResizing: boolean;
  setPanelResizing: (resizing: boolean) => void;
}

const INK_KEY = "isocan.ink";
const MINIMAP_KEY = "isocan.minimap";
const PANEL_WIDTH_KEY = "isocan.panelWidth";
const WB_AGENTS_WIDTH_KEY = "isocan.wb.agents.width";
/** The workbench agent column's floor — V1's fixed grid, now the reset. */
export const WB_AGENTS_MIN_WIDTH = 340;

/**
 * How wide the docked left panel is, and how wide it may be.
 *
 * **The old fixed width is the FLOOR, not the default-and-only.** 320 was
 * chosen for a composer and a list of filenames; a thread of real messages
 * with item cards in it wants more, and nothing about the panel needed it to
 * be the same number forever. Narrower than 320 and the composer's chips wrap
 * to one per line, so the floor is a real constraint rather than nostalgia.
 *
 * The ceiling is measured against the WINDOW, not fixed: the canvas has to
 * survive. `CANVAS_MIN` is what is left for it — enough to see an item and
 * the space around it, which is the least that makes the thing behind the
 * panel still a canvas.
 */
export const PANEL_MIN_WIDTH = 320;
const CANVAS_MIN = 360;

export function maxPanelWidth(windowWidth: number): number {
  // **A window that measures zero has not been measured.** A hidden or
  // backgrounded tab reports `innerWidth: 0`, and so does a frame before
  // layout — and taking that at face value would clamp the panel to its floor
  // AND write the floor over whatever width the person had chosen, because
  // this feeds the setter that persists. A preference destroyed by a tab
  // being in the background is a bug you would only ever see afterwards.
  //
  // So an implausible measurement means "no ceiling known", not "no room".
  if (!Number.isFinite(windowWidth) || windowWidth < PANEL_MIN_WIDTH + CANVAS_MIN) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.max(PANEL_MIN_WIDTH, windowWidth - CANVAS_MIN);
}

export function clampPanelWidth(width: number, windowWidth: number): number {
  // The floor is absolute; the ceiling may be unknown (see `maxPanelWidth`).
  // A NaN width — a drag whose arithmetic went wrong — lands on the floor
  // rather than on `NaN`, which would render as no width at all.
  const wanted = Math.round(width);
  if (!Number.isFinite(wanted)) return PANEL_MIN_WIDTH;
  return Math.min(Math.max(wanted, PANEL_MIN_WIDTH), maxPanelWidth(windowWidth));
}

/** The width you last dragged it to. A number in range, or the floor —
 * a stored value from a wider monitor must not strand the panel off-screen,
 * so it is clamped on the way in as well as on the way out. */
function readPanelWidth(): number {
  try {
    const raw = Number(localStorage.getItem(PANEL_WIDTH_KEY));
    if (!Number.isFinite(raw) || raw <= 0) return PANEL_MIN_WIDTH;
    return clampPanelWidth(raw, typeof window === "undefined" ? 1280 : window.innerWidth);
  } catch {
    return PANEL_MIN_WIDTH;
  }
}

function writePanelWidth(width: number): void {
  try {
    localStorage.setItem(PANEL_WIDTH_KEY, String(width));
  } catch {
    // Storage denied: the width holds for this session and no longer.
  }
}

/** The workbench column: same discipline as the dock's width — clamp on the
 * way in AND out, floor on nonsense, ceiling from the window (so the stage
 * keeps `CANVAS_MIN`'s worth of room), survive a denied store. */
export function clampWbAgentsWidth(width: number, windowWidth: number): number {
  const wanted = Math.round(width);
  if (!Number.isFinite(wanted)) return WB_AGENTS_MIN_WIDTH;
  return Math.min(Math.max(wanted, WB_AGENTS_MIN_WIDTH), maxPanelWidth(windowWidth));
}

function readWbAgentsWidth(): number {
  try {
    const raw = Number(localStorage.getItem(WB_AGENTS_WIDTH_KEY));
    if (!Number.isFinite(raw) || raw <= 0) return WB_AGENTS_MIN_WIDTH;
    return clampWbAgentsWidth(raw, typeof window === "undefined" ? 1280 : window.innerWidth);
  } catch {
    return WB_AGENTS_MIN_WIDTH;
  }
}

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
    pendingText: null,
    clipboard: null,
    lastTextStyle: "body",
    lastTextFace: "sans",
    sketch: [],
    sketchError: null,
    penSession: false,
    helpOpen: false,
    inkColor: readInkColor(),
    activeTool: "select",
    commentMode: false,
    trashOpen: false,
    identityOpen: false,
    shareOpen: false,
    commandBarOpen: false,
    mainPanelOpen: false,
    minimapOpen: readFlag(MINIMAP_KEY, true),
    panelWidth: readPanelWidth(),
    panelResizing: false,
    filesPanelOpen: false,
    marksOpen: false,
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
    setPendingText: (pendingText) => set({ pendingText }),
    setClipboard: (clipboard) => set({ clipboard }),
    setLastText: (lastTextStyle, lastTextFace) => set({ lastTextStyle, lastTextFace }),
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
    // The two popovers hang off the same corner and would overlap. Opening
    // one closes the other rather than letting them stack.
    setIdentityOpen: (identityOpen) => set({ identityOpen, ...(identityOpen ? { shareOpen: false } : {}) }),
    setShareOpen: (shareOpen) => set({ shareOpen, ...(shareOpen ? { identityOpen: false } : {}) }),
    setCommandBarOpen: (commandBarOpen) => set({ commandBarOpen }),
    setMainPanelOpen: (mainPanelOpen) => set({ mainPanelOpen }),
    setFilesPanelOpen: (filesPanelOpen) => set({ filesPanelOpen }),
    setMarksOpen: (marksOpen) => set({ marksOpen }),
    setPeeked: (peekedItemId) => set({ peekedItemId }),
    /**
     * Chrome that steps aside for the panel EASES to its new place, which is
     * right when the panel opens or closes — one step, and a thing that
     * teleports reads as a glitch. It is wrong while the edge is being
     * dragged: the width changes every frame, so a 0.22s ease means the
     * minimap trails your hand the whole way and settles a fifth of a second
     * after you stop. This flag is how the stylesheet tells those two apart.
     */
    setPanelResizing: (panelResizing) => set({ panelResizing }),
    setPanelWidth: (width) => {
      // Clamped HERE rather than at the drag, so every caller gets the same
      // answer: the keyboard resize, a restored value, and a pointer that
      // travelled past the window edge all land in range.
      const panelWidth = clampPanelWidth(width, window.innerWidth);
      writePanelWidth(panelWidth);
      set({ panelWidth });
    },
    wbAgentsWidth: readWbAgentsWidth(),
    setWbAgentsWidth: (width) => {
      const wbAgentsWidth = clampWbAgentsWidth(width, window.innerWidth);
      try {
        localStorage.setItem(WB_AGENTS_WIDTH_KEY, String(wbAgentsWidth));
      } catch {
        // Storage denied: the width holds for this session and no longer.
      }
      set({ wbAgentsWidth });
    },
    setMinimapOpen: (minimapOpen) => {
      writeFlag(MINIMAP_KEY, minimapOpen);
      set({ minimapOpen });
    },
  };
});
