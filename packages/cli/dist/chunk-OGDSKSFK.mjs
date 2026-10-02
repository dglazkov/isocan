import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);

// packages/core/src/keys.ts
var KEY_PROVIDERS = ["anthropic", "openai", "gemini", "typesafe"];
function isKeyProvider(value2) {
  return typeof value2 === "string" && KEY_PROVIDERS.includes(value2);
}
var KEY_PROVIDER_INFO = {
  anthropic: {
    id: "anthropic",
    label: "Anthropic (Claude)",
    env: "ISOCAN_TEXT_API_KEY (when it is an Anthropic key, or ISOCAN_TEXT_PROVIDER=anthropic)",
    usedFor: ["the text model: copy, wireframe names, content edits"]
  },
  openai: {
    id: "openai",
    label: "OpenAI",
    env: "ISOCAN_TEXT_API_KEY (when it is not an Anthropic key, or ISOCAN_TEXT_PROVIDER=openai)",
    usedFor: ["the text model, when no Anthropic key is set"]
  },
  gemini: {
    id: "gemini",
    label: "Google Gemini",
    env: "GEMINI_API_KEY",
    usedFor: ["voice: the voice harness's Live conversation and transcription"]
  },
  typesafe: {
    id: "typesafe",
    label: "Typesafe (Jev)",
    env: "TYPESAFE_API_KEY",
    usedFor: ["the judge: wireframe compose, style and edit answers"]
  }
};
function textProviderFor(apiKey, named) {
  const said = named?.trim().toLowerCase();
  if (said === "anthropic" || said === "claude") return "anthropic";
  if (said === "openai") return "openai";
  return apiKey?.startsWith("sk-ant-") ? "anthropic" : "openai";
}
var value = (env, name) => env[name]?.trim() || void 0;
function envKeyFor(provider, env) {
  if (provider === "typesafe") {
    const key2 = value(env, "TYPESAFE_API_KEY");
    return key2 ? { key: key2, variable: "TYPESAFE_API_KEY" } : void 0;
  }
  if (provider === "gemini") {
    const key2 = value(env, "GEMINI_API_KEY");
    return key2 ? { key: key2, variable: "GEMINI_API_KEY" } : void 0;
  }
  const key = value(env, "ISOCAN_TEXT_API_KEY");
  if (!key) return void 0;
  return textProviderFor(key, value(env, "ISOCAN_TEXT_PROVIDER")) === provider ? { key, variable: "ISOCAN_TEXT_API_KEY" } : void 0;
}
function chooseTextKey(env, stored) {
  const envModel = value(env, "ISOCAN_TEXT_MODEL");
  const named = value(env, "ISOCAN_TEXT_PROVIDER");
  const fromEnv = value(env, "ISOCAN_TEXT_API_KEY");
  if (fromEnv) {
    return { key: fromEnv, source: "env", variable: "ISOCAN_TEXT_API_KEY", provider: textProviderFor(fromEnv, named), ...envModel ? { model: envModel } : {} };
  }
  const said = named ? textProviderFor(void 0, named) : void 0;
  const order = said === "openai" ? ["openai", "anthropic"] : ["anthropic", "openai"];
  for (const provider of order) {
    const entry = stored(provider);
    if (!entry?.key) continue;
    const model = envModel ?? entry.model;
    return { key: entry.key, source: "file", provider, ...model ? { model } : {} };
  }
  return void 0;
}
function lastFour(key) {
  return key.length >= 12 ? `\u2026${key.slice(-4)}` : "\u2026";
}

export {
  KEY_PROVIDERS,
  isKeyProvider,
  KEY_PROVIDER_INFO,
  textProviderFor,
  envKeyFor,
  chooseTextKey,
  lastFour
};
