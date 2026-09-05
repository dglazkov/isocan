import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import * as core from "@isocan/core";
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
 */
declare global {
  var isocan: { React: typeof React; jsxRuntime: typeof jsxRuntime; core: typeof core } | undefined;
}

export async function activateRuntimeModules(manifests: readonly ModuleManifest[]): Promise<void> {
  for (const m of manifests) registerModule(manifestRecord(m));
  const withWeb = manifests.filter((m) => m.web);
  if (withWeb.length === 0) return;
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
