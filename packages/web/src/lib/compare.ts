import type { ItemVersion } from "@isocan/core";
import { sourceFaceOf, visualFaceOf } from "@isocan/core";
import { diffVersions, isTextualMime, markSource, type VersionDiff } from "@isocan/core/diff";
import { blobUrl, readBlobText } from "./api.ts";

/**
 * **The inspector's data: core's diff, and each side made ready to draw.**
 *
 * Loaded with the Compare inspector and never before. The diff is core's
 * `diffVersions` — the function `isocan diff` prints — so the sentence at the
 * top of the inspector is the terminal's sentence (`packages/web/test/compare.test.ts`
 * holds them equal). What this file adds is only how each side is shown:
 *
 * - **HTML and wireframes** become a `srcdoc` string with the diff written
 *   into it (`markSource`), for a frame under the same lone `allow-scripts`
 *   every item frame gets. The app cannot reach into that frame, so the
 *   highlights have to arrive inside the document; the item and its blob are
 *   never touched.
 * - **Text** is the diff's aligned rows, drawn by the component.
 * - **Images** are their visual face by URL; **anything else** is its facts.
 *
 * `read` is a parameter so a test can hand it text without a server.
 */
export type CompareFace =
  | { kind: "frame"; srcdoc: string }
  | { kind: "text" }
  | { kind: "image"; url: string }
  | { kind: "file"; filename: string };

/** One comparison, ready: the diff and a face per side. */
export interface Compared {
  diff: VersionDiff;
  before: CompareFace;
  after: CompareFace;
}

/** Read both versions and compare them. Reads only — nothing here can send an op. */
export async function compareVersions(
  canvasId: string,
  before: ItemVersion,
  after: ItemVersion,
  read: (canvasId: string, blobHash: string) => Promise<string> = readBlobText,
): Promise<Compared> {
  const side = async (v: ItemVersion) => {
    const face = sourceFaceOf(v);
    const text = isTextualMime(face.mimeType) ? await read(canvasId, face.blobHash) : undefined;
    return { mimeType: face.mimeType, filename: face.filename, size: face.size, blobHash: face.blobHash, ...(text !== undefined ? { text } : {}) };
  };
  const [a, b] = await Promise.all([side(before), side(after)]);
  const diff = diffVersions(a, b);
  const faceOf = (v: ItemVersion, s: typeof a, which: "before" | "after"): CompareFace => {
    if ((diff.kind === "html" || diff.kind === "wire") && s.text !== undefined) return { kind: "frame", srcdoc: markSource(s.text, diff, which) };
    if (diff.kind === "text") return { kind: "text" };
    const visual = visualFaceOf(v);
    if (visual.mimeType.startsWith("image/")) return { kind: "image", url: blobUrl(canvasId, visual.blobHash) };
    return { kind: "file", filename: s.filename };
  };
  return { diff, before: faceOf(before, a, "before"), after: faceOf(after, b, "after") };
}
