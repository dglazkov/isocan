/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import type { CanvasContents } from "./model.js";
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
    note?: {
        id: string;
        blobHash: string;
    };
}
/** The pages, in order: the marked slides, or — with none marked — every
 *  item in reading order, because a canvas of screens is already a deck. */
export declare function deckPages(canvas: CanvasContents, groupId?: string): DeckPage[];
/** What a page holds once its bytes were read: a screen's HTML, an image as
 *  a data URL, or nothing a deck can show (a video, a PDF) — said, not
 *  skipped. And the note's words, when there are any. */
export interface DeckPageContent extends DeckPage {
    html?: string;
    imageDataUrl?: string;
    notes?: string;
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
export declare function deckHtml(title: string, pages: readonly DeckPageContent[], options?: {
    withNotes?: boolean;
}): string;
/** The file's name, from the canvas title: `Season planning` → `season-planning.html`,
 *  by core's one filename rule (`titleSlug`, cleanup DU-2). */
export declare function deckFilename(title: string, ext: string): string;
