import { create } from "zustand";
import type { InkPoint, InkStroke, TextFace, TextStyle, Paper } from "@isocan/core";
import { TEXT_FACES, TEXT_STYLES, isPaper } from "@isocan/core";
import type { Clipboard } from "../lib/clipboard.ts";
import type { MenuEntry } from "../components/ContextMenu.tsx";
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
  /** The paper being typed on, or null/absent for a plain caption — local
   *  until it commits, like the step and the face. */
  paper?: Paper | null;
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
  /** The open right-click menu, if any — where it is and what it offers.
   *  Local and ephemeral: a menu is a thing one person is looking at. */
  contextMenu: { at: { x: number; y: number }; entries: MenuEntry[] } | null;
  /** The step and face the next new text node opens with — this client's
   *  memory of what you were last writing in, never a canvas fact. */
  lastTextStyle: TextStyle;
  lastTextFace: TextFace;
  /** The paper too: making six post-its is choosing yellow once, not six
   *  times — the same argument that remembers the step. The DEFAULT is still
   *  no paper; this only remembers what you chose last. */
  lastPaper: Paper | null;
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
  /** The mark being PLACED: while set, a click on a sketch on the wall puts
   *  this emoji where the click landed (sprint phase 4's heat map). Local,
   *  like a tool; Escape clears it. Null is the ordinary pointer. */
  stamp: string | null;
  trashOpen: boolean;
  /** The identity menu, opened by clicking your own face in the pile. */
  identityOpen: boolean;
  /** The Share dialog, beside the pile — who may be here, next to who is. */
  shareOpen: boolean;
  /** The ⌘K command bar: the friction-free lane to your emissary. */
  /** The docked main-thread panel (pill when closed). Persisted per canvas
   * by openMainPanel in MainThreadPanel — set only through it. */
  mainPanelOpen: boolean;
  /** The minimap, which folds away into its corner. Remembered per browser:
   * someone who put it away wants it away tomorrow too. */
  minimapOpen: boolean;
  /** The docked files panel — the canvas as a list of files. Shares the left
   * dock with the main thread (see lib/panels.ts). */
  filesPanelOpen: boolean;
  /** The agent tray — `isocan who` given a home. Shares the left dock. */
  agentsPanelOpen: boolean;
  contextPanelOpen: boolean;
  personasPanelOpen: boolean;
  /** Whose WORK the camera follows: the agent whose new items it flies to,
   *  or null. Off by default — this moves the canvas on somebody's behalf, so
   *  it is a mode they choose rather than one they discover happening to
   *  them.
   *
   *  Distinct from `followSessionId`, which follows a person's CURSOR. Two
   *  different questions: where somebody is looking, and what they are
   *  making. */
  followingActorId: string | null;
  /** The marks dock on the right — the canvas grouped by reaction. */
  marksOpen: boolean;
  /**
   * Text the Chat should open with, put there by something else.
   *
   * The launcher picks a slash command and does NOT post it: most take an
   * argument — `/variation 3 layouts` is a different request from
   * `/variation` — so it opens the Chat with the command typed and the caret
   * after it, which is the half somebody has not written yet. Cleared by the
   * composer once it has taken it, so it cannot re-apply on the next render.
   */
  pendingChat: string | null;
  /** The ⌘K launcher. */
  paletteOpen: boolean;
  /** The history scrubber along the bottom. Whether it is OPEN lives here;
   * where its playhead is standing lives in `canvasStore.past`, because that
   * is canvas state and every reader of the canvas has to see it. */
  historyOpen: boolean;
  /** Item a panel row is pointing at right now: the canvas outlines it, so a
   * name in a list and a thing on the surface are visibly the same thing. */
  peekedItemId: string | null;
  /**
   * The item the pointer is over on the canvas — distinct from `peekedItemId`,
   * which is the Files panel pointing AT an item from outside.
   *
   * One id rather than a flag per item, so moving the pointer across a canvas
   * re-renders the two items whose state actually changed instead of all of
   * them.
   */
  hoveredItemId: string | null;
  /** The What's new panel. */
  newsOpen: boolean;
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
  setContextMenu: (menu: { at: { x: number; y: number }; entries: MenuEntry[] } | null) => void;
  setLastText: (style: TextStyle, face: TextFace, paper: Paper | null) => void;
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
  setStamp: (stamp: string | null) => void;
  setCommentMode: (on: boolean) => void;
  setTrashOpen: (open: boolean) => void;
  setIdentityOpen: (open: boolean) => void;
  setShareOpen: (open: boolean) => void;
  setMainPanelOpen: (open: boolean) => void;
  setMinimapOpen: (open: boolean) => void;
  setFilesPanelOpen: (open: boolean) => void;
  setAgentsPanelOpen: (open: boolean) => void;
  setContextPanelOpen: (open: boolean) => void;
  setPersonasPanelOpen: (open: boolean) => void;
  setFollowingActor: (actorId: string | null) => void;
  setMarksOpen: (open: boolean) => void;
  setHistoryOpen: (open: boolean) => void;
  setPendingChat: (text: string | null) => void;
  setPaletteOpen: (open: boolean) => void;
  setPeeked: (itemId: string | null) => void;
  setHoveredItem: (itemId: string | null) => void;
  setNewsOpen: (open: boolean) => void;
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
  /** The canvas is being dragged under the hand. */
  panning: boolean;
  setPanning: (panning: boolean) => void;
  /** The rail is panning the canvas: `.world` takes a transform transition
   *  for the duration, so the motion is the compositor's and not React's. */
  railPanning: boolean;
  setRailPanning: (on: boolean) => void;
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

const TEXT_STEP_KEY = "isocan.text.style";
const TEXT_FACE_KEY = "isocan.text.face";
const TEXT_PAPER_KEY = "isocan.text.paper";

/**
 * **The step and face you last typed in, kept across reloads.**
 *
 * They were remembered already — but only in memory, so every reload dropped
 * back to `body`, and somebody labelling a canvas had to reach for "title"
 * again and again. Reported as exactly that, in a week where reloading was
 * also the only cure for a stale socket, which is what made a per-session
 * memory feel like no memory at all.
 *
 * Validated against the closed sets rather than trusted: a hand-edited or
 * stale key must not be able to open the composer at a step that no longer
 * exists, and the fallback is the same default a first visit gets.
 */
function readTextStyle(): TextStyle {
  try {
    const raw = localStorage.getItem(TEXT_STEP_KEY);
    return TEXT_STYLES.includes(raw as TextStyle) ? (raw as TextStyle) : "body";
  } catch {
    return "body";
  }
}

function readTextFace(): TextFace {
  try {
    const raw = localStorage.getItem(TEXT_FACE_KEY);
    return TEXT_FACES.includes(raw as TextFace) ? (raw as TextFace) : "sans";
  } catch {
    return "sans";
  }
}

function readPaper(): Paper | null {
  try {
    const raw = localStorage.getItem(TEXT_PAPER_KEY);
    // `isPaper` is the closed set's own check: a stale key must not open the
    // composer on a colour that no longer exists.
    return isPaper(raw) ? raw : null;
  } catch {
    return null;
  }
}

function writeText(style: TextStyle, face: TextFace, paper: Paper | null): void {
  try {
    localStorage.setItem(TEXT_STEP_KEY, style);
    localStorage.setItem(TEXT_FACE_KEY, face);
    if (paper === null) localStorage.removeItem(TEXT_PAPER_KEY);
    else localStorage.setItem(TEXT_PAPER_KEY, paper);
  } catch {
    // A browser refusing storage is not a reason to refuse the tool.
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
    contextMenu: null,
    lastTextStyle: readTextStyle(),
    lastTextFace: readTextFace(),
    lastPaper: readPaper(),
    sketch: [],
    sketchError: null,
    penSession: false,
    helpOpen: false,
    inkColor: readInkColor(),
    activeTool: "select",
    commentMode: false,
    stamp: null,
    trashOpen: false,
    identityOpen: false,
    shareOpen: false,
    mainPanelOpen: false,
    minimapOpen: readFlag(MINIMAP_KEY, true),
    panelWidth: readPanelWidth(),
    panelResizing: false,
    panning: false,
    railPanning: false,
    filesPanelOpen: false,
    agentsPanelOpen: false,
    contextPanelOpen: false,
    personasPanelOpen: false,
    followingActorId: null,
    marksOpen: false,
    historyOpen: false,
    pendingChat: null,
    paletteOpen: false,
    peekedItemId: null,
    hoveredItemId: null,
    newsOpen: false,
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
    setContextMenu: (contextMenu) => set({ contextMenu }),
    setLastText: (lastTextStyle, lastTextFace, lastPaper) => {
      writeText(lastTextStyle, lastTextFace, lastPaper);
      set({ lastTextStyle, lastTextFace, lastPaper });
    },
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
    setStamp: (stamp) => set({ stamp }),
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
    setMainPanelOpen: (mainPanelOpen) => set({ mainPanelOpen }),
    setFilesPanelOpen: (filesPanelOpen) => set({ filesPanelOpen }),
    setAgentsPanelOpen: (agentsPanelOpen) => set({ agentsPanelOpen }),
    setContextPanelOpen: (contextPanelOpen) => set({ contextPanelOpen }),
    setPersonasPanelOpen: (personasPanelOpen) => set({ personasPanelOpen }),
    setFollowingActor: (followingActorId) => set({ followingActorId }),
    setMarksOpen: (marksOpen) => set({ marksOpen }),
    setHistoryOpen: (historyOpen) => set({ historyOpen }),
    setPendingChat: (pendingChat) => set({ pendingChat }),
    setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
    setPeeked: (peekedItemId) => set({ peekedItemId }),
    setHoveredItem: (hoveredItemId) => set({ hoveredItemId }),
    setNewsOpen: (newsOpen) => set({ newsOpen }),
    /**
     * Chrome that steps aside for the panel EASES to its new place, which is
     * right when the panel opens or closes — one step, and a thing that
     * teleports reads as a glitch. It is wrong while the edge is being
     * dragged: the width changes every frame, so a 0.22s ease means the
     * minimap trails your hand the whole way and settles a fifth of a second
     * after you stop. This flag is how the stylesheet tells those two apart.
     */
    setPanelResizing: (panelResizing) => set({ panelResizing }),
    /**
     * Whether the canvas is being dragged under the hand right now.
     *
     * It was local state in `CanvasViewport`, which was fine while nothing
     * outside that component needed to know. `useLaneFollow` in
     * `MainThreadPanel` does: a camera that flies to the thing somebody is
     * working on must not fight a hand that is already moving the canvas.
     *
     * The lane tethers needed it first and are gone; this outlived them
     * because the reason generalises — anything outside the viewport that
     * reacts to the camera wants to know when a person is driving it.
     */
    setPanning: (panning) => set({ panning }),
    setRailPanning: (railPanning) => set({ railPanning }),
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
