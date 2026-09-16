import { Suspense, createElement, lazy, type ComponentType, type ReactNode } from "react";
import {
  moduleSlug,
  registerModule,
  type DialogFacts,
  type InspectorFacts,
  type ModuleInspector,
  type ModuleDialog,
  type ModuleDrop,
  type ModulePage,
  type OverlayFacts,
  type PageFacts,
  type RendererFacts,
  type UnderlayFacts,
  type WebModule,
  type WorkspaceFacts,
  type ModuleWorkspace,
  type Canvas,
  type CanvasContents,
} from "@isocan/core";
import { mindmapWeb } from "@isocan/mindmap/web";
import { mermaidWeb } from "@isocan/mermaid/web";
import { documentsWeb } from "@isocan/documents/web";
import { sandboxWeb } from "@isocan/sandbox/web";
import { competitionActivation } from "@isocan/design-competition/activation";
import { anatomyActivation } from "@isocan/anatomy/activation";
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
  ComponentType<OverlayFacts>,
  ComponentType<DialogFacts>,
  ComponentType<WorkspaceFacts<ReactNode>>
>;

const LIST: ShellModule[] = [mindmapWeb, mermaidWeb, documentsWeb, sandboxWeb];

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
  talk: "modules.talk",
};

/**
 * **An experiment's module is fetched, not bundled** (9 Sep 2026).
 *
 * It was a build-time import in `LIST`, gated at render — which gated the
 * DRAWING and not the download: measured, stickers put 6,227 bytes into the
 * entry chunk for everybody, including the people who never turn it on. That
 * is not the bargain an experiment makes. "Merged but off" has to mean off.
 *
 * So it arrives the way a runtime module does — after first paint, through
 * `addModule`, only when asked for. The CLI half stays a build-time import,
 * because the terminal has no first paint and no byte budget.
 */
const EXPERIMENT_HALVES: Record<string, () => Promise<{ default: ShellModule }>> = {
  "modules.stickers": () => import("@isocan/stickers/web") as Promise<{ default: ShellModule }>,
  "modules.talk": () => import("@isocan/talk/web") as Promise<{ default: ShellModule }>,
};

/**
 * Lightweight slots load their module only when a picker or card is rendered.
 *
 * **Underlays and workspaces joined on 13 Sep, for anatomy.** An underlay
 * differs from every other slot here: it is asked to draw on EVERY canvas, so
 * a `lazy()` underlay would download the module everywhere and defeat the
 * point. The activation therefore supplies a predicate — `needed(canvas)`, a
 * scan of items the shell already holds — and the module is fetched only where
 * that says yes. A workspace is the opposite and needs no predicate: it is
 * reachable only at its own `x/<segment>` address, so its component is lazy
 * and its descriptor (the launcher row, the CLI equivalent, `projectEntry`)
 * is what stays eager.
 */
function deferredModule(activation: { core: ShellModule["core"]; actions?: ShellModule["actions"]; dialogs?: Omit<ModuleDialog<ComponentType<DialogFacts>>, "component">[]; renderers?: { mimes: string[] }[]; underlays?: { needed: (canvas: UnderlayFacts["canvas"]) => boolean }[]; workspaces?: Omit<ModuleWorkspace<ComponentType<WorkspaceFacts<ReactNode>>>, "component">[] }, load: () => Promise<{ default: ShellModule }>): ShellModule {
  let pending: Promise<ShellModule> | undefined;
  const ensure = () => pending ??= load().then(({ default: full }) => {
    const index = LIST.findIndex((record) => record.core.name === full.core.name);
    if (index >= 0) LIST[index] = full;
    else LIST.push(full);
    registerModule(full.core);
    useUiStore.getState().bumpModules();
    return full;
  }).catch((error) => { pending = undefined; throw error; });
  /* The underlay the registry holds is this, not the module's: a predicate and
     a Suspense boundary. It returns null on a canvas the predicate rejects,
     which is most canvases, and only there does `ensure()` ever run. */
  const deferredUnderlay = (index: number, needed: (canvas: UnderlayFacts["canvas"]) => boolean) => {
    const Real = lazy(async () => {
      const full = await ensure();
      return { default: full.underlays![index]! };
    });
    /* `createElement` rather than JSX: this file is `.ts`, and every import of
       it names that extension. A component is worth less than the rename. */
    return function DeferredUnderlay(facts: UnderlayFacts) {
      if (!needed(facts.canvas)) return null;
      return createElement(Suspense, { fallback: null }, createElement(Real, facts));
    };
  };
  return {
    core: activation.core, ...(activation.actions ? { actions: activation.actions } : {}),
    ...(activation.dialogs ? { dialogs: activation.dialogs.map((dialog) => ({ ...dialog, component: lazy(async () => {
      const full = await ensure();
      return { default: full.dialogs!.find((entry) => entry.id === dialog.id)!.component };
    }) })) } : {}),
    ...(activation.renderers ? { renderers: activation.renderers.map((renderer) => ({ ...renderer, component: lazy(async () => {
      const full = await ensure();
      return { default: full.renderers!.find((entry) => entry.mimes.some((mime) => renderer.mimes.includes(mime)))!.component };
    }) })) } : {}),
    ...(activation.underlays ? { underlays: activation.underlays.map((one, index) => deferredUnderlay(index, one.needed)) } : {}),
    ...(activation.workspaces ? { workspaces: activation.workspaces.map((workspace) => ({ ...workspace, component: lazy(async () => {
      const full = await ensure();
      return { default: full.workspaces!.find((entry) => entry.segment === workspace.segment)!.component };
    }) })) } : {}),
  };
}

LIST.push(deferredModule(competitionActivation, () => import("@isocan/design-competition/web") as Promise<{ default: ShellModule }>));
LIST.push(deferredModule(anatomyActivation, () => import("@isocan/anatomy/web") as Promise<{ default: ShellModule }>));

const fetched = new Set<string>();

/** Import the web half of every experiment that is on and has not arrived. */
export async function loadExperiments(): Promise<void> {
  for (const [id, load] of Object.entries(EXPERIMENT_HALVES)) {
    if (fetched.has(id) || !experimentOn(id)) continue;
    fetched.add(id);
    try {
      addModule((await load()).default);
    } catch {
      // A chunk that will not load is a switch that appears to do nothing,
      // which is bad — and an app that will not start is worse.
      fetched.delete(id);
    }
  }
}

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

/** Core's registry changed without a web half arriving — a data-only
 *  module's contributions, read from its manifest — so the slots that read
 *  contributions draw again. */
export function noteRegistryChanged(): void {
  useUiStore.getState().bumpModules();
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

/**
 * The dialog an `opens` names, or null (proposed: `dialogs`). Ids are unique
 * within a module and a guard holds them unique across the build, so the
 * first match in module order is the only match.
 */
export function moduleDialog(id: string): ModuleDialog<ComponentType<DialogFacts>> | null {
  for (const m of live()) {
    const hit = (m.dialogs ?? []).find((d) => d.id === id);
    if (hit) return hit;
  }
  return null;
}

/** A workspace uses the page address vocabulary but retains a native viewport. */
export function moduleWorkspace(segment: string): ModuleWorkspace<ComponentType<WorkspaceFacts<ReactNode>>> | null {
  return live().flatMap((m) => m.workspaces ?? []).find((w) => w.segment === segment) ?? null;
}

/** Both addressable module surfaces belong in the same launcher. */
export function moduleViews(): Array<{ segment: string; label: string; hint?: string }> {
  return [...modulePages(), ...live().flatMap((m) => m.workspaces ?? [])];
}

/** Project metadata decides which module doors this canvas should offer. */
export function moduleProjectViews(project: Canvas, canvas: CanvasContents) {
  return live().flatMap((m) => (m.workspaces ?? []).flatMap((workspace) => {
    const entry = workspace.projectEntry?.({ project, canvas });
    return entry ? [{ ...entry, segment: workspace.segment }] : [];
  }));
}
