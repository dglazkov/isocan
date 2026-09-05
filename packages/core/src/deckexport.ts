import type { CanvasContents, Item } from "./model.ts";
import { deck, noteFor } from "./slides.ts";

/**
 * **Taking a deck somewhere else** (`docs/research/2026-09-04-deck-export.md`).
 *
 * A deck is items marked as slides, in reading order, played full screen.
 * Off the canvas it has to become a document, and the shape of every export
 * follows one constraint: a slide is an HTML file that draws itself, so the
 * only faithful picture of it is the one a browser makes. What this module
 * holds is the part both surfaces share — which items are the pages, and the
 * one self-contained HTML file that plays them anywhere — so the app's
 * download and `isocan slides export deck.html` write byte-identical files.
 * PDF and PNG are the browser's job (the app prints the deck view; the CLI
 * drives headless Chrome over the same view); PPTX is pictures of pages.
 *
 * **Speaker notes ride along** (`slides.ts`, "speaker notes"): a page names
 * its note's blob, and the file inlines the words so `N` shows them under
 * the slide and a print with notes puts them on the sheet.
 */

export interface DeckPage {
  id: string;
  title: string;
  mimeType: string;
  blobHash: string;
  /** The speaker note's item and blob, when the slide has one. */
  note?: { id: string; blobHash: string };
}

/** The pages, in order: the marked slides, or — with none marked — every
 *  item in reading order, because a canvas of screens is already a deck. */
export function deckPages(canvas: CanvasContents): DeckPage[] {
  return deck(canvas).flatMap((item) => {
    const current = currentVersion(item);
    if (!current) return [];
    const note = noteFor(canvas, item.id);
    const noteVersion = note ? currentVersion(note) : null;
    return [
      {
        id: item.id,
        title: item.title,
        mimeType: current.mimeType,
        blobHash: current.blobHash,
        ...(note && noteVersion ? { note: { id: note.id, blobHash: noteVersion.blobHash } } : {}),
      },
    ];
  });
}

function currentVersion(item: Item) {
  return item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions[0] ?? null;
}

/** What a page holds once its bytes were read: a screen's HTML, an image as
 *  a data URL, or nothing a deck can show (a video, a PDF) — said, not
 *  skipped. And the note's words, when there are any. */
export interface DeckPageContent extends DeckPage {
  html?: string;
  imageDataUrl?: string;
  notes?: string;
}

/** Attribute-safe: `srcdoc` holds a whole document in a quoted attribute. */
function attr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function text(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

/**
 * One file that plays the deck: every slide inlined, arrows and Page keys and
 * a click to flip, a counter, and a print stylesheet that puts one slide on
 * each 16:9 sheet — so the same file is the slideshow and the PDF's source.
 * Screens are `srcdoc` frames with scripts allowed, as they are on the
 * canvas; a screen that reaches for the canvas's own blobs by path will find
 * nothing off the canvas, which the file says in its footer rather than
 * pretending.
 *
 * `N` shows the speaker notes under the slide, for the presenter; a print
 * made with notes showing puts them on the sheet. `withNotes` is where the
 * file starts.
 */
export function deckHtml(title: string, pages: readonly DeckPageContent[], options: { withNotes?: boolean } = {}): string {
  const slides = pages
    .map((page, i) => {
      const body =
        page.html !== undefined
          ? `<iframe sandbox="allow-scripts" srcdoc="${attr(page.html)}" title="${attr(page.title)}"></iframe>`
          : page.imageDataUrl !== undefined
            ? `<img src="${page.imageDataUrl}" alt="${attr(page.title)}">`
            : `<div class="empty">${text(page.title)}<small>${text(page.mimeType)} — not something a deck can show</small></div>`;
      const notes = page.notes !== undefined && page.notes.trim() !== "" ? `<aside class="notes">${text(page.notes)}</aside>` : "";
      return `<section class="slide" data-n="${i + 1}" aria-label="${attr(page.title)}"><div class="picture">${body}</div>${notes}</section>`;
    })
    .join("\n");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${text(title)}</title>
<style>
  html, body { margin: 0; height: 100%; background: #000; color: #fff; font: 14px system-ui, sans-serif; }
  .slide { position: absolute; inset: 0; display: none; flex-direction: column; }
  .slide.current { display: flex; }
  .picture { flex: 1; min-height: 0; }
  .slide iframe, .slide img { width: 100%; height: 100%; border: 0; object-fit: contain; background: #fff; }
  .notes { display: none; flex: none; max-height: 38%; overflow: auto; padding: 14px 20px; white-space: pre-wrap;
           background: #111; color: #ddd; border-top: 1px solid #333; font-size: 16px; line-height: 1.5; }
  body.notes .notes { display: block; }
  .empty { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: #aaa; }
  .counter { position: fixed; right: 14px; bottom: 10px; opacity: 0.6; font-variant-numeric: tabular-nums; }
  @media print {
    @page { size: 13.333in 7.5in; margin: 0; }
    body { background: #fff; }
    .slide { position: static; display: flex; width: 100vw; height: 100vh; break-after: page; }
    body.notes .notes { display: block; max-height: 38%; background: #fff; color: #000; border-top: 1px solid #ccc; }
    .counter { display: none; }
  }
</style>
</head>
<body${options.withNotes ? ' class="notes"' : ""}>
${slides}
<div class="counter"><span id="n">1</span> / ${pages.length}</div>
<script>
  (function () {
    var slides = Array.prototype.slice.call(document.querySelectorAll(".slide"));
    var at = Math.max(0, Math.min(slides.length - 1, (parseInt(location.hash.slice(1), 10) || 1) - 1));
    function show(i) {
      at = Math.max(0, Math.min(slides.length - 1, i));
      slides.forEach(function (s, k) { s.classList.toggle("current", k === at); });
      document.getElementById("n").textContent = String(at + 1);
      history.replaceState(null, "", "#" + (at + 1));
    }
    var next = ["ArrowRight", "ArrowDown", "PageDown", " "], prev = ["ArrowLeft", "ArrowUp", "PageUp"];
    window.addEventListener("keydown", function (e) {
      if (next.indexOf(e.key) >= 0) { e.preventDefault(); show(at + 1); }
      else if (prev.indexOf(e.key) >= 0) { e.preventDefault(); show(at - 1); }
      else if (e.key === "Home") show(0);
      else if (e.key === "End") show(slides.length - 1);
      else if (e.key === "n" || e.key === "N") document.body.classList.toggle("notes");
    });
    window.addEventListener("click", function (e) { if (e.target === document.body) show(at + 1); });
    show(at);
  })();
</script>
</body>
</html>
`;
}

/** The file's name, from the canvas title: `Season planning` → `season-planning.html`. */
export function deckFilename(title: string, ext: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "deck";
  return `${slug}.${ext}`;
}
