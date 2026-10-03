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
 * through by prefix in `cli/src/acp.ts`); since phase 4, when the owner
 * turns it on (`isocan keys agents on`), a stored key the rc's own
 * environment lacks is handed to them under that variable (`agentKeyEnv`).
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
/**
 * **The machine-local key routes** (keys phase 2): `GET` lists the rows,
 * `PUT /api/keys/:provider` takes `{ key }`, `DELETE` removes one, and
 * `POST /api/keys/:provider/test` makes one cheap call. Served only by a
 * daemon on this machine, to this machine (`key-routes.ts`); a hosted home
 * answers 404 with `KEYS_NOT_HERE`.
 */
export declare const KEYS_ROUTE = "/api/keys";
/** The refusal code a home that is not this machine's answers the key routes with. */
export declare const KEYS_NOT_HERE = "keys-not-here";
/**
 * One provider's row — what `isocan keys ls` prints and `GET /api/keys`
 * returns, from one function so the two cannot disagree. Never a value: the
 * last four, when it was added, and whether the environment overrides it.
 */
export interface KeyRow {
    provider: KeyProvider;
    label: string;
    stored: boolean;
    lastFour: string | null;
    addedAt: string | null;
    model: string | null;
    /** The environment variable that overrides the file, when one is set. */
    env: {
        variable: string;
        lastFour: string;
    } | null;
    /** Which key a spender uses now: the environment's, the file's, or none. */
    inUse: "env" | "file" | null;
    usedFor: string[];
}
/** Every provider's row, from the stored keys and an environment. Pure. */
export declare function keyRows(stored: Partial<Record<KeyProvider, StoredKey>>, env: KeyEnv): KeyRow[];
/**
 * **Owner-only spend** (keys phase 3; `docs/projects/keys/design.md`). A key
 * this machine's person stored in keys.json pays only for that person —
 * any badge whose claims resolve, through `actor.join`, to the
 * `identity.json` beside it — unless they turn sharing on. A key from the
 * environment is the innkeeper's (a hosted home, CI) and keeps serving every
 * editor, as before. This is keys.json's top-level field for the switch.
 */
export declare const KEYS_SHARE_FIELD = "shareWithCollaborators";
/** `PUT` `{ share: boolean }` here turns sharing on or off — `isocan keys share on|off`, in the settings area. */
export declare const KEYS_SHARING_ROUTE = "/api/keys/sharing";
/**
 * **Give the stored keys to summoned agents** (keys phase 4) — keys.json's
 * top-level switch, OFF unless the owner turns it on. Opt-in because a
 * harness handed `ANTHROPIC_API_KEY` (Claude Code), `OPENAI_API_KEY` (Codex)
 * or `GEMINI_API_KEY` (Gemini) may stop using the person's own login and bill
 * the key per call instead; that must never happen without being asked for.
 */
export declare const KEYS_AGENTS_FIELD = "giveToAgents";
/** `PUT` `{ agents: boolean }` here turns it on or off — `isocan keys agents on|off`, in the settings area. */
export declare const KEYS_AGENTS_ROUTE = "/api/keys/agents";
/** `/api/text` refused a collaborator: the key it would spend is the owner's, and sharing is off. */
export declare const TEXT_OWNER_ONLY = "text-owner-only";
/** `/api/judgment` refused a collaborator: the key it would spend is the owner's, and sharing is off. */
export declare const JUDGMENT_OWNER_ONLY = "judgment-owner-only";
/**
 * The refusal's sentence, naming whose keys they are. `owner` is the
 * machine's person's name, or null when this machine has not said who it is
 * (no `identity.json`) — then nobody is the owner, and the sentence says so.
 */
export declare function ownerOnlySentence(owner: string | null): string;
/** What `GET /api/keys` answers: the rows, the file, and whether the stored keys are shared. */
export interface KeysListing {
    file: string;
    refused?: string;
    /** keys.json's `shareWithCollaborators`: the stored keys pay for collaborators too. */
    share: boolean;
    /** keys.json's `giveToAgents`: the rc hands the stored keys to the agents it summons. */
    agents: boolean;
    keys: KeyRow[];
}
/**
 * **What a summoned agent is handed from keys.json** (keys phase 4): for each
 * agent provider, the stored key under its harness's variable — unless the
 * environment the agent already has sets that variable, because env wins
 * there as everywhere. Pure: the rc reads the file, this decides. The
 * answer is values, so a caller puts it in an env and never prints it.
 */
export declare function agentKeyEnv(stored: Partial<Record<KeyProvider, StoredKey>>, env: KeyEnv): Record<string, string>;
/**
 * **`POST` here for a short-lived Gemini Live token** (keys phase 4) — what
 * the talk module asks per session instead of keeping a key in the browser.
 * Body `{ canvasId }`; the answer is `LiveTokenResponse`. Gated like
 * `/api/text`: admission and the edit rung on the canvas, owner-only spend
 * for a stored key, a per-badge rate, and a canvas homed elsewhere asked
 * there.
 */
export declare const LIVE_TOKEN_ROUTE = "/api/voice/token";
/** The route refused a collaborator: the Gemini key is the owner's, and sharing is off. */
export declare const LIVE_TOKEN_OWNER_ONLY = "voice-owner-only";
/** The home holds no Gemini key. */
export declare const LIVE_TOKEN_UNAVAILABLE = "voice-unavailable";
/** This badge has minted enough tokens this minute. */
export declare const LIVE_TOKEN_RATE_LIMITED = "voice-rate-limited";
/** The request did not name a canvas. */
export declare const LIVE_TOKEN_BAD_REQUEST = "voice-bad-request";
/** Google refused or could not be reached; the error carries its words, never the key. */
export declare const LIVE_TOKEN_UPSTREAM = "voice-upstream";
/**
 * What the token route answers: Google's ephemeral token name
 * (`auth_tokens/…`), good for ONE Live session started before
 * `newSessionExpireTime` and lasting until `expireTime`. Not the key — a
 * token cannot mint another token or call any other API.
 */
export interface LiveTokenResponse {
    token: string;
    expireTime: string;
    newSessionExpireTime: string;
}
export {};
