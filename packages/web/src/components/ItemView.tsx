import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import type { Actor, Item, Neighbour, Operation } from "@isocan/core";
import {
  backingOf,
  isDesignSystem,
  BROWSER_MIME,
  annotationsOf,
  isAnnotation,
  isDrawingItem,
  isSlide,
  isTextItem,
  SLIDE_EMOJI,
  textFaceOf,
  textDrawSize,
  textIsLegible,
  textStyleOf,
  textMarkSize,
  TEXT_FACE_STACK,
  parseUriList,
  renamedFilename,
  titleRoom,
} from "@isocan/core";
import { blobUrl, readBlobText } from "../lib/api.ts";
import { contentBase } from "../lib/contentBase.ts";
import { itemFrame } from "../lib/frame.ts";
import { fetchBlobText, peekBlobText, type TextLoad } from "../lib/blobtext.ts";
import { DesignSystemView } from "./DesignSystemView.tsx";
import { useUiStore } from "../stores/uiStore.ts";
import { sendEchoed, setNotice, useCanvasStore } from "../stores/canvasStore.ts";
import { actorColorIn, useActorColors } from "../lib/colors.ts";
import { snapBox, unionBox } from "../lib/snap.ts";
import { counterScale, hasRoomForChrome, titleRow, underRow, underRowSpellsItOut, underSlotFor } from "../lib/chrome.ts";
import { useNavigate } from "react-router-dom";
import { itemPath } from "@isocan/core";
import { ICON_NOUN, iconKindFor } from "../lib/kinds.ts";
import { fileMarkTip } from "../lib/backing.ts";
import { KindIcon } from "./KindIcon.tsx";
import { Reactions } from "./Reactions.tsx";
import { actorNameIn, sessionName, useActorNames } from "../lib/names.ts";
import { useDismissOnOutside } from "../lib/dismiss.ts";
import { DRAG_SLOP } from "../lib/gesture.ts";

/** Two presses this close together are one double-press. */
const DOUBLE_PRESS_MS = 450;
// How close an edge has to come before it snaps, in SCREEN pixels — the same
// pull at every zoom. Holding Shift mid-drag widens it: the same gesture, more
// magnetic, for when you are aiming at a line rather than a place.
const SNAP_PX = 6;
const SNAP_PX_MAGNETIC = 18;
const MIN_W = 80;
const MIN_H = 60;

/** Four corners pushing outward — the mark every video player and window
 * manager uses for this, so it needs no legend. */
const EXPAND = (
  <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden fill="none"
       stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2H2v4M10 2h4v4M6 14H2v-4M10 14h4v-4" />
  </svg>
);

/** The title row's height on screen: 11px type at 1.4 line height, as the
 *  stylesheet sets it. Used to work out the world band a name occupies. */
const TITLE_STRIP_PX = 16;
/** Clear space left before whatever the name stopped for, so a reaching name
 *  does not touch the thing it yielded to. */
const TITLE_GAP_PX = 8;

function ItemViewInner({
  item,
  canvasId,
  actor,
  settling = false,
}: {
  item: Item;
  canvasId: string;
  actor: Actor;
  /**
   * A change to this item has been waiting on the home longer than it should.
   *
   * A prop rather than a hook here on purpose: lateness is a function of the
   * clock, so it needs a ticking timer, and one per item on a canvas of two
   * hundred would be two hundred timers to say one thing. The viewport keeps
   * the single timer and hands down the answer.
   */
  settling?: boolean;
}) {
  const navigate = useNavigate();
  const colors = useActorColors();
  const names = useActorNames();
  const selected = useUiStore((s) => s.selectedItemIds.includes(item.id));
  const soleSelection = useUiStore(
    (s) => s.selectedItemIds.length === 1 && s.selectedItemIds[0] === item.id,
  );
  const drag = useUiStore((s) => (s.drag?.itemIds.includes(item.id) ? s.drag : null));
  const resize = useUiStore((s) => (s.resize?.itemId === item.id ? s.resize : null));
  const entered = useUiStore((s) => s.enteredItemId === item.id);
  const renaming = useUiStore((s) => s.renamingItemId === item.id);
  const peeked = useUiStore((s) => s.peekedItemId === item.id);
  const scale = useUiStore((s) => s.viewport.scale);
  const commentMode = useUiStore((s) => s.commentMode);
  // A remote session holding this item shows as an outline in their color.
  const remoteHolder = useCanvasStore((s) => {
    const holder = s.sessions.find((session) => session.selection.includes(item.id));
    return holder ? holder.actor.id : null;
  });
  const worker = useWorkingSession(item.id);
  // When the label was last pressed, for spotting a double-press on it.
  const labelPress = useRef(0);

  const x = (drag ? item.x + drag.dx : item.x) + (resize?.dx ?? 0);
  const y = (drag ? item.y + drag.dy : item.y) + (resize?.dy ?? 0);
  const width = resize?.width ?? item.width;
  const height = resize?.height ?? item.height;
  const current = item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions[0]!;
  const stackDepth = Math.min(item.versions.length - 1, 2);
  // An item's chrome — its name and its version count — is UI, not content:
  // it should stay the size of a label however far out you zoom, the way the
  // comment pins do. Inside the scaled world that means counter-scaling.
  const chrome = counterScale(scale);
  const roomy = hasRoomForChrome(width, height, scale);
  // Screen pixels available to the name, once the star at the other end and
  // the row's own inset are taken off the top. Constant across selection.
  // The rule lives in lib/chrome.ts so a test can reach it without a browser —
  // there is no floor, and chrome.test.ts is where that is held.
  const row = titleRow(width, scale);

  /**
   * **A hovered name reaches into the empty space beside it.**
   *
   * The label is clipped to the card, so anything longer reads as
   * "White Lot…" and a canvas of screens becomes a canvas of things whose
   * names you have to click to learn. The room to the right is usually empty
   * — this uses it, and stops where something is actually in the way.
   *
   * **Hover only.** One thing is hovered at a time, so at most one name is
   * reaching. Selection is the opposite: a marquee over nine items would have
   * nine names reaching over each other, and the arrangement that reads as
   * "these nine" would become unreadable exactly when you asked to see it.
   *
   * Computed only while hovered, so the scan costs nothing on a still canvas
   * — and `titleRoom` is in core, because it is geometry that is wrong in one
   * direction at one zoom level and a browser is a poor place to learn that.
   */
  const hovered = useUiStore((st) => st.hoveredItemId === item.id);
  /**
   * **Many selected is the case that cannot reach; one is not.**
   *
   * The rule started as hover-only, and that made clicking a hovered item
   * snap its name back to the card — the reach appearing and vanishing on the
   * same pointer gesture. The reason to exclude selection was never selection
   * itself, it was MANY: a marquee over nine items would have nine names
   * reaching over each other. One selected item has exactly the same
   * one-name-at-a-time property that makes hover safe.
   *
   * A boolean rather than the array, so this re-renders only when the
   * selection crosses one-to-many, not on every click.
   */
  const manySelected = useUiStore((st) => st.selectedItemIds.length > 1);
  const mayReach = !renaming && !manySelected && (hovered || selected);
  const reach = useCanvasStore((st) => {
    if (!mayReach) return null;
    const all = st.canvas?.items;
    if (!all) return null;
    const chosen = useUiStore.getState().selectedItemIds;
    // The title row's height in world units. The row is counter-scaled, so
    // its SCREEN height is fixed (11px type at 1.4 line height) and the world
    // band it covers grows as you zoom out — which is exactly when labels
    // start reaching across neighbours, so the conversion matters.
    const strip = TITLE_STRIP_PX / scale;
    const others: Neighbour[] = [];
    for (const other of Object.values(all)) {
      if (other.id === item.id) continue;
      others.push({
        x: other.x,
        y: other.y,
        width: other.width,
        height: other.height,
        /* A selected neighbour is showing its own name in the band this one
           wants. Read from the ui store rather than subscribed to: every item
           subscribing to the selection array would re-render the whole canvas
           on every click, and this only has to be right at the moment a hover
           begins — which re-renders this item and re-runs the selector. */
        titled: chosen.includes(other.id),
      });
    }
    return titleRoom(item, others, strip, TITLE_GAP_PX / scale);
  });
  const kind = iconKindFor(item);
  // Where this item belongs on disk, and what this machine's disk says —
  // the canvas fact and the per-machine one, kept apart by `backingOf`.
  const disk = useCanvasStore((s) => s.backing);
  const backing = backingOf(item, disk.bound, (path) => disk.onDisk[path] ?? null);
  const isBrowser = current.mimeType === BROWSER_MIME;
  // What the strip under the item says right now. The rule lives in
  // lib/chrome.ts, where it is argued and tested.
  const underSlot = underSlotFor({
    entered,
    resizing: resize !== null,
    soleSelection,
    interactive: current.mimeType === "text/html" || isBrowser,
  });
  // Ink wears no chrome: a drawing IS its strokes, so the card, the border,
  // and the titlebar step aside until you point at it.
  const isInk = isDrawingItem(item);
  // Words wear no chrome either, and for the same reason ink doesn't: a text
  // node IS its words, so a card around them would be a card around a
  // sentence somebody typed onto a canvas.
  const isText = isTextItem(item);
  // The words' world size, and whether they are still words at this zoom.
  // Below the cut a node draws ONE mark instead of forty shapes of grey
  // smear — see `textIsLegible` in core for why 5px and not a fade.
  // The DRAWN size, which is the ladder step adjusted for the face — `hand`
  // has a small x-height and is drawn larger so a step still means the zoom
  // the control promised. The composer measures with the same number, so the
  // node lands the shape it looked while being typed.
  const textSize = isText ? textDrawSize(item) : 0;
  const textLegible = !isText || textIsLegible(textSize, scale);
  // Ink about something paints over it — a mark under the thing it marks is
  // not a mark.
  const isMark = isAnnotation(item);
  // Bumping this remounts a browser item's iframe — the reload button. Vite
  // sites refresh themselves over HMR; this is for everything that doesn't.
  const [reloadToken, setReloadToken] = useState(0);
  // Pointer-over on the item itself, so the react `+` can be offered without
  // making somebody select first. Kept local: it is not shared state and has
  // no business on the wire.
  const wearing = Object.keys(item.reactions ?? {}).length > 0;
  /**
   * Is the reaction row TAKING UP ROOM under the item — which is the question
   * the strip below it has to ask, and is not the same as "wearing marks".
   *
   * The row also appears with no marks on it at all, because selecting an item
   * shows the `+`. Clearing only for `wearing` meant a selected, unmarked item
   * drew the `+` straight through "Full screen": the two most likely controls
   * to want on a screen you just clicked, overlapping, on every unmarked item
   * on the canvas.
   *
   * Kept as one named value used by both strips so they cannot disagree — the
   * size strip and the hint strip are two rules that must clear the same row.
   */
  const reactionRow = wearing || selected;
  // Does the under-item line have room to spell the button out beside the
  // icon? Marks count against the room — they share the line — so a marked
  // item drops to the icon sooner instead of running the row off its edge.
  const spellItOut = underRowSpellsItOut(width, scale, Object.keys(item.reactions ?? {}).length);

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (
      target.closest(".resize-handle") ||
      target.closest(".version-badge") ||
      target.closest(".browser-reload")
    )
      return;
    if (entered) return; // entered content owns the pointer

    const ui = useUiStore.getState();
    // Hand, Zoom, and Pen yield the pointer (no stopPropagation) so the gesture
    // bubbles to the viewport — Hand pans, Zoom fits this item, the Pen draws
    // over it — even though it started here.
    if (ui.activeTool === "hand" || ui.activeTool === "zoom" || ui.activeTool === "pen") return;
    if (commentMode) {
      // Anchored comment: store the click as an offset from the item origin.
      const world = screenToWorldPoint(e.clientX, e.clientY);
      ui.setPendingComment({ x: world.x - item.x, y: world.y - item.y, anchorItemId: item.id });
      ui.setCommentMode(false);
      return;
    }

    e.stopPropagation();

    // A second press on the label row starts a rename — the row, not just the
    // text: a short title leaves most of the strip bare, and aiming at five
    // characters is not an affordance. It is caught HERE rather
    // than with an onDoubleClick on the label, because the drag below captures
    // the pointer, and a captured pointer retargets the click and dblclick
    // that follow to the frame — the label would never hear its own event.
    // The count is kept by hand: a pointerdown carries no click count (detail
    // is 0 on pointer events), so the pair has to be recognized by the clock.
    if (target.closest(".item-titlebar")) {
      const now = Date.now();
      if (now - labelPress.current < DOUBLE_PRESS_MS) {
        labelPress.current = 0;
        // Without this the browser's own focus-on-press lands AFTER the field
        // mounts, moving focus off it — the editor would open and blur itself
        // shut inside a frame.
        e.preventDefault();
        ui.setRenaming(item.id);
        return;
      }
      labelPress.current = now;
    }

    if (e.shiftKey) {
      // Shift-click toggles membership; no drag from a shift press.
      ui.toggleSelect(item.id);
      return;
    }

    // ⌥-click reaches past whatever is on top. It matters most for drawings:
    // a chromeless sketch is a big invisible rectangle, so a stack of them
    // (or ink laid over a note) would otherwise hand every click to the same
    // topmost box. Each ⌥-click steps one layer deeper, then wraps around.
    const stack = e.altKey ? itemsUnder(e.clientX, e.clientY) : [];
    // Step from whatever is selected, not from the item that caught the event:
    // selecting raises an item's z-index, so paint order would ping-pong
    // between the top two and never reach the third.
    const from = stack.findIndex((id) => ui.selectedItemIds.includes(id));
    const anchor = from >= 0 ? from : stack.indexOf(item.id);
    const targetId = stack.length > 1 ? stack[(anchor + 1) % stack.length]! : item.id;

    // Dragging a selected item moves the whole selection; dragging an
    // unselected one selects it alone first.
    const wasInSelection = ui.selectedItemIds.includes(targetId);
    const chosen = wasInSelection ? ui.selectedItemIds : [targetId];
    // What is drawn on a thing travels with it. Otherwise dragging a screen
    // leaves the X you drew on it behind, which is the moment the mark stops
    // meaning anything.
    const canvasNow = useCanvasStore.getState().canvas;
    const dragIds = canvasNow
      ? [...new Set(chosen.flatMap((id) => [id, ...annotationsOf(canvasNow, id).map((one) => one.id)]))]
      : chosen;
    if (!wasInSelection) ui.select(targetId);

    const frame = e.currentTarget as HTMLElement;
    frame.setPointerCapture(e.pointerId);
    const start = { x: e.clientX, y: e.clientY };
    let moved = false;

    function onMove(ev: PointerEvent) {
      const ui = useUiStore.getState();
      const scale = ui.viewport.scale;
      if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < DRAG_SLOP) return;
      moved = true;
      let dx = (ev.clientX - start.x) / scale;
      let dy = (ev.clientY - start.y) / scale;

      // Align to what is already on the canvas. Shift is read from the MOVE,
      // not the press — a shift-press is "add to selection", so the magnet has
      // to be something you reach for mid-gesture.
      const items = useCanvasStore.getState().canvas?.items ?? {};
      const dragging = dragIds.map((id) => items[id]).filter((one) => one !== undefined);
      const moving = unionBox(dragging);
      if (moving) {
        const others = Object.values(items).filter((other) => !dragIds.includes(other.id));
        const threshold = (ev.shiftKey ? SNAP_PX_MAGNETIC : SNAP_PX) / scale;
        const snap = snapBox({ ...moving, x: moving.x + dx, y: moving.y + dy }, others, threshold);
        dx += snap.dx;
        dy += snap.dy;
        ui.setGuides(snap.guides, snap.spacing);
      }
      ui.setDrag({ itemIds: dragIds, dx, dy, moved });
    }
    function onUp(ev: PointerEvent) {
      if (frame.hasPointerCapture(ev.pointerId)) frame.releasePointerCapture(ev.pointerId);
      frame.removeEventListener("pointermove", onMove);
      frame.removeEventListener("pointerup", onUp);
      frame.removeEventListener("pointercancel", onUp);
      const state = useUiStore.getState();
      state.setGuides([]); // the lines belong to the gesture, not the canvas
      const final = state.drag;
      if (!moved || !final) {
        state.setDrag(null);
        return;
      }
      // One op per gesture — a group drag is a single undo step.
      const canvas = useCanvasStore.getState().canvas;
      if (!canvas) {
        state.setDrag(null);
        return;
      }
      const moves = final.itemIds
        .map((itemId) => canvas.items[itemId])
        .filter((dragged) => dragged !== undefined)
        .map((dragged) => ({
          itemId: dragged.id,
          x: Math.round(dragged.x + final.dx),
          y: Math.round(dragged.y + final.dy),
        }));
      const op: Operation | null =
        moves.length === 1
          ? { type: "item.move", ...moves[0]! }
          : moves.length > 1
            ? { type: "items.move", moves }
            : null;
      if (op) {
        // Fold the final position into the replica BEFORE dropping the drag
        // override — otherwise the item flashes at its old position until the
        // WS echo lands.
        void sendEchoed(canvasId, actor, op);
      }
      state.setDrag(null);
    }
    frame.addEventListener("pointermove", onMove);
    frame.addEventListener("pointerup", onUp);
    // A gesture the browser takes away must not leave guides on screen or an
    // item frozen mid-drag.
    frame.addEventListener("pointercancel", onUp);
  }

  function onResizeDown(corner: "nw" | "ne" | "sw" | "se", e: React.PointerEvent) {
    if (e.button !== 0) return;
    e.stopPropagation();
    const handle = e.currentTarget as HTMLElement;
    handle.setPointerCapture(e.pointerId);
    const start = { x: e.clientX, y: e.clientY, width: item.width, height: item.height };
    // Sign multipliers: which way the pointer delta affects width/height.
    const sx = corner === "nw" || corner === "sw" ? -1 : 1;
    const sy = corner === "nw" || corner === "ne" ? -1 : 1;

    function onMove(ev: PointerEvent) {
      const scale = useUiStore.getState().viewport.scale;
      const rawDx = (ev.clientX - start.x) / scale;
      const rawDy = (ev.clientY - start.y) / scale;
      const newW = Math.max(MIN_W, Math.round(start.width + rawDx * sx));
      const newH = Math.max(MIN_H, Math.round(start.height + rawDy * sy));
      // Origin offset: the difference between requested and clamped size,
      // only on axes where the corner moves the origin.
      const dx = sx === -1 ? -(newW - start.width) : 0;
      const dy = sy === -1 ? -(newH - start.height) : 0;
      useUiStore.getState().setResize({ itemId: item.id, width: newW, height: newH, dx, dy });
    }
    function onUp(ev: PointerEvent) {
      handle.releasePointerCapture(ev.pointerId);
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      const state = useUiStore.getState();
      const final = state.resize;
      if (final && (final.width !== item.width || final.height !== item.height)) {
        const resizeOp = {
          type: "item.resize",
          itemId: item.id,
          width: final.width,
          height: final.height,
        } as const;
        void sendEchoed(canvasId, actor, resizeOp);
        // Corners other than SE shift the origin.
        if (final.dx !== 0 || final.dy !== 0) {
          const moveOp = {
            type: "item.move",
            itemId: item.id,
            x: Math.round(item.x + final.dx),
            y: Math.round(item.y + final.dy),
          } as const;
          void sendEchoed(canvasId, actor, moveOp);
        }
      }
      state.setResize(null);
    }
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
  }

  /**
   * Re-open the words of a text node for typing.
   *
   * The body is fetched from the blob rather than kept in state: what a node
   * says is whatever its CURRENT version says, and that can have been changed
   * a second ago by an agent at a terminal. Reading it at the moment of the
   * edit is the only version of this that cannot open on stale words.
   */
  async function openTextEditor() {
    const ui = useUiStore.getState();
    let body: string;
    try {
      body = await readBlobText(canvasId, current.blobHash);
    } catch {
      // A daemon that will not hand the words over should not open an empty
      // composer over words that still exist — that turns a network blip
      // into a wipe. This read used to check `res.ok` and fall through with
      // `body = ""` when it was false, so a cleared cookie did exactly that
      // wipe, silently. `readBlobText` knocks on the door first and throws
      // for anything still refusing after, so the only way past here is with
      // the real text in hand.
      setNotice("Could not read that text to edit it.");
      return;
    }
    // Editing opens on what the node IS, not on what you last typed.
    ui.setPendingText({
      x: item.x,
      y: item.y,
      itemId: item.id,
      body,
      width,
      height,
      style: textStyleOf(item),
      face: textFaceOf(item),
    });
  }

  function onDoubleClick() {
    const ui = useUiStore.getState();
    // Two quick dots from the Pen are ink, not a request to enter the item.
    if (ui.activeTool === "pen") return;
    // The pointer capture above hands us the label's double-click too; naming
    // a thing is not the same as stepping inside it.
    if (ui.renamingItemId === item.id) return;
    // A text node has nothing to step INSIDE of — the words are the whole of
    // it — so the same gesture that enters a document re-opens the composer
    // on what it says. Editing lands as `item.addVersion`, so every wording
    // is kept and the CLI sees the change like any other.
    if (isText) {
      void openTextEditor();
      return;
    }
    ui.setEntered(item.id);
    // The double-click that entered the item is also the browser's
    // select-the-paragraph gesture, and the content stops being
    // `user-select: none` at the same moment — so stepping inside a document
    // arrived with the whole document highlighted. Entering is not selecting.
    window.getSelection()?.removeAllRanges();
  }

  /**
   * Renaming moves the name AND the file under it: what you call a thing on
   * the canvas is what it should be called when it leaves — `isocan get`, a
   * download, the blob's own name. One op, so a rename is one undo, and the
   * canvas picks the next free name if that one is spoken for.
   */
  function rename(next: string) {
    const ui = useUiStore.getState();
    ui.setRenaming(null);
    const title = next.trim();
    if (title === "" || title === item.title) return;
    const canvas = useCanvasStore.getState().canvas;
    const filename = canvas ? renamedFilename(canvas, item.id, title, current.filename) : undefined;
    const op = {
      type: "item.update",
      itemId: item.id,
      patch: { title },
      ...(filename && filename !== current.filename ? { filename } : {}),
    } as const;
    void sendEchoed(canvasId, actor, op);
  }

  return (
    <div
      className={`item${selected ? " selected" : ""}${entered ? " entered" : ""}${drag ? " dragging" : ""}${isInk ? " ink" : ""}${isText ? " textnode" : ""}${isMark ? " annotation" : ""}${renaming ? " renaming" : ""}${peeked ? " peeked" : ""}${settling ? " settling" : ""}${reach !== null ? " reaching" : ""}${isSlide(item) ? " slide" : ""}`}
      data-item-id={item.id}
      /* One id in the store rather than a flag per item: moving the pointer
         across a canvas re-renders the two items whose state changed, not
         every item on screen. */
      onPointerEnter={() => useUiStore.getState().setHoveredItem(item.id)}
      onPointerLeave={() =>
        useUiStore.setState((st) =>
          st.hoveredItemId === item.id ? { hoveredItemId: null } : st,
        )
      }
      style={{
        left: x,
        top: y,
        width,
        height,
        ...(remoteHolder && !selected
          ? { outline: `2px dashed ${actorColorIn(colors, remoteHolder)}`, outlineOffset: "1px" }
          : {}),
        ...(worker
          ? ({ "--work-color": actorColorIn(colors, worker.actorId) } as React.CSSProperties)
          : {}),
        ...(isText
          ? ({
              "--text-size": `${textSize}px`,
              "--text-face": TEXT_FACE_STACK[textFaceOf(item)],
            } as React.CSSProperties)
          : {}),
      }}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
    >
      {stackDepth >= 1 && <span className="ply" style={{ transform: "translate(5px, 5px)", opacity: 0.75 }} />}
      {stackDepth >= 2 && <span className="ply" style={{ transform: "translate(10px, 10px)", opacity: 0.45 }} />}
      {item.versions.length > 1 && roomy && (
        <button
          className="version-badge version-badge-ne"
          style={{ ...chrome, transformOrigin: "top right" }}
          title={`${item.versions.length} versions — show them (S)`}
          onClick={(e) => {
            e.stopPropagation();
            const ui = useUiStore.getState();
            ui.select(item.id);
            ui.setFanned(ui.fannedItemId === item.id ? null : item.id);
          }}
        >
          ×{item.versions.length}
        </button>
      )}
      <div className="item-titlebar" style={roomy ? undefined : { display: "none" }}>
        <span
          className="chrome-left"
          style={{
            ...chrome,
            transformOrigin: "left bottom",
            // The item's width in the label's own units — screen pixels, since
            // the label is counter-scaled — less the room the star needs at the
            // other end and the row's inset. The name stretches to here and
            // stops.
            //
            // NO FLOOR, and `nameRoom` in lib/chrome.ts is where that is
            // argued and tested. Below the width where a name says anything
            // the name is dropped instead, and the star stays.
            /* The reach, in the label's own units — the label is
               counter-scaled, so world room has to be converted. Never below
               `nameRoom`: hovering must not shrink a label. */
            maxWidth:
              reach === null
                ? row.nameRoom
                : /* Nothing in the way: no limit, said as `none` rather than
                     as a very large pixel count. */
                  Number.isFinite(reach)
                  ? Math.max(row.nameRoom, reach * scale)
                  : "none",
            // The row is here if anything in it is. Which of the icon and the
            // name survive at this size is `titleRow`'s call, and they do NOT
            // fall together: hiding the pair is what left a bare star between
            // 12% and 19% zoom on a 480-unit item.
            ...(row.icon || row.name || renaming ? null : { display: "none" }),
          }}
        >
        {/* What this item IS, before its name — so a canvas of cards reads as
            screens, images and notes at a glance, without opening the Files
            panel. Same glyph the panel groups under (lib/kinds.ts), because a
            mark that means one thing in a list and another on the thing itself
            is worse than no mark. It is not a button: the kind is derived from
            the file and there is nothing to set. */}
        {row.icon && <KindIcon className="kind-icon" kind={kind} />}
        {/**
         * **This item is a file**, and whether the disk agrees
         * (`docs/projects/workbench/files-on-disk.md`).
         *
         * Only tracked items wear anything: an untracked item is the default
         * and the common case — a view run up to answer "let me see" — so
         * silence is the right signal for it. Drift is the state worth
         * catching from across a canvas, so it is the one that colours.
         */}
        {backing && <span className={`file-mark ${backing.state}`} title={fileMarkTip(backing)} />}
        {/* In the deck (#87): the mark that says full screen's arrows stop
            here. Worn on the item because a deck you cannot see is a deck
            you cannot arrange. */}
        {isSlide(item) && (
          <span className="slide-mark" title="A slide — arrows in full screen flip through these">
            {SLIDE_EMOJI}
          </span>
        )}
        {renaming ? (
          <NameInput title={item.title} onDone={rename} />
        ) : row.name ? (
          <span
            className="name"
            title={`${item.title} (${current.filename}) — ${ICON_NOUN[kind]} · double-click to rename · last edit by ${actorNameIn(names, item.updatedBy)}`}
          >
            {item.title}
          </span>
        ) : null}
        {isBrowser && (
          <button
            className="browser-reload"
            title="Reload the projected site"
            onClick={(e) => {
              e.stopPropagation();
              setReloadToken((n) => n + 1);
            }}
          >
            ⟳
          </button>
        )}
        </span>
        {worker && (
          /**
           * **Counter-scaled, like the name at the other end of the row.**
           *
           * It was not, and the row's own rule already said it should be:
           * "each side holds its size about its OWN edge". The name stayed a
           * label at every zoom while this shrank with the world, so at 30%
           * the title read at 11px and the chip that says an agent is working
           * here read at 3 — invisible at exactly the zoom where somebody is
           * scanning a whole canvas to find out where the work is happening.
           *
           * `right bottom`, not `left bottom`: it holds its size about the
           * edge it is pinned to, or it grows leftward across the name as you
           * zoom out — which is the failure the row's comment describes for
           * counter-scaling the whole row at once.
           */
          <span
            className="work-chip"
            style={{ ...chrome, transformOrigin: "right bottom" }}
            title={`${worker.name} is working${worker.status ? ` — ${worker.status}` : ""}`}
          >
            <span className="work-dot" />
            <span className="work-name">{worker.name}</span>
            <i>.</i>
            <i>.</i>
            <i>.</i>
          </span>
        )}
      </div>
      <div className={`item-content${entered ? "" : " inert"}`}>
        {/**
         * Too far away to read: draw the mark, not the words.
         *
         * The node keeps its box — its place and footprint on the canvas are
         * still true — and what changes is that forty illegible shapes become
         * one legible one. The mark is sized never to exceed the node it
         * stands for (`textMarkSize`), because a glyph bigger than its own
         * node would misdescribe the canvas, and at the zoom where dozens of
         * nodes are marks that is the same smear in a different hat.
         */}
        {isText && !textLegible ? (
          <span
            className="text-mark"
            aria-label={item.title}
            style={{ fontSize: `${textMarkSize(width, height, scale) / scale}px` }}
          >
            T
          </span>
        ) : (
        <VersionContent
          canvasId={canvasId}
          blobHash={current.blobHash}
          mimeType={current.mimeType}
          filename={current.filename}
          entered={entered}
          designSystem={isDesignSystem(item)}
          textNode={isText}
          reloadToken={reloadToken}
        />
        )}

        {worker && <div className="work-sheen" />}
      </div>
      {/* ONE row under the item, and everything that wants to be there.
          
          Marks, the `+`, the full-screen button and the size all live on this
          line. They used to be two absolutely-positioned elements that each
          counter-scaled themselves, which put two half-empty rows under every
          selected item — and made the `+` and "Full screen" collide before
          that, because one of them stepped down and the other did not.
          
          One wrapper carries the counter-scale for all of it, so there is a
          single answer to "how big is chrome" under here, and the children are
          ordinary flex items. Centred, because the box is the item's WORLD
          width and centre is the only alignment that survives being scaled
          about its own middle — `flex-end` lands somewhere off the side of the
          item, which is how this was learned.
          
          The size and the hint still share their half of it. They are
          different KINDS of message with different triggers: the size is a
          fact about the thing you are manipulating, the hint an evergreen tip
          shown while you point at it. When both apply the size wins — if you
          are dragging a corner, the live number is the point, and
          "double-click to interact" is something you have already read. */}
      {roomy && !entered && (underSlot !== null || reactionRow) && (
        <div className="item-under" style={underRow(width, scale)}>
          {/* Persistent, and therefore first: a mark is something the item is
              wearing, where the rest of the row is about your current gesture. */}
          <Reactions
            canvasId={canvasId}
            item={item}
            actor={actor}
            // Selected ONLY, not hovered — see the prop's own note. Reactions
            // already worn stay visible either way; this is just the `+`.
            visible={selected}
          />
          {underSlot === "size" && (
            <div className={`item-hint size under-right${resize ? " live" : ""}`}>
              {/* The click path into full screen, in the one place there is
                  room for a word. It sits beside the size rather than up in
                  the title row because that row's width is the name's, and a
                  control there would cost the name at every zoom for a button
                  you want twice a session. Every kind gets it, not just the
                  interactive ones: a picture worth opening big is as ordinary
                  as a screen worth clicking through.
                  
                  "Full screen", not "Open" — which was the first label and
                  said nothing. Open in what? A new tab, a menu, an editor?
                  Worse, this product already uses the word: `isocan open`
                  means "open the canvas in your browser", and you are ALREADY
                  in the browser when you press this. The button says the state
                  it puts you in, which is what the shortcut list calls it.
                  
                  Not while a corner is being dragged: your pointer is busy,
                  the button would be under it, and the number beside it is the
                  thing you are actually reading. */}
              {!resize && (
                <button
                  className={`fullscreen-btn${spellItOut ? "" : " compact"}`}
                  // The tooltip is the label, and it is drawn rather than
                  // handed to `title`: the native one waits about a second,
                  // arrives at the pointer instead of at the button, and
                  // cannot be styled. `aria-label` still carries it for
                  // anyone not hovering anything.
                  // The tip repeats no ink: the labeled form already says
                  // "Full screen", so its tip carries only the keys; the
                  // compact form's face is a glyph, so its tip carries the
                  // name too.
                  data-tip={spellItOut ? "Enter — Esc comes back" : "Full screen — Enter, Esc comes back"}
                  aria-label="Full screen"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(itemPath(canvasId, item.id));
                  }}
                >
                  {EXPAND}
                  {spellItOut && <span>Full screen</span>}
                </button>
              )}
              <span>
                {Math.round(width)} × {Math.round(height)}
              </span>
            </div>
          )}
          {underSlot === "hint" && (
            /* Centred in what the marks left it, and no further. `flex: 1`
               means it starts centred under the item and gets nudged right as
               marks accumulate, rather than being overlapped by them or
               pinned somewhere it does not belong. */
            <div className="item-hint under-mid">
              <span>double-click to interact</span>
            </div>
          )}
        </div>
      )}
      {soleSelection && !entered && (
        <>
          <span className="resize-handle resize-handle-nw" onPointerDown={(e) => onResizeDown("nw", e)} />
          <span className="resize-handle resize-handle-ne" onPointerDown={(e) => onResizeDown("ne", e)} />
          <span className="resize-handle resize-handle-sw" onPointerDown={(e) => onResizeDown("sw", e)} />
          <span className="resize-handle resize-handle-se" onPointerDown={(e) => onResizeDown("se", e)} />
        </>
      )}
    </div>
  );
}

/** The name, in place. Enter keeps it, Escape puts it back, clicking away
 * keeps it — the same bargain every rename field in the app makes. */
function NameInput({ title, onDone }: { title: string; onDone: (next: string) => void }) {
  const [draft, setDraft] = useState(title);
  const sizer = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState<number | undefined>(undefined);
  // Finish once. Blur and an outside press can both land for one gesture, and
  // finishing twice would send two renames for one edit.
  const finished = useRef(false);
  const finish = (next: string) => {
    if (finished.current) return;
    finished.current = true;
    onDone(next);
  };
  // A press on the canvas cannot blur this field — the canvas calls
  // preventDefault on its own pointerdown, so focus never moves and the edit
  // used to sit there open. Clicking away should mean the same as Escape.
  const outside = useDismissOnOutside<HTMLInputElement>(true, () => finish(draft));

  // Measured, not estimated. A `ch` count is the width of a ZERO, which
  // overshoots badly in a proportional face: a 28-character title claimed a
  // field half again as wide as its own text, which is what made this look
  // like a form instead of a label you are editing.
  useLayoutEffect(() => {
    if (sizer.current) setWidth(sizer.current.offsetWidth + 2);
  }, [draft]);

  return (
    <>
      <span className="name-sizer" ref={sizer} aria-hidden>
        {draft || " "}
      </span>
    <input
      ref={outside}
      className="name-input"
      autoFocus
      style={width === undefined ? undefined : { width }}
      value={draft}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setDraft(e.target.value)}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onBlur={() => finish(draft)}
      onKeyDown={(e) => {
        e.stopPropagation(); // the canvas's shortcuts are not for this field
        if (e.key === "Enter") finish(draft);
        if (e.key === "Escape") finish(title);
      }}
    />
    </>
  );
}

const WORK_LINGER_MS = 2500;

// The session working on this item, held through a short linger after the
// flag clears: the daemon drops `activity` the moment an op lands, so a long
// task would otherwise strobe work → op → work between edits.
function useWorkingSession(
  itemId: string,
): { actorId: string; name: string; status: string | null } | null {
  // Serialized to a scalar so remote cursor moves don't re-render every item.
  const live = useCanvasStore((s) => {
    const session = s.sessions.find(
      (candidate) =>
        candidate.activity?.kind === "working" &&
        "itemId" in candidate.activity &&
        candidate.activity.itemId === itemId,
    );
    if (!session) return null;
    // `label` is a display OVERRIDE and it is usually absent — a session only
    // has one when somebody passed `--label`. Interpolating it straight into
    // this key wrote the string "null", and the chip then said "null is
    // working" over the item, which is every agent that ever started a session
    // without one. The fallback the type documents is the actor's name, and
    // the name that reaches a rename is the registry's.
    const name = sessionName(s.actorNames, session);
    return `${session.actor.id}\u0000${name}\u0000${session.status ?? ""}`;
  });
  const [held, setHeld] = useState<string | null>(null);
  useEffect(() => {
    if (live) {
      setHeld(live);
      return;
    }
    const timer = setTimeout(() => setHeld(null), WORK_LINGER_MS);
    return () => clearTimeout(timer);
  }, [live]);

  const key = live ?? held;
  if (!key) return null;
  const [actorId, name, status] = key.split("\u0000");
  return { actorId: actorId!, name: name!, status: status || null };
}

/**
 * Every item under a screen point, in DOCUMENT order — deliberately not the
 * paint order elementsFromPoint reports. Selection changes z-index, so paint
 * order changes under the very gesture that walks it; document order holds
 * still, which is what makes ⌥-click a cycle that reaches everything.
 */
function itemsUnder(x: number, y: number): string[] {
  const hit = new Set<string>();
  for (const el of document.elementsFromPoint(x, y)) {
    const id = (el as HTMLElement).closest?.("[data-item-id]")?.getAttribute("data-item-id");
    if (id) hit.add(id);
  }
  return [...document.querySelectorAll("[data-item-id]")]
    .map((el) => el.getAttribute("data-item-id")!)
    .filter((id) => hit.has(id));
}

function screenToWorldPoint(sx: number, sy: number): { x: number; y: number } {
  const { viewport } = useUiStore.getState();
  return { x: (sx - viewport.tx) / viewport.scale, y: (sy - viewport.ty) / viewport.scale };
}

// ---------------- renderers ----------------

// Text loading lives in lib/blobtext.ts — two renderers read files now.

function BlobError({ reason }: { reason: string }) {
  return (
    <div className="file-view">
      couldn't load this file
      <br />({reason})
    </div>
  );
}

export function VersionContent({
  canvasId,
  blobHash,
  mimeType,
  filename,
  entered,
  reloadToken = 0,
  designSystem,
  textNode,
  warm,
}: {
  canvasId: string;
  blobHash: string;
  mimeType: string;
  filename: string;
  entered: boolean;
  /** Blobs to render out of sight because they are probably next — the slides
   *  either side of this one. See `HtmlView`. */
  warm?: readonly string[];
  /** Bumped by the titlebar's ⟳ to remount a browser item's iframe. */
  reloadToken?: number;
  /** A text node: markdown typed onto the canvas, whose newlines are meant
   *  (see `MarkdownView`). */
  textNode?: boolean;
  /** `role=design-system`: draw the tokens as the things they describe rather
   *  than as the text that declares them. */
  designSystem?: boolean;
}) {
  const url = blobUrl(canvasId, blobHash);
  if (designSystem && (mimeType === "text/markdown" || mimeType === "text/plain")) {
    return <DesignSystemView canvasId={canvasId} blobHash={blobHash} />;
  }
  if (mimeType === "text/markdown" || mimeType === "text/plain") {
    return (
      <MarkdownView
        canvasId={canvasId}
        blobHash={blobHash}
        plain={mimeType === "text/plain"}
        breaks={textNode === true}
      />
    );
  }
  if (mimeType.startsWith("image/")) {
    return <img className="img-view" src={url} alt={filename} draggable={false} />;
  }
  if (mimeType.startsWith("video/")) {
    return <video className="video-view" src={url} controls={entered} muted loop playsInline />;
  }
  if (mimeType === BROWSER_MIME) {
    return <BrowserView canvasId={canvasId} blobHash={blobHash} reloadToken={reloadToken} />;
  }
  if (mimeType === "text/html") {
    // Security boundary: src and sandbox are built as a pair by `itemFrame`,
    // the one place allowed to decide them together (content-origin plan,
    // invariant 2). With no content origin that pair is allow-scripts alone —
    // an opaque origin that cannot reach the daemon API, this app's DOM, or
    // its storage. The blob response additionally carries `CSP: sandbox` and
    // nosniff.
    const frame = itemFrame(contentBase(), canvasId, blobHash);
    const base = contentBase();
    return (
      <HtmlView
        src={frame.src}
        sandbox={frame.sandbox}
        title={filename}
        warm={(warm ?? []).map((hash) => itemFrame(base, canvasId, hash).src)}
      />
    );
  }
  return (
    <div className="file-view">
      {filename}
      <br />({mimeType})
    </div>
  );
}

/** How many slide documents stay mounted. Enough that flicking back and forth
 *  through a run of slides never reloads one, small enough that a long deck
 *  does not keep a hundred live documents in memory. */
const KEEP_FRAMES = 6;
/** One frozen empty set, so the initial state is not a new object per render. */
const EMPTY: ReadonlySet<string> = new Set();

/**
 * **A screen, held on the glass until the next one is ready to take its
 * place.**
 *
 * Reported from a presentation: flipping between slides flashed WHITE for a
 * split second, and the fonts "load lazily every time" — the slide painting
 * once in a fallback face and then re-laying-out when the real one arrived,
 * which changes the metrics and moves everything.
 *
 * Both are one cause. Every slide is its own iframe document, and pointing an
 * iframe at a new address blanks it: the element's own `background: #fff` is
 * what shows through the gap — deliberately, see `.html-view`, so somebody's
 * transparent design is not misrepresented by whatever sits behind it. Then
 * the fresh document lays out in a fallback face and reflows when the webfont
 * lands, which is `font-display: swap` doing exactly what it promises, in
 * full view of the room.
 *
 * So do not show the gap. The arriving document loads in a second frame
 * stacked behind the one already on screen, invisible, and takes its place
 * only `onLoad` — by which time the stylesheets are parsed and the layout
 * they describe has happened. The outgoing frame is never blanked because it
 * is never navigated: it is unmounted whole, once its replacement is ready.
 *
 * **Keys are what make that true.** Both frames are children of one parent
 * and keyed by `src`, so promoting the arriving one lets React reuse that DOM
 * node — the document it just loaded stays loaded. Setting `src` on a single
 * element instead would re-navigate it and put the flash straight back.
 *
 * It cannot wait for `document.fonts.ready`: these frames are sandboxed to an
 * opaque origin on purpose (the content-origin boundary above), so nothing
 * here may look inside one. `load` is the last moment this side can observe.
 *
 * **The slides either side are rendered before you ask for them.** `load`
 * fires before a webfont has been fetched and laid out, so promoting on it
 * still shows the fallback face first and reflows when the real one lands —
 * `font-display: swap`, in front of the room. Nothing on this side can wait
 * for `document.fonts.ready`, because these frames are sandboxed to an opaque
 * origin on purpose. What it CAN do is start the neighbours early: they are
 * mounted out of sight with `opacity`, never `visibility` or `display`, so
 * the browser lays them out and fetches their fonts for real. By the time the
 * arrow is pressed the document has already done its reflow, unwatched.
 *
 * **And a slide already seen is not loaded again.** Holding one spare frame
 * would still re-fetch, re-parse and re-lay-out every slide on every visit,
 * which is most of what "the fonts load lazily EVERY time" was describing —
 * somebody flicking back and forth pays the whole cost each way. So the
 * frames are a small POOL keyed by address: the last few documents stay
 * mounted and laid out, and returning to one is a class change rather than a
 * navigation. Bounded, because a hundred-slide deck left open should not hold
 * a hundred live documents; the oldest is dropped, and the one on screen
 * never is.
 */
function HtmlView({
  src,
  sandbox,
  title,
  warm = [],
}: {
  src: string;
  sandbox: string;
  title: string;
  warm?: readonly string[];
}) {
  const [mounted, setMounted] = useState<string[]>([src]);
  const [loaded, setLoaded] = useState<ReadonlySet<string>>(EMPTY);
  const [shown, setShown] = useState<ReadonlySet<string>>(() => new Set([src]));
  const [visible, setVisible] = useState(src);
  const warmKey = warm.join("\u0000");

  useEffect(() => {
    const neighbours = warmKey === "" ? [] : warmKey.split("\u0000");
    setMounted((was) => {
      /**
       * **Append-only, and that is load-bearing.** Moving a mounted iframe to
       * a new index re-inserts the DOM node, which cancels the transition
       * running on it — measured as both frames sitting at opacity 0 for a
       * beat mid-flip, which is a hole in the picture exactly where this was
       * supposed to remove one. So the order never changes; `z-index` decides
       * what is on top instead.
       */
      const want = new Set([visible, src, ...neighbours]);
      const kept = was.filter((one) => want.has(one) || one === visible);
      const added = [...want].filter((one) => !kept.includes(one));
      const next = [...kept, ...added];
      const trimmed =
        next.length > KEEP_FRAMES
          ? next.filter((one, i) => one === visible || one === src || i >= next.length - KEEP_FRAMES)
          : next;
      return was.length === trimmed.length && was.every((one, i) => one === trimmed[i])
        ? was
        : trimmed;
    });
  }, [src, visible, warmKey]);

  useEffect(() => {
    if (!loaded.has(src)) return;
    setVisible(src);
    setShown((was) => (was.has(src) ? was : new Set(was).add(src)));
  }, [src, loaded]);

  return (
    <div className="html-view-stack">
      {mounted.map((one) => (
        <iframe
          key={one}
          /**
           * `arriving` — invisible — only while a frame has NEVER been shown.
           * One that has been on screen stays painted underneath at full
           * opacity, so the incoming slide fades in over a finished picture
           * rather than over the ground. There is no moment where the two of
           * them together add up to less than one slide.
           */
          className={`html-view${shown.has(one) ? "" : " arriving"}`}
          style={{ zIndex: one === visible ? 2 : 1 }}
          src={one}
          sandbox={sandbox}
          title={title}
          aria-hidden={one === visible ? undefined : true}
          onLoad={() => setLoaded((was) => (was.has(one) ? was : new Set(was).add(one)))}
        />
      ))}
    </div>
  );
}

/**
 * The mini-browser (#40): the version's blob is a text/uri-list naming a
 * live site — typically a localhost dev server — and the content is that
 * site in an iframe. A Vite site refreshes itself over its own HMR socket;
 * the titlebar's ⟳ remounts the frame for everything else.
 *
 * Sandbox posture, deliberately different from the HTML-blob boundary
 * above: the projected site keeps ITS OWN origin (`allow-same-origin`), so
 * its localStorage, cookies, and dev tooling work — and since a dev server
 * on another port is cross-origin from this app, that still cannot reach
 * the canvas's DOM, storage, or the daemon API. The one exception is
 * projecting this app's own origin onto itself, which is the user
 * projecting their own tool — not a boundary this sandbox is defending.
 */
function BrowserView({
  canvasId,
  blobHash,
  reloadToken,
}: {
  canvasId: string;
  blobHash: string;
  reloadToken: number;
}) {
  const [load, setLoad] = useState<TextLoad>(() => {
    const cached = peekBlobText(canvasId, blobHash);
    return cached === undefined ? null : { text: cached };
  });

  useEffect(() => {
    let cancelled = false;
    fetchBlobText(canvasId, blobHash)
      .then((body) => !cancelled && setLoad({ text: body }))
      .catch((err: Error) => !cancelled && setLoad({ failed: err.message }));
    return () => {
      cancelled = true;
    };
  }, [canvasId, blobHash]);

  if (load === null) return <div className="file-view">…</div>;
  if ("failed" in load) return <BlobError reason={load.failed} />;
  const site = parseUriList(load.text);
  if (site === null) return <BlobError reason="not a link" />;
  return (
    <iframe
      key={reloadToken}
      className="browser-view"
      src={site}
      sandbox="allow-scripts allow-same-origin allow-forms"
      title={site}
    />
  );
}

/**
 * `breaks`: a newline is a line break.
 *
 * Markdown's own rule — a single newline is a space, and a break needs two
 * trailing spaces — is a rule about DOCUMENTS, where paragraphs reflow. A
 * text node is not a document; it is words somebody typed into a box on a
 * canvas and watched wrap where they put them. Swallowing those breaks means
 * what commits is not what they typed, which is the one thing this tool must
 * never do. (Chat and comment bodies made the same call long before this.)
 */
function MarkdownViewInner({
  canvasId,
  blobHash,
  plain,
  breaks,
}: {
  canvasId: string;
  blobHash: string;
  plain: boolean;
  breaks?: boolean;
}) {
  const [load, setLoad] = useState<TextLoad>(() => {
    const cached = peekBlobText(canvasId, blobHash);
    return cached === undefined ? null : { text: cached };
  });

  useEffect(() => {
    let cancelled = false;
    fetchBlobText(canvasId, blobHash)
      .then((body) => !cancelled && setLoad({ text: body }))
      .catch((err: Error) => !cancelled && setLoad({ failed: err.message }));
    return () => {
      cancelled = true;
    };
  }, [canvasId, blobHash]);

  if (load === null) return <div className="file-view">…</div>;
  if ("failed" in load) return <BlobError reason={load.failed} />;
  if (plain) return <div className="md-view" style={{ whiteSpace: "pre-wrap" }}>{load.text}</div>;
  return (
    <div className="md-view">
      {/* GFM: tables, strikethrough, task lists, autolinks */}
      <ReactMarkdown remarkPlugins={breaks ? [remarkGfm, remarkBreaks] : [remarkGfm]}>
        {load.text}
      </ReactMarkdown>
    </div>
  );
}


/**
 * **Memoised, and the measurement is the argument.**
 *
 * `CanvasViewport` subscribes to the whole viewport, so it re-renders on every
 * pan frame, and an unmemoised `ItemView` meant all 41 items re-rendered with
 * it — each one re-parsing its Markdown body from scratch. Profiled during a
 * scripted pan at 4x CPU throttle, **47% of all samples were inside micromark's
 * tokenizer**: nearly half the cost of moving the canvas was parsing text that
 * had not changed.
 *
 * Measured, three runs each: pan p90 **33.4ms → 9.9ms**, frames over 32ms
 * **21/143 → 0/201**, script time 2.9s → 1.8s.
 */
export const ItemView = memo(ItemViewInner);

/**
 * **And the body separately**, because the item's CHROME legitimately depends
 * on zoom and its text does not.
 *
 * `ItemView` reads `viewport.scale` for counter-scaled labels, legibility and
 * the title row — all real, all needing a re-render on zoom. The Markdown
 * body needs none of it. Without this, memoising `ItemView` alone fixed pan
 * and left zoom re-parsing every document on every frame — and made it
 * WORSE at the tail, because the parse that pan used to spread out now
 * arrived all at once on the first scale change (worst frame 34ms → 58ms).
 * A p90 hid that; the worst frame is what showed it.
 */
const MarkdownView = memo(MarkdownViewInner);
