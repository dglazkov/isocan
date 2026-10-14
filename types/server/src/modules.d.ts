import { type ModuleManifest } from "../../core/src/index.js";
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
export declare const modulesDir: (home: string) => string;
export interface RuntimeModule {
    dir: string;
    manifest: ModuleManifest;
    /** Why this one is not loaded, or null when it is. */
    refused: string | null;
}
export declare function readRuntimeModules(home: string): RuntimeModule[];
/**
 * A file inside a loaded module's directory, or null — for anything outside
 * it, for a module that is refused, or for a path that walks up. Real paths
 * on both sides, so a symlink cannot reach past the directory.
 */
export declare function moduleFile(home: string, slug: string, relative: string): string | null;
/**
 * **A built-in module's asset, or null** (critique phase 4). A module built
 * into this copy (design-competition, critique) registers no base and is not
 * under `~/.isocan/modules/`, so its `assets/` were reachable from the
 * terminal (`packagePath("packages/modules", …)`, which `lensOf` reads) and
 * from nowhere a browser could ask. The same files, served the same way:
 * only a module this process registered, only under its `assets/`, real
 * paths on both sides.
 */
export declare function builtInAsset(slug: string, relative: string): string | null;
