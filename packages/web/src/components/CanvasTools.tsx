import { useRef, useState, type ReactNode } from "react";
import type { Actor, Placement } from "@isocan/core";
import { type Tool, useUiStore } from "../stores/uiStore.ts";
import { BROWSER_SIZE, addBrowserItem, addDocumentItem, addFiles } from "../lib/upload.ts";
import { checkFrameable, exportDoc } from "../lib/api.ts";
import { docFilenameFrom, googleDocId, siteLabel } from "@isocan/core";
import { placeableArea, revealIfOffscreen, spotInView } from "../lib/spot.ts";
import { glideToBox } from "../lib/zoomactions.ts";
import { HistoryGlyph } from "./Glyphs.tsx";
import { PlaceCanvas } from "./PlaceCanvas.tsx";
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
 * Below a divider, the upload button opens a file picker to bring files onto
 * the canvas — moved here from the top bar to match the Figma tool rail idiom.
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

/**
 * A clock with its hand swept back — the canvas's history. Not an arrow and
 * not a rewind: both of those promise something moves BACKWARDS, and nothing
 * here does. You stand somewhere; the canvas shows you what stood there.
 */
const UPLOAD = (
  <svg viewBox="0 0 16 16" width="17" height="17" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="12" height="10" rx="1.5" />
    <path d="M2 10.5l3.3-3.3a1 1 0 0 1 1.4 0L9 9.5m0 0l1.3-1.3a1 1 0 0 1 1.4 0L14 10.5" />
    <circle cx="10.5" cy="5.8" r="1" />
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

/* The mark a live site already wears everywhere else (`KindIcon`'s `site`):
   the tool that makes them and the icon that lists them are the same shape,
   which is the only way somebody learns what this button produces without
   pressing it. Both changed together — see `KindIcon` for why it is a browser
   window and not the play button it used to be. */
const SITE = (
  <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round">
    <path d="M3 5h18v14H3z" />
    <path d="M3 9h18" />
    <path d="M6 7h.01M8.5 7h.01" />
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
      setNotice(err instanceof Error ? err.message : "That file could not be added.");
      return [] as string[];
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
      <button
        className={`tool-btn${historyOpen ? " active" : ""}`}
        title="History — the canvas as it was"
        aria-label="History"
        aria-pressed={historyOpen}
        onClick={() => onHistory(!historyOpen)}
      >
        <HistoryGlyph size={17} />
      </button>
      <button
        className="tool-btn"
        title="Upload files to canvas"
        aria-label="Upload files"
        onClick={() => fileInput.current?.click()}
      >
        {UPLOAD}
      </button>
      {/* Beside Upload, and that pairing is the argument: both bring onto the
          canvas something that was not drawn here — one from the disk, one
          from a URL. It sat in the top bar among navigation and identity,
          which is why it never read as belonging to anything. */}
      <ProjectSite canvasId={canvasId} actor={actor} />
      <PlaceCanvas canvasId={canvasId} actor={actor} />
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

/**
 * **Put a live site onto the canvas.**
 *
 * Not "Project", which was the first label and is a word this product has
 * already spent: `project.create` is the op that makes a CANVAS, ids are
 * `prj_`, and the config calls one `defaultProjectId`. A button reading
 * "Project" inside the thing isocan calls a project is a collision with the
 * domain's own noun, not merely an ambiguous verb.
 *
 * A press, a URL, done — the same shape as Upload beside it, which is why it
 * is a popover and not a placement tool. The hard part of this interaction is
 * the address; where it goes you will decide by dragging, the way you do with
 * anything 800x600. (The drawing tools place on click because for ink and
 * words the POSITION is the input. Here it is not.)
 */
function ProjectSite({ canvasId, actor }: { canvasId: string; actor: Actor }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const canvas = useCanvasStore((s) => s.canvas);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      // Somewhere clear AND somewhere you can see — `spotInView`. The daemon
      // already keeps items off each other, but it cannot know where the
      // viewport is, and its search rings are the item's own size: for a
      // site that is a screenful per step, so a nudged one lands off the
      // edge and reads as nothing having happened.
      const at = spotInView(
        useUiStore.getState().viewport,
        Object.values(canvas?.items ?? {}),
        BROWSER_SIZE.width,
        BROWSER_SIZE.height,
        placeableArea(),
      );
      /**
       * **Ask whether the site will let itself be framed, before making an
       * item that cannot show it.**
       *
       * An item is an iframe, and most of the public web refuses to be one.
       * The refusal was silent: `yahoo.com` created an item, the browser
       * declined to render it, and the canvas showed a blank rectangle — so
       * the honest report was "it didn't work" when it had worked exactly as
       * built and nobody had said what happened.
       *
       * The check runs on the daemon because a page cannot tell a blocked
       * cross-origin frame from a loaded one. It is ADVICE and never a gate:
       * anything that goes wrong in the probe answers `ok`, so a site that
       * would have worked is never refused on our guess.
       */
      /**
       * A Google Doc typed here becomes a DOCUMENT, not a frame: its markdown
       * export as the item, with `source` and `synced` on it, so the canvas
       * can read, thumb and version it and the ↗ opens the real doc
       * (`docs/research/2026-09-02-google-docs-on-the-canvas.md`). The
       * daemon does the fetch; a private doc is refused in its own words.
       */
      if (googleDocId(url)) {
        const doc = await exportDoc(url);
        const itemId = await addDocumentItem(
          canvasId,
          actor,
          { title: doc.title, markdown: doc.markdown, filename: docFilenameFrom(doc.title), source: doc.source, syncedAt: doc.fetchedAt },
          at,
        );
        setOpen(false);
        setUrl("");
        setError(null);
        useUiStore.getState().select(itemId);
        return;
      }
      const verdict = await checkFrameable(url);
      if (!verdict.ok) {
        setError(
          `${siteLabel(verdict.url ?? url)} ${verdict.why ?? "refuses to be shown in a frame"}. ` +
            "Nothing was added.",
        );
        return;
      }
      const itemId = await addBrowserItem(canvasId, actor, url, at);
      setOpen(false);
      setUrl("");
      setError(null);
      useUiStore.getState().select(itemId);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="create-site">
      <button
        className={`tool-btn${open ? " active" : ""}`}
        /* It said "point it at your localhost dev server", which named the
           common case as if it were the rule and left somebody typing a real
           address wondering what they had done wrong. Any http(s) address
           works — what decides is whether the SITE allows framing, which is
           the site's call and not ours. */
        title="Add a live site — any address that allows being shown in a frame"
        aria-label="Add a live site"
        aria-pressed={open}
        onClick={() => {
          setOpen(!open);
          setError(null);
        }}
      >
        {SITE}
      </button>
      {open && (
        <form className="site-popover" onSubmit={submit}>
          <input
            className="text-input"
            autoFocus
            placeholder="localhost:5173, any site, or a Google Doc"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
            }}
          />
          {/* "Add site" — the noun the rest of the app uses for what you get
              (`KindIcon`'s `site`, `isocan ls --kind site`, the Files group),
              so the button names its own result. It said "Canvas" first, which
              was a destination where a verb belongs, and then "Project", which
              is what isocan calls a canvas. */}
          <button className="btn primary" type="submit" disabled={!url.trim()}>
            Add site
          </button>
          {error && <div className="site-error">{error}</div>}
        </form>
      )}
    </div>
  );
}
