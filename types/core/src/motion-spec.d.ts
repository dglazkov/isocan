/**
 * **The spec an agent writes** (motion phase 2; `docs/projects/motion/design.md`
 * §3). Words go to an agent, and the agent writes a SPEC — never code: what
 * moves, how, on what pivot, after whom. `isocan motion new <svg…> --spec`
 * and `isocan motion edit <motion> --spec` read one with `motionSpecFrom`.
 *
 * **The authored form leaves out what the drawings already say.** The stage
 * and the layers — their ids, boxes, viewBoxes and named parts — are measured
 * from the selected SVGs by the builder, so an agent writes only `seconds`,
 * `loop` and `moves`. A pivot is said by NAME (`"base"`, `"center"`, `"top"`,
 * `"left"`, `"right"`), resolved here against the target's own box, or as a
 * point `{ "x": …, "y": … }` in the target's own SVG units. Named pivots are
 * what the principle checks read and what survive a refresh: a part redrawn
 * taller still turns on its base.
 *
 * `authoredSpec` is the way back — a motion's spec as an agent would write it
 * — which `isocan motion spec` prints for an agent to edit, and which
 * *Refresh from sources* re-resolves against the sources' newer drawings.
 */
import type { MotionChannel, MotionChannelName, MotionLayer, MotionSpec } from "./motion-engine.js";
import { MOTION_PIVOTS } from "./motion-recipes.js";
/** A named pivot: `base`, `center`, `top`, `left` or `right`. */
export type MotionPivotName = (typeof MOTION_PIVOTS)[number];
/** One move as an agent writes it: the pivot by name or as a point. */
export interface MotionAuthoredMove {
    target: string;
    pivot?: MotionPivotName | {
        x: number;
        y: number;
    };
    follows?: string;
    channels: Partial<Record<MotionChannelName, MotionChannel>>;
}
/** **The spec as an agent writes it**: a length, whether it loops, and what moves. */
export interface MotionAuthoredSpec {
    seconds: number;
    loop?: boolean;
    moves: MotionAuthoredMove[];
}
/** Every target a spec may name for these layers: each layer, and each of its named `<g id>` parts. */
export declare function motionTargets(layers: readonly Pick<MotionLayer, "id" | "parts">[]): string[];
/**
 * **Read an authored spec against the layers it will move**, or refuse it in
 * words — the first problem, naming the targets there are when a name is
 * wrong. `stage` and `layers` in the JSON are ignored rather than trusted:
 * they are always the drawings' own. The result has passed
 * `validateMotionSpec`; its warnings are the caller's to say.
 */
export declare function motionSpecFrom(authored: unknown, layers: readonly MotionLayer[], stage: {
    width: number;
    height: number;
}): MotionSpec;
/**
 * **A motion's spec as an agent writes it** — named pivots by name, a point
 * as a point, and no stage or layers. What `isocan motion spec` prints, and
 * what `motionSpecFrom` reads back into the same spec for the same drawings.
 */
export declare function authoredSpec(spec: Pick<MotionSpec, "seconds" | "loop" | "moves">): MotionAuthoredSpec;
/**
 * **The spec a motion document carries**, read from its text without running
 * it — the `<script type="application/json" id="motion-spec">` the builder
 * writes. Null when the document is not a motion's.
 */
export declare function motionDocumentSpec(html: string): MotionSpec | null;
