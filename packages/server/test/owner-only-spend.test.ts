import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fsp } from "node:fs";
import os from "node:os";
import path from "node:path";
import { JUDGMENT_ROUTE } from "@isocan/core";
import { CLAUDE_TEXT_MODEL } from "@isocan/core/jev";
import { JUDGMENT_OWNER_ONLY, KEYS_ROUTE, KEYS_SHARING_ROUTE, ownerOnlySentence, TEXT_OWNER_ONLY } from "@isocan/core/keys";
import { readKeyFile, setKeySharing, writeKey } from "@isocan/core/keystore";
import { TEXT_ROUTE } from "@isocan/core/text";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

/**
 * **Owner-only spend** (keys phase 3; `docs/projects/keys/design.md`). A key
 * stored in this machine's keys.json is its person's own: `/api/text` and
 * `/api/judgment` spend it for a badge that speaks for that person (the
 * `identity.json` beside it), or for an identity joined with them — and refuse
 * a collaborator who may edit the canvas, with the owner-only code and a
 * sentence naming the owner, before anything reaches the provider. Turning
 * sharing on serves the collaborator; an environment key serves them
 * regardless, as it always did. No response and no log line carries a key.
 *
 * A real daemon on a temp home, real badges over HTTP, a fake provider.
 * Fixtures are synthetic: Acme, Priya, Ravi, made-up keys.
 */

const ANTHROPIC = "sk-ant-acme_OWNER_DO_NOT_PRINT_1234567890";
const TYPESAFE = "tsk_acme_OWNER_DO_NOT_PRINT_1234567890";
const ENV_TEXT = "sk-ant-acme_ENV_DO_NOT_PRINT_0987654321";
const SECRETS = [ANTHROPIC, TYPESAFE, ENV_TEXT];
const priya = { id: "usr_priya", name: "Priya" };
const tablet = { id: "usr_priya_tablet", name: "Priya Tablet" };
const ravi = { id: "usr_ravi", name: "Ravi" };
const CANVAS = "prj_acme_owner_only";
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
let bodies: string[];
let logged: string[];
const saved: Record<string, string | undefined> = {};
const SPENDER_ENV = ["TYPESAFE_API_KEY", "ISOCAN_TEXT_API_KEY", "ISOCAN_TEXT_PROVIDER", "ISOCAN_TEXT_MODEL", "GEMINI_API_KEY"];

beforeEach(async () => {
  for (const name of SPENDER_ENV) {
    saved[name] = process.env[name];
    delete process.env[name];
  }
  logged = [];
  for (const level of ["log", "warn", "error", "info"] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => void logged.push(args.map(String).join(" ")));
  }
  home = await fsp.mkdtemp(path.join(os.tmpdir(), "isocan-owner-only-"));
  // Priya is this machine's person; her keys are in its keys.json.
  await fsp.writeFile(path.join(home, "identity.json"), JSON.stringify(priya));
  await writeKey(home, "anthropic", ANTHROPIC);
  await writeKey(home, "typesafe", TYPESAFE);
  calls = [];
  bodies = [];
  const fake = (async (url: string, init: RequestInit) => {
    calls.push({ url, headers: new Headers(init.headers) });
    if (String(url).includes("typesafe")) return new Response(JSON.stringify(ANSWER), { status: 200 });
    return new Response(JSON.stringify({ id: "msg_acme", type: "message", role: "assistant", model: CLAUDE_TEXT_MODEL, stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ heading: "Acme" }) }] }), { status: 200 });
  }) as unknown as typeof fetch;
  daemon = await startDaemon({ port: 0, home, auth: null, contentPort: "off", text: { fetch: fake }, judgment: { fetch: fake, backoff: [] } });
  const address = daemon.app.server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  owner = await mintTestBadge(base);
  await owner.speakAs(priya);
  const made = await fetch(`${base}/api/ops`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...owner.headers },
    body: JSON.stringify({ canvasId: null, actor: priya, op: { type: "project.create", canvasId: CANVAS, title: "Acme Owner Only" } }),
  });
  expect(made.ok).toBe(true);
});

afterEach(async () => {
  await daemon.close();
  vi.restoreAllMocks();
  await fsp.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  for (const name of SPENDER_ENV) {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  }
  // The rule of the whole project: no answer and no log line carries a key.
  for (const text of [...bodies, ...logged]) for (const secret of SECRETS) expect(text).not.toContain(secret);
});

const post = async (badge: TestBadge, route: string, body: unknown) => {
  const res = await fetch(`${base}${route}`, { method: "POST", headers: { "Content-Type": "application/json", ...badge.headers }, body: JSON.stringify(body) });
  const text = await res.text();
  bodies.push(text);
  return { status: res.status, text, json: JSON.parse(text) as { code?: string; error?: string; value?: unknown } };
};

/** A collaborator: another person's badge, admitted to the canvas with edit (an open daemon admits everyone). */
const collaborator = async (): Promise<TestBadge> => {
  const badge = await mintTestBadge(base);
  await badge.speakAs(ravi);
  return badge;
};

describe("owner-only spend: the stored keys pay for this machine's person", () => {
  it("the owner spends the stored keys — text and judgment", async () => {
    const text = await post(owner, TEXT_ROUTE, TEXT);
    expect(text.status, text.text).toBe(200);
    expect(text.json.value).toEqual({ heading: "Acme" });
    const judged = await post(owner, JUDGMENT_ROUTE, QUESTION);
    expect(judged.status, judged.text).toBe(200);
    expect(calls.map((c) => c.headers.get("x-api-key") ?? c.headers.get("authorization"))).toEqual([ANTHROPIC, `Bearer ${TYPESAFE}`]);
  });

  it("an identity joined with the owner spends them too, from a badge that speaks only for it", async () => {
    // Priya, speaking for both, says the tablet identity and she are one person.
    await owner.speakAs(tablet, "web:tablet");
    const joined = await fetch(`${base}/api/ops`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...owner.headers },
      body: JSON.stringify({ canvasId: null, actor: priya, op: { type: "actor.join", from: tablet.id, into: priya.id } }),
    });
    expect(joined.ok, await joined.text()).toBe(true);
    // The tablet's own badge resumes that identity by its session key, and speaks for nothing else.
    const device = await mintTestBadge(base);
    await device.speakAs(tablet, "web:tablet");
    const held = await daemon.desk.claimsOf(device.badgeId);
    expect(held.map((row) => row.actorId)).toEqual([tablet.id]);
    const text = await post(device, TEXT_ROUTE, TEXT);
    expect(text.status, text.text).toBe(200);
    const judged = await post(device, JUDGMENT_ROUTE, QUESTION);
    expect(judged.status, judged.text).toBe(200);
    expect(calls).toHaveLength(2);
  });

  it("a collaborator is refused with the owner-only code and a sentence naming the owner — and nothing reaches the provider", async () => {
    const ravisBadge = await collaborator();
    const text = await post(ravisBadge, TEXT_ROUTE, TEXT);
    expect(text.status, text.text).toBe(403);
    expect(text.json).toEqual({ code: TEXT_OWNER_ONLY, error: ownerOnlySentence("Priya") });
    expect(text.json.error).toBe("Priya's keys pay only for Priya here — ask them to turn on sharing in Model keys, or use your own");
    const judged = await post(ravisBadge, JUDGMENT_ROUTE, QUESTION);
    expect(judged.status, judged.text).toBe(403);
    expect(judged.json).toEqual({ code: JUDGMENT_OWNER_ONLY, error: ownerOnlySentence("Priya") });
    expect(calls).toHaveLength(0);
  });

  it("after sharing is turned on, the collaborator is served — and off again, refused", async () => {
    const ravisBadge = await collaborator();
    await setKeySharing(home, true);
    // The keys are kept as they were; the switch sits beside them.
    expect(Object.keys((await readKeyFile(home)).keys).sort()).toEqual(["anthropic", "typesafe"]);
    const text = await post(ravisBadge, TEXT_ROUTE, TEXT);
    expect(text.status, text.text).toBe(200);
    const judged = await post(ravisBadge, JUDGMENT_ROUTE, QUESTION);
    expect(judged.status, judged.text).toBe(200);
    expect(calls).toHaveLength(2);
    await setKeySharing(home, false);
    expect((await post(ravisBadge, TEXT_ROUTE, TEXT)).status).toBe(403);
    expect(calls).toHaveLength(2);
  });

  it("the settings area's switch is the same file: GET reports it, PUT /api/keys/sharing flips it", async () => {
    const ravisBadge = await collaborator();
    const listed = await fetch(`${base}${KEYS_ROUTE}`, { headers: owner.headers });
    const listing = (await listed.json()) as { share: boolean };
    expect(listing.share).toBe(false);
    const flipped = await fetch(`${base}${KEYS_SHARING_ROUTE}`, { method: "PUT", headers: { "Content-Type": "application/json", ...owner.headers }, body: JSON.stringify({ share: true }) });
    const flippedText = await flipped.text();
    bodies.push(flippedText);
    expect(flipped.status, flippedText).toBe(200);
    expect(JSON.parse(flippedText).share).toBe(true);
    expect((await readKeyFile(home)).share).toBe(true);
    expect((await post(ravisBadge, TEXT_ROUTE, TEXT)).status).toBe(200);
    const bad = await fetch(`${base}${KEYS_SHARING_ROUTE}`, { method: "PUT", headers: { "Content-Type": "application/json", ...owner.headers }, body: JSON.stringify({ share: "yes" }) });
    expect(bad.status).toBe(400);
  });

  it("an environment key serves the collaborator regardless — the operator's, as before", async () => {
    const ravisBadge = await collaborator();
    process.env.ISOCAN_TEXT_API_KEY = ENV_TEXT;
    process.env.TYPESAFE_API_KEY = "tsk_acme_ENV_0000";
    const text = await post(ravisBadge, TEXT_ROUTE, TEXT);
    expect(text.status, text.text).toBe(200);
    const judged = await post(ravisBadge, JUDGMENT_ROUTE, QUESTION);
    expect(judged.status, judged.text).toBe(200);
    expect(calls.map((c) => c.headers.get("x-api-key") ?? c.headers.get("authorization"))).toEqual([ENV_TEXT, "Bearer tsk_acme_ENV_0000"]);
  });

  it("a machine that has not said who its person is spends its stored keys for nobody, and says so", async () => {
    await fsp.rm(path.join(home, "identity.json"));
    const text = await post(owner, TEXT_ROUTE, TEXT);
    expect(text.status, text.text).toBe(403);
    expect(text.json).toEqual({ code: TEXT_OWNER_ONLY, error: ownerOnlySentence(null) });
    expect(calls).toHaveLength(0);
  });
});
