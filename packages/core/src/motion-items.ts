/**
 * **The writes a motion makes, once, for both surfaces** (motion phase 2).
 *
 * `isocan motion new|edit|refresh|render` and the web's *Animate…*,
 * *Refresh from sources* and *Render movie…* all end the same way: bytes
 * uploaded as a blob, then ONE op — an `item.add` beside the selection, or an
 * `item.edit` that stacks a version — in one group, so it is one undo. What
 * differs is only how each surface uploads and sends, so that is what a
 * caller hands in (`MotionWriter`): the CLI its client and `sendOp`, the web
 * its `WebHost.putBlob` and `send`. Placement, size, title, filename and
 * properties are decided here, so a motion made in the browser and one made
 * in the terminal cannot land differently.
 */
import { newGroupId, newItemId, newVersionId } from "./ids.ts";
import type { Item } from "./model.ts";
import type { Operation } from "./ops.ts";
import { MOTION_CONTROLS_HEIGHT, MOTION_MIME, motionProperties, motionSlug, type MotionBuild } from "./motion.ts";
import { MOTION_FORMAT_FACTS, RENDERED_FROM, type MotionRenderedFrom } from "./motion-render.ts";

/** How a surface uploads bytes and sends one op in one group — the two things that differ between them. */
export interface MotionWriter {
  upload: (bytes: Uint8Array, mimeType: string, filename: string) => Promise<{ blobHash: string; size: number }>;
  send: (op: Operation, group: string) => Promise<void>;
}

/** The gap between what a motion is made from and what is placed beside it, in world units. */
export const MOTION_BESIDE = 40;

const slug = (title: string) => motionSlug(title) || "motion";

const utf8 = (text: string) => new TextEncoder().encode(text);

/**
 * **A new motion item, beside the selection** — `isocan motion new`'s and
 * *Animate…*'s one write. Sized to the stage with the player's controls
 * below it, so the drawing is never under them. `description` is the words
 * it was made from, when there were words.
 */
export async function addMotionItem(w: MotionWriter, built: MotionBuild, title: string, description?: string): Promise<{ itemId: string; filename: string }> {
  const filename = `${slug(title)}.html`;
  const uploaded = await w.upload(utf8(built.html), MOTION_MIME, filename);
  const itemId = newItemId();
  await w.send({
    type: "item.add",
    itemId,
    version: { id: newVersionId(), blobHash: uploaded.blobHash, mimeType: MOTION_MIME, filename, size: uploaded.size },
    width: Math.max(80, Math.round(built.stage.width)),
    height: Math.max(80, Math.round(built.stage.height)) + MOTION_CONTROLS_HEIGHT,
    placement: { x: built.stage.x + built.stage.width + MOTION_BESIDE, y: built.stage.y },
    title,
    ...(description ? { description } : {}),
    properties: motionProperties(built),
  }, newGroupId());
  return { itemId, filename };
}

/**
 * **A new version of a motion** — `motion edit`, `motion refresh` and
 * *Refresh from sources*: the new document and the properties that describe
 * it in one `item.edit`, conditional on the version the caller read, so an
 * edit made from a stale read is refused rather than stacked on top.
 */
export async function versionMotionItem(w: MotionWriter, motion: Pick<Item, "id" | "title" | "currentVersionId" | "versions">, built: MotionBuild, description?: string): Promise<{ versionId: string }> {
  const filename = motion.versions.find((v) => v.id === motion.currentVersionId)?.filename ?? `${slug(motion.title)}.html`;
  const uploaded = await w.upload(utf8(built.html), MOTION_MIME, filename);
  const versionId = newVersionId();
  await w.send({
    type: "item.edit",
    itemId: motion.id,
    version: { id: versionId, blobHash: uploaded.blobHash, mimeType: MOTION_MIME, filename, size: uploaded.size },
    patch: { properties: motionProperties(built), ...(description !== undefined ? { description } : {}) },
    expectedVersionId: motion.currentVersionId,
  }, newGroupId());
  return { versionId };
}

/**
 * **A movie of a motion, beside it** — `isocan motion render`'s and *Render
 * movie…*'s one write: a `video/mp4`, `video/webm` or `image/gif` item, as
 * `renderedFrom.format` says (an MP4 when it says nothing), as wide as the
 * motion, as tall as the frame's shape says, wearing `renderedFrom`.
 */
export async function addMotionMovie(
  w: MotionWriter,
  motion: Pick<Item, "title" | "x" | "y" | "width">,
  bytes: Uint8Array,
  renderedFrom: MotionRenderedFrom,
): Promise<{ itemId: string; title: string; filename: string }> {
  const format = renderedFrom.format ?? "mp4";
  const { mimeType, extension } = MOTION_FORMAT_FACTS[format];
  const filename = `${slug(motion.title)}.${extension}`;
  const uploaded = await w.upload(bytes, mimeType, filename);
  const [fw, fh] = renderedFrom.size.split("x").map(Number) as [number, number];
  const width = Math.max(160, Math.round(motion.width));
  const itemId = newItemId();
  // A GIF is a picture that moves, not a movie, to most people who will see one.
  const title = `${motion.title} — ${format === "gif" ? "GIF" : "movie"}`;
  await w.send({
    type: "item.add",
    itemId,
    version: { id: newVersionId(), blobHash: uploaded.blobHash, mimeType, filename, size: uploaded.size },
    width,
    height: Math.round((width * fh) / fw),
    placement: { x: motion.x + motion.width + MOTION_BESIDE, y: motion.y },
    title,
    properties: { [RENDERED_FROM]: JSON.stringify(renderedFrom) },
  }, newGroupId());
  return { itemId, title, filename };
}
