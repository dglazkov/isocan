import { getServing } from "./api.ts";
import { activateRuntimeModules } from "./runtimeModules.ts";

/**
 * The content origin's base URL, as this tab knows it — the app half of
 * stages 1–2 of `docs/projects/atlas/content-origin-plan.md`.
 *
 * `loadContentBase` asks `GET /api/serving` once, at boot, beside the color
 * and name loads — and the daemon advertises only a listener it actually
 * started. On a home with no content origin, and whenever the fetch fails
 * (a hosted home, an older daemon, a tab with no badge yet), the answer is
 * null, and null means exactly today's behavior: frames on the app origin,
 * `allow-scripts` alone. The fallback IS the current behavior, which is what
 * makes every stage of the plan stable on both shapes.
 *
 * A plain module variable rather than a store: the fetch resolves in the
 * time it takes the app to open a socket and load a snapshot, so every frame
 * that can render an item was mounted after the answer arrived. A frame from
 * the losing side of that race renders on the app origin — today's frame —
 * and corrects itself on its next mount.
 */

let base: string | null = null;

export function contentBase(): string | null {
  return base;
}

export function adoptContentBase(next: string | null): void {
  base = next;
}

export async function loadContentBase(): Promise<void> {
  try {
    const serving = await getServing();
    adoptContentBase(serving.contentBase ?? null);
    // The same answer names the home's runtime modules (modules phase 3);
    // one fetch, two facts, and the modules arrive after first paint.
    void activateRuntimeModules(serving.modules ?? []);
  } catch {
    adoptContentBase(null);
  }
}
