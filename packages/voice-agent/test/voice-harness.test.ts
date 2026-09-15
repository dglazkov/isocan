import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startDaemon, type Daemon } from "@isocan/server";
import { agentSessionOf, machineAgentKey } from "../src/agent-key.ts";
import { readRcAgents } from "../src/rc-rows.ts";
import { harnessVars } from "@isocan/api";
import { shelvePatch, grantsRoute, passesRoute, passRoute, publicListingRoute, cloudAgentInstructions } from "@isocan/core";
import { mintTestBadge, type TestBadge } from "./badge.ts";
import {
  DEFAULT_VOICE_PORT,
  LIVE_MODEL,
  describeMintedOp,
  liveSetup,
  liveUrl,
  planForCall,
  resolveLivePlans,
  startLiveSession,
  createAcpAgent,
  planVoice,
  enrolmentForVoice,
  notEnrolledLine,
  readVoiceKey,
  readVoiceLog,
  resolveSpokenRef,
  startVoiceServer,
  voiceKeyFile,
  writeVoiceKey,
  writeVoiceLog,
  // Files: asked of the page; memory: the page's own store, asked the same way.
  createFileBroker,
  createMemoryBroker,
  safeGrantPath,
  normalizeTags,
  readLegacyMemories,
  retireLegacyMemories,
  runMemoryTool,
  voiceDir,
  voiceMemoryFile,
  voicePromptFile,
  PROMPT_MAX,
  runFileTool,
  MAX_FILE_CHARS,
  type FsAnswer,
  type Memory,
} from "../src/voice-harness.ts";
import type { ListedItem } from "@isocan/api";

/**
 * **The voice harness** (Paul, 11 Sep 2026), pinned at the three joints that
 * could each be a lie:
 *
 * - **the grammar** — a sentence to a plan, a spoken reference to an item. Pure,
 *   so the mapping is a fact rather than a transcript;
 * - **the key** — stored by the harness `0600`, and the page that carries it
 *   for exactly one request writes it nowhere (asserted against the page's own
 *   text: no `localStorage` anywhere in it);
 * - **the operation** — a typed utterance lands on a real daemon as the
 *   ENROLLED actor. That last assertion is the whole reason this is a harness
 *   and not a page with a socket: if the op is not attributed, the microphone
 *   is a stranger talking.
 *
 * The ACP face is driven on its wire shapes (initialize / session/new /
 * session/prompt, `stopReason: end_turn`) because that is what makes it a
 * harness the rc can invite.
 */

/** The CLI, for the verbs that are the CLI's (`rc add`, `rc turn`, summoning).
 * The harness itself is started through its OWN entry point — the point of the
 * package — so both paths are exercised as a person and an rc would drive
 * them. */
const cliBin = fileURLToPath(new URL("../../cli/bin/isocan.js", import.meta.url));
const voiceBin = fileURLToPath(new URL("../bin/voice-agent.js", import.meta.url));
/**
 * Two actors, deliberately: `seeder` is the test's own badge, holding one
 * actor for the fixture operations it posts, and `person` is the machine's
 * person in `identity.json` — the actor the SPAWNED CLI has to be able to
 * claim for itself. One badge holding both is exactly what the desk refuses
 * (one actor, two faces), which is how this test found that out.
 */
const seeder = { id: "usr_seeder", name: "Seeder" };
const person = { id: "usr_person", name: "Person" };
const voice = { id: "usr_voice", name: "Voice" };

/**
 * **The session this machine presents for an agent name.**
 *
 * It is the key `agent-key.ts` derives — the one `isocan rc add` mints an actor
 * under and the one the rc injects into a summoned turn — and not `agent:Voice`,
 * the key the CLI used before room phase 3.5. Presenting the old key is what
 * made the harness's own claim and the CLI's enrolment two sessions on one
 * actor: the second was refused as "somebody else here" while the desk
 * remembered the first, which is why every test here that enrols through the
 * CLI used to fail.
 */
async function sessionFor(name: string): Promise<string> {
  return agentSessionOf(await machineAgentKey(home, name));
}

/** The identity a harness started for an agent name speaks under — what the rc
 * would hand it, spelled as `connect()` takes it. */
async function identityFor(name = "Voice"): Promise<{ session: string; harness: string }> {
  return { session: await sessionFor(name), harness: "agent" };
}

let home: string;
let daemon: Daemon;
let base: string;
let badge: TestBadge;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-voice-"));
  await fs.writeFile(
    path.join(home, "identity.json"),
    JSON.stringify({ ...person, createdAt: new Date().toISOString() }),
  );
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  badge = await mintTestBadge(base);
  await badge.speakAs(seeder);
  await post("/api/ops", {
    canvasId: null,
    actor: seeder,
    op: { type: "project.create", canvasId: "prj_1", title: "Voice test" },
  });
  // The enrolment, exercised the way a person does it: the CLI claims this
  // machine's key for `agent:Voice` on THIS badge, which is the claim the rc
  // makes before it spawns an adapter. Done through the CLI rather than by
  // posting an op, because the badge a claim belongs to is the whole question —
  // `startVoiceServer` resolves with the machine's own, exactly as the
  // rc-spawned adapter does.
  const claimed = await isocan(["identity", "--name", "Voice", "--session"], {
    ISOCAN_SESSION_ID: await sessionFor("Voice"),
    ISOCAN_HARNESS: "agent",
  });
  expect(claimed.code, claimed.stderr).toBe(0);
  await post("/api/ops", {
    canvasId: "prj_1",
    actor: seeder,
    op: {
      type: "item.add",
      itemId: "itm_1",
      version: { id: "ver_1", blobHash: "h1", mimeType: "text/markdown", filename: "a.md", size: 3 },
      width: 320,
      height: 240,
      placement: { x: 100, y: 100 },
      title: "Checkout screen",
    },
  });
});

afterEach(async () => {
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

async function post(url: string, body: unknown): Promise<any> {
  const res = await fetch(`${base}${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...badge.headers },
    body: JSON.stringify(body),
  });
  return res.json().catch(() => null);
}

/** Every op the canvas has, oldest first, with who sent it — the watched log
 * replayed from zero, which is what `isocan tail --since 0` walks. */
async function log(ids: string[] = ["prj_1"]): Promise<{ type: string; actor: string }[]> {
  const res = await fetch(`${base}/api/oplog/watch`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...badge.headers },
    body: JSON.stringify({
      cursors: Object.fromEntries(ids.map((id) => [id, 0])),
      only: ids,
      waitMs: 0,
    }),
  });
  const body = (await res.json()) as {
    entries?: { envelope: { actor: { id: string }; op: { type: string } } }[];
  };
  return (body.entries ?? []).map((entry) => ({ type: entry.envelope.op.type, actor: entry.envelope.actor.id }));
}

async function items(): Promise<ListedItem[]> {
  const res = await fetch(`${base}/api/projects/prj_1/canvas`, { headers: badge.headers });
  const body = (await res.json()) as { canvas?: { items?: Record<string, { title?: string; x: number; y: number }> } };
  return Object.entries(body.canvas?.items ?? {}).map(([id, item]) => ({ id, ...item }) as ListedItem);
}

/** Actor id → the name the canvas knows them by, which is how a test can ask
 * "who did this?" without inventing the desk's ids. */
async function namesOnCanvas(): Promise<Record<string, string>> {
  const res = await fetch(`${base}/api/projects/prj_1/canvas`, { headers: badge.headers });
  const body = (await res.json()) as { names?: Record<string, string> };
  return body.names ?? {};
}

const item = (title: string, id = title, x = 100, y = 100): ListedItem =>
  ({ id, title, x, y, kind: "text", createdAt: new Date(2026, 0, 1).toISOString() }) as ListedItem;

/** The question the harness is holding, read the way the page reads it — off
 * `/state`, which is the only route a tab that missed the socket has. */
async function theQuestion(baseUrl: string): Promise<{ id: string; what: string }> {
  const deadline = Date.now() + 5000;
  let last = "";
  while (Date.now() < deadline) {
    const s = (await (await fetch(`${baseUrl}state`)).json()) as { confirm?: { id: string; what: string } | null };
    if (s.confirm) return s.confirm;
    last = JSON.stringify(s).slice(0, 400);
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error(`the harness never asked the person; last state: ${last}`);
}

/** The person's click, in HTTP form: what the page posts, and the only thing
 * that opens the gate. */
async function answering(baseUrl: string, id: string, allow: boolean): Promise<{ ok: boolean; allowed?: boolean }> {
  const r = await fetch(`${baseUrl}confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, allow }),
  });
  return (await r.json()) as { ok: boolean; allowed?: boolean };
}

async function utterance(baseUrl: string, text: string): Promise<{ sent: string[]; failed: string[]; reply: string; state: string }> {
  const r = await fetch(`${baseUrl}utterance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, source: "typed" }),
  });
  return (await r.json()) as { sent: string[]; failed: string[]; reply: string; state: string };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Wait for a condition the test can only observe by reading, with the reason
 * in the failure so a timeout says what never happened. */
async function until<T>(read: () => T, ready: (value: T) => boolean, what: string, ms = 20_000): Promise<T> {
  const deadline = Date.now() + ms;
  for (;;) {
    const value = read();
    if (ready(value)) return value;
    if (Date.now() >= deadline) throw new Error(`waited ${ms}ms for ${what}`);
    await sleep(50);
  }
}

/**
 * **A live session on a fake provider socket** — the shape every tool call in
 * this file arrives through — plus the two handles a person has: the page and
 * the canvas.
 */
async function liveServer() {
  await writeVoiceKey(home, { provider: "gemini", key: "AIza-live-test" });
  let providerSocket!: { emit: (message: unknown) => void; sent: string[] };
  class FakeLiveSocket {
    readyState = 1;
    sent: string[] = [];
    onopen: (() => void) | null = null;
    onclose: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onmessage: ((event: { data: unknown }) => void) | null = null;
    constructor(readonly url: string) {
      providerSocket = this;
      queueMicrotask(() => this.onopen?.());
    }
    send(data: string) {
      this.sent.push(data);
    }
    close() {}
    emit(message: unknown) {
      this.onmessage?.({ data: JSON.stringify(message) });
    }
  }

  const server = await startVoiceServer({
    home,
    port: 0,
    identity: await identityFor(),
    canvas: "prj_1",
    daemonPort: Number(new URL(base).port),
    // A gate nobody answers must not hold a test for a minute.
    confirmTimeoutMs: 2000,
    WebSocketImpl: FakeLiveSocket as unknown as typeof WebSocket,
  });
  const { WebSocket: WsClient } = await import("ws");
  const clientWs = new WsClient(`${server.state.url.replace("http://", "ws://")}live`);
  await new Promise<void>((resolve) => clientWs.on("open", () => resolve()));
  /** Everything the page is told on its live socket, in order. */
  const toPage: any[] = [];
  clientWs.on("message", (data: unknown) => {
    try {
      toPage.push(JSON.parse(String(data)));
    } catch {
      // binary audio
    }
  });
  while (!providerSocket) await sleep(10);
  providerSocket.emit({ setupComplete: {} });
  await sleep(50);
  return {
    server,
    providerSocket,
    toPage,
    close: async () => {
      clientWs.close();
      await server.close();
    },
  };
}

/**
 * **A fresh voice-agent, the way a person (or the rc) starts one** — the
 * real verb, in a real process, on a free port. It stands until it is killed,
 * so this waits for the line that says it is listening (or for it to exit with
 * a refusal), reads `/state` back, and stops it.
 *
 * The subject is the NAME it claims, not the audio: a restart is where a
 * rename either survives or is quietly undone.
 */
async function startFreshVoice(env: Record<string, string>, args: string[] = []): Promise<{
  started: boolean;
  state: { name: string; agent: { id: string; name: string }; canvas: { id: string; title: string } } | null;
  said: string;
}> {
  const port = 9000 + Math.floor(Math.random() * 900);
  // The scrub first, then the harness: `harnessVars` includes ISOCAN_HARNESS
  // itself, so setting it before the delete loop would leave the child with no
  // harness at all — and a session key is only a conversation once the harness
  // half names which family of them it belongs to.
  const childEnv: NodeJS.ProcessEnv = { ...process.env };
  for (const name of harnessVars) delete childEnv[name];
  childEnv.ISOCAN_HARNESS = "agent";
  const child = spawn(process.execPath, [voiceBin, "--port", String(port), ...args], {
    env: { ...childEnv, ISOCAN_HOME: home, ISOCAN_PORT: new URL(base).port, ...env },
    cwd: home,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let said = "";
  child.stdout!.setEncoding("utf8");
  child.stdout!.on("data", (chunk) => (said += chunk));
  child.stderr!.setEncoding("utf8");
  child.stderr!.on("data", (chunk) => (said += chunk));
  let url: string | null = null;
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const found = said.match(/talk at (http:\/\/127\.0\.0\.1:\d+\/)/);
    if (found) {
      url = found[1]!;
      break;
    }
    if (child.exitCode !== null) break;
    await sleep(50);
  }
  let state: { name: string; agent: { id: string; name: string }; canvas: { id: string; title: string } } | null = null;
  if (url) {
    // The page and a check read the same three facts; this is the machine
    // readable door.
    for (let i = 0; i < 100 && !state; i++) {
      state = (await fetch(`${url}state`).then((r) => r.json()).catch(() => null)) as typeof state;
      if (!state) await sleep(50);
    }
  }
  child.kill("SIGTERM");
  await sleep(200);
  child.kill("SIGKILL");
  await sleep(50);
  return { started: url !== null, state, said };
}

/**
 * The model's call, answered. Started without awaiting when the person has to
 * answer first, and then awaited — the tool response only arrives after the
 * gate opens.
 */
async function callTool(
  socket: { emit: (message: unknown) => void; sent: string[] },
  id: string,
  name: string,
  args: Record<string, unknown> = {},
): Promise<{ id: string; response: any }> {
  const before = socket.sent.length;
  socket.emit({ toolCall: { functionCalls: [{ id, name, args }] } });
  const deadline = Date.now() + 8000;
  while (socket.sent.length <= before && Date.now() < deadline) await sleep(10);
  const reply = JSON.parse(socket.sent.at(-1) ?? "{}");
  return reply.toolResponse?.functionResponses?.[0];
}

/** The CLI, with this test's temp home and daemon — the same launcher the acp
 * suite uses, so the machine badge and the identity resolution are the real
 * ones. */
function isocan(args: string[], extraEnv: Record<string, string> = {}): Promise<{ code: number; stdout: string; stderr: string }> {
  const env = { ...process.env };
  // EVERY harness variable, not just isocan's two: this suite runs inside pi,
  // so `PI_SESSION_ID` in the ambient environment made the spawned CLI read
  // itself as a harness session and refuse `rc turn` as an agent's verb.
  for (const name of harnessVars) delete env[name];
  const child = spawn(process.execPath, [cliBin, ...args], {
    env: { ...env, ISOCAN_HOME: home, ISOCAN_PORT: new URL(base).port, ...extraEnv },
    cwd: home,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout!.setEncoding("utf8");
  child.stdout!.on("data", (chunk) => (stdout += chunk));
  child.stderr!.setEncoding("utf8");
  child.stderr!.on("data", (chunk) => (stderr += chunk));
  return new Promise((resolve) => child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr })));
}

describe("what a sentence means", () => {
  it("renames, deletes, moves, says, asks and comments — each as an operation that already existed", () => {
    const items = [item("Checkout screen", "itm_1"), item("Settings screen", "itm_2")];
    const ctx = { items, mainThreadId: null };

    const renamed = planVoice("retitle the second screen to Checkout v2", ctx);
    expect(renamed.plans[0]!.op).toMatchObject({ type: "item.update", itemId: "itm_2", title: "Checkout v2" });

    expect(planVoice("delete Settings", ctx).plans[0]!.op).toMatchObject({ type: "item.delete", itemId: "itm_2" });

    const moved = planVoice("move the first thing by 60, -20", ctx);
    expect(moved.plans[0]!.op).toMatchObject({ type: "item.move", itemId: "itm_1", x: 160, y: 80 });

    const placed = planVoice("move Checkout screen to 400, 200", ctx);
    expect(placed.plans[0]!.op).toMatchObject({ type: "item.move", itemId: "itm_1", x: 400, y: 200 });

    expect(planVoice("say the type scale is agreed", ctx).plans[0]!.op).toMatchObject({
      type: "thread.reply",
      body: "the type scale is agreed",
    });
    expect(planVoice("ask which of the two we keep", ctx).plans[0]!.op).toMatchObject({
      type: "thread.reply",
      body: "? which of the two we keep",
    });
    expect(planVoice("comment on Checkout screen: the padding is wrong", ctx).plans[0]!.op).toMatchObject({
      type: "thread.create",
      itemId: "itm_1",
      body: "the padding is wrong",
    });
  });

  it("answers a question about the canvas instead of inventing an operation", () => {
    const out = planVoice("what is on this canvas?", { items: [item("Checkout screen", "itm_1")], mainThreadId: null });
    expect(out.plans).toEqual([]);
    expect(out.what).toContain("Checkout screen");
  });

  it("derives a call's label from the operation and its arguments, never from the tool's name", () => {
    // Paul's log: an update that changed a description was labelled "renamed".
    const { plans } = planForCall("update_item", { item_ref: "Hello Dion", description: "Hello Dion again" });
    const { ready, refused } = resolveLivePlans(plans, [item("Hello Dion", "itm_dion")]);
    expect(refused).toEqual([]);
    expect(ready[0]!.op).toMatchObject({ type: "item.update", itemId: "itm_dion", description: "Hello Dion again" });
    expect(ready[0]!.said).toBe('update "Hello Dion": new description');
    expect(ready[0]!.said).not.toMatch(/renam/i);

    const titled = resolveLivePlans(
      planForCall("update_item", { item_ref: "Hello Dion", title: "Checkout v2" }).plans,
      [item("Hello Dion", "itm_dion")],
    );
    expect(titled.ready[0]!.said).toBe('update "Hello Dion": new title "Checkout v2"');
  });

  it("labels a reference nobody can resolve as a failure under the operation's own name", () => {
    // Paul's log: a call that could not find "Paul" still carried "renamed Paul".
    const { plans } = planForCall("update_item", { item_ref: "Paul", title: "Paul" });
    const { ready, refused } = resolveLivePlans(plans, [item("Hello Dion", "itm_dion")]);
    expect(ready).toEqual([]);
    expect(refused).toEqual([
      { type: "item.update", said: "could not resolve “Paul”", message: "item.update failed — could not resolve “Paul”" },
    ]);
  });

  it("phrases labels as actions, because the outcome has not happened yet", () => {
    expect(describeMintedOp({ type: "item.delete", itemId: "itm_1" }, "Checkout screen")).toBe('delete "Checkout screen"');
    expect(describeMintedOp({ type: "item.add", title: "Site" })).toBe('add "Site"');
    expect(describeMintedOp({ type: "item.move", x: 10, y: 20 }, "Note")).toBe('move "Note" to 10, 20');
  });

  it("turns a URL into an ordinary item.add whose blob is a text/uri-list", () => {
    const { plans } = planForCall("add_item", { url: "localhost:3000" });
    expect(plans[0]!.op).toMatchObject({
      type: "item.add",
      title: "localhost:3000",
      text: "http://localhost:3000/\n",
      mime: "text/uri-list",
    });
    const { ready } = resolveLivePlans(plans, []);
    expect(ready[0]!.said).toBe('add "localhost:3000" as a web page');
  });

  it("refuses a url that is not a web address instead of adding an empty note", () => {
    const { plans, what } = planForCall("add_item", { url: "not a url" });
    expect(plans).toEqual([]);
    expect(what).toContain("not a web address");
  });

  it("plans the command surface as the engine's own operations", () => {
    const items = [item("Checkout screen", "itm_1")];
    const version = resolveLivePlans(planForCall("item_add_version", { item_ref: "Checkout", content: "v2" }).plans, items);
    expect(version.ready[0]!.op).toMatchObject({ type: "item.addVersion", itemId: "itm_1", body: "v2" });
    expect(version.ready[0]!.said).toBe('add a version to "Checkout screen"');

    const thread = resolveLivePlans(planForCall("thread_create", { item_ref: "Checkout", body: "let's talk" }).plans, items);
    expect(thread.ready[0]!.op).toMatchObject({ type: "thread.create", itemId: "itm_1", body: "let's talk" });

    const main = planForCall("thread_set_main", { thread_id: "thr_1" });
    expect(main.plans[0]!.op).toMatchObject({ type: "thread.setMain", threadId: "thr_1" });

    const edit = planForCall("comment_update", { thread_id: "thr_1", comment_id: "cmt_1", body: "fixed" });
    expect(edit.plans[0]!.op).toMatchObject({ type: "comment.update", threadId: "thr_1", commentId: "cmt_1", body: "fixed" });

    expect(planForCall("notify", { text: "shipping" }).plans[0]!.op).toMatchObject({ type: "thread.reply", body: "shipping", notify: true });
    expect(planForCall("actor_set_color", { color: "#00ff00" }).plans[0]!.op).toMatchObject({ type: "actor.setColor", color: "#00ff00" });
    expect(planForCall("actor_set_mark", { mark: "🦊" }).plans[0]!.op).toMatchObject({ type: "actor.setMark", mark: "🦊" });
    expect(planForCall("agent_enroll", { actor_id: "usr_2", name: "Codex" }).plans[0]!.op).toMatchObject({
      type: "agent.enroll",
      actorId: "usr_2",
      agentName: "Codex",
    });
    expect(planForCall("agent_withdraw", { actor_id: "usr_2" }).plans[0]!.op).toMatchObject({ type: "agent.withdraw", actorId: "usr_2" });
  });

  it("refuses to guess which of two things you meant, and says so", () => {
    const ctx = { items: [item("Checkout screen", "itm_1"), item("Checkout v2", "itm_2")], mainThreadId: null };
    const out = planVoice("delete Checkout", ctx);
    expect(out.plans).toEqual([]);
    expect(out.what).toContain("Checkout");
  });

  it("resolves a title prefix and an ordinal, and refuses an ambiguous one", () => {
    const items = [item("Checkout screen", "itm_1"), item("Settings screen", "itm_2")];
    expect(resolveSpokenRef("checkout", items)?.id).toBe("itm_1");
    expect(resolveSpokenRef("the first thing", items)?.id).toBe("itm_1");
    expect(resolveSpokenRef("screen", items)).toBeNull();
  });
});

describe("the key belongs to the harness", () => {
  it("stores it 0600, reads it back, and refuses one that leaked its own permissions", async () => {
    const file = await writeVoiceKey(home, { provider: "gemini", key: "AIza-secret" });
    expect(file).toBe(voiceKeyFile(home));
    expect((await fs.stat(file)).mode & 0o777).toBe(0o600);
    expect(await readVoiceKey(home)).toEqual({ provider: "gemini", key: "AIza-secret" });

    await fs.chmod(file, 0o644);
    await expect(readVoiceKey(home)).rejects.toThrow(/not 600/);
  });

  it("never refuses a key: any non-empty string is stored, and the provider judges", async () => {
    // "hunter2" is not a key shape at all, and it is still stored. This used
    // to be a client-side refusal — a guess about a key format, failing closed
    // on a real key before anything had sent it.
    expect(await writeVoiceKey(home, { provider: "gemini", key: "hunter2" })).toBe(voiceKeyFile(home));
    expect(await readVoiceKey(home)).toEqual({ provider: "gemini", key: "hunter2" });
    // A key that LOOKS like another provider's is not special: there is one
    // provider, and it is the judge.
    expect(await writeVoiceKey(home, { provider: "gemini", key: "sk-looks-like-openai" })).toBe(voiceKeyFile(home));
    expect(await readVoiceKey(home)).toEqual({ provider: "gemini", key: "sk-looks-like-openai" });
  });

});

/**
 * **Files: the folder is the person's, and the page is the only one who can
 * ask for it.**
 *
 * The harness cannot read a disk by itself — a DirectoryHandle lives in a
 * browser — so these pin the three joints that make that safe and honest: the
 * path guard (nothing outside the grant, refused instantly and in words), the
 * broker (no page / no grant / no answer / page closed are each a NAMED
 * refusal, never a silent empty read), and the attribution in the answer
 * (which folder, which file — the thing that makes a read citable).
 */
describe("files are read through the page, over the folder it was granted", () => {
  it("refuses absolute and climbing paths, and normalises the rest", () => {
    expect(safeGrantPath("notes/todo.md")).toEqual({ ok: true, path: "notes/todo.md" });
    expect(safeGrantPath("./notes/todo.md")).toEqual({ ok: true, path: "notes/todo.md" });
    expect(safeGrantPath("notes//deep/todo.md")).toEqual({ ok: true, path: "notes/deep/todo.md" });
    expect(safeGrantPath("", { allowEmpty: true })).toEqual({ ok: true, path: "" });
    expect(safeGrantPath("").ok).toBe(false); // read_file on the folder is not a file
    expect(safeGrantPath("/etc/passwd").ok).toBe(false);
    expect(safeGrantPath("C:\\Users\\paul").ok).toBe(false);
    expect(safeGrantPath("~/notes").ok).toBe(false);
    expect(safeGrantPath("../secrets.txt").ok).toBe(false);
    expect(safeGrantPath("notes/../../secrets.txt").ok).toBe(false);
  });

  it("names every way a read can fail instead of returning nothing", async () => {
    const sends: unknown[] = [];
    const noPage = createFileBroker({ connected: () => false, send: (m) => sends.push(m) }, { timeoutMs: 20 });
    const refused = await noPage.ask("read_file", "a.txt");
    expect(refused.ok).toBe(false);
    expect(refused.error).toMatch(/no page is connected/);
    expect(sends).toEqual([]); // nothing to send to

    const connected = createFileBroker({ connected: () => true, send: (m) => sends.push(m) }, { timeoutMs: 20 });
    const noGrant = await connected.ask("read_file", "a.txt");
    expect(noGrant.ok).toBe(false);
    expect(noGrant.error).toMatch(/no folder has been granted/);
    expect(sends).toEqual([]); // and nothing is asked of the page either

    // With a grant, the question goes out and the answer comes back by callId.
    connected.grant("Notes");
    const asked = connected.ask("read_file", "todo.md");
    await new Promise((r) => setTimeout(r, 5));
    const sent = sends[0] as { fs: { callId: string; op: string; path: string; folder: string } };
    expect(sent.fs).toMatchObject({ op: "read_file", path: "todo.md", folder: "Notes" });
    expect(connected.answer(sent.fs.callId, { ok: true, content: "buy milk" })).toBe(true);
    expect(await asked).toEqual({ ok: true, content: "buy milk" });
    // A second answer for the same question is refused, not obeyed.
    expect(connected.answer(sent.fs.callId, { ok: true, content: "something else" })).toBe(false);
  });

  it("times out in words, and a closed page refuses what it owed", async () => {
    const broker = createFileBroker({ connected: () => true, send: () => undefined }, { timeoutMs: 15 });
    broker.grant("Notes");
    const timingOut = await broker.ask("list_dir", "");
    expect(timingOut.ok).toBe(false);
    expect(timingOut.error).toMatch(/did not answer/);

    const owed = broker.ask("read_file", "a.txt");
    await new Promise((r) => setTimeout(r, 2));
    expect(broker.waiting()).toBe(1);
    broker.abandon();
    expect(await owed).toEqual({ ok: false, error: "the page closed before it answered" });
  });

  it("attributes what it read, and says when it was cut short", async () => {
    const grant = { folder: "Notes" };
    const ask = async (op: "list_dir" | "read_file", path: string): Promise<FsAnswer> => {
      if (op === "list_dir") return { ok: true, entries: [{ name: "todo.md", kind: "file", size: 8 }] };
      if (path === "big.txt") return { ok: true, content: "x".repeat(MAX_FILE_CHARS + 500) };
      return { ok: true, content: "buy milk" };
    };

    const listing = await runFileTool("list_dir", { path: "." }, ask, grant);
    expect(listing.ok).toBe(true);
    expect(listing.said).toContain("1 entry in Notes");
    expect(listing.answer).toMatchObject({ folder: "Notes", path: "", count: 1, truncated: false });

    const read = await runFileTool("read_file", { path: "todo.md" }, ask, grant);
    expect(read.said).toBe("read Notes/todo.md (8 chars)");
    expect(read.answer).toMatchObject({ source: "Notes/todo.md", content: "buy milk", truncated: false });

    const big = await runFileTool("read_file", { path: "big.txt" }, ask, grant);
    expect(big.answer.truncated).toBe(true);
    expect(String(big.answer.content)).toHaveLength(MAX_FILE_CHARS);

    // The path guard refuses BEFORE the page is asked at all.
    let asked = 0;
    const counted = async (): Promise<FsAnswer> => {
      asked += 1;
      return { ok: true, content: "nope" };
    };
    const escape = await runFileTool("read_file", { path: "../secrets.txt" }, counted, grant);
    expect(escape.ok).toBe(false);
    expect(asked).toBe(0);

    // And a refusal from the page is passed through as words, not as empty.
    const denied = await runFileTool("read_file", { path: "a.txt" }, async () => ({ ok: false, error: "no such file" }), grant);
    expect(denied.ok).toBe(false);
    expect(denied.said).toBe("no such file");
  });
});

/**
 * **Memory lives in the page's store, and the harness only asks.**
 *
 * Paul's ruling (2026-09-13): the agent's own state belongs in OPFS — the
 * page's store, per-origin and persistent with no prompt — and the
 * DirectoryHandle is for the person's files. So this is the SAME broker
 * pattern as the file tools, and what is pinned here is that the harness holds
 * no memory of its own: it asks over the socket, and every way the question can
 * fail is a named refusal rather than an empty store it never saw.
 *
 * The contract and the honesty are unchanged: `{id, text, tags, at, session,
 * presenceId}`, substring search stated as substring in the description AND the
 * answer, and no tool for deleting or enumerating.
 */
describe("memory is the page's store, asked over the socket", () => {
  it("refuses in words when there is no page, no answer, or the page closed", async () => {
    const sends: unknown[] = [];
    const noPage = createMemoryBroker({ connected: () => false, send: (m) => sends.push(m) }, { timeoutMs: 20 });
    const refused = await noPage.ask("search", { query: "" });
    expect(refused.ok).toBe(false);
    expect(refused.error).toMatch(/no page is connected/);
    expect(sends).toEqual([]);

    const broker = createMemoryBroker({ connected: () => true, send: (m) => sends.push(m) }, { timeoutMs: 15 });
    const timedOut = await broker.ask("read", { id: "mem_1" });
    expect(timedOut.ok).toBe(false);
    expect(timedOut.error).toMatch(/did not answer/);

    const owed = broker.ask("search", { query: "x" });
    await new Promise((r) => setTimeout(r, 2));
    expect(broker.waiting()).toBe(1);
    broker.abandon();
    expect(await owed).toEqual({ ok: false, error: "the page closed before it answered" });
  });

  it("does not turn a disconnected broker into a missing-memory answer", async () => {
    const error = "no page is connected — memory lives in the page's own store";
    const result = await runMemoryTool("read_memory", { id: "mem_existing" }, async () => ({ ok: false, error }), { session: "Voice" });
    expect(result.said).toBe(error);
    expect(result.answer).toEqual({ ok: false, error });
  });

  it("asks the page for a write, a read and a search, and still states what search is", async () => {
    const asked: { op: string; payload: Record<string, unknown> }[] = [];
    const ask = async (op: "remember" | "read" | "search", payload: Record<string, unknown>) => {
      asked.push({ op, payload });
      if (op === "remember") return { ok: true, id: "mem_1", at: "2026-09-13T00:00:00.000Z", tags: ["daemon"] };
      if (op === "read") {
        return {
          ok: true,
          memory: {
            id: "mem_1",
            text: "the daemon port is 4441",
            tags: ["daemon"],
            at: "2026-09-13T00:00:00.000Z",
            session: "Voice",
          },
        };
      }
      return {
        ok: true,
        count: 1,
        memories: [
          { id: "mem_1", text: "the daemon port is 4441", tags: ["daemon"], at: "2026-09-13T00:00:00.000Z", session: "Voice" },
        ],
      };
    };

    const written = await runMemoryTool(
      "remember",
      { text: "  the daemon port is 4441  ", tags: ["daemon", "daemon"] },
      ask,
      { session: "Voice", presenceId: "ses_1" },
    );
    expect(written.ok).toBe(true);
    expect(asked[0]).toEqual({
      op: "remember",
      payload: { text: "the daemon port is 4441", tags: ["daemon"], session: "Voice", presenceId: "ses_1" },
    });
    expect(written.said).toContain("remembered (mem_1)");

    const read = await runMemoryTool("read_memory", { id: "mem_1" }, ask, { session: "Voice" });
    expect(read.ok).toBe(true);
    expect((read.answer.memory as Memory).text).toBe("the daemon port is 4441");

    const found = await runMemoryTool("search_memory", { query: "daemon" }, ask, { session: "Voice" });
    expect(found.answer.count).toBe(1);
    expect(found.answer.match).toMatch(/substring/i);
    expect(found.answer.match).toMatch(/not semantic/i);
    expect(asked[2]).toEqual({ op: "search", payload: { query: "daemon" } });

    // Empty text is refused without troubling the page at all.
    asked.length = 0;
    const empty = await runMemoryTool("remember", { text: "   " }, ask, { session: "Voice" });
    expect(empty.ok).toBe(false);
    expect(asked).toEqual([]);

    // A page-side miss comes back as the page's own words.
    const missing = await runMemoryTool("read_memory", { id: "mem_nope" }, async () => ({ ok: true }), {
      session: "Voice",
    });
    expect(missing.ok).toBe(false);
    expect(missing.said).toContain("no memory with id");
  });

  it("offers the old harness file once, and retires it after the page imports it", async () => {
    const legacy = [
      { id: "mem_old", text: "stored before the move", tags: ["legacy"], at: "2026-09-12T00:00:00.000Z", session: "Voice" },
    ];
    await fs.mkdir(voiceDir(home), { recursive: true, mode: 0o700 });
    await fs.writeFile(voiceMemoryFile(home), JSON.stringify(legacy, null, 2), { mode: 0o600 });

    expect(await readLegacyMemories(home)).toEqual(legacy);

    // The page says it has written them into OPFS: the file is renamed aside,
    // kept rather than deleted, and no second import can happen.
    const kept = await retireLegacyMemories(home);
    expect(kept).toBe(`${voiceMemoryFile(home)}.migrated`);
    expect(await readLegacyMemories(home)).toEqual([]);
    expect(JSON.parse(await fs.readFile(kept!, "utf8"))).toEqual(legacy);
    expect(await retireLegacyMemories(home)).toBeNull(); // nothing left to retire
  });
});

describe("the page", () => {
  let close: (() => Promise<void>) | null = null;

  afterEach(async () => {
    await close?.();
    close = null;
  });

  async function serve(port = 0) {
    const server = await startVoiceServer({
      home,
      port,
      identity: await identityFor(),
      canvas: "prj_1",
      daemonPort: Number(new URL(base).port),
    });
    close = server.close;
    return server;
  }

  it("does not report a provider session from a start request with no audio socket", async () => {
    const server = await serve();
    await fetch(`${server.state.url}session/start`, { method: "POST" });
    const facts = await (await fetch(`${server.state.url}state`)).json();
    expect(facts).toMatchObject({ session: { state: "idle" } });
  });

  it("ends an audio page that closes before provider startup, including the no-key path", async () => {
    const server = await serve();
    const { WebSocket } = await import("ws");
    const socket = new WebSocket(`${server.state.url.replace("http:", "ws:")}audio`);
    const closed = new Promise<void>((resolve) => socket.once("close", () => resolve()));
    try {
      await new Promise<void>((resolve, reject) => {
        socket.once("error", reject);
        socket.on("message", (data) => { if (String(data).includes("no key stored")) resolve(); });
      });
      socket.close();
      await closed;
      const facts = await (await fetch(`${server.state.url}state`)).json();
      expect(facts).toMatchObject({ session: { state: "ended" } });
    } finally { socket.terminate(); }
  });

  it("does not start a provider if the page closes while the key read is pending", async () => {
    await writeVoiceKey(home, { provider: "gemini", key: "inert-local-fixture" });
    let starts = 0;
    const server = await startVoiceServer({
      home, port: 0, identity: await identityFor(), canvas: "prj_1",
      daemonPort: Number(new URL(base).port),
      WebSocketImpl: class { constructor() { starts++; throw new Error("provider forbidden"); } },
    });
    close = server.close;
    let release!: (text: string) => void;
    const waiting = new Promise<string>((resolve) => { release = resolve; });
    let entered!: () => void;
    const reading = new Promise<void>((resolve) => { entered = resolve; });
    const read = fs.readFile.bind(fs);
    const reads = vi.spyOn(fs, "readFile").mockImplementation(((file: Parameters<typeof fs.readFile>[0], ...args: unknown[]) => {
      if (String(file) === voiceKeyFile(home)) { entered(); return waiting; }
      return Reflect.apply(read, fs, [file, ...args]);
    }) as typeof fs.readFile);
    const { WebSocket } = await import("ws");
    const socket = new WebSocket(`${server.state.url.replace("http:", "ws:")}audio`);
    try {
      await new Promise<void>((resolve, reject) => { socket.once("open", resolve); socket.once("error", reject); });
      await reading; // The actual key-file read, not merely websocket OPEN.
      expect(reads.mock.calls.some(([file]) => String(file) === voiceKeyFile(home))).toBe(true);
      const closed = new Promise<void>((resolve) => socket.once("close", () => resolve()));
      socket.close(); await closed;
      reads.mockRestore();
      release(JSON.stringify({ provider: "gemini", key: "inert-local-fixture" }));
      await sleep(20);
      expect(starts).toBe(0);
      expect(await (await fetch(`${server.state.url}state`)).json()).toMatchObject({ session: { state: "ended" } });
    } finally { reads.mockRestore(); release("null"); socket.terminate(); }
  });

  it("reconnects the broker without reading a key, starting a provider or inventing a session", async () => {
    await writeVoiceKey(home, { provider: "gemini", key: "inert-local-fixture" });
    let starts = 0;
    const server = await startVoiceServer({
      home, port: 0, identity: await identityFor(), canvas: "prj_1",
      daemonPort: Number(new URL(base).port),
      WebSocketImpl: class { constructor() { starts++; throw new Error("provider forbidden"); } },
    });
    close = server.close;
    const reads = vi.spyOn(fs, "readFile");
    const { WebSocket } = await import("ws");
    const socket = new WebSocket(`${server.state.url.replace("http:", "ws:")}broker`);
    const received: unknown[] = [];
    try {
      await new Promise<void>((resolve, reject) => {
        socket.once("error", reject);
        socket.on("message", (data) => { received.push(JSON.parse(String(data))); resolve(); });
      });
      socket.send("broker:ping");
      socket.send(Buffer.alloc(32)); // The broker door must not forward PCM.
      await sleep(20);
      expect(received).toEqual([{ broker: "ready" }, { broker: "ready" }]);
      expect(reads.mock.calls.filter(([file]) => String(file) === voiceKeyFile(home))).toHaveLength(0);
      expect(starts).toBe(0);
      expect(await (await fetch(`${server.state.url}state`)).json()).toMatchObject({ session: { state: "idle" } });
      await fetch(`${server.state.url}fs/grant`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ folder: "Synthetic notes", granted: true }),
      });
      const closed = new Promise<void>((resolve) => socket.once("close", () => resolve()));
      socket.close(); await closed;
      expect(await (await fetch(`${server.state.url}fs`)).json()).toMatchObject({ granted: false, folder: null });
    } finally { reads.mockRestore(); socket.terminate(); }
  });

  it("says what it is connected to: canvas by title and id, daemon, home, agent, provider", async () => {
    const server = await serve();
    const facts = (await (await fetch(`${server.state.url}connection`)).json()) as Record<string, any>;
    expect(facts.canvas).toEqual({ title: "Voice test", id: "prj_1" });
    expect(facts.daemon).toContain("127.0.0.1:".slice(0, 10));
    expect(facts.agent).toMatchObject({ name: "Voice", enrolled: false });
    expect(facts.provider).toMatchObject({ name: null, key: false });
    expect(facts.version).toBeTruthy();
    expect(facts.updated).toMatch(/^\d{4}-\d{2}-\d{2} /);
    expect(facts.provider.model).toBe("models/gemini-3.1-flash-live-preview");
    // The key itself is never in the facts, only whether one is there.
    await fetch(`${server.state.url}key`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "AIza-secret-value" }),
    });
    const after = (await (await fetch(`${server.state.url}connection`)).json()) as Record<string, any>;
    expect(after.provider).toMatchObject({ name: "gemini", key: true });
    expect(JSON.stringify(after)).not.toContain("AIza-secret-value");
  });

  it("stores a key the page POSTs, and reports it without ever echoing it back", async () => {
    const server = await serve();
    const saved = await (
      await fetch(`${server.state.url}key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "AIza-from-the-page" }),
      })
    ).json();
    expect(saved).toMatchObject({ provider: "gemini" });
    expect(JSON.stringify(saved)).not.toContain("AIza-from-the-page");
    expect(await readVoiceKey(home)).toEqual({ provider: "gemini", key: "AIza-from-the-page" });
  });

  it("sends a typed utterance as the ENROLLED agent, and the canvas says so", async () => {
    const server = await serve();
    const out = (await (
      await fetch(`${server.state.url}utterance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "retitle the first thing to Checkout v2", source: "typed" }),
      })
    ).json()) as { sent: string[]; failed: string[]; reply: string };

    expect(out.sent).toHaveLength(1);
    expect(out.failed).toEqual([]);

    const after = await items();
    expect(after.map((i) => i.title)).toContain("Checkout v2");

    // The attribution IS the feature: the operation is the ENROLLED Voice
    // actor's, not the person's, so `@Voice` reaches it and undo treats it as
    // the agent's work. The id is the desk's to mint, so this asserts the two
    // facts that matter — it is not the person, and the canvas calls it Voice.
    const last = (await log()).at(-1)!;
    expect(last.type).toBe("item.update");
    expect(last.actor).not.toBe(seeder.id);
    const names = await namesOnCanvas();
    expect(names[last.actor]).toBe("Voice");
  });

  it("refuses a sentence it cannot turn into an operation, and sends nothing", async () => {
    const server = await serve();
    const before = (await log()).length;
    const out = (await (
      await fetch(`${server.state.url}utterance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "make it feel more premium", source: "typed" }),
      })
    ).json()) as { sent: string[]; failed: string[]; reply: string };
    expect(out.sent).toEqual([]);
    expect(out.reply).toContain("I know:");
    expect((await log()).length).toBe(before);
  });

  /**
   * **The acceptance test for memory, and the whole point of it: a restart.**
   *
   * A tool that is merely registered is worth nothing. So: store a memory
   * through the model's own write path, take the harness away entirely, stand
   * a NEW harness up on the same home, and read the memory back over its HTTP
   * surface. The only thing the two servers share is the filesystem — which is
   * exactly the claim ("it survives a restart") being made.
   */
  it("serves the legacy memory file once, then retires it when the page says it imported", async () => {
    const legacy = [
      { id: "mem_old", text: "stored before the move", tags: ["legacy"], at: "2026-09-12T00:00:00.000Z", session: "Voice" },
    ];
    await fs.mkdir(voiceDir(home), { recursive: true, mode: 0o700 });
    await fs.writeFile(voiceMemoryFile(home), JSON.stringify(legacy, null, 2), { mode: 0o600 });
    const server = await serve();

    const offered = (await (await fetch(`${server.state.url}memory/legacy`)).json()) as {
      entries: { id: string; text: string }[];
      count: number;
    };
    expect(offered.count).toBe(1);
    expect(offered.entries[0]).toMatchObject({ id: "mem_old", text: "stored before the move" });

    const retired = (await (
      await fetch(`${server.state.url}memory/migrated`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: 1 }),
      })
    ).json()) as { ok: boolean; migrated: number; kept: string | null };
    expect(retired).toMatchObject({ ok: true, migrated: 1, kept: "memories.json.migrated" });

    // Once retired, the route offers nothing: no second import, and the bytes
    // are kept beside the original rather than deleted.
    const after = (await (await fetch(`${server.state.url}memory/legacy`)).json()) as { count: number };
    expect(after.count).toBe(0);
    expect(JSON.parse(await fs.readFile(`${voiceMemoryFile(home)}.migrated`, "utf8"))).toEqual(legacy);
  });

  it("reports the folder grant over HTTP, and shows it in /state", async () => {
    const server = await serve();
    const before = (await (await fetch(`${server.state.url}fs`)).json()) as { granted: boolean; folder: string | null };
    expect(before).toMatchObject({ granted: false, folder: null });

    const granted = (await (
      await fetch(`${server.state.url}fs/grant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder: "Notes" }),
      })
    ).json()) as { ok: boolean; granted: boolean; folder: string | null };
    expect(granted).toMatchObject({ ok: true, granted: true, folder: "Notes" });

    const after = (await (await fetch(`${server.state.url}fs`)).json()) as { granted: boolean; folder: string };
    expect(after).toMatchObject({ granted: true, folder: "Notes" });
    const facts = (await (await fetch(`${server.state.url}state`)).json()) as {
      files: { granted: boolean; folder: string; at: string | null };
    };
    expect(facts.files.granted).toBe(true);
    expect(facts.files.folder).toBe("Notes");
    expect(facts.files.at).toMatch(/^\d{4}-/);

    // Revoking is the person's, and it takes effect where the model can see it.
    const revoked = (await (
      await fetch(`${server.state.url}fs/grant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder: null, granted: false }),
      })
    ).json()) as { granted: boolean };
    expect(revoked.granted).toBe(false);

    // An answer for a question nobody asked is refused in words.
    const stray = (await (
      await fetch(`${server.state.url}fs/result`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId: "fs_nope", ok: true, content: "x" }),
      })
    ).json()) as { ok: boolean; error: string };
    expect(stray.ok).toBe(false);
    expect(stray.error).toMatch(/nothing is waiting/);
  });

  it("reads back the instruction a session would be given, with its parts named", async () => {
    const server = await serve();
    const body = (await (await fetch(`${server.state.url}prompt`)).json()) as {
      rules: { default: string; edited: string | null; effective: string };
      generated: { what: string; source: string; text: string; why: string }[];
      tools: string[];
      sent: string;
      cap: number;
      note: string;
    };

    // Nothing has been edited: the default IS the effective text, and the
    // panel can say so without inventing anything.
    expect(body.rules.default).toContain("You are Voice");
    expect(body.rules.edited).toBeNull();
    expect(body.rules.effective).toBe(body.rules.default);

    // The two generated blocks are named, with where each came from and why
    // it is not editable here.
    const names = body.generated.map((one) => one.what);
    expect(names).toEqual(["Project instructions", "Canvas snapshot"]);
    expect(body.generated[1]!.text).toContain("Current canvas state");
    expect(body.generated[1]!.why).toContain("rebuilt at every session start");

    // `sent` is the whole system instruction, in the order the session gets it:
    // the rules first, then the generated appendix.
    expect(body.sent.startsWith(body.rules.effective)).toBe(true);
    expect(body.sent).toContain(body.generated[1]!.text);

    // The honesty the panel needs: the tools are outside this text, and the
    // model-test control is a different assembly of the same rules.
    expect(body.tools).toContain("rename_item");
    expect(body.note).toContain("outside this text");
    expect(body.cap).toBeGreaterThan(1000);
  });

  it("writes the edited rules, hands them to the next session, and resets to the default", async () => {
    const server = await serve();
    const edited = "You are Voice, and you speak like a ship's captain. Call the tool first, always.";
    const res = await fetch(`${server.state.url}prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: edited }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { rules: { default: string; edited: string | null; effective: string }; sent: string };
    expect(body.rules.edited).toBe(edited);
    expect(body.rules.effective).toBe(edited);
    expect(body.sent.startsWith(edited)).toBe(true);

    // It is a file the person owns, 0600 like the key, and the SESSION uses it:
    // the setup message built for a live session carries the edited rules.
    expect((await fs.stat(voicePromptFile(home))).mode & 0o777).toBe(0o600);
    const setup = liveSetup("models/x", null, body.rules.effective) as {
      setup: { systemInstruction: { parts: { text: string }[] } };
    };
    expect(setup.setup.systemInstruction.parts[0]!.text.startsWith(edited)).toBe(true);

    const reset = (await (
      await fetch(`${server.state.url}prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reset: true }),
      })
    ).json()) as { rules: { edited: string | null; effective: string; default: string } };
    expect(reset.rules.edited).toBeNull();
    expect(reset.rules.effective).toBe(reset.rules.default);
    await expect(fs.stat(voicePromptFile(home))).rejects.toThrow();
  });

  it("refuses empty rules and a paste past the cap, and keeps what was already stored", async () => {
    const server = await serve();
    const first = await fetch(`${server.state.url}prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Keep replies short." }),
    });
    expect(first.status).toBe(200);

    const empty = await fetch(`${server.state.url}prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "   " }),
    });
    expect(empty.status).toBe(400);
    expect(((await empty.json()) as { error: string }).error).toContain("reset to the default");

    const huge = await fetch(`${server.state.url}prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "x".repeat(PROMPT_MAX + 1) }),
    });
    expect(huge.status).toBe(400);
    expect(((await huge.json()) as { error: string }).error).toContain(String(PROMPT_MAX));

    // A refused write changes nothing: the good edit is still in force.
    const after = (await (await fetch(`${server.state.url}prompt`)).json()) as { rules: { edited: string | null } };
    expect(after.rules.edited).toBe("Keep replies short.");
  });
});

describe("the person's gate", () => {
  let close: (() => Promise<void>) | null = null;

  afterEach(async () => {
    await close?.();
    close = null;
  });

  /** The same server, with the window short: a test cannot wait a minute for
   * a question nobody is going to answer. */
  async function serve() {
    const server = await startVoiceServer({
      home,
      port: 0,
      identity: await identityFor(),
      canvas: "prj_1",
      daemonPort: Number(new URL(base).port),
      confirmTimeoutMs: 700,
    });
    close = server.close;
    return server;
  }

  it("holds a typed delete until the person answers: a yes sends it, a no does not", async () => {
    const server = await serve();

    // The no. The question is asked, and asking is not doing: the item is
    // still on the canvas while it stands.
    const deniedRun = utterance(server.state.url, "delete the Checkout screen");
    const deniedAsk = await theQuestion(server.state.url);
    expect(deniedAsk.what).toContain("Checkout screen");
    expect((await items()).map((i) => i.title)).toContain("Checkout screen");
    expect(await answering(server.state.url, deniedAsk.id, false)).toEqual({ ok: true, allowed: false });

    const denied = await deniedRun;
    expect(denied.state).toBe("refused");
    expect(denied.sent).toEqual([]);
    expect((await items()).map((i) => i.title)).toContain("Checkout screen");
    expect((await log()).some((e) => e.type === "item.delete")).toBe(false);

    // The yes, on the same sentence — the person is the difference.
    const allowedRun = utterance(server.state.url, "delete the Checkout screen");
    const allowedAsk = await theQuestion(server.state.url);
    expect(allowedAsk.id).not.toBe(deniedAsk.id);
    expect(await answering(server.state.url, allowedAsk.id, true)).toEqual({ ok: true, allowed: true });

    const allowed = await allowedRun;
    expect(allowed.failed).toEqual([]);
    expect((await items()).map((i) => i.title)).not.toContain("Checkout screen");
    expect((await log()).at(-1)!.type).toBe("item.delete");

    // Both answers are in the record, with the question they answered — which
    // is the only thing that can say, a week later, whether it asked first.
    const entries = ((await (await fetch(`${server.state.url}log`)).json()) as { entries: any[] }).entries;
    expect(entries.some((e) => e.details?.kind === "confirm_requested")).toBe(true);
    expect(entries.some((e) => e.details?.kind === "confirm_declined")).toBe(true);
    expect(entries.some((e) => e.details?.kind === "confirm_allowed")).toBe(true);
  });

  it("reads no answer as a no, and says so rather than pretending it happened", async () => {
    const server = await serve();
    const run = utterance(server.state.url, "delete the Checkout screen");
    await theQuestion(server.state.url);

    const out = await run;
    expect(out.state).toBe("refused");
    expect(out.reply).toContain("did not confirm");
    expect((await items()).map((i) => i.title)).toContain("Checkout screen");

    const entries = ((await (await fetch(`${server.state.url}log`)).json()) as { entries: any[] }).entries;
    const expired = entries.find((e) => e.reason === "no answer");
    expect(expired, "the expiry is in the log, with its reason").toBeDefined();
    // And the question is gone: a stale question on the page is a person
    // answering something that already happened.
    const state = (await (await fetch(`${server.state.url}state`)).json()) as { confirm: unknown };
    expect(state.confirm).toBeNull();
  });

  it("answers an answer that is not the question being asked", async () => {
    const server = await serve();
    const run = utterance(server.state.url, "delete the Checkout screen");
    const ask = await theQuestion(server.state.url);

    const stale = await answering(server.state.url, "cfm_not_the_one", true);
    expect(stale.ok).toBe(false);
    expect(await answering(server.state.url, ask.id, false)).toEqual({ ok: true, allowed: false });
    await run;
  });

  it("takes a claim from the page's own drawer: POST /actor names the agent, no second question", async () => {
    const server = await serve();
    const before = ((await (await fetch(`${server.state.url}state`)).json()) as any).agent as {
      id: string;
      name: string;
    };
    expect(before.name).toBe("Voice");

    // What the settings drawer sends when a person presses "Claim this name".
    const claimed = await fetch(`${server.state.url}actor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Nova" }),
    });
    expect(claimed.status).toBe(200);
    const body = (await claimed.json()) as { ok: boolean; actor: { id: string; name: string }; answer: string };
    expect(body.ok).toBe(true);
    expect(body.actor).toEqual({ id: before.id, name: "Nova" });
    expect(body.answer).toContain("Nova");

    // The person pressed a button; nothing is waiting for them to answer
    // their own question.
    const state = (await (await fetch(`${server.state.url}state`)).json()) as any;
    expect(state.confirm, "no gate for the person's own press").toBeNull();
    expect(state.name).toBe("Nova");
    expect(state.agent.id).toBe(before.id);
    expect((await namesOnCanvas())[before.id]).toBe("Nova");

    // And it is in the record, saying it came from the drawer rather than
    // from the microphone.
    const entries = ((await (await fetch(`${server.state.url}log`)).json()) as any).entries as any[];
    const row = entries.find((e) => e.name === "actor_claim" && e.result?.ok === true);
    expect(row.args.via).toBe("settings");
    expect(row.source, "a person's press, not the model").toBe("typed");
    expect(row.op.type).toBe("actor.claim");

    // A name somebody answers to is refused in the daemon's own words, so the
    // page can print the sentence verbatim.
    const taken = await fetch(`${server.state.url}actor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Seeder" }),
    });
    expect(taken.status).toBe(409);
    expect(((await taken.json()) as { error: string }).error).toContain("Seeder");
    expect(((await (await fetch(`${server.state.url}state`)).json()) as any).name).toBe("Nova");

    // A blank name is refused rather than quietly doing nothing.
    const blank = await fetch(`${server.state.url}actor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "  " }),
    });
    expect(blank.status).toBe(400);
  });

  it("answers the daemon picker honestly: the one it is on, and a refusal that names the remedy", async () => {
    const server = await serve();

    // What the drawer's probe reads.
    const listed = await fetch(`${server.state.url}daemons`);
    expect(listed.status).toBe(200);
    const body = (await listed.json()) as {
      found: { url: string; current: boolean; reason: string }[];
      current: string;
    };
    expect(body.found).toHaveLength(1);
    expect(body.found[0]!.url).toBe(base);
    expect(body.found[0]!.current).toBe(true);
    expect(body.found[0]!.reason, "one item is not a fact anybody can act on").toContain("attached");

    // What "Use this daemon" posts — a refusal, not a 405 and not a lie, and
    // the refusal says what to do instead.
    const refused = await fetch(`${server.state.url}daemon`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "http://127.0.0.1:9999" }),
    });
    expect(refused.status).toBe(400);
    const refusal = (await refused.json()) as { error: string; remedy: string; current: string };
    expect(refusal.error).toContain("cannot change daemon while it runs");
    // The remedy is the package's own start command now that `isocan voice` is
    // gone: a refusal that names a verb nobody has is worse than none.
    expect(refusal.error).toContain("npm start -w @isocan/voice-agent");
    expect(refusal.error, "the value asked for is named back").toContain("http://127.0.0.1:9999");
    expect(refusal.remedy).toBe("ISOCAN_PORT=<port> npm start -w @isocan/voice-agent");
    expect(refusal.current).toBe(base);

    // And it was not applied: the harness is still attached where it was.
    const after = (await (await fetch(`${server.state.url}state`)).json()) as any;
    expect(after.daemon).toBe(base);
    const entries = ((await (await fetch(`${server.state.url}log`)).json()) as any).entries as any[];
    const row = entries.find((e) => e.name === "daemon_change");
    expect(row.result.ok).toBe(false);
    expect(row.args.via).toBe("settings");
  });

  it("takes an enrolment from the page: POST /enrol stands the agent up, once, and says what is missing", async () => {
    const server = await serve();
    const before = ((await (await fetch(`${server.state.url}state`)).json()) as any).agent as { id: string; enrolled: boolean };
    expect(before.enrolled, "nothing has enrolled it yet").toBe(false);

    // What the drawer's "Enrol from here" posts.
    const enrolled = await fetch(`${server.state.url}enrol`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Voice" }),
    });
    expect(enrolled.status).toBe(200);
    const body = (await enrolled.json()) as { enrolled: boolean; adapter: { declared: boolean }; answer: string };
    expect(body.enrolled).toBe(true);
    // The voice agent is a builtin of the harness registry, so there is no
    // declaration left that an enrolment could be missing: the answer enrols
    // rather than warning about an adapter nobody wrote.
    expect(body.adapter.declared).toBe(true);
    expect(body.answer).not.toContain("acpAdapters");

    // The canvas now carries the standing — an op everybody can read.
    const snap = (await (
      await fetch(`${base}/api/projects/prj_1/canvas`, { headers: badge.headers })
    ).json()) as { canvas: { agents?: Record<string, { actor: { id: string; name: string } }> } };
    expect(snap.canvas.agents?.[before.id]?.actor.name).toBe("Voice");
    expect((await log())[0]!.type).toBe("project.create");
    expect((await log()).at(-1)!.type).toBe("agent.enroll");

    // And the machine's half, at the harness's own working directory.
    const rows = await readRcAgents(home);
    const row = rows.find((r) => r.actorId === before.id)!;
    expect(row.name).toBe("Voice");
    expect(row.harness).toBe("voice");
    expect(rows.filter((r) => r.actorId === before.id), "one row, not two").toHaveLength(1);

    // The page's own facts follow, which is what removes the step.
    const state = (await (await fetch(`${server.state.url}state`)).json()) as any;
    expect(state.agent.enrolled, "the drawer's step disappears because the fact changed").toBe(true);

    // Enrolling twice is the same enrolment, not a second one.
    const again = await fetch(`${server.state.url}enrol`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Voice" }),
    });
    expect(again.status).toBe(200);
    expect((await readRcAgents(home)).filter((r) => r.actorId === before.id)).toHaveLength(1);
  });

  it("takes a canvas choice from the page: GET /canvases offers them, POST /canvas moves the session", async () => {
    await post("/api/ops", {
      canvasId: null,
      actor: seeder,
      op: { type: "project.create", canvasId: "prj_2", title: "Launch plan" },
    });
    await post("/api/ops", {
      canvasId: null,
      actor: seeder,
      op: { type: "project.create", canvasId: "prj_old", title: "Put away" },
    });
    await post("/api/ops", {
      canvasId: "prj_old",
      actor: seeder,
      op: { type: "project.update", patch: shelvePatch(new Date().toISOString()) },
    });
    const server = await serve();

    // What the drawer's picker reads.
    const listed = await fetch(`${server.state.url}canvases`);
    expect(listed.status).toBe(200);
    const offered = (await listed.json()) as { canvases: { id: string; title: string; current: boolean }[]; current: string };
    expect(offered.current).toBe("prj_1");
    // The two this test made, newest first, and NOT the one put away — other
    // canvases in the home (the fixture's own directory canvas) are beside the
    // point.
    const mine = offered.canvases
      .filter((c) => ["Launch plan", "Voice test", "Put away"].includes(c.title))
      .map((c) => c.title);
    expect(mine).toEqual(["Launch plan", "Voice test"]);
    expect(offered.canvases.filter((c) => c.current).map((c) => c.id)).toEqual(["prj_1"]);

    // And what pressing "Use this canvas" posts.
    const moved = await fetch(`${server.state.url}canvas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "prj_2" }),
    });
    expect(moved.status).toBe(200);
    const body = (await moved.json()) as { canvas: { id: string; title: string }; previous: { id: string } };
    expect(body.canvas).toEqual({ id: "prj_2", title: "Launch plan" });
    expect(body.previous.id).toBe("prj_1");

    const state = (await (await fetch(`${server.state.url}state`)).json()) as any;
    expect(state.canvas.id, "the session moved, and the page that asked is told").toBe("prj_2");
    const after = (await (await fetch(`${server.state.url}canvases`)).json()) as { current: string };
    expect(after.current).toBe("prj_2");

    // The picker's own list can still see where it came from.
    const entries = ((await (await fetch(`${server.state.url}log`)).json()) as any).entries as any[];
    const row = entries.find((e) => e.name === "project_switch" && e.result?.ok === true);
    expect(row.args.via).toBe("settings");
    expect(row.result.from).toBe("prj_1");

    // A reference nobody matches is refused with the words every surface uses.
    const missing = await fetch(`${server.state.url}canvas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "nothing like this" }),
    });
    expect([400, 404]).toContain(missing.status);
    expect(((await missing.json()) as { error: string }).error).toContain("no canvas matches");

    // An AMBIGUOUS local prefix is a different refusal, and it must not fall
    // through to the public catalogue: nothing there may silently win.
    await post("/api/ops", {
      canvasId: null,
      actor: seeder,
      op: { type: "project.create", canvasId: "prj_amb_a", title: "Winter work" },
    });
    await post("/api/ops", {
      canvasId: null,
      actor: seeder,
      op: { type: "project.create", canvasId: "prj_amb_b", title: "Winter rest" },
    });
    const ambiguous = await fetch(`${server.state.url}canvas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "Winter" }),
    });
    expect(ambiguous.status).toBe(400);
    expect(((await ambiguous.json()) as { error: string }).error).toContain("ambiguous");
  });

  it("joins a canvas from a pasted address with its pass, a bare token, and the public catalogue", async () => {
    await post("/api/ops", {
      canvasId: null,
      actor: seeder,
      op: { type: "project.create", canvasId: "prj_2", title: "Launch plan" },
    });
    await post("/api/ops", {
      canvasId: null,
      actor: seeder,
      op: { type: "project.create", canvasId: "prj_3", title: "Public house" },
    });
    const server = await serve();

    // 1. The whole pasted line — address with its `#pss_…` pass — redeems the
    // pass and moves the session onto the canvas it names.
    const minted = await fetch(`${base}${passesRoute("prj_2")}`, { method: "POST", headers: badge.headers });
    expect(minted.status).toBe(200);
    const { pass, token } = (await minted.json()) as { pass: { id: string }; token: string };
    const joined = await fetch(`${server.state.url}canvas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ref: `${base}/p/prj_2#${token}` }),
    });
    expect(joined.status, await joined.clone().text()).toBe(200);
    const body = (await joined.json()) as { canvas: { id: string; title: string }; previous: { id: string } };
    expect(body.canvas).toEqual({ id: "prj_2", title: "Launch plan" });
    expect(body.previous.id).toBe("prj_1");
    // The pass is spent: the join was the redemption, not a local guess.
    const spent = await fetch(`${base}${passRoute("prj_2", pass.id)}`, { headers: badge.headers });
    expect(((await spent.json()) as { pass: { redeemedAt?: string } }).pass.redeemedAt).toBeDefined();

    // 2. A bare token — the redemption's own answer names the canvas.
    const back = await fetch(`${base}${passesRoute("prj_1")}`, { method: "POST", headers: badge.headers });
    const { token: backToken } = (await back.json()) as { token: string };
    const movedBack = await fetch(`${server.state.url}canvas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ref: backToken }),
    });
    expect(movedBack.status, await movedBack.clone().text()).toBe(200);
    expect(((await movedBack.json()) as { canvas: { id: string } }).canvas.id).toBe("prj_1");

    // 2b. The whole "Bring your own agent…" paragraph — address and pass
    // buried in prose and a command line — extracts the same way.
    const dialogPass = await fetch(`${base}${passesRoute("prj_2")}`, { method: "POST", headers: badge.headers });
    const { token: dialogToken } = (await dialogPass.json()) as { token: string };
    const paragraph = cloudAgentInstructions(base, "prj_2", dialogToken);
    expect(paragraph).toContain(dialogToken); // the dialog really carries it
    const viaDialog = await fetch(`${server.state.url}canvas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ref: paragraph }),
    });
    expect(viaDialog.status, await viaDialog.clone().text()).toBe(200);
    expect(((await viaDialog.json()) as { canvas: { id: string } }).canvas.id).toBe("prj_2");

    // 3. A published canvas shows in the picker, and POSTing its id joins it.
    const granted = await fetch(`${base}${grantsRoute("prj_3")}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...badge.headers },
      body: JSON.stringify({ subject: "link", capability: "read", actorId: seeder.id }),
    });
    const { grant } = (await granted.json()) as { grant: { id: string } };
    const listed = await fetch(`${base}${publicListingRoute("prj_3", grant.id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...badge.headers },
      body: JSON.stringify({ listed: true, actorId: seeder.id }),
    });
    expect(listed.status).toBe(200);
    const offered = await fetch(`${server.state.url}canvases`);
    const catalogue = (await offered.json()) as { public: { id: string; title: string }[] };
    expect(catalogue.public.map((c) => c.title)).toContain("Public house");
    const viaPublic = await fetch(`${server.state.url}canvas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "prj_3" }),
    });
    expect(viaPublic.status, await viaPublic.clone().text()).toBe(200);
    expect(((await viaPublic.json()) as { canvas: { id: string } }).canvas.id).toBe("prj_3");

    // A pasted address without a pass is refused honestly, not cheerfully
    // moved: nothing admits this badge to a canvas it has never seen.
    const noPass = await fetch(`${server.state.url}canvas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ref: `${base}/p/prj_nope` }),
    });
    expect(noPass.status).toBe(400);
  });

});

describe("what an agent is called", () => {


  async function canvasNames(): Promise<Record<string, string>> {
    const res = await fetch(`${base}/api/projects/prj_1/canvas`, { headers: badge.headers });
    return ((await res.json()) as { names?: Record<string, string> }).names ?? {};
  }

  /** The identity ledger on disk — the home's own record of who a name
   * belongs to, which is the half a canvas view cannot show. */
  async function nameRows(): Promise<Record<string, { name: string }>> {
    const raw = JSON.parse(await fs.readFile(path.join(home, "actors.json"), "utf8")) as {
      names?: Record<string, { name: string }>;
    };
    return raw.names ?? {};
  }

  /**
   * **The door the page was missing, driven from the outside.**
   *
   * The settings drawer posts here — `POST /actor` — where before only the
   * model's tool and the CLI could name the agent, which put the capability on
   * the wrong side of the glass. This asserts what Paul would check: the name
   * lands, the actor keeps its id, and the canvas, the ledger, `/state` AND a
   * freshly started harness all say the same name afterwards.
   */
  it("claims a name over POST /actor, and every place that names it agrees", async () => {
    const first = await liveServer();
    let second: Awaited<ReturnType<typeof liveServer>> | null = null;
    try {
      const before = ((await (await fetch(`${first.server.state.url}state`)).json()) as { agent: { id: string; name: string } })
        .agent;
      expect(before.name).toBe("Voice");

      const claimed = (await (
        await fetch(`${first.server.state.url}actor`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Vox" }),
        })
      ).json()) as { ok: boolean; actor: { id: string; name: string }; resumed: boolean; answer: string };
      expect(claimed).toMatchObject({ ok: true, resumed: false });
      expect(claimed.actor.name).toBe("Vox");
      expect(claimed.actor.id, "a rename keeps the actor's id").toBe(before.id);
      expect(claimed.answer).toContain("Vox");

      // 1. /state, the surface the page reads.
      const after = ((await (await fetch(`${first.server.state.url}state`)).json()) as { agent: { id: string; name: string } })
        .agent;
      expect(after).toMatchObject({ id: before.id, name: "Vox" });

      // 2. The canvas's own record — what `rc turn <name>`, the agent tray and
      //    `isocan who` read.
      expect((await canvasNames())[before.id]).toBe("Vox");

      // 3. The identity ledger on disk, the home's record of who a name belongs to.
      expect((await nameRows())[before.id]!.name).toBe("Vox");

      // 4. A harness started fresh, on the same home, agrees. That is the claim
      //    that matters after a restart.
      await first.close();
      second = await liveServer();
      const restarted = ((await (await fetch(`${second.server.state.url}state`)).json()) as {
        agent: { id: string; name: string };
      }).agent;
      expect(restarted).toMatchObject({ id: before.id, name: "Vox" });

      // A second press of the same button is not an error and moves nothing.
      const again = (await (
        await fetch(`${second.server.state.url}actor`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Vox" }),
        })
      ).json()) as { ok: boolean; resumed: boolean; actor: { id: string; name: string } };
      expect(again).toMatchObject({ ok: true, resumed: true });
      expect(again.actor.id).toBe(before.id);
    } finally {
      await first.close().catch(() => undefined);
      await second?.close().catch(() => undefined);
    }
  });

  it("lists the projects and the daemon for the drawer, and moves the session to one it is told", async () => {
    // A second canvas, so a switch has somewhere to go.
    await post("/api/ops", {
      canvasId: null,
      actor: seeder,
      op: { type: "project.create", canvasId: "prj_2", title: "Winter work" },
    });
    const live = await liveServer();
    try {
      const list = (await (await fetch(`${live.server.state.url}canvases`)).json()) as {
        current: string;
        canvases: { id: string; title: string }[];
      };
      expect(list.current).toBe("prj_1");
      // The daemon may hold more than this test made; what matters is that
      // both are offered and the current one is marked.
      expect(list.canvases.map((one) => one.id)).toEqual(expect.arrayContaining(["prj_1", "prj_2"]));

      const daemons = (await (await fetch(`${live.server.state.url}daemons`)).json()) as {
        current: string;
        found: { url: string; reachable: boolean; canvases?: number }[];
      };
      expect(daemons.current).toBe(base);
      expect(daemons.found[0]).toMatchObject({ url: base, reachable: true });
      expect(daemons.found[0]!.canvases).toBeGreaterThanOrEqual(2);

      // Choosing the project: the session moves, /state says so, and choosing
      // the one it is already on is not an error.
      const moved = (await (
        await fetch(`${live.server.state.url}canvas`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: "prj_2" }),
        })
      ).json()) as { ok: boolean; canvas: { id: string; title: string }; previous: { id: string } };
      expect(moved).toMatchObject({ ok: true, canvas: { id: "prj_2", title: "Winter work" }, previous: { id: "prj_1" } });
      const state = (await (await fetch(`${live.server.state.url}state`)).json()) as {
        canvas: { id: string; title: string };
      };
      expect(state.canvas).toMatchObject({ id: "prj_2", title: "Winter work" });

      const again = (await (
        await fetch(`${live.server.state.url}canvas`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: "prj_2" }),
        })
      ).json()) as { ok: boolean; unchanged?: boolean };
      expect(again).toMatchObject({ ok: true, unchanged: true });

      // A canvas nobody has is a 404 in the daemon's own words, and an empty
      // body is a 400 — neither silently does nothing.
      const missing = await fetch(`${live.server.state.url}canvas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "prj_nope" }),
      });
      expect([400, 404]).toContain(missing.status);
      const empty = await fetch(`${live.server.state.url}canvas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(empty.status).toBe(400);
    } finally {
      await live.close();
    }
  });

  it("refuses what cannot be a name, and says who owns one already taken", async () => {
    const live = await liveServer();
    try {
      const post = async (name: unknown) => {
        const res = await fetch(`${live.server.state.url}actor`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        return { status: res.status, body: (await res.json()) as { ok: boolean; error: string } };
      };

      expect((await post("")).status).toBe(400);
      expect((await post("x".repeat(80))).status).toBe(400);
      // Somebody on this canvas already answers to "Seeder": the daemon's own
      // refusal is the answer, and nothing moved.
      const clash = await post("Seeder");
      expect(clash.status).toBe(409);
      expect(clash.body.error).toContain("Seeder");
      expect((await nameRows())[((await (await fetch(`${live.server.state.url}state`)).json()) as { agent: { id: string } }).agent.id]!.name).toBe("Voice");
    } finally {
      await live.close();
    }
  });

  it("renames in place when the person names it, and the canvas, the ledger and the face follow", async () => {
    const live = await liveServer();
    try {
      const before = ((await (await fetch(`${live.server.state.url}state`)).json()) as any).agent as {
        id: string;
        name: string;
      };
      expect(before.name).toBe("Voice");
      expect((await canvasNames())[before.id]).toBe("Voice");

      // The model proposes; the person answers. Nothing has moved yet.
      const call = callTool(live.providerSocket, "call-name", "actor_claim", { name: "Nova" });
      const ask = await theQuestion(live.server.state.url);
      expect(ask.what).toContain("Nova");
      expect(ask.what).toContain("Voice");
      expect((await canvasNames())[before.id], "the name is the person's to give").toBe("Voice");

      expect(await answering(live.server.state.url, ask.id, true)).toEqual({ ok: true, allowed: true });
      const answered = await call;
      expect(answered.response.ok).toBe(true);

      // In place: the same actor, so every op it ever wrote is still its own.
      expect(answered.response.actor.id).toBe(before.id);
      expect(answered.response.actor.name).toBe("Nova");
      expect((await canvasNames())[before.id]).toBe("Nova");

      // The home's ledger, and the harness's own account of itself.
      expect((await nameRows())[before.id]!.name).toBe("Nova");
      const state = (await (await fetch(`${live.server.state.url}state`)).json()) as any;
      expect(state.name).toBe("Nova");
      expect(state.agent.id).toBe(before.id);

      // The face the canvas shows is re-worn, not left with the old name on it.
      const sessions = (await (
        await fetch(`${base}/api/projects/prj_1/sessions`, { headers: badge.headers })
      ).json()) as { actor: { id: string }; label?: string; name?: string }[];
      expect(sessions.some((s) => s.actor.id === before.id && (s.label ?? s.name) === "Nova")).toBe(true);
      expect(sessions.some((s) => s.actor.id === before.id && (s.label ?? s.name) === "Voice")).toBe(false);

      // And /log says a claim was made, named.
      const entries = ((await (await fetch(`${live.server.state.url}log`)).json()) as any).entries as any[];
      const claim = entries.find((e) => e.op?.type === "actor.claim" && e.result?.ok === true);
      expect(claim, "the claim is in the harness's own record").toBeDefined();
      expect(claim.op.said).toContain("Nova");
    } finally {
      await live.close();
    }
  });

  it("changes nothing when the person refuses, and says whose name it is when the daemon refuses", async () => {
    const live = await liveServer();
    try {
      const before = ((await (await fetch(`${live.server.state.url}state`)).json()) as any).agent as {
        id: string;
        name: string;
      };

      // The person says no: the model does not get to name itself.
      const declined = callTool(live.providerSocket, "call-declined", "actor_claim", { name: "Helper" });
      const firstAsk = await theQuestion(live.server.state.url);
      await answering(live.server.state.url, firstAsk.id, false);
      const refused = await declined;
      expect(refused.response.ok).toBe(false);
      expect(refused.response.error).toContain("did not confirm");
      expect((await nameRows())[before.id]!.name).toBe("Voice");

      // The person says yes to a name somebody on this canvas already answers
      // to: the daemon refuses, in its own words, and the refusal is shown.
      const taken = callTool(live.providerSocket, "call-taken", "actor_claim", { name: "Seeder" });
      const secondAsk = await theQuestion(live.server.state.url);
      await answering(live.server.state.url, secondAsk.id, true);
      const clash = await taken;
      expect(clash.response.ok).toBe(false);
      expect(clash.response.error).toContain("not renamed");
      expect(clash.response.error).toContain("Seeder");
      expect((await nameRows())[before.id]!.name).toBe("Voice");
      expect((await canvasNames())[before.id]).toBe("Voice");
    } finally {
      await live.close();
    }
  });
});

describe("the projects this session can work on", () => {


  it("makes a canvas the person asked for, and leaves the session where it was", async () => {
    const live = await liveServer();
    try {
      const made = await callTool(live.providerSocket, "call-create", "project_create", {
        title: "Launch plan",
        description: "the redesign",
      });
      expect(made.response.ok).toBe(true);
      const canvasId = made.response.canvas.id as string;
      expect(canvasId).toMatch(/^prj_/);

      // The home lists it, and its own log holds its birth — the same
      // `project.create` `isocan canvas create` sends, sent as this agent.
      const canvases = (await (await fetch(`${base}/api/projects`, { headers: badge.headers })).json()) as {
        id: string;
        title: string;
      }[];
      expect(canvases.find((c) => c.id === canvasId)?.title).toBe("Launch plan");
      const born = (await log([canvasId])).find((e) => e.type === "project.create");
      expect(born, "a new canvas's log starts with its own birth").toBeDefined();
      expect(born!.actor).not.toBe(seeder.id);

      // Created, not entered: the session is still on the canvas it was on,
      // because nothing was switched and the answer says so.
      const state = (await (await fetch(`${live.server.state.url}state`)).json()) as any;
      expect(state.canvas.id).toBe("prj_1");
      expect(made.response.answer).toContain("still on");

      // A canvas with no name is refused rather than made blank.
      const blank = await callTool(live.providerSocket, "call-blank", "project_create", { title: "   " });
      expect(blank.response.ok).toBe(false);
      expect(blank.response.error).toContain("title");

      const entries = ((await (await fetch(`${live.server.state.url}log`)).json()) as any).entries as any[];
      const row = entries.find((e) => e.name === "project_create" && e.result?.ok === true);
      expect(row.op.type).toBe("project.create");
      expect(row.result.canvasId).toBe(canvasId);
    } finally {
      await live.close();
    }
  });

  it("the whole walk in one sitting: create a canvas, list it, switch to it, speak a command", async () => {
    const live = await liveServer();
    try {
      // 1. A canvas, from a sentence the person said.
      const made = await callTool(live.providerSocket, "walk-create", "project_create", { title: "Winter work" });
      expect(made.response.ok).toBe(true);
      const winter = made.response.canvas.id as string;

      // 2. Where the session is, and what else there is.
      const listed = await callTool(live.providerSocket, "walk-list", "project_list");
      expect(listed.response.current).toBe("prj_1");
      expect((listed.response.canvases as { title: string }[]).map((c) => c.title)).toContain("Winter work");

      // 3. Move there — and the harness's own account of itself moves.
      const moved = await callTool(live.providerSocket, "walk-switch", "project_switch", { canvas_ref: "Winter work" });
      expect(moved.response.canvas).toEqual({ id: winter, title: "Winter work" });
      expect(((await (await fetch(`${live.server.state.url}state`)).json()) as any).canvas.id).toBe(winter);

      // 4. A command, spoken after the move. The canvas and the log agree: the
      // operation is in the NEW canvas's oplog, and the harness's /log reads
      // create → switch → add, in that order.
      //
      // `group.change` and not `item.add`, deliberately: a canvas born on this
      // desk is a GROUP canvas (`groupMode: "groups"`, a new canvas's default
      // in `packages/server/src/engine.ts`), and on one of those an add is
      // recorded as the group write it becomes (`canvas-groups.ts`,
      // `resolveCanvasGroupRequest`). Two entries, and the second is the add —
      // which is what this test is about. The harness's own log still calls the
      // tool `add_item`; the oplog is the desk's spelling of what it did.
      const spoken = await callTool(live.providerSocket, "walk-say", "add_item", {
        title: "Kick-off notes",
        text: "what the plan says",
      });
      expect(spoken.response.ok).toBe(true);
      expect((await log([winter])).map((e) => e.type)).toEqual(["project.create", "group.change"]);
      expect((await log(["prj_1"])).map((e) => e.type)).toEqual(["project.create", "group.change"]);
      expect(((await (await fetch(`${live.server.state.url}state`)).json()) as any).canvas.id).toBe(winter);

      const entries = ((await (await fetch(`${live.server.state.url}log`)).json()) as any).entries as any[];
      const walked = entries
        .filter((e) => ["project_create", "project_switch", "add_item"].includes(e.name))
        .map((e) => e.name);
      expect(walked).toEqual(["project_create", "project_switch", "add_item"]);
    } finally {
      await live.close();
    }
  });

  it("switches the session to another canvas, and the log, the tool context and the page follow it", async () => {
    await post("/api/ops", {
      canvasId: null,
      actor: seeder,
      op: { type: "project.create", canvasId: "prj_2", title: "Launch plan" },
    });
    await post("/api/ops", {
      canvasId: "prj_2",
      actor: seeder,
      op: {
        type: "item.add",
        itemId: "itm_launch",
        version: { id: "ver_l", blobHash: "h9", mimeType: "text/markdown", filename: "l.md", size: 3 },
        width: 320,
        height: 240,
        placement: { x: 40, y: 40 },
        title: "Launch checklist",
      },
    });

    const live = await liveServer();
    try {
      const before = (await (await fetch(`${live.server.state.url}state`)).json()) as any;
      expect(before.canvas.id).toBe("prj_1");

      const moved = await callTool(live.providerSocket, "call-switch", "project_switch", {
        canvas_ref: "Launch plan",
      });
      expect(moved.response.ok).toBe(true);
      expect(moved.response.canvas).toEqual({ id: "prj_2", title: "Launch plan" });
      expect(moved.response.previous).toEqual({ id: "prj_1", title: "Voice test" });
      // The tool context followed: the answer carries the NEW canvas's items,
      // which is what the model has to work with from here.
      expect(moved.response.items.map((i: { title: string }) => i.title)).toEqual(["Launch checklist"]);
      expect(moved.response.answer).toContain("Every operation from here lands on it");

      // Nothing was minted by the move itself: switching is not a canvas edit.
      // (The add is logged as a `group.change` because the fixture's canvas is
      // a group canvas, like every canvas born on this desk.)
      expect((await log(["prj_2"])).map((e) => e.type)).toEqual(["project.create", "group.change"]);

      // The harness's own account of itself, and the page's, followed.
      const after = (await (await fetch(`${live.server.state.url}state`)).json()) as any;
      expect(after.canvas).toEqual({ title: "Launch plan", id: "prj_2" });
      expect(live.toPage.some((m) => m.canvas?.id === "prj_2"), "the page is told, not left naming the old room").toBe(
        true,
      );
      // ...and so did the machine-readable file this harness keeps for anyone
      // looking from outside.
      const recorded = JSON.parse(await fs.readFile(path.join(home, "voice", "server.json"), "utf8")) as {
        canvas: string;
      };
      expect(recorded.canvas).toBe("Launch plan");

      // Presence moved rooms: ended on the old canvas, standing on the new.
      const onOld = (await (
        await fetch(`${base}/api/projects/prj_1/sessions`, { headers: badge.headers })
      ).json()) as { actor: { id: string } }[];
      const onNew = (await (
        await fetch(`${base}/api/projects/prj_2/sessions`, { headers: badge.headers })
      ).json()) as { actor: { id: string } }[];
      const me = after.agent.id as string;
      expect(onOld.some((s) => s.actor.id === me), "not still standing in the room it left").toBe(false);
      expect(onNew.some((s) => s.actor.id === me)).toBe(true);

      // Now the point of the whole thing: a command SPOKEN after the switch
      // lands on the new canvas — and shows up in that canvas's log, not the
      // other one.
      const spoken = await callTool(live.providerSocket, "call-add", "add_item", {
        title: "Kick-off notes",
        text: "what the plan says",
      });
      expect(spoken.response.ok).toBe(true);
      // Two on prj_2 — the fixture's item and the spoken one, each recorded as
      // the group write an add becomes on a group canvas (see above) — and the
      // spoken one is the only new entry on prj_2. prj_1 does not move.
      expect((await log(["prj_2"])).map((e) => e.type)).toEqual(["project.create", "group.change", "group.change"]);
      expect((await log(["prj_1"])).map((e) => e.type)).toEqual(["project.create", "group.change"]);

      // The harness's /log says the move happened, and to where.
      const entries = ((await (await fetch(`${live.server.state.url}log`)).json()) as any).entries as any[];
      const row = entries.find((e) => e.name === "project_switch" && e.result?.ok === true);
      expect(row.result.canvasId).toBe("prj_2");
      expect(row.result.from).toBe("prj_1");
      expect(row.op, "a move mints no operation").toBeUndefined();

      // Asking for the canvas it is already on is not an error.
      const again = await callTool(live.providerSocket, "call-again", "project_switch", {
        canvas_ref: "prj_2",
      });
      expect(again.response.ok).toBe(true);
      expect(again.response.answer).toContain("already on");

      const nowhere = await callTool(live.providerSocket, "call-nowhere", "project_switch", {
        canvas_ref: "no such project",
      });
      expect(nowhere.response.ok).toBe(false);
      expect(nowhere.response.error).toContain("no canvas matches");
    } finally {
      await live.close();
    }
  });

  it("renames the canvas this session is on, and the page's own account of itself with it", async () => {
    const live = await liveServer();
    try {
      const renamed = await callTool(live.providerSocket, "call-rename-canvas", "project_update", {
        title: "Winter work",
      });
      expect(renamed.response.ok).toBe(true);
      expect(renamed.response.canvas).toEqual({ id: "prj_1", title: "Winter work" });

      const canvases = (await (await fetch(`${base}/api/projects`, { headers: badge.headers })).json()) as {
        id: string;
        title: string;
      }[];
      expect(canvases.find((c) => c.id === "prj_1")?.title).toBe("Winter work");
      expect((await log())[0]!.type).toBe("project.create");
      const last = (await log()).at(-1)!;
      expect(last.type).toBe("project.update");
      expect(last.actor).not.toBe(seeder.id);

      // The harness's own account of itself follows — the header, the facts
      // panel and the tool context all read this one label.
      const state = (await (await fetch(`${live.server.state.url}state`)).json()) as any;
      expect(state.canvas).toEqual({ title: "Winter work", id: "prj_1" });

      const entries = ((await (await fetch(`${live.server.state.url}log`)).json()) as any).entries as any[];
      const row = entries.find((e) => e.name === "project_update" && e.result?.ok === true);
      expect(row.op.type).toBe("project.update");
      expect(row.op.said).toContain("Voice test");
    } finally {
      await live.close();
    }
  });

  it("edits another canvas by name, and refuses a canvas nobody can find or an empty edit", async () => {
    await post("/api/ops", {
      canvasId: null,
      actor: seeder,
      op: { type: "project.create", canvasId: "prj_2", title: "Launch plan" },
    });
    const live = await liveServer();
    try {
      const other = await callTool(live.providerSocket, "call-other", "project_update", {
        canvas_ref: "Launch plan",
        title: "Launch plan v2",
        description: "the redesign",
      });
      expect(other.response.ok).toBe(true);
      const canvases = (await (await fetch(`${base}/api/projects`, { headers: badge.headers })).json()) as {
        id: string;
        title: string;
      }[];
      expect(canvases.find((c) => c.id === "prj_2")?.title).toBe("Launch plan v2");
      // ...and the session did not move to the canvas it edited.
      const state = (await (await fetch(`${live.server.state.url}state`)).json()) as any;
      expect(state.canvas.id).toBe("prj_1");

      const missing = await callTool(live.providerSocket, "call-missing", "project_update", {
        canvas_ref: "nothing like this",
        title: "Nope",
      });
      expect(missing.response.ok).toBe(false);
      expect(missing.response.error).toContain("no canvas matches");

      const empty = await callTool(live.providerSocket, "call-empty", "project_update", {});
      expect(empty.response.ok).toBe(false);
      expect(empty.response.error).toContain("nothing to change");
    } finally {
      await live.close();
    }
  });

  it("lists the canvases a person can work on, marks where the session is, and leaves the shelf out", async () => {
    // A second canvas, and a third put away. The shelf rule is core's
    // (`inScope`), and this is the only place it is checked through the tool.
    await post("/api/ops", {
      canvasId: null,
      actor: seeder,
      op: { type: "project.create", canvasId: "prj_2", title: "Launch plan" },
    });
    await post("/api/ops", {
      canvasId: null,
      actor: seeder,
      op: { type: "project.create", canvasId: "prj_old", title: "Put away" },
    });
    await post("/api/ops", {
      canvasId: "prj_old",
      actor: seeder,
      op: { type: "project.update", patch: shelvePatch(new Date().toISOString()) },
    });

    const live = await liveServer();
    try {
      const listed = await callTool(live.providerSocket, "call-list", "project_list");
      expect(listed.response.ok).toBe(true);
      const titles = (listed.response.canvases as { id: string; title: string }[]).map((c) => c.title);
      expect(titles).toContain("Voice test");
      expect(titles).toContain("Launch plan");
      expect(titles, "a shelved canvas is not in the way").not.toContain("Put away");
      expect(listed.response.current).toBe("prj_1");
      // The model has to be able to NAME one to switch to it, and the id is
      // what every other tool takes.
      expect(listed.response.answer).toContain("[prj_2]");
      expect(listed.response.answer).toContain("(this session is here)");

      const entries = ((await (await fetch(`${live.server.state.url}log`)).json()) as any).entries as any[];
      const row = entries.find((e) => e.name === "project_list");
      expect(row, "a read is a read: nothing was minted").toBeDefined();
      expect(row.op).toBeUndefined();
      expect(row.result.ok).toBe(true);
    } finally {
      await live.close();
    }
  });
});

describe("the name the enrolment summons", () => {
  /**
   * **The state both tests here start from**: the agent enrolled on prj_1, a
   * harness standing, and a rename to Nova that the person allowed at the
   * gate. Built once because the point is what the rename LEFT BEHIND, and two
   * copies of fifty lines of setup would drift.
   */
  async function enrolledAndRenamed() {
    const named = await isocan(["identity", "--name", "Person", "--as", "usr_person", "--session"], {
      ISOCAN_SESSION_ID: "person",
      ISOCAN_HARNESS: "isocan",
    });
    expect(named.code, named.stderr).toBe(0);
    // `--canvas prj_1`: the point-anywhere form, so the enrolment lands in the
    // room the harness stands in rather than in the one a bare temp cwd would
    // have made for itself.
    const enrolled = await isocan([
      "rc",
      "add",
      "Voice",
      "--harness",
      "voice",
      "--dir",
      home,
      "--canvas",
      "prj_1",
      // Whose word wakes it is not this test's subject, and a parked rc has to
      // take a mention from the fixture's badge rather than from the machine's
      // person, who has no client of its own here.
      "--listen",
      "everyone",
    ]);
    expect(enrolled.code, enrolled.stderr).toBe(0);

    const before = await readRcAgents(home);
    const row = before.find((r) => r.name === "Voice")!;
    expect(row, "the enrolment exists before the rename").toBeDefined();
    const beforeSnap = (await (
      await fetch(`${base}/api/projects/prj_1/canvas`, { headers: badge.headers })
    ).json()) as { canvas: { agents?: Record<string, { actor: { id: string; name: string }; rules?: unknown }> } };
    const beforeStanding = Object.values(beforeSnap.canvas.agents ?? {}).find((a) => a.actor.id === row.actorId)!;
    expect(beforeStanding.actor.name).toBe("Voice");

    await writeVoiceKey(home, { provider: "gemini", key: "AIza-live-test" });
    let providerSocket!: { emit: (m: unknown) => void; sent: string[] };
    class FakeLiveSocket {
      readyState = 1;
      sent: string[] = [];
      onopen: (() => void) | null = null;
      onclose: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onmessage: ((e: { data: unknown }) => void) | null = null;
      constructor(readonly url: string) {
        providerSocket = this;
        queueMicrotask(() => this.onopen?.());
      }
      send(data: string) {
        this.sent.push(data);
      }
      close() {}
      emit(message: unknown) {
        this.onmessage?.({ data: JSON.stringify(message) });
      }
    }
    const server = await startVoiceServer({
      home,
      port: 0,
      identity: await identityFor(),
      canvas: "prj_1",
      daemonPort: Number(new URL(base).port),
      confirmTimeoutMs: 2000,
      WebSocketImpl: FakeLiveSocket as unknown as typeof WebSocket,
    });
    const { WebSocket: WsClient } = await import("ws");
    const clientWs = new WsClient(`${server.state.url.replace("http://", "ws://")}live`);
    await new Promise<void>((r) => clientWs.on("open", () => r()));
    while (!providerSocket) await sleep(10);
    providerSocket.emit({ setupComplete: {} });
    await sleep(50);

    const call = callTool(providerSocket, "enrol-rename", "actor_claim", { name: "Nova" });
    const ask = await theQuestion(server.state.url);
    await answering(server.state.url, ask.id, true);
    const renamedRightNow = await call;

    return {
      server,
      row,
      beforeStanding,
      renamed: renamedRightNow,
      close: async () => {
        clientWs.close();
        await server.close();
      },
    };
  }

  it("moves every copy of the name: the standing, the roster row and the harness's own record", async () => {
    const live = await enrolledAndRenamed();
    const { server, row, beforeStanding } = live;
    try {
      const renamed = live.renamed;
      expect(renamed.response.ok).toBe(true);
      expect(renamed.response.answer, "the answer says what moved").toContain("enrolment");

      // The row moved its LABEL and nothing else: same actor, same harness,
      // same working directory, same place in the file.
      const after = await readRcAgents(home);
      const renamedRow = after.find((r) => r.actorId === row.actorId)!;
      expect(renamedRow.name).toBe("Nova");
      expect(renamedRow.harness).toBe(row.harness);
      expect(renamedRow.cwd).toBe(row.cwd);
      expect(after.filter((r) => r.actorId === row.actorId)).toHaveLength(1);
      expect(after.some((r) => r.name === "Voice"), "no row keeps the old name").toBe(false);

      // The canvas's OWN enrolment record — the copy `rc turn <name>`, the
      // agent tray and `isocan who` read — moved with it, with the actor and
      // the rules untouched.
      const snap = (await (
        await fetch(`${base}/api/projects/prj_1/canvas`, { headers: badge.headers })
      ).json()) as { canvas: { agents?: Record<string, { actor: { id: string; name: string }; rules?: unknown }> } };
      const standing = Object.values(snap.canvas.agents ?? {}).find((a) => a.actor.id === row.actorId)!;
      expect(standing.actor.name, "the standing a summons reads by name").toBe("Nova");
      expect(standing.rules).toEqual(beforeStanding.rules);

      // And this harness's own record of who it is: same id, same key, new name.
      const identity = JSON.parse(
        await fs.readFile(path.join(home, "voice", "identity.json"), "utf8"),
      ) as { actorId: string; sessionKey: string; name: string };
      expect(identity.actorId).toBe(row.actorId);
      expect(identity.name).toBe("Nova");
      expect(identity.sessionKey, "the key is the conversation: a rename does not move it").toBe(
        await machineAgentKey(home, "Voice"),
      );
    } finally {
      await live.close();
    }
  });

  /**
   * **The summons is where a stale name costs the most**: it resolves the name
   * against canvas state and then hands the turn to the adapter — which used to
   * be told what the agent was called rather than which conversation it holds,
   * so a rename made the summon fail with "X is somebody else here".
   *
   * **ONE TURN THROUGH THE REAL ADAPTER**, spawned the way the rc spawns it,
   * with the environment a summons carries. What is asserted here is the
   * harness's half of the handshake: the adapter finds the standing microphone
   * by the enrolment record and the injected canvas, presents the key the
   * record holds, and delivers the person's words — after a rename that moved
   * the name and not the key.
   *
   * The rc's OWN binding step (the claim it makes before spawning, from the
   * name the agent has now) is a CLI-side concern, deliberately not driven
   * here: `packages/rc/src/room.ts` derives that key from `record.actor.name`,
   * and for an agent that has been RENAMED while standing the desk refuses the
   * derived key ("live on a canvas"), so a parked rc cannot complete the turn.
   * `is summoned for real` above is the test that drives the whole rc path, for
   * an agent whose name has not moved.
   */
  async function adapterTurn(prompt: string): Promise<{ said: string }> {
    const env: NodeJS.ProcessEnv = { ...process.env };
    for (const name of harnessVars) delete env[name];
    const child = spawn(process.execPath, [voiceBin, "--acp"], {
      env: {
        ...env,
        ISOCAN_HOME: home,
        ISOCAN_PORT: new URL(base).port,
        ISOCAN_HARNESS: "agent",
        ISOCAN_SESSION_ID: await sessionFor("Nova"),
        ISOCAN_CANVAS: "prj_1",
      },
      cwd: home,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let said = "";
    let replies = "";
    child.stderr!.setEncoding("utf8");
    child.stderr!.on("data", (chunk) => (said += chunk));
    child.stdout!.setEncoding("utf8");
    child.stdout!.on("data", (chunk) => (replies += chunk));
    const ask = (message: unknown) => child.stdin!.write(`${JSON.stringify(message)}\n`);
    ask({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
    ask({ jsonrpc: "2.0", id: 2, method: "session/new", params: {} });
    await until(() => replies, (r) => r.includes('"id":2'), "the adapter to open a session");
    const sessionId = (JSON.parse(replies.split("\n").find((line) => line.includes('"id":2')) ?? "{}") as {
      result?: { sessionId?: string };
    }).result?.sessionId;
    ask({
      jsonrpc: "2.0",
      id: 3,
      method: "session/prompt",
      params: { sessionId, prompt: [{ type: "text", text: prompt }] },
    });
    await until(() => replies, (r) => r.includes('"id":3'), "the adapter to answer the turn");
    child.stdin!.end();
    child.kill("SIGTERM");
    return { said };
  }

  it("summons by the new name, presenting the key the agent already holds", async () => {
    const live = await enrolledAndRenamed();
    try {
      const turn = await adapterTurn("look at the checkout screen");
      // WHICH PATH RAN, said in the adapter's own words: the microphone was
      // already standing, so the summons was handed to it rather than a second
      // one opened.
      expect(turn.said).toContain("attached to the voice harness already standing on port");

      // The page heard the summons, and the person's words arrived whole: the
      // narration ring keeps 300 characters of a summons and the adapter's
      // preamble is longer than that, so the log is where they actually are.
      const log = (await (await fetch(`${live.server.state.url}log`)).json()) as {
        entries: { name?: string; details?: { by?: string; prompt?: string } }[];
      };
      const landed = log.entries.find((e) => e.name === "summons");
      expect(landed?.details?.by).toBe("Nova");
      expect(landed?.details?.prompt).toContain("look at the checkout screen");

      // The old name is a name nothing answers to any more — said plainly,
      // rather than waking a second agent wearing it.
      const byOldName = await isocan(["rc", "turn", "Voice", "--canvas", "prj_1", "hello"]);
      expect(byOldName.code, "the old name must not find the renamed agent").not.toBe(0);
      expect(byOldName.stderr).toContain("no standing agent");
    } finally {
      await live.close();
    }
  });

  /**
   * **Coord's acceptance, in one sitting**: claim an actor, enrol it, rename it
   * by voice through the gate — and then check every surface a person can hear
   * the name from, including a harness that did not exist when the rename
   * happened.
   */
  it("the acceptance walk: claim, enrol, rename by voice, and every surface agrees", async () => {
    const live = await enrolledAndRenamed();
    const actorId = live.row.actorId;
    try {
      const renamed = live.renamed;
      expect(renamed.response.ok).toBe(true);

      // 1. The canvas: the registry's name for that actor id.
      expect((await namesOnCanvas())[actorId]).toBe("Nova");

      // 2. The enrolment, both halves a summon reads.
      const snap = (await (
        await fetch(`${base}/api/projects/prj_1/canvas`, { headers: badge.headers })
      ).json()) as { canvas: { agents?: Record<string, { actor: { id: string; name: string } }> } };
      expect(snap.canvas.agents?.[actorId]?.actor.name).toBe("Nova");
      expect((await readRcAgents(home)).find((r) => r.actorId === actorId)!.name).toBe("Nova");

      // 3. The page's own account of itself.
      const state = (await (await fetch(`${live.server.state.url}state`)).json()) as any;
      expect(state.name).toBe("Nova");
      expect(state.agent.id).toBe(actorId);
      expect(state.agent.name).toBe("Nova");

      // 4. A harness that did not exist when the rename happened — started by
      // the new name, and then by the old one, which must not re-assert it.
      const asNew = await startFreshVoice({ ISOCAN_SESSION_ID: await sessionFor("Nova") });
      expect(asNew.started, `a fresh voice-agent should start:\n${asNew.said.slice(-400)}`).toBe(true);
      expect(asNew.state!.name).toBe("Nova");
      expect(asNew.state!.agent.id).toBe(actorId);

      const asOld = await startFreshVoice({ ISOCAN_SESSION_ID: await sessionFor("Voice") });
      expect(asOld.started, `a fresh voice-agent should start:\n${asOld.said.slice(-400)}`).toBe(true);
      expect(asOld.state!.name, "the old name is not asserted back").toBe("Nova");
      expect(asOld.state!.agent.id).toBe(actorId);

      // 5. And one actor, one name: nothing forked and nothing kept the old
      // name as a second face.
      const names = Object.values(await namesOnCanvas());
      expect(names.filter((n) => n === "Nova" || n === "Voice")).toEqual(["Nova"]);
    } finally {
      await live.close();
    }
  });

  /**
   * **The record is a convenience; the badge's row is the truth.** A machine
   * that holds the binding but not `voice/identity.json` — a second machine
   * enrolled in the same actor, or a home whose `voice/` directory was cleared
   * — must resume the actor it already is rather than claim the name afresh,
   * which would ask the desk to hand out a second actor wearing the same name.
   *
   * The binding it resumes under comes from the environment: the rc injects a
   * KEY (`agent:<mac>`), the daemon's own row says whose it is, and that is
   * true across a rename and across a lost record — the two things the name
   * cannot survive.
   */
  it("resumes on a machine that holds the row but not the harness's own record", async () => {
    const live = await enrolledAndRenamed();
    const actorId = live.row.actorId;
    try {
      await live.close();
      await fs.rm(path.join(home, "voice", "identity.json"), { force: true });

      const noRecord = await startFreshVoice({ ISOCAN_SESSION_ID: await sessionFor("Voice") });
      expect(noRecord.started, `a fresh voice-agent should start:\n${noRecord.said.slice(-400)}`).toBe(true);
      expect(noRecord.state!.name, "the binding is enough to resume: no rename back").toBe("Nova");
      expect(noRecord.state!.agent.id).toBe(actorId);

      // And the record it just wrote is the same identity it resumed.
      const identity = JSON.parse(
        await fs.readFile(path.join(home, "voice", "identity.json"), "utf8"),
      ) as { actorId: string; sessionKey: string; name: string };
      expect(identity).toEqual({ actorId, sessionKey: await machineAgentKey(home, "Voice"), name: "Nova" });
    } finally {
      await live.close();
    }
  });
});

describe("the harness's name across a restart", () => {
  const enrollVoice = async () => {
    const enrolled = await isocan(["rc", "add", "Voice", "--harness", "voice", "--dir", home], {
      ISOCAN_SESSION_ID: await sessionFor("Voice"),
      ISOCAN_HARNESS: "agent",
    });
    expect(enrolled.code, enrolled.stderr).toBe(0);
  };

  it("resumes the actor it renamed, rather than re-asserting the name it was started with", async () => {
    await enrollVoice();
    const live = await liveServer();
    let renamedActor = "";
    try {
      const before = ((await (await fetch(`${live.server.state.url}state`)).json()) as any).agent as { id: string; name: string };
      expect(before.name).toBe("Voice");
      renamedActor = before.id;

      // Rename, by voice, through the gate.
      const call = callTool(live.providerSocket, "restart-rename", "actor_claim", { name: "Nova" });
      const ask = await theQuestion(live.server.state.url);
      await answering(live.server.state.url, ask.id, true);
      expect((await call).response.ok).toBe(true);
    } finally {
      await live.close();
    }

    // 1. A fresh start under the NEW name — what a person types, and what a
    // renamed enrolment injects. This was a hard refusal before: the harness
    // rebuilt the key from the name, and `agent:Nova` is a key it never held.
    const asNew = await startFreshVoice({ ISOCAN_SESSION_ID: await sessionFor("Nova") });
    expect(asNew.started, `a fresh voice-agent should start:\n${asNew.said.slice(-600)}`).toBe(true);
    expect(asNew.state!.name).toBe("Nova");
    expect(asNew.state!.agent.id, "the same actor, not a second one wearing the name").toBe(renamedActor);

    // 2. A fresh start under the OLD name — a stale shell export, or a person
    // who typed the name it used to have. The session is a key and carries no
    // name any more, so the name arrives the way a person gives it: `--as`.
    // It must resume, not rename back, and it must say whose name is stale.
    const asOld = await startFreshVoice({ ISOCAN_SESSION_ID: await sessionFor("Voice") }, ["--as", "Voice"]);
    expect(asOld.started, `a fresh voice-agent should start:\n${asOld.said.slice(-600)}`).toBe(true);
    expect(asOld.state!.name, "the old name is not asserted back over the new one").toBe("Nova");
    expect(asOld.state!.agent.id).toBe(renamedActor);
    expect(asOld.said, "and it says whose name is stale, rather than obeying it").toContain("stale");

    // 3. One actor, one name, on the canvas: no fork.
    const names = Object.values(await namesOnCanvas());
    expect(names.filter((n) => n === "Nova" || n === "Voice")).toEqual(["Nova"]);
  });
});

describe("the ACP face", () => {
  it("speaks the wire the rc speaks, and answers a turn with end_turn", async () => {
    const written: unknown[] = [];
    const agent = createAcpAgent({ name: "Voice", forward: async () => ({ url: "http://127.0.0.1:1/" }), out: (m) => written.push(m) });

    await agent.handle({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
    expect(written[0]).toMatchObject({ id: 1, result: { protocolVersion: 1, agentCapabilities: { loadSession: true } } });

    await agent.handle({ jsonrpc: "2.0", id: 2, method: "session/new", params: {} });
    const session = (written[1] as { result: { sessionId: string } }).result.sessionId;
    expect(session).toBeTruthy();

    await agent.handle({
      jsonrpc: "2.0",
      id: 3,
      method: "session/prompt",
      params: { sessionId: session, prompt: [{ type: "text", text: "look at the checkout screen" }] },
    });
    const update = written.find((m) => (m as { method?: string }).method === "session/update") as {
      params: { update: { sessionUpdate: string; content: { text: string } } };
    };
    expect(update.params.update.sessionUpdate).toBe("agent_message_chunk");
    expect(update.params.update.content.text).toContain("http://127.0.0.1:1/");
    expect(written.at(-1)).toMatchObject({ id: 3, result: { stopReason: "end_turn" } });
  });

  it("refuses a method it does not speak rather than hanging a turn", async () => {
    const written: unknown[] = [];
    const agent = createAcpAgent({ name: "Voice", forward: async () => null, out: (m) => written.push(m) });
    await agent.handle({ jsonrpc: "2.0", id: 9, method: "session/teleport", params: {} });
    expect(written[0]).toMatchObject({ id: 9, error: { code: -32601 } });
  });

  it("says a refusal in its own words — the one naming the command that fixes it", async () => {
    const written: unknown[] = [];
    const refusal = notEnrolledLine("Voice", "prj_9");
    const agent = createAcpAgent({ name: "Voice", forward: async () => ({ refused: refusal }), out: (m) => written.push(m) });
    await agent.handle({
      jsonrpc: "2.0",
      id: 4,
      method: "session/prompt",
      params: { sessionId: "s", prompt: "look at the checkout screen" },
    });
    const update = written.find((m) => (m as { method?: string }).method === "session/update") as {
      params: { update: { content: { text: string } } };
    };
    // Verbatim, not paraphrased: a refusal is only useful if it carries the
    // command, and the command is written in one place.
    expect(update.params.update.content.text).toBe(refusal);
    expect(update.params.update.content.text).toContain("isocan rc add Voice --harness voice --canvas prj_9");
  });

  it("resolves the canvas and the name from the enrolment record, not the environment", () => {
    const rows = [
      { canvasId: "prj_1", name: "Voice", harness: "voice" },
      { canvasId: "prj_2", name: "Voice", harness: "voice" },
      { canvasId: "prj_3", name: "Percy", harness: "pi" },
    ];
    // A hint that names a canvas the record knows wins.
    expect(enrolmentForVoice(rows, { name: "Voice", canvas: "prj_2" })).toMatchObject({ canvasId: "prj_2" });
    // A hint that matches nothing does not invent an answer: the record is
    // the authority on what this agent answers on.
    expect(enrolmentForVoice(rows, { name: "Voice", canvas: "prj_none" })).toMatchObject({ canvasId: "prj_1" });
    // One row is the answer even when the name came in differently.
    expect(enrolmentForVoice([rows[2]!, { canvasId: "prj_4", name: "Voice", harness: "voice" }], { name: "Whatever" })).toMatchObject(
      { canvasId: "prj_4" },
    );
    // Another harness's rows are nobody's business here.
    expect(enrolmentForVoice([rows[2]!], { name: "Voice" })).toBeNull();
    expect(enrolmentForVoice([], { name: "Voice" })).toBeNull();
  });
});

describe("the Live API path", () => {
  it("opens with the setup the API expects, on the model that is current", () => {
    const setup = liveSetup() as { setup: Record<string, unknown> };
    expect(LIVE_MODEL).toBe("models/gemini-3.1-flash-live-preview");
    expect(setup.setup.model).toBe(LIVE_MODEL);
    expect((setup.setup.generationConfig as { responseModalities: string[] }).responseModalities).toEqual(["AUDIO"]);
    const names = ((setup.setup.tools as { functionDeclarations: { name: string }[] }[])[0] ?? { functionDeclarations: [] })
      .functionDeclarations.map((t) => t.name);
    // The fast set, and nothing that cannot be undone.
    expect(names).toContain("rename_item");
    expect(names).toContain("move_item");
    expect(names).toContain("say");
    expect(names).not.toContain("trash_empty");
    expect(liveUrl("AIza-x")).toContain("BidiGenerateContent?key=AIza-x");
  });

  it("speaks the wire: setup first, then audio up and tool calls answered", async () => {
    const sent: string[] = [];
    const calls: { name: string; args: Record<string, unknown> }[] = [];
    let socket!: {
      onmessage: ((event: { data: unknown }) => void) | null;
      emit: (message: unknown) => void;
      readyState: number;
    };
    class FakeSocket {
      readyState = 1;
      onopen: (() => void) | null = null;
      onclose: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onmessage: ((event: { data: unknown }) => void) | null = null;
      constructor(readonly url: string) {
        socket = this as unknown as typeof socket;
        queueMicrotask(() => this.onopen?.());
      }
      send(data: unknown) {
        sent.push(typeof data === "string" ? data : "<binary>");
      }
      close() {}
      emit(message: unknown) {
        this.onmessage?.({ data: JSON.stringify(message) });
      }
    }
    const session = startLiveSession({
      key: { provider: "gemini", key: "AIza-test" },
      WebSocketImpl: FakeSocket as unknown as typeof WebSocket,
      callbacks: {
        onToolCall: async (name, args) => {
          calls.push({ name, args });
          return { ok: true };
        },
      },
    });
    await new Promise((r) => setTimeout(r, 0));
    const setup = JSON.parse(sent[0] ?? "{}").setup;
    expect(setup.model).toBe(LIVE_MODEL);
    expect(setup.generationConfig.responseModalities).toEqual(["AUDIO"]);

    session.send(new Uint8Array([1, 2, 3, 4]));
    const audio = JSON.parse(sent[1] ?? "{}") as { realtimeInput: { audio: { mimeType: string; data: string } } };
    expect(audio.realtimeInput.audio.mimeType).toBe("audio/pcm;rate=16000");
    expect(Buffer.from(audio.realtimeInput.audio.data, "base64")).toEqual(Buffer.from([1, 2, 3, 4]));

    // A tool call is a blocking question: the answer is the operation's RESULT.
    socket.emit({
      toolCall: { functionCalls: [{ id: "call-1", name: "rename_item", args: { item_ref: "checkout", title: "Checkout v2" } }] },
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(calls).toEqual([{ name: "rename_item", args: { item_ref: "checkout", title: "Checkout v2" } }]);
    const answered = JSON.parse(sent.at(-1) ?? "{}") as { toolResponse: { functionResponses: { id: string; response: unknown }[] } };
    expect(answered.toolResponse.functionResponses[0]).toMatchObject({ id: "call-1", response: { ok: true } });
  });

  it("injects project AGENTS.md instructions into the Live session setup", async () => {
    const { resolveProjectInstructions, liveSetup: makeSetup, LIVE_MODEL: defModel } = await import("../src/voice-harness.ts");
    const testDir = await fs.mkdtemp(path.join(os.tmpdir(), "voice-agents-test-"));
    await fs.writeFile(path.join(testDir, "AGENTS.md"), "# Project Instructions\nAlways be honest.\n");
    await fs.mkdir(path.join(testDir, ".isocan"), { recursive: true });
    await fs.writeFile(path.join(testDir, ".isocan", "project.json"), JSON.stringify({ canvasId: "prj_1" }));
    await fs.writeFile(path.join(home, "dirs.json"), JSON.stringify({ [testDir]: "prj_1" }));

    const resolved = await resolveProjectInstructions(home, "prj_1");
    expect(resolved).not.toBeNull();
    expect(resolved!.source).toBe("AGENTS.md");
    expect(resolved!.text).toContain("Always be honest");

    const setup = makeSetup(defModel, resolved) as any;
    expect(setup.setup.systemInstruction.parts[0].text).toContain("=== PROJECT INSTRUCTIONS (AGENTS.md) ===");
    expect(setup.setup.systemInstruction.parts[0].text).toContain("Always be honest.");

    await fs.rm(testDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it("verifies native writeMarker round-trip, rejects mismatched markers, and prefers valid over stale rows", async () => {
    const { resolveProjectInstructions } = await import("../src/voice-harness.ts");
    const { writeMarker } = await import("@isocan/server");

    // 1. Native writeMarker for target canvas prj_1 (which writes projectId: "prj_1" on disk)
    const validDir = await fs.mkdtemp(path.join(os.tmpdir(), "voice-valid-marker-"));
    await fs.writeFile(path.join(validDir, "AGENTS.md"), "# Valid Project Instructions\n");
    await writeMarker(validDir, { canvasId: "prj_1", title: "Valid Target" });

    // 2. Mismatched marker for another canvas prj_other
    const staleDir = await fs.mkdtemp(path.join(os.tmpdir(), "voice-stale-marker-"));
    await fs.writeFile(path.join(staleDir, "AGENTS.md"), "# Stale Wrong Instructions\n");
    await writeMarker(staleDir, { canvasId: "prj_other", title: "Wrong Target" });

    // Test dirs.json carrying BOTH: stale row pointing to prj_1, followed by valid row
    await fs.writeFile(
      path.join(home, "dirs.json"),
      JSON.stringify({ [staleDir]: "prj_1", [validDir]: "prj_1" }),
    );

    // Assert stale directory is rejected because its disk marker has projectId: "prj_other"
    // And valid directory is accepted because its disk marker has projectId: "prj_1"
    const resolved = await resolveProjectInstructions(home, "prj_1");
    expect(resolved).not.toBeNull();
    expect(resolved!.text).toContain("Valid Project Instructions");
    expect(resolved!.text).not.toContain("Stale Wrong Instructions");

    // Test complete mismatch: if only staleDir exists, returns null
    await fs.writeFile(
      path.join(home, "dirs.json"),
      JSON.stringify({ [staleDir]: "prj_1" }),
    );
    const refused = await resolveProjectInstructions(home, "prj_1");
    expect(refused).toBeNull();

    await fs.rm(validDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    await fs.rm(staleDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it("surfaces the provider's own words when the session fails", async () => {
    const states: { state: string; bad?: boolean }[] = [];
    let socket!: { emit: (message: unknown) => void };
    class FakeSocket {
      readyState = 1;
      onopen: (() => void) | null = null;
      onclose: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onmessage: ((event: { data: unknown }) => void) | null = null;
      constructor(readonly url: string) {
        socket = this as unknown as typeof socket;
        queueMicrotask(() => this.onopen?.());
      }
      send() {}
      close() {}
      emit(message: unknown) {
        this.onmessage?.({ data: JSON.stringify(message) });
      }
    }
    const session = startLiveSession({
      key: { provider: "gemini", key: "nonsense" },
      WebSocketImpl: FakeSocket as unknown as typeof WebSocket,
      callbacks: { onState: (state, bad) => states.push({ state, ...(bad !== undefined ? { bad } : {}) }) },
    });
    await new Promise((r) => setTimeout(r, 0));
    socket.emit({ error: { code: 400, message: "API key not valid. Please pass a valid API key." } });
    expect(await session.ready).toBe(false);
    // Verbatim. A paraphrase here is how a real key came to be called invalid.
    expect(states[0]).toEqual({ state: "API key not valid. Please pass a valid API key.", bad: true });
  });

  it("surfaces provider socket close code and reason inline when socket closes abnormally", async () => {
    const states: { state: string; bad?: boolean }[] = [];
    let socket!: { closeWith: (code: number, reason: string) => void };
    class FakeSocket {
      readyState = 1;
      onopen: (() => void) | null = null;
      onclose: ((event: { code: number; reason: string }) => void) | null = null;
      onerror: (() => void) | null = null;
      onmessage: ((event: { data: unknown }) => void) | null = null;
      constructor(readonly url: string) {
        socket = this as unknown as typeof socket;
        queueMicrotask(() => this.onopen?.());
      }
      send() {}
      close() {}
      closeWith(code: number, reason: string) {
        this.onclose?.({ code, reason });
      }
    }
    const session = startLiveSession({
      key: { provider: "gemini", key: "nonsense" },
      WebSocketImpl: FakeSocket as unknown as typeof WebSocket,
      callbacks: { onState: (state, bad) => states.push({ state, ...(bad !== undefined ? { bad } : {}) }) },
    });
    await new Promise((r) => setTimeout(r, 0));
    socket.closeWith(1007, "The requested combination of response modalities (TEXT) is not supported by the model");
    expect(await session.ready).toBe(false);
    expect(states[0]?.state).toContain("provider closed socket: code 1007 — The requested combination of response modalities (TEXT)");
    expect(states[0]?.bad).toBe(true);
  });

  it("drives live tools end-to-end: read_canvas answers live state, add_item and rename_item land operations in oplog and /log", async () => {
    await writeVoiceKey(home, { provider: "gemini", key: "AIza-live-test" });

    let providerSocket!: {
      emit: (message: unknown) => void;
      sent: string[];
    };
    class FakeLiveSocket {
      readyState = 1;
      sent: string[] = [];
      onopen: (() => void) | null = null;
      onclose: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onmessage: ((event: { data: unknown }) => void) | null = null;
      constructor(readonly url: string) {
        providerSocket = this;
        queueMicrotask(() => this.onopen?.());
      }
      send(data: string) {
        this.sent.push(data);
      }
      close() {}
      emit(message: unknown) {
        this.onmessage?.({ data: JSON.stringify(message) });
      }
    }

    const server = await startVoiceServer({
      home,
      port: 0,
      identity: await identityFor(),
      canvas: "prj_1",
      daemonPort: Number(new URL(base).port),
      // A gate nobody answers must not hold a test for a minute: a short
      // window, exactly as a person would get if they walked away.
      confirmTimeoutMs: 2000,
      WebSocketImpl: FakeLiveSocket as unknown as typeof WebSocket,
    });

    try {
      const { WebSocket: WsClient } = await import("ws");
      const clientWs = new WsClient(`${server.state.url.replace("http://", "ws://")}live`);
      await new Promise<void>((resolve) => {
        clientWs.on("open", () => resolve());
      });

      while (!providerSocket) await new Promise(r => setTimeout(r, 10));
      providerSocket.emit({ setupComplete: {} });
      await new Promise((r) => setTimeout(r, 50));

      // The turn boundary, recorded as the provider reported it. Audio that
      // never reached the model produces no turnComplete at all, so this line
      // in /log is the difference between a silent session and a slow one.
      providerSocket.emit({ serverContent: { turnComplete: true } });
      await new Promise((r) => setTimeout(r, 30));

      // 1. read_canvas
      providerSocket.emit({
        toolCall: {
          functionCalls: [{ id: "call-read", name: "read_canvas", args: {} }],
        },
      });
      while (providerSocket.sent.length < 2) await new Promise(r => setTimeout(r, 10));

      const readReply = JSON.parse(providerSocket.sent.at(-1) ?? "{}");
      const readResp = readReply.toolResponse?.functionResponses?.[0];
      expect(readResp.id).toBe("call-read");
      expect(readResp.response.ok).toBe(true);
      expect(readResp.response.canvas).toContain("Checkout screen");
      // The read names the ids, so a follow-up can echo them. 
      expect(readResp.response.canvas).toContain("[itm_1]");

      // 2. add_item
      providerSocket.emit({
        toolCall: {
          functionCalls: [
            {
              id: "call-add",
              name: "add_item",
              args: { title: "Spoken Note", text: "Created by voice tool call" },
            },
          ],
        },
      });
      while (providerSocket.sent.length < 3) await new Promise(r => setTimeout(r, 10));

      const canvasItems = await items();
      expect(canvasItems.map((i) => i.title)).toContain("Spoken Note");

      // 2b. `add_item` with a title and NO text — how "add a note called X"
      // arrives from the model. The note's body falls back to its title rather
      // than an empty blob, which the daemon refuses as `empty blob body`.
      providerSocket.emit({
        toolCall: { functionCalls: [{ id: "call-title-only", name: "add_item", args: { title: "Titled Only" } }] },
      });
      while (providerSocket.sent.length < 4) await new Promise(r => setTimeout(r, 10));
      const titledItems = await items();
      expect(titledItems.map((i) => i.title)).toContain("Titled Only");
      const titledLog = ((await (await fetch(`${server.state.url}log`)).json()) as any).entries.find(
        (e: any) => e.args?.title === "Titled Only",
      );
      expect(titledLog.result.ok, `a title alone still makes a note: ${titledLog.result.error ?? ""}`).toBe(true);

      // 3. rename_item
      providerSocket.emit({
        toolCall: {
          functionCalls: [
            {
              id: "call-rename",
              name: "rename_item",
              args: { item_ref: "Spoken Note", title: "Spoken Note Renamed" },
            },
          ],
        },
      });
      while (providerSocket.sent.length < 5) await new Promise(r => setTimeout(r, 10));

      const renamedItems = await items();
      expect(renamedItems.map((i) => i.title)).toContain("Spoken Note Renamed");

      // 4. add_item with a url — the "add a web page" case Paul asked for.
      // It is an ordinary item.add whose blob is a text/uri-list, so the
      // canvas renders it as a live site rather than a text card.
      providerSocket.emit({
        toolCall: {
          functionCalls: [{ id: "call-site", name: "add_item", args: { url: "localhost:3000" } }],
        },
      });
      while (providerSocket.sent.length < 6) await new Promise(r => setTimeout(r, 10));

      const siteItems = await items();
      expect(siteItems.map((i) => i.title)).toContain("localhost:3000");

      // 5. Paul's example: comment, then delete the thread the comment made —
      // using only the id the model's own recent-action record carries.
      providerSocket.emit({
        toolCall: {
          functionCalls: [
            { id: "call-comment", name: "comment_on_item", args: { item_ref: "Checkout screen", text: "needs a button" } },
          ],
        },
      });
      while (providerSocket.sent.length < 7) await new Promise(r => setTimeout(r, 10));
      const commentReply = JSON.parse(providerSocket.sent.at(-1) ?? "{}");
      const commentResp = commentReply.toolResponse?.functionResponses?.[0];
      expect(commentResp.response.ok).toBe(true);
      const created = (commentResp.response.recent as Array<{ op: string; id?: string }>).find(
        (r) => r.op === "thread.create",
      );
      expect(created?.id, "the created thread's id is in the recent actions").toBeTruthy();

      providerSocket.emit({
        toolCall: {
          functionCalls: [{ id: "call-del", name: "thread_delete", args: { thread_id: created!.id } }],
        },
      });
      while (providerSocket.sent.length < 8) await new Promise(r => setTimeout(r, 10));
      const delResp = JSON.parse(providerSocket.sent.at(-1) ?? "{}").toolResponse?.functionResponses?.[0];
      expect(delResp.response.ok).toBe(true);

      // 6. Assert /log
      const logRes = (await (await fetch(`${server.state.url}log`)).json()) as any;
      expect(logRes.entries.length).toBeGreaterThanOrEqual(3);

      const readLog = logRes.entries.find((e: any) => e.name === "read_canvas");
      expect(readLog).toBeDefined();
      expect(readLog.result.ok).toBe(true);

      const addLog = logRes.entries.find((e: any) => e.name === "add_item");
      expect(addLog).toBeDefined();
      expect(addLog.result.ok).toBe(true);
      expect(addLog.op.type).toBe("item.add");

      const siteLog = logRes.entries.find((e: any) => e.args?.url === "localhost:3000");
      expect(siteLog, "the site call is in the log").toBeDefined();
      expect(siteLog.op.said).toBe('add "localhost:3000" as a web page');
      expect(siteLog.result.ok).toBe(true);

      const renameLog = logRes.entries.find((e: any) => e.name === "rename_item");
      expect(renameLog).toBeDefined();
      expect(renameLog.result.ok).toBe(true);
      expect(renameLog.op.type).toBe("item.update");

      const turnLog = logRes.entries.find((e: any) => e.event === "turn_complete");
      expect(turnLog, "the provider's turn boundary is in the log").toBeDefined();

      clientWs.close();
    } finally {
      await server.close();
    }
  });

  it("exercises Paul's five tools: draw, react, comment, delete, and find — each landing on canvas and appearing in /log", async () => {
    await writeVoiceKey(home, { provider: "gemini", key: "AIza-live-test" });

    let providerSocket!: {
      emit: (message: unknown) => void;
      sent: string[];
    };
    class FakeLiveSocket {
      readyState = 1;
      sent: string[] = [];
      onopen: (() => void) | null = null;
      onclose: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onmessage: ((event: { data: unknown }) => void) | null = null;
      constructor(readonly url: string) {
        providerSocket = this;
        queueMicrotask(() => this.onopen?.());
      }
      send(data: string) {
        this.sent.push(data);
      }
      close() {}
      emit(message: unknown) {
        this.onmessage?.({ data: JSON.stringify(message) });
      }
    }

    const server = await startVoiceServer({
      home,
      port: 0,
      identity: await identityFor(),
      canvas: "prj_1",
      daemonPort: Number(new URL(base).port),
      // A gate nobody answers must not hold a test for a minute: a short
      // window, exactly as a person would get if they walked away.
      confirmTimeoutMs: 2000,
      WebSocketImpl: FakeLiveSocket as unknown as typeof WebSocket,
    });

    try {
      const { WebSocket: WsClient } = await import("ws");
      const clientWs = new WsClient(`${server.state.url.replace("http://", "ws://")}live`);
      await new Promise<void>((resolve) => {
        clientWs.on("open", () => resolve());
      });

      while (!providerSocket) await new Promise((r) => setTimeout(r, 10));
      providerSocket.emit({ setupComplete: {} });
      await new Promise((r) => setTimeout(r, 50));

      // 1. DRAW (drawing_add)
      providerSocket.emit({
        toolCall: {
          functionCalls: [
            {
              id: "call-draw",
              name: "drawing_add",
              args: { title: "Handwritten Arrow", color: "#ff0000", points: [{ x: 50, y: 50 }, { x: 150, y: 150 }] },
            },
          ],
        },
      });
      while (providerSocket.sent.length < 2) await new Promise((r) => setTimeout(r, 10));

      const afterDraw = await items();
      const sketchItem = afterDraw.find((i) => i.title === "Handwritten Arrow");
      expect(sketchItem).toBeDefined();
      expect(sketchItem!.properties?.kind).toBe("drawing");

      // 2. REACT (item_react)
      providerSocket.emit({
        toolCall: {
          functionCalls: [
            {
              id: "call-react",
              name: "item_react",
              args: { item_ref: "Checkout screen", emoji: "👍", on: true },
            },
          ],
        },
      });
      while (providerSocket.sent.length < 3) await new Promise((r) => setTimeout(r, 10));

      const afterReact = await items();
      const reactedItem = afterReact.find((i) => i.title === "Checkout screen");
      expect(reactedItem?.reactions?.["👍"]).toBeDefined();

      // 3. COMMENT (comment_on_item)
      providerSocket.emit({
        toolCall: {
          functionCalls: [
            {
              id: "call-comment",
              name: "comment_on_item",
              args: { item_ref: "Checkout screen", text: "Approved by Voice" },
            },
          ],
        },
      });
      while (providerSocket.sent.length < 4) await new Promise((r) => setTimeout(r, 10));

      // 4. DELETE (delete_item) — through the gate, because that is the whole
      // point of it: the operation lands when the PERSON says yes, and the
      // model's tool call is only the question.
      providerSocket.emit({
        toolCall: {
          functionCalls: [
            {
              id: "call-delete",
              name: "delete_item",
              args: { item_ref: "Handwritten Arrow" },
            },
          ],
        },
      });
      const asked = await theQuestion(server.state.url);
      expect(asked.what).toContain("Handwritten Arrow");
      // Asked, not done: the sketch is still on the canvas while the question
      // stands, which is the difference between a gate and a log line.
      expect((await items()).some((i) => i.title === "Handwritten Arrow"), "nothing is deleted while the question stands").toBe(true);
      expect(await answering(server.state.url, asked.id, true)).toEqual({ ok: true, allowed: true });
      while (providerSocket.sent.length < 5) await new Promise((r) => setTimeout(r, 10));

      const afterDelete = await items();
      expect(afterDelete.find((i) => i.title === "Handwritten Arrow")).toBeUndefined();

      // 5. FIND (find_items)
      providerSocket.emit({
        toolCall: {
          functionCalls: [
            {
              id: "call-find",
              name: "find_items",
              args: { query: "Checkout" },
            },
          ],
        },
      });
      while (providerSocket.sent.length < 6) await new Promise((r) => setTimeout(r, 10));

      const findReply = JSON.parse(providerSocket.sent.at(-1) ?? "{}");
      expect(findReply.toolResponse?.functionResponses?.[0].response.count).toBe(1);

      // 6. MULTI-SELECT MOVE (items_move)
      providerSocket.emit({
        toolCall: {
          functionCalls: [
            {
              id: "call-move",
              name: "items_move",
              args: { item_refs: ["Checkout screen"], by_x: 20, by_y: 30 },
            },
          ],
        },
      });
      while (providerSocket.sent.length < 7) await new Promise((r) => setTimeout(r, 10));

      // 7. CONVERGENCE / VERSION SWITCH (item_set_current_version)
      providerSocket.emit({
        toolCall: {
          functionCalls: [
            {
              id: "call-ver",
              name: "item_set_current_version",
              args: { item_ref: "Checkout screen", version_ref: "ver_1" },
            },
          ],
        },
      });
      while (providerSocket.sent.length < 8) await new Promise((r) => setTimeout(r, 10));

      // 8. SELECTION GESTURES (selection_set)
      providerSocket.emit({
        toolCall: {
          functionCalls: [
            {
              id: "call-sel",
              name: "selection_set",
              args: { item_refs: ["Checkout screen"] },
            },
          ],
        },
      });
      while (providerSocket.sent.length < 9) await new Promise((r) => setTimeout(r, 10));

      // 9. DESTRUCTIVE CONFIRMATION GUARD (trash_empty)
      providerSocket.emit({
        toolCall: {
          functionCalls: [
            {
              id: "call-trash",
              name: "trash_empty",
              args: {},
            },
          ],
        },
      });
      while (providerSocket.sent.length < 10) await new Promise((r) => setTimeout(r, 10));
      const trashReply = JSON.parse(providerSocket.sent.at(-1) ?? "{}");
      expect(trashReply.toolResponse?.functionResponses?.[0].response.ok).toBe(false);
      expect(trashReply.toolResponse?.functionResponses?.[0].response.error).toContain("confirmation");

      // 10. REFUSED READ_THREADS LOGGING (nonexistent item_ref)
      providerSocket.emit({
        toolCall: {
          functionCalls: [
            {
              id: "call-threads-fail",
              name: "read_threads",
              args: { item_ref: "nonexistent_item_ref" },
            },
          ],
        },
      });
      while (providerSocket.sent.length < 11) await new Promise((r) => setTimeout(r, 10));
      const threadFailReply = JSON.parse(providerSocket.sent.at(-1) ?? "{}");
      expect(threadFailReply.toolResponse?.functionResponses?.[0].response.ok).toBe(false);

      // Verify /log entries
      const logRes = (await (await fetch(`${server.state.url}log`)).json()) as any;
      expect(logRes.entries.find((e: any) => e.name === "drawing_add")).toBeDefined();
      expect(logRes.entries.find((e: any) => e.name === "item_react")).toBeDefined();
      expect(logRes.entries.find((e: any) => e.name === "comment_on_item")).toBeDefined();
      expect(logRes.entries.find((e: any) => e.name === "delete_item")).toBeDefined();
      expect(logRes.entries.find((e: any) => e.name === "find_items")).toBeDefined();
      expect(logRes.entries.find((e: any) => e.name === "items_move")).toBeDefined();
      expect(logRes.entries.find((e: any) => e.name === "item_set_current_version")).toBeDefined();
      expect(logRes.entries.find((e: any) => e.name === "selection_set")).toBeDefined();
      expect(logRes.entries.find((e: any) => e.name === "trash_empty")).toBeDefined();
      const threadFailLog = logRes.entries.find((e: any) => e.name === "read_threads" && e.result?.ok === false);
      expect(threadFailLog).toBeDefined();
      expect(threadFailLog.result.error).toContain("nonexistent_item_ref");

      clientWs.close();
    } finally {
      await server.close();
    }
  });
});

describe("the harness as the rc's adapter", () => {
  /**
   * **The declaration the rc resolves, written by the thing it names.**
   *
   * `isocan rc` finds a harness in `~/.isocan/config.json`'s `acpAdapters`
   * (`adapterFor`), so a harness that is not declared there cannot be
   * summoned — and a person having to write that line by hand is how an
   * enrolment could stand an agent up with nothing able to start it. The
   * package writes it when it starts, by absolute path and the interpreter
   * that is running: the file a person's own command starts.
   */
  it("declares itself in config.json, and leaves a person's own declaration alone", async () => {
    const config = () => fs.readFile(path.join(home, "config.json"), "utf8").then((t) => JSON.parse(t) as any);

    const server = await startVoiceServer({ home, port: 0, identity: await identityFor(), canvas: "prj_1", daemonPort: Number(new URL(base).port) });
    await server.close();

    const written = await config();
    const entry = fileURLToPath(new URL("../bin/voice-agent.js", import.meta.url));
    expect(written.acpAdapters.voice).toEqual([process.execPath, entry, "--acp"]);
    // And the entry point it names really is this package's.
    await fs.access(written.acpAdapters.voice[1]);

    // A second start is not a rewrite: the file's other keys and the
    // declaration survive as they were.
    await fs.writeFile(path.join(home, "config.json"), `${JSON.stringify({ ...written, home: "https://isocan.io" }, null, 2)}\n`);
    const again = await startVoiceServer({ home, port: 0, identity: await identityFor(), canvas: "prj_1", daemonPort: Number(new URL(base).port) });
    await again.close();
    expect((await config()).home, "an unrelated key is not touched").toBe("https://isocan.io");
    expect((await config()).acpAdapters.voice).toEqual(written.acpAdapters.voice);

    // A declaration a person wrote WINS: pointing `voice` at your own bridge
    // is a deliberate act, and `adapterFor` reads config before anything else.
    await fs.writeFile(
      path.join(home, "config.json"),
      `${JSON.stringify({ acpAdapters: { voice: ["node", "/somewhere/mine.mjs", "--acp"] } }, null, 2)}\n`,
    );
    const kept = await startVoiceServer({ home, port: 0, identity: await identityFor(), canvas: "prj_1", daemonPort: Number(new URL(base).port) });
    await kept.close();
    expect((await config()).acpAdapters.voice).toEqual(["node", "/somewhere/mine.mjs", "--acp"]);
  });

  it("is summoned for real: `rc turn` reaches the standing page", async () => {
    // No config declaration: `voice` is a builtin of the harness registry, and
    // this is the test that proves the registry — not a person's config.json —
    // is what `isocan rc` resolves the adapter from.
    // The CLI's own badge has to hold the person before it may enrol anyone:
    // the badge this test mints is not the badge the spawned CLI carries.
    const named = await isocan(["identity", "--name", "Person", "--as", "usr_person", "--session"], {
      ISOCAN_SESSION_ID: "person",
      ISOCAN_HARNESS: "isocan",
    });
    expect(named.code, named.stderr).toBe(0);
    const enrolled = await isocan(["rc", "add", "Voice", "--harness", "voice"]);
    expect(enrolled.code, enrolled.stderr).toBe(0);

    // The page is already standing — which is the case that matters: a
    // microphone is not a turn, so the adapter hands the summons to the
    // process that outlives it rather than holding a ceiling open.
    // Port 0, not the default: the adapter finds the standing page through
    // `~/.isocan/voice/server.json`, so a fixed port would make this test
    // collide with the instance somebody is actually testing.
    const server = await startVoiceServer({
      home,
      port: 0,
      identity: await identityFor(),
      canvas: "prj_1",
      daemonPort: Number(new URL(base).port),
    });
    try {
      const turned = await isocan(["rc", "turn", "Voice", "look", "at", "the", "checkout", "screen"]);
      expect(turned.code, turned.stderr).toBe(0);
      expect(turned.stderr).toContain("turn ended — end_turn");
      // WHICH PATH RAN is logged, not only said in the reply: the summons
      // found a page already standing and attached to it. "Attached" and
      // "started one" are different moments for the microphone, and the
      // conversation alone cannot tell them apart.
      expect(turned.stderr).toContain("attached to the voice harness already standing on port");
      const state = (await (await fetch(`${server.state.url}state`)).json()) as { lines: string[] };
      expect(state.lines.join("\n")).toContain("summoned by Voice");
      expect(state.lines.join("\n")).toContain("look at the checkout screen");
    } finally {
      await server.close();
    }
  });


  it("defaults its port to the one the docs name", () => {
    expect(DEFAULT_VOICE_PORT).toBe(7654);
  });
});

describe("the harness session & tool-call log API", () => {
  let close: (() => Promise<void>) | null = null;

  afterEach(async () => {
    await close?.();
    close = null;
  });

  async function serve() {
    const server = await startVoiceServer({
      home,
      port: 0,
      identity: await identityFor(),
      canvas: "prj_1",
      daemonPort: Number(new URL(base).port),
    });
    close = server.close;
    return server;
  }

  it("exposes live transitions only after an audio provider setup, and ends explicitly", async () => {
    const live = await liveServer();
    close = live.close;
    const server = live.server;
    const state0 = await (await fetch(`${server.state.url}state`)).json();
    expect(state0).toMatchObject({ session: { state: "live" } });

    const startRes = await (await fetch(`${server.state.url}session/start`, { method: "POST" })).json();
    expect(startRes).toEqual({ ok: true, state: "live" });

    const state1 = (await (await fetch(`${server.state.url}state`)).json()) as any;
    expect(state1.session.state).toBe("live");

    const muteRes = await (await fetch(`${server.state.url}session/mute`, { method: "POST" })).json();
    expect(muteRes).toEqual({ ok: true, state: "muted" });

    const unmuteRes = await (await fetch(`${server.state.url}session/unmute`, { method: "POST" })).json();
    expect(unmuteRes).toEqual({ ok: true, state: "live" });

    const endRes = await (await fetch(`${server.state.url}session/end`, { method: "POST" })).json();
    expect(endRes).toEqual({ ok: true, state: "ended" });
  });

  it("logs tool calls, utterances, and session events in machine-readable GET /log", async () => {
    const server = await serve();

    // Trigger an utterance
    await fetch(`${server.state.url}utterance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "retitle the first thing to Logged Title", source: "test" }),
    });

    // Check /log
    const logRes = (await (await fetch(`${server.state.url}log`)).json()) as any;
    expect(logRes).toHaveProperty("entries");
    expect(logRes.entries.length).toBeGreaterThan(0);

    const uttLog = logRes.entries.find((e: any) => e.type === "utterance");
    expect(uttLog).toBeDefined();
    expect(uttLog.source).toBe("typed");
    expect(uttLog.args.text).toBe("retitle the first thing to Logged Title");
    expect(uttLog.op.type).toBe("item.update");
    expect(uttLog.result.ok).toBe(true);
  });

  it("handles typed 'add a note' utterances through the same operation vocabulary and logs with source: typed", async () => {
    const server = await serve();

    const res = (await (await fetch(`${server.state.url}utterance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "add a note that says hello from the voice log", source: "typed" }),
    })).json()) as any;

    expect(res.sent.length).toBe(1);
    expect(res.sent[0]).toContain("hello from the voice log");

    const canvasItems = await items();
    expect(canvasItems.some((i) => i.title?.includes("hello from the voice log"))).toBe(true);

    const logRes = (await (await fetch(`${server.state.url}log`)).json()) as any;
    const addLog = logRes.entries.find((e: any) => e.args?.text?.includes("hello from the voice log"));
    expect(addLog).toBeDefined();
    expect(addLog.source).toBe("typed");
    expect(addLog.op.type).toBe("item.add");
  });

  it("persists toolLog to ~/.isocan/voice/log.json so it survives harness restarts", async () => {
    const server1 = await serve();

    await fetch(`${server1.state.url}utterance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "say persist this message", source: "typed" }),
    });

    // Close server1
    await server1.close();
    close = null;

    // Start server2 on same home
    const server2 = await serve();

    const logRes = (await (await fetch(`${server2.state.url}log`)).json()) as any;
    const persistedEntry = logRes.entries.find((e: any) => e.args?.text === "say persist this message");
    expect(persistedEntry).toBeDefined();
    // Merged by id, so the restart cannot show the same call twice.
    expect(logRes.entries.filter((e: any) => e.args?.text === "say persist this message")).toHaveLength(1);
  });

  it("answers with what the apply did, not with the label that asked for it", async () => {
    const server = await serve();
    await fetch(`${server.state.url}utterance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "retitle the first thing to Logged Title", source: "test" }),
    });
    const logRes = (await (await fetch(`${server.state.url}log`)).json()) as any;
    const utt = logRes.entries.find((e: any) => e.type === "utterance");
    expect(utt.op.said).toBe('update "Checkout screen": new title "Logged Title"');
    expect(String(utt.result.answer)).toContain('updated "Checkout screen"');
    expect(utt.result.answer).not.toBe(utt.op.said);
  });

  it("records a session request without misreporting a session open", async () => {
    const server = await serve();
    await fetch(`${server.state.url}session/start`, { method: "POST" });
    const logRes = (await (await fetch(`${server.state.url}log`)).json()) as any;
    expect(logRes.entries.some((e: any) => e.event === "harness restarted")).toBe(true);
    expect(logRes.entries.some((e: any) => e.event === "session requested; waiting for audio connection")).toBe(true);
    expect(logRes.entries.some((e: any) => e.event === "session opened")).toBe(false);
  });

  it("keeps the persisted file as the record when the in-memory window is capped at 200", async () => {
    const old = Array.from({ length: 205 }, (_, i) => ({
      id: `log_old_${i}`,
      timestamp: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(),
      type: "session_event" as const,
      event: `old ${i}`,
    }));
    await writeVoiceLog(home, old);
    const server = await serve();
    await fetch(`${server.state.url}utterance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "say after the cap", source: "typed" }),
    });
    // The write is fire-and-forget; give it a beat to land rather than race it.
    let disk = await readVoiceLog(home);
    for (let i = 0; i < 50 && disk.length <= 205; i++) {
      await new Promise((r) => setTimeout(r, 10));
      disk = await readVoiceLog(home);
    }
    expect(disk.length).toBeGreaterThan(205);
    expect(disk.some((e) => e.id === "log_old_0")).toBe(true);
    const logRes = (await (await fetch(`${server.state.url}log`)).json()) as any;
    expect(logRes.entries.some((e: any) => e.id === "log_old_0")).toBe(true);
    expect(logRes.entries.filter((e: any) => e.args?.text === "say after the cap")).toHaveLength(1);
  });

  it("mints a one-use pass and redirects to the canvas URL on GET /open", async () => {
    const server = await serve();

    // 1. JSON mode
    const jsonRes = (await (await fetch(`${server.state.url}open`, {
      headers: { Accept: "application/json" },
    })).json()) as any;
    expect(jsonRes).toHaveProperty("url");
    expect(jsonRes.canvasId).toBe("prj_1");
    expect(jsonRes.url).toContain("/p/prj_1#pss_");

    // 2. Redirect mode (manual redirect inspection)
    const redirectRes = await fetch(`${server.state.url}open`, { redirect: "manual" });
    expect(redirectRes.status).toBe(302);
    expect(redirectRes.headers.get("location")).toContain("/p/prj_1#pss_");
  });

  it("keeps presence enrolled-but-idle when a start request has no audio session", async () => {
    const server = await serve();
    await new Promise((r) => setTimeout(r, 100));

    // Initially present as enrolled-but-idle
    const sessions0 = await (await fetch(`${base}/api/projects/prj_1/sessions`, { headers: badge.headers })).json() as any[];
    const voiceSession0 = sessions0.find((s) => s.harness === "voice");
    expect(voiceSession0).toBeDefined();
    expect(voiceSession0!.status).toBe("enrolled — nobody is listening right now");

    // A start request alone cannot claim listening.
    await fetch(`${server.state.url}session/start`, { method: "POST" });
    await new Promise((r) => setTimeout(r, 50));

    const sessions1 = await (await fetch(`${base}/api/projects/prj_1/sessions`, { headers: badge.headers })).json() as any[];
    const voiceSession1 = sessions1.find((s) => s.harness === "voice");
    expect(voiceSession1!.status).toBe("enrolled — nobody is listening right now");

    // End session -> drops back
    await fetch(`${server.state.url}session/end`, { method: "POST" });
    await new Promise((r) => setTimeout(r, 50));

    const sessions2 = await (await fetch(`${base}/api/projects/prj_1/sessions`, { headers: badge.headers })).json() as any[];
    const voiceSession2 = sessions2.find((s) => s.harness === "voice");
    expect(voiceSession2!.status).toBe("enrolled — nobody is listening right now");
  });
});
