/**
 * Item names and the files under them.
 *
 * An item has a title (what people call it) and its version has a filename
 * (what it is called when it leaves the canvas — `isocan get`, a download, the
 * blob on disk). Renaming an item should move both, or the name you gave it on
 * the canvas is not the name you get in your Downloads folder.
 *
 * Blobs are content-addressed, so two files sharing a name collide nowhere on
 * disk — but they collide in every place a person reads them, which is reason
 * enough to keep them apart.
 */

import type { CanvasState } from "./model.ts";

/** The extension, dot included, or "" — the part a rename must not touch. */
export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot > 0 ? filename.slice(dot) : "";
}

/**
 * A title as a filename: "Bass tab v2" → "bass-tab-v2.svg". Keeps the old
 * extension, because renaming a drawing does not make it a different kind of
 * file. A title with nothing usable in it (an emoji, say) keeps the old stem
 * rather than becoming a bare extension.
 */
export function filenameFromTitle(title: string, previous: string): string {
  const extension = extensionOf(previous);
  const stem = title
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  if (stem === "") return previous;
  return `${stem}${extension}`;
}

/**
 * `candidate`, or the next free "<stem>-2.<ext>" if it is taken. Case is not
 * the difference between two names: macOS would agree, and so would a person.
 */
export function uniqueFilename(candidate: string, taken: Iterable<string>): string {
  const used = new Set([...taken].map((name) => name.toLowerCase()));
  if (!used.has(candidate.toLowerCase())) return candidate;
  const extension = extensionOf(candidate);
  const stem = candidate.slice(0, candidate.length - extension.length);
  for (let n = 2; n < 1000; n++) {
    const next = `${stem}-${n}${extension}`;
    if (!used.has(next.toLowerCase())) return next;
  }
  return candidate;
}

/** Every filename in use on this canvas, ignoring one item — the one being
 * renamed does not collide with itself. */
export function filenamesInUse(canvas: CanvasState, exceptItemId?: string): string[] {
  const names: string[] = [];
  for (const item of Object.values(canvas.items)) {
    if (item.id === exceptItemId) continue;
    for (const version of item.versions) names.push(version.filename);
  }
  return names;
}

/** The filename a rename should land on: derived from the title, then moved
 * aside if the canvas is already using it. */
export function renamedFilename(
  canvas: CanvasState,
  itemId: string,
  title: string,
  previous: string,
): string {
  return uniqueFilename(filenameFromTitle(title, previous), filenamesInUse(canvas, itemId));
}
