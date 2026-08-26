/**
 * The content origin's base URL, as this tab knows it — the app half of the
 * seam cut in stage 1 of `docs/projects/atlas/content-origin-plan.md`.
 *
 * Nothing sets it yet: stage 2 wires a boot-time fetch of `GET /api/serving`
 * (the daemon advertises only a listener it actually started) through
 * `adoptContentBase`. Until then — and forever on a home with no content
 * origin, and whenever the fetch fails — the answer is null, and null means
 * exactly today's behavior: frames on the app origin, `allow-scripts` alone.
 * The fallback IS the current behavior, which is what makes every stage of
 * the plan stable on both shapes.
 */

let base: string | null = null;

export function contentBase(): string | null {
  return base;
}

export function adoptContentBase(next: string | null): void {
  base = next;
}
