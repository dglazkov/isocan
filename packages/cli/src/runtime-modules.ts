import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as core from "@isocan/core";
import { manifestRecord, registerModule } from "@isocan/core";
import { readRuntimeModules } from "@isocan/server";
import type { CliHost, CliModule } from "./modulehost.ts";

/**
 * **Runtime modules, on the CLI** (`docs/projects/modules/design.md`, phase 3).
 *
 * Before the program parses argv, every module under `~/.isocan/modules/`
 * that the engines check admits has its manifest's record registered — so
 * its kinds are known to `add`, `ls --kind` and the mime table without any
 * of its code running — and, when it ships a `cli` half, that file is
 * imported and its default export's `register(host)` hangs its verbs on the
 * same program a build-time module's would. A module's code reaches the
 * platform through `globalThis.isocan` rather than through a bare import it
 * could not resolve from a directory outside the install: the build script
 * rewrites `@isocan/core` to that global, and this is where the global is
 * set.
 *
 * A module that will not load is a row with a reason in `isocan module ls`,
 * never a crash of every other verb.
 */
export interface LoadedRuntimeModule {
  name: string;
  version: string;
  guide: string | null;
  refused: string | null;
}

declare global {
  var isocan: { core: typeof core } | undefined;
}

export async function loadRuntimeModules(home: string, host: CliHost): Promise<LoadedRuntimeModule[]> {
  const loaded: LoadedRuntimeModule[] = [];
  for (const found of readRuntimeModules(home)) {
    const { manifest, dir } = found;
    const row = { name: manifest.name, version: manifest.version };
    if (found.refused) {
      loaded.push({ ...row, guide: null, refused: found.refused });
      continue;
    }
    registerModule(manifestRecord(manifest));
    let guide: string | null = null;
    if (manifest.guide) {
      try {
        guide = readFileSync(path.join(dir, manifest.guide), "utf8");
      } catch {
        guide = null;
      }
    }
    if (manifest.cli) {
      globalThis.isocan ??= { core };
      try {
        const mod = (await import(pathToFileURL(path.join(dir, manifest.cli)).href)) as { default?: Partial<CliModule> };
        const record = mod.default;
        record?.register?.(host);
        if (!guide && typeof record?.guide === "string") guide = record.guide;
      } catch (err) {
        loaded.push({ ...row, guide: null, refused: `its cli half would not load — ${(err as Error).message}` });
        continue;
      }
    }
    loaded.push({ ...row, guide, refused: null });
  }
  return loaded;
}
