import { judgeModule } from "./record.ts";

/**
 * **Judge** (`docs/projects/judge/design.md`).
 *
 * A typed judge returns a decision and a probability and cannot cite, so it
 * may triage and never rule — and no phase may act on one before a phase has
 * reported its calibration. Phase 1 is the corpus that makes that possible:
 * a READER over what the wireframe flow already recorded (round 1's P(yes)
 * as `need`, who answered as `by`) and what the running person then did.
 * `corpus.ts` is the fold, `wire-format.ts` the stored format it reads.
 * Phase 2 is the reading (`reading.ts`): the reliability curve of the P
 * those rows recorded, written as a page by `scripts/calibrate.ts`.
 *
 * The record (`record.ts`) owns nothing: the reader writes nothing to any
 * canvas. Delete this directory and its two list entries and the feature
 * never existed — the removability test the design asked for.
 */
export { judgeModule };
export * from "./wire-format.ts";
export * from "./corpus.ts";
export * from "./reading.ts";

export default judgeModule;
