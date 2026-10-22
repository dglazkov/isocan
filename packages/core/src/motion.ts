/**
 * **`@isocan/core/motion`** — the engine, its recipes and checks, and the
 * builder that turns selected SVGs into a motion document (motion phase 0;
 * `docs/projects/motion/design.md` §1–§3, §6).
 *
 * A subpath of its own, never the barrel, like `@isocan/core/mood`: the CLI's
 * `isocan motion new` reads it today, the web's *Animate…* will in phase 2,
 * and nothing here belongs in a first visit.
 *
 * **A motion is an HTML item** (`text/html`), so it plays where every HTML
 * screen plays, sandboxed, with versions and comments, and no new op. Its
 * document holds the stage — the selected SVGs inlined at their canvas
 * offsets, back to front — the spec as JSON, the engine inlined as text (the
 * same function Node runs; see `motion-engine.ts`), and a small player whose
 * `window.render(t)` is the one door every frame goes through: the player's
 * own `requestAnimationFrame` loop calls it, and so will phase 1's movie
 * renderer, at `n / fps`.
 */
import { motionEngineSource, type MotionBox, type MotionSpec } from "./motion-engine.ts";
import type { MotionSource, PreparedLayer } from "./motion-svg.ts";
import { motionRecipe, type MotionRecipeName, type MotionRecipeOptions } from "./motion-recipes.ts";
import { titleSlug } from "./filenames.ts";
import { motionWarnings, validateMotionSpec, type MotionWarning } from "./motion-checks.ts";

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
export { isMotionRecipe, MOTION_BEAT, MOTION_PIVOTS, MOTION_RECIPES, motionRecipe, pivotOn, type MotionRecipeName, type MotionRecipeOptions } from "./motion-recipes.ts";
export { MOTION_MAX_SECONDS, motionWarnings, validateMotionSpec, type MotionWarning } from "./motion-checks.ts";

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

/** What `buildMotion` is handed: the selected SVGs and the recipe to move them by. */
export interface MotionBuildInput extends MotionRecipeOptions {
  sources: readonly MotionSource[];
  recipe: MotionRecipeName;
  title?: string;
}

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
 * The player: `window.render(t)` and a play/pause. `#still` (or `?still`)
 * in the address loads it paused at t = 0 with the controls hidden — what a
 * renderer wants before it starts calling `render` itself. A person who asked
 * for reduced motion gets the last frame, paused.
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
function show() {
  button.textContent = playing ? "Pause" : "Play";
  clock.textContent = at.toFixed(1) + " / " + spec.seconds + " s" + (spec.loop ? ", loops" : "");
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
function play() { if (playing) return; if (!spec.loop && at >= spec.seconds) at = 0; playing = true; origin = null; requestAnimationFrame(frame); show(); }
function pause() { playing = false; show(); }
button.addEventListener("click", function () { playing ? pause() : play(); });
window.motion = { spec: spec, engine: engine, render: window.render, play: play, pause: pause, seconds: spec.seconds, loop: spec.loop };
at = reduced && !still ? spec.seconds : 0;
window.render(at);
show();
if (!still && !reduced) play();
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
#stage { display: block; width: 100%; height: 100%; }
#motion-controls { position: fixed; left: 8px; bottom: 8px; display: flex; gap: 8px; align-items: center;
  font: 12px/1.2 system-ui, sans-serif; color: #333; background: rgba(255, 255, 255, 0.85); border-radius: 6px; padding: 4px 6px; }
#motion-controls button { font: inherit; border: 1px solid #bbb; border-radius: 4px; background: #fff; padding: 2px 8px; cursor: pointer; }
.still #motion-controls { display: none; }
</style>
</head>
<body>
<svg id="stage" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet">
${markup}
</svg>
<div id="motion-controls"><button id="motion-play" type="button">Play</button><span id="motion-time"></span></div>
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
  const options: MotionRecipeOptions = {};
  if (input.seconds !== undefined) options.seconds = input.seconds;
  if (input.loop !== undefined) options.loop = input.loop;
  const spec = motionRecipe(input.recipe, prepared.map((p) => p.layer), { width: stage.width, height: stage.height }, options);
  validateMotionSpec(spec);
  const title = input.title ?? `${input.sources.map((s) => s.title).join(" + ")} — ${input.recipe}`;
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
