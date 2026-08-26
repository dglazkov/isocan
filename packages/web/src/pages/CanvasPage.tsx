import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { Link, useMatch, useNavigate, useParams } from "react-router-dom";
import type { Actor } from "@isocan/core";
import { WORKBENCH_ROUTE, itemPath, workbenchItemPath, workbenchPath } from "@isocan/core";
import {
  connectToCanvas,
  disconnect,
  publishSelection,
  setPresenceActor,
  useCanvasStore,
} from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { redo, sendOp, undo } from "../lib/api.ts";
import { applyLocalEcho } from "../stores/canvasStore.ts";
import { centerOn, fitInto, itemsBounds } from "../lib/viewport.ts";
import { stageRect } from "../lib/stage.ts";
import { sessionLocus } from "../lib/presence.ts";
import { checkForUpdate } from "../lib/appversion.ts";
import { placeSketch } from "../lib/sketch.ts";
import { CanvasViewport } from "../components/CanvasViewport.tsx";

/**
 * A lazy chunk, and that is a budget rather than a style: the main bundle is
 * past its 600KB warning, and the canvas path must pay nothing for a view it
 * has not flipped to.
 */
const Workbench = lazy(() =>
  import("../components/Workbench.tsx").then((m) => ({ default: m.Workbench })),
);
import { FullScreen } from "../components/FullScreen.tsx";
import { CommandBar } from "../components/CommandBar.tsx";
import { CanvasTools } from "../components/CanvasTools.tsx";
import { ZoomControls } from "../components/ZoomControls.tsx";
import { Toolbar } from "../components/Toolbar.tsx";
import { Minimap } from "../components/Minimap.tsx";
import { revealItem, zoomBy, zoomTo100, zoomToFit, zoomToSelection } from "../lib/zoomactions.ts";
import { findNextItem, nearestToPoint, type Direction } from "../lib/spatialnav.ts";
import { screenToWorld } from "../lib/viewport.ts";
import { TrashPanel } from "../components/TrashPanel.tsx";
import { MainThreadPanel } from "../components/MainThreadPanel.tsx";
import { FilesPanel } from "../components/FilesPanel.tsx";
import { ReactionBar, restoreReactionBar } from "../components/ReactionBar.tsx";
import { CommentToasts } from "../components/CommentToasts.tsx";
import { OfflineBar } from "../components/OfflineBar.tsx";
import { unreadThreads, useUnreadStore } from "../stores/unreadStore.ts";
import { HelpPanel } from "../components/HelpPanel.tsx";
import { crossesCover, isTyping } from "../lib/keys.ts";
import { OwnCursor } from "../components/OwnCursor.tsx";
import { fitToContent } from "../lib/fititem.ts";
import { useCanvasHome } from "../lib/homes.ts";
import { ElsewherePage } from "./ElsewherePage.tsx";

/** Arrow keys → a world-space direction. */
const NUDGES: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/** Shift makes it a stride instead of a step. */
const NUDGE_BIG = 10;

/** How long after the last arrow press the move is written. */
const NUDGE_FLUSH_MS = 350;

function moveOp(moves: Array<{ itemId: string; x: number; y: number }>) {
  return moves.length === 1
    ? ({ type: "item.move", ...moves[0]! } as const)
    : ({ type: "items.move", moves } as const);
}

/**
 * **The per-canvas door, checked before anything is opened** (phase 10.3).
 *
 * A daemon serves the app for the canvases whose home it is and signposts the
 * rest, but that guard lives on `GET /p/<id>` and a react-router `<Link>`
 * never asks the server anything. So the route asks: is this canvas ours to
 * render? Only when the answer is yes does `CanvasSurface` mount — and mount
 * is the moment that matters, because it is where the socket is opened, the
 * IndexedDB replica is written and the tab starts behaving like a copy of a
 * canvas whose real copy is somewhere else.
 *
 * A gate rather than a branch inside the page for exactly that reason: React
 * runs a mounted component's effects before any conditional render can undo
 * them, so a check made after mounting would be a check made after the damage.
 * `lib/homes.ts` holds what "yes" means, including why a daemon that does not
 * answer at all is a yes.
 */
export function CanvasPage(props: {
  actor: Actor;
  onIdentity: (actor: Actor | null) => void;
}) {
  const { canvasId } = useParams<{ canvasId: string }>();
  const where = useCanvasHome(canvasId ?? null);
  if (!canvasId) return null;
  // A sentence, in the same voice the door uses while a pass is redeemed —
  // not a spinner and not a blank page, for the fraction of a second a
  // same-origin read of `/api/homes` takes.
  if (where.state === "asking") return <div className="page-note">Finding this canvas…</div>;
  if (where.state === "elsewhere") {
    return <ElsewherePage canvasId={canvasId} home={where.home} />;
  }
  return <CanvasSurface {...props} />;
}

function CanvasSurface({
  actor,
  onIdentity,
}: {
  actor: Actor;
  onIdentity: (actor: Actor | null) => void;
}) {
  // `itemId` is full screen's; `wbItemId` is the workbench's. Two names on
  // purpose — both cover routes mount THIS element, and useParams merges
  // whatever the matched pattern captured, so a shared name could not say
  // which cover is up (address.ts, WORKBENCH_ROUTE).
  const { canvasId, itemId, wbItemId } = useParams<{
    canvasId: string;
    itemId?: string;
    wbItemId?: string;
  }>();
  // Unconditional hook call, then the ||: the match must not sit behind a
  // short-circuit or the hook order changes with the route.
  const wbRootMatch = useMatch(WORKBENCH_ROUTE);
  const onWorkbench = wbItemId !== undefined || wbRootMatch !== null;
  const navigate = useNavigate();
  const panelResizing = useUiStore((s) => s.panelResizing);
  const canvas = useCanvasStore((s) => s.canvas);
  const connection = useCanvasStore((s) => s.connection);
  const seen = useUnreadStore((s) => s.seen);
  const followSessionId = useUiStore((s) => s.followSessionId);
  const followedLabel = useCanvasStore((s) => {
    const session = s.sessions.find((x) => x.sessionId === followSessionId);
    return session ? session.label ?? session.actor.name : null;
  });
  const [outdated, setOutdated] = useState(false);
  const didFit = useRef(false);
  // A held arrow key is ONE gesture, not thirty: the replica moves on every
  // press so the item tracks the key, and the op that records it is written
  // once the nudging stops. One undo step, one line in the log.
  const nudgeTimer = useRef<number | null>(null);
  // Who to open a connection as, without making a rename reconnect.
  const actorRef = useRef(actor);
  actorRef.current = actor;

  useEffect(() => {
    if (!canvasId) return;
    didFit.current = false;
    restoreReactionBar(canvasId);
    connectToCanvas(canvasId, actorRef.current);
    return disconnect;
  }, [canvasId]);

  // Becoming someone else does NOT drop the socket. The tab keeps its session
  // and simply asserts the new actor on the next presence beat, which the
  // daemon adopts — reconnecting would race the old socket's teardown against
  // the new socket's session (same tab id) and could leave you off the roster.
  useEffect(() => {
    setPresenceActor(actor);
  }, [actor]);

  // Broadcast selection changes on the presence channel.
  useEffect(() => useUiStore.subscribe((s, prev) => {
    if (s.selectedItemIds !== prev.selectedItemIds) publishSelection();
  }), []);

  // Zoom-to-fit once, on the first snapshot.
  useEffect(() => {
    if (!canvas || didFit.current) return;
    didFit.current = true;
    const box = itemsBounds(canvas);
    if (box) {
      useUiStore
        .getState()
        .setViewport(fitInto(box, stageRect()));
    }
  }, [canvas]);

  // Watch mode (#39): the camera chases the followed session's locus so the
  // agent's work is always on screen. Rest-and-chase, not a hard tether:
  // hold still while they putter near center, glide after them once they
  // stray, settle again. Any manual pan/zoom/jump goes through setViewport,
  // which clears the follow — the user grabbing the wheel always wins.
  useEffect(() => {
    if (!followSessionId) return;
    let raf = 0;
    let chasing = true; // open with a catch-up glide to wherever they are
    const step = () => {
      const { sessions, canvas: current } = useCanvasStore.getState();
      const ui = useUiStore.getState();
      const session = sessions.find((s) => s.sessionId === followSessionId);
      const locus = session && current ? sessionLocus(session, current) : null;
      if (!locus) {
        ui.setFollow(null); // they left, or lost their place — nothing to watch
        return;
      }
      // Centre the locus in the STAGE, not the window. `centerOn` aims at
      // width/2, so handing it twice the stage's centre lands the point at
      // the centre of what is actually visible — the same arithmetic the old
      // `innerWidth + panelWidth` hack did for the left panel only, now from
      // the one derivation that also knows the docks and the rail gutter.
      const stage = stageRect();
      const target = centerOn(
        ui.viewport,
        locus.x,
        locus.y,
        stage.x * 2 + stage.width,
        stage.y * 2 + stage.height,
      );
      const dx = target.tx - ui.viewport.tx;
      const dy = target.ty - ui.viewport.ty;
      const dist = Math.hypot(dx, dy); // screen px — tx/ty live in screen space
      const wake = Math.min(stage.width, stage.height) * 0.22;
      if (!chasing && dist > wake) chasing = true;
      if (chasing) {
        if (dist < 1) chasing = false;
        else ui.followViewport({ ...ui.viewport, tx: ui.viewport.tx + dx * 0.12, ty: ui.viewport.ty + dy * 0.12 });
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [followSessionId]);

  // Ink is never quietly lost: leaving the canvas places whatever the Pen has
  // drawn but not yet settled, so the strokes become an item instead of
  // evaporating with the page's local state.
  useEffect(() => {
    if (!canvasId) return;
    return () => placeSketch(canvasId, actorRef.current);
  }, [canvasId]);

  // A daemon restart is where an upgrade becomes visible: the socket drops,
  // comes back, and the app this tab is running may no longer be the one being
  // served. Check on every reconnect (and once on arrival) rather than polling.
  useEffect(() => {
    if (connection !== "live") return;
    let cancelled = false;
    void checkForUpdate().then((yes) => {
      if (yes && !cancelled) setOutdated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [connection]);

  // Unread comments reach a backgrounded tab through its title.
  useEffect(() => {
    const count = canvas ? unreadThreads(canvas, seen, actor.id).length : 0;
    document.title = count > 0 ? `(${count}) isocan` : "isocan";
    return () => {
      document.title = "isocan";
    };
  }, [canvas, seen, actor.id]);

  // Keyboard shortcuts — typical visual-editor ergonomics.
  useEffect(() => {
    if (!canvasId) return;

    /** Move the selection by whole world units: 1 per press, 10 with shift. */
    function nudge(dx: number, dy: number): void {
      const ids = useUiStore.getState().selectedItemIds;
      const canvas = useCanvasStore.getState().canvas;
      if (ids.length === 0 || !canvas) return;
      const moves = ids
        .map((id) => canvas.items[id])
        .filter((item) => item !== undefined)
        .map((item) => ({ itemId: item.id, x: item.x + dx, y: item.y + dy }));
      if (moves.length === 0) return;
      // Optimistic: the replica is what the screen draws, so the item moves
      // now and the daemon hears about it when the keys stop.
      applyLocalEcho(moveOp(moves), actor);
      if (nudgeTimer.current !== null) clearTimeout(nudgeTimer.current);
      nudgeTimer.current = window.setTimeout(() => {
        nudgeTimer.current = null;
        flushNudge();
      }, NUDGE_FLUSH_MS);
    }

    /**
     * Walk the selection one item in a direction. With nothing selected, the
     * walk starts at whatever is nearest the middle of the screen — the item
     * you are already looking at.
     */
    function jump(direction: Direction): void {
      const ui = useUiStore.getState();
      const canvas = useCanvasStore.getState().canvas;
      if (!canvas) return;
      const all = Object.values(canvas.items);
      if (all.length === 0) return;
      const selected = ui.selectedItemIds;

      if (selected.length === 0) {
        const stage = stageRect();
        const middle = screenToWorld(
          ui.viewport,
          stage.x + stage.width / 2,
          stage.y + stage.height / 2,
        );
        const start = nearestToPoint(all, middle.x, middle.y);
        if (start) {
          ui.select(start.id);
          revealItem(start.id);
        }
        return;
      }

      // A multi-item selection travels as its bounding box, and the items it
      // is standing on are not candidates — they are not "over there".
      const held = selected.map((id) => canvas.items[id]).filter((item) => item !== undefined);
      if (held.length === 0) return;
      const box = held.length === 1
        ? held[0]!
        : {
            id: "",
            x: Math.min(...held.map((i) => i.x)),
            y: Math.min(...held.map((i) => i.y)),
            width: Math.max(...held.map((i) => i.x + i.width)) - Math.min(...held.map((i) => i.x)),
            height: Math.max(...held.map((i) => i.y + i.height)) - Math.min(...held.map((i) => i.y)),
          };
      const candidates = all.filter((item) => !selected.includes(item.id));
      const next = findNextItem(box, candidates, direction);
      if (!next) return; // the edge of the canvas: stay put rather than wrap
      ui.select(next.id);
      revealItem(next.id);
    }

    /** Write where the nudged items actually ended up. Items deleted mid-nudge
     * are gone from the replica, so they simply drop out of the op. */
    function flushNudge(): void {
      const ids = useUiStore.getState().selectedItemIds;
      const canvas = useCanvasStore.getState().canvas;
      if (ids.length === 0 || !canvas) return;
      const moves = ids
        .map((id) => canvas.items[id])
        .filter((item) => item !== undefined)
        .map((item) => ({ itemId: item.id, x: Math.round(item.x), y: Math.round(item.y) }));
      if (moves.length > 0) void sendOp(canvasId!, actor, moveOp(moves));
    }
    function onKeyDown(e: KeyboardEvent) {
      // A cover route hides the canvas but keeps its selection — Enter
      // arrives full screen with the viewed item still selected, so any
      // shortcut that fired under here would act on the exact thing being
      // looked at (Delete deleted it). Only what crossesCover says may pass;
      // Esc is the cover's own, bound in capture phase.
      if ((itemId || onWorkbench) && !crossesCover(e)) return;
      // ⌘K is global — the lane to your emissary opens from anywhere, even
      // mid-typing in another field.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const ui = useUiStore.getState();
        ui.setCommandBarOpen(!ui.commandBarOpen);
        return;
      }
      // ⌘+/⌘− zoom the canvas, not the browser viewport. ⌘0 → zoom-to-fit.
      // Placed before the input-field guard so they fire globally (like ⌘K).
      if ((e.metaKey || e.ctrlKey) && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        zoomBy(1.25);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "-") {
        e.preventDefault();
        zoomBy(1 / 1.25);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "0") {
        e.preventDefault();
        zoomToFit();
        return;
      }
      if (isTyping(e.target)) return;
      const ui = useUiStore.getState();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        // Ink that has not settled yet undoes locally, one stroke at a time:
        // it is not in the oplog, so the daemon has nothing to reverse. A
        // moment later the drawing IS an item and ⌘Z removes the whole thing,
        // like it removes anything else.
        if (!e.shiftKey && ui.sketch.length > 0) {
          ui.undoStroke();
          return;
        }
        const action = e.shiftKey ? redo : undo;
        void action(canvasId!, actor).catch(() => {}); // 409 = nothing to undo
      } else if (e.key === "Enter" && ui.sketch.length > 0) {
        // ⏎ places the drawing now instead of waiting out the settle.
        e.preventDefault();
        placeSketch(canvasId!, actor);
      } else if ((e.metaKey || e.ctrlKey) && NUDGES[e.key]) {
        // ⌘/Ctrl + arrow walks the selection to the next item that way.
        e.preventDefault();
        jump(e.key as Direction);
      } else if (NUDGES[e.key]) {
        // Arrows nudge the selection; with nothing selected they are the
        // browser's again (and scrolling a canvas page does nothing anyway).
        if (ui.selectedItemIds.length === 0) return;
        e.preventDefault();
        const [dx, dy] = NUDGES[e.key]!;
        const step = e.shiftKey ? NUDGE_BIG : 1;
        nudge(dx * step, dy * step);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        const ids = ui.selectedItemIds;
        if (ids.length > 0) {
          e.preventDefault();
          // Batch delete = one undo step for the whole selection.
          void sendOp(
            canvasId!,
            actor,
            ids.length === 1
              ? { type: "item.delete", itemId: ids[0]! }
              : { type: "items.delete", itemIds: ids },
          );
          ui.select(null);
        }
      } else if (e.key === "F2") {
        // Rename the selection, the way a file manager would.
        const ids = ui.selectedItemIds;
        if (ids.length === 1) {
          e.preventDefault();
          ui.setRenaming(ids[0]!);
        }
      } else if (e.key === "Enter" && ui.selectedItemIds.length === 1) {
        // Enter opens the selection full screen. It is a NAVIGATION, not a
        // mode flag: the address bar ends up holding the screen you are
        // looking at, so Back leaves it and the link is sendable.
        e.preventDefault();
        navigate(itemPath(canvasId!, ui.selectedItemIds[0]!));
      } else if (e.key.toLowerCase() === "w" && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
        // W flips to the workbench — the agent room. A navigation for Enter's
        // reason, and it carries a single selection along as the stage's
        // focus, the one thing the flip transfers (design doc: one-way, at
        // the boundary only).
        e.preventDefault();
        const one = ui.selectedItemIds.length === 1 ? ui.selectedItemIds[0]! : null;
        navigate(one ? workbenchItemPath(canvasId!, one) : workbenchPath(canvasId!));
      } else if (e.key === "Escape") {
        // Watching is the outermost mode: Esc hands the camera back first.
        if (ui.renamingItemId) ui.setRenaming(null);
        else if (ui.followSessionId) ui.setFollow(null);
        else if (ui.pendingComment) ui.setPendingComment(null);
        else if (ui.openThreadId) ui.setOpenThread(null);
        else if (ui.commentMode) ui.setCommentMode(false);
        else if (ui.activeTool !== "select") ui.setActiveTool("select");
        else if (ui.fannedItemId) ui.setFanned(null);
        else if (ui.enteredItemId) ui.setEntered(null);
        else ui.select(null);
      } else if (e.shiftKey && e.code === "Digit0") {
        e.preventDefault();
        zoomTo100();
      } else if (e.shiftKey && e.code === "Digit1") {
        e.preventDefault();
        zoomToFit();
      } else if (e.shiftKey && e.code === "Digit2") {
        e.preventDefault();
        zoomToSelection();
      } else if (e.shiftKey && e.code === "KeyF" && ui.selectedItemIds.length > 0) {
        // F fits the VIEW to the item; ⇧F fits the ITEM to its content. Not in
        // the ⇧0/⇧1/⇧2 family despite ⇧3 being free there: those move the
        // camera and undo nothing, and this writes ops.
        e.preventDefault();
        void fitToContent(canvasId!, actor, ui.selectedItemIds);
      } else if (e.key === "0") {
        zoomToFit();
      } else if (e.code === "KeyV" && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
        ui.setActiveTool("select"); // V is Select, the way every canvas has it
      } else if (e.key.toLowerCase() === "h" && !e.metaKey && !e.ctrlKey) {
        ui.setActiveTool(ui.activeTool === "hand" ? "select" : "hand");
      } else if (e.key.toLowerCase() === "f" && !e.metaKey && !e.ctrlKey) {
        // Focus: fill the screen with what you are looking at. With nothing
        // selected there is only one honest reading of "focus" — everything.
        e.preventDefault();
        if (ui.selectedItemIds.length > 0) zoomToSelection();
        else zoomToFit();
      } else if (e.key.toLowerCase() === "s" && !e.metaKey && !e.ctrlKey) {
        // S fans out the version Stack — which is what the badge and the UI
        // have always called it. V went back to Select, where every canvas
        // tool puts it; a single letter beats a modified one for something
        // you press while looking straight at the item.
        const ids = ui.selectedItemIds;
        const canvas = useCanvasStore.getState().canvas;
        if (ids.length === 1 && canvas && (canvas.items[ids[0]!]?.versions.length ?? 0) > 1) {
          e.preventDefault();
          ui.setFanned(ui.fannedItemId === ids[0] ? null : ids[0]!);
        }
      } else if (e.shiftKey && e.key.toLowerCase() === "c" && !e.metaKey && !e.ctrlKey) {
        // ⇧C comments on WHAT IS SELECTED, rather than on wherever you next
        // manage to click. The anchored thread already existed — comment mode
        // makes one when you click an item, and `isocan comment add --item`
        // has always made one from a terminal — but reaching it meant picking
        // up a tool and then aiming at a thing you had already pointed at.
        //
        // Anchoring matters beyond convenience: an anchored thread RIDES its
        // item, so the conversation stays on the screen it is about when
        // somebody moves it. A pin dropped nearby does not.
        const ids = ui.selectedItemIds;
        if (ids.length === 1) {
          e.preventDefault();
          // Top-left of the item, in its own coordinates — where a thread
          // anchored by the CLI lands too, so both surfaces agree.
          ui.setPendingComment({ x: 0, y: 0, anchorItemId: ids[0]! });
        }
      } else if (e.key.toLowerCase() === "c" && !e.metaKey && !e.ctrlKey) {
        ui.setCommentMode(!ui.commentMode);
      } else if (e.key === "?" && !e.metaKey && !e.ctrlKey) {
        // The key every app with shortcuts has trained people to try.
        e.preventDefault();
        ui.setHelpOpen(!ui.helpOpen);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (nudgeTimer.current !== null) {
        clearTimeout(nudgeTimer.current);
        nudgeTimer.current = null;
        flushNudge(); // leaving mid-nudge still records where things landed
      }
    };
    // itemId is a dependency because the handler closes over it: without it,
    // the listener registered on the canvas route keeps a stale undefined
    // forever and the cover gate never turns on.
  }, [canvasId, actor, itemId, onWorkbench]);

  if (!canvasId) return null;

  // The three ends of a connection that will not come back, each said in its
  // own words. `refused` is phase 7's: the door works now, so "this canvas
  // will not have you" is a thing a person can actually be told — and the one
  // recovery is a social one, which is why the note says who to ask instead of
  // offering a retry that would be refused identically.
  const dead: Record<string, { note: string; hint?: string }> = {
    gone: { note: "This canvas was deleted." },
    refused: {
      note: "This canvas will not have you.",
      hint: "Its link has been switched off. Ask whoever shared it to turn it back on, or to let you in.",
    },
    absent: {
      note: "There is no canvas at this address.",
      hint: "Check the link you were sent — the Share dialog's copy button always produces a working one.",
    },
  };
  const end = dead[connection];
  if (end) {
    return (
      <div className="canvas-page">
        <div className="page-note page-note-stack">
          <div>{end.note}</div>
          {end.hint && <div className="page-note-hint">{end.hint}</div>}
          <Link to="/">All canvases</Link>
        </div>
      </div>
    );
  }

  return (
    // `resizing-panel` while the panel's edge is being dragged: chrome that
    // steps aside for the panel eases to its new place, which is right for the
    // one step of opening and wrong for a width changing every frame.
    <div className={`canvas-page${panelResizing ? " resizing-panel" : ""}`}>
      {/* Covered, the canvas keeps its state and stops its paint:
          `visibility` preserves layout and the stores keep replaying, so Esc
          lands at the zoom you left without the covered surface spending
          frames nobody can see. */}
      <div style={{ visibility: itemId || onWorkbench ? "hidden" : "visible" }}>
        <CanvasViewport canvasId={canvasId} actor={actor} />
      </div>
      <CommandBar canvasId={canvasId} actor={actor} />
      <Toolbar actor={actor} onIdentity={onIdentity} />
      {outdated && (
        <button className="follow-banner update-banner" onClick={() => location.reload()}>
          isocan updated — reload to catch up
        </button>
      )}
      {followedLabel && (
        <button className="follow-banner" onClick={() => useUiStore.getState().setFollow(null)}>
          Watching {followedLabel} — Esc to stop
        </button>
      )}
      <CanvasTools canvasId={canvasId} actor={actor} />
      <ZoomControls canvasId={canvasId} actor={actor} />
      <Minimap />
      <TrashPanel canvasId={canvasId} actor={actor} />
      <MainThreadPanel canvasId={canvasId} actor={actor} />
      <FilesPanel canvasId={canvasId} />
      <ReactionBar canvasId={canvasId} />
      <CommentToasts />
      {/* Offline, refusals, and anything that could not be done at all
          (phase 10). Above the panels for the reason `ArrivalNotice` is:
          it is about the connection, not about what is on the canvas. */}
      <OfflineBar />
      <HelpPanel />
      <OwnCursor actor={actor} />
      {/* Last, so it covers the panels and the toolbar: full screen means the
          screen. Driven by the route rather than by state — see
          FullScreen.tsx for why that distinction is the whole design. */}
      {itemId && <FullScreen canvasId={canvasId} itemId={itemId} actor={actor} />}
      {/* The other cover: same architecture, different room. Lazy, so the
          canvas path never pays for it; Suspense falls back to nothing for
          the frame the chunk takes. */}
      {onWorkbench && (
        <Suspense fallback={null}>
          <Workbench canvasId={canvasId} itemId={wbItemId ?? null} actor={actor} />
        </Suspense>
      )}
    </div>
  );
}
