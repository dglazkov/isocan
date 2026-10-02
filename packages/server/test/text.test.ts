import { afterEach, describe, expect, it, vi } from "vitest";
import fs, { promises as fsp } from "node:fs";
import os from "node:os";
import path from "node:path";
import { CLAUDE_MESSAGES_URL, CLAUDE_TEXT_MODEL } from "@isocan/core/jev";
import {
  TEXT_BAD_REQUEST, TEXT_MAX_BYTES, TEXT_RATE_LIMITED, TEXT_ROUTE, TEXT_TOO_LARGE, TEXT_UNAVAILABLE, TEXT_UPSTREAM,
} from "@isocan/core/text";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import type { TextOptions } from "../src/text.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

/**
 * **`POST /api/text`** — the home writes schema-shaped words with its own
 * key, so a browser never holds one (copy-edit phase 0.5; the judgment
 * route's twin, held the same way as `judgment.test.ts`).
 *
 * What is held: the prompt and schema go out to the provider with the home's
 * key and without the canvas; the value comes back with the model that wrote
 * it; a home with no key refuses with `text-unavailable`; only a badge that
 * may EDIT the canvas is answered (a stranger and a viewer are not, and
 * nothing is asked for them); an oversized request and a spent budget are
 * refused before anything is asked; the key appears in no response and in no
 * line the daemon logs, even when the provider's own error echoes it; and a
 * daemon with no key forwards a canvas homed elsewhere to its home.
 *
 * Fixtures are synthetic: Acme, Priya, a made-up key.
 */

const KEY = "sk-ant-acme_SECRET_DO_NOT_PRINT_1234567890";
const priya = { id: "usr_priya", name: "Priya" };
const CANVAS = "prj_acme_words";

const SCHEMA = {
  type: "object" as const,
  properties: { heading: { type: "string" as const }, actions: { type: "array" as const, items: { type: "string" as const }, minItems: 3, maxItems: 3 } },
  required: ["heading", "actions"],
  additionalProperties: false,
};
const REQUEST = { canvasId: CANVAS, prompt: "Write the words for Acme's stock screen.", schema: SCHEMA };
const VALUE = { heading: "Acme stock", actions: ["Restock", "Count", "Export"] };
const claudeSays = (value: unknown, extra: Record<string, unknown> = {}) =>
  new Response(JSON.stringify({ id: "msg_acme", type: "message", role: "assistant", model: CLAUDE_TEXT_MODEL, stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(value) }], ...extra }), { status: 200, headers: { "content-type": "application/json" } });

interface Call { url: string; headers: Headers; body: Record<string, unknown> }
interface Rig {
  daemon: Daemon;
  base: string;
  owner: TestBadge;
  calls: Call[];
  home: string;
}

const rigs: Rig[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  for (const r of rigs.splice(0).reverse()) {
    await r.daemon.close();
    await fsp.rm(r.home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

function fakeProvider(calls: Call[], answer?: (body: Record<string, unknown>) => Response | Promise<Response>) {
  return (async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    calls.push({ url, headers: new Headers(init.headers), body });
    return answer ? answer(body) : claudeSays(VALUE);
  }) as unknown as typeof fetch;
}

async function rig(text: Partial<TextOptions> & { answer?: (body: Record<string, unknown>) => Response | Promise<Response> } = {}, extra: { birthHome?: string | null } = {}): Promise<Rig> {
  const home = await fsp.mkdtemp(path.join(os.tmpdir(), "isocan-text-"));
  const calls: Call[] = [];
  const { answer, ...rest } = text;
  const daemon = await startDaemon({ port: 0, home, auth: null, contentPort: "off", birthHome: extra.birthHome ?? null, homePollMs: 50, text: { key: () => KEY, fetch: fakeProvider(calls, answer), ...rest } });
  const address = daemon.app.server.address();
  const base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  const owner = await mintTestBadge(base);
  await owner.speakAs(priya);
  const r = { daemon, base, owner, calls, home };
  rigs.push(r);
  return r;
}

async function withCanvas(r: Rig): Promise<Rig> {
  const made = await fetch(`${r.base}/api/ops`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...r.owner.headers },
    body: JSON.stringify({ canvasId: null, actor: priya, op: { type: "project.create", canvasId: CANVAS, title: "Acme Words" } }),
  });
  expect(made.ok).toBe(true);
  return r;
}

const ask = (r: Rig, badge: TestBadge, body: unknown) =>
  fetch(`${r.base}${TEXT_ROUTE}`, { method: "POST", headers: { "Content-Type": "application/json", ...badge.headers }, body: JSON.stringify(body) });

describe("POST /api/text", () => {
  it("asks Claude with the home's key — the prompt and a closed schema, not the canvas — and answers the value and the model", async () => {
    const r = await withCanvas(await rig());
    const res = await ask(r, r.owner, REQUEST);
    expect(res.status, await res.clone().text()).toBe(200);
    expect(await res.json()).toEqual({ model: CLAUDE_TEXT_MODEL, value: VALUE });
    expect(r.calls).toHaveLength(1);
    const call = r.calls[0]!;
    expect(call.url).toBe(CLAUDE_MESSAGES_URL);
    expect(call.headers.get("x-api-key")).toBe(KEY);
    expect(call.headers.get("anthropic-version")).toBe("2023-06-01");
    expect(call.body.model).toBe(CLAUDE_TEXT_MODEL);
    expect(call.body.messages).toEqual([{ role: "user", content: REQUEST.prompt }]);
    expect(JSON.stringify(call.body)).not.toContain(CANVAS);
  });

  it("refuses with text-unavailable, in a sentence, when the home holds no key — and asks nothing", async () => {
    const r = await withCanvas(await rig({ key: () => undefined }));
    const res = await ask(r, r.owner, REQUEST);
    expect(res.status).toBe(503);
    const said = (await res.json()) as { code: string; error: string };
    expect(said.code).toBe(TEXT_UNAVAILABLE);
    expect(said.error).toMatch(/no text model/);
    expect(r.calls).toHaveLength(0);
  });

  it("answers only a badge that may edit the canvas: a stranger and a viewer are refused, and nothing is asked", async () => {
    const r = await withCanvas(await rig());
    for (const grant of await r.daemon.desk.grantsFor(CANVAS)) await r.daemon.desk.revokeGrant(grant.id, new Date().toISOString(), r.owner.badgeId);
    const stranger = await mintTestBadge(r.base);
    const refused = await ask(r, stranger, REQUEST);
    expect(refused.status).toBe(403);
    expect(await refused.json()).toMatchObject({ code: "not-admitted" });

    const shared = await fetch(`${r.base}/api/projects/${CANVAS}/grants`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...r.owner.headers },
      body: JSON.stringify({ subject: "link", capability: "view" }),
    });
    expect(shared.ok).toBe(true);
    const viewer = await mintTestBadge(r.base);
    expect((await fetch(`${r.base}/api/projects/${CANVAS}/canvas`, { headers: viewer.headers })).status).toBe(200);
    const viewOnly = await ask(r, viewer, REQUEST);
    expect(viewOnly.status).toBe(403);
    expect(await viewOnly.json()).toMatchObject({ code: "view-only" });

    const unknown = await ask(r, r.owner, { ...REQUEST, canvasId: "prj_nowhere" });
    expect(unknown.status).toBeGreaterThanOrEqual(400);
    expect(r.calls).toHaveLength(0);
  });

  it("refuses a badge-less request at the door", async () => {
    const r = await withCanvas(await rig());
    const res = await fetch(`${r.base}${TEXT_ROUTE}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(REQUEST) });
    expect([401, 403]).toContain(res.status);
    expect(r.calls).toHaveLength(0);
  });

  it("refuses an oversized request before anything is asked", async () => {
    const r = await withCanvas(await rig());
    const res = await ask(r, r.owner, { ...REQUEST, prompt: "x".repeat(TEXT_MAX_BYTES) });
    expect(res.status).toBe(413);
    expect(await res.json()).toMatchObject({ code: TEXT_TOO_LARGE });
    expect(r.calls).toHaveLength(0);
  });

  it("refuses what is not a text request", async () => {
    const r = await withCanvas(await rig());
    for (const body of [{ ...REQUEST, prompt: "" }, { ...REQUEST, schema: undefined }, { ...REQUEST, schema: ["x"] }, { prompt: REQUEST.prompt, schema: SCHEMA }]) {
      const res = await ask(r, r.owner, body);
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ code: TEXT_BAD_REQUEST });
    }
    expect(r.calls).toHaveLength(0);
  });

  it("rate-limits per badge: past the budget is refused with a code, and asks nothing", async () => {
    let now = 1_000_000;
    const r = await withCanvas(await rig({ perMinute: 2, now: () => now }));
    expect((await ask(r, r.owner, REQUEST)).status).toBe(200);
    expect((await ask(r, r.owner, REQUEST)).status).toBe(200);
    const third = await ask(r, r.owner, REQUEST);
    expect(third.status).toBe(429);
    expect(await third.json()).toMatchObject({ code: TEXT_RATE_LIMITED });
    expect(r.calls).toHaveLength(2);
    now += 61_000;
    expect((await ask(r, r.owner, REQUEST)).status).toBe(200);
    expect(r.calls).toHaveLength(3);
  });

  it("says what the provider said when it refuses — as text-upstream", async () => {
    const r = await withCanvas(await rig({ answer: () => new Response(JSON.stringify({ type: "error", error: { type: "overloaded_error", message: "Acme overloaded" } }), { status: 529 }) }));
    const res = await ask(r, r.owner, REQUEST);
    expect(res.status).toBe(502);
    const said = (await res.json()) as { code: string; error: string };
    expect(said.code).toBe(TEXT_UPSTREAM);
    expect(said.error).toContain("Acme overloaded");
  });

  it("names the OpenAI-shaped provider when told to, and reports that model", async () => {
    const r = await withCanvas(await rig({
      key: () => "acme-openai-key",
      provider: () => "openai",
      model: () => "acme-mini",
      answer: () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(VALUE) } }] }), { status: 200 }),
    }));
    const res = await ask(r, r.owner, REQUEST);
    expect(await res.json()).toEqual({ model: "acme-mini", value: VALUE });
    expect(r.calls[0]!.url).toBe("https://api.openai.com/v1/chat/completions");
    expect(r.calls[0]!.headers.get("authorization")).toBe("Bearer acme-openai-key");
  });
});

describe("a canvas homed elsewhere", () => {
  it("is written for at its home when this daemon holds no key — with the home's key, the badge's edit rung checked here", async () => {
    const upstream = await withCanvas(await rig());
    const relay = await rig({ key: () => undefined });
    const relayBadge = relay.owner;
    const pass = await fetch(`${upstream.base}/api/projects/${CANVAS}/passes`, { method: "POST", headers: { "Content-Type": "application/json", ...upstream.owner.headers }, body: JSON.stringify({ actorId: priya.id }) });
    expect(pass.status, await pass.clone().text()).toBe(200);
    const { token } = (await pass.json()) as { token: string };
    const redeemed = await fetch(`${relay.base}/api/passes/redeem`, { method: "POST", headers: { "Content-Type": "application/json", ...relayBadge.headers }, body: JSON.stringify({ home: upstream.base, token }) });
    expect(redeemed.status, await redeemed.clone().text()).toBe(200);
    await expect.poll(() => relay.daemon.homes.for(CANVAS) !== null).toBe(true);

    const res = await ask(relay, relayBadge, REQUEST);
    expect(res.status, await res.clone().text()).toBe(200);
    expect(await res.json()).toEqual({ model: CLAUDE_TEXT_MODEL, value: VALUE });
    expect(relay.calls).toHaveLength(0);
    expect(upstream.calls).toHaveLength(1);
    expect(upstream.calls[0]!.headers.get("x-api-key")).toBe(KEY);
  });
});

describe("the key", () => {
  it("appears in no response and in no line the daemon writes — even when the provider echoes it", async () => {
    const written: string[] = [];
    const capture = (chunk: unknown) => {
      written.push(typeof chunk === "string" ? chunk : Buffer.isBuffer(chunk) ? chunk.toString("utf8") : chunk instanceof Uint8Array ? Buffer.from(chunk).toString("utf8") : String(chunk));
    };
    const origWriteSync = fs.writeSync;
    vi.spyOn(fs, "writeSync").mockImplementation(((fd: number, data: unknown, ...rest: unknown[]) => {
      if (fd === 1 || fd === 2) capture(data);
      return (origWriteSync as (...a: unknown[]) => number)(fd, data, ...rest);
    }) as typeof fs.writeSync);
    const origWrite = fs.write;
    vi.spyOn(fs, "write").mockImplementation(((fd: number, data: unknown, ...rest: unknown[]) => {
      if (fd === 1 || fd === 2) capture(data);
      return (origWrite as (...a: unknown[]) => void)(fd, data, ...rest);
    }) as typeof fs.write);
    for (const stream of [process.stdout, process.stderr]) {
      const orig = stream.write.bind(stream);
      vi.spyOn(stream, "write").mockImplementation(((chunk: unknown, ...rest: unknown[]) => {
        capture(chunk);
        return (orig as (...a: unknown[]) => boolean)(chunk, ...rest);
      }) as typeof stream.write);
    }
    for (const level of ["log", "info", "warn", "error", "debug"] as const) vi.spyOn(console, level).mockImplementation((...args) => capture(args.join(" ")));

    const before = process.env.ISOCAN_LOG_LEVEL;
    process.env.ISOCAN_LOG_LEVEL = "trace";
    const responses: string[] = [];
    try {
      let mode: "ok" | "echo" | "throw" | "value" = "ok";
      const r = await withCanvas(await rig({
        answer: () => {
          if (mode === "echo") return new Response(JSON.stringify({ type: "error", error: { type: "authentication_error", message: `invalid x-api-key ${KEY}` } }), { status: 401 });
          if (mode === "throw") throw new Error(`connect ECONNREFUSED while sending x-api-key ${KEY}`);
          if (mode === "value") return claudeSays({ heading: `Acme ${KEY}`, actions: [] });
          return claudeSays(VALUE);
        },
      }));
      for (const m of ["ok", "echo", "throw", "value"] as const) {
        mode = m;
        const res = await ask(r, r.owner, REQUEST);
        responses.push(`${res.status} ${JSON.stringify([...res.headers])} ${await res.text()}`);
      }
      for (const grant of await r.daemon.desk.grantsFor(CANVAS)) await r.daemon.desk.revokeGrant(grant.id, new Date().toISOString(), r.owner.badgeId);
      const stranger = await mintTestBadge(r.base);
      const refused = await ask(r, stranger, REQUEST);
      expect(refused.status).toBe(403);
      responses.push(`${refused.status} ${await refused.text()}`);
    } finally {
      if (before === undefined) delete process.env.ISOCAN_LOG_LEVEL;
      else process.env.ISOCAN_LOG_LEVEL = before;
    }
    expect(written.join("").length).toBeGreaterThan(0);
    expect(responses.join("\n")).toContain("[key]");
    for (const line of [...responses, ...written]) expect(line).not.toContain(KEY);
  });
});
