import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { chooseTextKey, envKeyFor, KEY_PROVIDER_INFO, KEY_PROVIDERS, KEYS_SHARE_FIELD, lastFour, ownerOnlySentence, textProviderFor } from "../src/keys.ts";
import {
  checkKey,
  defaultKeysHome,
  KEY_CHECK_URLS,
  KeyFileRefused,
  keysFile,
  migrateVoiceKey,
  readKeyFile,
  readKeys,
  readKeysSync,
  removeKey,
  setKeySharing,
  resolveKey,
  resolveKeyAsync,
  resolveTextKey,
  writeKey,
} from "../src/keystore.ts";

/**
 * **keys.json — the store's rules** (keys phase 1). Modes, refusal, atomic
 * writes, env precedence, the text-model rule, the voice key's migration, and
 * the key check's scrubbing. Fixtures are synthetic: made-up keys, a temp home.
 */

const ANTHROPIC = "sk-ant-acme_STORED_DO_NOT_PRINT_0000aaaa";
const OPENAI = "sk-acme_OPENAI_DO_NOT_PRINT_0000bbbb";
const GEMINI = "AIza-acme_GEMINI_DO_NOT_PRINT_0000cccc";
const TYPESAFE = "ts-acme_JEV_DO_NOT_PRINT_0000dddd";
const NO_ENV = {};

let home: string;
beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-keystore-"));
});
afterEach(async () => {
  await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

const mode = async (p: string) => (await fs.stat(p)).mode & 0o777;

describe("the registry", () => {
  it("names four providers, each with what uses it", () => {
    expect([...KEY_PROVIDERS]).toEqual(["anthropic", "openai", "gemini", "typesafe"]);
    for (const p of KEY_PROVIDERS) expect(KEY_PROVIDER_INFO[p].usedFor.length).toBeGreaterThan(0);
  });

  it("shows only the last four characters, and nothing of a short key", () => {
    expect(lastFour(ANTHROPIC)).toBe("…aaaa");
    expect(lastFour("short")).toBe("…");
  });
});

describe("the file", () => {
  it("writes 0600 in a 0700 home, atomically — no temp file left beside it", async () => {
    await fs.chmod(home, 0o755);
    const file = await writeKey(home, "anthropic", ANTHROPIC);
    expect(file).toBe(keysFile(home));
    expect(await mode(file)).toBe(0o600);
    expect(await mode(home)).toBe(0o700);
    expect(await fs.readdir(home)).toEqual(["keys.json"]);
    await writeKey(home, "gemini", GEMINI);
    expect(await fs.readdir(home)).toEqual(["keys.json"]);
    const stored = readKeysSync(home);
    expect(stored.anthropic?.key).toBe(ANTHROPIC);
    expect(stored.gemini?.key).toBe(GEMINI);
    expect(Date.parse(stored.anthropic!.addedAt)).not.toBeNaN();
  });

  it("refuses a file that is not 0600, in a sentence that names the mode — and does not write over it", async () => {
    const file = await writeKey(home, "anthropic", ANTHROPIC);
    await fs.chmod(file, 0o644);
    expect(() => readKeysSync(home)).toThrow(KeyFileRefused);
    expect(() => readKeysSync(home)).toThrow(/mode 644, not 600/);
    await expect(readKeys(home)).rejects.toThrow(/not 600/);
    await expect(writeKey(home, "openai", OPENAI)).rejects.toThrow(/not 600/);
    expect(() => resolveKey("anthropic", { env: NO_ENV, home })).toThrow(/not 600/);
    // The refusal never carries the value.
    try {
      readKeysSync(home);
    } catch (err) {
      expect(String((err as Error).message)).not.toContain(ANTHROPIC);
    }
  });

  it("removes one provider and keeps the rest", async () => {
    await writeKey(home, "anthropic", ANTHROPIC);
    await writeKey(home, "typesafe", TYPESAFE);
    expect(await removeKey(home, "anthropic")).toBe(true);
    expect(await removeKey(home, "anthropic")).toBe(false);
    expect(Object.keys(readKeysSync(home))).toEqual(["typesafe"]);
    expect(await mode(keysFile(home))).toBe(0o600);
  });

  it("has a default home: ISOCAN_KEYS_HOME, else ISOCAN_HOME, else ~/.isocan", () => {
    expect(defaultKeysHome({ ISOCAN_KEYS_HOME: "/k", ISOCAN_HOME: "/h" })).toBe("/k");
    expect(defaultKeysHome({ ISOCAN_HOME: "/h" })).toBe("/h");
    expect(defaultKeysHome({})).toBe(path.join(os.homedir(), ".isocan"));
  });
});

describe("the sharing switch (owner-only spend, keys phase 3)", () => {
  it("is off when absent, and every write keeps it where it was", async () => {
    await writeKey(home, "anthropic", ANTHROPIC);
    expect((await readKeyFile(home)).share).toBe(false);
    await setKeySharing(home, true);
    const raw = JSON.parse(await fs.readFile(keysFile(home), "utf8")) as Record<string, unknown>;
    expect(raw[KEYS_SHARE_FIELD]).toBe(true);
    expect(((await fs.stat(keysFile(home))).mode & 0o777)).toBe(0o600);
    // A key set, and a key removed, keep the switch; the switch keeps the keys.
    await writeKey(home, "typesafe", TYPESAFE);
    await removeKey(home, "typesafe");
    expect(await readKeyFile(home)).toMatchObject({ share: true, keys: { anthropic: { key: ANTHROPIC } } });
    expect(Object.keys(readKeysSync(home))).toEqual(["anthropic"]);
    await setKeySharing(home, false);
    expect(JSON.parse(await fs.readFile(keysFile(home), "utf8"))).not.toHaveProperty(KEYS_SHARE_FIELD);
  });

  it("only `true` turns it on", async () => {
    await fs.writeFile(keysFile(home), JSON.stringify({ [KEYS_SHARE_FIELD]: "yes" }), { mode: 0o600 });
    expect((await readKeyFile(home)).share).toBe(false);
  });

  it("refuses a collaborator in words that name the owner", () => {
    expect(ownerOnlySentence("Priya")).toBe("Priya's keys pay only for Priya here — ask them to turn on sharing in Model keys, or use your own");
    expect(ownerOnlySentence(null)).toMatch(/has not said who that is/);
  });
});

describe("the resolver: env first, then the file, read per call", () => {
  it("answers the stored key, and a new one on the next call — no cache", async () => {
    expect(resolveKey("typesafe", { env: NO_ENV, home })).toBeUndefined();
    await writeKey(home, "typesafe", TYPESAFE);
    expect(resolveKey("typesafe", { env: NO_ENV, home })).toEqual({ key: TYPESAFE, source: "file" });
    await writeKey(home, "typesafe", `${TYPESAFE}-rotated`);
    expect(resolveKey("typesafe", { env: NO_ENV, home })?.key).toBe(`${TYPESAFE}-rotated`);
    expect((await resolveKeyAsync("typesafe", { env: NO_ENV, home }))?.key).toBe(`${TYPESAFE}-rotated`);
  });

  it("lets the environment win, by the variables isocan already reads", async () => {
    await writeKey(home, "typesafe", TYPESAFE);
    await writeKey(home, "gemini", GEMINI);
    expect(resolveKey("typesafe", { env: { TYPESAFE_API_KEY: "env-jev" }, home })).toEqual({ key: "env-jev", source: "env", variable: "TYPESAFE_API_KEY" });
    expect(resolveKey("gemini", { env: { GEMINI_API_KEY: "env-gem" }, home })?.source).toBe("env");
    // An ANTHROPIC_API_KEY exported for some other tool is NOT the text model's.
    expect(envKeyFor("anthropic", { ANTHROPIC_API_KEY: "sk-ant-elsewhere" })).toBeUndefined();
    // ISOCAN_TEXT_API_KEY counts for exactly one of the two text providers.
    expect(envKeyFor("anthropic", { ISOCAN_TEXT_API_KEY: "sk-ant-x" })?.variable).toBe("ISOCAN_TEXT_API_KEY");
    expect(envKeyFor("openai", { ISOCAN_TEXT_API_KEY: "sk-ant-x" })).toBeUndefined();
    expect(envKeyFor("openai", { ISOCAN_TEXT_API_KEY: "sk-ant-x", ISOCAN_TEXT_PROVIDER: "openai" })?.key).toBe("sk-ant-x");
  });

  it("answers the environment's key without reading a refused file", async () => {
    const file = await writeKey(home, "typesafe", TYPESAFE);
    await fs.chmod(file, 0o644);
    expect(resolveKey("typesafe", { env: { TYPESAFE_API_KEY: "env-jev" }, home })?.key).toBe("env-jev");
  });
});

describe("the text model's key", () => {
  it("is the environment's whole setup when ISOCAN_TEXT_API_KEY is set", async () => {
    await writeKey(home, "anthropic", ANTHROPIC);
    expect(resolveTextKey({ env: { ISOCAN_TEXT_API_KEY: "sk-plain", ISOCAN_TEXT_MODEL: "gpt-x" }, home })).toEqual({
      key: "sk-plain", source: "env", variable: "ISOCAN_TEXT_API_KEY", provider: "openai", model: "gpt-x",
    });
  });

  it("is the stored Anthropic key, else the stored OpenAI key — and ISOCAN_TEXT_PROVIDER may prefer OpenAI", async () => {
    expect(resolveTextKey({ env: NO_ENV, home })).toBeUndefined();
    await writeKey(home, "openai", OPENAI, "gpt-acme");
    expect(resolveTextKey({ env: NO_ENV, home })).toEqual({ key: OPENAI, source: "file", provider: "openai", model: "gpt-acme" });
    await writeKey(home, "anthropic", ANTHROPIC);
    expect(resolveTextKey({ env: NO_ENV, home })).toMatchObject({ key: ANTHROPIC, provider: "anthropic" });
    expect(resolveTextKey({ env: { ISOCAN_TEXT_PROVIDER: "openai" }, home })).toMatchObject({ key: OPENAI, provider: "openai" });
    expect(resolveTextKey({ env: { ISOCAN_TEXT_MODEL: "claude-acme" }, home })?.model).toBe("claude-acme");
  });

  it("is spelled once: chooseTextKey and textProviderFor", () => {
    expect(textProviderFor("sk-ant-1", undefined)).toBe("anthropic");
    expect(textProviderFor("sk-1", "claude")).toBe("anthropic");
    expect(textProviderFor("sk-ant-1", "openai")).toBe("openai");
    expect(chooseTextKey({}, () => undefined)).toBeUndefined();
  });
});

describe("the voice key moves in once", () => {
  const oldFile = () => path.join(home, "voice", "key.json");
  const writeOld = async (body: unknown, fileMode = 0o600) => {
    await fs.mkdir(path.join(home, "voice"), { recursive: true });
    await fs.writeFile(oldFile(), JSON.stringify(body), { mode: fileMode });
    await fs.chmod(oldFile(), fileMode);
  };

  it("becomes keys.json's gemini entry, and the old file is removed", async () => {
    await writeOld({ provider: "gemini", key: GEMINI });
    expect(await migrateVoiceKey(home)).toBe(true);
    expect(readKeysSync(home).gemini?.key).toBe(GEMINI);
    await expect(fs.stat(oldFile())).rejects.toMatchObject({ code: "ENOENT" });
    expect(await migrateVoiceKey(home)).toBe(false);
  });

  it("does not replace a gemini key already stored — the stored one wins, and the old copy still goes", async () => {
    await writeKey(home, "gemini", "AIza-already-here-0000");
    await writeOld({ provider: "gemini", key: GEMINI });
    expect(await migrateVoiceKey(home)).toBe(false);
    expect(readKeysSync(home).gemini?.key).toBe("AIza-already-here-0000");
    await expect(fs.stat(oldFile())).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("refuses an old file that leaked its permissions, and leaves one with no key alone", async () => {
    await writeOld({ provider: "gemini", key: GEMINI }, 0o644);
    await expect(migrateVoiceKey(home)).rejects.toThrow(/not 600/);
    await fs.rm(oldFile());
    await writeOld({ nothing: true });
    expect(await migrateVoiceKey(home)).toBe(false);
    expect((await fs.stat(oldFile())).isFile()).toBe(true);
  });
});

describe("checkKey: one cheap call, and the provider's reason without the key", () => {
  const answering = (status: number, body: string, seen: Array<{ url: string; init: RequestInit }> = []) =>
    (async (url: string, init: RequestInit) => {
      seen.push({ url, init });
      return new Response(body, { status });
    }) as unknown as typeof fetch;

  it("asks Anthropic's Models API with the key as x-api-key, and spends nothing", async () => {
    const seen: Array<{ url: string; init: RequestInit }> = [];
    expect(await checkKey("anthropic", ANTHROPIC, answering(200, '{"data":[]}', seen))).toEqual({ ok: true, answer: "accepted", status: 200 });
    expect(seen[0]!.url).toBe(KEY_CHECK_URLS.anthropic);
    expect(seen[0]!.init.method).toBe("GET");
    const headers = new Headers(seen[0]!.init.headers);
    expect(headers.get("x-api-key")).toBe(ANTHROPIC);
    expect(headers.get("anthropic-version")).toBe("2023-06-01");
  });

  it("says the provider's reason, with the key scrubbed even when the provider echoes it", async () => {
    const said = await checkKey("openai", OPENAI, answering(401, JSON.stringify({ error: { message: `Incorrect API key provided: ${OPENAI}` } })));
    expect(said.ok).toBe(false);
    expect(said.answer).toBe("401 Incorrect API key provided: [key]");
    expect(JSON.stringify(said)).not.toContain(OPENAI);
  });

  it("puts Gemini's key in a header, not the URL", async () => {
    const seen: Array<{ url: string; init: RequestInit }> = [];
    await checkKey("gemini", GEMINI, answering(200, "{}", seen));
    expect(seen[0]!.url).not.toContain(GEMINI);
    expect(new Headers(seen[0]!.init.headers).get("x-goog-api-key")).toBe(GEMINI);
  });

  it("reads Jev's refusal of an empty question as the key accepted, and a 401 as refused", async () => {
    expect((await checkKey("typesafe", TYPESAFE, answering(422, '{"detail":"state is required"}'))).ok).toBe(true);
    expect(await checkKey("typesafe", TYPESAFE, answering(401, '{"error":"invalid token"}'))).toMatchObject({ ok: false, answer: "401 invalid token" });
  });

  it("says an unreachable provider is unreachable, without the key", async () => {
    const down = (async () => {
      throw new Error(`connect ECONNREFUSED (${TYPESAFE})`);
    }) as unknown as typeof fetch;
    const said = await checkKey("typesafe", TYPESAFE, down);
    expect(said.ok).toBe(false);
    expect(said.answer).not.toContain(TYPESAFE);
  });
});

describe("jev's no-judge refusal is the judgment route's", () => {
  // `jev.ts` spells it rather than importing `judgment.ts` (which would pull
  // half the barrel into the lazy jev chunk; `test/cli-bundle.test.ts`). This
  // holds the two spellings together.
  it("recognises JUDGMENT_UNAVAILABLE", async () => {
    const { isNoJudge } = await import("../src/jev.ts");
    const { JUDGMENT_UNAVAILABLE } = await import("../src/judgment.ts");
    expect(isNoJudge({ code: JUDGMENT_UNAVAILABLE })).toBe(true);
    expect(isNoJudge({ code: "judgment-upstream" })).toBe(false);
  });
});
