import type { Actor, InkStroke, Placement } from "@isocan/core";
import {
  BROWSER_MIME,
  DRAWING_FILENAME,
  DRAWING_MIME,
  DRAWING_PROPERTIES,
  DRAWING_TITLE,
  annotationProperties,
  drawingSvg,
  inkBounds,
  newItemId,
  newVersionId,
  normalizeSiteUrl,
  regionOf,
  siteFilename,
  siteLabel,
} from "@isocan/core";
import { sendOp, uploadBlob } from "./api.ts";
import { mimeTypeOf } from "./mime.ts";

const MAX_INITIAL_WIDTH = 480;

/** Measure an image/video's natural size, capped; fall back to defaults. */
async function measure(file: File, mimeType: string): Promise<{ width: number; height: number }> {
  if (mimeType.startsWith("image/")) {
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, MAX_INITIAL_WIDTH / bitmap.width);
      const size = {
        width: Math.round(bitmap.width * scale),
        height: Math.round(bitmap.height * scale),
      };
      bitmap.close();
      return size;
    } catch {
      return { width: 480, height: 360 };
    }
  }
  if (mimeType.startsWith("video/")) return { width: 480, height: 270 };
  return { width: 420, height: 320 };
}

/**
 * Upload files and add them as items, all asking for the same spot.
 *
 * They used to cascade by 28px each, which is not a layout — six files made a
 * fanned pile you had to drag apart, and an ANCHORED placement did not even
 * cascade, so every file resolved to the identical coordinates. Neither is
 * this function's problem to solve: the reducer places a new item clear of
 * whatever is already there, and applies these in turn, so each file's
 * placement already sees the one before it land.
 */
export async function addFiles(
  canvasId: string,
  actor: Actor,
  files: File[],
  placement: Placement,
): Promise<string[]> {
  const ids: string[] = [];
  for (const file of files) {
    const mimeType = mimeTypeOf(file);
    const upload = await uploadBlob(canvasId, file, file.name);
    const { width, height } = await measure(file, mimeType);

    const itemId = newItemId();
    await sendOp(canvasId, actor, {
      type: "item.add",
      itemId,
      version: {
        id: newVersionId(),
        blobHash: upload.blobHash,
        mimeType,
        filename: file.name,
        size: upload.size,
      },
      width,
      height,
      placement,
    });
    ids.push(itemId);
  }
  return ids;
}

/** Default footprint for a projected site — roomy enough to be an app. */
export const BROWSER_SIZE = { width: 800, height: 600 };

/**
 * Put a live site onto the canvas (#40): an ordinary item whose blob is
 * a text/uri-list naming the URL. Throws on a URL that isn't http(s).
 */
export async function addBrowserItem(
  canvasId: string,
  actor: Actor,
  rawUrl: string,
  placement: Placement,
): Promise<string> {
  const site = normalizeSiteUrl(rawUrl);
  const filename = siteFilename(site);
  const blob = new Blob([`${site}\n`], { type: BROWSER_MIME });
  const upload = await uploadBlob(canvasId, blob, filename);
  const itemId = newItemId();
  await sendOp(canvasId, actor, {
    type: "item.add",
    itemId,
    version: {
      id: newVersionId(),
      blobHash: upload.blobHash,
      mimeType: BROWSER_MIME,
      filename,
      size: upload.size,
    },
    ...BROWSER_SIZE,
    placement,
    title: siteLabel(site),
  });
  return itemId;
}

/**
 * Dry wet ink into an item: strokes → an SVG blob → `item.add`. The item's
 * box IS the ink's world bounding box, so the drawing lands exactly where it
 * was drawn and every other client (and `isocan ls`) sees it there.
 * Throws on strokes with no points.
 */
export async function addDrawing(
  canvasId: string,
  actor: Actor,
  strokes: InkStroke[],
  /** The item this ink is about, when it was drawn over one. */
  target?: { id: string; x: number; y: number; width: number; height: number } | null,
): Promise<string> {
  const exact = inkBounds(strokes);
  if (!exact) throw new Error("nothing to place");
  // Whole world units: the item box and the SVG viewBox must be the same box,
  // and an item's coordinates are integers everywhere else in the app.
  const bounds = {
    minX: Math.floor(exact.minX),
    minY: Math.floor(exact.minY),
    maxX: Math.ceil(exact.maxX),
    maxY: Math.ceil(exact.maxY),
  };
  const svg = drawingSvg(strokes, bounds);
  const blob = new Blob([svg], { type: DRAWING_MIME });
  const upload = await uploadBlob(canvasId, blob, DRAWING_FILENAME);
  const itemId = newItemId();
  await sendOp(canvasId, actor, {
    type: "item.add",
    itemId,
    version: {
      id: newVersionId(),
      blobHash: upload.blobHash,
      mimeType: DRAWING_MIME,
      filename: DRAWING_FILENAME,
      size: upload.size,
    },
    width: bounds.maxX - bounds.minX,
    height: bounds.maxY - bounds.minY,
    placement: { x: bounds.minX, y: bounds.minY },
    title: DRAWING_TITLE,
    properties: target
      ? {
          ...DRAWING_PROPERTIES,
          ...annotationProperties(
            target.id,
            regionOf(
              { x: bounds.minX, y: bounds.minY, width: bounds.maxX - bounds.minX, height: bounds.maxY - bounds.minY },
              target,
            ),
          ),
        }
      : DRAWING_PROPERTIES,
  });
  return itemId;
}

/** Upload a file as a NEW VERSION of an existing item. */
export async function addVersionFromFile(
  canvasId: string,
  actor: Actor,
  itemId: string,
  file: File,
): Promise<void> {
  const mimeType = mimeTypeOf(file);
  const upload = await uploadBlob(canvasId, file, file.name);
  await sendOp(canvasId, actor, {
    type: "item.addVersion",
    itemId,
    version: {
      id: newVersionId(),
      blobHash: upload.blobHash,
      mimeType,
      filename: file.name,
      size: upload.size,
    },
  });
}
