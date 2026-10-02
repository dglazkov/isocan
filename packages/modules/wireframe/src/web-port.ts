import type { DialogHost } from "@isocan/core";
import { homeAnswerer, homeTextGenerator, homeTextOrStub, stubTextGenerator, type Answerer, type TextGenerator } from "./answerer.ts";
import type { WirePort } from "./port.ts";

/**
 * **The composer's canvas, from the browser** — a `WirePort` over the dialog's
 * host (phase 5). Ops go out through `host.send`, the door every module write
 * uses: echoed, queued offline, refused on a read-only canvas, sent AS the
 * person who asked (presence is honest — the composer is their hands, not a
 * bot's). Where an added item landed is read back off the replica, which the
 * echo has already moved.
 */
export function webPort(canvasId: string, host: Pick<DialogHost, "send" | "putBlob" | "readText" | "getCanvas"> & Partial<Pick<DialogHost, "viewer">>): WirePort {
  return {
    canvasId,
    actor: host.viewer ? { id: host.viewer.id, name: host.viewer.name } : undefined,
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

/** What the web's words are called when the home has no text model: the stub's, said as what they are. */
export const PLACEHOLDER_WORDS = "placeholder words";

/**
 * **The web's text generator: the home's text model** (`POST /api/text`,
 * copy-edit phase 0.5) — the key stays at the home. When the home holds none
 * (`text-unavailable`), or the host predates `generate`, the words are the
 * seeded stub's, named `PLACEHOLDER_WORDS` and said once in the notice bar as
 * a problem: the dialog still fills the screens, and nobody mistakes the
 * filler for written copy. Any other refusal is a failure.
 */
export function webTextGenerator(canvasId: string, host: Pick<DialogHost, "notice"> & Partial<Pick<DialogHost, "generate">>): TextGenerator {
  const placeholder: TextGenerator = { name: PLACEHOLDER_WORDS, generateJson: (prompt, schema) => stubTextGenerator(1).generateJson(prompt, schema) };
  const said = "This home has no text model (text-unavailable) — these are placeholder words, not written copy. One undo takes them back.";
  const generate = host.generate;
  if (!generate) {
    let told = false;
    return {
      name: PLACEHOLDER_WORDS,
      generateJson: (prompt, schema) => {
        if (!told) host.notice(said, true);
        told = true;
        return placeholder.generateJson(prompt, schema);
      },
    };
  }
  return homeTextOrStub(homeTextGenerator((request) => generate(request), canvasId), placeholder, () => host.notice(said, true));
}
