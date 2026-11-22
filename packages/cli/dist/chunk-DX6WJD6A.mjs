import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);

// packages/core/src/models.ts
var MODEL_ROLES = ["chat", "utility", "embedding", "image", "video", "music", "tts", "live", "transcribe", "judge", "summary", "text"];
var MODELS = {
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
  text: { id: "claude-opus-5-5", fallbacks: ["gpt-4o-mini"], implemented: true, usedBy: "`POST /api/text`, copy and wireframe answers", legacyEnv: "ISOCAN_TEXT_MODEL" }
};
function isModelRole(value) {
  return typeof value === "string" && MODEL_ROLES.includes(value);
}
function modelEnvVariable(role) {
  return `ISOCAN_MODEL_${role.toUpperCase()}`;
}
function providerOf(id) {
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
function bareModelId(id) {
  return id.trim().replace(/^(openai|anthropic|gemini|google):/, "");
}
function modelFor(role, opts = {}) {
  const entry = MODELS[role];
  const env = opts.env ?? {};
  const read = (name) => name ? env[name]?.trim() || void 0 : void 0;
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
function describeModelCatalog(opts = {}) {
  const lines = ["| role | model | provider | fallbacks | status |", "|---|---|---|---|---|"];
  for (const role of MODEL_ROLES) {
    const m = modelFor(role, opts);
    const status = m.implemented ? m.source === "env" ? `wired (${m.variable})` : "wired" : "reserved";
    lines.push(`| ${role} | \`${m.id}\` | ${m.provider} | ${m.fallbacks.length ? m.fallbacks.map((f) => `\`${f}\``).join(", ") : "\u2014"} | ${status} |`);
  }
  return lines.join("\n");
}

export {
  MODEL_ROLES,
  MODELS,
  isModelRole,
  modelEnvVariable,
  providerOf,
  bareModelId,
  modelFor,
  describeModelCatalog
};
