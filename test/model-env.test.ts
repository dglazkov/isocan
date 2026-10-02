import { describe, expect, it } from "vitest";
import { chooseTextKey, envKeyFor, KEY_PROVIDERS } from "@isocan/core/keys";
import { isolateModelEnv } from "./model-env.ts";

describe("model settings inherited by the suite", () => {
  it("leaves every provider unconfigured until a fixture supplies its own key", () => {
    const env: NodeJS.ProcessEnv = {
      GEMINI_API_KEY: "synthetic-ambient-gemini", TYPESAFE_API_KEY: "synthetic-ambient-typesafe",
      ISOCAN_TEXT_API_KEY: "synthetic-ambient-text", ISOCAN_TEXT_PROVIDER: "openai",
      ISOCAN_TEXT_MODEL: "ambient-model", PATH: "/synthetic/bin",
    };
    isolateModelEnv(env);
    for (const provider of KEY_PROVIDERS) expect(envKeyFor(provider, env)).toBeUndefined();
    expect(chooseTextKey(env, () => undefined)).toBeUndefined();
    // The fixture's stored provider/model must also beat the former ambient
    // preferences, not just the ambient credential.
    expect(chooseTextKey(env, () => ({ key: "fixture-key", model: "fixture-model", addedAt: "2026-10-02" })))
      .toMatchObject({ provider: "anthropic", source: "file", model: "fixture-model" });
    expect(env.PATH).toBe("/synthetic/bin");
    env.GEMINI_API_KEY = "synthetic-fixture-gemini";
    expect(envKeyFor("gemini", env)?.key).toBe("synthetic-fixture-gemini");
  });
});
