import type { Actor, Item } from "@isocan/core";
import { TEXT_FILENAME, TEXT_MIME, newItemId, newVersionId, noteProperties, noteSpot, textTitle } from "@isocan/core";
import { uploadBlob } from "./api.ts";
import { sendEchoed } from "../stores/canvasStore.ts";

/**
 * **A speaker note for a slide, made on the canvas** (`core/slides.ts`,
 * "speaker notes"). The same item the Text tool makes — a markdown blob and
 * an ordinary `item.add` — landing under the slide at the slide's width,
 * wearing `noteFor=<slideId>` so both surfaces know what it speaks for.
 * `isocan slides note` makes the byte-identical item from a terminal.
 */
export async function addSpeakerNote(canvasId: string, actor: Actor, slide: Item, body: string): Promise<string> {
  const blob = new Blob([body], { type: TEXT_MIME });
  const upload = await uploadBlob(canvasId, blob, TEXT_FILENAME);
  const itemId = newItemId();
  const spot = noteSpot(slide);
  await sendEchoed(canvasId, actor, {
    type: "item.add",
    itemId,
    version: { id: newVersionId(), blobHash: upload.blobHash, mimeType: TEXT_MIME, filename: TEXT_FILENAME, size: upload.size },
    width: spot.width,
    height: spot.height,
    // Under its slide is a spot somebody meant: a tidy must not move it away.
    placement: { x: spot.x, y: spot.y, chosen: true },
    title: textTitle(body),
    properties: noteProperties(slide.id),
  });
  return itemId;
}

/** What a fresh note says before anyone has written it. */
export function noteStarter(slide: Item): string {
  return `Notes for ${slide.title}\n\n- `;
}
