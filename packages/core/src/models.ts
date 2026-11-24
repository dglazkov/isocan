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
export const MODEL_ROLES = ["chat", "utility", "embedding", "image", "video", "music", "tts", "live", "transcribe", "judge", "summary", "text"] as const;
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
export const MODELS: Readonly<Record<ModelRole, ModelEntry>> = {
  /** No chat agent runs inside isocan today — agents are BYO over the CLI and MCP. Reserved for the house agent (phase 2). */
  chat: { id: "gemini-3.8-flash", fallbacks: ["gemini-3.5-flash-lite"], implemented: false, usedBy: "the house agent's turn (phase 2; not built)" },
  /** Short helper calls that are not a conversation — labels, extraction, routing. Reserved. */
  utility: { id: "gemini-3.8-flash", fallbacks: ["gemini-3.5-flash-lite"], implemented: false, usedBy: "short helper calls (not built)" },
  embedding: { id: "gemini-embedding-2", fallbacks: [], implemented: false, usedBy: "recall and search (not built)" },
  /**
   * The moodboard's picture model: `mood.ts`'s `IMAGE_MODEL_DEFAULT`, Nano
   * Banana 2.1, chosen from Google's price page on 16 Oct 2026 ($0.0336 an
   * image; `mood.ts` keeps the price table). Pro is "Redraw in Pro", later.
   */
  image: { id: "gemini-nano-banana-2.1", fallbacks: ["gemini-3-pro-image"], implemented: true, usedBy: "`isocan mood`, `POST /api/image`", legacyEnv: "ISOCAN_IMAGE_MODEL" },
  video: { id: "gemini-omni-1.1-flash", fallbacks: ["veo-3.1-fast-generate-preview"], implemented: false, usedBy: "video clips (phase 3; not built)" },
  music: { id: "lyria-3-clip-preview", fallbacks: ["lyria-3-pro-preview"], implemented: false, usedBy: "music clips (phase 3; not built)" },
  tts: { id: "gemini-3.8-flash-tts", fallbacks: ["gemini-3.1-flash-tts-preview"], implemented: false, usedBy: "spoken lines (phase 3; not built)" },
  /**
   * *Talk to the canvas*: the voice harness's `LIVE_MODEL`, with the
   * `models/` prefix the Live API's setup message wants. 3.8 Live verified
   * current on 15 Sep 2026; the `--model` flag and `LiveSessionOptions.model`
   * move with a preview name without a release.
   */
  live: { id: "models/gemini-3.8-live", fallbacks: ["models/gemini-3.1-flash-live-preview"], implemented: true, usedBy: "`isocan voice`, `POST /api/voice/token`" },
  transcribe: { id: "gemini-3.5-transcribe", fallbacks: [], implemented: false, usedBy: "transcripts (not built)" },
  /**
   * `POST /api/judgment`: a typed question file, answered by TypeSafe's Jev
   * (`server/src/judgment.ts`'s `JUDGE_MODEL`). The vendor's moving alias,
   * on purpose. Its fallbacks are the text models that can answer a schema
   * when a home holds no TypeSafe key (`jev.ts`'s `envTextGenerator`).
   */
  judge: { id: "jev-latest", provider: "typesafe", fallbacks: ["claude-opus-5-5", "gpt-4o-mini"], implemented: true, usedBy: "`POST /api/judgment`, the CLI's own Jev" },
  /**
   * Semantic Zoom's summaries: `semantic-zoom.ts`'s `SUMMARY_MODEL`. A
   * summary is short, high-volume and low-stakes, so the cheapest Claude
   * tier; a home whose text key is not Claude's uses the text model's own
   * default instead (`server/src/summaries.ts`).
   */
  summary: { id: "claude-haiku-5-5", fallbacks: ["gpt-4o-mini"], implemented: true, usedBy: "`isocan summary`, `/api/projects/:id/summaries`", legacyEnv: "ISOCAN_SUMMARY_MODEL" },
  /**
   * `POST /api/text` and the CLI's own copy and wireframe answers:
   * `jev.ts`'s `CLAUDE_TEXT_MODEL` (Opus 5.5, the `claude-api` skill's
   * recommendation of 2 Oct 2026; its cost lever is `CLAUDE_TEXT_EFFORT`,
   * not a smaller model). The fallback is what the OpenAI-shaped generator
   * asks when the home's text key is not Claude's.
   */
  text: { id: "claude-opus-5-5", fallbacks: ["gpt-4o-mini"], implemented: true, usedBy: "`POST /api/text`, copy and wireframe answers", legacyEnv: "ISOCAN_TEXT_MODEL" },
};

/** Is this one of the roles the manifest knows? */
export function isModelRole(value: unknown): value is ModelRole {
  return typeof value === "string" && (MODEL_ROLES as readonly string[]).includes(value);
}

/** The uniform override for a role: `ISOCAN_MODEL_IMAGE`, `ISOCAN_MODEL_LIVE`, … */
export function modelEnvVariable(role: ModelRole): string {
  return `ISOCAN_MODEL_${role.toUpperCase()}`;
}

/**
 * Who serves an id, from its spelling. Vendor prefixes first (`fal:`,
 * `openai:`, `anthropic:`), then the shapes each vendor names its own
 * checkpoints by: `models/gemini-…` and `gemini-…`, `veo-`, `lyria-`,
 * `imagen-` are Google's; `claude-` is Anthropic's; `gpt-`, `o1`…`o4`,
 * `text-embedding-` are OpenAI's; `jev-` is TypeSafe's. Anything else is
 * `unknown` — the caller decides whether that is an error.
 */
export function providerOf(id: string | undefined): ModelProvider {
  const raw = id?.trim() ?? "";
  if (!raw) return "unknown";
  if (raw.startsWith("fal:") || raw.startsWith("fal-ai/")) return "fal";
  if (raw.startsWith("openai:")) return "openai";
  if (raw.startsWith("anthropic:")) return "anthropic";
  if (raw.startsWith("gemini:") || raw.startsWith("google:")) return "gemini";
  const bare = raw.replace(/^models\//, "");
  if (/^(gemini|veo|lyria|imagen)-/.test(bare)) return "gemini";
  if (/^claude-/.test(bare)) return "anthropic";
  if (/^(gpt-|o[1-4](-|$)|text-embedding-|chatgpt-)/.test(bare)) return "openai";
  if (/^jev-/.test(bare)) return "typesafe";
  return "unknown";
}

/** The vendor's own id — `openai:gpt-5.5` → `gpt-5.5`. Google's `models/` prefix and unprefixed ids pass through. */
export function bareModelId(id: string): string {
  return id.trim().replace(/^(openai|anthropic|gemini|google):/, "");
}

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
export function modelFor(role: ModelRole, opts: ModelForOptions = {}): ResolvedModel {
  const entry = MODELS[role];
  const env = opts.env ?? {};
  const read = (name: string | undefined): string | undefined => (name ? env[name]?.trim() || undefined : undefined);
  const uniform = modelEnvVariable(role);
  for (const variable of [uniform, entry.legacyEnv]) {
    const id = read(variable);
    if (id && variable) {
      const fallbacks = [entry.id, ...entry.fallbacks].filter((f) => f !== id);
      return { role, id, provider: providerOf(id), fallbacks, implemented: entry.implemented, source: "env", variable };
    }
  }
  const provider = entry.provider ?? providerOf(entry.id);
  if (opts.keys && !opts.keys[provider]) {
    const ladder = [entry.id, ...entry.fallbacks];
    for (const candidate of ladder) {
      const p = providerOf(candidate);
      if (opts.keys[p]) {
        return { role, id: candidate, provider: p, fallbacks: ladder.filter((f) => f !== candidate), implemented: entry.implemented, source: "default" };
      }
    }
  }
  return { role, id: entry.id, provider, fallbacks: entry.fallbacks, implemented: entry.implemented, source: "default" };
}

/**
 * **The catalogue, as an agent's prompt wants it**: one markdown table, a
 * row per role, with the id that would answer in `env` (the manifest's
 * when none is given), who serves it, the ladder after it, and whether the
 * role is wired. Short on purpose — it is pasted into system prompts.
 */
export function describeModelCatalog(opts: ModelForOptions = {}): string {
  const lines = ["| role | model | provider | fallbacks | status |", "|---|---|---|---|---|"];
  for (const role of MODEL_ROLES) {
    const m = modelFor(role, opts);
    const status = m.implemented ? (m.source === "env" ? `wired (${m.variable})` : "wired") : "reserved";
    lines.push(`| ${role} | \`${m.id}\` | ${m.provider} | ${m.fallbacks.length ? m.fallbacks.map((f) => `\`${f}\``).join(", ") : "—"} | ${status} |`);
  }
  return lines.join("\n");
}
