import { afterEach, describe, expect, it } from "vitest";
import {
  CLAUDE_MESSAGES_URL, CLAUDE_TEXT_EFFORT, CLAUDE_TEXT_MODEL, claudeSchema, claudeTextGenerator, envTextGenerator,
  homeTextGenerator, homeTextOrStub, stubTextGenerator, textProvider, type JsonSchema,
} from "../src/jev.ts";
import { TEXT_UNAVAILABLE } from "../src/text.ts";

/**
 * **The Claude text generator** (copy-edit phase 0.5) — the request it sends,
 * recorded off an injected `fetch`, and what it does with Claude's answer:
 * the Messages API with structured outputs, the key as `x-api-key` and never
 * in an error, a refusal and a truncation said in words. Plus which provider
 * the environment names, and the home's generator with its stub fallback.
 *
 * Synthetic throughout: Acme, a made-up key.
 */

const KEY = "sk-ant-acme-test-key";
const SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    heading: { type: "string" },
    nav: { type: "array", items: { type: "object", properties: { label: { type: "string" } }, required: ["label"] }, minItems: 4, maxItems: 4 },
  },
  required: ["heading", "nav"],
  additionalProperties: false,
};
const VALUE = { heading: "Acme orders", nav: [{ label: "Home" }, { label: "Orders" }, { label: "Stock" }, { label: "Team" }] };

function recorded(answer: unknown, status = 200) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(answer), { status, headers: { "content-type": "application/json" } });
  }) as unknown as typeof globalThis.fetch;
  return { calls, fetch };
}
const message = (text: string, extra: Record<string, unknown> = {}) => ({
  id: "msg_acme", type: "message", role: "assistant", model: CLAUDE_TEXT_MODEL, stop_reason: "end_turn", stop_details: null,
  content: [{ type: "thinking", thinking: "", signature: "sig" }, { type: "text", text }], ...extra,
});

describe("claudeTextGenerator", () => {
  it("sends the Messages API request: x-api-key, version, structured outputs at low effort, default fallbacks", async () => {
    const { calls, fetch } = recorded(message(JSON.stringify(VALUE)));
    const gen = claudeTextGenerator({ apiKey: KEY, fetch });
    expect(gen.name).toBe(CLAUDE_TEXT_MODEL);
    expect(await gen.generateJson("Write Acme's order screen.", SCHEMA)).toEqual(VALUE);

    expect(calls).toHaveLength(1);
    const { url, init } = calls[0]!;
    expect(url).toBe(CLAUDE_MESSAGES_URL);
    expect(init.method).toBe("POST");
    const headers = new Headers(init.headers);
    expect(headers.get("x-api-key")).toBe(KEY);
    expect(headers.get("anthropic-version")).toBe("2023-06-01");
    expect(headers.get("anthropic-beta")).toBe("server-side-fallback-2026-07-01");
    expect(headers.get("authorization")).toBeNull();
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      model: CLAUDE_TEXT_MODEL,
      max_tokens: 16000,
      fallbacks: "default",
      messages: [{ role: "user", content: "Write Acme's order screen." }],
      output_config: { effort: CLAUDE_TEXT_EFFORT, format: { type: "json_schema", schema: claudeSchema(SCHEMA) } },
    });
    expect(typeof body.system).toBe("string");
    // Opus 5.5: thinking cannot be configured off, and no sampling knobs or prefill.
    expect(body.thinking).toBeUndefined();
    expect(body.temperature).toBeUndefined();
    expect(body.messages.at(-1).role).toBe("user");
  });

  it("closes every object and drops array lengths Claude's structured outputs refuse", () => {
    const closed = claudeSchema(SCHEMA);
    expect(closed.additionalProperties).toBe(false);
    const nav = closed.properties!.nav!;
    expect(nav.minItems).toBeUndefined();
    expect(nav.maxItems).toBeUndefined();
    expect(nav.items!.additionalProperties).toBe(false);
    expect(claudeSchema({ type: "array", items: { type: "string" }, minItems: 1 }).minItems).toBe(1);
  });

  it("says a refusal, a truncation and an HTTP error in words — and never the key", async () => {
    const refused = claudeTextGenerator({ apiKey: KEY, fetch: recorded(message("", { stop_reason: "refusal", stop_details: { type: "refusal", category: "cyber", explanation: "x" }, content: [] })).fetch });
    await expect(refused.generateJson("p", SCHEMA)).rejects.toThrow("Claude declined to write these words (cyber)");
    const cut = claudeTextGenerator({ apiKey: KEY, fetch: recorded(message('{"heading":', { stop_reason: "max_tokens" })).fetch });
    await expect(cut.generateJson("p", SCHEMA)).rejects.toThrow(/ran out of room/);
    const echoed = claudeTextGenerator({ apiKey: KEY, fetch: recorded({ type: "error", error: { type: "authentication_error", message: `bad key ${KEY}` } }, 401).fetch });
    const error = await echoed.generateJson("p", SCHEMA).catch((e: Error) => e);
    expect(String(error)).toContain("HTTP 401");
    expect(String(error)).not.toContain(KEY);
    const unreachable = claudeTextGenerator({ apiKey: KEY, fetch: (async () => { throw new Error(`ECONNREFUSED x-api-key ${KEY}`); }) as unknown as typeof globalThis.fetch });
    const down = await unreachable.generateJson("p", SCHEMA).catch((e: Error) => e);
    expect(String(down)).toContain("could not be reached");
    expect(String(down)).not.toContain(KEY);
    await expect(claudeTextGenerator({ apiKey: "" }).generateJson("p", SCHEMA)).rejects.toThrow(/requires apiKey/);
  });
});

describe("which provider", () => {
  const saved = { ...process.env };
  afterEach(() => {
    for (const k of ["ISOCAN_TEXT_API_KEY", "ISOCAN_TEXT_PROVIDER", "ISOCAN_TEXT_MODEL"]) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("is named by ISOCAN_TEXT_PROVIDER, else by the key's shape — and an existing key keeps meaning OpenAI", () => {
    expect(textProvider("sk-ant-acme", undefined)).toBe("anthropic");
    expect(textProvider("sk-acme", undefined)).toBe("openai");
    expect(textProvider(undefined, undefined)).toBe("openai");
    expect(textProvider("sk-acme", "anthropic")).toBe("anthropic");
    expect(textProvider("sk-ant-acme", "openai")).toBe("openai");
  });

  it("envTextGenerator reads the key, provider and model from the environment", async () => {
    process.env.ISOCAN_TEXT_API_KEY = KEY;
    delete process.env.ISOCAN_TEXT_PROVIDER;
    process.env.ISOCAN_TEXT_MODEL = "claude-acme-override";
    const { calls, fetch } = recorded(message(JSON.stringify(VALUE)));
    const gen = envTextGenerator({ fetch });
    expect(gen.name).toBe("claude-acme-override");
    await gen.generateJson("p", SCHEMA);
    expect(calls[0]!.url).toBe(CLAUDE_MESSAGES_URL);
    expect(JSON.parse(String(calls[0]!.init.body)).model).toBe("claude-acme-override");
  });
});

describe("the home's text model", () => {
  it("posts the canvas, prompt and schema, and names the model that wrote the words", async () => {
    const posted: unknown[] = [];
    const gen = homeTextGenerator(async (request) => {
      posted.push(request);
      return { model: CLAUDE_TEXT_MODEL, value: VALUE };
    }, "canvas-acme");
    expect(await gen.generateJson("p", SCHEMA)).toEqual(VALUE);
    expect(posted).toEqual([{ canvasId: "canvas-acme", prompt: "p", schema: SCHEMA }]);
    expect(gen.name).toBe(`${CLAUDE_TEXT_MODEL} via the home`);
  });

  it("falls back to the stub only on text-unavailable, told once; any other refusal is a failure", async () => {
    const none = homeTextGenerator(async () => {
      throw Object.assign(new Error("no text model"), { code: TEXT_UNAVAILABLE });
    }, "canvas-acme");
    const told: unknown[] = [];
    const gen = homeTextOrStub(none, { ...stubTextGenerator(2), name: "placeholder words" }, (e) => told.push(e));
    const out = await Promise.all([gen.generateJson("p", SCHEMA), gen.generateJson("p", SCHEMA)]);
    expect(out).toHaveLength(2);
    expect(told).toHaveLength(1);
    expect(gen.name).toBe("placeholder words");

    const refused = homeTextOrStub(homeTextGenerator(async () => {
      throw Object.assign(new Error("view-only"), { code: "view-only" });
    }, "canvas-acme"), stubTextGenerator(2), () => {});
    await expect(refused.generateJson("p", SCHEMA)).rejects.toThrow("view-only");
  });
});
