import { useEffect, useMemo, useState } from "react";
import type { Actor, Canvas, AddKind, Addable, Item, Placement } from "@isocan/core";
import {
  CANVAS_ITEM_SIZE,
  CONTEXT_SHEET_SIZE,
  CONTEXT_SHEET_TITLE,
  contextSheet,
  contextSheetSpot,
  freeSpotIn,
  addableWords,
  ago,
  classifyAddable,
  docFilenameFrom,
  googleDocId,
  normalizeSiteUrl,
  opWords,
  siteLabel,
} from "@isocan/core";
import { checkFrameable, exportDoc, listCanvases } from "../lib/api.ts";
import { BROWSER_SIZE, addAreaItem, addBrowserItem, addCanvasItem, addDocumentItem } from "../lib/upload.ts";
import { placeableArea, spotInView } from "../lib/spot.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { KindIcon } from "./KindIcon.tsx";

/**
 * **One door for everything you bring onto the canvas.**
 *
 * The rail had three add buttons — files, a live site, a canvas — and the
 * Google Doc hid inside the site one; the terminal had four verbs for the
 * same act. One button now, and a popover with one field that reads what
 * you give it: a doc address becomes a document, a canvas address or one
 * of your canvases' titles becomes a card, any other address becomes a
 * site, and words search your canvases. The line under the field says what
 * Enter would do, so a single field is safe: wrong guess, press the row you
 * meant. The rows — Files, Site, Google Doc, Canvas — only narrow the field;
 * Files opens the picker, because a file is not something you can type.
 *
 * Wherever it lands is the same rule for all of them: the spot in view,
 * unchosen, so the daemon may tidy it clear. The state lives in the ui
 * store because ⌘K opens this popover too, and a dialog only its own button
 * could open would be one the launcher could not name.
 */
const PLACEHOLDER: Record<AddKind | "any", string> = {
  any: "Paste an address, or type a canvas name…",
  file: "Choosing files…",
  site: "localhost:5173, or any site that allows framing",
  doc: "A Google Doc's address",
  canvas: "Search your canvases, or paste an address",
};

export function AddPopover({ canvasId, actor, onFiles }: { canvasId: string; actor: Actor; onFiles: () => void }) {
  const adding = useUiStore((s) => s.adding);
  const setAdding = (next: AddKind | "any" | null) => useUiStore.getState().setAdding(next);
  const open = adding !== null;
  const [query, setQuery] = useState("");
  const [canvases, setCanvases] = useState<Canvas[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Memory phase 1: a canvas card can carry `memory=inherit`, and the popover
  // is where the design says the tick lives — "places it, and ticks inherit".
  const [inherit, setInherit] = useState(false);
  const canvas = useCanvasStore((s) => s.canvas);
  const nowMs = Date.now();

  // Read the list when the popover opens, not when the rail mounts: a person
  // who never places a canvas pays nothing for the option.
  useEffect(() => {
    if (!open) return;
    let live = true;
    setCanvases(null);
    listCanvases()
      .then((all) => {
        if (live) setCanvases(all);
      })
      .catch(() => {
        if (live) setCanvases([]);
      });
    return () => {
      live = false;
    };
  }, [open]);

  // Files is a picker, not a field: choosing the row opens it and closes this.
  useEffect(() => {
    if (adding !== "file") return;
    onFiles();
    setAdding(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adding]);

  /**
   * What the field holds, read by the one classifier both surfaces use —
   * or, when a row pinned the kind, read AS that kind: "Site" makes any
   * words an address, "Canvas" makes them a search.
   */
  const guess = useMemo(() => classifyAddable(query, canvases ?? [], canvasId), [query, canvases, canvasId]);
  const pinned: Addable = useMemo(() => {
    const s = query.trim();
    if (adding === "site") return s ? { kind: "site", url: normalizeSiteUrl(s) } : { kind: "empty" };
    if (adding === "doc") {
      const id = googleDocId(s);
      return id ? guess : s ? { kind: "search", query: s } : { kind: "empty" };
    }
    if (adding === "canvas") return guess.kind === "canvas" ? guess : s ? { kind: "search", query: s } : { kind: "empty" };
    return guess;
  }, [adding, query, guess]);

  const needle = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!canvases) return [];
    return canvases
      .filter((one) => one.id !== canvasId)
      .filter((one) => needle === "" || one.title.toLowerCase().includes(needle) || one.id === needle)
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      .slice(0, 8);
  }, [canvases, canvasId, needle]);
  const showList = adding === "canvas" || pinned.kind === "search" || (pinned.kind === "empty" && adding !== "site" && adding !== "doc");

  function spotFor(width: number, height: number) {
    return spotInView(useUiStore.getState().viewport, Object.values(canvas?.items ?? {}), width, height, placeableArea());
  }
  function done(itemId: string) {
    setAdding(null);
    setQuery("");
    setError(null);
    useUiStore.getState().select(itemId);
  }

  async function placeCanvas(target: { id: string; title: string; origin?: string | null }) {
    // A spot found FOR the card is not `chosen`; the daemon may tidy it clear.
    let at: Placement = spotFor(CANVAS_ITEM_SIZE.width, CANVAS_ITEM_SIZE.height);
    // `inherit` is memory phase 1: the card wears memory=inherit and the
    // linked canvas's context joins this one's, read-only. Phase 3: a link
    // goes onto the Context sheet — laid now if this is the first — so
    // every canvas has a corner where its inheritance sits.
    if (inherit && canvas) {
      let sheet = contextSheet(canvas);
      if (!sheet) {
        const spot = contextSheetSpot(canvas);
        const id = await addAreaItem(canvasId, actor, CONTEXT_SHEET_TITLE, spot, CONTEXT_SHEET_SIZE);
        sheet = { id, title: CONTEXT_SHEET_TITLE, ...spot, ...CONTEXT_SHEET_SIZE, properties: { kind: "area" } } as unknown as Item;
      }
      at = { ...freeSpotIn(canvas, sheet, CANVAS_ITEM_SIZE.width, CANVAS_ITEM_SIZE.height), chosen: true };
    }
    done(
      await addCanvasItem(canvasId, actor, target.origin ?? window.location.origin, target.id, target.title, at, inherit ? "inherit" : null),
    );
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const what = pinned;
      if (what.kind === "doc") {
        const at = spotFor(640, 800);
        const doc = await exportDoc(what.url);
        done(
          await addDocumentItem(
            canvasId,
            actor,
            { title: doc.title, markdown: doc.markdown, filename: docFilenameFrom(doc.title), source: doc.source, syncedAt: doc.fetchedAt },
            at,
          ),
        );
      } else if (what.kind === "site") {
        const at = spotFor(BROWSER_SIZE.width, BROWSER_SIZE.height);
        // Advice before the item, never a gate: a site that refuses framing
        // would be a blank rectangle nobody could explain.
        const verdict = await checkFrameable(what.url);
        if (!verdict.ok) {
          setError(`${siteLabel(verdict.url ?? what.url)} ${verdict.why ?? "refuses to be shown in a frame"}. Nothing was added.`);
          return;
        }
        done(await addBrowserItem(canvasId, actor, what.url, at));
      } else if (what.kind === "canvas") {
        await placeCanvas({ id: what.canvasId, title: what.title ?? what.canvasId, origin: what.origin });
      } else if (what.kind === "search" && matches[0]) {
        await placeCanvas({ id: matches[0].id, title: matches[0].title });
      } else if (what.kind === "search" && adding === "doc") {
        setError("That is not a Google Doc address — it looks like https://docs.google.com/document/d/<id>/edit");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const preview = addableWords(pinned);
  const rows: { kind: AddKind; label: string }[] = [
    { kind: "file", label: "Files" },
    { kind: "site", label: "Site" },
    { kind: "doc", label: "Google Doc" },
    { kind: "canvas", label: "Canvas" },
  ];

  return (
    <div className="add-door">
      <button
        className={`tool-btn${open ? " active" : ""}`}
        title="Add to the canvas — files, a site, a Google Doc, or a canvas"
        aria-label="Add"
        aria-pressed={open}
        onClick={() => {
          setAdding(open ? null : "any");
          setError(null);
        }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path d="M9 3v12M3 9h12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
      {open && adding !== "file" && (
        <form className="site-popover canvas-picker add-popover" onSubmit={submit}>
          <input
            className="text-input"
            autoFocus
            placeholder={PLACEHOLDER[adding ?? "any"]}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setAdding(null);
            }}
          />
          {/* What Enter would do — the one line that makes a single field safe. */}
          <div className="add-preview" aria-live="polite">{preview ?? "Paste an address, drop files, or pick a kind below."}</div>
          <div className="add-kinds" role="radiogroup" aria-label="What to add">
            {rows.map((row) => (
              <button
                key={row.kind}
                type="button"
                role="radio"
                aria-checked={adding === row.kind}
                className={`add-kind${adding === row.kind ? " active" : ""}`}
                onClick={() => {
                  setAdding(row.kind);
                  setError(null);
                }}
              >
                <KindIcon kind={row.kind === "file" ? "document" : row.kind === "doc" ? "document" : row.kind} />
                <span>{row.label}</span>
              </button>
            ))}
          </div>
          {(pinned.kind === "canvas" || pinned.kind === "search" || adding === "canvas") && (
            <label className="add-inherit">
              <input type="checkbox" checked={inherit} onChange={(e) => setInherit(e.target.checked)} />
              <span>Inherit its memory here — its design system and pins join this canvas's context</span>
            </label>
          )}
          {showList && (
            <div className="canvas-picker-list" role="listbox" aria-label="Canvases">
              {canvases === null && <div className="canvas-picker-note">Looking…</div>}
              {canvases !== null && matches.length === 0 && (
                <div className="canvas-picker-note">{needle ? "No canvas by that name — paste its address instead." : "No other canvases here yet."}</div>
              )}
              {matches.map((one) => (
                <button key={one.id} type="button" className="canvas-picker-row" role="option" onClick={() => void placeCanvas({ id: one.id, title: one.title })}>
                  <span className="canvas-picker-title">{one.title}</span>
                  <span className="canvas-picker-meta">
                    {one.updatedBy.name} {opWords(one.lastOp) ?? "did something"} · {ago(one.updatedAt, nowMs) || "just now"}
                  </span>
                </button>
              ))}
            </div>
          )}
          <button className="btn primary" type="submit" disabled={busy || pinned.kind === "empty" || (pinned.kind === "search" && !matches[0])}>
            {pinned.kind === "doc" ? "Add document" : pinned.kind === "site" ? "Add site" : pinned.kind === "canvas" || pinned.kind === "search" ? "Place canvas" : "Add"}
          </button>
          {error && <div className="site-error">{error}</div>}
        </form>
      )}
    </div>
  );
}
