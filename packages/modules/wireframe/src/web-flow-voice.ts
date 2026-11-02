import type { WebFlowVoice } from "@isocan/core";
import { applyFlowVoice, flowScreensOf, flowSeedOf, readFlowVoice } from "./flow-voice.ts";
import { wiresOn } from "./flow.ts";
import { webPort } from "./web-port.ts";

/**
 * **A voice for the flow, from the browser** — `WebCopyWriter.flow`'s `read`
 * and `apply` (copy-edit phase 5). The CLI's own reading and landing
 * (`flow-voice.ts`) over the dialog's host: the flow the item names (a
 * screen of it, or its prototype), every fleshed screen's words as one deck,
 * and the chosen voice written through the one writer — one version per
 * screen it touches, ONE op group, the prototype rebuilt once — sent as the
 * person who chose it, so one ⌘Z takes every word back. Fetched on the
 * click, never with the module's half.
 */
async function flowFor(host: Parameters<WebFlowVoice["read"]>[0], canvasId: string, itemId: string) {
  const port = webPort(canvasId, host as Parameters<typeof webPort>[1]);
  const canvas = await port.canvas();
  const all = await wiresOn(port, canvas);
  const seed = flowSeedOf(canvas, all, itemId);
  if (!seed) throw new Error("that is not a wireframe screen or a prototype — Choose a voice… writes a flow's words");
  const { screens, flow } = flowScreensOf(all, seed);
  return { port, canvas, all, read: await readFlowVoice(port, canvas, screens, flow) };
}

export const read: WebFlowVoice["read"] = async (host, canvasId, itemId) => {
  const { read } = await flowFor(host, canvasId, itemId);
  return { flow: read.flow, deck: read.deck, voice: read.voice, screens: read.decks.map((d) => ({ ...d, html: read.htmlOf.get(d.itemId)! })) };
};

export const apply: WebFlowVoice["apply"] = async (host, canvasId, itemId, edits, by, choice) => {
  const { port, canvas, all, read } = await flowFor(host, canvasId, itemId);
  const done = await applyFlowVoice(port, canvas, all, read, edits, by, choice);
  return { group: done.group, changed: done.changed.map((c) => ({ itemId: c.item, title: c.title, strings: c.strings })), prototypes: done.prototypes.length };
};
