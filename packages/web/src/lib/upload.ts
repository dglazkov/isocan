import type { Actor, Placement } from "@isocan/core";
import {
  BROWSER_MIME,
  newItemId,
  newVersionId,
  normalizeSiteUrl,
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
 * Upload files and add them as items. The first lands at `placement`;
 * subsequent files cascade down-right from it.
 */
export async function addFiles(
  projectId: string,
  actor: Actor,
  files: File[],
  placement: Placement,
): Promise<string[]> {
  const ids: string[] = [];
  let offset = 0;
  for (const file of files) {
    const mimeType = mimeTypeOf(file);
    const upload = await uploadBlob(projectId, file, file.name);
    const { width, height } = await measure(file, mimeType);
    const placed: Placement =
      "anchorItemId" in placement || offset === 0
        ? placement
        : { x: placement.x + offset, y: placement.y + offset };
    const itemId = newItemId();
    await sendOp(projectId, actor, {
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
      placement: placed,
    });
    ids.push(itemId);
    offset += 28;
  }
  return ids;
}

/** Default footprint for a projected site — roomy enough to be an app. */
export const BROWSER_SIZE = { width: 800, height: 600 };

/**
 * Project a live site onto the canvas (#40): an ordinary item whose blob is
 * a text/uri-list naming the URL. Throws on a URL that isn't http(s).
 */
export async function addBrowserItem(
  projectId: string,
  actor: Actor,
  rawUrl: string,
  placement: Placement,
): Promise<string> {
  const site = normalizeSiteUrl(rawUrl);
  const filename = siteFilename(site);
  const blob = new Blob([`${site}\n`], { type: BROWSER_MIME });
  const upload = await uploadBlob(projectId, blob, filename);
  const itemId = newItemId();
  await sendOp(projectId, actor, {
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

/** Upload a file as a NEW VERSION of an existing item. */
export async function addVersionFromFile(
  projectId: string,
  actor: Actor,
  itemId: string,
  file: File,
): Promise<void> {
  const mimeType = mimeTypeOf(file);
  const upload = await uploadBlob(projectId, file, file.name);
  await sendOp(projectId, actor, {
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
