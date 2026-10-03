import type { Actor, CanvasContents, Item, ItemVersion, WebHost } from "@isocan/core";
import { newGroupId, newVersionId } from "@isocan/core";
import { applyCopyDeck, applyCopyDeckToFace, copyDeck, type CopyDeck } from "@isocan/core/copy-deck";
import { COPY_STANCE_PROP, COPY_WHY_PROP, VARIANT_PARENT_PROP, copyMixEdits, copyMixOps, copyMixRows, copyVariantsOf } from "@isocan/core/copy-variants";

/** core's mix shapes, read off the functions that use them. */
type CopyMixVariant = Parameters<typeof copyMixRows>[1][number];
type CopyMixRow = Extract<ReturnType<typeof copyMixRows>, { ok: true }>["rows"][number];
import { modules } from "../modules.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { fetchBlobText } from "./blobtext.ts";
import { webHostFor } from "./modulehost.ts";

/**
 * **Compare the copy, and *Use this mix*** — the web's door to
 * `isocan words mix` (copy-edit phase 3, journey scene 2).
 *
 * The same path the CLI walks, over the same core: the source's deck and
 * each copy variant's (`copyVariantsOf`), the rows where any voice differs
 * (`copyMixRows`), the person's picks made one edit set on the source
 * (`copyMixEdits`), written words only — `applyCopyDeck` (and its visual face)
 * for plain HTML, the module's `WebModule.copy.variant` for a wire screen, the
 * file `choose` would fold for a wire variant — and sent as one new version
 * of the source with every variant to the trash, under one group
 * (`copyMixOps`): one ⌘Z restores the words and brings the variants back.
 * Loaded with the compare panel, never on first paint.
 */

/** The screen a compare is about: the item itself when it has voices, else the source of the voice it is. */
export function copySourceOf(canvas: CanvasContents, itemId: string): string | null {
  const item = canvas.items[itemId];
  if (!item) return null;
  if (copyVariantsOf(canvas, itemId).length > 0) return itemId;
  const parent = item.properties[COPY_STANCE_PROP] !== undefined ? item.properties[VARIANT_PARENT_PROP] : undefined;
  return parent && canvas.items[parent] ? parent : null;
}

/** One voice, read for the panel. */
interface ReadVariant extends CopyMixVariant {
  item: Item;
  version: ItemVersion;
  why: string;
}

/** Everything the panel and the mix need, read once. */
export interface CopyMixRead {
  source: Item;
  version: ItemVersion;
  html: string;
  deck: CopyDeck;
  variants: ReadVariant[];
  rows: CopyMixRow[];
}

const current = (item: Item) => item.versions.find((v) => v.id === item.currentVersionId);

/** Read the source and its voices — or why they cannot be mixed, in words. */
export async function readCopyMix(canvasId: string, sourceId: string, readText: (blobHash: string) => Promise<string> = (hash) => fetchBlobText(canvasId, hash)): Promise<CopyMixRead> {
  const canvas = useCanvasStore.getState().canvas;
  const source = canvas?.items[sourceId];
  if (!canvas || !source) throw new Error("that screen is no longer on the canvas");
  const version = current(source);
  if (!version || version.mimeType !== "text/html") throw new Error(`“${source.title}” is not an HTML screen — only a screen's words can be mixed`);
  const items = copyVariantsOf(canvas, sourceId);
  if (items.length === 0) throw new Error(`“${source.title}” has no copy variants — Vary the copy… writes some`);
  const html = await readText(version.blobHash);
  const deck = copyDeck(html);
  const variants = await Promise.all(
    items.map(async (item): Promise<ReadVariant> => {
      const v = current(item);
      if (!v || v.mimeType !== "text/html") throw new Error(`“${item.title}” is not an HTML screen any more`);
      return { itemId: item.id, stance: item.properties[COPY_STANCE_PROP]!, why: item.properties[COPY_WHY_PROP] ?? "", item, version: v, deck: copyDeck(await readText(v.blobHash)) };
    }),
  );
  const read = copyMixRows(deck, variants);
  if (!read.ok) throw new Error(read.reason);
  return { source, version, html, deck, variants, rows: read.rows };
}

/** Fold the picks (address → variant item id) into the source as one version, the voices to the trash, one group. */
export async function mixCopy(
  canvasId: string,
  actor: Actor,
  sourceId: string,
  picks: Readonly<Record<string, string>>,
  /** The doors, swappable so a test can hold what this WOULD send. */
  deps: { readText?: (blobHash: string) => Promise<string>; host?: Pick<WebHost, "send" | "putBlob"> } = {},
): Promise<{ changed: string[]; trashed: string[]; versionId: string }> {
  const readText = deps.readText ?? ((hash: string) => fetchBlobText(canvasId, hash));
  const read = await readCopyMix(canvasId, sourceId, readText);
  const mixed = copyMixEdits(read.deck, read.variants, picks, sourceId);
  if (!mixed.ok) throw new Error(mixed.reason);
  const host = deps.host ?? webHostFor(canvasId, actor);
  const { version } = read;
  let file: string;
  let visual = version.visual;
  if (read.deck.kind === "html") {
    const out = applyCopyDeck(read.html, mixed.edits);
    if (!out.ok) throw new Error(out.reason);
    file = out.html;
    const face = version.visual && version.visual.blobHash !== version.blobHash && version.visual.mimeType === "text/html" ? version.visual : null;
    if (face) {
      const faceOut = applyCopyDeckToFace(read.deck, await readText(face.blobHash), mixed.edits);
      if (!faceOut.ok) throw new Error(`“${read.source.title}”: ${faceOut.reason}`);
      const filename = face.filename ?? version.filename;
      const up = await host.putBlob(new Blob([faceOut.html], { type: "text/html" }), filename);
      visual = { blobHash: up.blobHash, mimeType: "text/html", filename, size: up.size };
    }
  } else {
    const writer = modules().find((m) => m.copy?.kind === read.deck.kind)?.copy;
    if (!writer) throw new Error(`“${read.source.title}” is a ${read.deck.kind} screen and the module that writes its words is not loaded`);
    file = (await writer.variant(read.html, mixed.edits, actor.name, sourceId)).html;
  }
  const up = await host.putBlob(new Blob([file], { type: "text/html" }), version.filename);
  const versionId = newVersionId();
  const trashed = read.variants.map((v) => v.itemId);
  await host.send(copyMixOps(sourceId, { id: versionId, blobHash: up.blobHash, mimeType: "text/html", filename: version.filename, size: up.size, ...(visual ? { visual } : {}) }, trashed), newGroupId());
  return { changed: mixed.edits.map((e) => e.address), trashed, versionId };
}
