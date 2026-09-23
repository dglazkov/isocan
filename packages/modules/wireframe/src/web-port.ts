import type { DialogHost } from "@isocan/core";
import { homeAnswerer, type Answerer } from "./answerer.ts";
import type { WirePort } from "./port.ts";

/**
 * **The composer's canvas, from the browser** — a `WirePort` over the dialog's
 * host (phase 5). Ops go out through `host.send`, the door every module write
 * uses: echoed, queued offline, refused on a read-only canvas, sent AS the
 * person who asked (presence is honest — the composer is their hands, not a
 * bot's). Where an added item landed is read back off the replica, which the
 * echo has already moved.
 */
export function webPort(canvasId: string, host: Pick<DialogHost, "send" | "putBlob" | "readText" | "getCanvas">): WirePort {
  return {
    canvasId,
    canvas: async () => host.getCanvas(),
    readText: (blobHash) => host.readText(blobHash),
    put: (text, mimeType, filename) => host.putBlob(new Blob([text], { type: mimeType }), filename),
    send: async (op, group) => {
      await host.send([op], group);
      if (op.type !== "item.add") return;
      const landed = host.getCanvas().items[op.itemId];
      return landed ? { x: landed.x, y: landed.y } : undefined;
    },
  };
}

/** The web's answerer: always the home's judge — the key stays there, and no key there is a refusal said out loud. */
export function webAnswerer(canvasId: string, host: Pick<DialogHost, "judge">): Answerer {
  return homeAnswerer((question) => host.judge(question), canvasId);
}
