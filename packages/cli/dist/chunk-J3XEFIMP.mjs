import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  ITEM_CHROME,
  PLACEMENT_CLEARANCE,
  PLACEMENT_GAP,
  PROPOSAL_CAP,
  TASTE_TITLE,
  TEXT_FILENAME,
  TEXT_MIME,
  besideBox,
  citeLabel,
  itemChrome,
  midwayRefusal,
  nearestFreeSpot,
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
  textLookProperties
} from "./chunk-QCT42IYK.mjs";

// packages/cli/src/propose.ts
import { promises as fs } from "node:fs";
import path from "node:path";
function beneath(canvas, source, size) {
  const gap = itemChrome(source).below + ITEM_CHROME.above + PLACEMENT_CLEARANCE;
  const start = besideBox(size, source, "below", gap);
  const others = footprints(canvas);
  for (let row = 0; row < 10; row++) {
    const box = { ...size, x: start.x, y: start.y + row * (size.height + ITEM_CHROME.below + ITEM_CHROME.above + PLACEMENT_CLEARANCE) };
    if (!others.some((other) => overlaps(footprintOf(box), other, PLACEMENT_CLEARANCE))) return { x: box.x, y: box.y, chosen: true };
  }
  return start;
}
function footprintOf(box) {
  return { x: box.x, y: box.y - ITEM_CHROME.above, width: box.width, height: box.height + ITEM_CHROME.above + ITEM_CHROME.below };
}
function footprints(canvas, except) {
  return Object.values(canvas.items).filter((item) => item.id !== except).map((item) => {
    const c = itemChrome(item);
    return { x: item.x, y: item.y - c.above, width: item.width, height: item.height + c.above + c.below };
  });
}
async function propose(ctx, deps, sourceRef, file, opts, quiet = false) {
  const cites = [];
  for (const raw of opts.cites ?? []) {
    const cite = parseCite(raw);
    if ("refused" in cite) throw new Error(cite.refused);
    cites.push(cite);
  }
  const { canvas: p, snapshot } = await deps.canvasAndSnapshot(ctx);
  const source = deps.resolveItem(snapshot, sourceRef);
  const properties = proposalProperties(source.id, opts.hunch ? "hunch" : "sure", cites, opts.why ?? "");
  const refused = proposalRefusal(snapshot.canvas, ctx.actor.id, properties) ?? midwayRefusal(snapshot.canvas, ctx.actor.id, source.id, Date.now());
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
    title: opts.title ?? `${source.title || "Untitled"} \u2014 proposal`,
    properties
  });
  const room = proposalRoom(snapshot.canvas, ctx.actor.id) - 1;
  if (quiet) return { itemId, room };
  if (ctx.json) return deps.printJson({ itemId, sourceId: source.id, cites, room });
  console.log(
    `proposed ${itemId} beneath "${source.title}" (${opts.hunch ? "a hunch" : "sure"}; cites ${citeLabel(snapshot.canvas, cites[0])}) \u2014 ${room} of ${PROPOSAL_CAP} proposals left to you here. Keep folds it in; a Delete comes back to you as a comment.`
  );
}
async function taste(ctx, deps, words) {
  const { canvas: p, snapshot } = await deps.canvasAndSnapshot(ctx);
  const note = tasteNote(snapshot.canvas);
  const current = note ? await readCurrent(ctx, p.id, note) : null;
  const line = words.join(" ").trim();
  if (!line) {
    if (ctx.json) return deps.printJson({ itemId: note?.id ?? null, text: current ?? "" });
    console.log(current ?? `no taste note on this canvas yet \u2014 \`isocan taste "<one line>"\` starts "${TASTE_TITLE}"`);
    return;
  }
  const body = tasteWithLine(current, line);
  const upload = await ctx.client.uploadBlob(p.id, Buffer.from(body, "utf8"), TEXT_MIME, TEXT_FILENAME);
  const version = { id: newVersionId(), blobHash: upload.blobHash, mimeType: TEXT_MIME, filename: TEXT_FILENAME, size: upload.size };
  let itemId;
  if (note) {
    itemId = note.id;
    const group = newGroupId();
    await deps.sendOp(ctx, p.id, { type: "item.addVersion", itemId, version }, group);
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
      properties: { ...textLookProperties({ style: "body", face: "sans", paper: null, colour: null, font: null }), ...tasteProperties() }
    });
  }
  if (ctx.json) return deps.printJson({ itemId, line });
  console.log(`noted in "${TASTE_TITLE}" (${itemId}): ${line}`);
}
async function readCurrent(ctx, canvasId, note) {
  const version = note.versions.find((v) => v.id === note.currentVersionId) ?? note.versions.at(-1);
  if (!version) return null;
  return (await ctx.client.downloadBlob(canvasId, version.blobHash)).toString("utf8");
}

export {
  beneath,
  propose,
  taste
};
