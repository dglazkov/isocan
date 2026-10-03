import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fsp } from "node:fs";
import os from "node:os";
import path from "node:path";
import { JUDGMENT_ROUTE, JUDGMENT_UNAVAILABLE } from "@isocan/core";
import { CLAUDE_TEXT_MODEL } from "@isocan/core/jev";
import { writeKey } from "@isocan/core/keystore";
import { TEXT_ROUTE, TEXT_UNAVAILABLE } from "@isocan/core/text";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

/**
 * **The daemon's spenders read keys.json** (keys phase 1). A daemon given no
 * key of its own reads its home's `keys.json` per call: the judge its
 * `typesafe` key, the text model its `anthropic` (else `openai`) key — set
 * while the daemon runs, used on the next request, with no restart; the
 * environment still wins; a file that leaked its mode is refused, and the
 * route says it has no key rather than reading it. No response carries a key.
 *
 * Fixtures are synthetic: Acme, Priya, made-up keys.
 */

const ANTHROPIC = "sk-ant-fake_STORED_DO_NOT_PRINT_";
const TYPESAFE = "tsk_acme_STORED_DO_NOT_PRINT_1234567890";
const priya = { id: "usr_priya", name: "Priya" };
const CANVAS = "prj_acme_keys";
const SCHEMA = { type: "object" as const, properties: { heading: { type: "string" as const } }, required: ["heading"], additionalProperties: false };
const TEXT = { canvasId: CANVAS, prompt: "Write Acme's heading.", schema: SCHEMA };
const QUESTION = {
  canvasId: CANVAS,
  model: "jev-latest",
  state: { request: "a stock app for Acme's warehouse" },
  questions: { platform: { type: "choice", instructions: "Which platform?", criteria: { app: null, web: null } } },
};
const ANSWER = { model: "jev-1.13.0", answers: { platform: { type: "choice", choice: "app", probabilities: { app: 0.8, web: 0.2 }, confidence: 0.6 } }, usage: { input_tokens: 1, output_tokens: 0 } };

interface Call { url: string; headers: Headers }
let daemon: Daemon;
let base: string;
let home: string;
let owner: TestBadge;
let calls: Call[];
const saved: Record<string, string | undefined> = {};
const SPENDER_ENV = ["TYPESAFE_API_KEY", "ISOCAN_TEXT_API_KEY", "ISOCAN_TEXT_PROVIDER", "ISOCAN_TEXT_MODEL", "GEMINI_API_KEY"];

beforeEach(async () => {
  for (const name of SPENDER_ENV) {
    saved[name] = process.env[name];
    delete process.env[name];
  }
  home = await fsp.mkdtemp(path.join(os.tmpdir(), "isocan-keys-spend-"));
  // Priya is this machine's person: a stored key pays for her (owner-only spend, keys phase 3).
  await fsp.writeFile(path.join(home, "identity.json"), JSON.stringify(priya));
  calls = [];
  const fake = (async (url: string, init: RequestInit) => {
    calls.push({ url, headers: new Headers(init.headers) });
    if (String(url).includes("typesafe") || String(url).includes("judge")) return new Response(JSON.stringify(ANSWER), { status: 200 });
    return new Response(JSON.stringify({ id: "msg_acme", type: "message", role: "assistant", model: CLAUDE_TEXT_MODEL, stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ heading: "Acme" }) }] }), { status: 200 });
  }) as unknown as typeof fetch;
  // No `key` option: the daemon's own default — its home's keys.json — is what is under test.
  daemon = await startDaemon({ port: 0, home, auth: null, contentPort: "off", text: { fetch: fake }, judgment: { fetch: fake, backoff: [] } });
  const address = daemon.app.server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  owner = await mintTestBadge(base);
  await owner.speakAs(priya);
  const made = await fetch(`${base}/api/ops`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...owner.headers },
    body: JSON.stringify({ canvasId: null, actor: priya, op: { type: "project.create", canvasId: CANVAS, title: "Acme Keys" } }),
  });
  expect(made.ok).toBe(true);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await daemon.close();
  await fsp.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  for (const name of SPENDER_ENV) {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  }
});

const post = (route: string, body: unknown) =>
  fetch(`${base}${route}`, { method: "POST", headers: { "Content-Type": "application/json", ...owner.headers }, body: JSON.stringify(body) });

describe("the daemon's spenders read keys.json, per call", () => {
  it("text: no key, then a key stored while the daemon runs is used on the next request — no restart", async () => {
    const before = await post(TEXT_ROUTE, TEXT);
    expect(before.status).toBe(503);
    expect(await before.json()).toMatchObject({ code: TEXT_UNAVAILABLE });

    await writeKey(home, "anthropic", ANTHROPIC);
    const after = await post(TEXT_ROUTE, TEXT);
    const text = await after.text();
    expect(after.status, text).toBe(200);
    expect(JSON.parse(text)).toEqual({ model: CLAUDE_TEXT_MODEL, value: { heading: "Acme" } });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.headers.get("x-api-key")).toBe(ANTHROPIC);
    expect(text).not.toContain(ANTHROPIC);
  });

  it("judge: the stored typesafe key is the bearer token", async () => {
    expect((await post(JUDGMENT_ROUTE, QUESTION)).status).toBe(503);
    await writeKey(home, "typesafe", TYPESAFE);
    const res = await post(JUDGMENT_ROUTE, QUESTION);
    const text = await res.text();
    expect(res.status, text).toBe(200);
    expect(calls[0]!.headers.get("authorization")).toBe(`Bearer ${TYPESAFE}`);
    expect(text).not.toContain(TYPESAFE);
  });

  it("the environment wins over the stored key", async () => {
    await writeKey(home, "typesafe", TYPESAFE);
    process.env.TYPESAFE_API_KEY = "tsk_acme_FROM_ENV_0000";
    expect((await post(JUDGMENT_ROUTE, QUESTION)).status).toBe(200);
    expect(calls[0]!.headers.get("authorization")).toBe("Bearer tsk_acme_FROM_ENV_0000");
  });

  it("a keys.json that leaked its mode is refused: the route has no key, stderr says why, and nothing is asked", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const file = await writeKey(home, "typesafe", TYPESAFE);
    await fsp.chmod(file, 0o644);
    const res = await post(JUDGMENT_ROUTE, QUESTION);
    expect(res.status).toBe(503);
    const body = await res.text();
    expect(JSON.parse(body)).toMatchObject({ code: JUDGMENT_UNAVAILABLE });
    expect(body).not.toContain(TYPESAFE);
    expect(calls).toHaveLength(0);
    const said = warn.mock.calls.map((c) => String(c[0])).join("\n");
    expect(said).toMatch(/not 600/);
    expect(said).not.toContain(TYPESAFE);
  });
});
