/**
 * **Model keys: which providers there are, and what each one is for** (keys
 * phase 1; `docs/projects/keys/design.md`).
 *
 * Pure, and a subpath of its own (`@isocan/core/keys`), never the barrel: the
 * settings area (phase 2) will read this registry from a lazy chunk, and the
 * barrel is the web's entry. The file that READS and WRITES
 * `~/.isocan/keys.json` is `keystore.ts` beside it, which is node-only; this
 * one is the vocabulary both halves and every client share — the provider
 * names, the environment variables that override the file, the text-model
 * choice, and the one way a key is ever shown (`…abcd`).
 */

/** The providers a machine can hold a key for. One entry each in `keys.json`. */
export const KEY_PROVIDERS = ["anthropic", "openai", "gemini", "typesafe"] as const;
/** A provider a model key belongs to. */
export type KeyProvider = (typeof KEY_PROVIDERS)[number];

/** Whether a string names a key provider this build knows. */
export function isKeyProvider(value: unknown): value is KeyProvider {
  return typeof value === "string" && (KEY_PROVIDERS as readonly string[]).includes(value);
}

/** What the registry says about one provider. */
interface KeyProviderInfo {
  id: KeyProvider;
  /** The provider's name as a person says it. */
  label: string;
  /** The environment variables that, when set, win over the stored key — in the words a person would set them. */
  env: string;
  /** What spends this key, in a person's words: what the settings area and `isocan keys ls` say under "used for". */
  usedFor: string[];
}

/**
 * **The registry.** Features, not variables: "used for: copy, wireframe names"
 * rather than `ISOCAN_TEXT_API_KEY`. Agents an rc summons read their own
 * harness's variables (`ANTHROPIC_*`, `OPENAI_*`, `GEMINI_API_KEY`, passed
 * through by prefix in `cli/src/acp.ts`); handing them the stored keys is
 * phase 4, so the agents line is not here yet.
 */
export const KEY_PROVIDER_INFO: Record<KeyProvider, KeyProviderInfo> = {
  anthropic: {
    id: "anthropic",
    label: "Anthropic (Claude)",
    env: "ISOCAN_TEXT_API_KEY (when it is an Anthropic key, or ISOCAN_TEXT_PROVIDER=anthropic)",
    usedFor: ["the text model: copy, wireframe names, content edits"],
  },
  openai: {
    id: "openai",
    label: "OpenAI",
    env: "ISOCAN_TEXT_API_KEY (when it is not an Anthropic key, or ISOCAN_TEXT_PROVIDER=openai)",
    usedFor: ["the text model, when no Anthropic key is set"],
  },
  gemini: {
    id: "gemini",
    label: "Google Gemini",
    env: "GEMINI_API_KEY",
    usedFor: ["voice: the voice harness's Live conversation and transcription"],
  },
  typesafe: {
    id: "typesafe",
    label: "Typesafe (Jev)",
    env: "TYPESAFE_API_KEY",
    usedFor: ["the judge: wireframe compose, style and edit answers"],
  },
};

/** The text-model vendors. The same two `jev.ts`'s generators speak to. */
type TextKeyProvider = "anthropic" | "openai";

/**
 * **Which provider a text key is for.** `ISOCAN_TEXT_PROVIDER` says so when set
 * (`anthropic`/`claude` or `openai`); otherwise the key's own shape decides —
 * an Anthropic key starts `sk-ant-` — and anything else is the OpenAI-shaped
 * endpoint. `jev.ts`'s `textProvider` is this rule with the environment's
 * defaults.
 */
export function textProviderFor(apiKey: string | undefined, named: string | undefined): TextKeyProvider {
  const said = named?.trim().toLowerCase();
  if (said === "anthropic" || said === "claude") return "anthropic";
  if (said === "openai") return "openai";
  return apiKey?.startsWith("sk-ant-") ? "anthropic" : "openai";
}

/** An environment as the resolver reads it: a plain record, so a test hands it one. */
export type KeyEnv = Record<string, string | undefined>;

const value = (env: KeyEnv, name: string): string | undefined => env[name]?.trim() || undefined;

/** A key the environment supplies, and the variable it came from. */
interface EnvKey {
  key: string;
  variable: string;
}

/**
 * **The environment's key for a provider, if it sets one** — the override
 * half of the resolver. Only the variables isocan already read: a person with
 * `ANTHROPIC_API_KEY` exported for some other tool does not suddenly have a
 * text model spending it. `ISOCAN_TEXT_API_KEY` counts for exactly one of
 * anthropic and openai, by `textProviderFor`.
 */
export function envKeyFor(provider: KeyProvider, env: KeyEnv): EnvKey | undefined {
  if (provider === "typesafe") {
    const key = value(env, "TYPESAFE_API_KEY");
    return key ? { key, variable: "TYPESAFE_API_KEY" } : undefined;
  }
  if (provider === "gemini") {
    const key = value(env, "GEMINI_API_KEY");
    return key ? { key, variable: "GEMINI_API_KEY" } : undefined;
  }
  const key = value(env, "ISOCAN_TEXT_API_KEY");
  if (!key) return undefined;
  return textProviderFor(key, value(env, "ISOCAN_TEXT_PROVIDER")) === provider ? { key, variable: "ISOCAN_TEXT_API_KEY" } : undefined;
}

/** One stored key, as `keys.json` holds it. */
export interface StoredKey {
  key: string;
  model?: string;
  /** ISO time it was set. */
  addedAt: string;
}

/** A resolved key: the value, where it came from, and the model it names if any. */
export interface ResolvedKey {
  key: string;
  source: "env" | "file";
  /** The variable, when `source` is env. */
  variable?: string;
  model?: string;
}

/** The key a text request spends, and which provider and model it goes to. */
export interface ResolvedTextKey extends ResolvedKey {
  provider: TextKeyProvider;
}

/**
 * **The text model's key — the rule, in one place.** With
 * `ISOCAN_TEXT_API_KEY` set, the environment decides everything, exactly as it
 * did before keys.json existed (provider from `ISOCAN_TEXT_PROVIDER` or the
 * key's shape; model from `ISOCAN_TEXT_MODEL`). Without it, the stored keys:
 * the provider `ISOCAN_TEXT_PROVIDER` names if that one is stored, else
 * Anthropic, else OpenAI. The model is `ISOCAN_TEXT_MODEL`, else the stored
 * entry's own `model`, else the generator's default.
 */
export function chooseTextKey(env: KeyEnv, stored: (provider: TextKeyProvider) => StoredKey | undefined): ResolvedTextKey | undefined {
  const envModel = value(env, "ISOCAN_TEXT_MODEL");
  const named = value(env, "ISOCAN_TEXT_PROVIDER");
  const fromEnv = value(env, "ISOCAN_TEXT_API_KEY");
  if (fromEnv) {
    return { key: fromEnv, source: "env", variable: "ISOCAN_TEXT_API_KEY", provider: textProviderFor(fromEnv, named), ...(envModel ? { model: envModel } : {}) };
  }
  const said = named ? textProviderFor(undefined, named) : undefined;
  const order: TextKeyProvider[] = said === "openai" ? ["openai", "anthropic"] : ["anthropic", "openai"];
  for (const provider of order) {
    const entry = stored(provider);
    if (!entry?.key) continue;
    const model = envModel ?? entry.model;
    return { key: entry.key, source: "file", provider, ...(model ? { model } : {}) };
  }
  return undefined;
}

/** **The only way a key is ever shown**: its last four characters, after an ellipsis. Short keys show nothing of themselves. */
export function lastFour(key: string): string {
  return key.length >= 12 ? `…${key.slice(-4)}` : "…";
}
