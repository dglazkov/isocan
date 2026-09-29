import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_COMMAND_CATALOGUE } from "../packages/core/src/command-catalogue.ts";
// @ts-expect-error — the plugin is plain .mjs with no types, on purpose (see jetski-plugin.test.ts).
import * as jetski from "../plugins/jetski/lib/jetski.mjs";
// @ts-expect-error — as above.
import { createRelay, DISPLACED_BACKOFF_MS, MAX_PARKS, releaseLock, takeLock } from "../plugins/jetski/lib/relay.mjs";
// @ts-expect-error — as above.
import { sessionStart } from "../plugins/jetski/scripts/session-start.mjs";
// @ts-expect-error — as above.
import { createPane } from "../plugins/jetski/sidecars/canvas/main.mjs";

/**
 * **The tie between Jetski and the canvas** (`docs/projects/jetski/design.md`
 * §9–§12): the conversations record, the sentences the pane hands a
 * conversation, the routes that send them, and the relay that carries the
 * canvas's mentions back. Every door — the CLI, `agentapi`, the wait — is
 * injected, so nothing here spawns a process or reaches a host.
 */

const repo = fileURLToPath(new URL("..", import.meta.url));
const plugin = path.join(repo, "plugins", "jetski");

let tmp = "";
beforeAll(() => {
  tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "acme-jetski-tie-")));
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

/** A stand-in for `runAgentapi`. */
function fakeAgentapi(answers: Record<string, unknown> = {}) {
  const calls: Call[] = [];
  const agentapi = async (args: string[], opts: { projectId?: string | null } = {}) => {
    calls.push({ args, projectId: opts.projectId ?? null });
    const answer = answers[args[0] ?? ""];
    if (answer instanceof Error) throw answer;
    return typeof answer === "function" ? answer(args) : (answer ?? {});
  };
  return { agentapi, calls };
}

const CANVAS = { canvasId: "prj_acme", title: "Acme" };
const ITEMS = [
  { id: "itm_signin", title: "Acme sign-in" },
  { id: "itm_verify", title: "Acme verify code" },
];

describe("the conversations record", () => {
  it("keeps which conversation became which actor, merges rows, and sweeps the stale ones", () => {
    const home = dir("home");
    const t0 = 1_000_000;
    jetski.recordConversation(home, "conv-a", { canvasId: "prj_acme", root: "/acme", actorId: "usr_a", name: "Acme Bot" }, t0);
    jetski.recordConversation(home, "conv-b", { canvasId: "prj_acme", root: "/acme", tier: "pro" }, t0 + 10);
    // The hook's write lands on the fan-out's and keeps its tier.
    jetski.recordConversation(home, "conv-b", { canvasId: "prj_acme", root: "/acme", actorId: "usr_b", name: "Test Otter" }, t0 + 20);
    jetski.recordConversation(home, "conv-c", { canvasId: "prj_other", root: "/other" }, t0 + 30);

    expect(jetski.conversationsOn(home, "prj_acme", t0 + 40).map((c: { conversationId: string }) => c.conversationId)).toEqual(["conv-b", "conv-a"]);
    expect(jetski.readConversations(home)["conv-b"]).toMatchObject({ actorId: "usr_b", tier: "pro", name: "Test Otter" });

    // A day later, a write sweeps everything past the TTL.
    const later = t0 + jetski.CONVERSATION_TTL_MS + 25;
    jetski.recordConversation(home, "conv-d", { canvasId: "prj_acme", root: "/acme" }, later);
    expect(Object.keys(jetski.readConversations(home)).sort()).toEqual(["conv-c", "conv-d"]);
    jetski.recordConversation(home, "conv-d", null, later);
    expect(Object.keys(jetski.readConversations(home))).toEqual(["conv-c"]);
  });

  it("reads nothing from a missing or malformed file, and skips rows without a canvas or a folder", () => {
    const home = dir("home-bad");
    expect(jetski.readConversations(home)).toEqual({});
    fs.writeFileSync(path.join(home, jetski.CONVERSATIONS_FILE), "{not json");
    expect(jetski.readConversations(home)).toEqual({});
    fs.writeFileSync(path.join(home, jetski.CONVERSATIONS_FILE), JSON.stringify({ conversations: { a: { canvasId: "prj_acme" }, b: { root: "/x" }, c: { canvasId: "prj_acme", root: "/acme" } } }));
    expect(Object.keys(jetski.readConversations(home))).toEqual(["c"]);
  });
});

describe("what the pane hands a conversation", () => {
  it("asks about the selection, or about the canvas when nothing is selected", () => {
    const about = jetski.askMessage({ question: "which is closer to the brief?", items: ITEMS, canvas: CANVAS });
    expect(about).toContain("which is closer to the brief?");
    expect(about).toContain('`itm_signin` "Acme sign-in", `itm_verify` "Acme verify code"');
    expect(about).toContain('"Acme" (prj_acme)');
    const bare = jetski.askMessage({ question: "", items: [], canvas: CANVAS });
    expect(bare).toContain("What is on the canvas right now?");
    expect(bare).toContain("nothing selected");
  });

  it("runs a canvas skill the way a comment would ask for it, and says where its instructions are", () => {
    const said = jetski.skillMessage({ skill: "/variation", args: "n=2 one dark", items: ITEMS, canvas: CANVAS });
    // `/name args` first: on the canvas, a message that starts with it IS the request.
    expect(said.split("\n")[0]).toBe("/variation n=2 one dark");
    expect(said).toContain("isocan command show variation");
    expect(said).toContain("outranks its defaults");
    expect(said).toContain("itm_verify");
    expect(() => jetski.skillMessage({ skill: " ", items: [], canvas: CANVAS })).toThrow("which skill?");
  });

  it("hands a skill or a question to a standing agent as a comment that starts with the command", () => {
    expect(jetski.handoffComment({ skill: "design-audit", args: "spacing only", agent: "Orla" })).toBe("/design-audit @Orla spacing only");
    expect(jetski.handoffComment({ question: "is this legible?", agent: "Orla" })).toBe("@Orla is this legible?");
    expect(() => jetski.handoffComment({ skill: "tidy" })).toThrow("hand it to whom?");
  });

  it("hands over an agent's open question with the thread and the reply command", () => {
    const said = jetski.threadMessage({ thread: { threadId: "thr_1", askerName: "Test Otter", body: "Above or below?\nEither is fine." }, canvas: CANVAS });
    expect(said).toContain("Test Otter is waiting on an answer");
    expect(said).toContain("> Above or below?\n> Either is fine.");
    expect(said).toContain('isocan comment reply thr_1 "…"');
    expect(() => jetski.threadMessage({ thread: {}, canvas: CANVAS })).toThrow("which thread?");
  });

  it("tells each fan-out conversation it is one of several, and which tier to own up to", () => {
    const said = jetski.fanoutMessage({ skill: "variation", args: "n=1", items: ITEMS, canvas: CANVAS, tier: "pro", of: 2 });
    expect(said).toContain("one of 2 Jetski conversations");
    expect(said).toContain("you are on **pro**");
    expect(said).toContain("the pro take");
    expect(said).toContain("/variation n=1");
    expect(jetski.newConversationArgs({ message: "m", tier: "flash_lite", title: "t · flash_lite" })).toEqual([
      "new-conversation", "--model=flash_lite", "--title=t · flash_lite", "m",
    ]);
    expect(() => jetski.newConversationArgs({ message: "m", tier: "ultra" })).toThrow("not a tier");
  });

  it("relays a wake verbatim, and says to answer it on the canvas", () => {
    const woke = "Test Person · on \"Acme sign-in\": @Acme Bot tighten the header\n  reply: isocan comment reply thr_2 \"…\"";
    const said = jetski.relayMessage({ woke, canvas: CANVAS, name: "Acme Bot" });
    expect(said).toContain(woke);
    expect(said).toContain("(Acme Bot)");
    expect(said).toContain("ON THE CANVAS");
    expect(said).toContain("You do not need to run `isocan wait`");
  });

  it("says who is asking and that it wants an answer, so a busy conversation does not fold it away", () => {
    for (const said of [
      jetski.askMessage({ question: "How many screens are there?", items: [], canvas: CANVAS }),
      jetski.threadMessage({ thread: { threadId: "thr_1", body: "?" }, canvas: CANVAS }),
    ]) expect(said.startsWith(jetski.ASKED)).toBe(true);
    // A skill keeps `/name` first — that is the canvas's grammar — and says it next.
    const skill = jetski.skillMessage({ skill: "tidy", items: [], canvas: CANVAS }).split("\n");
    expect(skill[0]).toBe("/tidy");
    expect(skill[2]).toBe(jetski.ASKED);
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
    await expect(jetski.runAgentapi(["send-message", "nope", "hi"], { env })).rejects.toThrow("trajectory not found: nope");
    await expect(jetski.runAgentapi(["get-conversation-metadata", "c1"], { env })).resolves.toEqual({ response: { ok: true } });
  });

  it("reads a conversation's project the way the host's own preload does", () => {
    expect(jetski.projectIdOf({ response: { conversationMetadata: { metadata: { projectId: "p1" } } } })).toBe("p1");
    expect(jetski.projectIdOf({ response: { conversation_metadata: { metadata: { project_id: "p2" } } } })).toBe("p2");
    expect(jetski.projectIdOf(null)).toBe("");
  });

  it("runs agentapi through the executable the host names, as the SDK does", () => {
    expect(jetski.agentapiCommand({ ANTIGRAVITY_AGENTAPI_EXE: "/jetski/ls" })).toEqual({ command: "/jetski/ls", prefix: ["agentapi"] });
    expect(jetski.agentapiCommand({})).toEqual({ command: "agentapi", prefix: [] });
  });
});

describe("the hook writes the record it arrives with", () => {
  it("records the conversation's actor on its canvas, and tells it about skills and the relay", async () => {
    const home = dir("hook-home");
    const acme = mark(dir("acme-app"), { projectId: "prj_acme", title: "Acme" });
    const { run } = fakeRun({ "identity --session": "identity saved: Acme Bot (usr_acme1) → /acme/.isocan/actors.json (antigravity session)\n" });
    const out = await sessionStart({ conversationId: "conv-acme", workspacePaths: [acme] }, { env: { PATH: process.env["PATH"], ISOCAN_HOME: home }, run, now: () => 5 });
    expect(jetski.readConversations(home)["conv-acme"]).toEqual({
      canvasId: "prj_acme", title: "Acme", root: acme, actorId: "usr_acme1", name: "Acme Bot", tier: null, at: 5,
    });
    const said: string = out.injectSteps[0].ephemeralMessage;
    expect(said).toContain("isocan command show <name>");
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

describe("the pane's routes for the tie", () => {
  let home = "";
  let acme = "";
  const bindings = () => ({ workspaceUris: [pathToFileURL(acme).href] });
  beforeAll(() => {
    home = dir("pane-home");
    acme = mark(dir("acme-app"), { projectId: "prj_acme", title: "Acme" });
  });
  const env = () => ({ PATH: process.env["PATH"], ISOCAN_HOME: home, ISOCAN_CLI: "/acme/fake.mjs" });

  it("offers the canvas's skills without the ones the web app answers itself, and believes the list for a minute", async () => {
    const list = [
      { name: "help", description: "keys", usage: "", source: "built-in", local: true },
      { name: "variation", description: "Make N variations", usage: "[n=3]", source: "built-in" },
      { name: "acme-brand", description: "Hold it to the brand", usage: "", source: "acme/skills" },
    ];
    const { run, calls } = fakeRun({ "command ls": list });
    let clock = 0;
    const { routes } = createPane({ env: env(), run, now: () => clock });
    const first = await routes["/api/skills"](bindings());
    expect(first.skills.map((s: { name: string }) => s.name)).toEqual(["variation", "acme-brand"]);
    expect(calls[0]).toMatchObject({ args: ["--json", "command", "ls"], cwd: acme });
    clock = 30_000;
    await routes["/api/skills"](bindings());
    expect(calls).toHaveLength(1);
    clock = 61_000;
    await routes["/api/skills"](bindings());
    expect(calls).toHaveLength(2);
  });

  it("lists what agents are waiting on a person for, by name where this machine knows it", async () => {
    fs.writeFileSync(path.join(home, "actors.json"), JSON.stringify({ names: { usr_otter: { name: "Test Otter" } } }));
    const { run, calls } = fakeRun({
      "comment ls": [
        { threadId: "thr_1", commentId: "c1", askerId: "usr_otter", body: "Above or below?" },
        { threadId: "thr_2", commentId: "c2", askerId: "usr_stranger", body: "Which font?" },
      ],
    });
    const { routes } = createPane({ env: env(), run });
    expect((await routes["/api/asks"](bindings())).asks).toEqual([
      { threadId: "thr_1", askerId: "usr_otter", askerName: "Test Otter", body: "Above or below?" },
      { threadId: "thr_2", askerId: "usr_stranger", askerName: "usr_stranger", body: "Which font?" },
    ]);
    expect(calls[0]!.args).toEqual(["--json", "comment", "ls", "--open"]);
  });

  it("sends a question, a skill or a thread to the conversation, in its own project", async () => {
    const { agentapi, calls } = fakeAgentapi({
      "get-conversation-metadata": { response: { conversationMetadata: { metadata: { projectId: "proj_acme" } } } },
    });
    const { routes } = createPane({ env: env(), run: fakeRun().run, agentapi });
    const skill = await routes["/api/send"]({ ...bindings(), conversationId: "conv-acme", kind: "skill", skill: "variation", args: "n=2", items: ITEMS });
    expect(skill.message.startsWith("/variation n=2")).toBe(true);
    expect(calls.map((c) => [c.args[0], c.projectId])).toEqual([
      ["get-conversation-metadata", null],
      ["send-message", "proj_acme"],
    ]);
    expect(calls[1]!.args.slice(0, 2)).toEqual(["send-message", "conv-acme"]);

    // A project the page already knows is not asked for again.
    await routes["/api/send"]({ ...bindings(), conversationId: "conv-acme", projectId: "proj_page", question: "hi" });
    expect(calls.at(-1)).toMatchObject({ args: ["send-message", "conv-acme", expect.stringContaining("hi")], projectId: "proj_page" });

    await routes["/api/send"]({ ...bindings(), conversationId: "conv-acme", projectId: "p", kind: "thread", thread: { threadId: "thr_1", body: "?" } });
    expect(calls.at(-1)!.args[2]).toContain("isocan comment reply thr_1");
    await expect(routes["/api/send"]({ ...bindings(), question: "hi" })).rejects.toThrow("not attached to a conversation");
  });

  it("hands a skill to a standing agent as the person's comment on the first selected item", async () => {
    const { run, calls } = fakeRun({ "comment add": { threadId: "thr_new", commentId: "c1" } });
    const { routes } = createPane({ env: env(), run });
    const out = await routes["/api/handoff"]({ ...bindings(), agent: "Orla", skill: "design-audit", args: "spacing", items: ITEMS });
    expect(out).toEqual({ threadId: "thr_new", body: "/design-audit @Orla spacing\n\n(also: `itm_verify`)" });
    expect(calls[0]).toMatchObject({ args: ["--json", "comment", "add", "--item", "itm_signin", out.body], cwd: acme });
    // As the person: no conversation's session rides along.
    expect(calls[0]!.env!["ANTIGRAVITY_CONVERSATION_ID"]).toBeUndefined();
    await expect(routes["/api/handoff"]({ ...bindings(), agent: "Orla", skill: "tidy", items: [] })).rejects.toThrow("select an item");
  });

  it("fans out one conversation per tier, records each against the canvas, and refuses what it cannot run", async () => {
    const fanHome = dir("fan-home");
    const { agentapi, calls } = fakeAgentapi({ "new-conversation": (args: string[]) => ({ conversationId: `conv-${args[1]!.split("=")[1]}` }) });
    const { routes } = createPane({ env: { ...env(), ISOCAN_HOME: fanHome }, run: fakeRun().run, agentapi });
    const out = await routes["/api/fanout"]({ ...bindings(), projectId: "proj_acme", tiers: ["flash", "pro", "flash"], question: "which is closer?", items: ITEMS });
    expect(out.started).toEqual([{ tier: "flash", conversationId: "conv-flash" }, { tier: "pro", conversationId: "conv-pro" }]);
    expect(calls.map((c) => c.args.slice(0, 3))).toEqual([
      ["new-conversation", "--model=flash", "--title=which is closer? · flash"],
      ["new-conversation", "--model=pro", "--title=which is closer? · pro"],
    ]);
    expect(calls.every((c) => c.projectId === "proj_acme")).toBe(true);
    expect(calls[1]!.args[3]).toContain("one of 2 Jetski conversations");
    expect(jetski.readConversations(fanHome)["conv-pro"]).toMatchObject({ canvasId: "prj_acme", tier: "pro", root: acme });

    await expect(routes["/api/fanout"]({ ...bindings(), tiers: [] })).rejects.toThrow("pick at least one tier");
    await expect(routes["/api/fanout"]({ ...bindings(), tiers: ["ultra"] })).rejects.toThrow("pick at least one tier");
  });

  it("says which faces are Jetski conversations, and which tier a fan-out one runs", async () => {
    const faceHome = dir("face-home");
    fs.mkdirSync(path.join(faceHome, "sessions"));
    fs.writeFileSync(path.join(faceHome, "actors.json"), JSON.stringify({ names: {}, harnesses: { usr_a: "antigravity", usr_b: "antigravity" } }));
    for (const id of ["usr_a", "usr_b"]) fs.writeFileSync(path.join(faceHome, "sessions", `${id}.json`), JSON.stringify({ canvasId: "prj_acme", sessionId: `ses_${id}`, label: `${id} 🤖` }));
    jetski.recordConversation(faceHome, "conv-b", { canvasId: "prj_acme", root: acme, actorId: "usr_b", tier: "pro" });
    const { routes } = createPane({ env: { ...env(), ISOCAN_HOME: faceHome }, run: fakeRun({ harness: { harnesses: [], default: null } }).run });
    const state = await routes["/api/workspace"](bindings());
    const faces = Object.fromEntries(state.sessions.map((s: { actorId: string }) => [s.actorId, s]));
    expect(faces["usr_a"].conversationId).toBeUndefined();
    expect(faces["usr_b"]).toMatchObject({ conversationId: "conv-b", tier: "pro" });
    expect(state.tiers).toEqual(["flash_lite", "flash", "pro"]);

    // After an in-frame reload where the host does not re-push `workspace-change`,
    // `/api/workspace` still knows the folder from `conversationId`.
    const reloaded = await routes["/api/workspace"]({ workspaceUris: [], conversationId: "conv-b" });
    expect(reloaded).toMatchObject({ bound: true, canvasId: "prj_acme", workspace: acme });
  });
});

describe("the relay: the canvas reaches a Jetski conversation", () => {
  function relayHome(rows: Record<string, Record<string, unknown>>) {
    const home = dir("relay-home");
    fs.writeFileSync(path.join(home, jetski.CONVERSATIONS_FILE), JSON.stringify({ conversations: rows }));
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
    expect(Object.keys(jetski.readConversations(home))).toEqual(["conv-a"]);
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
    expect(jetski.readConversations(home)[`conv-${MAX_PARKS + 1}`]).toBeUndefined();
  });

  it("holds one relay per machine, and takes over a lock whose process is gone", () => {
    const home = dir("lock-home");
    expect(takeLock(home, process.pid)).toBe(true);
    // Another live process (this test's parent) cannot take it…
    expect(takeLock(home, process.ppid)).toBe(false);
    releaseLock(home, process.pid);
    // …and a lock left by a process that is gone is taken over.
    fs.writeFileSync(path.join(home, "jetski-relay.lock"), "999999999");
    expect(takeLock(home, process.pid)).toBe(true);
    releaseLock(home, process.pid);
    expect(fs.existsSync(path.join(home, "jetski-relay.lock"))).toBe(false);
  });
});

describe("the page and its server agree", () => {
  const page = fs.readFileSync(path.join(plugin, "sidecars", "canvas", "public", "index.html"), "utf8");

  it("calls only routes the pane serves", () => {
    const { routes } = createPane({ env: { PATH: "" }, run: fakeRun().run });
    const called = [...page.matchAll(/api\("(\/api\/[a-z-]+)"/g)].map((m) => m[1]);
    expect(called.length).toBeGreaterThan(5);
    for (const route of called) expect(Object.keys(routes)).toContain(route);
  });

  it("offers only the tiers agentapi takes", () => {
    for (const [, tiers] of page.matchAll(/value="?fan:([a-z_,]+)/g)) {
      for (const tier of tiers!.split(",")) expect(jetski.TIERS).toContain(tier);
    }
    for (const m of page.matchAll(/add\("fan:([a-z_,]+)"/g)) {
      for (const tier of m[1]!.split(",")) expect(jetski.TIERS).toContain(tier);
    }
  });

  it("suggests only skills the canvas ships with", () => {
    const shipped = new Set(DEFAULT_COMMAND_CATALOGUE.map((c) => c.name));
    const preferred = /PREFERRED_SKILLS = \[([^\]]+)\]/.exec(page)![1]!.match(/"([a-z-]+)"/g)!.map((s) => s.slice(1, -1));
    for (const name of preferred) expect(shipped).toContain(name);
  });

  it("translates send, handoff and fanout failures into actionable guidance with retry and dismiss controls", () => {
    expect(jetski.friendlyAskError("This pane is not attached to a conversation", "here")).toContain("send a message in the chat column on the left to attach it");
    expect(jetski.friendlyAskError(new Error("select an item on the canvas first"), "agent:Orla")).toContain("Select an item on the canvas first");
    expect(jetski.friendlyAskError(new Error("agentapi send-message: trajectory not found: nope"), "here")).toContain("Jetski couldn't find this chat's session");
    expect(jetski.friendlyAskError(new Error("agentapi send-message: timed out"), "here")).toContain("Timed out waiting for Jetski");
    expect(jetski.friendlyAskError(new Error("/api/send answered 401"), "here")).toContain("session token expired");
    expect(jetski.friendlyAskError(new Error("Failed to fetch"), "here")).toContain("Couldn't reach the pane server");
    expect(jetski.friendlyAskError(new Error("daemon offline"), "agent:Orla")).toContain("Couldn't post handoff comment on the canvas (daemon offline)");
    expect(jetski.friendlyAskError(new Error("quota exceeded"), "fan:flash,pro")).toContain("Couldn't start fan-out conversations (quota exceeded)");
    expect(jetski.friendlyAskError(new Error("unexpected"), "here")).toContain("Couldn't send to this chat (unexpected)");

    expect(page).toContain('id="ask-notice"');
    expect(page).toContain('id="ask-retry"');
    expect(page).toContain('id="ask-dismiss"');
    expect(page).toContain("friendlyAskError(err, target)");
    expect(page).toContain("Watch the chat column on the left for the reply.");
  });

  it("turns the header title (#where) into a link with a URL popover when framed, drops the Reload button, and shows instant CSS [data-tip] popovers on Open, Agents, Asks, and the Agents: label", () => {
    expect(page).not.toContain('id="reload"');
    expect(page).toMatch(/<a class="where" id="where" target="_blank" rel="noopener"><span class="where-text" id="where-text">/);
    expect(page).toContain("header .where[data-tip]::after");
    expect(page).toContain('setWhere(`${leaf(state.workspace)} · ${state.title || state.canvasId}`, tab)');
    expect(page).toMatch(/id="open"[^>]*data-tip="[^"]*external browser/);
    expect(page).toMatch(/id="agents-toggle"[^>]*data-tip="Hide the Agents bar/);
    expect(page).toMatch(/id="inbox-toggle"[^>]*data-tip="Questions agents left on the canvas/);
    expect(page).toMatch(/id="agents-note"[^>]*data-tip="They answer @mentions on the canvas while isocan rc runs on this machine\."/);
    expect(page).toContain('$("agents-toggle").setAttribute("data-tip", tip)');
    expect(page).toContain("header [data-tip]::after");
  });
});

