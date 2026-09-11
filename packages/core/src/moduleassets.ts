import { moduleBase } from "./modules.ts";

/**
 * **What a module may ship that is not code** (proposed: `assets`, 11 Sep
 * 2026 — `docs/projects/design-competition/module-gaps.md` §1).
 *
 * Everybody who loads a module downloads what it shows, the way everybody on a
 * canvas downloads its ground forever, so an asset has a bound for the same
 * reason a ground does (`GROUND_MAX_BYTES`, 2 MB). A module's files are
 * smaller than a picture of a room: an avatar, a `DESIGN.md`, a stylesheet.
 * The bounds are refused at build (`scripts/module-build.mjs`) and at
 * `isocan module add`, before anybody has downloaded anything.
 */
export const ASSET_MAX_BYTES = 256 * 1024;
export const ASSETS_MAX_BYTES = 2 * 1024 * 1024;

/** Refusals for a manifest's asset list — empty when it fits. */
export function assetProblems(assets: readonly { path: string; size: number }[] | undefined): string[] {
  const problems: string[] = [];
  let total = 0;
  for (const a of assets ?? []) {
    total += a.size;
    if (!/^assets\/[^\0]+$/.test(a.path) || a.path.split("/").includes("..")) problems.push(`${a.path} is not inside assets/`);
    if (a.size > ASSET_MAX_BYTES) problems.push(`${a.path} is ${a.size} bytes, over the ${ASSET_MAX_BYTES}-byte bound for one asset`);
  }
  if (total > ASSETS_MAX_BYTES) problems.push(`assets total ${total} bytes, over the ${ASSETS_MAX_BYTES}-byte bound for a module`);
  return problems;
}

/**
 * A path a module named, resolved against where that module's files are — or
 * null when the module reaches its own files itself (every build-time module,
 * through `new URL("../assets/…", import.meta.url)`) and so has registered no
 * base. The one place a contribution's relative path meets a URL or a
 * directory, so the web and the CLI resolve it the same way.
 */
export function moduleAsset(moduleName: string, relative: string): string | null {
  const base = moduleBase(moduleName);
  if (!base) return null;
  const clean = relative.replace(/^\.?\//, "");
  if (clean.split("/").includes("..")) return null;
  return base + clean;
}
