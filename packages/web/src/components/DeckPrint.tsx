import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { canvasPath, deckFilename, deckHtml, deckPages, type DeckPageContent } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { blobUrl, readBlobText } from "../lib/api.ts";
import { contentBase } from "../lib/contentBase.ts";
import { itemFrame } from "../lib/frame.ts";

/**
 * **The deck, laid out for paper** (`docs/research/2026-09-04-deck-export.md`).
 *
 * Every slide stacked down one page, each in a 16:9 frame, and a print
 * stylesheet that puts one on each landscape sheet. That is the whole PDF
 * export: the browser's own Save as PDF does the rest, and `isocan slides
 * export deck.pdf` drives headless Chrome to this same address so the
 * terminal's PDF and the app's PDF are the same pages. A route rather than a
 * mode for the reason full screen is one — an address either surface can
 * hand you — and it mounts inside `CanvasPage` so the replica it reads is the
 * one already open, not a second fetch.
 *
 * **The slides are live here too.** Each frame is the item's real HTML with
 * its scripts running (the `itemFrame` pair, as on the canvas), so a slide
 * that draws itself with code prints as it draws, not as a screenshot of
 * whatever it looked like once.
 *
 * **Download deck.html** builds the self-contained file in core from the
 * slides' bytes, so the app and the CLI write the same file.
 */
export function DeckPrint({ canvasId }: { canvasId: string }) {
  const navigate = useNavigate();
  const canvas = useCanvasStore((s) => s.canvas);
  const pages = useMemo(() => (canvas ? deckPages(canvas) : []), [canvas]);
  const project = useCanvasStore((s) => s.project);
  const title = project?.title ?? "Deck";
  const [saving, setSaving] = useState(false);

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

  const downloadHtml = useCallback(async () => {
    setSaving(true);
    try {
      const contents: DeckPageContent[] = await Promise.all(
        pages.map(async (page) => {
          if (page.mimeType === "text/html") return { ...page, html: await readBlobText(canvasId, page.blobHash) };
          if (page.mimeType.startsWith("image/")) return { ...page, imageDataUrl: await dataUrl(blobUrl(canvasId, page.blobHash)) };
          return page;
        }),
      );
      const file = new Blob([deckHtml(title, contents)], { type: "text/html" });
      const href = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = href;
      a.download = deckFilename(title, "html");
      a.click();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
    } finally {
      setSaving(false);
    }
  }, [pages, canvasId, title]);

  return (
    <div className="deck-print" data-pages={pages.length}>
      <div className="deck-bar">
        <button type="button" className="deck-back" onClick={() => navigate(canvasPath(canvasId))} title="Back to the canvas (Esc)">
          ← Canvas
        </button>
        <span className="deck-count">
          {pages.length} {pages.length === 1 ? "slide" : "slides"}
        </span>
        <span className="deck-spacer" />
        <button type="button" onClick={() => window.print()} disabled={pages.length === 0} title="One slide per landscape page">
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
            <li key={page.id} className="deck-page" data-item={page.id}>
              <DeckSlide canvasId={canvasId} mimeType={page.mimeType} blobHash={page.blobHash} title={page.title} />
              <span className="deck-page-n">{i + 1}</span>
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
