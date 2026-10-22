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
import { type MotionBox, type MotionSpec } from "./motion-engine.js";
import type { MotionSource } from "./motion-svg.js";
import { type MotionRecipeName, type MotionRecipeOptions } from "./motion-recipes.js";
import { type MotionWarning } from "./motion-checks.js";
export { createMotionEngine, motionEngine, motionEngineSource, type MotionBell, type MotionBox, type MotionChannel, type MotionChannelName, type MotionEase, type MotionElement, type MotionEngine, type MotionKey, type MotionLayer, type MotionMove, type MotionPivot, type MotionRoot, type MotionSpec, type MotionState, type MotionWave, } from "./motion-engine.js";
export type { MotionSource, PreparedLayer } from "./motion-svg.js";
export { isMotionRecipe, MOTION_BEAT, MOTION_PIVOTS, MOTION_RECIPES, motionRecipe, pivotOn, type MotionRecipeName, type MotionRecipeOptions } from "./motion-recipes.js";
export { MOTION_MAX_SECONDS, motionWarnings, validateMotionSpec, type MotionWarning } from "./motion-checks.js";
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
