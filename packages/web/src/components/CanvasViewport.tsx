import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Actor } from "@isocan/core";
import { parseUriList } from "@isocan/core";
import { actorColor } from "../lib/colors.ts";
import { publishCursor, setNotice, useCanvasStore } from "../stores/canvasStore.ts";
import { type Tool, useUiStore } from "../stores/uiStore.ts";
import { pan, screenToWorld, worldToScreen, zoomAt } from "../lib/viewport.ts";
import { zoomToBox, zoomToItem } from "../lib/zoomactions.ts";
import { addFiles } from "../lib/upload.ts";
import { placeSketch } from "../lib/sketch.ts";
import { placeableArea, revealIfOffscreen } from "../lib/spot.ts";
import { glideToBox } from "../lib/zoomactions.ts";
import { settleDelay, wasHeld } from "../lib/pensession.ts";
import { isTyping } from "../lib/keys.ts";
import { TextComposer } from "./TextComposer.tsx";
import { ContextMenu, openContextMenu } from "./ContextMenu.tsx";
import { canvasMenu, itemMenu } from "../lib/menuentries.tsx";
import { ItemView } from "./ItemView.tsx";
import { VersionFanOut } from "./VersionFanOut.tsx";
import { CommentLayer } from "./CommentLayer.tsx";
import { LaneTethers } from "./LaneTethers.tsx";
import { MapEdges } from "./MapEdges.tsx";
import { CursorLayer } from "./CursorLayer.tsx";
import { CursorGlow } from "./CursorGlow.tsx";
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
  const viewport = useUiStore((s) => s.viewport);
  const commentMode = useUiStore((s) => s.commentMode);
  const activeTool = useUiStore((s) => s.activeTool);
  const railPanning = useUiStore((s) => s.railPanning);
  const menu = useUiStore((s) => s.contextMenu);
  const navigate = useNavigate();
  const fannedItemId = useUiStore((s) => s.fannedItemId);
  const ref = useRef<HTMLDivElement>(null);
  const [dropping, setDropping] = useState(false);
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
    droppingTimer.current = setTimeout(() => setDropping(false), 700);
  };
  // Mirrored into the store as well as kept locally: the lane tethers stop
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
  const penHeld = useRef(false);
  // Pending settle: the ink becomes an item when this fires (see INK_SETTLE_MS).
  const settleTimer = useRef<number | null>(null);

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
      if (e.code === "KeyP" && !e.metaKey && !e.ctrlKey && !e.repeat) {
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
      if (e.code === "KeyZ" && !e.metaKey && !e.ctrlKey) {
        const ui = useUiStore.getState();
        if (ui.activeTool !== "zoom") {
          zoomPrevTool.current = ui.activeTool;
          zoomDownAt.current = Date.now();
          ui.setActiveTool("zoom");
        }
      }
    }
    function up(e: KeyboardEvent) {
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
    // A keyup that never comes is the failure mode: press P, switch windows,
    // and the release lands somewhere else while your drawing stays wet and
    // invisible to everyone. Losing the window ends the hold and settles it.
    function onBlur() {
      if (penHeld.current) endPenHold();
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
    const itemId = target?.getAttribute("data-item-id") ?? null;
    e.preventDefault();

    if (itemId) {
      const within = ui.selectedItemIds.includes(itemId);
      const ids = within && ui.selectedItemIds.length > 1 ? ui.selectedItemIds : [itemId];
      if (!within) ui.setSelection([itemId]);
      const items = ids
        .map((id) => canvas.items[id])
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
      if (items.length === 0) return;
      openContextMenu(
        { x: e.clientX, y: e.clientY },
        itemMenu(items, { canvasId, actor, world: screenToWorld(ui.viewport, e.clientX, e.clientY), navigate }),
      );
      return;
    }
    openContextMenu(
      { x: e.clientX, y: e.clientY },
      canvasMenu({ canvasId, actor, world: screenToWorld(ui.viewport, e.clientX, e.clientY), navigate }),
    );
  }

  function onPointerDown(e: React.PointerEvent) {
    const isBackground = e.target === ref.current || (e.target as HTMLElement).classList.contains("world");
    // Middle-drag or the Hand tool pan. (Space is momentary Hand, so it flows
    // through activeTool too.) The Hand tool pans from anywhere — an item
    // yields its pointer when it is active — so it is not gated on background.
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

    // The Text tool: click open canvas and a composer opens there. It is one
    // click and out — like the Comment tool, the mode ends when it has been
    // used, because the next thing somebody wants after typing is to move
    // what they typed.
    if (isBackground && activeTool === "text" && e.button === 0 && !wantsPan) {
      // The press must NOT do its default focusing, or the browser moves
      // focus to the canvas a beat after the composer mounts and asks for it
      // — the composer blurs on the same gesture that opened it, commits
      // nothing, and closes. It looks exactly like the tool doing nothing.
      e.preventDefault();
      const ui = useUiStore.getState();
      const world = screenToWorld(ui.viewport, e.clientX, e.clientY);
      ui.setPendingText({
        x: Math.round(world.x),
        y: Math.round(world.y),
        itemId: null,
        body: "",
        // A new node opens at the step and face you last used. Labelling six
        // clusters means choosing "title" once, not six times.
        style: ui.lastTextStyle,
        face: ui.lastTextFace,
      });
      ui.setActiveTool("select");
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
      startMarquee(e);
    }
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

  function startPan(e: React.PointerEvent) {
    e.preventDefault();
    const el = ref.current!;
    el.setPointerCapture(e.pointerId);
    setPanning(true);
    let last = { x: e.clientX, y: e.clientY };

    function onMove(ev: PointerEvent) {
      const dx = ev.clientX - last.x;
      const dy = ev.clientY - last.y;
      last = { x: ev.clientX, y: ev.clientY };
      const ui = useUiStore.getState();
      ui.setViewport(pan(ui.viewport, dx, dy));
    }
    function onUp(ev: PointerEvent) {
      el.releasePointerCapture(ev.pointerId);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      setPanning(false);
    }
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
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
    const baseSelection = additive ? ui.selectedItemIds : [];
    const startWorld = screenToWorld(ui.viewport, e.clientX, e.clientY);
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
      const items = useCanvasStore.getState().canvas?.items ?? {};
      const hit = Object.values(items)
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
      if (!moved && !additive) {
        // Plain background click: clear selection / close things.
        state.select(null);
        state.setOpenThread(null);
        state.setPendingComment(null);
      }
    }
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
  }

  async function onDrop(e: React.DragEvent) {
    e.preventDefault();
    if (droppingTimer.current) clearTimeout(droppingTimer.current);
    setDropping(false);
    const files = Array.from(e.dataTransfer.files);
    const ui = useUiStore.getState();
    const world = screenToWorld(ui.viewport, e.clientX, e.clientY);

    // A dragged link or tab arrives as text/uri-list — the same type a
    // browser item's blob stores — and lands as a projected site (#40).
    if (files.length === 0) {
      const link = parseUriList(e.dataTransfer.getData("text/uri-list"));
      if (link) {
        const { addBrowserItem } = await import("../lib/upload.ts");
        try {
          ui.select(await addBrowserItem(canvasId, actor, link, world));
        } catch {
          // Not http(s) — nothing to project.
        }
      }
      return;
    }

    // Dropping a single file onto an existing item = new version of that item.
    const targetItem = (e.target as HTMLElement).closest?.("[data-item-id]");
    if (targetItem && files.length === 1) {
      const { addVersionFromFile } = await import("../lib/upload.ts");
      await addVersionFromFile(canvasId, actor, targetItem.getAttribute("data-item-id")!, files[0]!);
      return;
    }
    // The drop's own failure, said out loud rather than left as an unhandled
    // rejection: offline, files are not queued (phase 10's deferred scope) and
    // `uploadBlob` throws with the sentence that explains why.
    const ids = await addFiles(canvasId, actor, files, world).catch((err: unknown) => {
      setNotice(err instanceof Error ? err.message : "Those files could not be added.");
      return [] as string[];
    });
    // The whole drop is selected, not just the last file — you dropped five
    // things and five things are what arrived.
    if (ids.length > 0) {
      useUiStore.getState().setSelection(ids);
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

  const items = canvas ? Object.values(canvas.items) : [];

  return (
    <div
      ref={ref}
      className={`canvas-viewport${panning ? " panning" : ""}${commentMode ? " comment-mode" : ""}${activeTool === "hand" ? " hand" : ""}${activeTool === "zoom" ? " zoom" : ""}${activeTool === "pen" ? " pen" : ""}${activeTool === "text" ? " text-tool" : ""}${
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
      onDragOver={(e) => {
        e.preventDefault();
        dragAlive();
      }}
      onDrop={onDrop}
    >
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
        <MapEdges />
        {items.map((item) => (
          <ItemView key={item.id} item={item} canvasId={canvasId} actor={actor} />
        ))}
        {fannedItemId && canvas?.items[fannedItemId] && (
          <VersionFanOut item={canvas.items[fannedItemId]!} canvasId={canvasId} actor={actor} />
        )}
        <InkLayer />
        <TextComposer canvasId={canvasId} actor={actor} />
      </div>
      <CommentLayer canvasId={canvasId} actor={actor} />
      <LaneTethers />
      <CursorLayer />
      <MarqueeRect />
      <GuideLines />
      <EdgeRadar canvasId={canvasId} />
      <SketchBar canvasId={canvasId} actor={actor} />
      {dropping && <div className="drop-overlay">Drop to add to the canvas</div>}
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

