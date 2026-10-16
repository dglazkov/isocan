import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
// @ts-expect-error — the plugin is plain .mjs with no types, on purpose (see antigravity-plugin.test.ts).
import * as antigravity from "../plugins/antigravity/lib/antigravity.mjs";
// @ts-expect-error — as above.
import { createRelay, DISPLACED_BACKOFF_MS, MAX_PARKS, releaseLock, takeLock } from "../plugins/antigravity/lib/relay.mjs";
// @ts-expect-error — as above.
import { sessionStart } from "../plugins/antigravity/scripts/session-start.mjs";
// @ts-expect-error — as above.
import { createPane } from "../plugins/antigravity/sidecars/canvas/main.mjs";

/**
 * **The tie between Antigravity and the canvas** (`docs/projects/antigravity/design.md`
 * §9–§10): the conversations record, the relay that carries the canvas's
 * mentions back to conversations, and the pane's workspace state. Every door —
 * the CLI, `agentapi`, the wait — is injected, so nothing here spawns a process
 * or reaches a host.
 */

const repo = fileURLToPath(new URL("..", import.meta.url));
const plugin = path.join(repo, "plugins", "antigravity");

let tmp = "";
beforeAll(() => {
  tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "acme-antigravity-tie-")));
});
afterAll(() => {
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});
let made = 0;
function dir(name: string): string {
  const d = path.join(tmp, `${++made}-${name}`);
  fs.mkdirSync(d, { recursive: true });
  return d;
}
function mark(root: string, marker: Record<string, unknown>): string {
  fs.mkdirSync(path.join(root, ".isocan"), { recursive: true });
  fs.writeFileSync(path.join(root, ".isocan", "project.json"), JSON.stringify(marker));
  return root;
}

interface Call {
  args: string[];
  cwd?: string;
  env?: Record<string, string | undefined>;
  projectId?: string | null;
}

/** A stand-in for `runIsocan`, answering by the first two words. */
function fakeRun(answers: Record<string, unknown> = {}) {
  const calls: Call[] = [];
  const run = async (args: string[], opts: Omit<Call, "args">) => {
    calls.push({ args, ...opts });
    const words = args.filter((a) => a !== "--json");
    const answer = answers[words.slice(0, 2).join(" ")] ?? answers[words[0] ?? ""] ?? "";
    if (answer instanceof Error) throw answer;
    return { stdout: typeof answer === "string" ? answer : JSON.stringify(answer), stderr: "" };
  };
  return { run, calls };
}

const CANVAS = { canvasId: "prj_acme", title: "Acme" };

describe("the conversations record", () => {
  it("keeps which conversation became which actor, merges rows, and sweeps the stale ones", () => {
    const home = dir("home");
    const t0 = 1_000_000;
    antigravity.recordConversation(home, "conv-a", { canvasId: "prj_acme", root: "/acme", actorId: "usr_a", name: "Acme Bot" }, t0);
    antigravity.recordConversation(home, "conv-b", { canvasId: "prj_acme", root: "/acme" }, t0 + 10);
    antigravity.recordConversation(home, "conv-b", { canvasId: "prj_acme", root: "/acme", actorId: "usr_b", name: "Test Otter" }, t0 + 20);
    antigravity.recordConversation(home, "conv-c", { canvasId: "prj_other", root: "/other" }, t0 + 30);

    expect(antigravity.conversationsOn(home, "prj_acme", t0 + 40).map((c: { conversationId: string }) => c.conversationId)).toEqual(["conv-b", "conv-a"]);
    expect(antigravity.readConversations(home)["conv-b"]).toMatchObject({ actorId: "usr_b", name: "Test Otter" });

    // A day later, a write sweeps everything past the TTL.
    const later = t0 + antigravity.CONVERSATION_TTL_MS + 25;
    antigravity.recordConversation(home, "conv-d", { canvasId: "prj_acme", root: "/acme" }, later);
    expect(Object.keys(antigravity.readConversations(home)).sort()).toEqual(["conv-c", "conv-d"]);
    antigravity.recordConversation(home, "conv-d", null, later);
    expect(Object.keys(antigravity.readConversations(home))).toEqual(["conv-c"]);
  });

  it("reads nothing from a missing or malformed file, and skips rows without a canvas or a folder", () => {
    const home = dir("home-bad");
    expect(antigravity.readConversations(home)).toEqual({});
    fs.writeFileSync(path.join(home, antigravity.CONVERSATIONS_FILE), "{not json");
    expect(antigravity.readConversations(home)).toEqual({});
    fs.writeFileSync(path.join(home, antigravity.CONVERSATIONS_FILE), JSON.stringify({ conversations: { a: { canvasId: "prj_acme" }, b: { root: "/x" }, c: { canvasId: "prj_acme", root: "/acme" } } }));
    expect(Object.keys(antigravity.readConversations(home))).toEqual(["c"]);
  });
});

describe("agentapi and relay messages", () => {
  it("relays a wake verbatim, and says to answer it on the canvas", () => {
    const woke = "Test Person · on \"Acme sign-in\": @Acme Bot tighten the header\n  reply: isocan comment reply thr_2 \"…\"";
    const said = antigravity.relayMessage({ woke, canvas: CANVAS, name: "Acme Bot" });
    expect(said).toContain(woke);
    expect(said).toContain("(Acme Bot)");
    expect(said).toContain("ON THE CANVAS");
    expect(said).toContain("You do not need to run `isocan wait`");
  });

  it("treats an agentapi answer that says error as a failure, though it exits 0", async () => {
    const fake = path.join(dir("fake-agentapi"), "agentapi.mjs");
    fs.writeFileSync(fake, [
      "#!/usr/bin/env node",
      "const [, , , verb] = process.argv;",
      'if (verb === "send-message") process.stdout.write(JSON.stringify({ response: {}, error: "trajectory not found: nope" }));',
      'else process.stdout.write(JSON.stringify({ response: { ok: true } }));',
    ].join("\n"));
    fs.chmodSync(fake, 0o755);
    const env = { ...process.env, ANTIGRAVITY_AGENTAPI_EXE: fake };
    await expect(antigravity.runAgentapi(["send-message", "nope", "hi"], { env })).rejects.toThrow("trajectory not found: nope");
    await expect(antigravity.runAgentapi(["get-conversation-metadata", "c1"], { env })).resolves.toEqual({ response: { ok: true } });
  });

  it("reads a conversation's project the way the host's own preload does", () => {
    expect(antigravity.projectIdOf({ response: { conversationMetadata: { metadata: { projectId: "p1" } } } })).toBe("p1");
    expect(antigravity.projectIdOf({ response: { conversation_metadata: { metadata: { project_id: "p2" } } } })).toBe("p2");
    expect(antigravity.projectIdOf(null)).toBe("");
  });

  it("runs agentapi through the executable the host names, as the SDK does", () => {
    expect(antigravity.agentapiCommand({ ANTIGRAVITY_AGENTAPI_EXE: "/antigravity/ls" })).toEqual({ command: "/antigravity/ls", prefix: ["agentapi"] });
    expect(antigravity.agentapiCommand({})).toEqual({ command: "agentapi", prefix: [] });
  });
});

describe("the hook writes the record it arrives with", () => {
  it("records the conversation's actor on its canvas, and tells it about the relay", async () => {
    const home = dir("hook-home");
    const acme = mark(dir("acme-app"), { projectId: "prj_acme", title: "Acme" });
    const { run } = fakeRun({ "identity --session": "identity saved: Acme Bot (usr_acme1) → /acme/.isocan/actors.json (antigravity session)\n" });
    const out = await sessionStart({ conversationId: "conv-acme", workspacePaths: [acme] }, { env: { PATH: process.env["PATH"], ISOCAN_HOME: home }, run, now: () => 5 });
    expect(antigravity.readConversations(home)["conv-acme"]).toEqual({
      canvasId: "prj_acme", title: "Acme", root: acme, actorId: "usr_acme1", name: "Acme Bot", at: 5,
    });
    const said: string = out.injectSteps[0].ephemeralMessage;
    expect(said).toContain("has something for you");
  });

  it("still arrives when the record cannot be written", async () => {
    const blocked = path.join(dir("hook-blocked"), "home-is-a-file");
    fs.writeFileSync(blocked, "not a directory");
    const acme = mark(dir("acme-app"), { projectId: "prj_acme" });
    const { run, calls } = fakeRun({ "identity --session": "identity saved: Acme Bot (usr_acme1) → /x (antigravity session)\n" });
    const out = await sessionStart({ conversationId: "conv-acme", workspacePaths: [acme] }, { env: { PATH: process.env["PATH"], ISOCAN_HOME: blocked }, run });
    expect(calls.map((c) => c.args[0])).toEqual(["identity", "session"]);
    expect(out.injectSteps[0].ephemeralMessage).toContain("You are on the canvas now");
  });
});

describe("the pane's workspace route for the tie", () => {
  let home = "";
  let acme = "";
  const bindings = () => ({ workspaceUris: [pathToFileURL(acme).href] });
  beforeAll(() => {
    home = dir("pane-home");
    acme = mark(dir("acme-app"), { projectId: "prj_acme", title: "Acme" });
  });
  const env = () => ({ PATH: process.env["PATH"], ISOCAN_HOME: home, ISOCAN_CLI: "/acme/fake.mjs" });

  it("says which faces are Antigravity conversations, and remembers the workspace across reloads", async () => {
    const faceHome = dir("face-home");
    fs.mkdirSync(path.join(faceHome, "sessions"));
    fs.writeFileSync(path.join(faceHome, "actors.json"), JSON.stringify({ names: {}, harnesses: { usr_a: "antigravity", usr_b: "antigravity" } }));
    for (const id of ["usr_a", "usr_b"]) fs.writeFileSync(path.join(faceHome, "sessions", `${id}.json`), JSON.stringify({ canvasId: "prj_acme", sessionId: `ses_${id}`, label: `${id} 🤖` }));
    antigravity.recordConversation(faceHome, "conv-b", { canvasId: "prj_acme", root: acme, actorId: "usr_b" });
    const { routes } = createPane({ env: { ...env(), ISOCAN_HOME: faceHome }, run: fakeRun().run });
    const state = await routes["/api/workspace"](bindings());
    const faces = Object.fromEntries(state.sessions.map((s: { actorId: string }) => [s.actorId, s]));
    expect(faces["usr_a"].conversationId).toBeUndefined();
    expect(faces["usr_b"]).toMatchObject({ conversationId: "conv-b" });

    // After an in-frame reload where the host does not re-push `workspace-change`,
    // `/api/workspace` still knows the folder from `conversationId`.
    const reloaded = await routes["/api/workspace"]({ workspaceUris: [], conversationId: "conv-b" });
    expect(reloaded).toMatchObject({ bound: true, canvasId: "prj_acme", workspace: acme });
  });
});

describe("the relay: the canvas reaches an Antigravity conversation", () => {
  function relayHome(rows: Record<string, Record<string, unknown>>) {
    const home = dir("relay-home");
    fs.writeFileSync(path.join(home, antigravity.CONVERSATIONS_FILE), JSON.stringify({ conversations: rows }));
    return home;
  }
  const row = (extra: Record<string, unknown> = {}) => ({ canvasId: "prj_acme", title: "Acme", root: "/acme", actorId: "usr_a", name: "Acme Bot", at: 100, ...extra });

  it("parks as each named conversation and hands it what the wake printed", async () => {
    const home = relayHome({ "conv-a": row(), "conv-unnamed": row({ actorId: null, name: null }) });
    const parked: string[] = [];
    const sent: Array<[string, string]> = [];
    const relay = createRelay({
      home,
      now: () => 200,
      wait: async (c: { conversationId: string }) => {
        parked.push(c.conversationId);
        return { code: 0, stdout: 'Test Person: @Acme Bot tighten the header\n  reply: isocan comment reply thr_2 "…"\n', stderr: "" };
      },
      send: async (id: string, message: string) => void sent.push([id, message]),
    });
    await Promise.all(relay.tick());
    // Never for a conversation the hook has not named.
    expect(parked).toEqual(["conv-a"]);
    expect(sent).toHaveLength(1);
    expect(sent[0]![0]).toBe("conv-a");
    expect(sent[0]![1]).toContain("tighten the header");
    expect(sent[0]![1]).toContain('"Acme" (prj_acme)');
  });

  it("stands back while the conversation parks itself, and lets go of one the canvas withdrew", async () => {
    const home = relayHome({ "conv-a": row(), "conv-b": row({ actorId: "usr_b" }) });
    let clock = 200;
    const codes: Record<string, number> = { "conv-a": 3, "conv-b": 4 };
    const relay = createRelay({
      home,
      now: () => clock,
      wait: async (c: { conversationId: string }) => ({ code: codes[c.conversationId], stdout: "", stderr: "" }),
      send: async () => {
        throw new Error("nothing should be sent");
      },
    });
    await Promise.all(relay.tick());
    expect(relay.resting.get("conv-a")).toBe(200 + DISPLACED_BACKOFF_MS);
    expect(Object.keys(antigravity.readConversations(home))).toEqual(["conv-a"]);
    // Still resting: no new park.
    expect(relay.tick()).toHaveLength(0);
    clock += DISPLACED_BACKOFF_MS + 1;
    codes["conv-a"] = 2;
    expect(relay.tick()).toHaveLength(1);
  });

  it("drops a conversation the host no longer knows, and parks for at most the newest few", async () => {
    const rows: Record<string, Record<string, unknown>> = {};
    for (let i = 0; i < MAX_PARKS + 2; i++) rows[`conv-${i}`] = row({ actorId: `usr_${i}`, at: 100 + i });
    const home = relayHome(rows);
    const parked: string[] = [];
    const relay = createRelay({
      home,
      now: () => 200,
      wait: async (c: { conversationId: string }) => {
        parked.push(c.conversationId);
        return { code: 0, stdout: "a wake\n", stderr: "" };
      },
      send: async (id: string) => {
        if (id === `conv-${MAX_PARKS + 1}`) throw new Error("conversation not found");
      },
    });
    await Promise.all(relay.tick());
    expect(parked).toHaveLength(MAX_PARKS);
    expect(parked[0]).toBe(`conv-${MAX_PARKS + 1}`);
    expect(parked).not.toContain("conv-0");
    expect(antigravity.readConversations(home)[`conv-${MAX_PARKS + 1}`]).toBeUndefined();
  });

  it("holds one relay per machine, and takes over a lock whose process is gone", () => {
    const home = dir("lock-home");
    expect(takeLock(home, process.pid)).toBe(true);
    // Another live process (this test's parent) cannot take it…
    expect(takeLock(home, process.ppid)).toBe(false);
    releaseLock(home, process.pid);
    // …and a lock left by a process that is gone is taken over.
    fs.writeFileSync(path.join(home, "antigravity-relay.lock"), "999999999");
    expect(takeLock(home, process.pid)).toBe(true);
    releaseLock(home, process.pid);
    expect(fs.existsSync(path.join(home, "antigravity-relay.lock"))).toBe(false);
  });
});

describe("the page and its server agree", () => {
  const page = fs.readFileSync(path.join(plugin, "sidecars", "canvas", "public", "index.html"), "utf8");

  it("calls only routes the pane serves", () => {
    const { routes } = createPane({ env: { PATH: "" }, run: fakeRun().run });
    const called = [...page.matchAll(/api\("(\/api\/[a-z-]+)"/g)].map((m) => m[1]);
    expect(called.length).toBeGreaterThanOrEqual(3);
    for (const route of called) expect(Object.keys(routes)).toContain(route);
  });

  it("turns the header title (#where) into the open link with an 'Open in browser' popover when framed, drops the Agents and composer bars, and never puts a native title on [data-tip] elements", () => {
    expect(page).not.toContain('id="reload"');
    expect(page).not.toContain('id="open"');
    expect(page).not.toContain('id="agents"');
    expect(page).not.toContain('id="agents-toggle"');
    expect(page).not.toContain('id="inbox"');
    expect(page).not.toContain('id="inbox-toggle"');
    expect(page).not.toContain('id="selection"');
    expect(page).not.toContain('id="ask"');
    expect(page).toMatch(/<a class="where" id="where" target="_blank" rel="noopener"><span class="where-text" id="where-text">/);
    expect(page).toContain("header .where[data-tip]::after");
    expect(page).toContain('setWhere(`${leaf(state.workspace)} · ${state.title || state.canvasId}`, tab)');
    expect(page).toContain('const tip = url ? "Open in browser ↗" : fallbackTip;');
    expect(page).toContain('$("where").removeAttribute("title")');
    expect(page).toContain("header [data-tip]::after");
  });
});
