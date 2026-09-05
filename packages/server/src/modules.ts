import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { type ModuleManifest, enginesSatisfied, moduleSlug } from "@isocan/core";

/**
 * **Runtime modules on this machine** (`docs/projects/modules/design.md`,
 * phase 3). `~/.isocan/modules/<name>/` holds a prebuilt module: its
 * `manifest.json`, the web half the daemon serves under `/modules/<name>/`,
 * the CLI half the CLI imports, its guide. Read per request rather than at
 * boot, so `isocan module add` needs no restart — the same rule the Drive
 * token follows — and cheap enough for that: a directory listing and a few
 * small JSON files.
 *
 * A module the engines check refuses is LISTED with its refusal and served
 * nothing; a directory with no readable manifest is skipped, not guessed at.
 */
export const modulesDir = (home: string) => path.join(home, "modules");

export interface RuntimeModule {
  dir: string;
  manifest: ModuleManifest;
  /** Why this one is not loaded, or null when it is. */
  refused: string | null;
}

export function readRuntimeModules(home: string): RuntimeModule[] {
  const root = modulesDir(home);
  if (!existsSync(root)) return [];
  const found: RuntimeModule[] = [];
  for (const entry of readdirSync(root).sort()) {
    const dir = path.join(root, entry);
    const file = path.join(dir, "manifest.json");
    if (!existsSync(file)) continue;
    let manifest: ModuleManifest;
    try {
      manifest = JSON.parse(readFileSync(file, "utf8")) as ModuleManifest;
    } catch {
      continue;
    }
    if (typeof manifest.name !== "string" || manifest.name === "") continue;
    const engines = enginesSatisfied(manifest.engines);
    found.push({ dir, manifest, refused: engines.ok ? null : engines.why });
  }
  return found;
}


/**
 * A file inside a loaded module's directory, or null — for anything outside
 * it, for a module that is refused, or for a path that walks up. Real paths
 * on both sides, so a symlink cannot reach past the directory.
 */
export function moduleFile(home: string, slug: string, relative: string): string | null {
  const found = readRuntimeModules(home).find((m) => moduleSlug(m.manifest.name) === slug);
  if (!found || found.refused) return null;
  const root = realpathSync(found.dir);
  const target = path.resolve(root, relative);
  if (!target.startsWith(root + path.sep)) return null;
  if (!existsSync(target)) return null;
  const real = realpathSync(target);
  return real.startsWith(root + path.sep) ? real : null;
}
