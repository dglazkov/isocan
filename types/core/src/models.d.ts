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
/**
 * **The model manifest — the one place a role is given a checkpoint**
 * (Open Stitch phase 0.4; `docs/projects/openstitch/phases.md`).
 *
 * Before this file, every spender named its own model where it spent:
 * the summaries' Haiku in `semantic-zoom.ts`, the text model's Opus in
 * `jev.ts`, the moodboard's Nano Banana in `mood.ts`, the voice harness's
 * 3.8 Live in `live.ts`, the judge's Jev in the server. Each read its own
 * environment variable, and nothing could answer "which models does this
 * home reach?" without reading five files. This is that answer: a **role**
 * (what the call is for) → a **checkpoint** (the exact id the vendor
 * serves), its fallbacks, and which provider's key pays for it.
 *
 * Pure and dependency-free — no I/O, no `process`, no node — because core
 * is isomorphic and the web reads it too. `modelFor` takes the environment
 * as an argument; the caller decides whether that is `process.env`.
 *
 * **Byte-identical by default.** The ids here are exactly the ones each
 * spender named before; the spenders now import them from here and keep
 * reading their own older variables (`ISOCAN_TEXT_MODEL`,
 * `ISOCAN_IMAGE_MODEL`, `ISOCAN_SUMMARY_MODEL`) as they did. The new
 * `ISOCAN_MODEL_<ROLE>` variable is the uniform spelling for every role,
 * and wins over the older one when both are set.
 *
 * **Exact checkpoints, never `-latest` aliases**, where the vendor serves
 * one — an alias can move to another checkpoint without a deploy, and a
 * log should name the model that answered. The judge is the deliberate
 * exception (`jev-latest`): the home follows that vendor's upgrades on
 * purpose (`server/src/judgment.ts`).
 */
/** What a call is for. One role per kind of spend, not per spender. */
export declare const MODEL_ROLES: readonly ["chat", "utility", "embedding", "image", "video", "music", "tts", "live", "transcribe", "judge", "summary", "text"];
/** Union of spend-role keys declared in `MODEL_ROLES`. */
export type ModelRole = (typeof MODEL_ROLES)[number];
/** Who serves an id — the routing key for every server path, and whose key pays. */
type ModelProvider = "gemini" | "anthropic" | "openai" | "typesafe" | "fal" | "unknown";
/** One role's row in the manifest. */
interface ModelEntry {
    /** The checkpoint asked first. */
    readonly id: string;
    /** Who serves `id`; `providerOf(id)` when absent. */
    readonly provider?: ModelProvider;
    /** The next ids to try, in order, when `id` is unavailable or the home holds no key for its provider. */
    readonly fallbacks: readonly string[];
    /** Whether anything in this build spends this role today. A role that is not implemented is a reservation, not a promise. */
    readonly implemented: boolean;
    /** Where the role is spent, in a few words — for the catalogue and `isocan models`. */
    readonly usedBy: string;
    /** The older environment variable this role already honoured before the manifest; `ISOCAN_MODEL_<ROLE>` wins over it. */
    readonly legacyEnv?: string;
}
/** What `modelFor` answers: the id to ask, who serves it, the ladder after it, and where the id came from. */
export interface ResolvedModel {
    readonly role: ModelRole;
    readonly id: string;
    readonly provider: ModelProvider;
    readonly fallbacks: readonly string[];
    readonly implemented: boolean;
    /** `"env"` when a variable named the id, with which one; `"default"` when the manifest did. */
    readonly source: "env" | "default";
    readonly variable?: string;
}
/**
 * The manifest. Each `implemented` row names exactly what the spender it
 * cites named before this file existed, so moving the constant here moved
 * no behaviour. The unimplemented rows reserve the role with a current
 * Gemini checkpoint so a module that arrives for it (Open Stitch phase 3)
 * has a default to start from, and `isocan models` can say what is missing.
 */
export declare const MODELS: Readonly<Record<ModelRole, ModelEntry>>;
/** Is this one of the roles the manifest knows? */
export declare function isModelRole(value: unknown): value is ModelRole;
/** The uniform override for a role: `ISOCAN_MODEL_IMAGE`, `ISOCAN_MODEL_LIVE`, … */
export declare function modelEnvVariable(role: ModelRole): string;
/**
 * Who serves an id, from its spelling. Vendor prefixes first (`fal:`,
 * `openai:`, `anthropic:`), then the shapes each vendor names its own
 * checkpoints by: `models/gemini-…` and `gemini-…`, `veo-`, `lyria-`,
 * `imagen-` are Google's; `claude-` is Anthropic's; `gpt-`, `o1`…`o4`,
 * `text-embedding-` are OpenAI's; `jev-` is TypeSafe's. Anything else is
 * `unknown` — the caller decides whether that is an error.
 */
export declare function providerOf(id: string | undefined): ModelProvider;
/** The vendor's own id — `openai:gpt-5.5` → `gpt-5.5`. Google's `models/` prefix and unprefixed ids pass through. */
export declare function bareModelId(id: string): string;
/** What `modelFor` reads: an environment, and optionally what the keystore holds (reserved for key-aware fallback; unused today). */
interface ModelForOptions {
    env?: Readonly<Record<string, string | undefined>>;
    /** The providers this home holds a key for. When given, a primary whose provider has no key steps down the ladder to the first that does. */
    keys?: Readonly<Partial<Record<ModelProvider, boolean>>>;
}
/**
 * **The id a role asks for, now.** `ISOCAN_MODEL_<ROLE>` when set, else the
 * role's older variable (`legacyEnv`), else the manifest's default. With
 * `keys`, a default whose provider has no key steps down the fallbacks to
 * the first whose provider does — never past an environment override,
 * which is a person saying what they want. Pure: the environment is an
 * argument, and absent it is empty, so the answer is the manifest's.
 */
export declare function modelFor(role: ModelRole, opts?: ModelForOptions): ResolvedModel;
/**
 * **The catalogue, as an agent's prompt wants it**: one markdown table, a
 * row per role, with the id that would answer in `env` (the manifest's
 * when none is given), who serves it, the ladder after it, and whether the
 * role is wired. Short on purpose — it is pasted into system prompts.
 */
export declare function describeModelCatalog(opts?: ModelForOptions): string;
export {};
