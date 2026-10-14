import { promises as fs } from "node:fs";
import path from "node:path";
import {
  ITEM_CHROME,
  PLACEMENT_CLEARANCE,
  PLACEMENT_GAP,
  PROPOSAL_CAP,
  TEXT_FILENAME,
  TEXT_MIME,
  TASTE_TITLE,
  besideBox,
  itemChrome,
  nearestFreeSpot,
  citeLabel,
  newGroupId,
  newItemId,
  newVersionId,
  overlaps,
  parseCite,
  proposalProperties,
  proposalRefusal,
  proposalRoom,
  tasteNote,
  tasteProperties,
  tasteWithLine,
  textBox,
  textLookProperties,
  type CanvasContents,
  type Canvas,
  type CanvasSnapshotResponse,
  type Item,
  type Operation,
  type ProposalCite,
} from "@isocan/core";
import type { Ctx } from "./ctx.ts";

/**
 * **`isocan propose` and `isocan taste`** (proactive-agent phase 1) — loaded
 * on these two verbs and no other, so `--version` and every other command
 * pay nothing for them. The verbs are registered in `main.ts`; this is their
 * body, handed main's three helpers rather than importing main.
 */
export interface ProposeDeps {
  canvasAndSnapshot: (ctx: Ctx) => Promise<{ canvas: Canvas; snapshot: CanvasSnapshotResponse }>;
  resolveItem: (snapshot: CanvasSnapshotResponse, ref: string) => Item;
  sendOp: (ctx: Ctx, canvasId: string, op: Operation, group?: string) => Promise<unknown>;
  /**
   * Handed in rather than imported: a module this chunk shared with main's
   * would be split into a chunk of its own that `--version` then loads
   * (`test/cli-bundle.test.ts` counts them).
   */
  mimeFor: (filename: string) => string;
  printJson: (value: unknown) => void;
}

/**
 * **Beneath the source, never on top of anything.** Centred under it with the
 * gap everything else leaves (`besideBox`, the same arithmetic "next to"
 * uses); when something is already there, the next clear row further down —
 * a proposal that slid off to the right would read as belonging to whatever
 * it landed beside. Sent as `chosen`, because this spot was searched and
 * means "under that one"; past ten rows it goes unchosen and the daemon's
 * own tidy finds it a clear spot.
 */
export function beneath(canvas: CanvasContents, source: Item, size: { width: number; height: number }): { x: number; y: number; chosen?: true } {
  // Footprint to footprint: the source's marks row below it, this one's name
  // strip above it, and the clearance between — so the strip never sits on
  // the row, which a box-to-box gap of 40 would allow.
  const gap = itemChrome(source).below + ITEM_CHROME.above + PLACEMENT_CLEARANCE;
  const start = besideBox(size, source, "below", gap);
  const others = footprints(canvas);
  for (let row = 0; row < 10; row++) {
    const box = { ...size, x: start.x, y: start.y + row * (size.height + ITEM_CHROME.below + ITEM_CHROME.above + PLACEMENT_CLEARANCE) };
    if (!others.some((other) => overlaps(footprintOf(box), other, PLACEMENT_CLEARANCE))) return { x: box.x, y: box.y, chosen: true };
  }
  return start;
}

/** A new item's footprint: its box plus the name strip above and the marks row below (`ITEM_CHROME`). */
function footprintOf(box: { x: number; y: number; width: number; height: number }) {
  return { x: box.x, y: box.y - ITEM_CHROME.above, width: box.width, height: box.height + ITEM_CHROME.above + ITEM_CHROME.below };
}

/** Every item's footprint as core's tidy measures it (`itemChrome`): what a new thing must not land on. */
function footprints(canvas: CanvasContents, except?: string) {
  return Object.values(canvas.items).filter((item) => item.id !== except).map((item) => {
    const c = itemChrome(item);
    return { x: item.x, y: item.y - c.above, width: item.width, height: item.height + c.above + c.below };
  });
}

/** `isocan propose <source> <file> --cites <kind:ref>… --why "…" [--hunch]`. */
export async function propose(
  ctx: Ctx,
  deps: ProposeDeps,
  sourceRef: string,
  file: string,
  opts: { cites?: string[]; why?: string; hunch?: boolean; title?: string },
): Promise<void> {
  // Read the cites before anything else: no trigger, no proposal, and
  // nothing is uploaded on the way to that refusal.
  const cites: ProposalCite[] = [];
  for (const raw of opts.cites ?? []) {
    const cite = parseCite(raw);
    if ("refused" in cite) throw new Error(cite.refused);
    cites.push(cite);
  }
  const { canvas: p, snapshot } = await deps.canvasAndSnapshot(ctx);
  const source = deps.resolveItem(snapshot, sourceRef);
  const properties = proposalProperties(source.id, opts.hunch ? "hunch" : "sure", cites, opts.why ?? "");
  // The reducer refuses the same thing in the same words; asking here first
  // says so before the file is read or uploaded.
  const refused = proposalRefusal(snapshot.canvas, ctx.actor.id, properties);
  if (refused) throw new Error(refused);

  const bytes = await fs.readFile(file);
  const filename = path.basename(file);
  const mimeType = deps.mimeFor(filename);
  const upload = await ctx.client.uploadBlob(p.id, bytes, mimeType, filename);
  const size = { width: source.width, height: source.height };
  const itemId = newItemId();
  await deps.sendOp(ctx, p.id, {
    type: "item.add",
    itemId,
    version: { id: newVersionId(), blobHash: upload.blobHash, mimeType, filename, size: upload.size },
    ...size,
    placement: beneath(snapshot.canvas, source, size),
    title: opts.title ?? `${source.title || "Untitled"} — proposal`,
    properties,
  });
  const room = proposalRoom(snapshot.canvas, ctx.actor.id) - 1;
  if (ctx.json) return deps.printJson({ itemId, sourceId: source.id, cites, room });
  console.log(
    `proposed ${itemId} beneath "${source.title}" (${opts.hunch ? "a hunch" : "sure"}; cites ${citeLabel(snapshot.canvas, cites[0]!)})` +
      ` — ${room} of ${PROPOSAL_CAP} proposals left to you here. Keep folds it in; a Delete comes back to you as a comment.`,
  );
}

/**
 * `isocan taste [line…]` — print the canvas's taste note, or add one line to
 * it, making the note (titled, `taste=1`, pinned into context) the first time
 * a line needs it. The answer to a delete's comment: what it taught, in one
 * line a later proposal can be held to.
 */
export async function taste(ctx: Ctx, deps: ProposeDeps, words: string[]): Promise<void> {
  const { canvas: p, snapshot } = await deps.canvasAndSnapshot(ctx);
  const note = tasteNote(snapshot.canvas);
  const current = note ? await readCurrent(ctx, p.id, note) : null;
  const line = words.join(" ").trim();
  if (!line) {
    if (ctx.json) return deps.printJson({ itemId: note?.id ?? null, text: current ?? "" });
    console.log(current ?? `no taste note on this canvas yet — \`isocan taste "<one line>"\` starts "${TASTE_TITLE}"`);
    return;
  }
  const body = tasteWithLine(current, line);
  const upload = await ctx.client.uploadBlob(p.id, Buffer.from(body, "utf8"), TEXT_MIME, TEXT_FILENAME);
  const version = { id: newVersionId(), blobHash: upload.blobHash, mimeType: TEXT_MIME, filename: TEXT_FILENAME, size: upload.size };
  let itemId: string;
  if (note) {
    itemId = note.id;
    // One line is one undo: the version, and the growth that makes room for it.
    const group = newGroupId();
    await deps.sendOp(ctx, p.id, { type: "item.addVersion", itemId, version }, group);
    // Grow the box with the words, so the new line is not cut off — upward
    // when growing down would run its marks row into whatever is below.
    const box = textBox(body);
    if (box.height > note.height) {
      const width = Math.max(note.width, box.width);
      const others = footprints(snapshot.canvas, note.id);
      const down = { x: note.x, y: note.y, width, height: box.height };
      const clear = !others.some((o) => overlaps(footprintOf(down), o, PLACEMENT_CLEARANCE));
      await deps.sendOp(ctx, p.id, { type: "item.resize", itemId, width, height: box.height }, group);
      if (!clear) await deps.sendOp(ctx, p.id, { type: "item.move", itemId, x: note.x, y: note.y - (box.height - note.height) }, group);
    }
  } else {
    itemId = newItemId();
    const box = textBox(body);
    // Above everything else on the canvas, at its left edge — asked for as a
    // footprint (name strip and marks row included) and moved by core's
    // free-spot search until it lands on no other item's footprint. Sent as
    // `chosen`: the spot was searched with chrome counted, which the
    // daemon's box-only tidy does not, so it must not be moved again.
    const items = Object.values(snapshot.canvas.items);
    const top = items.length ? Math.min(...items.map((i) => i.y - itemChrome(i).above)) : 0;
    const left = items.length ? Math.min(...items.map((i) => i.x)) : 0;
    const want = footprintOf({ x: left, y: top - PLACEMENT_GAP - ITEM_CHROME.below - box.height, ...box });
    const spot = nearestFreeSpot(want, footprints(snapshot.canvas));
    await deps.sendOp(ctx, p.id, {
      type: "item.add",
      itemId,
      version,
      ...box,
      placement: { x: spot.x, y: spot.y + ITEM_CHROME.above, chosen: true },
      title: TASTE_TITLE,
      properties: { ...textLookProperties({ style: "body", face: "sans", paper: null, colour: null, font: null }), ...tasteProperties() },
    });
  }
  if (ctx.json) return deps.printJson({ itemId, line });
  console.log(`noted in "${TASTE_TITLE}" (${itemId}): ${line}`);
}

async function readCurrent(ctx: Ctx, canvasId: string, note: Item): Promise<string | null> {
  const version = note.versions.find((v) => v.id === note.currentVersionId) ?? note.versions.at(-1);
  if (!version) return null;
  return (await ctx.client.downloadBlob(canvasId, version.blobHash)).toString("utf8");
}
