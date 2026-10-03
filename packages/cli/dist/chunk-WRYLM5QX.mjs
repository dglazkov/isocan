import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  KEYS_SHARE_FIELD,
  chooseTextKey,
  envKeyFor,
  isKeyProvider
} from "./chunk-DSAQFWTN.mjs";

// packages/core/src/keystore.ts
import { promises as fs, readFileSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
function defaultKeysHome(env = process.env) {
  return env.ISOCAN_KEYS_HOME || env.ISOCAN_HOME || path.join(os.homedir(), ".isocan");
}
var KEYS_FILE_NAME = "keys.json";
function keysFile(home = defaultKeysHome()) {
  return path.join(home, KEYS_FILE_NAME);
}
var KeyFileRefused = class extends Error {
  constructor(file, mode) {
    super(`${file} is mode ${mode.toString(8)}, not 600 \u2014 refusing to read it (chmod 600 ${file}, or set the key again with \`isocan keys set\`)`);
    this.file = file;
    this.mode = mode;
    this.name = "KeyFileRefused";
  }
  file;
  mode;
};
var modeChecked = process.platform !== "win32";
function refuseLoose(file, mode) {
  if (modeChecked && (mode & 511) !== 384) throw new KeyFileRefused(file, mode & 511);
}
function parseAll(file, text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error(`${file} is not JSON \u2014 fix or remove it, then set the keys again with \`isocan keys set\``);
  }
  const out = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { keys: out, share: false };
  const share = raw[KEYS_SHARE_FIELD] === true;
  for (const [provider, entry] of Object.entries(raw)) {
    if (!isKeyProvider(provider) || !entry || typeof entry !== "object") continue;
    const { key, model, addedAt } = entry;
    if (typeof key !== "string" || !key.trim()) continue;
    out[provider] = {
      key: key.trim(),
      ...typeof model === "string" && model.trim() ? { model: model.trim() } : {},
      addedAt: typeof addedAt === "string" ? addedAt : ""
    };
  }
  return { keys: out, share };
}
function readKeyFileSync(home = defaultKeysHome()) {
  const file = keysFile(home);
  try {
    refuseLoose(file, statSync(file).mode);
    return parseAll(file, readFileSync(file, "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return { keys: {}, share: false };
    throw err;
  }
}
async function readKeyFile(home = defaultKeysHome()) {
  const file = keysFile(home);
  try {
    refuseLoose(file, (await fs.stat(file)).mode);
    return parseAll(file, await fs.readFile(file, "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return { keys: {}, share: false };
    throw err;
  }
}
function readKeysSync(home = defaultKeysHome()) {
  return readKeyFileSync(home).keys;
}
async function readKeys(home = defaultKeysHome()) {
  return (await readKeyFile(home)).keys;
}
async function writeAll(home, { keys, share }) {
  await fs.mkdir(home, { recursive: true, mode: 448 });
  if (modeChecked) await fs.chmod(home, 448);
  const file = keysFile(home);
  const tmp = path.join(home, `.${KEYS_FILE_NAME}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`);
  try {
    await fs.writeFile(tmp, `${JSON.stringify(share ? { [KEYS_SHARE_FIELD]: true, ...keys } : keys, null, 2)}
`, { mode: 384, flag: "wx" });
    if (modeChecked) await fs.chmod(tmp, 384);
    await fs.rename(tmp, file);
  } catch (err) {
    await fs.rm(tmp, { force: true }).catch(() => {
    });
    throw err;
  }
  return file;
}
async function writeKey(home, provider, key, model, now = () => /* @__PURE__ */ new Date()) {
  const trimmed = key.trim();
  if (!trimmed) throw new Error(`no key given for ${provider}`);
  const all = await readKeyFile(home);
  all.keys[provider] = { key: trimmed, ...model?.trim() ? { model: model.trim() } : {}, addedAt: now().toISOString() };
  return writeAll(home, all);
}
async function removeKey(home, provider) {
  const all = await readKeyFile(home);
  if (!all.keys[provider]) return false;
  delete all.keys[provider];
  await writeAll(home, all);
  return true;
}
async function setKeySharing(home, share) {
  const all = await readKeyFile(home);
  return writeAll(home, { keys: all.keys, share });
}
function fromFile(entry) {
  return entry ? { key: entry.key, source: "file", ...entry.model ? { model: entry.model } : {} } : void 0;
}
function resolveKey(provider, opts = {}) {
  const env = opts.env ?? process.env;
  const fromEnv = envKeyFor(provider, env);
  if (fromEnv) return { key: fromEnv.key, source: "env", variable: fromEnv.variable };
  return fromFile(readKeysSync(opts.home ?? defaultKeysHome(env))[provider]);
}
async function resolveKeyAsync(provider, opts = {}) {
  const env = opts.env ?? process.env;
  const fromEnv = envKeyFor(provider, env);
  if (fromEnv) return { key: fromEnv.key, source: "env", variable: fromEnv.variable };
  return fromFile((await readKeys(opts.home ?? defaultKeysHome(env)))[provider]);
}
function resolveTextKey(opts = {}) {
  const env = opts.env ?? process.env;
  if (env.ISOCAN_TEXT_API_KEY?.trim()) return chooseTextKey(env, () => void 0);
  const stored = readKeysSync(opts.home ?? defaultKeysHome(env));
  return chooseTextKey(env, (provider) => stored[provider]);
}
async function migrateVoiceKey(home) {
  const old = path.join(home, "voice", "key.json");
  let stat;
  try {
    stat = await fs.stat(old);
  } catch (err) {
    if (err.code === "ENOENT") return false;
    throw err;
  }
  if (modeChecked && (stat.mode & 511) !== 384) {
    throw new Error(`${old} is mode ${(stat.mode & 511).toString(8)}, not 600 \u2014 refusing to read it`);
  }
  let key;
  try {
    const parsed = JSON.parse(await fs.readFile(old, "utf8"));
    key = typeof parsed?.key === "string" && parsed.key.trim() ? parsed.key.trim() : void 0;
  } catch {
    key = void 0;
  }
  if (!key) return false;
  const all = await readKeyFile(home);
  let moved = false;
  if (!all.keys.gemini) {
    all.keys.gemini = { key, addedAt: stat.mtime.toISOString() };
    await writeAll(home, all);
    moved = true;
  }
  await fs.rm(old, { force: true });
  return moved;
}
var KEY_CHECK_URLS = {
  // The Models API: a list, no tokens (the `claude-api` skill's reference).
  anthropic: "https://api.anthropic.com/v1/models?limit=1",
  openai: "https://api.openai.com/v1/models",
  gemini: "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1",
  // Jev has no read: an empty question is refused for its shape (4xx) only
  // after the key is accepted, and a bad key is 401/403 — so this spends nothing.
  typesafe: "https://api.typesafe.ai/v1/systemone"
};
function requestFor(provider, key) {
  switch (provider) {
    case "anthropic":
      return { method: "GET", headers: { "x-api-key": key, "anthropic-version": "2023-06-01" } };
    case "openai":
      return { method: "GET", headers: { authorization: `Bearer ${key}` } };
    case "gemini":
      return { method: "GET", headers: { "x-goog-api-key": key } };
    case "typesafe":
      return { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: "{}" };
  }
}
function reasonOf(text) {
  try {
    const body = JSON.parse(text);
    const e = body.error;
    if (e && typeof e === "object" && typeof e.message === "string") return e.message;
    if (typeof e === "string") return e;
    if (typeof body.message === "string") return body.message;
    if (typeof body.detail === "string") return body.detail;
  } catch {
  }
  return text.trim().slice(0, 300);
}
async function checkKey(provider, key, fetchImpl = fetch) {
  const scrub = (text2) => text2.split(key).join("[key]");
  let res;
  try {
    res = await fetchImpl(KEY_CHECK_URLS[provider], requestFor(provider, key));
  } catch (err) {
    return { ok: false, answer: scrub(`could not reach ${provider}: ${err.message}`) };
  }
  const text = await res.text().catch(() => "");
  const accepted = res.ok || provider === "typesafe" && (res.status === 400 || res.status === 422);
  if (accepted) return { ok: true, answer: "accepted", status: res.status };
  const said = reasonOf(text);
  return { ok: false, answer: scrub(`${res.status}${said ? ` ${said}` : ""}`), status: res.status };
}

export {
  defaultKeysHome,
  keysFile,
  KeyFileRefused,
  readKeyFileSync,
  readKeyFile,
  readKeysSync,
  readKeys,
  writeKey,
  removeKey,
  setKeySharing,
  resolveKey,
  resolveKeyAsync,
  resolveTextKey,
  migrateVoiceKey,
  KEY_CHECK_URLS,
  checkKey
};
