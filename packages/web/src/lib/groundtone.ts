import { type CanvasTheme, THEMES, groundOf, themeOf } from "@isocan/core";

/**
 * **What colour the canvas is standing on** (8 Sep 2026).
 *
 * > "when the background is dark, the top fade should be dark, and when it's
 * > light it should be light."
 *
 * The top fade is a wash of the ground under the top controls, so the title,
 * the faces and Share read over a busy canvas. It was `var(--ground)` — the
 * APP's page ground, which is near-white in the light theme — and a canvas
 * standing on Space Galaxy is near-black whatever the app's theme is
 * (`.canvas-theme-galaxy` says so in as many words: *"Space is dark whatever
 * the app's theme is"*). So a person in light mode on a starfield got a white
 * bar fading into black, which is the one thing a fade is supposed to avoid.
 *
 * The same shape as `.context-menu` borrowing its ground from the canvas
 * behind it, arrived at from the other end: chrome that assumes the ground is
 * the app's, on a canvas whose ground is its own.
 *
 * ## Why a mapping and not a derivation
 *
 * The ground colours are already decided, in the stylesheet, by the rule that
 * paints each ground — `--theme-space`, `--theme-ocean`, `--theme-rock`. This
 * returns the same token rather than a second colour, so a ground and the
 * wash over it can never drift apart: change `--theme-ocean` and both move.
 *
 * The names are not derivable from each other (`galaxy` paints `--theme-space`,
 * `mountains` paints `--theme-rock`), so it is a real table — and a table that
 * is missing a row is a fade that silently falls back to the app's ground,
 * which is the bug this fixes. `groundtone.test.ts` requires a row for every
 * name in `THEMES`. It earned that keep within a day: farm and desert
 * landed on 8 Sep and the guard is what said this table had to grow.
 */
const TONE: Record<CanvasTheme, string> = {
  galaxy: "--theme-space",
  ocean: "--theme-ocean",
  mountains: "--theme-rock",
  farm: "--theme-farm",
  desert: "--theme-sand",
};

/**
 * The token naming the colour under a canvas's chrome, or `null` when the
 * canvas has no ground of its own and the app's `--ground` is the right
 * answer.
 *
 * A picture answers `--ground-under`: what is actually under the chrome there
 * is a photograph behind a 0.7 black scrim, which is dark but not black, and
 * no token can name one canvas's photograph. Erring to the backdrop the
 * picture is composited onto is both honest and on the correct side — a fade
 * slightly darker than the picture reads as the ground, one much lighter
 * reads as a bar.
 */
export function groundTone(canvas: { properties?: Record<string, string> } | null): string | null {
  if (canvas === null) return null;
  if (groundOf(canvas) !== null) return "--ground-under";
  const theme = themeOf(canvas);
  return theme === null ? null : (TONE[theme] ?? null);
}

/** Every ground this build can stand a canvas on, for the guard. */
export const TONED = THEMES;
