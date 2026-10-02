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
export declare const KEY_PROVIDERS: readonly ["anthropic", "openai", "gemini", "typesafe"];
/** A provider a model key belongs to. */
export type KeyProvider = (typeof KEY_PROVIDERS)[number];
/** Whether a string names a key provider this build knows. */
export declare function isKeyProvider(value: unknown): value is KeyProvider;
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
export declare const KEY_PROVIDER_INFO: Record<KeyProvider, KeyProviderInfo>;
/** The text-model vendors. The same two `jev.ts`'s generators speak to. */
type TextKeyProvider = "anthropic" | "openai";
/**
 * **Which provider a text key is for.** `ISOCAN_TEXT_PROVIDER` says so when set
 * (`anthropic`/`claude` or `openai`); otherwise the key's own shape decides —
 * an Anthropic key starts `sk-ant-` — and anything else is the OpenAI-shaped
 * endpoint. `jev.ts`'s `textProvider` is this rule with the environment's
 * defaults.
 */
export declare function textProviderFor(apiKey: string | undefined, named: string | undefined): TextKeyProvider;
/** An environment as the resolver reads it: a plain record, so a test hands it one. */
export type KeyEnv = Record<string, string | undefined>;
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
export declare function envKeyFor(provider: KeyProvider, env: KeyEnv): EnvKey | undefined;
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
export declare function chooseTextKey(env: KeyEnv, stored: (provider: TextKeyProvider) => StoredKey | undefined): ResolvedTextKey | undefined;
/** **The only way a key is ever shown**: its last four characters, after an ellipsis. Short keys show nothing of themselves. */
export declare function lastFour(key: string): string;
export {};
