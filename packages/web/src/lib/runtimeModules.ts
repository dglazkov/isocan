import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { manifestRecord, moduleWebPath, registerModule, type ModuleManifest } from "@isocan/core";
import { addModule, type ShellModule } from "../modules.ts";

/**
 * **Runtime modules, in the app** (`docs/projects/modules/design.md`, phase 3).
 *
 * The home lists what it has loaded on `/api/serving`, and the shell asks
 * that once at boot already (`contentBase.ts`); this is what it does with
 * the answer. Every manifest's record is registered first — kinds are known
 * before any code runs, so a file of a runtime kind is grouped and named
 * right even while its renderer is still downloading. Then each web half is
 * imported from `/modules/<slug>/…` and its default export handed to
 * `addModule`, which bumps the generation the slots read.
 *
 * **The host object, not an import map.** A module's code cannot import
 * `react` from a file the daemon serves out of `~/.isocan` — nothing there
 * resolves it, and the app's own chunks have hashed names an import map
 * would have to chase every build. So the build script rewrites a module's
 * `react`, `react/jsx-runtime`, `react-dom` and `@isocan/core` imports to
 * reads of `globalThis.isocan`, and this is where the global is set: the
 * same React instance the app renders with (one copy, so hooks and context
 * work), and the same core (one registry). Obsidian's shape, read from its
 * docs; their one rule carried over: never keep a reference to a view, the
 * factory may be called many times.
 *
 * ## The namespace is fetched, not imported
 *
 * `import * as core` here was **51.5% of what a first visit downloaded**. A
 * namespace import asks for every export, so Rollup cannot drop any of them,
 * and the whole of `@isocan/core` was pinned into the entry chunk — including
 * `recap.ts`, `evals.ts` and `deckexport.ts`, which nothing in this app calls
 * and which exist for the CLI.
 *
 * It was paid by everybody to support a feature almost nobody has: the line
 * below returns early when no manifest carries a web half, which is every
 * canvas with no runtime module on it. So the namespace is a dynamic import
 * INSIDE that guard — the modules that need the host object still get exactly
 * the same object, one copy, one registry, and the first visit stops paying
 * for it.
 *
 * Measured before and after; the number is in
 * `docs/research/2026-09-06-architecture-review.md`, whose conclusion this
 * corrects. That note said "splitting is spent" and named `ItemView`,
 * `CanvasViewport` and the stores as what remained — they are, together, under
 * two per cent of it.
 */
declare global {
  var isocan:
    | { React: typeof React; jsxRuntime: typeof jsxRuntime; core: typeof import("@isocan/core") }
    | undefined;
}

export async function activateRuntimeModules(manifests: readonly ModuleManifest[]): Promise<void> {
  for (const m of manifests) registerModule(manifestRecord(m));
  const withWeb = manifests.filter((m) => m.web);
  if (withWeb.length === 0) return;
  const core = await import("@isocan/core");
  globalThis.isocan ??= { React, jsxRuntime, core };
  for (const m of withWeb) {
    const url = moduleWebPath(m);
    if (!url) continue;
    try {
      const mod = (await import(/* @vite-ignore */ url)) as { default?: ShellModule };
      if (!mod.default?.core) throw new Error("its web half has no default export carrying a core record");
      addModule(mod.default);
    } catch (err) {
      // One module's failure is one module's failure. The canvas still
      // draws; its items of that kind read as files, with the mime.
      console.warn(`module ${m.name}: not loaded — ${(err as Error).message}`);
    }
  }
}
