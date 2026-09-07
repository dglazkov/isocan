import type { CanvasState, Item } from "./model.ts";

/**
 * **Which blobs a canvas names outside its items.**
 *
 * The garbage collector marks a blob reachable if an item version carries its
 * hash, if the trash does, or if a retained log entry does. That was the whole
 * of it — and it is the whole of it correctly, today, because nothing else
 * names a blob.
 *
 * It stops being correct the moment something does. A custom background
 * (#204) is a tile stored as a canvas PROPERTY pointing at an uploaded blob,
 * and a home sweeps itself on an hour's timer: the ground would be
 * unreachable the moment it was set, and the canvas would lose its background
 * within the hour with nothing logged and nothing to see.
 *
 * So this exists before that does, and as a RULE rather than a special case.
 * `reachableHashes` asks it; a future feature that names a blob from a
 * property adds itself here, once, instead of discovering the sweeper the hard
 * way.
 *
 * **`blobsNamedBy` in `export.ts` is the same idea on the other surface**, and
 * it got there first: it finds every blob the LOG names, *"by shape rather
 * than by op type… so a new op that names bytes is backed up the day it ships
 * rather than the day somebody remembers this."* Two surfaces name blobs — the
 * log and the properties — and now both are matched by shape. Named apart
 * because they answer for different things and a caller wanting one would be
 * badly served by the other.
 *
 * ## Why it matches on shape rather than on a list of property names
 *
 * A list of blessed keys is a second thing to keep right, and the failure it
 * allows is silent — exactly the shape this file is written to prevent. A
 * sha256 in a property value is unambiguous: sixty-four hex characters, and
 * nothing else this codebase stores in a property looks like one. Ids are
 * prefixed (`itm_`, `prj_`), colours are short, dates carry punctuation.
 *
 * The cost of being wrong is asymmetric and worth stating. A false positive
 * retains bytes nobody needs, which a later sweep reclaims once the property
 * goes. A false negative deletes somebody's work. This errs toward keeping.
 */
const SHA256 = /^[0-9a-f]{64}$/;

/**
 * Every blob hash named by a canvas's properties, or by an item's.
 *
 * Takes the whole `CanvasState` rather than `CanvasContents`, and that is the
 * point: a canvas's own properties live on the RECORD (`state.project`), not
 * on its contents, which is where a background tile would sit. A signature
 * that took only the contents could not see the thing this file exists for.
 */
export function blobsInProperties(state: CanvasState): Set<string> {
  const found = new Set<string>();
  const scan = (properties: Record<string, string> | undefined) => {
    for (const value of Object.values(properties ?? {})) {
      if (SHA256.test(value)) found.add(value);
    }
  };
  scan(state.project.properties);
  const canvas = state.canvas;
  // Items too: an item property may name a blob that is not one of its own
  // versions — a poster frame, a generated thumbnail — and the sweeper cannot
  // tell that from a tile.
  for (const item of Object.values(canvas.items) as Item[]) scan(item.properties);
  for (const entry of canvas.trash) scan(entry.item.properties);
  return found;
}
