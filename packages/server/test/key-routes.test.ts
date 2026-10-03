import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { InjectOptions } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { KEYS_AGENTS_FIELD, KEYS_AGENTS_ROUTE, KEYS_ROUTE, KEYS_SHARING_ROUTE, type KeyRow } from "@isocan/core/keys";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

/**
 * **The settings area's key routes** (keys phase 2): they work from this
 * machine, they are refused from anywhere else, and the value never comes
 * back out — not in a response, not in an error, not on stdout or stderr.
 *
 * A real daemon in-process. `inject` is how a request arrives from a peer
 * that is not loopback, or under a Host the socket would never be asked by:
 * the listening socket is still the real one, so `loopbackBound` reads the
 * real bind.
 */

const SECRET = "sk-ant-journeyfake-0123456789-abcd";
const OTHER = "AIzaFakeGeminiKey-zzzz-9876";

let home: string;
let daemon: Daemon;
let base: string;
let badge: TestBadge;
/** Everything written to stdout/stderr while a test ran — searched for the key. */
let written: string[];
let restore: Array<() => void>;
/** What the fake provider saw, and what it answers. */
let asked: { url: string; headers: Record<string, string> }[];
let answer: { status: number; body: string };

const fakeFetch = (async (url: string | URL | Request, init?: RequestInit) => {
  asked.push({ url: String(url), headers: (init?.headers ?? {}) as Record<string, string> });
  return new Response(answer.body, { status: answer.status, headers: { "content-type": "application/json" } });
}) as typeof fetch;

async function boot(extra: { servesWorld?: boolean; env?: Record<string, string> } = {}): Promise<void> {
  daemon = await startDaemon({
    port: 0,
    home,
    birthHome: null,
    ...(extra.servesWorld !== undefined ? { servesWorld: extra.servesWorld } : {}),
    keys: { env: extra.env ?? {}, fetch: fakeFetch },
  });
  const address = daemon.app.server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  badge = await mintTestBadge(base);
}

async function call(
  method: "GET" | "PUT" | "DELETE" | "POST",
  url: string,
  opts: { body?: unknown; headers?: Record<string, string>; remoteAddress?: string; raw?: string } = {},
): Promise<{ status: number; text: string; json: any }> {
  const res = await daemon.app.inject({
    method,
    url,
    remoteAddress: opts.remoteAddress ?? "127.0.0.1",
    headers: {
      host: new URL(base).host,
      ...badge.headers,
      ...(opts.body !== undefined ? { "content-type": "application/json" } : {}),
      ...opts.headers,
    },
    ...(opts.body !== undefined ? { payload: JSON.stringify(opts.body) } : opts.raw !== undefined ? { payload: opts.raw } : {}),
  } as InjectOptions);
  let json: any = null;
  try {
    json = JSON.parse(res.body);
  } catch {
    json = null;
  }
  return { status: res.statusCode, text: res.body, json };
}

const rowFor = (json: { keys: KeyRow[] }, provider: string) => json.keys.find((r) => r.provider === provider)!;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-keyroutes-"));
  asked = [];
  answer = { status: 200, body: JSON.stringify({ data: [] }) };
  written = [];
  restore = [];
  for (const stream of [process.stdout, process.stderr]) {
    const original = stream.write.bind(stream);
    stream.write = ((chunk: unknown, ...rest: unknown[]) => {
      written.push(String(chunk));
      return (original as (...a: unknown[]) => boolean)(chunk, ...rest);
    }) as typeof stream.write;
    restore.push(() => {
      stream.write = original;
    });
  }
});

afterEach(async () => {
  for (const undo of restore) undo();
  await daemon?.close();
  await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

describe("the key routes, from this machine", () => {
  beforeEach(() => boot());

  it("lists every provider as not set, and sets, tests and removes one — never handing the value back", async () => {
    const empty = await call("GET", KEYS_ROUTE);
    expect(empty.status).toBe(200);
    expect(empty.json.keys.map((r: KeyRow) => r.provider)).toEqual(["anthropic", "openai", "gemini", "typesafe"]);
    expect(empty.json.keys.every((r: KeyRow) => !r.stored)).toBe(true);
    expect(rowFor(empty.json, "anthropic").usedFor.length).toBeGreaterThan(0);

    const set = await call("PUT", `${KEYS_ROUTE}/anthropic`, { body: { key: SECRET } });
    expect(set.status).toBe(200);
    expect(set.json).toMatchObject({ provider: "anthropic", stored: true, lastFour: "…abcd" });

    // On disk, 0600, under THIS daemon's home.
    const file = path.join(home, "keys.json");
    expect(JSON.parse(await fs.readFile(file, "utf8")).anthropic.key).toBe(SECRET);
    if (process.platform !== "win32") expect((await fs.stat(file)).mode & 0o777).toBe(0o600);

    const listed = await call("GET", KEYS_ROUTE);
    expect(rowFor(listed.json, "anthropic")).toMatchObject({ stored: true, lastFour: "…abcd", inUse: "file", env: null });
    expect(rowFor(listed.json, "anthropic").addedAt).toBeTruthy();

    const tested = await call("POST", `${KEYS_ROUTE}/anthropic/test`);
    expect(tested.status).toBe(200);
    expect(tested.json).toMatchObject({ provider: "anthropic", ok: true, answer: "accepted", key: "stored …abcd" });
    // The fake provider was asked WITH the key — the one place it is meant to go.
    expect(asked).toHaveLength(1);
    expect(asked[0]!.url).toContain("api.anthropic.com");
    expect(asked[0]!.headers["x-api-key"]).toBe(SECRET);

    const removed = await call("DELETE", `${KEYS_ROUTE}/anthropic`);
    expect(removed.json).toEqual({ provider: "anthropic", removed: true });
    expect(rowFor((await call("GET", KEYS_ROUTE)).json, "anthropic").stored).toBe(false);
    expect((await call("DELETE", `${KEYS_ROUTE}/anthropic`)).json.removed).toBe(false);

    for (const res of [empty, set, listed, tested, removed]) expect(res.text).not.toContain(SECRET);
    expect(written.join("")).not.toContain(SECRET);
  });

  it("reports the give-to-agents switch, off by default, and PUT /api/keys/agents flips it keeping the keys (keys phase 4)", async () => {
    expect((await call("GET", KEYS_ROUTE)).json).toMatchObject({ share: false, agents: false });
    await call("PUT", `${KEYS_ROUTE}/anthropic`, { body: { key: SECRET } });
    const on = await call("PUT", KEYS_AGENTS_ROUTE, { body: { agents: true } });
    expect(on.status, on.text).toBe(200);
    expect(on.json).toMatchObject({ agents: true, share: false });
    expect(rowFor(on.json, "anthropic").stored).toBe(true);
    const onDisk = JSON.parse(await fs.readFile(path.join(home, "keys.json"), "utf8"));
    expect(onDisk[KEYS_AGENTS_FIELD]).toBe(true);
    expect(onDisk.anthropic.key).toBe(SECRET);
    // The sharing switch is the other field: flipping it keeps this one.
    expect((await call("PUT", KEYS_SHARING_ROUTE, { body: { share: true } })).json).toMatchObject({ agents: true, share: true });
    expect((await call("PUT", KEYS_AGENTS_ROUTE, { body: { agents: "yes" } })).status).toBe(400);
    expect((await call("PUT", KEYS_AGENTS_ROUTE, { body: { agents: false } })).json).toMatchObject({ agents: false, share: true });
    expect(written.join("")).not.toContain(SECRET);
    expect(on.text).not.toContain(SECRET);
  });

  it("says the provider's reason when the key is refused, with the key scrubbed out of it", async () => {
    await call("PUT", `${KEYS_ROUTE}/gemini`, { body: { key: OTHER } });
    // A provider that echoes the key in its error must not get it printed.
    answer = { status: 400, body: JSON.stringify({ error: { message: `API key not valid: ${OTHER}` } }) };
    const tested = await call("POST", `${KEYS_ROUTE}/gemini/test`);
    expect(tested.status).toBe(200);
    expect(tested.json.ok).toBe(false);
    expect(tested.json.answer).toContain("API key not valid");
    expect(tested.json.answer).toContain("[key]");
    expect(tested.text).not.toContain(OTHER);
    expect(written.join("")).not.toContain(OTHER);
  });

  it("tests nothing when there is no key, and refuses an unknown provider without echoing it", async () => {
    expect((await call("POST", `${KEYS_ROUTE}/typesafe/test`)).status).toBe(404);
    expect(asked).toHaveLength(0);
    const odd = await call("PUT", `${KEYS_ROUTE}/${SECRET}`, { body: { key: "x" } });
    expect(odd.status).toBe(400);
    expect(odd.text).not.toContain(SECRET);
  });

  it("takes JSON only: a text/plain PUT and a malformed body store nothing and quote nothing", async () => {
    const plain = await call("PUT", `${KEYS_ROUTE}/anthropic`, { raw: JSON.stringify({ key: SECRET }), headers: { "content-type": "text/plain" } });
    expect(plain.status).toBe(415);
    const broken = await call("PUT", `${KEYS_ROUTE}/anthropic`, { raw: `{"key": "${SECRET}"`, headers: { "content-type": "application/json" } });
    expect(broken.status).toBe(400);
    for (const res of [plain, broken]) expect(res.text).not.toContain(SECRET);
    await expect(fs.stat(path.join(home, "keys.json"))).rejects.toThrow();
    const empty = await call("PUT", `${KEYS_ROUTE}/anthropic`, { body: {} });
    expect(empty.status).toBe(400);
    expect(written.join("")).not.toContain(SECRET);
  });

  it("refuses a foreign Origin, a foreign Host and a peer that is not loopback — and stores nothing", async () => {
    const attempts = [
      await call("PUT", `${KEYS_ROUTE}/anthropic`, { body: { key: SECRET }, headers: { origin: "https://evil.example" } }),
      await call("PUT", `${KEYS_ROUTE}/anthropic`, { body: { key: SECRET }, headers: { host: "rebound.evil.example" } }),
      await call("PUT", `${KEYS_ROUTE}/anthropic`, { body: { key: SECRET }, remoteAddress: "10.0.0.5" }),
    ];
    expect(attempts.map((a) => a.status)).toEqual([403, 403, 404]);
    for (const a of attempts) expect(a.text).not.toContain(SECRET);
    await expect(fs.stat(path.join(home, "keys.json"))).rejects.toThrow();
    // Reads and the test are gated alike.
    expect((await call("GET", KEYS_ROUTE, { headers: { origin: "https://evil.example" } })).status).toBe(403);
    expect((await call("GET", KEYS_ROUTE, { remoteAddress: "192.168.1.9" })).status).toBe(404);
    expect((await call("POST", `${KEYS_ROUTE}/anthropic/test`, { headers: { host: "evil.example:4441" } })).status).toBe(403);
    expect((await call("DELETE", `${KEYS_ROUTE}/anthropic`, { headers: { origin: "null" } })).status).toBe(403);
    // This machine's own page is not refused: a loopback Origin.
    expect((await call("GET", KEYS_ROUTE, { headers: { origin: "http://localhost:5173" } })).status).toBe(200);
    expect(written.join("")).not.toContain(SECRET);
  });
});

describe("the key routes, where the environment wins", () => {
  beforeEach(() => boot({ env: { TYPESAFE_API_KEY: "tsk-from-the-environment-wxyz" } }));

  it("says the environment overrides, by variable and last four, and tests the key spenders would use", async () => {
    await call("PUT", `${KEYS_ROUTE}/typesafe`, { body: { key: SECRET } });
    const row = rowFor((await call("GET", KEYS_ROUTE)).json, "typesafe");
    expect(row).toMatchObject({ stored: true, lastFour: "…abcd", inUse: "env", env: { variable: "TYPESAFE_API_KEY", lastFour: "…wxyz" } });
    answer = { status: 422, body: "{}" };
    const tested = await call("POST", `${KEYS_ROUTE}/typesafe/test`);
    expect(tested.json).toMatchObject({ ok: true, key: "TYPESAFE_API_KEY …wxyz" });
  });
});

describe("the key routes, on a home that serves the world", () => {
  beforeEach(() => boot({ servesWorld: true }));

  it("does not have them: 404 for every verb, nothing stored", async () => {
    const statuses = [
      (await call("GET", KEYS_ROUTE)).status,
      (await call("PUT", `${KEYS_ROUTE}/anthropic`, { body: { key: SECRET } })).status,
      (await call("DELETE", `${KEYS_ROUTE}/anthropic`)).status,
      (await call("POST", `${KEYS_ROUTE}/anthropic/test`)).status,
    ];
    expect(statuses).toEqual([404, 404, 404, 404]);
    const res = await call("GET", KEYS_ROUTE);
    expect(res.json.code).toBe("keys-not-here");
    await expect(fs.stat(path.join(home, "keys.json"))).rejects.toThrow();
    expect(written.join("")).not.toContain(SECRET);
  });
});
