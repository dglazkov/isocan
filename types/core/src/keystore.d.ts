import { type KeyEnv, type KeyProvider, type ResolvedKey, type ResolvedTextKey, type StoredKey } from "./keys.js";
/**
 * **`~/.isocan/keys.json` — model keys in one place on this machine** (keys
 * phase 1; `docs/projects/keys/design.md`). Node-only, a subpath of its own
 * (`@isocan/core/keystore`), never reachable from the web: it is the file
 * every spender on this machine reads through — the daemon's judge and text
 * model, the CLI's Jev and text generators, the voice harness — so each of
 * them answers "which key?" the same way.
 *
 * The rules, each the one `readVoiceKey` already had:
 *
 * - **0600, or not read at all.** A file whose mode is not 600 is refused in a
 *   sentence that says so — a key that leaked its own permissions is worth
 *   telling somebody about, and reading it anyway would hide the one fact
 *   worth knowing. Writes land 0600, atomically (a temp file in the same
 *   directory, then a rename), and tighten `~/.isocan` to 0700 on the way.
 * - **Env wins.** `resolveKey` asks the environment first (`envKeyFor`: the
 *   variables isocan already read), then the file — so CI and a hosted home,
 *   which have no file, are unchanged.
 * - **Read per call.** No cache: the file is a few hundred bytes, and a key
 *   set at noon is used at 12:01 with no restart.
 * - **Never shown.** Nothing here logs, and no error carries a key's value.
 */
/**
 * Where keys.json lives when no caller names a home: `ISOCAN_KEYS_HOME`, else
 * `ISOCAN_HOME`, else `~/.isocan` — `@isocan/server`'s `isocanHome()`, which
 * core cannot import, with one seam in front. `ISOCAN_KEYS_HOME` exists for
 * the suite (`test/setup.ts` points it at an empty directory), so an
 * in-process test that resolves a key never spends the developer's own; a
 * daemon and the voice harness always pass their home explicitly and are not
 * moved by it.
 */
export declare function defaultKeysHome(env?: KeyEnv): string;
/** Where a home keeps its model keys: keys.json, mode 0600. */
export declare function keysFile(home?: string): string;
/** Every stored key, by provider. */
export type KeyFile = Partial<Record<KeyProvider, StoredKey>>;
/** The file exists but is not 0600, so it was not read. */
export declare class KeyFileRefused extends Error {
    readonly file: string;
    readonly mode: number;
    constructor(file: string, mode: number);
}
/**
 * **The whole file: the keys, and whether their owner shares them** (keys
 * phase 3, owner-only spend). `share` is keys.json's top-level
 * `shareWithCollaborators` (`KEYS_SHARE_FIELD`): off — absent, or anything but
 * `true` — a stored key pays only for this machine's own person; on, for
 * anybody who may edit a canvas this machine holds. It lives beside the keys
 * because it is a fact about them, and every write keeps it.
 */
export interface KeyFileContents {
    keys: KeyFile;
    share: boolean;
    /**
     * keys.json's `giveToAgents` (`KEYS_AGENTS_FIELD`, keys phase 4): the rc
     * hands the stored keys to the agents it summons. Off unless turned on — a
     * harness handed an API key may bill it instead of the person's login.
     */
    agents: boolean;
}
/** The whole file, read now — `readKeysSync` with the sharing switch. Missing file: no keys, not shared. */
export declare function readKeyFileSync(home?: string): KeyFileContents;
/** `readKeyFileSync`, asynchronously. */
export declare function readKeyFile(home?: string): Promise<KeyFileContents>;
/** The stored keys, read now. Missing file: none. Loose mode: `KeyFileRefused`. */
export declare function readKeysSync(home?: string): KeyFile;
/** `readKeysSync`, asynchronously — what a server that must not block reads. */
export declare function readKeys(home?: string): Promise<KeyFile>;
/**
 * Store a key for a provider, replacing any before it. A file that is
 * refused for its mode is refused here too — a write must not quietly
 * launder a leaked file into a tidy one and hide that it leaked.
 */
export declare function writeKey(home: string, provider: KeyProvider, key: string, model?: string, now?: () => Date): Promise<string>;
/** Remove a provider's key. True when there was one. */
export declare function removeKey(home: string, provider: KeyProvider): Promise<boolean>;
/**
 * **Turn sharing on or off** (keys phase 3): whether this machine's stored keys
 * pay for collaborators on canvases it holds, or only for its own person. The
 * keys are kept as they are; a file refused for its mode is refused here too.
 * Returns the file written.
 */
export declare function setKeySharing(home: string, share: boolean): Promise<string>;
/**
 * **Turn on or off handing the stored keys to summoned agents** (keys phase
 * 4; opt-in). The keys and the sharing switch are kept as they are; a file
 * refused for its mode is refused here too. Returns the file written.
 */
export declare function setKeyAgents(home: string, agents: boolean): Promise<string>;
/** Where to look: the environment and the home. Both default to this process's. */
export interface ResolveOptions {
    env?: KeyEnv;
    home?: string;
}
/**
 * **The one resolver.** The environment's key for this provider if it sets
 * one, else the stored key, else nothing. Read now, every call. Throws
 * `KeyFileRefused` when it would have to read a file that is not 0600 — the
 * environment's key is still answered without touching the file.
 */
export declare function resolveKey(provider: KeyProvider, opts?: ResolveOptions): ResolvedKey | undefined;
/** `resolveKey`, asynchronously. */
export declare function resolveKeyAsync(provider: KeyProvider, opts?: ResolveOptions): Promise<ResolvedKey | undefined>;
/** The text model's key, provider and model — `chooseTextKey` over this machine's file. */
export declare function resolveTextKey(opts?: ResolveOptions): ResolvedTextKey | undefined;
/**
 * **The voice harness's old key file, moved in once.** Before keys.json the
 * harness kept Gemini's key in `voice/key.json`. On the first read after this
 * shipped, that key becomes keys.json's `gemini` entry (unless one is already
 * there, which wins) and the old file is REMOVED — a second copy of a secret
 * is a second thing to leak. An old file that is not 0600 is refused, not
 * migrated, in the same words; one that holds no key is left alone. True when
 * something was moved.
 */
export declare function migrateVoiceKey(home: string): Promise<boolean>;
/** What `checkKey` found: accepted, or the provider's reason — never the key. */
interface KeyCheck {
    ok: boolean;
    /** In words: "accepted", or the provider's status and message. */
    answer: string;
    status?: number;
}
/** Where each provider is asked, and how — one cheap, authenticated read that spends nothing. */
export declare const KEY_CHECK_URLS: Record<KeyProvider, string>;
/**
 * **Is this key any good — one cheap call, and the provider's answer.** The
 * key is scrubbed from every word returned (a provider that echoes the key in
 * its error does not get it printed). Typesafe has no free read, so the empty
 * question's refusal for its SHAPE is the yes; a 401 or 403 is the no.
 */
export declare function checkKey(provider: KeyProvider, key: string, fetchImpl?: typeof fetch): Promise<KeyCheck>;
export {};
