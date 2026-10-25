/**
 * **Recipes: a good default with no model** (motion phase 0;
 * `docs/projects/motion/design.md` §3). Each is a function from the layers —
 * their named parts, sizes and ink — to a spec in the engine's vocabulary.
 * Phase 0 carried `assemble` and `idle`; phase 3 adds `reveal`, `orbit` and
 * `emphasis`. Every recipe plays clean under the principle checks
 * (`motion-checks.ts`): whatever turns or scales names its pivot, a follower
 * trails its leader by at least a beat, and idle motion stays under its
 * ceiling — `packages/core/test/motion.test.ts` holds each one to that.
 */
import type { MotionBox, MotionLayer, MotionPivot, MotionSpec } from "./motion-engine.js";
/** The recipes this build knows, in the order `--recipe` lists them. */
export declare const MOTION_RECIPES: readonly ["assemble", "reveal", "idle", "orbit", "emphasis"];
/** A recipe's name. */
export type MotionRecipeName = (typeof MOTION_RECIPES)[number];
/** Is this a recipe this build knows? */
export declare function isMotionRecipe(name: string): name is MotionRecipeName;
/**
 * **A beat**: how long a follower trails its leader, and the shortest gap
 * the follower check accepts. A tenth of a second reads as "after", not
 * "at the same time".
 */
export declare const MOTION_BEAT = 0.1;
/** The named pivots a recipe or an agent may ask for, on a target's box. */
export declare const MOTION_PIVOTS: readonly ["base", "center", "top", "left", "right"];
/** A named pivot on a box, in that box's own units. */
export declare function pivotOn(box: MotionBox, at: (typeof MOTION_PIVOTS)[number]): MotionPivot;
/** Options every recipe takes: a length to fit to, and whether it loops. */
export interface MotionRecipeOptions {
    seconds?: number;
    loop?: boolean;
}
/** What each recipe does, in a line — the words *Animate…* and `--help` show. */
export declare const MOTION_RECIPE_WORDS: Record<MotionRecipeName, string>;
/**
 * **A recipe's spec for these layers.** `seconds` stretches or squeezes the
 * recipe's own timing to fit (a loop's one cycle, 4 s unless said); `loop`
 * defaults to the recipe's nature — `idle` and `orbit` loop, the others play
 * once and hold.
 */
export declare function motionRecipe(name: MotionRecipeName, layers: readonly MotionLayer[], stage: {
    width: number;
    height: number;
}, options?: MotionRecipeOptions): MotionSpec;
