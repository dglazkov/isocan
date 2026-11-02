/**
 * **The home's judgment route** — the one door through which a canvas asks a
 * typed judge a question without the key ever leaving the home
 * (`docs/projects/judge/design.md`, the seam; wireframes phase 5, its first
 * caller).
 *
 * A caller posts a question file in the judge's own request shape — one
 * `state`, named questions — with the canvas it is asking for; the home
 * checks the badge may edit that canvas, forwards the questions with its own
 * key, and returns the judge's answer shape unchanged. Nothing here says what
 * the questions are about: the route is vendor-neutral and carries no prompt
 * of its own, so judge phase 2 adopts it rather than building a second one.
 *
 * Both halves read this file: the server's route and every client that calls
 * it, so the path and the refusal codes are spelled once.
 */

// The path lives beside `DialogHost.judge` in modules.ts, so the web shell reads it without a chunk of its own.
export { JUDGMENT_ROUTE } from "./modules.ts";

/** A question file bigger than this is refused before anything is asked. */
export const JUDGMENT_MAX_BYTES = 64 * 1024;

/** How many judgments one badge may ask for per minute — a flow is ~25 calls. */
export const JUDGMENT_PER_MINUTE = 60;

/** The home holds no key: nothing can be asked here. */
export const JUDGMENT_UNAVAILABLE = "judgment-unavailable";
/** The question file is over `JUDGMENT_MAX_BYTES`. */
export const JUDGMENT_TOO_LARGE = "judgment-too-large";
/** This badge has asked `JUDGMENT_PER_MINUTE` times in the last minute. */
export const JUDGMENT_RATE_LIMITED = "judgment-rate-limited";
/** The body is not a question file. */
export const JUDGMENT_BAD_REQUEST = "judgment-bad-request";
/** The judge refused or could not be reached; `error` says which, in its words. */
export const JUDGMENT_UPSTREAM = "judgment-upstream";

/** What the route takes: a question file in the judge's request shape, and the canvas it is for. */
export interface JudgmentRequest {
  canvasId: string;
  /** The judge's model; the home's default when absent. */
  model?: string;
  state: unknown;
  questions: Record<string, unknown>;
}
