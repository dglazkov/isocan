import { type HomeAuthConfig } from "../../server/src/index.js";
/**
 * Deterministic SHA-256 key (`<sha256>.json` under `~/.isocan/auth-cache/`)
 * for a canonical `homeUrl` and `authHeaderCommand` argv array.
 */
export declare function authCacheKey(canonicalUrl: string, command: readonly string[]): string;
/**
 * Parse stdout from `authHeaderCommand` — either header lines (`Header-Name: value`)
 * or JSON (`{"headers": {"Header-Name": "value"}, "expiresAt"?: "<ISO>"}`) —
 * rejecting any header name or value containing control characters (`[\r\n\0]`).
 */
export declare function parseAuthHelperOutput(stdout: string): {
    headers: Record<string, string>;
    expiresAtMs?: number;
};
/**
 * Resolve per-home proxy auth headers from memory cache, disk cache
 * (`~/.isocan/auth-cache/<sha256>.json`, `0600`), or by executing
 * `config.authHeaderCommand` (`execFile`, `shell: false`, 10s timeout) with
 * single-flight deduplication.
 */
export declare function resolveAuthHeaders(base: string, home: string, config: HomeAuthConfig, options?: {
    env?: NodeJS.ProcessEnv;
    refresh?: boolean;
}): Promise<Record<string, string>>;
/**
 * Wrap `innerFetch` so outbound requests to `base` attach cached headers from
 * `config.authHeaderCommand`, use `redirect: "manual"`, and on `401`, `302`,
 * `303`, or `307` evict the cache, re-run the helper once (`refresh: true`),
 * and replay the request once.
 */
export declare function authHeaderFetch(base: string, home: string, config: HomeAuthConfig, innerFetch: typeof fetch, env?: NodeJS.ProcessEnv): typeof fetch;
