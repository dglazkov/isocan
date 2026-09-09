import type { ComponentType } from "react";
import {
  moduleSlug,
  registerModule,
  type InspectorFacts,
  type ModuleInspector,
  type ModuleDrop,
  type ModulePage,
  type OverlayFacts,
  type PageFacts,
  type RendererFacts,
  type UnderlayFacts,
  type WebModule,
} from "@isocan/core";
import { mindmapWeb } from "@isocan/mindmap/web";
import { mermaidWeb } from "@isocan/mermaid/web";
import { documentsWeb } from "@isocan/documents/web";
import { stickersWeb } from "@isocan/stickers/web";
import { useUiStore } from "./stores/uiStore.ts";
import { experimentOn } from "./lib/experiments.ts";

/**
 * **The modules this app carries** (`docs/projects/modules/design.md`).
 *
 * One list, and it is the whole coupling between the shell and a module: the
 * shell maps over it to fill its slots, and registers each entry's core
 * record so `isocan context`'s rows, the JSON Canvas edges, the kinds and
 * the slash commands agree with what is drawn. Remove a line here (and the
 * twin in `packages/cli/src/modules.ts`) and the module is gone from this
 * surface — its items stay, as files.
 *
 * Two ways in. **Build-time** entries are the literals below: this bundle is
 * made by CI, never where it is installed, so a module's web half compiles
 * in here. **Runtime** entries arrive through `addModule` from
 * `lib/runtimeModules.ts` — whatever the home advertises on `/api/serving`
 * and serves under `/modules/<slug>/` — after first paint, with a generation
 * bump so the slots that read this list draw them.
 */
export type ShellModule = WebModule<
  ComponentType<UnderlayFacts>,
  ComponentType<RendererFacts>,
  ComponentType<InspectorFacts>,
  ComponentType<PageFacts>,
  ComponentType<OverlayFacts>
>;

const LIST: ShellModule[] = [mindmapWeb, mermaidWeb, documentsWeb, stickersWeb as ShellModule];

/**
 * **Modules that are off until a person asks**, by slug (#156, 9 Sep 2026).
 *
 * The gate that lets an exploration reach `main` without reaching everybody.
 * A module named here is in the bundle, registered, and contributes nothing
 * to any slot until its experiment is switched on in Settings.
 *
 * It lives in the shell's list rather than in the module's own record on
 * purpose: whether something is finished is the app's judgement about its own
 * surface, not a claim a module gets to make about itself. The same module
 * loaded at runtime by a home that wants it is not an experiment — it is a
 * module that home installed.
 */
const BEHIND_EXPERIMENT: Record<string, string> = {
  stickers: "modules.stickers",
};

/**
 * The modules that are actually live for this person right now.
 *
 * Every slot accessor reads this rather than `LIST`, so switching an
 * experiment off takes the module out of every slot at once — and the items
 * it made stay on the canvas as files with a legible mime, which is #156's
 * removal story and the reason turning one off is safe.
 */
function live(): ShellModule[] {
  return LIST.filter((m) => {
    const gate = BEHIND_EXPERIMENT[moduleSlug(m.core.name)];
    return gate === undefined || experimentOn(gate);
  });
}

/**
 * The modules to draw right now — called, not read, because the answer
 * changes when a runtime module arrives or an experiment is switched on.
 *
 * It was a `const` array while the answer was fixed at boot. A getter would
 * have kept every call site identical and is exactly the kind of cleverness
 * that reads as a bug later: two call sites is a small enough price for the
 * parentheses that say "this is computed".
 */
export function modules(): readonly ShellModule[] {
  return live();
}

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
  for (const m of live()) {
    const hit = (m.renderers ?? []).find((r) => r.mimes.includes(mimeType));
    if (hit) return hit.component;
  }
  return null;
}

/** The inspectors that read items of this kind, in module order. */
export function moduleInspectorsFor(kind: string): ModuleInspector<ComponentType<InspectorFacts>>[] {
  return live().flatMap((m) => (m.inspectors ?? []).filter((i) => i.kinds.includes(kind)));
}

/**
 * The drop a module claims for a dragged mime, or null (#156).
 *
 * First match in module order, so two modules claiming one mime is settled by
 * the list rather than by whichever rendered last. Native OS file drops never
 * reach here — those are the shell's own gesture, with a hundred handlers'
 * worth of behaviour behind them.
 */
export function moduleDropFor(types: readonly string[]): { mimeType: string; run: ModuleDrop["run"] } | null {
  for (const m of live()) {
    for (const drop of m.drops ?? []) {
      const hit = drop.mimes.find((mime) => types.includes(mime));
      if (hit) return { mimeType: hit, run: drop.run };
    }
  }
  return null;
}

/** Every page a loaded module adds, in module order. */
export function modulePages(): ModulePage<ComponentType<PageFacts>>[] {
  return live().flatMap((m) => m.pages ?? []);
}

/** The page at a segment, or null: a segment nobody owns is a plain 404. */
export function modulePage(segment: string): ModulePage<ComponentType<PageFacts>> | null {
  return modulePages().find((p) => p.segment === segment) ?? null;
}
