import { groupAncestors, groupDropPolicy, groupDropTarget, groupScopedRoot, groupScopeRoots, isGroupItem } from "@isocan/core";
import { groupsEnabled, leaveGroupAtPoint, scopedHit } from "../lib/canvasgroups.ts";
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Actor } from "@isocan/core";
import { groundIsPlace, hasGround, isArea, parseUriList } from "@isocan/core";
import { actorColor } from "../lib/colors.ts";
import { publishCursor, setNotice, useCanvasStore } from "../stores/canvasStore.ts";
import { useSettling } from "../lib/settling.ts";
import { type Tool, useUiStore } from "../stores/uiStore.ts";
import { pan, pinch, screenToWorld, worldToScreen, zoomAt, type TwoPoints } from "../lib/viewport.ts";
import { moduleDropFor } from "../modules.ts";
import { creationDestination, selectCreatedItems } from "../lib/groupplacement.ts";
import { webHostFor } from "../lib/modulehost.ts";
import { newGroupId } from "@isocan/core";
import { type Sample, coastFrame, flickVelocity } from "../lib/inertia.ts";
import { zoomToBox, zoomToItem } from "../lib/zoomactions.ts";
import { addFailure, addFiles } from "../lib/upload.ts";
import { placeSketch } from "../lib/sketch.ts";
import { placeableArea, revealIfOffscreen } from "../lib/spot.ts";
import { glideToBox } from "../lib/zoomactions.ts";
import { settleDelay, wasHeld } from "../lib/pensession.ts";
import { isTyping } from "../lib/keys.ts";
import { TextComposer } from "./TextComposer.tsx";
import { canEditNow, useCanEdit } from "../lib/capability.ts";
import { ContextMenu, openContextMenu } from "./ContextMenu.tsx";
/**
 * **The menus arrive when a menu is asked for** (#195's budget, not its
 * feature). `menuentries.tsx` is twenty-four kilobytes of every row the
 * canvas can offer — the item menu, the canvas menu, the chrome drawer — and
 * a right-click is a deliberate gesture with a frame to spare. It was in the
 * bytes of every first visit, including the ones that never open a menu.
 *
 * The screen point and the world point are read BEFORE the await: the event
 * is gone by the time the module lands, and reading `e.clientX` off a pooled
 * event later is the kind of bug that only shows up under a slow network.
 */
const menus = () => import("../lib/menuentries.tsx");
import { ItemView } from "./ItemView.tsx";
/**
 * **The fan is rare, so it is not in the bytes a first visit downloads.**
 *
 * Unfolding an item's whole version history is a thing people do
 * occasionally and deliberately, and it carries its own card, its own
 * animation and its own observer. Loading it with the canvas made every
 * visitor pay for a gesture most sessions never make — and it was the
 * difference between the entry chunk holding its bound and breaking it.
 */
const VersionFanOut = lazy(() =>
  import("./VersionFanOut.tsx").then((m) => ({ default: m.VersionFanOut })),
);
import { CommentLayer } from "./CommentLayer.tsx";
import { ModuleUnderlays } from "./ModuleUnderlays.tsx";
import { CursorLayer } from "./CursorLayer.tsx";
import { CursorGlow } from "./CursorGlow.tsx";
/**
 * **A canvas with no ground downloads no ground** (#195) — which today is
 * every canvas. The layer AND the theme it picks are both behind this, so the
 * entry chunk carries only the one comparison that decides whether to ask.
 */
const CanvasThemeLayer = lazy(() =>
  import("./CanvasThemeLayer.tsx").then((m) => ({ default: m.CanvasThemeLayer })),
);
import { InkLayer, SketchBar } from "./InkLayer.tsx";
import { EdgeRadar } from "./EdgeRadar.tsx";

// WebKit-only trackpad pinch event; not in the standard TS DOM lib.
interface GestureEvent extends UIEvent {
  readonly scale: number;
  readonly clientX: number;
  readonly clientY: number;
}

// How briskly a Chrome/Firefox trackpad pinch (a ctrlKey wheel) zooms: the
// exponent on deltaY. Higher = snappier. 0.0022 felt sluggish next to Figma;
// this is roughly 2.5× that. Safari's gesture path is already 1:1 with the
// physical pinch (e.scale), so it needs no such constant.
const PINCH_ZOOM_SENSITIVITY = 0.0055;

// The Pen, in SCREEN pixels: how wide a stroke looks under the nib, and how
// far the pointer must travel before another sample is kept. Both are divided
// by the zoom to reach world units, so ink drawn at 400% is as fine as it
// looked while you drew it.
const INK_WIDTH = 3;
const INK_MIN_STEP = 2;


export function CanvasViewport({ canvasId, actor }: { canvasId: string; actor: Actor }) {
  /**
   * **The past wins when there is one.** The scrubber folds a moment with
   * core's `at` and parks it beside the live replica (`canvasStore.past`);
   * every reader prefers it, so one selector turns the whole canvas into the
   * canvas as it stood. The live replica keeps streaming underneath and is
   * never written to — a tail landing while somebody is looking at last
   * Tuesday must not be folded onto last Tuesday.
   */
  const canvas = useCanvasStore((s) => s.past?.canvas ?? s.canvas);
  /* Only to SAY it is the past — the write door in the store is what
     actually refuses changes. */
  const inPast = useCanvasStore((s) => s.past !== null);
  /* The one comparison the entry chunk pays for: whether to ask for a ground
     at all. Everything that draws one is behind it. */
  const themed = useCanvasStore((s) => (s.project ? hasGround(s.project) : false));
  /**
   * `themed` here turns the grid off in the STYLESHEET, and only for a ground
   * that travels with the canvas (#195). A pinned ground skips that rule and
   * the grid still does not show: the ground is an opaque `inset: 0` child of
   * this element, so it covers the parent background either way. Measured
   * 7 Sep 2026, after the comment on `THEME_ANCHOR_PROP` had claimed for a day
   * that the grid came back — read that one before changing this line.
   */
  const isPlace = useCanvasStore((s) => s.project !== null && groundIsPlace(s.project));
  /* One timer for the whole canvas — see `useSettling`. The set is usually
     empty, and when it is, nothing is scheduled at all. */
  const settling = useSettling();
  const viewport = useUiStore((s) => s.viewport);
  const commentMode = useUiStore((s) => s.commentMode);
  const activeTool = useUiStore((s) => s.activeTool);
  const stamp = useUiStore((s) => s.stamp);
  const canEdit = useCanEdit();
  const railPanning = useUiStore((s) => s.railPanning);
  const menu = useUiStore((s) => s.contextMenu);
  const navigate = useNavigate();
  const fannedItemId = useUiStore((s) => s.fannedItemId);
  const ref = useRef<HTMLDivElement>(null);
  const [dropping, setDropping] = useState(false);
  const [dropMessage, setDropMessage] = useState("Drop to add to the canvas");
  /**
   * The drop overlay dies of silence, never of bookkeeping.
   *
   * It used to be cleared by `dragleave` — but only when the event's target
   * was the viewport itself, and dragleave fires on whichever CHILD the
   * pointer was last over. Leave the window over an item, Esc a drag, or
   * release over a panel or the browser chrome, and the equality failed and
   * the full-screen "Drop to add" overlay stood forever, over a drag nobody
   * was making. There is no bookkeeping of enter/leave pairs that survives
   * every way a drag can end — the browser does not promise the pairs — so
   * the overlay is kept alive by the one signal that IS promised: `dragover`
   * fires every ~350ms while a drag is over the window, even stationary.
   * When it stops arriving, the drag is over, whatever ended it.
   */
  const droppingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragAlive = () => {
    setDropping(true);
    if (droppingTimer.current) clearTimeout(droppingTimer.current);
    droppingTimer.current = setTimeout(() => { setDropping(false); useUiStore.getState().setGroupDropTarget(null); }, 700);
  };
  // Mirrored into the store as well as kept locally: lane-follow stops
  // measuring while the canvas is moving, and only the store crosses
  // components. Local state stays because the class name is applied here.
  const [panning, setPanningLocal] = useState(false);
  const setPanning = (on: boolean) => {
    setPanningLocal(on);
    useUiStore.getState().setPanning(on);
  };
  // The tool to restore when a momentary Space-grab ends (null when not held).
  const spacePrevTool = useRef<Tool | null>(null);
  // Zoom tool via Z: the tool it interrupted (to restore on a hold-release),
  // and when Z went down (to tell a quick tap from a hold).
  const zoomPrevTool = useRef<Tool | null>(null);
  const zoomDownAt = useRef(0);
  // Holding P: the tool it interrupted, when it went down, and whether it is
  // down NOW — that last one is the whole feature. While it is true the ink
  // does not settle, so every stroke of the hold lands in one drawing.
  const penPrevTool = useRef<Tool | null>(null);
  const penDownAt = useRef(0);
  /**
   * **The other hold-to-borrow tools, in one mechanism** (7 Sep 2026).
   *
   * Space, P and Z each grew their own pair of refs because each carries
   * something extra — Space is hold-only, P keeps the ink wet for the whole
   * press, Z latches on a tap. H and T carry nothing extra, so they share one.
   *
   * They had no hold at all until now, and worse: they were plain TOGGLES
   * living in `CanvasPage`'s key handler with no `e.repeat` guard, so holding
   * H flipped hand → select → hand → select for as long as you held it. Dion:
   * *"if I hold down H for hand, it jumps between the V/select and the H
   * tool... P works correctly. T does the bouncing."*
   *
   * The cause is the same thing that made P right and H wrong: tool keys were
   * handled in two files with two different shapes. They are handled here now.
   */
  /**
   * The tool a held key borrowed, and whether the hold was USED — a hold that
   * placed something is a person saying "I am doing several of these", so it
   * latches on release instead of handing the tool back (9 Sep 2026).
   */
  const holdTool = useRef<{ code: string; prev: Tool; downAt: number; used?: boolean } | null>(null);
  const penHeld = useRef(false);
  // Pending settle: the ink becomes an item when this fires (see INK_SETTLE_MS).
  const settleTimer = useRef<number | null>(null);
  // The running coast's stopper, reachable from the wheel effect below
  // without being one of its dependencies (a ref, not a closure).
  const stopCoastRef = useRef<() => void>(() => {});

  // A macOS trackpad pinch is a wheel event with ctrlKey set (Chrome/Firefox)
  // or a gesture event (Safari). Left alone, the browser zooms the whole page —
  // the toolbar, minimap, and shelf scale and scroll off. We must preventDefault
  // to suppress that, which needs a NON-passive listener (React's synthetic
  // wheel is passive, so we attach by hand). And we listen on `window` in the
  // capture phase, not on the canvas element: the toolbar/minimap/shelf sit on
  // top of the canvas as siblings, so a pinch whose cursor is over one of them
  // would never reach a canvas-scoped listener and the page would zoom anyway.
  useEffect(() => {
    /** The first thing under here that can actually scroll, or null. */
    function scrollerIn(root: Element): Element | null {
      const candidates = [root, ...root.querySelectorAll("*")];
      for (const el of candidates) {
        if (el.scrollHeight <= el.clientHeight + 1) continue;
        const overflow = getComputedStyle(el).overflowY;
        if (overflow === "auto" || overflow === "scroll") return el;
      }
      return null;
    }

    /** Scroll a selected item's content. True when it took the gesture. */
    function scrollSelectedContent(target: HTMLElement, dx: number, dy: number): boolean {
      const frame = target.closest?.("[data-item-id]");
      const id = frame?.getAttribute("data-item-id");
      if (!id || !useUiStore.getState().selectedItemIds.includes(id)) return false;
      const content = frame!.querySelector(".item-content");
      if (!content) return false;
      const scroller = scrollerIn(content);
      if (!scroller) return false;
      scroller.scrollTop += dy;
      scroller.scrollLeft += dx;
      // NO CHAINING. A scrollable region inside a page hands the rest of the
      // gesture back when it reaches its end, and that is right there: the
      // region is part of the page you were already reading. Here the outer
      // thing is an infinite canvas, and selecting the item was an explicit
      // "I am working in this" — so reaching the bottom of a document should
      // not fling the whole canvas away and make you find your place again.
      // The same reasoning `overscroll-behavior: contain` encodes, which this
      // stylesheet already uses on the face card's list.
      return true;
    }

    function onWheel(e: WheelEvent) {
      const target = e.target as HTMLElement;
      if (e.ctrlKey || e.metaKey) {
        // Pinch (or ctrl+wheel): always own it, wherever the cursor is, so the
        // browser never page-zooms. Zoom the canvas at the cursor instead.
        e.preventDefault();
        const factor = Math.exp(-e.deltaY * PINCH_ZOOM_SENSITIVITY);
        const ui = useUiStore.getState();
        ui.setViewport(zoomAt(ui.viewport, e.clientX, e.clientY, factor));
        return;
      }
      // Plain two-finger scroll pans the canvas — but only over the canvas
      // itself, and never over something that scrolls its own content: a thread
      // popover, or the content of an entered item (`.inert` marks content not
      // handed over yet). Elsewhere (toolbar, panels) let the scroll be.
      if (!target.closest?.(".canvas-viewport")) return;
      if (target.closest?.(".thread-popover, .item-content:not(.inert)")) return;
      // A SELECTED item scrolls its own content, without being entered.
      //
      // Scrolling is a wheel gesture and moving is a pointer gesture, so they
      // do not collide: the content stays `pointer-events: none`, a drag still
      // moves the item, and only the wheel is handed over. Making selection
      // hand over the POINTER instead would have cost drag-to-move, which is
      // the whole reason to select something.
      //
      // Nothing here reaches an iframe: a page in a sandboxed frame is
      // cross-origin and cannot be scrolled from outside, so an HTML item
      // still has to be entered. That is the sandbox doing its job, not an
      // oversight.
      if (scrollSelectedContent(target, e.deltaX, e.deltaY)) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      // A wheel during a coast takes over from it.
      stopCoastRef.current();
      const ui = useUiStore.getState();
      ui.setViewport(pan(ui.viewport, -e.deltaX, -e.deltaY));
    }
    window.addEventListener("wheel", onWheel, { passive: false, capture: true });

    // Safari/WebKit trackpad pinch does NOT synthesize a ctrlKey wheel (that is
    // Chrome's behavior, handled above) — it fires gesture events instead.
    // `e.scale` is cumulative from gesturestart, so we zoom by the delta since
    // the last event.
    let gestureScale = 1;
    function onGestureStart(e: GestureEvent) {
      e.preventDefault();
      gestureScale = e.scale;
    }
    function onGestureChange(e: GestureEvent) {
      e.preventDefault();
      const factor = e.scale / gestureScale;
      gestureScale = e.scale;
      const ui = useUiStore.getState();
      ui.setViewport(zoomAt(ui.viewport, e.clientX, e.clientY, factor));
    }
    function onGestureEnd(e: GestureEvent) {
      e.preventDefault();
    }
    const opts = { passive: false, capture: true } as const;
    window.addEventListener("gesturestart", onGestureStart as EventListener, opts);
    window.addEventListener("gesturechange", onGestureChange as EventListener, opts);
    window.addEventListener("gestureend", onGestureEnd as EventListener, opts);

    return () => {
      window.removeEventListener("wheel", onWheel, true);
      window.removeEventListener("gesturestart", onGestureStart as EventListener, true);
      window.removeEventListener("gesturechange", onGestureChange as EventListener, true);
      window.removeEventListener("gestureend", onGestureEnd as EventListener, true);
    };
  }, []);

  // Hold-to-mode keys. Space: a momentary Hand grab — switch to Hand while held,
  // restore the previous tool on release. Z: the Zoom tool — a quick TAP latches
  // it (magnifier stays until you use it or press Esc); a HOLD is momentary
  // (release returns to the previous tool). Either way the pointer becomes a
  // magnifier: hover an item to focus it and click to fit it, or drag a region
  // to zoom into it. Actual pointer work happens in onPointerDown.
  //
  // P is the same tap/hold shape, and the hold carries a second promise: the
  // ink stays wet for the whole press, so a drawing made in passes — sketch,
  // stop, pan, add an arrow — is ONE drawing instead of one per pause.
  useEffect(() => {
    /** Let go of P: hand the tool back if this was a hold, and let the drawing
     * settle — all of it, as one item. A tap keeps the old toggle. */
    function endPenHold() {
      const ui = useUiStore.getState();
      const held = wasHeld(penDownAt.current, Date.now());
      penHeld.current = false;
      penDownAt.current = 0;
      ui.setPenSession(false);
      if (held) {
        // Momentary: you borrowed the Pen, here is your tool back.
        ui.setActiveTool(penPrevTool.current ?? "select");
      } else {
        // A tap toggles, the way P always has.
        ui.setActiveTool(penPrevTool.current === "pen" ? "select" : "pen");
      }
      penPrevTool.current = null;
      armSettle();
    }

    function down(e: KeyboardEvent) {
      if (isTyping(e.target)) return;
      if (e.code === "Space" && spacePrevTool.current === null) {
        const ui = useUiStore.getState();
        spacePrevTool.current = ui.activeTool; // capture once; keydown repeats while held
        ui.setActiveTool("hand");
      }
      if (e.code === "KeyP" && !e.metaKey && !e.ctrlKey && !e.repeat && canEditNow()) {
        const ui = useUiStore.getState();
        penPrevTool.current = ui.activeTool;
        penDownAt.current = Date.now();
        penHeld.current = true;
        // Any ink still waiting to settle joins this session rather than
        // becoming a drawing of its own a moment from now.
        holdSettle();
        ui.setActiveTool("pen");
        ui.setPenSession(true);
      }
      /**
       * **H and T: tap to latch, hold to borrow** — the shape P and Z already
       * had, and the shape Space has without the tap half.
       *
       * `e.repeat` is the fix for the bouncing on its own; the hold is the fix
       * for what Dion actually wanted, which is Space's behaviour on the tool
       * he reaches for while panning.
       */
      const momentary: Record<string, Tool> = { KeyH: "hand", KeyT: "text" };
      const wants = momentary[e.code];
      if (wants && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.repeat && holdTool.current === null) {
        const ui = useUiStore.getState();
        holdTool.current = { code: e.code, prev: ui.activeTool, downAt: Date.now() };
        ui.setActiveTool(wants);
      }
      // `!e.repeat`: a region zoom hands the tool to Select while Z is still
      // down. The next autorepeated keydown found "not zoom", re-armed the
      // tool with a fresh timestamp, and the release landed inside the tap
      // window — so a hold that had already done its job latched Zoom on.
      if (e.code === "KeyZ" && !e.metaKey && !e.ctrlKey && !e.repeat) {
        const ui = useUiStore.getState();
        if (ui.activeTool !== "zoom") {
          zoomPrevTool.current = ui.activeTool;
          zoomDownAt.current = Date.now();
          ui.setActiveTool("zoom");
        }
      }
    }
    function up(e: KeyboardEvent) {
      const held = holdTool.current;
      if (held && e.code === held.code) {
        const ui = useUiStore.getState();
        // A hold hands the tool back; a tap keeps it, and pressing the same key
        // again returns to Select — the toggle H and T have always had.
        //
        // Unless the hold was USED. Holding T, clicking, and releasing to find
        // yourself back in Select is the tool doing the opposite of what the
        // gesture asked for: you held it down BECAUSE you are placing more
        // than one.
        if (wasHeld(held.downAt, Date.now()) && held.used !== true) ui.setActiveTool(held.prev);
        else if (held.prev === ui.activeTool) ui.setActiveTool("select");
        holdTool.current = null;
      }
      if (e.code === "Space" && spacePrevTool.current !== null) {
        useUiStore.getState().setActiveTool(spacePrevTool.current);
        spacePrevTool.current = null;
      }
      if (e.code === "KeyP" && penDownAt.current !== 0) {
        // Only a press we started. Typing "p" in a comment box was ignored on
        // the way down and reached for the Pen on the way up, because a keyup
        // with no keydown behind it still ran the tap branch. Guarding on the
        // TARGET would be wrong in the other direction: press P on the canvas,
        // click into a field, let go — that release is still ours.
        endPenHold();
      }
      if (e.code === "KeyZ") {
        const ui = useUiStore.getState();
        // Held long enough to be a hold (not a tap): momentary — leave zoom.
        if (ui.activeTool === "zoom" && zoomDownAt.current && Date.now() - zoomDownAt.current > 250) {
          ui.setActiveTool(zoomPrevTool.current ?? "select");
          zoomPrevTool.current = null;
        }
        zoomDownAt.current = 0;
      }
    }
    /**
     * **A keyup that never comes is the failure mode.** Press P, switch
     * windows, and the release lands somewhere else while your drawing stays
     * wet and invisible to everyone. Losing the window ends the hold and
     * settles it.
     *
     * All THREE momentary holds, not just the pen. Space and Z are the same
     * bug with a quieter symptom: hold either, switch tabs, let go over
     * there, and you come back to a canvas stuck in Hand or Zoom with no
     * key held and nothing on screen saying why. The pen was fixed when it
     * cost a lost drawing; the other two were left because they only cost
     * confusion, which is the reason bugs like this survive.
     */
    function onBlur() {
      if (holdTool.current !== null) {
        useUiStore.getState().setActiveTool(holdTool.current.prev);
        holdTool.current = null;
      }
      if (penHeld.current) endPenHold();
      if (spacePrevTool.current !== null) {
        useUiStore.getState().setActiveTool(spacePrevTool.current);
        spacePrevTool.current = null;
      }
      if (zoomPrevTool.current !== null) {
        useUiStore.getState().setActiveTool(zoomPrevTool.current);
        zoomPrevTool.current = null;
        zoomDownAt.current = 0;
      }
    }
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", onBlur);
    };
    // `armSettle` is redeclared every render, so listing it would tear these
    // three window listeners down and rebuild them on every frame of a pan.
    // It is safe to omit because it closes over nothing that goes stale: the
    // pen's held-ness is a ref, and the canvas and actor are fixed for the
    // life of the route.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A stroke in progress postpones the settle; lifting the pen starts the
  // clock again. Whatever is pending when the canvas unmounts is placed by
  // CanvasPage, so nothing is ever left un-drawn.
  function holdSettle() {
    if (settleTimer.current !== null) {
      clearTimeout(settleTimer.current);
      settleTimer.current = null;
    }
  }
  function armSettle() {
    holdSettle();
    const delay = settleDelay({ holdingPen: penHeld.current });
    // Held: the drawing is not finished, and no timer gets to decide it is.
    if (delay === null) return;
    settleTimer.current = window.setTimeout(() => {
      settleTimer.current = null;
      placeSketch(canvasId, actor);
    }, delay);
  }
  useEffect(() => holdSettle, []);

  /**
   * **Right-click: the menu for what is under the pointer.**
   *
   * Right-clicking an item that is not selected SELECTS it first — otherwise
   * "Delete" on the menu you opened over one thing deletes a different thing,
   * which is the worst possible surprise from a menu. Right-clicking inside
   * an existing multi-selection leaves it alone, so "Copy 5 items" still
   * means the five you had.
   */
  function onContextMenu(e: React.MouseEvent) {
    const ui = useUiStore.getState();
    const canvas = useCanvasStore.getState().canvas;
    if (!canvas) return;
    const target = (e.target as HTMLElement).closest?.("[data-item-id]");
    const rawItemId = target?.getAttribute("data-item-id") ?? null;
    const itemId = rawItemId ? scopedHit(rawItemId) : null;
    e.preventDefault();

    if (itemId) {
      const within = ui.selectedItemIds.includes(itemId);
      const ids = within && ui.selectedItemIds.length > 1 ? ui.selectedItemIds : [itemId];
      if (!within) ui.setSelection([itemId]);
      const items = ids
        .map((id) => canvas.items[id])
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
      if (items.length === 0) return;
      const at = { x: e.clientX, y: e.clientY };
      const world = screenToWorld(ui.viewport, e.clientX, e.clientY);
      void menus().then(({ itemMenu }) =>
        openContextMenu(at, itemMenu(items, { canvasId, actor, world, navigate })),
      );
      return;
    }
    const at = { x: e.clientX, y: e.clientY };
    const world = screenToWorld(ui.viewport, e.clientX, e.clientY);
    void menus().then(({ canvasMenu }) =>
      openContextMenu(at, canvasMenu({ canvasId, actor, world, navigate })),
    );
  }

  /**
   * **Fingers currently down on the canvas** (#182 stage 0), by pointer id.
   *
   * Touch only. A mouse has one pointer and none of the two-finger reasoning
   * below applies to it — every mouse gesture on this canvas behaves exactly
   * as it did, which is the constraint that makes this change safe to ship
   * without a device in the room.
   */
  const fingers = useRef(new Map<number, { x: number; y: number }>());
  /**
   * How to abandon the one-finger gesture in flight, when a second finger
   * arrives and turns it into a pinch.
   *
   * Named for what it must do rather than what it is: **replace the first
   * gesture, do not extend it.** A pan that keeps running while a pinch zooms
   * is the line-between-the-fingers bug, where the canvas both follows one
   * finger and scales about both, and it is what happens when the second
   * pointer is treated as an addition.
   */
  const abandonGesture = useRef<(() => void) | null>(null);

  /** The two fingers a pinch is about, oldest first so the pair is stable
   *  across a move — a third finger is ignored rather than joining. */
  function twoFingers(): TwoPoints | null {
    const [a, b] = [...fingers.current.values()];
    return a && b ? { a, b } : null;
  }

  /** What a press on empty canvas that turned out to be a TAP does: the same
   *  thing a click on the background has always done. Shared by the marquee
   *  and by the touch pan that replaced it, so a phone and a mouse agree
   *  about what "I pressed nothing" means. */
  function clearBackgroundFocus() {
    const state = useUiStore.getState();
    state.select(null);
    state.setOpenThread(null);
    state.setPendingComment(null);
  }

  function onPointerDown(e: React.PointerEvent) {
    const isBackground = e.target === ref.current || (e.target as HTMLElement).classList.contains("world");
    // Middle-drag or the Hand tool pan. (Space is momentary Hand, so it flows
    // through activeTool too.) The Hand tool pans from anywhere — an item
    // yields its pointer when it is active — so it is not gated on background.
    // A press during a coast stops it where it is — nobody waits for the
    // canvas to finish moving.
    stopCoast();

    /**
     * **Two fingers are a pinch, whatever the first one had started** (#182
     * stage 0). Zoom on this canvas was the +/- buttons and a trackpad; a
     * phone has neither.
     *
     * Before every tool branch below, because a pinch is not a tool: spreading
     * two fingers while the Pen is up should zoom rather than draw a line
     * between them. A third finger is ignored — it is a palm, or a person
     * steadying the phone, and neither is a gesture.
     */
    if (e.pointerType === "touch") {
      fingers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (fingers.current.size === 2) {
        startPinch();
        return;
      }
      if (fingers.current.size > 2) return;
    }

    const wantsPan = e.button === 1 || (activeTool === "hand" && e.button === 0);

    if (activeTool === "zoom" && e.button === 0) {
      // Click an item → fit it; drag the background → zoom into that region.
      const itemId = (e.target as HTMLElement).closest?.("[data-item-id]")?.getAttribute("data-item-id");
      if (itemId) {
        zoomToItem(itemId); // sticky tap stays in zoom; a hold reverts on keyup
        return;
      }
      startZoomRegion(e);
      return;
    }

    // The Pen draws from anywhere — over items too, so you can annotate one.
    if (activeTool === "pen" && e.button === 0 && !wantsPan) {
      startStroke(e);
      return;
    }

    // The Text tool: click open canvas and a composer opens there. **The tool
    // STAYS on**, which is a reversal — it used to drop back to Select on the
    // grounds that "the next thing somebody wants after typing is to move what
    // they typed". That is true for one label and wrong for the job people
    // actually do with it, which is labelling six things in a row; it meant
    // reaching for the tool again between every one. Reported as exactly that.
    //
    // The gesture composes rather than conflicting: pressing on the canvas
    // while a composer is open commits it (the document-level listener in
    // `TextComposer` runs in the capture phase, before this) and then opens
    // the next one here. One press, finish this, start the next — which is
    // what staying in a tool is supposed to feel like. Escape closes without
    // committing; V or Select leaves the mode.
    if (isBackground && activeTool === "text" && e.button === 0 && !wantsPan) {
      // The press must NOT do its default focusing, or the browser moves
      // focus to the canvas a beat after the composer mounts and asks for it
      // — the composer blurs on the same gesture that opened it, commits
      // nothing, and closes. It looks exactly like the tool doing nothing.
      e.preventDefault();
      const ui = useUiStore.getState();
      const world = screenToWorld(ui.viewport, e.clientX, e.clientY);
      /**
       * **Holding T means "several"; clicking with the tool means "one".**
       *
       * > "when you click away it switches to the select tool UNLESS the user
       * > was holding down the T key when they clicked"
       *
       * The tool was already tap-to-latch, hold-to-borrow. This gives the two
       * gestures different ENDINGS as well as different beginnings: a borrowed
       * tool that placed something keeps itself (the hold is marked used, so
       * releasing T no longer hands it back), and a latched one puts a single
       * node down and returns to Select when the composer closes.
       *
       * Read at the moment of the press, deliberately. Whether T is still down
       * when you finish typing is not the question — you cannot type with it
       * held, and the intent was declared when you clicked.
       */
      const borrowing = holdTool.current?.code === "KeyT";
      if (borrowing && holdTool.current !== null) holdTool.current.used = true;
      ui.setPendingText({
        x: Math.round(world.x),
        y: Math.round(world.y),
        itemId: null,
        body: "",
        // A new node opens at the step and face you last used. Labelling six
        // clusters means choosing "title" once, not six times.
        style: ui.lastTextStyle,
        face: ui.lastTextFace,
        paper: ui.lastPaper,
        oneShot: !borrowing,
      });
      return;
    }

    if (isBackground && commentMode && e.button === 0 && !wantsPan) {
      const ui = useUiStore.getState();
      const world = screenToWorld(ui.viewport, e.clientX, e.clientY);
      ui.setPendingComment({ x: world.x, y: world.y, anchorItemId: null });
      ui.setCommentMode(false);
      return;
    }

    if (wantsPan) {
      startPan(e);
    } else if (isBackground && e.button === 0) {
      /**
       * **A finger on empty canvas MOVES the canvas** (#182 stage 0).
       *
       * It used to start a marquee, which is why an isocan canvas could not be
       * moved with a finger at all: `touch-action: none` switches the
       * browser's own pan off, correctly for a canvas that handles touch
       * itself and a trap for one that does not, and the Hand tool — the way
       * out on a mouse — is a 24px button on a rail.
       *
       * A marquee is a mouse gesture. It needs a pointer you can place
       * precisely, it wants Shift to add, and on a phone the thing you want
       * from a blank patch of canvas is to go somewhere else. So on a coarse
       * pointer the marquee is REPLACED rather than sharing the gesture: one
       * finger pans, and a press that never moves still clears the selection,
       * so a tap means what a click has always meant.
       */
      if (e.pointerType === "touch") startPan(e, { tapClears: true });
      else startMarquee(e);
    }
  }

  /**
   * **A pinch: two fingers, tracked as a pair** (#182 stage 0).
   *
   * The arithmetic is `pinch` in `lib/viewport.ts` — zoom about where the
   * fingers were, then translate by how far their midpoint travelled — so
   * what lives here is only the bookkeeping: abandon whatever one finger had
   * started, follow both, and hand back to nothing when a finger lifts.
   *
   * **Lifting one finger ENDS the gesture rather than becoming a pan**, and
   * that is deliberate. Continuing as a one-finger pan from a hand that is
   * mid-pinch means the canvas lurches on the frame the second finger leaves,
   * because the remaining finger is nowhere near where a pan would have
   * started. Ending is a canvas that stops; the person puts a finger back
   * down and pans, which costs nothing.
   */
  function startPinch() {
    abandonGesture.current?.();
    const el = ref.current!;
    stopCoast();
    let last = twoFingers();
    if (!last) return;
    setPanning(true);

    function onMove(ev: PointerEvent) {
      if (!fingers.current.has(ev.pointerId)) return;
      fingers.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      const now = twoFingers();
      if (!now || !last) return;
      const ui = useUiStore.getState();
      ui.setViewport(pinch(ui.viewport, last, now));
      last = now;
    }
    function done(ev: PointerEvent) {
      fingers.current.delete(ev.pointerId);
      if (fingers.current.size >= 2) {
        // A third finger lifted and two are still down: keep pinching, but
        // re-read the pair, because it may not be the pair it was.
        last = twoFingers();
        return;
      }
      stop();
    }
    function stop() {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", done);
      el.removeEventListener("pointercancel", done);
      abandonGesture.current = null;
      setPanning(false);
      // No coast off a pinch: a flick out of a zoom is a hand leaving the
      // screen, not a throw.
    }
    abandonGesture.current = stop;
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", done);
    el.addEventListener("pointercancel", done);
  }

  /** One stroke, from pen-down to pen-up. Samples land in world coordinates
   * so the ink is anchored to the canvas, not to the screen; the stroke joins
   * the wet sketch, which stays this client's until it is placed. */
  function startStroke(e: React.PointerEvent) {
    e.preventDefault();
    const el = ref.current!;
    el.setPointerCapture(e.pointerId);
    holdSettle();
    const ui = useUiStore.getState();
    ui.beginStroke({
      points: [screenToWorld(ui.viewport, e.clientX, e.clientY)],
      color: ui.inkColor ?? actorColor(actor.id),
      width: INK_WIDTH / ui.viewport.scale,
    });
    let last = { x: e.clientX, y: e.clientY };

    function onMove(ev: PointerEvent) {
      if (Math.hypot(ev.clientX - last.x, ev.clientY - last.y) < INK_MIN_STEP) return;
      last = { x: ev.clientX, y: ev.clientY };
      const state = useUiStore.getState();
      state.extendStroke(screenToWorld(state.viewport, ev.clientX, ev.clientY));
    }
    // pointercancel matters here in a way it does not for a pan: a stroke the
    // browser takes away (palm rejection, a system gesture) would otherwise
    // leave the sampler attached and keep drawing on every later mouse move.
    function onUp(ev: PointerEvent) {
      if (el.hasPointerCapture(ev.pointerId)) el.releasePointerCapture(ev.pointerId);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      armSettle();
    }
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
  }

  /**
   * **Pan inertia** (motion note, recommendation 1): a Hand or middle-button
   * drag coasts after release, the way every canvas people arrive from
   * does. The arithmetic is `lib/inertia.ts`; this is the loop, and the two
   * conditions only the viewport can keep — interruptible (a press or a
   * wheel stops it where it is, see `stopCoast`) and off under reduced
   * motion, which the note calls the honest cost.
   */
  const coasting = useRef<number | null>(null);
  function stopCoast() {
    if (coasting.current !== null) {
      cancelAnimationFrame(coasting.current);
      coasting.current = null;
      setPanning(false);
    }
  }
  stopCoastRef.current = stopCoast;
  function startCoast(v: { vx: number; vy: number }) {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let velocity = v;
    let lastAt = performance.now();
    setPanning(true);
    const frame = (now: number) => {
      const step = coastFrame(velocity, Math.min(now - lastAt, 64));
      lastAt = now;
      velocity = step.next;
      const ui = useUiStore.getState();
      ui.setViewport(pan(ui.viewport, step.dx, step.dy));
      if (step.done) {
        coasting.current = null;
        setPanning(false);
        return;
      }
      coasting.current = requestAnimationFrame(frame);
    };
    coasting.current = requestAnimationFrame(frame);
  }

  function startPan(e: React.PointerEvent, opts: { tapClears?: boolean } = {}) {
    e.preventDefault();
    stopCoast();
    const el = ref.current!;
    el.setPointerCapture(e.pointerId);
    setPanning(true);
    const from = { x: e.clientX, y: e.clientY };
    let last = { ...from };
    let moved = false;
    // The last moments of the drag, for the flick's speed at release.
    const samples: Sample[] = [{ t: performance.now(), x: e.clientX, y: e.clientY }];

    function onMove(ev: PointerEvent) {
      const dx = ev.clientX - last.x;
      const dy = ev.clientY - last.y;
      last = { x: ev.clientX, y: ev.clientY };
      // The same 4px the marquee uses before it believes a press was a drag:
      // a finger resting on glass reports movement, so a tap that pans by two
      // pixels must still be a tap.
      if (!moved && Math.hypot(ev.clientX - from.x, ev.clientY - from.y) >= 4) moved = true;
      samples.push({ t: performance.now(), x: ev.clientX, y: ev.clientY });
      if (samples.length > 12) samples.shift();
      const ui = useUiStore.getState();
      ui.setViewport(pan(ui.viewport, dx, dy));
    }
    function onUp(ev: PointerEvent) {
      fingers.current.delete(ev.pointerId);
      stop(ev.pointerId);
      // A press that never moved is a TAP, and on a coarse pointer this
      // gesture replaced the marquee — so it owes the marquee's answer to
      // "I pressed nothing".
      if (!moved && opts.tapClears && ev.type !== "pointercancel") {
        leaveGroupAtPoint(screenToWorld(useUiStore.getState().viewport, ev.clientX, ev.clientY));
        clearBackgroundFocus();
      }
      const v = moved ? flickVelocity(samples, performance.now()) : null;
      if (v) startCoast(v);
    }
    function stop(pointerId: number) {
      if (el.hasPointerCapture(pointerId)) el.releasePointerCapture(pointerId);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      abandonGesture.current = null;
      setPanning(false);
    }
    // What a second finger calls to take the gesture over. It must not coast:
    // the hand did not let go, it added a finger.
    abandonGesture.current = () => stop(e.pointerId);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
  }

  /** The Zoom tool's drag: rubber-band a region, then fit it and hand the
   * pointer back to Select. A no-move click does nothing (stays in zoom). */
  function startZoomRegion(e: React.PointerEvent) {
    e.preventDefault();
    const el = ref.current!;
    el.setPointerCapture(e.pointerId);
    const startScreen = { x: e.clientX, y: e.clientY };
    const startWorld = screenToWorld(useUiStore.getState().viewport, e.clientX, e.clientY);
    let moved = false;

    function onMove(ev: PointerEvent) {
      if (!moved && Math.hypot(ev.clientX - startScreen.x, ev.clientY - startScreen.y) < 4) return;
      moved = true;
      const cur = screenToWorld(useUiStore.getState().viewport, ev.clientX, ev.clientY);
      useUiStore.getState().setMarquee({ x1: startWorld.x, y1: startWorld.y, x2: cur.x, y2: cur.y });
    }
    function onUp(ev: PointerEvent) {
      el.releasePointerCapture(ev.pointerId);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      const ui = useUiStore.getState();
      ui.setMarquee(null);
      if (moved) {
        const end = screenToWorld(ui.viewport, ev.clientX, ev.clientY);
        zoomToBox({
          minX: Math.min(startWorld.x, end.x),
          minY: Math.min(startWorld.y, end.y),
          maxX: Math.max(startWorld.x, end.x),
          maxY: Math.max(startWorld.y, end.y),
        });
        ui.setActiveTool("select"); // a region zoom returns you to Select
        zoomPrevTool.current = null;
      }
    }
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
  }

  /** Figma-style rubber-band: live intersection hit-test; shift adds to the
   * selection present when the gesture started; a no-move click clears. */
  function startMarquee(e: React.PointerEvent) {
    e.preventDefault();
    const el = ref.current!;
    el.setPointerCapture(e.pointerId);
    const ui = useUiStore.getState();
    const additive = e.shiftKey;
    const startWorld = screenToWorld(ui.viewport, e.clientX, e.clientY);
    leaveGroupAtPoint(startWorld);
    // Leaving scope clears its child selection before Shift captures a base.
    const baseSelection = additive ? useUiStore.getState().selectedItemIds : [];

    let moved = false;

    function onMove(ev: PointerEvent) {
      if (!moved && Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < 4) return;
      moved = true;
      const state = useUiStore.getState();
      const current = screenToWorld(state.viewport, ev.clientX, ev.clientY);
      state.setMarquee({ x1: startWorld.x, y1: startWorld.y, x2: current.x, y2: current.y });

      const minX = Math.min(startWorld.x, current.x);
      const maxX = Math.max(startWorld.x, current.x);
      const minY = Math.min(startWorld.y, current.y);
      const maxY = Math.max(startWorld.y, current.y);
      const currentCanvas = useCanvasStore.getState().canvas;
      const eligible = currentCanvas && groupsEnabled() ? groupScopeRoots(currentCanvas, state.activeGroupId) : Object.values(currentCanvas?.items ?? {});
      const hit = eligible
        .filter(
          (item) =>
            item.x < maxX && item.x + item.width > minX && item.y < maxY && item.y + item.height > minY,
        )
        .map((item) => item.id);
      state.setSelection([...new Set([...baseSelection, ...hit])]);
    }
    function onUp(ev: PointerEvent) {
      el.releasePointerCapture(ev.pointerId);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      const state = useUiStore.getState();
      state.setMarquee(null);
      // Plain background click: clear selection / close things. Shared with
      // the touch pan that replaced this gesture on a coarse pointer, so a
      // tap and a click mean the same thing.
      if (!moved && !additive) clearBackgroundFocus();
    }
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
  }

  async function onDrop(e: React.DragEvent) {
    e.preventDefault();
    if (droppingTimer.current) clearTimeout(droppingTimer.current);
    setDropping(false);
    if (!canEditNow()) return; // a reader has nowhere to put a file
    const files = Array.from(e.dataTransfer.files);
    const ui = useUiStore.getState();
    const world = screenToWorld(ui.viewport, e.clientX, e.clientY);
    const target = !e.altKey && canvas && groupsEnabled() ? groupDropTarget(canvas, world, []) : null;
    const destination = { ...creationDestination(target?.id ?? ui.activeGroupId), ...(target ? { groupPlacement: groupDropPolicy(target, world) } : {}) };
    ui.setGroupDropTarget(null);

    /**
     * **A module's claim on a dragged mime, before the built-ins** (#156).
     *
     * Only when there are no files: a native OS drop is the shell's own
     * gesture and a module intercepting it would be taking over the app's
     * behaviour rather than adding its own. What is left is a drag started
     * inside the page — a tray, a palette — which is exactly what a module
     * needs and what nothing could catch before.
     *
     * The module returns ops and the shell sends them, like every other write
     * a module makes. Its own failure is said out loud rather than left as an
     * unhandled rejection, the way the upload's is below.
     */
    if (files.length === 0) {
      const claim = moduleDropFor(Array.from(e.dataTransfer.types));
      if (claim) {
        const data = e.dataTransfer.getData(claim.mimeType);
        try {
          const host = webHostFor(canvasId, actor, destination);
          const ops = await claim.run({
            canvasId,
            ...destination,
            data,
            mimeType: claim.mimeType,
            at: { x: Math.round(world.x), y: Math.round(world.y) },
            host,
          });
          // One drop is one act, however many ops it took.
          if (ops && ops.length > 0) await host.send(ops, newGroupId());
        } catch (err) {
          setNotice(err instanceof Error && err.message ? err.message : "That could not be dropped here.");
        }
        return;
      }
    }

    // A dragged link or tab arrives as text/uri-list — the same type a
    // browser item's blob stores — and lands as a projected site (#40).
    if (files.length === 0) {
      const link = parseUriList(e.dataTransfer.getData("text/uri-list"));
      if (link) {
        // Not http(s) — nothing to project, and nothing to say: a mailto:
        // dragged onto the canvas is not a failure. Past that test, any
        // throw is the upload's own, and is said (#51).
        if (!/^https?:\/\//i.test(link)) return;
        const { addBrowserItem } = await import("../lib/upload.ts");
        try {
          selectCreatedItems(canvasId, [await addBrowserItem(canvasId, actor, link, world, destination)]);
        } catch (err) {
          setNotice(err instanceof Error && err.message ? err.message : "That site could not be added.");
        }
      }
      return;
    }

    // Dropping a single file onto an existing item = new version of that item.
    const versionTarget = reachableVersionTarget(e.target as HTMLElement);
    if (versionTarget && files.length === 1) {
      const { addVersionFromFile } = await import("../lib/upload.ts");
      try {
        await addVersionFromFile(canvasId, actor, versionTarget.id, files[0]!);
      } catch (err) {
        setNotice(
          `${files[0]!.name}: ${err instanceof Error && err.message ? err.message : "could not be added as a version"}`,
        );
      }
      return;
    }
    // The drop's own failure, said out loud rather than left as an unhandled
    // rejection: offline, files are not queued (phase 10's deferred scope) and
    // `uploadBlob` throws with the sentence that explains why.
    // Dropped AT the pointer: chosen, so the files stay where they were let
    // go rather than being tidied clear (`Placement.chosen`).
    const ids = await addFiles(canvasId, actor, files, { ...world, chosen: true }, destination).catch((err: unknown) => {
      // "2 of 5 added — <why>", and the two are selected below (#51).
      const { landed, notice } = addFailure(err, files.length, "Those files could not be added.");
      setNotice(notice);
      return landed;
    });
    // The whole drop is selected, not just the last file — you dropped five
    // things and five things are what arrived.
    if (ids.length > 0 && selectCreatedItems(canvasId, ids)) {
      const canvas = useCanvasStore.getState().canvas;
      const landed = canvas ? ids.map((id) => canvas.items[id]).filter(Boolean) : [];
      revealIfOffscreen(
        useUiStore.getState().viewport,
        landed as Parameters<typeof revealIfOffscreen>[1],
        placeableArea(),
        glideToBox,
      );
    }
  }

  function reachableVersionTarget(element: HTMLElement) {
    const id = element.closest?.("[data-item-id]")?.getAttribute("data-item-id");
    const item = id ? canvas?.items[id] : undefined;
    if (!item || isGroupItem(item)) return null;
    return !groupsEnabled() || (canvas && groupScopedRoot(canvas, item.id, useUiStore.getState().activeGroupId) === item.id) ? item : null;
  }

  // Areas first, so everything placed on a sheet paints over it: items are
  // siblings at one z-index, and DOM order is the only order there is. A
  // stable sort keeps the rest as they were.
  const items = canvas
    ? Object.values(canvas.items).sort((a, b) => Number(isArea(b) || isGroupItem(b)) - Number(isArea(a) || isGroupItem(a)) || (isGroupItem(a) && isGroupItem(b) ? groupAncestors(canvas, a.id).length - groupAncestors(canvas, b.id).length : 0))
    : [];

  return (
    <div
      ref={ref}
      className={`canvas-viewport${isPlace ? " themed" : ""}${panning ? " panning" : ""}${commentMode ? " comment-mode" : ""}${stamp ? " stamping" : ""}${activeTool === "hand" ? " hand" : ""}${activeTool === "zoom" ? " zoom" : ""}${activeTool === "pen" ? " pen" : ""}${activeTool === "text" ? " text-tool" : ""}${
        activeTool === "select" && !commentMode ? " own-cursor-on" : ""
      }`}
      style={{
        backgroundSize: `${22 * viewport.scale}px ${22 * viewport.scale}px`,
        backgroundPosition: `${viewport.tx}px ${viewport.ty}px`,
      }}
      onPointerDown={onPointerDown}
      onContextMenu={onContextMenu}
      onPointerMove={(e) => {
        const ui = useUiStore.getState();
        publishCursor(screenToWorld(ui.viewport, e.clientX, e.clientY));
      }}
      onPointerLeave={() => publishCursor(null)}
      /**
       * **Every finger that goes down has to come back up** (#182 stage 0).
       *
       * `startPan` and the pinch each forget their own pointer, but a touch
       * that started something ELSE — a stroke, an item drag, a tap on a
       * card — never reaches either. Without this the map keeps a finger
       * nobody is holding, and the NEXT single touch counts as the second and
       * starts a pinch against a ghost.
       *
       * Here rather than inside each gesture because it is not about any of
       * them: it is the bookkeeping for `pointerType === "touch"`, and a
       * gesture that forgot to prune would be a bug in a place nobody would
       * think to look. Deleting twice is free; deleting never is the bug.
       */
      onPointerUp={(e) => fingers.current.delete(e.pointerId)}
      onPointerCancel={(e) => fingers.current.delete(e.pointerId)}
      onDragOver={(e) => {
        e.preventDefault();
        dragAlive();
        const ui = useUiStore.getState();
        const target = !e.altKey && canvas && groupsEnabled() ? groupDropTarget(canvas, screenToWorld(ui.viewport, e.clientX, e.clientY), []) : null;
        const fileCount = e.dataTransfer.files.length || Array.from(e.dataTransfer.items ?? []).filter((item) => item.kind === "file").length;
        const version = fileCount === 1 ? reachableVersionTarget(e.target as HTMLElement) : null;
        const destination = target ?? (ui.activeGroupId ? canvas?.items[ui.activeGroupId] : null);
        ui.setGroupDropTarget(version ? null : destination?.id ?? null);
        setDropMessage(version ? `Drop to add a version of ${version.title}` : destination ? `Drop to add to ${destination.title}` : "Drop to add to the canvas");
      }}
      onDrop={onDrop}
    >
      {/* Under everything, including the glow: the ground is the thing the
          canvas stands on, not something drawn over it (#195). */}
      {themed && (
        <Suspense fallback={null}>
          <CanvasThemeLayer />
        </Suspense>
      )}
      <CursorGlow />
      <div
        className={`world${railPanning ? " rail-panning" : ""}${inPast ? " in-past" : ""}`}
        style={
          {
            transform: `translate(${viewport.tx}px, ${viewport.ty}px) scale(${viewport.scale})`,
            // World-space chrome divides by this so a 2px outline is 2px on
            // SCREEN at any zoom, the way the counter-scaled titlebar already
            // is. Everything inside .world is measured in world units, so a
            // literal `2px` here is 2 world px — 0.3 of a screen pixel at 16%.
            "--scale": viewport.scale,
          } as React.CSSProperties
        }
      >
        {/* Before the items, so a line passes UNDER the nodes it joins — a
            map node is chromeless text, and a line over it strikes through
            the words. */}
        <ModuleUnderlays />
        {items.map((item) => (
          <ItemView
            key={item.id}
            item={item}
            canvasId={canvasId}
            actor={actor}
            settling={settling.has(item.id)}
          />
        ))}
        {fannedItemId && canvas?.items[fannedItemId] && (
          <Suspense fallback={null}>
            <VersionFanOut item={canvas.items[fannedItemId]!} canvasId={canvasId} actor={actor} />
          </Suspense>
        )}
        <InkLayer />
        {canEdit && <TextComposer canvasId={canvasId} actor={actor} />}
      </div>
      <CommentLayer canvasId={canvasId} actor={actor} />
      <CursorLayer />
      <MarqueeRect />
      <GuideLines />
      <EdgeRadar canvasId={canvasId} />
      <SketchBar canvasId={canvasId} actor={actor} />
      {dropping && <div className="drop-overlay">{dropMessage}</div>}
      {menu && (
        <ContextMenu
          at={menu.at}
          entries={menu.entries}
          onClose={() => useUiStore.getState().setContextMenu(null)}
        />
      )}
    </div>
  );
}

/**
 * Alignment guides: while an item is in your hand, a line for every edge or
 * center it has settled onto. They run the whole viewport rather than just
 * between the two items — at canvas zooms you are usually aligning something
 * to a neighbour that is off screen, and a line you cannot see is no help.
 */
function GuideLines() {
  const guides = useUiStore((s) => s.guides);
  const spacing = useUiStore((s) => s.spacing);
  const viewport = useUiStore((s) => s.viewport);
  if (guides.length === 0 && spacing.length === 0) return null;
  return (
    <>
      {spacing.flatMap((measure) =>
        measure.gaps.map(([from, to], i) => {
          // A bar with end caps across the gap: the mark that says this
          // distance and the one on the other side are the same.
          const a = worldToScreen(
            viewport,
            measure.axis === "x" ? from : measure.at,
            measure.axis === "x" ? measure.at : from,
          );
          const b = worldToScreen(
            viewport,
            measure.axis === "x" ? to : measure.at,
            measure.axis === "x" ? measure.at : to,
          );
          return (
            <div
              key={`${measure.axis}${i}`}
              className={`spacing spacing-${measure.axis}`}
              style={
                measure.axis === "x"
                  ? { left: a.x, top: a.y, width: Math.max(b.x - a.x, 0) }
                  : { left: a.x, top: a.y, height: Math.max(b.y - a.y, 0) }
              }
            />
          );
        }),
      )}
      {guides.map((guide) =>
        guide.axis === "x" ? (
          <div
            key={`x${guide.at}`}
            className="guide guide-v"
            style={{ left: worldToScreen(viewport, guide.at, 0).x }}
          />
        ) : (
          <div
            key={`y${guide.at}`}
            className="guide guide-h"
            style={{ top: worldToScreen(viewport, 0, guide.at).y }}
          />
        ),
      )}
    </>
  );
}

function MarqueeRect() {
  const marquee = useUiStore((s) => s.marquee);
  const viewport = useUiStore((s) => s.viewport);
  if (!marquee) return null;
  const a = worldToScreen(viewport, marquee.x1, marquee.y1);
  const b = worldToScreen(viewport, marquee.x2, marquee.y2);
  return (
    <div
      className="marquee"
      style={{
        left: Math.min(a.x, b.x),
        top: Math.min(a.y, b.y),
        width: Math.abs(b.x - a.x),
        height: Math.abs(b.y - a.y),
      }}
    />
  );
}
