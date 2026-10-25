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
import { type MotionBox, type MotionSpec } from "./motion-engine.js";
import type { MotionSource } from "./motion-svg.js";
import { type MotionRecipeName, type MotionRecipeOptions } from "./motion-recipes.js";
import { type MotionWarning } from "./motion-checks.js";
import type { Actor, CanvasContents, Item, ItemVersion } from "./model.js";
export { createMotionEngine, motionEngine, motionEngineSource, type MotionBell, type MotionBox, type MotionChannel, type MotionChannelName, type MotionEase, type MotionElement, type MotionEngine, type MotionKey, type MotionLayer, type MotionMove, type MotionPivot, type MotionRoot, type MotionSpec, type MotionState, type MotionWave, } from "./motion-engine.js";
export type { MotionSource, PreparedLayer } from "./motion-svg.js";
export { isMotionRecipe, MOTION_BEAT, MOTION_PIVOTS, MOTION_RECIPE_WORDS, MOTION_RECIPES, motionRecipe, pivotOn, type MotionRecipeName, type MotionRecipeOptions } from "./motion-recipes.js";
export { MOTION_MAX_SECONDS, motionWarnings, validateMotionSpec, type MotionWarning } from "./motion-checks.js";
export { authoredSpec, motionDocumentSpec, motionSpecFrom, motionTargets, type MotionAuthoredMove, type MotionAuthoredSpec, type MotionPivotName } from "./motion-spec.js";
export { MOTION_MESSAGES, motionMessage, motionSeek } from "./motion-messages.js";
export { addMotionItem, addMotionMovie, MOTION_BESIDE, versionMotionItem, type MotionWriter } from "./motion-items.js";
/**
 * **The properties a motion item wears** (design §2). `motion` marks it;
 * `motionSources` is JSON `[{ item, version }]` — what it was taken from,
 * so a later phase can say a source has moved on; `motionSeconds` and
 * `motionLoop` are its length and whether it repeats.
 */
export declare const MOTION_PROPS: {
    readonly motion: "motion";
    readonly sources: "motionSources";
    readonly seconds: "motionSeconds";
    readonly loop: "motionLoop";
};
/** The mime a motion document is: an HTML item like any screen. */
export declare const MOTION_MIME = "text/html";
/**
 * A layer's id, or a motion's filename stem, from a title — core's one title
 * rule, ASCII, because a layer id lands in element ids, `@scope` selectors
 * and the spec's target names.
 */
export declare function motionSlug(text: string): string;
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
export declare const MOTION_CONTROLS_HEIGHT = 32;
/**
 * What `buildMotion` makes: the document, the spec inside it, the principle
 * warnings, what was stripped from each source in words, and the stage in
 * canvas coordinates — the selection's bounding box.
 */
export interface MotionBuild {
    html: string;
    spec: MotionSpec;
    warnings: MotionWarning[];
    stripped: Array<{
        item: string;
        title: string;
        what: string[];
    }>;
    stage: MotionBox;
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
export declare function buildMotion(input: MotionBuildInput): Promise<MotionBuild>;
/** The properties for a motion item made from this build. */
export declare function motionProperties(build: Pick<MotionBuild, "spec">): Record<string, string>;
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
export declare function motionStale(canvas: Pick<CanvasContents, "items">, motion: Pick<Item, "properties">): MotionStaleSource[];
/** The details line for a motion whose sources moved on — *"Wheat has a newer version"* — or null. */
export declare function motionStaleLine(stale: readonly Pick<MotionStaleSource, "title">[]): string | null;
/** What opens the summons the web's *Animate…* posts, so it can be found again. */
export declare const MOTION_ASK_MARK = "Animate, please:";
/**
 * **What *Animate…* posts when a person types words** (motion phase 2,
 * design §3): an ordinary summons to the canvas's lead, naming the source
 * items and the words, and the one command that answers it. The agent writes
 * a spec — never code — so the ask points at the guide's motion topic, and
 * it says to RUN the command: a real agent read "answer with" as "reply with
 * this text" and printed it (22 Oct 2026). The comment carries the sources
 * in `items`, so it is found by what it is about.
 */
export declare function motionAsk(lead: Pick<Actor, "name">, sources: readonly Pick<Item, "id" | "title">[], words: string): string;
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
export declare function motionLayerSources(spec: Pick<MotionSpec, "layers">, canvas: Pick<CanvasContents, "items" | "trash">, which: "taken" | "current"): MotionLayerSource[];
/**
 * **The same motion over these sources** — what a refresh builds: a recipe's
 * motion (the spec still says `recipe`, so nobody has rewritten it) runs its
 * recipe again at the same length, so a part a newer drawing added moves too;
 * a written spec keeps its moves, its named pivots re-resolved against the
 * newer drawings.
 */
export declare function rebuildMotion(spec: MotionSpec, sources: readonly MotionSource[], title: string): Promise<MotionBuild>;
