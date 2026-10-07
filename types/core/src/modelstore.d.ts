import { type LocalModel } from "./local-judge.js";
/**
 * **`<home>/models/` — the local judge's model on this machine** (local-judge
 * phase 0). Node-only, a subpath of its own (`@isocan/core/modelstore`) so
 * nothing here reaches a browser: `isocan model fetch` writes through it and
 * the daemon's `GET /models/<name>` reads through it, so the two agree on
 * where a model lives without either spelling the path.
 *
 * The home is the caller's — the same one `keys.json` sits in (`ISOCAN_HOME`,
 * else `~/.isocan`); nothing here guesses it. Never in git, never in `dist`.
 *
 * **A fetch is all or nothing.** The bytes stream into a temp file in the
 * same directory while they are hashed; only a file of exactly the pinned
 * length AND the pinned SHA-256 is renamed into place. Anything else is
 * deleted and refused in words that give both hashes. Resuming is not
 * offered: a partial is never kept.
 */
/** Where a home keeps its models. */
export declare function modelsDir(home: string): string;
/** Where one model's file lives in a home. */
export declare function modelPath(home: string, model: LocalModel): string;
/** One manifest model, as `isocan model ls` shows it. */
interface ModelRow {
    name: string;
    file: string;
    /** On disk at the pinned size. The hash is checked on fetch, not on every `ls`. */
    present: boolean;
    /** Bytes on disk (0 when absent), and the pinned size. */
    bytes: number;
    expected: number;
    sha256: string;
    about: string;
    licence: string;
}
/** Every model the manifest knows, and whether this home has it. */
export declare function listModels(home: string): Promise<ModelRow[]>;
/** The model by name, or a refusal that names the ones there are. */
export declare function modelNamed(name: string): LocalModel;
/** How a fetch reaches the network, and who hears about its progress. */
interface FetchModelOptions {
    fetch?: typeof fetch;
    /** Called as bytes arrive: how many so far, of how many. */
    onProgress?: (received: number, total: number) => void;
}
/** A model in place: where, how big, its hash, and whether this call downloaded it. */
interface FetchedModel {
    path: string;
    bytes: number;
    sha256: string;
    /** False when the file was already there and verified, so nothing was downloaded. */
    downloaded: boolean;
    ms: number;
}
/**
 * **Download one manifest model into a home, verified, atomically.** A file
 * already in place at the pinned size is hashed; if it matches, nothing is
 * downloaded. If it does not, it is refused rather than replaced silently —
 * the person is told to remove it.
 */
export declare function fetchModel(home: string, name: string, opts?: FetchModelOptions): Promise<FetchedModel>;
/** `fetchModel` for a model already looked up — the manifest's, or a test's synthetic one. */
export declare function fetchModelFile(home: string, model: LocalModel, opts?: FetchModelOptions): Promise<FetchedModel>;
export {};
