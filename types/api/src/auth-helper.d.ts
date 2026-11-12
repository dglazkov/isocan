/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
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
