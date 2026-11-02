import type { Actor, CanvasContents, DialogHost, Item, WebFlowVoice } from "@isocan/core";
import type { CopyEdit } from "@isocan/core/copy-deck";
import { checkCopyVariants, copyVariantsRequest, placeholderCopyVariants, splitFlowEdits } from "@isocan/core/copy-variants";
import { diffVersions, markSource } from "@isocan/core/diff";
import { homeTextGenerator, homeTextOrStub, type TextGenerator } from "@isocan/core/jev";
import { postText } from "../components/ModuleDialogs.tsx";
import { modules } from "../modules.ts";
import { setNotice, useCanvasStore } from "../stores/canvasStore.ts";
import { fetchBlobText } from "./blobtext.ts";
import { webHostFor } from "./modulehost.ts";

/**
 * **Choose a voice…, on a wire flow** — the web's door to `isocan wire voice`
 * (copy-edit phase 5, journey scene 5).
 *
 * The same path the CLI walks, over the same code: the module reads the flow
 * the item names — a screen of it, or its prototype — as one deck
 * (`WebCopyWriter.flow.read`, which is `flow-voice.ts`'s `readFlowVoice`, the
 * CLI's own), ONE question for all N voices (`copyVariantsRequest` with the
 * flow's scope, the request shape the CLI sends) asked of the home's text
 * model through `TEXT_ROUTE` as *Vary the copy…* asks, the answer held to
 * `checkCopyVariants`, and the chosen voice landed by the module's writer
 * (`flow.apply` → `applyFlowVoice`): one version per screen, ONE op group,
 * the prototype rebuilt once — one ⌘Z restores every word.
 *
 * When the home has no text model the voices are placeholder words under
 * stances that say "Placeholder", said once in the notice bar. Loaded on the
 * click, never on first paint.
 */

/** What the panel asks for. */
interface VoiceAsk {
  n: number;
  brief?: string;
}

/** One voice for the whole flow: its stance, why, and its edits in flow addresses. */
interface FlowVoice {
  stance: string;
  why: string;
  edits: CopyEdit[];
}

/** The flow, read, and its voices. */
export interface FlowVoices {
  flow: string;
  screens: Awaited<ReturnType<WebFlowVoice["read"]>>["screens"];
  voices: FlowVoice[];
  by: string;
  placeholder: boolean;
}

/** The doors, swappable so a test can hold what this WOULD send. */
interface Deps {
  generate?: (body: unknown) => Promise<unknown>;
  host?: Pick<DialogHost, "send" | "putBlob" | "readText" | "getCanvas">;
  writer?: WebFlowVoice;
}

const PLACEHOLDER = "placeholder words";

/** The loaded module that offers a flow's voice on this item, or null. */
function flowVoiceWriter(canvas: CanvasContents, item: Item): WebFlowVoice | null {
  for (const m of modules()) if (m.copy?.flow?.offers(canvas, item)) return m.copy.flow;
  return null;
}

function hostFor(canvasId: string, actor: Actor): Pick<DialogHost, "send" | "putBlob" | "readText" | "getCanvas"> {
  return { ...webHostFor(canvasId, actor), readText: (hash) => fetchBlobText(canvasId, hash), getCanvas: () => useCanvasStore.getState().canvas! };
}

function writerFor(itemId: string, deps: Deps): WebFlowVoice {
  if (deps.writer) return deps.writer;
  const canvas = useCanvasStore.getState().canvas;
  const item = canvas?.items[itemId];
  if (!canvas || !item) throw new Error("that screen is no longer on the canvas");
  const writer = flowVoiceWriter(canvas, item);
  if (!writer) throw new Error(`“${item.title}” is not a screen of a fleshed flow — /wire flesh gives the flow words first`);
  return writer;
}

/** N voices for the flow the item is in, in ONE call — or placeholder voices said once. Nothing is written. */
export async function writeFlowVoices(canvasId: string, actor: Actor, itemId: string, ask: VoiceAsk, deps: Deps = {}): Promise<FlowVoices> {
  const writer = writerFor(itemId, deps);
  const host = deps.host ?? hostFor(canvasId, actor);
  const read = await writer.read(host, canvasId, itemId);
  const generate = deps.generate ?? postText;
  const placeholder: TextGenerator = { name: PLACEHOLDER, generateJson: async <T>() => placeholderCopyVariants(read.deck, ask.n) as T };
  const generator = homeTextOrStub(homeTextGenerator((words) => generate(words), canvasId), placeholder, () =>
    setNotice("This home has no text model (text-unavailable) — these voices are placeholder words, not written copy. Use this voice lands one on every screen; one undo takes it back."),
  );
  const { prompt, schema } = copyVariantsRequest(read.deck, ask.n, ask.brief, read.voice, { screens: read.screens.length, titles: read.screens.map((s) => s.title) });
  const raw = await generator.generateJson(prompt, schema);
  const checked = checkCopyVariants(read.deck, raw, ask.n, read.voice);
  if (!checked.ok) throw new Error(`the text model's voices were refused: ${checked.reason}`);
  return { flow: read.flow, screens: read.screens, voices: checked.variants, by: generator.name, placeholder: generator.name === PLACEHOLDER };
}

/** One screen of the preview: the screen's words now, and with this voice, each a frame's source with what changed marked. */
export interface VoicePreview {
  itemId: string;
  title: string;
  before: string;
  after: string;
  changed: number;
}

/**
 * What a voice does to the flow's first two screens — the preview the scene
 * asks for — drawn by the module that draws them (`WebModule.copy.variant`,
 * pure: nothing is sent), with what changed marked as the compare marks it.
 */
export async function previewFlowVoice(voices: FlowVoices, voice: FlowVoice, sourceId = "preview"): Promise<VoicePreview[]> {
  const byScreen = splitFlowEdits(voice.edits);
  const variant = modules().find((m) => m.copy?.flow)?.copy?.variant;
  const out: VoicePreview[] = [];
  for (const s of voices.screens.slice(0, 2)) {
    const edits = byScreen.get(s.itemId) ?? [];
    const after = edits.length && variant ? (await variant(s.html, edits, voices.by, sourceId)).html : s.html;
    const side = (text: string) => ({ mimeType: "text/html", filename: "wireframe.html", size: text.length, text });
    const diff = diffVersions(side(s.html), side(after));
    out.push({ itemId: s.itemId, title: s.title, before: markSource(s.html, diff, "before"), after: markSource(after, diff, "after"), changed: edits.length });
  }
  return out;
}

/** The chosen voice on every screen of the flow: the module's writer, one group, the prototype once. */
export async function landFlowVoice(canvasId: string, actor: Actor, itemId: string, voices: FlowVoices, voice: FlowVoice, deps: Deps = {}) {
  const writer = writerFor(itemId, deps);
  const host = deps.host ?? hostFor(canvasId, actor);
  const against = voices.voices.filter((v) => v.stance !== voice.stance).map((v) => v.stance);
  return writer.apply(host, canvasId, itemId, voice.edits, voices.by, { stance: voice.stance, against });
}
