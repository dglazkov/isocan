import type { ComponentType } from "react";
import { registerModule, type RendererFacts, type UnderlayFacts, type WebModule } from "@isocan/core";
import { mindmapWeb } from "@isocan/mindmap/web";
import { mermaidWeb } from "@isocan/mermaid/web";

/**
 * **The modules this build of the app carries** (`docs/projects/modules/design.md`).
 *
 * One list, and it is the whole coupling between the shell and a module: the
 * shell maps over it to fill its slots, and registers each entry's core
 * record so `isocan context`'s rows, the JSON Canvas edges and the kinds
 * agree with what is drawn. Remove a line here (and the twin in
 * `packages/cli/src/modules.ts`) and the module is gone from this surface —
 * its items stay, as files.
 *
 * Build-time on purpose: this bundle is made by CI, never where it is
 * installed, so a module's web half compiles in here. Runtime loading for
 * self-hosted homes is phase 3 and adds to this list rather than replacing it.
 */
export type ShellModule = WebModule<ComponentType<UnderlayFacts>, ComponentType<RendererFacts>>;

export const MODULES: readonly ShellModule[] = [mindmapWeb, mermaidWeb];

for (const m of MODULES) registerModule(m.core);

/** The renderer a loaded module claims for a mime, ahead of the built-in chain. */
export function moduleRendererFor(mimeType: string): ComponentType<RendererFacts> | null {
  for (const m of MODULES) {
    const hit = (m.renderers ?? []).find((r) => r.mimes.includes(mimeType));
    if (hit) return hit.component;
  }
  return null;
}
