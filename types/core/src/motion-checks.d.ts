/**
 * **The engine's principles as checks, not prose** (motion phase 0;
 * `docs/projects/motion/design.md` §1).
 *
 * Two kinds of answer. A spec that cannot be played honestly — a rotation
 * with no pivot, a target that is not there, a number that is not one — is
 * REFUSED by `validateMotionSpec`, in words. A spec that plays but breaks a
 * principle is played and WARNED about by `motionWarnings`: a part turning
 * on its own centre without saying so, a follower that does not trail its
 * leader by a beat, idle motion past its ceiling, a jump between two frames,
 * a loop whose end is not its start. The builder returns the warnings and
 * the CLI prints them; a warning is advice to whoever wrote the spec, and a
 * person may mean exactly what it flags.
 */
import { type MotionSpec } from "./motion-engine.js";
/** One broken principle, named by `code`, about one target, in a sentence. */
export interface MotionWarning {
    code: "pivot-centre" | "follower-lag" | "idle-ceiling" | "teleport" | "loop-seam";
    target: string;
    message: string;
}
/** The longest motion a spec may be, matching the movie cap (design §6). */
export declare const MOTION_MAX_SECONDS = 60;
/**
 * **Refuse a spec that cannot be played honestly**, in words. Throws on the
 * first problem; returns nothing when the spec is playable.
 */
export declare function validateMotionSpec(spec: MotionSpec): void;
/**
 * **The principles, checked.** Assumes a spec `validateMotionSpec` accepted;
 * returns every warning, in the order of the moves.
 */
export declare function motionWarnings(spec: MotionSpec): MotionWarning[];
