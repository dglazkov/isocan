import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { normalizeHomeUrl } from "@isocan/core";
import { paths, type HomeAuthConfig } from "@isocan/server";

const DEFAULT_TTL_SECONDS = 300;
const HELPER_TIMEOUT_MS = 10_000;
const HEADER_TOKEN_RE = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
const CONTROL_CHAR_RE = /[\r\n\0]/;

interface CachedAuthEntry {
  headers: Record<string, string>;
  expiresAtMs: number;
}

const memoryCache = new Map<string, CachedAuthEntry>();
const inFlight = new Map<string, Promise<Record<string, string>>>();

/**
 * Deterministic SHA-256 key (`<sha256>.json` under `~/.isocan/auth-cache/`)
 * for a canonical `homeUrl` and `authHeaderCommand` argv array.
 */
export function authCacheKey(canonicalUrl: string, command: readonly string[]): string {
  return createHash("sha256")
    .update(JSON.stringify({ url: canonicalUrl, command }))
    .digest("hex");
}

/**
 * Parse stdout from `authHeaderCommand` — either header lines (`Header-Name: value`)
 * or JSON (`{"headers": {"Header-Name": "value"}, "expiresAt"?: "<ISO>"}`) —
 * rejecting any header name or value containing control characters (`[\r\n\0]`).
 */
export function parseAuthHelperOutput(stdout: string): {
  headers: Record<string, string>;
  expiresAtMs?: number;
} {
  if (stdout.includes("\0")) {
    throw new Error("authHeaderCommand output contains control characters");
  }
  const trimmed = stdout.trim();
  if (!trimmed) {
    throw new Error("authHeaderCommand returned empty output");
  }
  if (trimmed.startsWith("{")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new Error("authHeaderCommand returned malformed JSON");
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("authHeaderCommand JSON must be an object");
    }
    const obj = parsed as { headers?: unknown; expiresAt?: unknown };
    if (!obj.headers || typeof obj.headers !== "object" || Array.isArray(obj.headers)) {
      throw new Error("authHeaderCommand JSON must include a 'headers' object");
    }
    const headers: Record<string, string> = {};
    for (const [rawName, rawValue] of Object.entries(obj.headers as Record<string, unknown>)) {
      if (typeof rawValue !== "string") {
        throw new Error(`authHeaderCommand header "${rawName}" must be a string`);
      }
      if (CONTROL_CHAR_RE.test(rawName) || CONTROL_CHAR_RE.test(rawValue)) {
        throw new Error("authHeaderCommand header contains control characters");
      }
      const name = rawName.trim();
      const value = rawValue.trim();
      if (!name || !HEADER_TOKEN_RE.test(name) || !value) {
        throw new Error(`authHeaderCommand returned an invalid header "${rawName}"`);
      }
      headers[name] = value;
    }
    if (Object.keys(headers).length === 0) {
      throw new Error("authHeaderCommand returned no headers");
    }
    if (obj.expiresAt !== undefined) {
      if (typeof obj.expiresAt !== "string") {
        throw new Error("authHeaderCommand 'expiresAt' must be an ISO timestamp string");
      }
      const expiresAtMs = Date.parse(obj.expiresAt);
      if (!Number.isFinite(expiresAtMs)) {
        throw new Error("authHeaderCommand 'expiresAt' is not a valid ISO timestamp");
      }
      return { headers, expiresAtMs };
    }
    return { headers };
  }

  const headers: Record<string, string> = {};
  const lines = stdout.replace(/\r?\n$/, "").split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    if (CONTROL_CHAR_RE.test(line)) {
      throw new Error("authHeaderCommand header contains control characters");
    }
    const colon = line.indexOf(":");
    if (colon <= 0) {
      throw new Error("authHeaderCommand output must be 'Header-Name: value' or JSON");
    }
    const name = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    if (!name || !HEADER_TOKEN_RE.test(name) || !value) {
      throw new Error("authHeaderCommand returned an invalid header line");
    }
    headers[name] = value;
  }
  if (Object.keys(headers).length === 0) {
    throw new Error("authHeaderCommand returned no headers");
  }
  return { headers };
}

function execHelper(
  command: readonly string[],
  canonicalUrl: string,
  env: NodeJS.ProcessEnv,
): Promise<string> {
  const [bin, ...args] = command;
  if (!bin) throw new Error("authHeaderCommand cannot be empty");
  return new Promise<string>((resolve, reject) => {
    execFile(
      bin,
      args,
      {
        shell: false,
        timeout: HELPER_TIMEOUT_MS,
        maxBuffer: 1024 * 1024,
        env: { ...env, ISOCAN_TARGET_URL: canonicalUrl },
      },
      (err, stdout, stderr) => {
        if (err) {
          const detail = stderr?.trim() || err.message;
          reject(
            new Error(
              `authHeaderCommand "${bin}" failed for ${canonicalUrl}: ${detail}`,
            ),
          );
          return;
        }
        resolve(stdout);
      },
    );
  });
}

function validCachedHeaders(raw: unknown): Record<string, string> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v !== "string") return null;
    if (CONTROL_CHAR_RE.test(k) || CONTROL_CHAR_RE.test(v)) return null;
    const name = k.trim();
    const value = v.trim();
    if (!name || !HEADER_TOKEN_RE.test(name) || !value) return null;
    out[name] = value;
  }
  return Object.keys(out).length > 0 ? out : null;
}

async function readDiskCache(home: string, fileKey: string, now: number): Promise<CachedAuthEntry | null> {
  const file = path.join(paths.authCacheDir(home), `${fileKey}.json`);
  try {
    const raw = JSON.parse(await fs.readFile(file, "utf8")) as unknown;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const record = raw as { headers?: unknown; expiresAtMs?: unknown };
    if (typeof record.expiresAtMs !== "number" || !Number.isFinite(record.expiresAtMs)) return null;
    if (record.expiresAtMs <= now) return null;
    const headers = validCachedHeaders(record.headers);
    if (!headers) return null;
    return { headers, expiresAtMs: record.expiresAtMs };
  } catch {
    return null;
  }
}

async function writeDiskCache(home: string, fileKey: string, entry: CachedAuthEntry): Promise<void> {
  const dir = paths.authCacheDir(home);
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  await fs.chmod(dir, 0o700).catch(() => {});
  const file = path.join(dir, `${fileKey}.json`);
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await fs.writeFile(tmp, `${JSON.stringify(entry)}\n`, { mode: 0o600 });
  await fs.chmod(tmp, 0o600);
  await fs.rename(tmp, file);
}

/**
 * Resolve per-home proxy auth headers from memory cache, disk cache
 * (`~/.isocan/auth-cache/<sha256>.json`, `0600`), or by executing
 * `config.authHeaderCommand` (`execFile`, `shell: false`, 10s timeout) with
 * single-flight deduplication.
 */
export async function resolveAuthHeaders(
  base: string,
  home: string,
  config: HomeAuthConfig,
  options: { env?: NodeJS.ProcessEnv; refresh?: boolean } = {},
): Promise<Record<string, string>> {
  const command = config.authHeaderCommand;
  if (!command || command.length === 0) return {};
  const canonical = normalizeHomeUrl(base);
  const fileKey = authCacheKey(canonical, command);
  const memKey = `${path.resolve(home)}:${fileKey}`;
  const env = options.env ?? process.env;

  if (options.refresh) {
    memoryCache.delete(memKey);
    inFlight.delete(memKey);
    await fs.rm(path.join(paths.authCacheDir(home), `${fileKey}.json`), { force: true }).catch(() => {});
  } else {
    const now = Date.now();
    const mem = memoryCache.get(memKey);
    if (mem && mem.expiresAtMs > now) {
      return { ...mem.headers };
    }
    const disk = await readDiskCache(home, fileKey, now);
    if (disk) {
      memoryCache.set(memKey, disk);
      return { ...disk.headers };
    }
    const existing = inFlight.get(memKey);
    if (existing) return { ...(await existing) };
  }

  const run = (async (): Promise<Record<string, string>> => {
    const stdout = await execHelper(command, canonical, env);
    const parsed = parseAuthHelperOutput(stdout);
    const now = Date.now();
    const ttlMs = (config.ttlSeconds ?? DEFAULT_TTL_SECONDS) * 1000;
    const ttlExpiresMs = now + ttlMs;
    const expiresAtMs =
      parsed.expiresAtMs !== undefined ? Math.min(ttlExpiresMs, parsed.expiresAtMs) : ttlExpiresMs;
    if (expiresAtMs > now) {
      const entry: CachedAuthEntry = { headers: parsed.headers, expiresAtMs };
      memoryCache.set(memKey, entry);
      await writeDiskCache(home, fileKey, entry).catch(() => {});
    }
    return { ...parsed.headers };
  })();

  inFlight.set(memKey, run);
  try {
    return { ...(await run) };
  } finally {
    if (inFlight.get(memKey) === run) {
      inFlight.delete(memKey);
    }
  }
}

function mergeRequestHeaders(
  existing: RequestInit["headers"],
  helperHeaders: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (existing) {
    if (existing instanceof Headers) {
      existing.forEach((value, key) => {
        out[key] = value;
      });
    } else if (Array.isArray(existing)) {
      for (const [key, value] of existing) {
        if (key !== undefined && value !== undefined) out[key] = value;
      }
    } else {
      Object.assign(out, existing);
    }
  }
  for (const [key, value] of Object.entries(helperHeaders)) {
    for (const existingKey of Object.keys(out)) {
      if (existingKey.toLowerCase() === key.toLowerCase()) delete out[existingKey];
    }
    out[key] = value;
  }
  return out;
}

const isExpiredStatus = (status: number): boolean =>
  status === 401 || status === 302 || status === 303 || status === 307;

/**
 * Wrap `innerFetch` so outbound requests to `base` attach cached headers from
 * `config.authHeaderCommand`, use `redirect: "manual"`, and on `401`, `302`,
 * `303`, or `307` evict the cache, re-run the helper once (`refresh: true`),
 * and replay the request once.
 */
export function authHeaderFetch(
  base: string,
  home: string,
  config: HomeAuthConfig,
  innerFetch: typeof fetch,
  env: NodeJS.ProcessEnv = process.env,
): typeof fetch {
  if (!config.authHeaderCommand || config.authHeaderCommand.length === 0) {
    return innerFetch;
  }
  return async (input, init) => {
    const firstHeaders = await resolveAuthHeaders(base, home, config, { env });
    const firstInit: RequestInit = {
      ...init,
      redirect: "manual",
      headers: mergeRequestHeaders(init?.headers, firstHeaders),
    };
    const res = await innerFetch(input, firstInit);
    if (!isExpiredStatus(res.status)) return res;
    await res.body?.cancel().catch(() => {});
    const refreshedHeaders = await resolveAuthHeaders(base, home, config, {
      env,
      refresh: true,
    });
    const replayInit: RequestInit = {
      ...init,
      redirect: "manual",
      headers: mergeRequestHeaders(init?.headers, refreshedHeaders),
    };
    return innerFetch(input, replayInit);
  };
}
