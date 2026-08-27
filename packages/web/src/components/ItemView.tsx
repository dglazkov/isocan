import { useEffect, useLayoutEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Actor, Item, Operation } from "@isocan/core";
import {
  isDesignSystem,
  BROWSER_MIME,
  annotationsOf,
  isAnnotation,
  isDrawingItem,
  parseUriList,
  renamedFilename,
} from "@isocan/core";
import { blobUrl } from "../lib/api.ts";
import { contentBase } from "../lib/contentBase.ts";
import { itemFrame } from "../lib/frame.ts";
import { fetchBlobText, peekBlobText, type TextLoad } from "../lib/blobtext.ts";
import { DesignSystemView } from "./DesignSystemView.tsx";
import { useUiStore } from "../stores/uiStore.ts";
import { sendEchoed, useCanvasStore } from "../stores/canvasStore.ts";
import { actorColorIn, useActorColors } from "../lib/colors.ts";
import { snapBox, unionBox } from "../lib/snap.ts";
import { counterScale, hasRoomForChrome, titleRow, underRow, underRowSpellsItOut, underSlotFor } from "../lib/chrome.ts";
import { useNavigate } from "react-router-dom";
import { itemPath } from "@isocan/core";
import { ICON_NOUN, iconKindFor } from "../lib/kinds.ts";
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

export function ItemView({
  item,
  canvasId,
  actor,
}: {
  item: Item;
  canvasId: string;
  actor: Actor;
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
  const kind = iconKindFor(item);
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

  function onDoubleClick() {
    const ui = useUiStore.getState();
    // Two quick dots from the Pen are ink, not a request to enter the item.
    if (ui.activeTool === "pen") return;
    // The pointer capture above hands us the label's double-click too; naming
    // a thing is not the same as stepping inside it.
    if (ui.renamingItemId === item.id) return;
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
      className={`item${selected ? " selected" : ""}${entered ? " entered" : ""}${drag ? " dragging" : ""}${isInk ? " ink" : ""}${isMark ? " annotation" : ""}${renaming ? " renaming" : ""}${peeked ? " peeked" : ""}`}
      data-item-id={item.id}
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
            maxWidth: row.nameRoom,
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
          <span
            className="work-chip"
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
        <VersionContent
          canvasId={canvasId}
          blobHash={current.blobHash}
          mimeType={current.mimeType}
          filename={current.filename}
          entered={entered}
          designSystem={isDesignSystem(item)}
          reloadToken={reloadToken}
        />

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
}: {
  canvasId: string;
  blobHash: string;
  mimeType: string;
  filename: string;
  entered: boolean;
  /** Bumped by the titlebar's ⟳ to remount a browser item's iframe. */
  reloadToken?: number;
  /** `role=design-system`: draw the tokens as the things they describe rather
   *  than as the text that declares them. */
  designSystem?: boolean;
}) {
  const url = blobUrl(canvasId, blobHash);
  if (designSystem && (mimeType === "text/markdown" || mimeType === "text/plain")) {
    return <DesignSystemView url={url} />;
  }
  if (mimeType === "text/markdown" || mimeType === "text/plain") {
    return <MarkdownView url={url} plain={mimeType === "text/plain"} />;
  }
  if (mimeType.startsWith("image/")) {
    return <img className="img-view" src={url} alt={filename} draggable={false} />;
  }
  if (mimeType.startsWith("video/")) {
    return <video className="video-view" src={url} controls={entered} muted loop playsInline />;
  }
  if (mimeType === BROWSER_MIME) {
    return <BrowserView blobUrl={url} reloadToken={reloadToken} />;
  }
  if (mimeType === "text/html") {
    // Security boundary: src and sandbox are built as a pair by `itemFrame`,
    // the one place allowed to decide them together (content-origin plan,
    // invariant 2). With no content origin that pair is allow-scripts alone —
    // an opaque origin that cannot reach the daemon API, this app's DOM, or
    // its storage. The blob response additionally carries `CSP: sandbox` and
    // nosniff.
    const frame = itemFrame(contentBase(), canvasId, blobHash);
    return (
      <iframe className="html-view" src={frame.src} sandbox={frame.sandbox} title={filename} />
    );
  }
  return (
    <div className="file-view">
      {filename}
      <br />({mimeType})
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
function BrowserView({ blobUrl, reloadToken }: { blobUrl: string; reloadToken: number }) {
  const [load, setLoad] = useState<TextLoad>(() => {
    const cached = peekBlobText(blobUrl);
    return cached === undefined ? null : { text: cached };
  });

  useEffect(() => {
    let cancelled = false;
    fetchBlobText(blobUrl)
      .then((body) => !cancelled && setLoad({ text: body }))
      .catch((err: Error) => !cancelled && setLoad({ failed: err.message }));
    return () => {
      cancelled = true;
    };
  }, [blobUrl]);

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

function MarkdownView({ url, plain }: { url: string; plain: boolean }) {
  const [load, setLoad] = useState<TextLoad>(() => {
    const cached = peekBlobText(url);
    return cached === undefined ? null : { text: cached };
  });

  useEffect(() => {
    let cancelled = false;
    fetchBlobText(url)
      .then((body) => !cancelled && setLoad({ text: body }))
      .catch((err: Error) => !cancelled && setLoad({ failed: err.message }));
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (load === null) return <div className="file-view">…</div>;
  if ("failed" in load) return <BlobError reason={load.failed} />;
  if (plain) return <div className="md-view" style={{ whiteSpace: "pre-wrap" }}>{load.text}</div>;
  return (
    <div className="md-view">
      {/* GFM: tables, strikethrough, task lists, autolinks */}
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{load.text}</ReactMarkdown>
    </div>
  );
}
