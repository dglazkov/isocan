import type { ComponentType } from "react";
import { registerModule, type RendererFacts, type UnderlayFacts, type WebModule } from "@isocan/core";
import { mindmapWeb } from "@isocan/mindmap/web";
import { mermaidWeb } from "@isocan/mermaid/web";
import { useUiStore } from "./stores/uiStore.ts";

/**
 * **The modules this app carries** (`docs/projects/modules/design.md`).
 *
 * One list, and it is the whole coupling between the shell and a module: the
 * shell maps over it to fill its slots, and registers each entry's core
 * record so `isocan context`'s rows, the JSON Canvas edges and the kinds
 * agree with what is drawn. Remove a line here (and the twin in
 * `packages/cli/src/modules.ts`) and the module is gone from this surface —
 * its items stay, as files.
 *
 * Two ways in. **Build-time** entries are the literals below: this bundle is
 * made by CI, never where it is installed, so a module's web half compiles
 * in here. **Runtime** entries arrive through `addModule` from
 * `lib/runtimeModules.ts` — whatever the home advertises on `/api/serving`
 * and serves under `/modules/<slug>/` — after first paint, with a generation
 * bump so the slots that read this list draw them.
 */
export type ShellModule = WebModule<ComponentType<UnderlayFacts>, ComponentType<RendererFacts>>;

const LIST: ShellModule[] = [mindmapWeb, mermaidWeb];

/** Read at render time: the same array, so a runtime module shows up in
 *  every slot the moment it is added. */
export const MODULES: readonly ShellModule[] = LIST;

for (const m of LIST) registerModule(m.core);

/** A runtime module, once its web half has been imported. Idempotent by
 *  name; a build-time module of the same name wins, because it is the one
 *  this bundle was tested with. */
export function addModule(record: ShellModule): boolean {
  if (LIST.some((m) => m.core.name === record.core.name)) return false;
  LIST.push(record);
  registerModule(record.core);
  useUiStore.getState().bumpModules();
  return true;
}

/** The renderer a loaded module claims for a mime, ahead of the built-in chain. */
export function moduleRendererFor(mimeType: string): ComponentType<RendererFacts> | null {
  for (const m of LIST) {
    const hit = (m.renderers ?? []).find((r) => r.mimes.includes(mimeType));
    if (hit) return hit.component;
  }
  return null;
}
