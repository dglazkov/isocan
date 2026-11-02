import { afterEach, describe, expect, it, vi } from "vitest";
import fs, { promises as fsp } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  JUDGMENT_BAD_REQUEST, JUDGMENT_MAX_BYTES, JUDGMENT_RATE_LIMITED, JUDGMENT_ROUTE, JUDGMENT_TOO_LARGE, JUDGMENT_UNAVAILABLE, JUDGMENT_UPSTREAM,
} from "@isocan/core";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { JUDGE_URL, type JudgmentOptions } from "../src/judgment.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

/**
 * **`POST /api/judgment`** — the home asks the judge with its own key, so a
 * browser never holds one (wireframes phase 5; the judge seam's first door).
 *
 * What is held: the question file goes out in the judge's request shape with
 * the home's key as a bearer token and without the canvas; the judge's answer
 * comes back unchanged; a home with no key refuses with a code; only a badge
 * that may EDIT the canvas is answered (a stranger and a viewer are not, and
 * nothing is asked for them); an oversized file and a spent budget are
 * refused before anything is asked; and the key appears in no response and
 * in no line the daemon logs, even when the judge's own error echoes it.
 *
 * Fixtures are synthetic: Acme, Priya, a made-up key.
 */

const KEY = "tsk_acme_SECRET_DO_NOT_PRINT_1234567890";
const priya = { id: "usr_priya", name: "Priya" };
const CANVAS = "prj_acme_wires";

const QUESTION = {
  canvasId: CANVAS,
  model: "jev-latest",
  state: { request: "a stock app for Acme's warehouse" },
  questions: { platform: { type: "choice", instructions: "Which platform?", criteria: { app: null, web: null } } },
};
const ANSWER = { model: "jev-1.13.0", answers: { platform: { type: "choice", choice: "app", probabilities: { app: 0.8, web: 0.2 }, confidence: 0.6 } }, usage: { input_tokens: 120, output_tokens: 0 } };

interface Rig {
  daemon: Daemon;
  base: string;
  owner: TestBadge;
  calls: Array<{ url: string; auth: string | null; body: unknown }>;
  home: string;
}

const rigs: Rig[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  for (const r of rigs.splice(0)) {
    await r.daemon.close();
    await fsp.rm(r.home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

async function rig(judgment: Partial<JudgmentOptions> & { answer?: (body: unknown) => Response | Promise<Response> } = {}): Promise<Rig> {
  const home = await fsp.mkdtemp(path.join(os.tmpdir(), "isocan-judgment-"));
  const calls: Rig["calls"] = [];
  const { answer, ...rest } = judgment;
  const fake = (async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    calls.push({ url, auth: new Headers(init.headers).get("authorization"), body });
    return answer ? answer(body) : new Response(JSON.stringify(ANSWER), { status: 200, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
  const daemon = await startDaemon({ port: 0, home, auth: null, contentPort: "off", judgment: { key: () => KEY, fetch: fake, backoff: [], ...rest } });
  const address = daemon.app.server.address();
  const base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  const owner = await mintTestBadge(base);
  await owner.speakAs(priya);
  const made = await fetch(`${base}/api/ops`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...owner.headers },
    body: JSON.stringify({ canvasId: null, actor: priya, op: { type: "project.create", canvasId: CANVAS, title: "Acme Wires" } }),
  });
  expect(made.ok).toBe(true);
  const r = { daemon, base, owner, calls, home };
  rigs.push(r);
  return r;
}

const ask = (r: Rig, badge: TestBadge, body: unknown) =>
  fetch(`${r.base}${JUDGMENT_ROUTE}`, { method: "POST", headers: { "Content-Type": "application/json", ...badge.headers }, body: JSON.stringify(body) });

describe("POST /api/judgment", () => {
  it("forwards the question file in the judge's shape, with the home's key, and returns the answer unchanged", async () => {
    const r = await rig();
    const res = await ask(r, r.owner, QUESTION);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(ANSWER);
    expect(r.calls).toHaveLength(1);
    expect(r.calls[0]!.url).toBe(JUDGE_URL);
    expect(r.calls[0]!.auth).toBe(`Bearer ${KEY}`);
    // The canvas is the home's business, not the judge's: it does not travel on.
    expect(r.calls[0]!.body).toEqual({ model: "jev-latest", state: QUESTION.state, questions: QUESTION.questions });
  });

  it("defaults the model when the file names none", async () => {
    const r = await rig();
    const { model: _m, ...unnamed } = QUESTION;
    expect((await ask(r, r.owner, unnamed)).status).toBe(200);
    expect((r.calls[0]!.body as { model: string }).model).toBe("jev-latest");
  });

  it("refuses with judgment-unavailable when the home holds no key — and asks nothing", async () => {
    const r = await rig({ key: () => undefined });
    const res = await ask(r, r.owner, QUESTION);
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ code: JUDGMENT_UNAVAILABLE });
    expect(r.calls).toHaveLength(0);
  });

  it("answers only a badge that may edit the canvas: a stranger and a viewer are refused, and nothing is asked", async () => {
    const r = await rig();
    // A new canvas is born with an edit link; take it away so a stranger is a stranger.
    for (const grant of await r.daemon.desk.grantsFor(CANVAS)) await r.daemon.desk.revokeGrant(grant.id, new Date().toISOString(), r.owner.badgeId);
    const stranger = await mintTestBadge(r.base);
    const refused = await ask(r, stranger, QUESTION);
    expect(refused.status).toBe(403);
    expect(await refused.json()).toMatchObject({ code: "not-admitted" });

    // A view link admits a reader — who may read the canvas and still not spend its judgments.
    const shared = await fetch(`${r.base}/api/projects/${CANVAS}/grants`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...r.owner.headers },
      body: JSON.stringify({ subject: "link", capability: "view" }),
    });
    expect(shared.ok).toBe(true);
    const viewer = await mintTestBadge(r.base);
    expect((await fetch(`${r.base}/api/projects/${CANVAS}/canvas`, { headers: viewer.headers })).status).toBe(200);
    const viewOnly = await ask(r, viewer, QUESTION);
    expect(viewOnly.status).toBe(403);
    expect(await viewOnly.json()).toMatchObject({ code: "view-only" });

    const unknown = await ask(r, r.owner, { ...QUESTION, canvasId: "prj_nowhere" });
    expect(unknown.status).toBeGreaterThanOrEqual(400);
    expect(r.calls).toHaveLength(0);
  });

  it("refuses a badge-less request at the door", async () => {
    const r = await rig();
    const res = await fetch(`${r.base}${JUDGMENT_ROUTE}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(QUESTION) });
    expect([401, 403]).toContain(res.status);
    expect(r.calls).toHaveLength(0);
  });

  it("refuses an oversized question file before anything is asked", async () => {
    const r = await rig();
    const big = { ...QUESTION, state: { padding: "x".repeat(JUDGMENT_MAX_BYTES) } };
    const res = await ask(r, r.owner, big);
    expect(res.status).toBe(413);
    expect(await res.json()).toMatchObject({ code: JUDGMENT_TOO_LARGE });
    expect(r.calls).toHaveLength(0);
  });

  it("refuses what is not a question file", async () => {
    const r = await rig();
    for (const body of [{ ...QUESTION, questions: {} }, { canvasId: CANVAS, questions: QUESTION.questions }, { state: {}, questions: QUESTION.questions }]) {
      const res = await ask(r, r.owner, body);
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ code: JUDGMENT_BAD_REQUEST });
    }
    expect(r.calls).toHaveLength(0);
  });

  it("rate-limits per badge: past the budget is refused with a code, and asks nothing", async () => {
    let now = 1_000_000;
    const r = await rig({ perMinute: 2, now: () => now });
    expect((await ask(r, r.owner, QUESTION)).status).toBe(200);
    expect((await ask(r, r.owner, QUESTION)).status).toBe(200);
    const third = await ask(r, r.owner, QUESTION);
    expect(third.status).toBe(429);
    expect(await third.json()).toMatchObject({ code: JUDGMENT_RATE_LIMITED });
    expect(r.calls).toHaveLength(2);
    // A minute on, the budget is back.
    now += 61_000;
    expect((await ask(r, r.owner, QUESTION)).status).toBe(200);
    expect(r.calls).toHaveLength(3);
  });

  it("says what the judge said when it refuses — as judgment-upstream", async () => {
    const r = await rig({ answer: () => new Response(JSON.stringify({ detail: [{ loc: ["body", "questions"], msg: "field required" }] }), { status: 422 }) });
    const res = await ask(r, r.owner, QUESTION);
    expect(res.status).toBe(502);
    const said = (await res.json()) as { code: string; error: string; status: number };
    expect(said).toMatchObject({ code: JUDGMENT_UPSTREAM, status: 422 });
    expect(said.error).toContain("field required");
  });
});

describe("the key", () => {
  it("appears in no response and in no line the daemon writes — even when the judge echoes it", async () => {
    const written: string[] = [];
    const capture = (chunk: unknown) => {
      written.push(typeof chunk === "string" ? chunk : Buffer.isBuffer(chunk) ? chunk.toString("utf8") : chunk instanceof Uint8Array ? Buffer.from(chunk).toString("utf8") : String(chunk));
    };
    // pino writes through sonic-boom (fs.writeSync / fs.write on fd 1); console and the streams too.
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
      let mode: "ok" | "echo" | "throw" = "ok";
      const r = await rig({
        answer: (body) => {
          if (mode === "echo") return new Response(JSON.stringify({ detail: { message: `bad key Bearer ${KEY}`, error_type: "auth" } }), { status: 401 });
          if (mode === "throw") throw new Error(`connect ECONNREFUSED while sending Bearer ${KEY}`);
          return new Response(JSON.stringify({ ...ANSWER, echoed: body }), { status: 200 });
        },
      });
      for (const m of ["ok", "echo", "throw"] as const) {
        mode = m;
        const res = await ask(r, r.owner, QUESTION);
        responses.push(`${res.status} ${JSON.stringify([...res.headers])} ${await res.text()}`);
      }
      for (const grant of await r.daemon.desk.grantsFor(CANVAS)) await r.daemon.desk.revokeGrant(grant.id, new Date().toISOString(), r.owner.badgeId);
      const stranger = await mintTestBadge(r.base);
      const refused = await ask(r, stranger, QUESTION);
      expect(refused.status).toBe(403);
      responses.push(`${refused.status} ${await refused.text()}`);
    } finally {
      if (before === undefined) delete process.env.ISOCAN_LOG_LEVEL;
      else process.env.ISOCAN_LOG_LEVEL = before;
    }
    // Not vacuous: the daemon did log (trace), and the judge's error words did come back.
    expect(written.join("").length).toBeGreaterThan(0);
    expect(responses.join("\n")).toContain("[key]");
    for (const line of [...responses, ...written]) expect(line).not.toContain(KEY);
  });
});
