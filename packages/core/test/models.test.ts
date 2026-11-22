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

import { describe, expect, it } from "vitest";
import { CLAUDE_TEXT_MODEL, JEV_MODEL, OPENAI_TEXT_MODEL } from "../src/jev.ts";
import { IMAGE_MODEL_DEFAULT } from "../src/mood.ts";
import { SUMMARY_MODEL } from "../src/semantic-zoom.ts";
import {
  bareModelId,
  describeModelCatalog,
  isModelRole,
  MODEL_ROLES,
  MODELS,
  modelEnvVariable,
  modelFor,
  providerOf,
  type ModelRole,
} from "../src/models.ts";
import * as core from "../src/index.ts";

/**
 * **The model manifest** (Open Stitch phase 0.4): one table, role →
 * checkpoint, that every spender reads. The proof that matters most is the
 * last `describe`: moving the ids into the manifest moved none of them.
 */

describe("the manifest", () => {
  it("has a row for every role, and every row a non-empty id", () => {
    for (const role of MODEL_ROLES) {
      const entry = MODELS[role];
      expect(entry.id, role).toMatch(/\S/);
      expect(Array.isArray(entry.fallbacks), role).toBe(true);
      expect(typeof entry.implemented, role).toBe("boolean");
      expect(entry.usedBy, role).toMatch(/\S/);
    }
    expect(Object.keys(MODELS).sort()).toEqual([...MODEL_ROLES].sort());
  });

  it("names the roles the brief asked for", () => {
    for (const role of ["chat", "utility", "embedding", "image", "video", "music", "tts", "live", "transcribe", "judge", "summary", "text"]) {
      expect(isModelRole(role), role).toBe(true);
    }
    expect(isModelRole("poetry")).toBe(false);
    expect(isModelRole(3)).toBe(false);
  });

  it("marks what nothing in this build spends yet as reserved, on a Gemini default", () => {
    for (const role of ["video", "music", "tts", "transcribe", "embedding"] as const) {
      expect(MODELS[role].implemented, role).toBe(false);
      expect(providerOf(MODELS[role].id), role).toBe("gemini");
    }
    for (const role of ["image", "live", "judge", "summary", "text"] as const) expect(MODELS[role].implemented, role).toBe(true);
  });

  it("never names a fallback that is the primary", () => {
    for (const role of MODEL_ROLES) expect(MODELS[role].fallbacks, role).not.toContain(MODELS[role].id);
  });

  it("is exported from the core barrel", () => {
    expect(core.modelFor).toBe(modelFor);
    expect(core.MODELS).toBe(MODELS);
    expect(core.providerOf).toBe(providerOf);
    expect(core.describeModelCatalog).toBe(describeModelCatalog);
  });
});

describe("providerOf", () => {
  it("reads the vendor from the id's shape", () => {
    expect(providerOf("gemini-nano-banana-2.1")).toBe("gemini");
    expect(providerOf("models/gemini-3.8-live")).toBe("gemini");
    expect(providerOf("veo-3.1-fast-generate-preview")).toBe("gemini");
    expect(providerOf("lyria-3-clip-preview")).toBe("gemini");
    expect(providerOf("claude-haiku-5-5")).toBe("anthropic");
    expect(providerOf("claude-opus-5-5")).toBe("anthropic");
    expect(providerOf("gpt-4o-mini")).toBe("openai");
    expect(providerOf("o3-mini")).toBe("openai");
    expect(providerOf("text-embedding-3-small")).toBe("openai");
    expect(providerOf("jev-latest")).toBe("typesafe");
    expect(providerOf("jev-1.14.0")).toBe("typesafe");
  });

  it("honours an explicit vendor prefix over the shape", () => {
    expect(providerOf("fal:flux-pro")).toBe("fal");
    expect(providerOf("fal-ai/flux/dev")).toBe("fal");
    expect(providerOf("openai:gpt-5.5")).toBe("openai");
    expect(providerOf("anthropic:claude-opus-5-5")).toBe("anthropic");
    expect(providerOf("gemini:gemini-3.8-flash")).toBe("gemini");
  });

  it("says unknown rather than guessing", () => {
    expect(providerOf("acme-wordsmith-1")).toBe("unknown");
    expect(providerOf("")).toBe("unknown");
    expect(providerOf(undefined)).toBe("unknown");
    expect(providerOf("   ")).toBe("unknown");
  });

  it("strips a vendor prefix to the vendor's own id", () => {
    expect(bareModelId("openai:gpt-5.5")).toBe("gpt-5.5");
    expect(bareModelId("anthropic:claude-opus-5-5")).toBe("claude-opus-5-5");
    expect(bareModelId("models/gemini-3.8-live")).toBe("models/gemini-3.8-live");
    expect(bareModelId("fal:flux-pro")).toBe("fal:flux-pro");
  });
});

describe("modelFor", () => {
  it("answers the manifest's default with no environment", () => {
    const image = modelFor("image");
    expect(image).toEqual({ role: "image", id: "gemini-nano-banana-2.1", provider: "gemini", fallbacks: ["gemini-3-pro-image"], implemented: true, source: "default" });
    const judge = modelFor("judge", { env: {} });
    expect(judge.id).toBe("jev-latest");
    expect(judge.provider).toBe("typesafe");
  });

  it("is overridden by ISOCAN_MODEL_<ROLE>, uppercased", () => {
    expect(modelEnvVariable("image")).toBe("ISOCAN_MODEL_IMAGE");
    expect(modelEnvVariable("live")).toBe("ISOCAN_MODEL_LIVE");
    const got = modelFor("image", { env: { ISOCAN_MODEL_IMAGE: " gemini-3-pro-image " } });
    expect(got).toMatchObject({ id: "gemini-3-pro-image", provider: "gemini", source: "env", variable: "ISOCAN_MODEL_IMAGE" });
    // The manifest's default and its other fallbacks become the ladder behind the override.
    expect(got.fallbacks).toEqual(["gemini-nano-banana-2.1"]);
  });

  it("re-reads the provider from an override that changes vendor", () => {
    const got = modelFor("summary", { env: { ISOCAN_MODEL_SUMMARY: "gpt-4o-mini" } });
    expect(got.provider).toBe("openai");
    expect(got.fallbacks).toEqual(["claude-haiku-5-5"]);
  });

  it("still honours the older variable a role already read, beneath the uniform one", () => {
    expect(modelFor("text", { env: { ISOCAN_TEXT_MODEL: "claude-sonnet-5-5" } })).toMatchObject({ id: "claude-sonnet-5-5", source: "env", variable: "ISOCAN_TEXT_MODEL" });
    expect(modelFor("image", { env: { ISOCAN_IMAGE_MODEL: "gemini-3-pro-image" } })).toMatchObject({ id: "gemini-3-pro-image", variable: "ISOCAN_IMAGE_MODEL" });
    expect(modelFor("summary", { env: { ISOCAN_SUMMARY_MODEL: "claude-sonnet-5-5" } })).toMatchObject({ id: "claude-sonnet-5-5", variable: "ISOCAN_SUMMARY_MODEL" });
    // Both set: the uniform spelling wins.
    expect(modelFor("text", { env: { ISOCAN_TEXT_MODEL: "claude-sonnet-5-5", ISOCAN_MODEL_TEXT: "claude-opus-5-5" } })).toMatchObject({ id: "claude-opus-5-5", variable: "ISOCAN_MODEL_TEXT" });
  });

  it("ignores a blank override", () => {
    expect(modelFor("live", { env: { ISOCAN_MODEL_LIVE: "   " } })).toMatchObject({ id: "models/gemini-3.8-live", source: "default" });
  });

  it("steps down the ladder to a provider with a key, when told which keys are held", () => {
    // No TypeSafe key, an Anthropic one: the judge's question goes to the text model that can answer a schema.
    expect(modelFor("judge", { keys: { anthropic: true } })).toMatchObject({ id: "claude-opus-5-5", provider: "anthropic", source: "default" });
    expect(modelFor("judge", { keys: { openai: true } })).toMatchObject({ id: "gpt-4o-mini", provider: "openai" });
    // The primary's key held: the primary.
    expect(modelFor("judge", { keys: { typesafe: true } })).toMatchObject({ id: "jev-latest" });
    // No key anywhere: the primary, unchanged — the caller's refusal says "no key", not this.
    expect(modelFor("judge", { keys: {} })).toMatchObject({ id: "jev-latest" });
  });

  it("never steps past an environment override, even without its key", () => {
    expect(modelFor("judge", { env: { ISOCAN_MODEL_JUDGE: "jev-1.14.0" }, keys: { anthropic: true } })).toMatchObject({ id: "jev-1.14.0", source: "env" });
  });
});

describe("describeModelCatalog", () => {
  it("is one markdown table with a row per role", () => {
    const text = describeModelCatalog();
    const lines = text.split("\n");
    expect(lines[0]).toBe("| role | model | provider | fallbacks | status |");
    expect(lines[1]).toBe("|---|---|---|---|---|");
    expect(lines.length).toBe(2 + MODEL_ROLES.length);
    for (const role of MODEL_ROLES) expect(text).toMatch(new RegExp(`^\\| ${role} \\| \`${MODELS[role].id.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}\` \\|`, "m"));
    expect(text).toContain("| image | `gemini-nano-banana-2.1` | gemini | `gemini-3-pro-image` | wired |");
    expect(text).toContain("| video | `gemini-omni-1.1-flash` | gemini | `veo-3.1-fast-generate-preview` | reserved |");
  });

  it("shows the environment's answer and which variable gave it", () => {
    const text = describeModelCatalog({ env: { ISOCAN_MODEL_IMAGE: "gemini-3-pro-image" } });
    expect(text).toContain("| image | `gemini-3-pro-image` | gemini | `gemini-nano-banana-2.1` | wired (ISOCAN_MODEL_IMAGE) |");
  });

  it("is short enough for a system prompt", () => {
    expect(describeModelCatalog().length).toBeLessThan(2_000);
  });
});

describe("the spenders read the manifest, and nothing moved", () => {
  const was: Record<ModelRole, string | undefined> = {
    text: "claude-opus-5-5",
    summary: "claude-haiku-5-5",
    image: "gemini-nano-banana-2.1",
    live: "models/gemini-3.8-live",
    judge: "jev-latest",
    chat: undefined,
    utility: undefined,
    embedding: undefined,
    video: undefined,
    music: undefined,
    tts: undefined,
    transcribe: undefined,
  };

  it("keeps every id its spender named before the manifest existed", () => {
    for (const role of MODEL_ROLES) if (was[role]) expect(MODELS[role].id, role).toBe(was[role]);
  });

  it("is what the old constants now spell", () => {
    expect(CLAUDE_TEXT_MODEL).toBe("claude-opus-5-5");
    expect(OPENAI_TEXT_MODEL).toBe("gpt-4o-mini");
    expect(SUMMARY_MODEL).toBe("claude-haiku-5-5");
    expect(IMAGE_MODEL_DEFAULT).toBe("gemini-nano-banana-2.1");
    expect(JEV_MODEL).toBe("jev-latest");
    expect(CLAUDE_TEXT_MODEL).toBe(modelFor("text").id);
    expect(OPENAI_TEXT_MODEL).toBe(modelFor("text").fallbacks[0]);
    expect(SUMMARY_MODEL).toBe(modelFor("summary").id);
    expect(IMAGE_MODEL_DEFAULT).toBe(modelFor("image").id);
    expect(JEV_MODEL).toBe(modelFor("judge").id);
  });
});
