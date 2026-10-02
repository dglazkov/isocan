import { promises as fs, readFileSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import {
  chooseTextKey,
  envKeyFor,
  isKeyProvider,
  type KeyEnv,
  type KeyProvider,
  type ResolvedKey,
  type ResolvedTextKey,
  type StoredKey,
} from "./keys.ts";

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
export function defaultKeysHome(env: KeyEnv = process.env): string {
  return env.ISOCAN_KEYS_HOME || env.ISOCAN_HOME || path.join(os.homedir(), ".isocan");
}

const KEYS_FILE_NAME = "keys.json";

/** Where a home keeps its model keys: keys.json, mode 0600. */
export function keysFile(home: string = defaultKeysHome()): string {
  return path.join(home, KEYS_FILE_NAME);
}

/** Every stored key, by provider. */
export type KeyFile = Partial<Record<KeyProvider, StoredKey>>;

/** The file exists but is not 0600, so it was not read. */
export class KeyFileRefused extends Error {
  constructor(readonly file: string, readonly mode: number) {
    super(`${file} is mode ${mode.toString(8)}, not 600 — refusing to read it (chmod 600 ${file}, or set the key again with \`isocan keys set\`)`);
    this.name = "KeyFileRefused";
  }
}

const modeChecked = process.platform !== "win32";

function refuseLoose(file: string, mode: number): void {
  if (modeChecked && (mode & 0o777) !== 0o600) throw new KeyFileRefused(file, mode & 0o777);
}

/** The parsed file, keeping only well-formed entries for known providers. A file that is not JSON says so without quoting it. */
function parse(file: string, text: string): KeyFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error(`${file} is not JSON — fix or remove it, then set the keys again with \`isocan keys set\``);
  }
  const out: KeyFile = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [provider, entry] of Object.entries(raw as Record<string, unknown>)) {
    if (!isKeyProvider(provider) || !entry || typeof entry !== "object") continue;
    const { key, model, addedAt } = entry as Record<string, unknown>;
    if (typeof key !== "string" || !key.trim()) continue;
    out[provider] = {
      key: key.trim(),
      ...(typeof model === "string" && model.trim() ? { model: model.trim() } : {}),
      addedAt: typeof addedAt === "string" ? addedAt : "",
    };
  }
  return out;
}

/** The stored keys, read now. Missing file: none. Loose mode: `KeyFileRefused`. */
export function readKeysSync(home: string = defaultKeysHome()): KeyFile {
  const file = keysFile(home);
  try {
    refuseLoose(file, statSync(file).mode);
    return parse(file, readFileSync(file, "utf8"));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw err;
  }
}

/** `readKeysSync`, asynchronously — what a server that must not block reads. */
export async function readKeys(home: string = defaultKeysHome()): Promise<KeyFile> {
  const file = keysFile(home);
  try {
    refuseLoose(file, (await fs.stat(file)).mode);
    return parse(file, await fs.readFile(file, "utf8"));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw err;
  }
}

/** Write the whole file: 0600, atomically, in a 0700 directory. */
async function writeAll(home: string, keys: KeyFile): Promise<string> {
  await fs.mkdir(home, { recursive: true, mode: 0o700 });
  if (modeChecked) await fs.chmod(home, 0o700);
  const file = keysFile(home);
  const tmp = path.join(home, `.${KEYS_FILE_NAME}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`);
  try {
    await fs.writeFile(tmp, `${JSON.stringify(keys, null, 2)}\n`, { mode: 0o600, flag: "wx" });
    if (modeChecked) await fs.chmod(tmp, 0o600);
    await fs.rename(tmp, file);
  } catch (err) {
    await fs.rm(tmp, { force: true }).catch(() => {});
    throw err;
  }
  return file;
}

/**
 * Store a key for a provider, replacing any before it. A file that is
 * refused for its mode is refused here too — a write must not quietly
 * launder a leaked file into a tidy one and hide that it leaked.
 */
export async function writeKey(home: string, provider: KeyProvider, key: string, model?: string, now: () => Date = () => new Date()): Promise<string> {
  const trimmed = key.trim();
  if (!trimmed) throw new Error(`no key given for ${provider}`);
  const keys = await readKeys(home);
  keys[provider] = { key: trimmed, ...(model?.trim() ? { model: model.trim() } : {}), addedAt: now().toISOString() };
  return writeAll(home, keys);
}

/** Remove a provider's key. True when there was one. */
export async function removeKey(home: string, provider: KeyProvider): Promise<boolean> {
  const keys = await readKeys(home);
  if (!keys[provider]) return false;
  delete keys[provider];
  await writeAll(home, keys);
  return true;
}

/** Where to look: the environment and the home. Both default to this process's. */
export interface ResolveOptions {
  env?: KeyEnv;
  home?: string;
}

function fromFile(entry: StoredKey | undefined): ResolvedKey | undefined {
  return entry ? { key: entry.key, source: "file", ...(entry.model ? { model: entry.model } : {}) } : undefined;
}

/**
 * **The one resolver.** The environment's key for this provider if it sets
 * one, else the stored key, else nothing. Read now, every call. Throws
 * `KeyFileRefused` when it would have to read a file that is not 0600 — the
 * environment's key is still answered without touching the file.
 */
export function resolveKey(provider: KeyProvider, opts: ResolveOptions = {}): ResolvedKey | undefined {
  const env = opts.env ?? process.env;
  const fromEnv = envKeyFor(provider, env);
  if (fromEnv) return { key: fromEnv.key, source: "env", variable: fromEnv.variable };
  return fromFile(readKeysSync(opts.home ?? defaultKeysHome(env))[provider]);
}

/** `resolveKey`, asynchronously. */
export async function resolveKeyAsync(provider: KeyProvider, opts: ResolveOptions = {}): Promise<ResolvedKey | undefined> {
  const env = opts.env ?? process.env;
  const fromEnv = envKeyFor(provider, env);
  if (fromEnv) return { key: fromEnv.key, source: "env", variable: fromEnv.variable };
  return fromFile((await readKeys(opts.home ?? defaultKeysHome(env)))[provider]);
}

/** The text model's key, provider and model — `chooseTextKey` over this machine's file. */
export function resolveTextKey(opts: ResolveOptions = {}): ResolvedTextKey | undefined {
  const env = opts.env ?? process.env;
  if (env.ISOCAN_TEXT_API_KEY?.trim()) return chooseTextKey(env, () => undefined);
  const stored = readKeysSync(opts.home ?? defaultKeysHome(env));
  return chooseTextKey(env, (provider) => stored[provider]);
}

/**
 * **The voice harness's old key file, moved in once.** Before keys.json the
 * harness kept Gemini's key in `voice/key.json`. On the first read after this
 * shipped, that key becomes keys.json's `gemini` entry (unless one is already
 * there, which wins) and the old file is REMOVED — a second copy of a secret
 * is a second thing to leak. An old file that is not 0600 is refused, not
 * migrated, in the same words; one that holds no key is left alone. True when
 * something was moved.
 */
export async function migrateVoiceKey(home: string): Promise<boolean> {
  const old = path.join(home, "voice", "key.json");
  let stat;
  try {
    stat = await fs.stat(old);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw err;
  }
  if (modeChecked && (stat.mode & 0o777) !== 0o600) {
    throw new Error(`${old} is mode ${(stat.mode & 0o777).toString(8)}, not 600 — refusing to read it`);
  }
  let key: string | undefined;
  try {
    const parsed = JSON.parse(await fs.readFile(old, "utf8")) as { key?: unknown };
    key = typeof parsed?.key === "string" && parsed.key.trim() ? parsed.key.trim() : undefined;
  } catch {
    key = undefined;
  }
  // Not a key at all: left where it is, for a person to look at.
  if (!key) return false;
  const keys = await readKeys(home);
  let moved = false;
  if (!keys.gemini) {
    keys.gemini = { key, addedAt: stat.mtime.toISOString() };
    await writeAll(home, keys);
    moved = true;
  }
  await fs.rm(old, { force: true });
  return moved;
}

/** What `checkKey` found: accepted, or the provider's reason — never the key. */
interface KeyCheck {
  ok: boolean;
  /** In words: "accepted", or the provider's status and message. */
  answer: string;
  status?: number;
}

/** Where each provider is asked, and how — one cheap, authenticated read that spends nothing. */
export const KEY_CHECK_URLS: Record<KeyProvider, string> = {
  // The Models API: a list, no tokens (the `claude-api` skill's reference).
  anthropic: "https://api.anthropic.com/v1/models?limit=1",
  openai: "https://api.openai.com/v1/models",
  gemini: "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1",
  // Jev has no read: an empty question is refused for its shape (4xx) only
  // after the key is accepted, and a bad key is 401/403 — so this spends nothing.
  typesafe: "https://api.typesafe.ai/v1/systemone",
};

function requestFor(provider: KeyProvider, key: string): RequestInit {
  switch (provider) {
    case "anthropic":
      return { method: "GET", headers: { "x-api-key": key, "anthropic-version": "2023-06-01" } };
    case "openai":
      return { method: "GET", headers: { authorization: `Bearer ${key}` } };
    case "gemini":
      // The header, not `?key=`: a key in a URL ends up in logs.
      return { method: "GET", headers: { "x-goog-api-key": key } };
    case "typesafe":
      return { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: "{}" };
  }
}

/** The provider's own message, from either common error shape (`{error:{message}}`, `{error:"…"}`, `{message}`), else the body's start. */
function reasonOf(text: string): string {
  try {
    const body = JSON.parse(text) as { error?: unknown; message?: unknown; detail?: unknown };
    const e = body.error;
    if (e && typeof e === "object" && typeof (e as { message?: unknown }).message === "string") return (e as { message: string }).message;
    if (typeof e === "string") return e;
    if (typeof body.message === "string") return body.message;
    if (typeof body.detail === "string") return body.detail;
  } catch {
    // not JSON: the text itself
  }
  return text.trim().slice(0, 300);
}

/**
 * **Is this key any good — one cheap call, and the provider's answer.** The
 * key is scrubbed from every word returned (a provider that echoes the key in
 * its error does not get it printed). Typesafe has no free read, so the empty
 * question's refusal for its SHAPE is the yes; a 401 or 403 is the no.
 */
export async function checkKey(provider: KeyProvider, key: string, fetchImpl: typeof fetch = fetch): Promise<KeyCheck> {
  const scrub = (text: string) => text.split(key).join("[key]");
  let res: Response;
  try {
    res = await fetchImpl(KEY_CHECK_URLS[provider], requestFor(provider, key));
  } catch (err) {
    return { ok: false, answer: scrub(`could not reach ${provider}: ${(err as Error).message}`) };
  }
  const text = await res.text().catch(() => "");
  const accepted = res.ok || (provider === "typesafe" && (res.status === 400 || res.status === 422));
  if (accepted) return { ok: true, answer: "accepted", status: res.status };
  const said = reasonOf(text);
  return { ok: false, answer: scrub(`${res.status}${said ? ` ${said}` : ""}`), status: res.status };
}
