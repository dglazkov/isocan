import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { canvasPath, deckFilename, deckHtml, deckPages, type DeckPageContent } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { blobUrl, readBlobText } from "../lib/api.ts";
import { contentBase } from "../lib/contentBase.ts";
import { itemFrame } from "../lib/frame.ts";
import { Markdown } from "../lib/markdown.tsx";

/**
 * **The deck, laid out for paper** (`docs/research/2026-09-04-deck-export.md`).
 *
 * Every slide stacked down one page, each in a 16:9 frame, and a print
 * stylesheet that puts one on each sheet. That is the whole PDF export: the
 * browser's own Save as PDF does the rest, and `isocan slides export
 * deck.pdf` drives headless Chrome to this same address so the terminal's
 * PDF and the app's PDF are the same pages. A route rather than a mode for
 * the reason full screen is one — an address either surface can hand you —
 * and it mounts inside `CanvasPage` so the replica it reads is the one
 * already open, not a second fetch.
 *
 * **The slides are live here too.** Each frame is the item's real HTML with
 * its scripts running (the `itemFrame` pair, as on the canvas), so a slide
 * that draws itself with code prints as it draws, not as a screenshot of
 * whatever it looked like once.
 *
 * **With notes** (`?notes=1`, or the toggle): each slide's speaker note is
 * printed under it on the same sheet — the handout a presenter rehearses
 * from. `isocan slides export deck.pdf --notes` opens this view with the
 * flag set.
 *
 * **Download deck.html** builds the self-contained file in core from the
 * slides' bytes, so the app and the CLI write the same file.
 */
export function DeckPrint({ canvasId }: { canvasId: string }) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const withNotes = params.get("notes") === "1";
  const canvas = useCanvasStore((s) => s.canvas);
  const pages = useMemo(() => (canvas ? deckPages(canvas) : []), [canvas]);
  const project = useCanvasStore((s) => s.project);
  const title = project?.title ?? "Deck";
  const [saving, setSaving] = useState(false);
  const hasNotes = pages.some((p) => p.note);

  // Esc is Back here as it is in full screen: the deck view is a look, not a room.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        navigate(canvasPath(canvasId));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, canvasId]);

  useEffect(() => {
    const was = document.title;
    document.title = `${title} — deck`;
    return () => {
      document.title = was;
    };
  }, [title]);

  const setNotes = useCallback(
    (on: boolean) => {
      const next = new URLSearchParams(params);
      if (on) next.set("notes", "1");
      else next.delete("notes");
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  const downloadHtml = useCallback(async () => {
    setSaving(true);
    try {
      const contents: DeckPageContent[] = await Promise.all(
        pages.map(async (page) => {
          const notes = page.note ? { notes: await readBlobText(canvasId, page.note.blobHash) } : {};
          if (page.mimeType === "text/html") return { ...page, ...notes, html: await readBlobText(canvasId, page.blobHash) };
          if (page.mimeType.startsWith("image/")) return { ...page, ...notes, imageDataUrl: await dataUrl(blobUrl(canvasId, page.blobHash)) };
          return { ...page, ...notes };
        }),
      );
      const file = new Blob([deckHtml(title, contents, { withNotes })], { type: "text/html" });
      const href = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = href;
      a.download = deckFilename(title, "html");
      a.click();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
    } finally {
      setSaving(false);
    }
  }, [pages, canvasId, title, withNotes]);

  return (
    <div className={`deck-print${withNotes ? " with-notes" : ""}`} data-pages={pages.length}>
      <div className="deck-bar">
        <button type="button" className="deck-back" onClick={() => navigate(canvasPath(canvasId))} title="Back to the canvas (Esc)">
          ← Canvas
        </button>
        <span className="deck-count">
          {pages.length} {pages.length === 1 ? "slide" : "slides"}
        </span>
        <span className="deck-spacer" />
        <label className="deck-notes-toggle" title={hasNotes ? "Print each slide's speaker notes under it" : "No slide has speaker notes yet"}>
          <input type="checkbox" checked={withNotes} disabled={!hasNotes} onChange={(e) => setNotes(e.target.checked)} />
          With notes
        </label>
        <button type="button" onClick={() => window.print()} disabled={pages.length === 0} title="One slide per 16:9 page">
          Save as PDF
        </button>
        <button type="button" onClick={downloadHtml} disabled={saving || pages.length === 0} title="One file that plays the deck anywhere">
          {saving ? "Building…" : "Download deck.html"}
        </button>
      </div>
      {pages.length === 0 ? (
        <p className="deck-empty">Nothing on this canvas yet. Mark items as slides with 🎬, or add screens — a canvas of screens is already a deck.</p>
      ) : (
        <ol className="deck-pages">
          {pages.map((page, i) => (
            <li key={page.id} className="deck-sheet" data-item={page.id}>
              <div className="deck-page">
                <DeckSlide canvasId={canvasId} mimeType={page.mimeType} blobHash={page.blobHash} title={page.title} />
                <span className="deck-page-n">{i + 1}</span>
              </div>
              {withNotes && <DeckNotes canvasId={canvasId} blobHash={page.note?.blobHash ?? null} />}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function DeckSlide({ canvasId, mimeType, blobHash, title }: { canvasId: string; mimeType: string; blobHash: string; title: string }) {
  if (mimeType === "text/html") {
    // The same src/sandbox pair the canvas uses: `itemFrame` is the one place
    // allowed to decide them together (content-origin plan, invariant 2).
    const frame = itemFrame(contentBase(), canvasId, blobHash);
    return <iframe src={frame.src} sandbox={frame.sandbox} title={title} loading="eager" />;
  }
  if (mimeType.startsWith("image/")) return <img src={blobUrl(canvasId, blobHash)} alt={title} />;
  return (
    <div className="deck-page-other">
      <strong>{title}</strong>
      <small>{mimeType} — not something a deck can show</small>
    </div>
  );
}

/** The speaker notes under a slide, read from the note item's blob. */
function DeckNotes({ canvasId, blobHash }: { canvasId: string; blobHash: string | null }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    if (!blobHash) {
      setText(null);
      return;
    }
    let live = true;
    readBlobText(canvasId, blobHash).then((t) => live && setText(t)).catch(() => live && setText(null));
    return () => {
      live = false;
    };
  }, [canvasId, blobHash]);
  return (
    <div className="deck-notes">
      {blobHash === null ? <em>No notes.</em> : text === null ? <em>Loading…</em> : <Markdown>{text}</Markdown>}
    </div>
  );
}

async function dataUrl(src: string): Promise<string> {
  const res = await fetch(src);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
