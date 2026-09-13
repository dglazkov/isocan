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
export declare const ASSET_MAX_BYTES: number;
/** And all of a module's files together. */
export declare const ASSETS_MAX_BYTES: number;
/** Refusals for a manifest's asset list — empty when it fits. */
export declare function assetProblems(assets: readonly {
    path: string;
    size: number;
}[] | undefined): string[];
/**
 * A path a module named, resolved against where that module's files are — or
 * null when the module reaches its own files itself (every build-time module,
 * through `new URL("../assets/…", import.meta.url)`) and so has registered no
 * base. The one place a contribution's relative path meets a URL or a
 * directory, so the web and the CLI resolve it the same way.
 */
export declare function moduleAsset(moduleName: string, relative: string): string | null;
