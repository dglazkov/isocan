/**
 * **"No reading yet" is a third answer, and it is neither a number nor a
 * broken instrument.**
 *
 * Every goal's command prints one number, and everything that reads goals
 * (`ratchet.mjs`, `persona-run.mjs`, `canvas-board.mjs`) treats anything else
 * as a BROKEN INSTRUMENT, never as zero. That rule stays. But a goal measured
 * from a recorded reading (Semantic Zoom phase 5's `summary-unfaithful`, which
 * reads what a model-judged eval wrote) has an honest state before the first
 * run: nobody has taken it. Printing 0 would claim the summaries are faithful;
 * failing would redden every push and every nightly until somebody spends
 * money on a model, and a check that is red for a reason nobody can act on is
 * switched off within a week.
 *
 * So a measure that has no reading prints one line starting with
 * `no reading yet` on stdout and exits `NO_READING`. Both are required: an
 * instrument that merely crashes with status 3 is still broken. A reader shows
 * the line where the number would be, counts it as neither held nor missed,
 * and says so; it never fills the gap with a number.
 */
export const NO_READING = 3;
export const NO_READING_PREFIX = "no reading yet";

/** The line a goal's command printed when it had no reading, or null when the failure was something else. */
export function unreadOf(err) {
  if (err?.status !== NO_READING) return null;
  const out = String(err.stdout ?? "").trim();
  return out.startsWith(NO_READING_PREFIX) ? out.split("\n")[0] : null;
}
