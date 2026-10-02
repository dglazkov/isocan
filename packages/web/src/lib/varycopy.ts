import type { Actor, Operation, WebHost } from "@isocan/core";
import { newGroupId, newItemId, newVersionId } from "@isocan/core";
import { applyCopyDeck, applyCopyDeckToFace, copyDeck } from "@isocan/core/copy-deck";
import { checkCopyVariants, copyVariantOps, copyVariantsRequest, placeholderCopyVariants } from "@isocan/core/copy-variants";
import { homeTextGenerator, homeTextOrStub, type TextGenerator } from "@isocan/core/jev";
import { postText } from "../components/ModuleDialogs.tsx";
import { modules } from "../modules.ts";
import { setNotice, useCanvasStore } from "../stores/canvasStore.ts";
import { fetchBlobText } from "./blobtext.ts";
import { webHostFor } from "./modulehost.ts";

/**
 * **"Vary the copy…", from a screen's menu or ⌘K** — the web's door to
 * `isocan words vary` (copy-edit phase 2, journey scene 1).
 *
 * The same path the CLI walks, over the same core: the screen's deck
 * (`copyDeck`), ONE question for all N voices (`copyVariantsRequest`) asked of
 * the home's text model through `TEXT_ROUTE` — the key stays at the home — the
 * answer held to `checkCopyVariants`, each voice's file made words-only
 * (`applyCopyDeck`, or the module that draws a wire screen, `WebModule.copy`),
 * and the variants added by `copyVariantOps` under one group through the web
 * host's `send` — the door every module write and the add path use. One ⌘Z
 * takes all N back; *Choose this variation* folds one home.
 *
 * When the home has no text model (`text-unavailable`), the voices are
 * placeholder words under stances that say "Placeholder", and the notice bar
 * says so once — the way `/wire copy` falls back. Any other refusal is a
 * failure, thrown in its own words. Loaded on the click, never on first paint.
 */

/** What the menu's dialog asks for. */
interface VaryAsk {
  n: number;
  brief?: string;
}

/** What landed: the new items, who wrote the words, and whether they are placeholders. */
interface Varied {
  itemIds: string[];
  stances: string[];
  by: string;
  placeholder: boolean;
}

const PLACEHOLDER = "placeholder words";

/** Writes N copy voices for a screen in one call and lands them as variations through the host, returning their ids and stances. */
export async function varyCopy(
  canvasId: string,
  actor: Actor,
  itemId: string,
  ask: VaryAsk,
  /** The doors, swappable so a test can hold what this WOULD send: the text route, the blob read, and the host's send and upload. */
  deps: { generate?: (body: unknown) => Promise<unknown>; readText?: (blobHash: string) => Promise<string>; host?: Pick<WebHost, "send" | "putBlob"> } = {},
): Promise<Varied> {
  const canvas = useCanvasStore.getState().canvas;
  const item = canvas?.items[itemId];
  if (!canvas || !item) throw new Error("that screen is no longer on the canvas");
  const current = item.versions.find((v) => v.id === item.currentVersionId);
  if (!current || current.mimeType !== "text/html") throw new Error(`“${item.title}” is not an HTML screen — only a screen's words can be varied`);
  const readText = deps.readText ?? ((hash: string) => fetchBlobText(canvasId, hash));
  const html = await readText(current.blobHash);
  const deck = copyDeck(html);
  if (deck.unfleshed) throw new Error(`“${item.title}” is a wireframe drawing bars — /wire flesh gives it words first`);
  if (deck.strings.length === 0) throw new Error(`“${item.title}” has no words to vary`);
  const writer = deck.kind === "html" ? null : modules().find((m) => m.copy?.kind === deck.kind)?.copy;
  if (deck.kind !== "html" && !writer) throw new Error(`“${item.title}” is a ${deck.kind} screen and the module that writes its words is not loaded`);

  // One question for all N; the home's model, else placeholder voices said once.
  const generate = deps.generate ?? postText;
  const placeholder: TextGenerator = { name: PLACEHOLDER, generateJson: async <T>() => placeholderCopyVariants(deck, ask.n) as T };
  const generator = homeTextOrStub(homeTextGenerator((words) => generate(words), canvasId), placeholder, () =>
    setNotice("This home has no text model (text-unavailable) — these voices are placeholder words, not written copy. One undo takes them back."),
  );
  const { prompt, schema } = copyVariantsRequest(deck, ask.n, ask.brief);
  const raw = await generator.generateJson(prompt, schema);
  const by = generator.name;
  const checked = checkCopyVariants(deck, raw, ask.n);
  if (!checked.ok) throw new Error(`the text model's voices were refused: ${checked.reason}`);

  // Each voice's file — the screen with only its words changed — uploaded before anything is sent.
  const host = deps.host ?? webHostFor(canvasId, actor);
  const face = current.visual && current.visual.blobHash !== current.blobHash && current.visual.mimeType === "text/html" ? current.visual : null;
  const faceHtml = face ? await readText(face.blobHash) : null;
  const made = [];
  for (const variant of checked.variants) {
    let file: { html: string; properties?: Record<string, string> };
    let visual = current.visual;
    if (writer) {
      file = await writer.variant(html, variant.edits, by, item.id);
    } else {
      const out = applyCopyDeck(html, variant.edits);
      if (!out.ok) throw new Error(`“${variant.stance}”: ${out.reason}`);
      file = { html: out.html };
      if (face && faceHtml !== null) {
        const faceOut = applyCopyDeckToFace(deck, faceHtml, variant.edits);
        if (!faceOut.ok) throw new Error(`“${item.title}”: ${faceOut.reason}`);
        const filename = face.filename ?? current.filename;
        const up = await host.putBlob(new Blob([faceOut.html], { type: "text/html" }), filename);
        visual = { blobHash: up.blobHash, mimeType: "text/html", filename, size: up.size };
      }
    }
    const up = await host.putBlob(new Blob([file.html], { type: "text/html" }), current.filename);
    made.push({
      itemId: newItemId(),
      variant,
      version: { id: newVersionId(), blobHash: up.blobHash, mimeType: "text/html", filename: current.filename, size: up.size, ...(visual ? { visual } : {}) },
      ...(file.properties ? { properties: file.properties } : {}),
    });
  }
  const ops: Operation[] = copyVariantOps(canvas, item, made);
  await host.send(ops, newGroupId());
  return { itemIds: ops.map((op) => (op as { itemId: string }).itemId), stances: checked.variants.map((v) => v.stance), by, placeholder: by === PLACEHOLDER };
}
