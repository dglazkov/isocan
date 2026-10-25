/**
 * **`@isocan/core/motion`** — the engine, its recipes and checks, and the
 * builder that turns selected SVGs into a motion document (motion phase 0;
 * `docs/projects/motion/design.md` §1–§3, §6).
 *
 * A subpath of its own, never the barrel, like `@isocan/core/mood`: the CLI's
 * `isocan motion` verbs read it, and since phase 2 so does the web's
 * *Animate…* — from the motion module's lazy half, so nothing here belongs in
 * a first visit.
 *
 * **A motion is an HTML item** (`text/html`), so it plays where every HTML
 * screen plays, sandboxed, with versions and comments, and no new op. Its
 * document holds the stage — the selected SVGs inlined at their canvas
 * offsets, back to front — the spec as JSON, the engine inlined as text (the
 * same function Node runs; see `motion-engine.ts`), and a small player whose
 * `window.render(t)` is the one door every frame goes through: the player's
 * own `requestAnimationFrame` loop and its scrubber call it, and the movie
 * renderer's frames are the same function at `n / fps`.
 */
import { motionEngineSource, type MotionBox, type MotionSpec } from "./motion-engine.ts";
import type { MotionSource, PreparedLayer } from "./motion-svg.ts";
import { isMotionRecipe, motionRecipe, type MotionRecipeName, type MotionRecipeOptions } from "./motion-recipes.ts";
import { titleSlug } from "./filenames.ts";
import { motionWarnings, validateMotionSpec, type MotionWarning } from "./motion-checks.ts";
import { authoredSpec, motionSpecFrom } from "./motion-spec.ts";
import { MOTION_MESSAGES } from "./motion-messages.ts";
import type { Actor, CanvasContents, Item, ItemVersion } from "./model.ts";

export {
  createMotionEngine,
  motionEngine,
  motionEngineSource,
  type MotionBell,
  type MotionBox,
  type MotionChannel,
  type MotionChannelName,
  type MotionEase,
  type MotionElement,
  type MotionEngine,
  type MotionKey,
  type MotionLayer,
  type MotionMove,
  type MotionPivot,
  type MotionRoot,
  type MotionSpec,
  type MotionState,
  type MotionWave,
} from "./motion-engine.ts";
export type { MotionSource, PreparedLayer } from "./motion-svg.ts";
export { isMotionRecipe, MOTION_BEAT, MOTION_PIVOTS, MOTION_RECIPE_WORDS, MOTION_RECIPES, motionRecipe, pivotOn, type MotionRecipeName, type MotionRecipeOptions } from "./motion-recipes.ts";
export { MOTION_MAX_SECONDS, motionWarnings, validateMotionSpec, type MotionWarning } from "./motion-checks.ts";
export { authoredSpec, motionDocumentSpec, motionSpecFrom, motionTargets, type MotionAuthoredMove, type MotionAuthoredSpec, type MotionPivotName } from "./motion-spec.ts";
export { MOTION_MESSAGES, motionMessage, motionSeek } from "./motion-messages.ts";
export { addMotionItem, addMotionMovie, MOTION_BESIDE, versionMotionItem, type MotionWriter } from "./motion-items.ts";

/**
 * **The properties a motion item wears** (design §2). `motion` marks it;
 * `motionSources` is JSON `[{ item, version }]` — what it was taken from,
 * so a later phase can say a source has moved on; `motionSeconds` and
 * `motionLoop` are its length and whether it repeats.
 */
export const MOTION_PROPS = {
  motion: "motion",
  sources: "motionSources",
  seconds: "motionSeconds",
  loop: "motionLoop",
} as const;

/** The mime a motion document is: an HTML item like any screen. */
export const MOTION_MIME = "text/html";

/**
 * A layer's id, or a motion's filename stem, from a title — core's one title
 * rule, ASCII, because a layer id lands in element ids, `@scope` selectors
 * and the spec's target names.
 */
export function motionSlug(text: string): string {
  return titleSlug(text.replace(/\.svg$/i, ""), { ascii: true, max: 32 });
}

/**
 * What `buildMotion` is handed: the selected SVGs, and how they move — a
 * `recipe` (with `seconds` and `loop` to fit it), or a `spec` an agent wrote
 * (`MotionAuthoredSpec`, read by `motionSpecFrom`; its own `seconds` and
 * `loop` are what it says). Exactly one of the two.
 */
export interface MotionBuildInput extends MotionRecipeOptions {
  sources: readonly MotionSource[];
  recipe?: MotionRecipeName;
  spec?: unknown;
  title?: string;
}

/**
 * **The height of the player's controls**, below the stage and never over
 * it (motion phase 2: phase 0's Play sat over Scene 1's wordmark). A motion
 * item is the stage's height plus this, so the drawing keeps its own size.
 */
export const MOTION_CONTROLS_HEIGHT = 32;



/**
 * What `buildMotion` makes: the document, the spec inside it, the principle
 * warnings, what was stripped from each source in words, and the stage in
 * canvas coordinates — the selection's bounding box.
 */
export interface MotionBuild {
  html: string;
  spec: MotionSpec;
  warnings: MotionWarning[];
  stripped: Array<{ item: string; title: string; what: string[] }>;
  stage: MotionBox;
}

/** The selection's bounding box, in canvas coordinates: the stage. */
function motionStage(sources: readonly Pick<MotionSource, "box">[]): MotionBox {
  if (sources.length === 0) throw new Error("select at least one SVG to animate");
  const x0 = Math.min(...sources.map((s) => s.box.x));
  const y0 = Math.min(...sources.map((s) => s.box.y));
  const x1 = Math.max(...sources.map((s) => s.box.x + s.box.width));
  const y1 = Math.max(...sources.map((s) => s.box.y + s.box.height));
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

function layerIds(sources: readonly MotionSource[]): string[] {
  const used = new Set<string>();
  return sources.map((s, i) => {
    const base = motionSlug(s.title) || `layer-${i + 1}`;
    let id = /^[a-z]/.test(base) ? base : `layer-${base}`;
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    return id;
  });
}

const escapeText = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** JSON that cannot close the `<script>` it sits in. */
const inlineJson = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c");

/**
 * The player: `window.render(t)`, Play/Pause, a scrubber and the time, in a
 * bar BELOW the stage. `#still` (or `?still`) in the address loads it paused
 * at t = 0 with the controls hidden — what a renderer wants before it starts
 * calling `render` itself. A person who asked for reduced motion gets the
 * last frame, paused. It answers `MOTION_MESSAGES.seek` from the page that
 * holds it, and says `time` when a person pauses or scrubs it (and that it
 * plays, when it is played) — never when it merely reaches its end, which is
 * not a moment anybody pointed at.
 */
const PLAYER = `
var spec = JSON.parse(document.getElementById("motion-spec").textContent);
var stage = document.getElementById("stage");
var still = /[?#&]still\\b/.test(location.href);
var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if (still) document.documentElement.classList.add("still");
window.render = function (t) { engine.render(stage, spec, t); };
var playing = false, origin = null, at = 0;
var button = document.getElementById("motion-play");
var clock = document.getElementById("motion-time");
var scrub = document.getElementById("motion-scrub");
scrub.max = String(spec.seconds);
function tenths(v) { return (Math.round(v * 10) / 10).toFixed(1); }
function show() {
  button.textContent = playing ? "Pause" : "Play";
  clock.textContent = tenths(at) + " / " + spec.seconds + " s" + (spec.loop ? ", loops" : "");
  scrub.value = String(at);
  scrub.setAttribute("aria-valuetext", tenths(at) + " seconds");
}
function tell() {
  if (window.parent === window) return;
  try { window.parent.postMessage({ type: "${MOTION_MESSAGES.time}", at: Math.round(at * 1000) / 1000, playing: playing }, "*"); } catch (e) {}
}
function frame(now) {
  if (!playing) return;
  if (origin === null) origin = now - at * 1000;
  at = (now - origin) / 1000;
  if (spec.loop) at = engine.loop(at, spec.seconds);
  if (!spec.loop && at >= spec.seconds) { at = spec.seconds; playing = false; }
  window.render(at);
  show();
  if (playing) requestAnimationFrame(frame);
}
function play() { if (playing) return; if (!spec.loop && at >= spec.seconds) at = 0; playing = true; origin = null; requestAnimationFrame(frame); show(); tell(); }
function pause() { playing = false; show(); tell(); }
function seek(t) {
  playing = false;
  at = t < 0 ? 0 : t > spec.seconds ? spec.seconds : t;
  window.render(at);
  show();
  tell();
}
button.addEventListener("click", function () { playing ? pause() : play(); });
scrub.addEventListener("input", function () { seek(Number(scrub.value)); });
window.addEventListener("message", function (e) {
  if (e.source !== window.parent) return;
  var d = e.data;
  if (d && d.type === "${MOTION_MESSAGES.seek}" && typeof d.at === "number" && isFinite(d.at)) seek(d.at);
});
window.motion = { spec: spec, engine: engine, render: window.render, play: play, pause: pause, seek: seek, seconds: spec.seconds, loop: spec.loop };
at = reduced && !still ? spec.seconds : 0;
window.render(at);
show();
if (!still && !reduced) play();
if (window.parent !== window) { try { window.parent.postMessage({ type: "${MOTION_MESSAGES.ready}" }, "*"); } catch (e) {} }
`;

/**
 * **The motion document**: one HTML page, no network. The stage is ONE
 * `<svg>` — so phase 1 can serialise it straight onto a canvas — holding
 * each layer as a nested `<svg>` at its offset, in the order given.
 */
function motionDocument(spec: MotionSpec, layers: readonly PreparedLayer[], title: string, markupOf: typeof import("./motion-svg.ts").motionLayerMarkup): string {
  const drawn = new Set(spec.moves.filter((m) => m.channels.draw).map((m) => m.target));
  const markup = layers.map((l) => markupOf(l, drawn)).join("\n");
  const engine = motionEngineSource();
  if (/<\/script/i.test(engine) || /<\/script/i.test(PLAYER)) throw new Error("the motion engine's source would close its own <script>");
  const { width, height } = spec.stage;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="isocan motion">
<title>${escapeText(title)}</title>
<style>
html, body { margin: 0; height: 100%; overflow: hidden; background: transparent; }
body { display: flex; flex-direction: column; }
#stage { display: block; flex: 1 1 auto; min-height: 0; width: 100%; height: 100%; }
#motion-controls { flex: none; box-sizing: border-box; height: ${MOTION_CONTROLS_HEIGHT}px; display: flex; gap: 8px; align-items: center; padding: 0 8px;
  font: 12px/1.2 system-ui, sans-serif; color: #333; background: rgba(255, 255, 255, 0.9); border-top: 1px solid rgba(0, 0, 0, 0.1); }
#motion-controls button { font: inherit; border: 1px solid #bbb; border-radius: 4px; background: #fff; padding: 2px 8px; cursor: pointer; min-width: 52px; }
#motion-scrub { flex: 1 1 auto; min-width: 40px; margin: 0; }
#motion-time { flex: none; font-variant-numeric: tabular-nums; }
.still #motion-controls { display: none; }
</style>
</head>
<body>
<svg id="stage" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet">
${markup}
</svg>
<div id="motion-controls"><button id="motion-play" type="button">Play</button><input id="motion-scrub" type="range" min="0" step="0.01" value="0" aria-label="Time"><span id="motion-time"></span></div>
<script type="application/json" id="motion-spec">${inlineJson(spec)}</script>
<script>
/* The isocan motion engine (@isocan/core/motion): pure in t, after
   rossark0/rossark-motion-skill (MIT) — our own code, its shapes. */
var engine = ${engine};
${PLAYER}
</script>
</body>
</html>
`;
}

/**
 * **Selected SVGs → a motion.** Sanitises and lays out each source on the
 * stage (the selection's bounding box, sources in canvas stacking order),
 * writes the recipe's spec, refuses an unplayable one, checks the
 * principles, and returns the document with the warnings and what was
 * stripped.
 *
 * **Async for one reason**: the SVG half (parse5 and css-tree) is imported
 * when a motion is built, not when `@isocan/core/motion` is — the CLI loads
 * this subpath at startup to register `isocan motion`, and every command,
 * `--version` included, would otherwise read two parsers it never uses
 * (`test/cli-bundle.test.ts` measured it: 43 modules and 5.49 MB to print a
 * version, against 40 and 5.03 with the import here).
 */
export async function buildMotion(input: MotionBuildInput): Promise<MotionBuild> {
  const { prepareMotionLayer, motionLayerMarkup } = await import("./motion-svg.ts");
  const stage = motionStage(input.sources);
  const ids = layerIds(input.sources);
  const prepared = input.sources.map((s, i) => prepareMotionLayer(s, ids[i]!, stage));
  if ((input.recipe === undefined) === (input.spec === undefined)) throw new Error("say how it moves: a recipe, or a spec — one of the two");
  const layers = prepared.map((p) => p.layer);
  const size = { width: stage.width, height: stage.height };
  let spec: MotionSpec;
  if (input.recipe !== undefined) {
    const options: MotionRecipeOptions = {};
    if (input.seconds !== undefined) options.seconds = input.seconds;
    if (input.loop !== undefined) options.loop = input.loop;
    spec = motionRecipe(input.recipe, layers, size, options);
    validateMotionSpec(spec);
  } else {
    spec = motionSpecFrom(input.spec, layers, size);
  }
  const title = input.title ?? `${input.sources.map((s) => s.title).join(" + ")} — ${input.recipe ?? "motion"}`;
  return {
    html: motionDocument(spec, prepared, title, motionLayerMarkup),
    spec,
    warnings: motionWarnings(spec),
    stripped: prepared.filter((p) => p.stripped.length > 0).map((p) => ({ item: p.layer.item, title: p.layer.title, what: p.stripped })),
    stage,
  };
}

/** The properties for a motion item made from this build. */
export function motionProperties(build: Pick<MotionBuild, "spec">): Record<string, string> {
  return {
    [MOTION_PROPS.motion]: "true",
    [MOTION_PROPS.sources]: JSON.stringify(build.spec.layers.map((l) => ({ item: l.item, version: l.version }))),
    [MOTION_PROPS.seconds]: String(build.spec.seconds),
    [MOTION_PROPS.loop]: String(build.spec.loop),
  };
}

/** One source a motion was taken from: the item, and the version it was taken at. */
interface MotionSourceRef {
  item: string;
  version: string;
}

/** What a motion item says it was taken from (`motionSources`), or nothing for an item that is not a motion. */
function motionSourcesOf(item: Pick<Item, "properties">): MotionSourceRef[] {
  if (item.properties[MOTION_PROPS.motion] !== "true") return [];
  try {
    const raw = JSON.parse(item.properties[MOTION_PROPS.sources] ?? "[]") as unknown;
    return Array.isArray(raw) ? raw.filter((r): r is MotionSourceRef => typeof r?.item === "string" && typeof r?.version === "string") : [];
  } catch {
    return [];
  }
}

/** A source that has moved on since the motion took it: what it was taken at, and what it is now. */
interface MotionStaleSource {
  item: string;
  title: string;
  taken: string;
  current: string;
}

/**
 * **Which sources have a newer version than the motion took** (design §2):
 * the details line *"Wheat has a newer version"* and the gate on *Refresh
 * from sources* / `isocan motion refresh`. A source no longer on the canvas
 * is not stale — it is gone, and refresh says so.
 */
export function motionStale(canvas: Pick<CanvasContents, "items">, motion: Pick<Item, "properties">): MotionStaleSource[] {
  return motionSourcesOf(motion).flatMap((ref) => {
    const item = canvas.items[ref.item];
    if (!item || item.currentVersionId === ref.version) return [];
    return [{ item: item.id, title: item.title, taken: ref.version, current: item.currentVersionId }];
  });
}

/** The details line for a motion whose sources moved on — *"Wheat has a newer version"* — or null. */
export function motionStaleLine(stale: readonly Pick<MotionStaleSource, "title">[]): string | null {
  if (stale.length === 0) return null;
  const names = stale.map((s) => s.title);
  const list = names.length === 1 ? names[0]! : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `${list} ${names.length === 1 ? "has a newer version" : "have newer versions"}`;
}

/** What opens the summons the web's *Animate…* posts, so it can be found again. */
export const MOTION_ASK_MARK = "Animate, please:";

/**
 * **What *Animate…* posts when a person types words** (motion phase 2,
 * design §3): an ordinary summons to the canvas's lead, naming the source
 * items and the words, and the one command that answers it. The agent writes
 * a spec — never code — so the ask points at the guide's motion topic, and
 * it says to RUN the command: a real agent read "answer with" as "reply with
 * this text" and printed it (22 Oct 2026). The comment carries the sources
 * in `items`, so it is found by what it is about.
 */
export function motionAsk(lead: Pick<Actor, "name">, sources: readonly Pick<Item, "id" | "title">[], words: string): string {
  const ids = sources.map((s) => s.id).join(" ");
  const named = sources.map((s) => `“${s.title || "Untitled"}” (${s.id})`).join(", ");
  const said = words.trim().replace(/\s+/g, " ");
  return `@${lead.name} ${MOTION_ASK_MARK} ${named} — “${said}”. Write a motion spec from these words (\`isocan --agent-help motion\` teaches it), then RUN \`isocan motion new ${ids} --spec <file.json> --say "${said.replace(/"/g, "'")}"\` yourself — the motion on the canvas is your answer, not the command.`;
}

/** A layer's source, found on the canvas for a rebuild: the item, the version to read, and where the layer sat. */
interface MotionLayerSource {
  item: Item;
  version: ItemVersion;
  /** The layer's own title — its id comes from it, and the spec's targets name that id. */
  title: string;
  box: MotionSource["box"];
}

/**
 * **What a motion's layers were drawn from, found again** — for `motion edit`
 * (`which: "taken"`, the versions the motion took: same sources, a new spec)
 * and `motion refresh` / *Refresh from sources* (`"current"`, each source's
 * current version). The layout and titles are the motion's own, not the
 * canvas's now, so every target the spec names keeps its name and place. A
 * source deleted since is read from the trash for an edit, and refused in
 * words for a refresh.
 */
export function motionLayerSources(spec: Pick<MotionSpec, "layers">, canvas: Pick<CanvasContents, "items" | "trash">, which: "taken" | "current"): MotionLayerSource[] {
  return spec.layers.map((layer) => {
    const item = canvas.items[layer.item] ?? (which === "taken" ? canvas.trash.find((t) => t.item.id === layer.item)?.item : undefined);
    if (!item) throw new Error(`${layer.title} is not on this canvas any more — a motion refreshes from sources that are still here`);
    const versionId = which === "taken" ? layer.version : item.currentVersionId;
    const version = item.versions.find((v) => v.id === versionId);
    if (!version) throw new Error(`${layer.title} no longer has the version this motion took (${versionId})`);
    return { item, version, title: layer.title, box: { ...layer.box } };
  });
}

/**
 * **The same motion over these sources** — what a refresh builds: a recipe's
 * motion (the spec still says `recipe`, so nobody has rewritten it) runs its
 * recipe again at the same length, so a part a newer drawing added moves too;
 * a written spec keeps its moves, its named pivots re-resolved against the
 * newer drawings.
 */
export async function rebuildMotion(spec: MotionSpec, sources: readonly MotionSource[], title: string): Promise<MotionBuild> {
  if (spec.recipe && isMotionRecipe(spec.recipe)) {
    return buildMotion({ sources, recipe: spec.recipe, seconds: spec.seconds, loop: spec.loop, title });
  }
  return buildMotion({ sources, spec: authoredSpec(spec), title });
}
