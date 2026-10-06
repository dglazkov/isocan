import { newGroupId, type CanvasContents } from "@isocan/core";
import { copyDeck, wireCopyFile, type CopyDeck, type CopyEdit } from "@isocan/core/copy-deck";
import { flowCopyDeck, splitFlowEdits, type FlowDeckScreen } from "@isocan/core/copy-variants";
import { voiceOf, type CopyVoice } from "@isocan/core/copy-voice";
import { readSystemDoc } from "./behind.ts";
import { writeWireCopy } from "./copy-write.ts";
import type { Screen } from "./flow.ts";
import { rebuildPrototypes } from "./kept-flows.ts";
import { currentVersionOf, type WirePort } from "./port.ts";
import { flowScreens } from "./presets.ts";
import { PROTOTYPE_PROP } from "./prototype.ts";
import { governingSystem } from "./restyle.ts";
import { wireTitle } from "./spec.ts";

/**
 * **A voice for the flow, the part both surfaces share** (copy-edit phase 5,
 * journey scene 5). `isocan wire voice` and the canvas's *Choose a voice…*
 * read a flow the same way — every fleshed screen of it, in flow order,
 * variations left out, as one deck (`flowCopyDeck`) with the product's Voice
 * section beside it — and land a chosen voice the same way: each screen's
 * share through the one writer (`writeWireCopy`), all in ONE op group, the
 * prototype rebuilt once. Browser-safe, which is why it is not in
 * `voice-cli.ts`; the CLI adds the file, the flags and the receipt, the web
 * adds the panel.
 */

/** A flow's screens and words, read once for a voice to be written and landed. */
export interface FlowVoiceRead {
  flow: string;
  /** The flow's screens, variations left out (the ones a voice can write). */
  screens: Screen[];
  /** Each screen that has words, in flow order: its id, title and own deck. */
  decks: FlowDeckScreen[];
  /** Each of those screens' current file, by item id. */
  htmlOf: Map<string, string>;
  /** The flow as one deck, addresses `<screen>::<address>`. */
  deck: CopyDeck;
  /** The product's voice: the governing DESIGN.md's Voice section, or null. */
  voice: CopyVoice | null;
}

/** The flow a set of screens (or the canvas's only flow, or `--flow`) is in: every screen of it, variations left out. */
export function flowScreensOf(all: Screen[], seed: readonly string[]): { screens: Screen[]; flow: string } {
  const screens = flowScreens(all, seed).filter((s) => !s.spec.variantOf || s.spec.variantOf === s.item);
  return { screens, flow: screens[0]?.spec.flow || screens[0]?.item || "" };
}

/** The flow an item names — a screen of it, or its prototype — as the screens it seeds, or null when it is neither. */
export function flowSeedOf(canvas: CanvasContents, all: Screen[], itemId: string): string[] | null {
  const item = canvas.items[itemId];
  const flow = item?.properties?.[PROTOTYPE_PROP];
  if (flow !== undefined) {
    const seed = all.filter((s) => s.spec.flow === flow).map((s) => s.item);
    return seed.length ? seed : null;
  }
  return all.some((s) => s.item === itemId) ? [itemId] : null;
}

/** The product's voice for a screen: the governing DESIGN.md's Voice section, or null. */
async function productVoice(port: Pick<WirePort, "readText">, canvas: CanvasContents, itemId: string): Promise<CopyVoice | null> {
  const item = canvas.items[itemId];
  const system = item ? governingSystem(canvas, item) : null;
  if (!system) return null;
  const doc = await readSystemDoc(system, (hash) => port.readText(hash));
  return doc ? voiceOf(doc) : null;
}

/** Each screen's deck from its file — a screen still drawing bars has no words and is left out — and the product's voice. */
export async function readFlowVoice(port: Pick<WirePort, "readText">, canvas: CanvasContents, screens: Screen[], flow: string): Promise<FlowVoiceRead> {
  const decks: FlowDeckScreen[] = [];
  const htmlOf = new Map<string, string>();
  for (const s of screens) {
    const item = canvas.items[s.item];
    const v = item ? currentVersionOf(item) : undefined;
    if (!v) continue;
    const html = await port.readText(v.blobHash);
    const deck = copyDeck(html);
    if (deck.unfleshed || deck.strings.length === 0) continue;
    htmlOf.set(s.item, html);
    decks.push({ itemId: s.item, title: wireTitle(s.spec), deck });
  }
  if (decks.length === 0) throw new Error(`the flow's ${screens.length} screen${screens.length === 1 ? "" : "s"} draw bars — \`isocan wire flesh --flow ${flow}\` gives them words first`);
  const voice = await productVoice(port, canvas, decks[0]!.itemId);
  return { flow, screens, decks, htmlOf, deck: flowCopyDeck(decks), voice };
}

/** What landing one voice wrote. */
export interface FlowVoiceApplied {
  group: string;
  changed: Array<{ item: string; title: string; spec: Screen["spec"]; strings: number }>;
  prototypes: Array<{ itemId: string; what: string }>;
}

/** One voice (flow addresses) on every screen it touches: one version each, one group, the prototype rebuilt once. */
export async function applyFlowVoice(port: WirePort, canvas: CanvasContents, all: Screen[], read: FlowVoiceRead, edits: readonly CopyEdit[], by: string): Promise<FlowVoiceApplied> {
  const byScreen = splitFlowEdits(edits);
  const group = newGroupId();
  const changed: FlowVoiceApplied["changed"] = [];
  for (const s of read.screens) {
    const mine = byScreen.get(s.item);
    const html = read.htmlOf.get(s.item);
    if (!mine || !html) continue;
    const file = wireCopyFile(html, mine);
    if (!file.ok) throw new Error(`"${wireTitle(s.spec)}": ${file.reason}`);
    const r = await writeWireCopy(port, canvas, all, s, file.file, by, undefined, { group, rebuild: false });
    if (r.changed) changed.push({ item: s.item, title: wireTitle(r.next), spec: r.next, strings: file.changed.length });
  }
  const prototypes = changed.length ? await rebuildPrototypes(port, canvas, all, changed.map((c) => ({ item: c.item, spec: c.spec })), group) : [];
  return { group, changed, prototypes };
}
