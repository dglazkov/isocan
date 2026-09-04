import { useRef, useState, type ReactNode } from "react";
import type { Actor, Placement } from "@isocan/core";
import { type Tool, useUiStore } from "../stores/uiStore.ts";
import { addFailure, addFiles } from "../lib/upload.ts";
import { placeableArea, revealIfOffscreen } from "../lib/spot.ts";
import { glideToBox } from "../lib/zoomactions.ts";
import { HistoryGlyph } from "./Glyphs.tsx";
import { AddPopover } from "./AddPopover.tsx";
import { hideMenu, useChromeHidden } from "../lib/chromemenu.tsx";
import { screenToWorld } from "../lib/viewport.ts";
import { openReactionBar } from "./ReactionBar.tsx";
import { setNotice, useCanvasStore } from "../stores/canvasStore.ts";
import { IDENTITY_COLORS, actorColorIn, useActorColors } from "../lib/colors.ts";

/**
 * The tool rail (right edge): the pointer's mode, Figma-style. Select is the
 * default (click + marquee); Hand pans on drag (also momentary while Space is
 * held); Pen draws freehand ink that settles into an item; Text puts words
 * straight onto the canvas; Comment drops pins. The active tool is the
 * store's `activeTool`; each answers to a letter — Select=V, Hand=H, Zoom=Z,
 * Pen=P, Text=T, Comment=C — and Esc returns to Select. (Version fan-out,
 * once on V, lives on an item's version badge.)
 *
 * Below a divider, one Add button opens the popover that brings anything not
 * drawn here onto the canvas — files, a site, a Google Doc, a canvas (see
 * AddPopover). It was three buttons and a hidden fourth.
 *
 * Picking up the Pen opens the ink well beside it: your identity color first —
 * the one your cursor and your face in the pile already wear, so ink is signed
 * by how it looks — then the rest of the palette.
 */

interface ToolDef {
  tool: Tool;
  label: string;
  hint: string;
  icon: ReactNode;
}

const CURSOR = (
  <svg viewBox="0 0 16 16" width="17" height="17" aria-hidden>
    <path
      d="M3 2.5 12.5 8l-4.2 1-2 4z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinejoin="round"
    />
  </svg>
);

const HAND = (
  <svg viewBox="0 0 16 16" width="17" height="17" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round">
    <path d="M5 8V4.2a1 1 0 0 1 2 0V7m0 0V3.2a1 1 0 0 1 2 0V7m0 0V4.2a1 1 0 0 1 2 0V8m0-1.3a1 1 0 0 1 2 0V10c0 2.2-1.8 4-4 4H8.6c-1 0-2-.5-2.7-1.3L3 9.4a1 1 0 0 1 1.5-1.3L5.6 9.2" />
  </svg>
);

const COMMENT = (
  <svg viewBox="0 0 16 16" width="17" height="17" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round">
    <path d="M2.5 4.5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H7l-3 3v-3h-.5a2 2 0 0 1-2-2z" />
  </svg>
);

const ZOOM = (
  <svg viewBox="0 0 16 16" width="17" height="17" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
    <circle cx="7" cy="7" r="4.2" />
    <path d="M10.2 10.2 14 14M7 5.2v3.6M5.2 7h3.6" />
  </svg>
);

const PEN = (
  <svg viewBox="0 0 16 16" width="17" height="17" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round">
    <path d="M2.2 13.8l.9-2.9 7.4-7.4a1.3 1.3 0 0 1 1.9 0l.7.7a1.3 1.3 0 0 1 0 1.9l-7.4 7.4-2.9.9z" />
    <path d="M9.7 4.3l2.6 2.6" />
  </svg>
);

/**
 * A face, hollow when nothing on the canvas is marked and solid when
 * something is: the rail says whether there is anything in there before you
 * open it.
 *
 * It was a star, and it changed with the dock behind it. A star means one
 * thing — "favourite" — and the dock stopped meaning one thing the moment a
 * team could invent 👀 and 🚧 and ✅ for themselves. A face makes no claim
 * about WHICH marks are in there, which is the honest amount to promise from
 * a 17px icon.
 *
 * Its sibling is `SMILE_PLUS` in Reactions.tsx — a face with a verb (add a
 * mark) where this one is a face with a state. Two drawings on purpose; see
 * the note there.
 */
const marksGlyph = (filled: boolean) => (
  <svg
    viewBox="0 0 16 16"
    width="17"
    height="17"
    aria-hidden
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth="1.3"
    strokeLinecap="round"
  >
    <circle cx="8" cy="8" r="5.9" />
    {/* Drawn ON the fill, so the face still reads when the circle is solid. */}
    <g fill="none" stroke={filled ? "var(--panel)" : "currentColor"}>
      <path d="M5.5 9.4a3 3 0 0 0 5 0" />
      <path d="M6 6.2v.6M10 6.2v.6" />
    </g>
  </svg>
);

/* A capital T on a baseline — the same mark the kind icon uses, because it
   names the same thing from the other end: this makes them, that lists them. */
const TEXT = (
  <svg viewBox="0 0 16 16" width="17" height="17" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
    <path d="M3.5 4h9" />
    <path d="M8 4v8.5" />
  </svg>
);

const TOOLS: ToolDef[] = [
  { tool: "select", label: "Select", hint: "Select — V", icon: CURSOR },
  { tool: "hand", label: "Hand", hint: "Hand — H (or hold Space)", icon: HAND },
  { tool: "zoom", label: "Zoom", hint: "Zoom — Z (tap to latch, hold to zoom a region)", icon: ZOOM },
  { tool: "pen", label: "Pen", hint: "Pen — P (draw in your color; ink lands as an item a moment after you lift)", icon: PEN },
  { tool: "text", label: "Text", hint: "Text — T (click the canvas and type)", icon: TEXT },
  { tool: "comment", label: "Comment", hint: "Comment — C", icon: COMMENT },
];

export function CanvasTools({ canvasId, actor }: { canvasId: string; actor: Actor }) {
  const colors = useActorColors();
  const activeTool = useUiStore((s) => s.activeTool);
  const setActiveTool = useUiStore((s) => s.setActiveTool);
  const inkColor = useUiStore((s) => s.inkColor);
  const marksOpen = useUiStore((s) => s.marksOpen);
  const historyOpen = useUiStore((s) => s.historyOpen);
  const onHistory = useUiStore((s) => s.setHistoryOpen);
  const historyHidden = useChromeHidden("rail.history");
  const hasMarks = useCanvasStore((s) => {
    const items = s.canvas?.items;
    return items
      ? Object.values(items).some((item) => Object.keys(item.reactions ?? {}).length > 0)
      : false;
  });
  const fileInput = useRef<HTMLInputElement>(null);
  const mine = actorColorIn(colors, actor.id);
  const ink = inkColor ?? mine;

  /** Not `chosen`, either way: beside the selection or the middle of the
   *  window is a spot found for the file, not one somebody pointed at, so
   *  the daemon may tidy it clear (`Placement.chosen`). */
  function createPlacement(): Placement {
    const { selectedItemIds, viewport } = useUiStore.getState();
    return selectedItemIds.length === 1
      ? { anchorItemId: selectedItemIds[0]! }
      : screenToWorld(viewport, window.innerWidth / 2, window.innerHeight / 2);
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    // A file that cannot be added offline is phase 10's deferred scope, and
    // the one thing that was not deferred with it is saying so — the error
    // carries the sentence (see `uploadBlob`), this puts it where it can be
    // read. An unhandled rejection in a console is not a person being told.
    // Not `chosen` — `createPlacement` finds a spot for the file; see it.
    const ids = await addFiles(canvasId, actor, files, createPlacement()).catch((err: unknown) => {
      // "2 of 5 added — <why>", and the two are selected below (#51).
      const { landed, notice } = addFailure(err, files.length, "That file could not be added.");
      setNotice(notice);
      return landed;
    });
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

  return (
    <div className="tool-rail" role="toolbar" aria-label="Canvas tools" aria-orientation="vertical">
      {TOOLS.map((t) => (
        <div key={t.tool} className="tool-slot">
          <button
            className={`tool-btn${activeTool === t.tool ? " active" : ""}`}
            title={t.hint}
            aria-label={t.label}
            aria-pressed={activeTool === t.tool}
            onClick={() => setActiveTool(t.tool)}
          >
            {t.icon}
            {t.tool === "pen" && <span className="ink-chip" style={{ background: ink }} />}
          </button>
          {t.tool === "pen" && activeTool === "pen" && (
            <div className="ink-well" role="group" aria-label="Ink color">
              <button
                className={`ink-swatch mine${inkColor === null ? " active" : ""}`}
                style={{ background: mine }}
                title={`Your color — ${actor.name}`}
                aria-label={`Your color, ${actor.name}`}
                aria-pressed={inkColor === null}
                onClick={() => useUiStore.getState().setInkColor(null)}
              />
              <div className="ink-sep" />
              {IDENTITY_COLORS.filter((c) => c.value !== mine).map((c) => (
                <button
                  key={c.value}
                  className={`ink-swatch${inkColor === c.value ? " active" : ""}`}
                  style={{ background: c.value }}
                  title={c.name}
                  aria-label={c.name}
                  aria-pressed={inkColor === c.value}
                  onClick={() => useUiStore.getState().setInkColor(c.value)}
                />
              ))}
            </div>
          )}
        </div>
      ))}
      <div className="tool-sep" />
      <button
        className={`tool-btn${marksOpen ? " active" : ""}`}
        title={hasMarks ? "Reactions — the canvas by its marks" : "Reactions — nothing marked yet"}
        aria-label="Reactions"
        aria-pressed={marksOpen}
        onClick={() => openReactionBar(canvasId, !marksOpen)}
      >
        {marksGlyph(hasMarks)}
      </button>
      {/* Beside Reactions, because both are ways of LOOKING at the canvas
          rather than adding to it — one asks what people marked, the other
          asks what it was. */}
      {/* Hideable (chrome you can turn off): right-click says how to get it
          back — ⌘K "Open History" — before it goes. */}
      {!historyHidden && (
        <button
          className={`tool-btn${historyOpen ? " active" : ""}`}
          title="History — the canvas as it was"
          aria-label="History"
          aria-pressed={historyOpen}
          onClick={() => onHistory(!historyOpen)}
          onContextMenu={(e) => hideMenu(e, "rail.history")}
        >
          <HistoryGlyph size={17} />
        </button>
      )}
      {/* One door for everything brought onto the canvas that was not drawn
          here — files, a site, a Google Doc, a canvas. It was three buttons
          and a hidden fourth; the popover reads what it is given and says
          what it would do, so one field is enough. See AddPopover. */}
      <AddPopover canvasId={canvasId} actor={actor} onFiles={() => fileInput.current?.click()} />
      <input
        ref={fileInput}
        type="file"
        multiple
        hidden
        onChange={onPick}
        accept=".md,.markdown,.txt,.html,.htm,image/*,video/*"
      />
    </div>
  );
}

