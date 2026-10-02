/**
 * **The fast path's thresholds, as data** (voice-agent phase 7,
 * `docs/projects/voice-agent/fast-path.md`, *The threshold is measured, never
 * guessed*).
 *
 * One entry per action that has EARNED one: the lowest p at which Jev's
 * answer agreed with the meant act at least 95% of the time on at least 30
 * commands, with the numbers that set it and where they came from. An action
 * that is not here stays with the model — `decide` escalates it — however
 * sure Jev sounds.
 *
 * Only `move` is here. Phase 6 measured `delete`, `shrink`, `select` and
 * `show` at 100% but on fewer than 30 proposals each, and a threshold read off
 * a dozen commands is a guess with a decimal point. `undo` has never been
 * measured at all, so a spoken "undo" goes to the model — which now retracts
 * (`WebHost.retract`) rather than refusing. Adding a line here is a
 * measurement first and an edit second: rerun
 * `packages/modules/talk/scripts/fast-path-eval.ts` (or a person's
 * `--record`) and copy what its report says, provenance and all.
 */
import type { FastAct, Thresholds } from "./fastpath.ts";

export interface MeasuredThreshold {
  /** Act when the least certain answer the act relies on is at least this. */
  p: number;
  /** Commands whose proposal cleared `p` when it was measured. */
  n: number;
  /** How many of those agreed with the meant act. */
  agreement: number;
  /** When it was measured. */
  date: string;
  /** What it was measured on. */
  source: string;
}

export const MEASURED: Partial<Record<FastAct, MeasuredThreshold>> = {
  move: {
    p: 0.63,
    n: 66,
    agreement: 63,
    date: "2026-09-30",
    source:
      "the scripted set (test/fixtures/fast-path-commands.json, 197 synthetic Acme commands) through the real Jev " +
      "(jev-1.13.0) on 2026-09-30, rerun for phase 7: move reaches 95% on 30 at p >= 0.63 (66 kept, 63 agreed, 95.5%). " +
      "Phase 6 (2026-09-23) read p >= 0.60 off its own run and did not keep n; on this rerun 0.60 kept 70 at 94.3%, " +
      "under the bar, so the stricter of the two measurements is the one that acts",
  },
};

/** The numbers `decide` reads: each measured action's `p`, nothing else. */
export const THRESHOLDS: Thresholds = Object.fromEntries(
  Object.entries(MEASURED).map(([act, m]) => [act, m!.p]),
) as Thresholds;
