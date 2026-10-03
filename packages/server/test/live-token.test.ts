import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fsp } from "node:fs";
import os from "node:os";
import path from "node:path";
import { LIVE_TOKEN_BAD_REQUEST, LIVE_TOKEN_OWNER_ONLY, LIVE_TOKEN_RATE_LIMITED, LIVE_TOKEN_ROUTE, LIVE_TOKEN_UNAVAILABLE, LIVE_TOKEN_UPSTREAM, ownerOnlySentence } from "@isocan/core/keys";
import { removeKey, setKeySharing, writeKey } from "@isocan/core/keystore";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { LIVE_TOKEN_ENDPOINT } from "../src/live-token.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

/**
 * **`POST /api/voice/token`** (keys phase 4). The talk module asks here once
 * per session for a short-lived Gemini Live token, so the browser never holds
 * a key. The route is `/api/text`'s door: the canvas named and editable, the
 * stored key spent only for this machine's person unless sharing is on, an
 * environment key for everyone, a per-badge rate — and no answer and no log
 * line carries the key.
 *
 * A real daemon on a temp home, real badges over HTTP, a fake Google behind
 * the `fetch` seam: what Google's real `auth_tokens` endpoint answers is NOT
 * proved here (no key in the suite) — the request's shape is pinned to the
 * one `@google/genai`'s `tokens.create` sends. Synthetic fixtures: Acme,
 * Priya, Ravi, made-up keys.
 */

const GEMINI = "AIza-acme_OWNER_DO_NOT_PRINT_1234567890";
const ENV_GEMINI = "AIza-acme_ENV_DO_NOT_PRINT_0987654321";
const SECRETS = [GEMINI, ENV_GEMINI];
const priya = { id: "usr_priya", name: "Priya" };
const ravi = { id: "usr_ravi", name: "Ravi" };
const CANVAS = "prj_acme_voice";

interface Call { url: string; headers: Headers; body: Record<string, unknown> }
let daemon: Daemon;
let base: string;
let home: string;
let owner: TestBadge;
let calls: Call[];
let bodies: string[];
let logged: string[];
let googleAnswer: () => Response;
let saved: string | undefined;

beforeEach(async () => {
  saved = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  logged = [];
  for (const level of ["log", "warn", "error", "info"] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => void logged.push(args.map(String).join(" ")));
  }
  home = await fsp.mkdtemp(path.join(os.tmpdir(), "isocan-live-token-"));
  await fsp.writeFile(path.join(home, "identity.json"), JSON.stringify(priya));
  await writeKey(home, "gemini", GEMINI);
  calls = [];
  bodies = [];
  let n = 0;
  googleAnswer = () => new Response(JSON.stringify({ name: `auth_tokens/acme-${++n}` }), { status: 200 });
  const fake = (async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), headers: new Headers(init.headers), body: JSON.parse(String(init.body)) as Record<string, unknown> });
    return googleAnswer();
  }) as unknown as typeof fetch;
  daemon = await startDaemon({ port: 0, home, auth: null, contentPort: "off", liveToken: { fetch: fake, perMinute: 3 } });
  const address = daemon.app.server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  owner = await mintTestBadge(base);
  await owner.speakAs(priya);
  const made = await fetch(`${base}/api/ops`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...owner.headers },
    body: JSON.stringify({ canvasId: null, actor: priya, op: { type: "project.create", canvasId: CANVAS, title: "Acme Voice" } }),
  });
  expect(made.ok).toBe(true);
});

afterEach(async () => {
  await daemon.close();
  vi.restoreAllMocks();
  await fsp.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  if (saved === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = saved;
  for (const text of [...bodies, ...logged]) for (const secret of SECRETS) expect(text).not.toContain(secret);
});

const ask = async (badge: TestBadge, body: unknown = { canvasId: CANVAS }) => {
  const res = await fetch(`${base}${LIVE_TOKEN_ROUTE}`, { method: "POST", headers: { "Content-Type": "application/json", ...badge.headers }, body: JSON.stringify(body) });
  const text = await res.text();
  bodies.push(text);
  return { status: res.status, text, json: JSON.parse(text) as { token?: string; expireTime?: string; newSessionExpireTime?: string; code?: string; error?: string } };
};

const collaborator = async (): Promise<TestBadge> => {
  const badge = await mintTestBadge(base);
  await badge.speakAs(ravi);
  return badge;
};

describe("the voice token route: a one-use Live token, never the key", () => {
  it("mints a fresh token per ask with the stored key, sent only in Google's header", async () => {
    const first = await ask(owner);
    expect(first.status, first.text).toBe(200);
    expect(first.json.token).toBe("auth_tokens/acme-1");
    expect(Date.parse(first.json.newSessionExpireTime!)).toBeLessThan(Date.parse(first.json.expireTime!));
    const second = await ask(owner);
    expect(second.json.token).toBe("auth_tokens/acme-2");
    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect(call.url).toBe(LIVE_TOKEN_ENDPOINT);
      expect(call.headers.get("x-goog-api-key")).toBe(GEMINI);
      expect(call.url).not.toContain(GEMINI);
      // One session per token, and a minute to start it.
      expect(call.body.uses).toBe(1);
      expect(typeof call.body.expireTime).toBe("string");
      expect(typeof call.body.newSessionExpireTime).toBe("string");
    }
  });

  it("refuses a collaborator while sharing is off — nothing reaches Google — and serves them once it is on", async () => {
    const ravisBadge = await collaborator();
    const refused = await ask(ravisBadge);
    expect(refused.status, refused.text).toBe(403);
    expect(refused.json).toEqual({ code: LIVE_TOKEN_OWNER_ONLY, error: ownerOnlySentence("Priya") });
    expect(calls).toHaveLength(0);
    await setKeySharing(home, true);
    const served = await ask(ravisBadge);
    expect(served.status, served.text).toBe(200);
    expect(calls).toHaveLength(1);
  });

  it("an environment key serves every editor, and wins over the stored one", async () => {
    process.env.GEMINI_API_KEY = ENV_GEMINI;
    const served = await ask(await collaborator());
    expect(served.status, served.text).toBe(200);
    expect(calls[0]!.headers.get("x-goog-api-key")).toBe(ENV_GEMINI);
  });

  it("says when this home holds no Gemini key, and when the ask names no canvas", async () => {
    await removeKey(home, "gemini");
    const none = await ask(owner);
    expect(none.status, none.text).toBe(503);
    expect(none.json.code).toBe(LIVE_TOKEN_UNAVAILABLE);
    const bad = await ask(owner, {});
    expect(bad.status).toBe(400);
    expect(bad.json.code).toBe(LIVE_TOKEN_BAD_REQUEST);
    expect(calls).toHaveLength(0);
  });

  it("holds a badge to its rate", async () => {
    for (let i = 0; i < 3; i++) expect((await ask(owner)).status).toBe(200);
    const limited = await ask(owner);
    expect(limited.status).toBe(429);
    expect(limited.json.code).toBe(LIVE_TOKEN_RATE_LIMITED);
    expect(calls).toHaveLength(3);
  });

  it("passes Google's refusal on in its words, with the key scrubbed if Google quoted it", async () => {
    googleAnswer = () => new Response(JSON.stringify({ error: { message: `API key not valid: ${GEMINI}` } }), { status: 400 });
    const refused = await ask(owner);
    expect(refused.status).toBe(502);
    expect(refused.json.code).toBe(LIVE_TOKEN_UPSTREAM);
    expect(refused.json.error).toContain("API key not valid: [key]");
  });
});
