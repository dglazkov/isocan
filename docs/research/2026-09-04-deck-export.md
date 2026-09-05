---
status: partial
since: 2026-09-04
see: inception, workbench
note: HTML deck, PDF (app print + CLI Chrome) and PNG-per-slide built 4 Sep; PPTX open after the PDF is used for a talk; Google Slides blocked on the per-user OAuth client
---

# Taking a deck somewhere else

**Question.** A canvas is presented from full screen, and the ask was "how
can we add more export options — PDF, Google Slides, PPTX — and flush out
export formats in general?" Until today `isocan export` wrote JSON Canvas
and nothing else, and the only way to hand a deck to someone who was not in
the room was the address.

**The constraint every format inherits.** A slide is an HTML file that
draws itself, often with code. There is no faithful conversion of that into
shapes and text boxes; the only faithful picture of it is the one a browser
makes. So every export is one of two things: **the HTML itself, carried
whole**, or **a picture the browser took**. Formats that hold pictures
(PDF, PPTX, a PNG strip) can be exact; formats that hold editable objects
(Google Slides, Keynote) get a picture per slide and are honest about it.

## The formats, and where each stands

| Format | What it holds | How it is made | Status |
| --- | --- | --- | --- |
| **HTML deck** | The slides' own HTML, inlined as `srcdoc` frames; arrows flip; its own print CSS | `deckHtml()` in core, run by the app's Download and `isocan slides export deck.html` — byte-identical | Built |
| **PDF** | One slide per landscape page, as rendered | The app's deck view (`/deck` on the canvas) + the browser's Save as PDF; CLI drives headless Chrome to the same view (`scripts/deck-export.mjs`, `Page.printToPDF`) | Built |
| **PNG per slide** | A picture of each slide | Same script, `--png <dir>`, one clip per page | Built |
| **PPTX** | A picture per slide on a 16:9 page, title in notes | PNGs from the script + a lazily loaded `pptxgenjs`, CLI first; the app after (the library is heavy — load on demand, never on the canvas path) | Open — after the PDF has been used for a real talk |
| **Google Slides** | A picture per slide, uploaded, in a new presentation | Needs each user's own Google sign-in (`docs/research/2026-09-02-google-docs-on-the-canvas.md`, the per-user OAuth client the owner has to make) | Blocked on the OAuth client |
| **Markdown notes** | Titles and speaker notes (item descriptions), in order | Trivial once notes exist as a property; an agent's handout | Open |
| **JSON Canvas** | The whole canvas, geometry and edges | `isocan export <file>` (already there, unchanged) | Built |

## What was built today

**One view, two printers.** `DeckPrint` mounts inside `CanvasPage` on the
deck route (`DECK_ROUTE`, `deckPath`, `deckUrl` in core address.ts), stacks
every page of `deckPages(canvas)` — the marked slides in reading order, or
everything when nothing is marked, exactly as full screen walks — in 16:9
frames, live, through the same `itemFrame` src/sandbox pair the canvas
uses. A print stylesheet puts one page on each landscape sheet. In the app,
Save as PDF is `window.print()`. In the terminal, `isocan slides export
deck.pdf` opens the same address in the graders' headless Chrome, waits for
every frame's load and a settle for scripts, and prints. Same view, same
pages, and nothing to keep in step.

**One file, two writers.** `deckHtml(title, pages)` in core builds the
self-contained deck. The app reads each slide's bytes and downloads it;
the CLI reads the same bytes over the wire and writes it. A test pins that
quotes in a slide cannot end its `srcdoc` attribute, that images ride as
data URLs, and that a page the deck cannot show (a video) is said, not
skipped.

**Both surfaces, by the law.** `slides export` is in the guide beside
`slides add/rm/show`; `slides show` prints the deck view's address under
the first slide's; ⌘K has "Export the deck". The verb refuses an extension
it does not write, and says PDF needs the checkout and Chrome — the same
shape as `canvas shot` — rather than failing inside a spawn.

## What was decided against

- **Rendering slides to PDF server-side.** The hosted home is one Cloud
  Run instance with no Chrome; a PDF service would be a second deployable
  for a format the user's own browser already makes from the deck view.
- **A DOM-to-image library in the app** (html2canvas and kin) for PNG
  export. They redraw the page by hand and get fonts, filters and
  cross-origin frames wrong — and every slide here is a cross-origin frame.
  The browser's real print pipeline is the picture.
- **Converting HTML to PPTX shapes.** Not faithful for anything with a
  layout; a picture per page is honest and looks right.

## Next

1. Use the PDF for a real talk; fix what the print shows.
2. PPTX from the PNGs, CLI first (`slides export deck.pptx`), library
   loaded lazily.
3. Speaker notes as an item property, printed under the slide in the deck
   view's notes mode and exported as markdown.
4. Google Slides once the per-user Google sign-in exists.
