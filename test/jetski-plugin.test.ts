import { execFile } from "node:child_process";
import fs from "node:fs";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { harnessVars, harnessVarsFor } from "../packages/api/src/harness.ts";
import { findBinding as daemonFindBinding } from "../packages/server/src/binding.ts";
// @ts-expect-error — the plugin is plain .mjs with no types, on purpose (see below).
import { agentEnv, findBinding, personEnv, resolveCli, workspacePaths } from "../plugins/jetski/lib/workspace.mjs";
// @ts-expect-error — as above.
import { claimedName, sessionStart } from "../plugins/jetski/scripts/session-start.mjs";
// @ts-expect-error — as above.
import { canvasRef, createPane, createServer, hostRoutes, isLoopback, loadPresets, tabAddress } from "../plugins/jetski/sidecars/canvas/main.mjs";
import { defaultTarget, installJetskiPlugin, uninstallJetskiPlugin } from "../packages/cli/src/jetski-plugin.ts";

/**
 * **The Jetski plugin** (`docs/projects/jetski/`, phases 2 and 3).
 *
 * The plugin is plain ESM under `plugins/jetski/` — it runs under whatever
 * Node the host provides, from a directory that is usually a symlink into
 * this repo, so it cannot import the TypeScript it mirrors. This file is
 * where the mirror is held to the original: the marker walk against the
 * daemon's own `findBinding`, the session variables against the CLI's own
 * list. Everything else is held to what it runs — every route and the hook
 * take an injected command runner, and one walk each goes through a real
 * process with a fake `isocan` on `ISOCAN_CLI`.
 */

const repo = fileURLToPath(new URL("..", import.meta.url));
const plugin = path.join(repo, "plugins", "jetski");
const PILL = "[Isocan Canvas](sidecar://isocan/canvas/)";

let tmp = "";
beforeAll(() => {
  tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "acme-jetski-")));
});
afterAll(() => {
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

let made = 0;
/** A fresh, empty directory under this run's temp root. */
function dir(name: string): string {
  const d = path.join(tmp, `${++made}-${name}`);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

/** Write a `.isocan/project.json` into `root`, exactly as given. */
function mark(root: string, marker: Record<string, unknown>): string {
  fs.mkdirSync(path.join(root, ".isocan"), { recursive: true });
  fs.writeFileSync(path.join(root, ".isocan", "project.json"), JSON.stringify(marker));
  return root;
}

/** The body, with the user's home directory somewhere else — both walks stop there. */
async function withHome<T>(home: string, body: () => Promise<T> | T): Promise<T> {
  const saved = { HOME: process.env["HOME"], USERPROFILE: process.env["USERPROFILE"] };
  process.env["HOME"] = home;
  process.env["USERPROFILE"] = home;
  try {
    return await body();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

interface Call {
  args: string[];
  cwd: string;
  env: Record<string, string | undefined>;
  timeoutMs?: number;
}

/** A stand-in for `runIsocan`: records each call and answers by verb
 * (`"identity --session"`, or just `"embed"`), throwing when the answer is
 * an Error. */
function fakeRun(answers: Record<string, string | Error> = {}) {
  const calls: Call[] = [];
  const run = async (args: string[], opts: Omit<Call, "args">) => {
    calls.push({ args, ...opts });
    const words = args.filter((a) => a !== "--json");
    const answer = answers[words.slice(0, 2).join(" ")] ?? answers[words[0] ?? ""] ?? "";
    if (answer instanceof Error) throw answer;
    return { stdout: answer, stderr: "" };
  };
  return { run, calls };
}

const SAVED = "identity saved: Acme Bot (usr_acme1) → /acme/.isocan/actors.json (antigravity session)\n";

const SCAN = {
  harnesses: [
    { name: "claude-code", runnable: true, pinsModel: true },
    { name: "acme-agent", runnable: true, pinsModel: false },
    { name: "codex", runnable: false, pinsModel: true },
  ],
  default: "acme-agent",
  source: "config",
};

describe("the plugin reads a folder's canvas exactly as the daemon does", () => {
  /** Both walks, from one directory, with the user's home at `userHome`. */
  async function both(cwd: string, isocanHome: string, userHome = tmp) {
    return withHome(userHome, async () => ({ plugin: findBinding(cwd, isocanHome), daemon: await daemonFindBinding(cwd, isocanHome) }));
  }

  it("finds the nearest marker in either spelling, and trims the home", async () => {
    const home = dir("isocan-home");
    const acme = mark(dir("acme"), { projectId: "prj_acme", title: "Acme", home: " https://acme.example " });
    fs.mkdirSync(path.join(acme, "src", "deep"), { recursive: true });
    const inner = mark(path.join(acme, "src"), { canvasId: "prj_acmeinner" });

    const deep = await both(path.join(inner, "deep"), home);
    expect(deep.plugin).toEqual(deep.daemon);
    expect(deep.plugin).toEqual({ root: inner, canvasId: "prj_acmeinner" });

    const top = await both(acme, home);
    expect(top.plugin).toEqual(top.daemon);
    expect(top.plugin).toEqual({ root: acme, canvasId: "prj_acme", title: "Acme", home: "https://acme.example" });
  });

  it("walks past a malformed marker the way the daemon does", async () => {
    const home = dir("isocan-home");
    const outer = mark(dir("outer"), { projectId: "prj_acmeouter" });
    const blankHome = mark(path.join(outer, "blank-home"), { projectId: "prj_acme1", home: "  " });
    const noId = mark(path.join(outer, "no-id"), { projectId: "" });
    for (const cwd of [blankHome, noId]) {
      const seen = await both(cwd, home);
      expect(seen.plugin).toEqual(seen.daemon);
      expect(seen.plugin?.canvasId).toBe("prj_acmeouter");
    }
  });

  it("never binds the user's home, the isocan home's parent, or anything above the user's home", async () => {
    const person = mark(dir("person"), { projectId: "prj_acmehome" });
    fs.mkdirSync(path.join(person, "proj"));
    const inHome = await both(path.join(person, "proj"), dir("isocan-home"), person);
    expect(inHome.plugin).toEqual(inHome.daemon);
    expect(inHome.plugin).toBeNull();

    const machine = dir("machine");
    mark(machine, { projectId: "prj_acmedaemon" });
    fs.mkdirSync(path.join(machine, "sub"));
    const beside = await both(path.join(machine, "sub"), path.join(machine, ".isocan"));
    expect(beside.plugin).toEqual(beside.daemon);
    expect(beside.plugin).toBeNull();
  });
});

describe("the plugin's environments", () => {
  it("takes only absolute folders from the host, and never guesses at the rest", () => {
    const d = dir("acme-folder");
    expect(workspacePaths([pathToFileURL(d).href, ` ${d} `, "plugins/jetski", "https://acme.example/x", "vscode-remote://acme/x", "", 3])).toEqual([d, d]);
    expect(workspacePaths(undefined)).toEqual([]);
    expect(workspacePaths("/acme")).toEqual([]);
  });

  it("clears every variable the CLI reads a session from, and the agent's puts back exactly one", async () => {
    const home = dir("isocan-home");
    fs.writeFileSync(path.join(home, "config.json"), JSON.stringify({ harnessVars: { "acme-agent": "ACME_AGENT_SESSION" } }));
    const consulted = [...new Set([...harnessVars, ...(await harnessVarsFor(home, {}))])];
    expect(consulted).toContain("ACME_AGENT_SESSION");
    const env = {
      PATH: "/usr/bin",
      KEEP_ME: "1",
      ISOCAN_CANVAS: "prj_other",
      ...Object.fromEntries(consulted.map((name) => [name, "leaked"])),
    };

    const person = personEnv(env, home);
    for (const name of [...consulted, "ISOCAN_CANVAS"]) expect(person).not.toHaveProperty(name);
    expect(person).toMatchObject({ PATH: "/usr/bin", KEEP_ME: "1" });

    const agent = agentEnv(env, home, "conv-acme");
    expect(consulted.filter((name) => agent[name] !== undefined)).toEqual(["ANTIGRAVITY_CONVERSATION_ID"]);
    expect(agent["ANTIGRAVITY_CONVERSATION_ID"]).toBe("conv-acme");
    expect(env.ISOCAN_CANVAS).toBe("prj_other");
  });

  it("finds the CLI: ISOCAN_CLI, then the PATH, then this checkout", () => {
    expect(resolveCli({ ISOCAN_CLI: "/acme/fake.mjs", PATH: "" })).toEqual({ command: process.execPath, prefix: ["/acme/fake.mjs"] });
    expect(resolveCli({ ISOCAN_CLI: "/acme/isocan", PATH: "" })).toEqual({ command: "/acme/isocan", prefix: [] });

    const bin = dir("bin");
    fs.writeFileSync(path.join(bin, "isocan"), "#!/bin/sh\n", { mode: 0o755 });
    expect(resolveCli({ PATH: bin })).toEqual({ command: path.join(bin, "isocan"), prefix: [] });

    const fromRepo = resolveCli({ PATH: "" });
    expect(fromRepo?.command).toBe(process.execPath);
    expect(fromRepo?.prefix[0]?.startsWith(repo)).toBe(true);
    expect(fs.existsSync(fromRepo?.prefix[0] ?? "")).toBe(true);
  });
});

describe("SessionStart: a conversation in a bound folder arrives on its canvas", () => {
  let isocanHome = "";
  let acme = "";
  let env: Record<string, string | undefined> = {};
  beforeAll(() => {
    isocanHome = dir("isocan-home");
    acme = mark(dir("acme-app"), { projectId: "prj_acme", title: "Acme" });
    fs.mkdirSync(path.join(acme, "src"));
    env = { PATH: process.env["PATH"], ISOCAN_HOME: isocanHome, CLAUDE_CODE_SESSION_ID: "leaked", ISOCAN_CANVAS: "prj_other" };
  });

  it("reads its name from what `identity --session` says", () => {
    expect(claimedName(`${SAVED}this directory's canvas: "Acme" (prj_acme)\n`)).toBe("Acme Bot");
    expect(claimedName("identity saved: Acme Bot (usr_acme1) → /acme/identity.json\n")).toBe("Acme Bot");
    expect(claimedName("something else entirely")).toBeNull();
    expect(claimedName(undefined)).toBeNull();
  });

  it("names the conversation, starts its presence, and says so in one ephemeral message", async () => {
    const { run, calls } = fakeRun({ "identity --session": SAVED });
    const out = await sessionStart({ conversationId: "conv-acme", workspacePaths: [path.join(acme, "src")] }, { env, run });

    expect(calls.map((c) => c.args)).toEqual([
      ["identity", "--session"],
      ["session", "start", "--label", "Acme Bot 🤖"],
    ]);
    for (const call of calls) {
      expect(call.cwd).toBe(acme);
      expect(call.env["ANTIGRAVITY_CONVERSATION_ID"]).toBe("conv-acme");
      expect(call.env).not.toHaveProperty("CLAUDE_CODE_SESSION_ID");
      expect(call.env).not.toHaveProperty("ISOCAN_CANVAS");
    }
    // Jetski parses the output strictly: one key, one step, one field.
    expect(Object.keys(out)).toEqual(["injectSteps"]);
    expect(out.injectSteps).toHaveLength(1);
    expect(Object.keys(out.injectSteps[0])).toEqual(["ephemeralMessage"]);
    const said: string = out.injectSteps[0].ephemeralMessage;
    expect(said).toContain('"Acme" (prj_acme)');
    expect(said).toContain(path.join(acme, ".isocan", "project.json"));
    expect(said).toContain("You are Acme Bot here");
    expect(said).toContain("You are on the canvas now");
    expect(said).toContain(PILL);
    expect(said).toContain("isocan --agent-help");
  });

  it("says nothing outside a bound folder, and never reads its own directory as one", async () => {
    const { run, calls } = fakeRun({ "identity --session": SAVED });
    expect(await sessionStart({ conversationId: "conv-acme", workspacePaths: [dir("plain")] }, { env, run })).toBeNull();
    // The hook's cwd is this plugin's directory, and this test's is the repo:
    // both bound. Neither an absent folder nor a relative one may reach them.
    expect(await sessionStart({ conversationId: "conv-acme" }, { env, run })).toBeNull();
    expect(await sessionStart({ conversationId: "conv-acme", workspacePaths: ["plugins/jetski", "."] }, { env, run })).toBeNull();
    expect(calls).toEqual([]);
  });

  it("does nothing on a call that is not SessionStart's", async () => {
    const { run, calls } = fakeRun({ "identity --session": SAVED });
    const out = await sessionStart({ conversationId: "conv-acme", workspacePaths: [acme], invocationNum: 0 }, { env, run });
    expect(out).toBeNull();
    expect(calls).toEqual([]);
  });

  it("keeps the message and skips the joining when switched off, or when the conversation is unnamed", async () => {
    const { run, calls } = fakeRun({ "identity --session": SAVED });
    const off = await sessionStart({ conversationId: "conv-acme", workspacePaths: [acme] }, { env: { ...env, ISOCAN_JETSKI_JOIN: "off" }, run });
    expect(off.injectSteps[0].ephemeralMessage).toContain("switched off here (ISOCAN_JETSKI_JOIN=off)");
    expect(off.injectSteps[0].ephemeralMessage).toContain(PILL);

    const unnamed = await sessionStart({ workspacePaths: [acme] }, { env, run });
    expect(unnamed.injectSteps[0].ephemeralMessage).toContain("did not say which conversation this is");
    expect(calls).toEqual([]);

    // The session variable Jetski exports is the fallback for the id.
    await sessionStart({ workspacePaths: [acme] }, { env: { ...env, ANTIGRAVITY_CONVERSATION_ID: "conv-fromenv" }, run });
    expect(calls.map((c) => c.env["ANTIGRAVITY_CONVERSATION_ID"])).toEqual(["conv-fromenv", "conv-fromenv"]);
  });

  it("tells naming apart from presence when either fails, and never labels a name it did not read", async () => {
    const naming = fakeRun({ "identity --session": new Error("isocan identity --session: the daemon is not answering") });
    const noName = await sessionStart({ conversationId: "conv-acme", workspacePaths: [acme] }, { env, run: naming.run });
    expect(naming.calls).toHaveLength(1);
    expect(noName.injectSteps[0].ephemeralMessage).toContain("Naming you failed, so you are not on it yet: isocan identity --session: the daemon is not answering");
    expect(noName.injectSteps[0].ephemeralMessage).not.toContain("You are");

    const unread = fakeRun({ "identity --session": "a line nobody expected\n" });
    const vague = await sessionStart({ conversationId: "conv-acme", workspacePaths: [acme] }, { env, run: unread.run });
    expect(unread.calls.map((c) => c.args)).toEqual([["identity", "--session"], ["session", "start"]]);
    expect(vague.injectSteps[0].ephemeralMessage).toContain("You are the name `isocan whoami` shows here");

    const presence = fakeRun({ "identity --session": SAVED, "session start": new Error("isocan session start: timed out after 10s") });
    const offCanvas = await sessionStart({ conversationId: "conv-acme", workspacePaths: [acme] }, { env, run: presence.run });
    const said: string = offCanvas.injectSteps[0].ephemeralMessage;
    expect(said).toContain("You are Acme Bot here");
    expect(said).toContain("Your presence session did not start (isocan session start: timed out after 10s)");
    expect(said).not.toContain("You are on the canvas now");
  });
});

describe("the canvas pane's routes", () => {
  let isocanHome = "";
  let acme = "";
  const bindings = () => ({ workspaceUris: [pathToFileURL(acme).href] });
  beforeAll(() => {
    isocanHome = dir("isocan-home");
    acme = mark(dir("acme-app"), { projectId: "prj_acme", title: "Acme" });
  });
  const paneEnv = (extra: Record<string, string> = {}) => ({
    PATH: process.env["PATH"],
    ISOCAN_HOME: isocanHome,
    ISOCAN_CLI: "/acme/fake.mjs",
    ANTIGRAVITY_CONVERSATION_ID: "conv-host",
    ISOCAN_CANVAS: "prj_other",
    ...extra,
  });

  it("shows the folder, its canvas, and the Agents bar as it would really run here", async () => {
    const { run, calls } = fakeRun({ harness: JSON.stringify(SCAN) });
    let clock = 1_000;
    const { routes } = createPane({ env: paneEnv(), run, now: () => clock });

    const state = await routes["/api/workspace"](bindings());
    expect(state).toMatchObject({ workspace: acme, bound: true, canvasId: "prj_acme", title: "Acme", root: acme, cli: true, defaultHarness: "acme-agent" });
    const byId = Object.fromEntries(state.presets.map((p: { id: string }) => [p.id, p]));
    expect(byId.opus).toMatchObject({ name: "Orla", runsOn: "claude-code", runnable: true, pinsModel: true });
    expect(byId.barium).toMatchObject({ name: "Bram", harness: null, runsOn: "acme-agent", runnable: true, pinsModel: false });
    expect(byId.codex).toMatchObject({ name: "Cole", runsOn: "codex", runnable: false, model: null, pinsModel: null });

    // One scan per minute, however often the pane asks — and as the person.
    await routes["/api/workspace"](bindings());
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ args: ["--json", "harness"], cwd: os.homedir() });
    expect(calls[0]?.env).not.toHaveProperty("ANTIGRAVITY_CONVERSATION_ID");
    expect(calls[0]?.env).not.toHaveProperty("ISOCAN_CANVAS");
    clock += 61_000;
    await routes["/api/workspace"](bindings());
    expect(calls).toHaveLength(2);
  });

  it("still shows the presets when the scan fails or the CLI is too old to say what pins", async () => {
    const failing = createPane({ env: paneEnv(), run: fakeRun({ harness: new Error("isocan harness: boom") }).run });
    const blind = await failing.routes["/api/workspace"](bindings());
    expect(blind.harnessError).toBe("isocan harness: boom");
    expect(blind.presets.every((p: { runnable: boolean; pinsModel: unknown }) => !p.runnable && p.pinsModel === null)).toBe(true);

    const old = { harnesses: [{ name: "claude-code", runnable: true }], default: "claude-code" };
    const dated = createPane({ env: paneEnv(), run: fakeRun({ harness: JSON.stringify(old) }).run });
    const opus = (await dated.routes["/api/workspace"](bindings())).presets.find((p: { id: string }) => p.id === "opus");
    expect(opus).toMatchObject({ runnable: true, pinsModel: null });

    const broken = path.join(dir("presets"), "presets.json");
    fs.writeFileSync(broken, JSON.stringify({ presets: 3 }));
    const mis = createPane({ env: paneEnv({ ISOCAN_JETSKI_PRESETS: broken }), run: fakeRun({ harness: JSON.stringify(SCAN) }).run });
    const said = await mis.routes["/api/workspace"](bindings());
    expect(said.presets).toEqual([]);
    expect(said.presetsError).toContain('expected a "presets" list');
  });

  it("mints the frame's address in the bound folder, with a plain one for a tab", async () => {
    const embed = {
      address: "http://127.0.0.1:4173/p/prj_acme?embed=1#pass_acme",
      canvas: "http://127.0.0.1:4173/p/prj_acme?embed=1",
      expiresAt: "2026-01-01T00:10:00.000Z",
    };
    const { run, calls } = fakeRun({ embed: JSON.stringify(embed) });
    const { routes } = createPane({ env: paneEnv(), run });
    expect(await routes["/api/embed"](bindings())).toEqual({ ...embed, tab: "http://127.0.0.1:4173/p/prj_acme", loopback: true });
    expect(calls[0]).toMatchObject({ args: ["--json", "embed"], cwd: acme });
    await expect(routes["/api/embed"]({ workspaceUris: [pathToFileURL(dir("plain")).href] })).rejects.toThrow("not bound to a canvas yet");
  });

  it("binds an unbound folder to a named canvas, or to a new one, and refuses a bound one", async () => {
    const byLink = dir("acme-link");
    const linked = fakeRun({ harness: JSON.stringify(SCAN), use: "bound\n" });
    const pane = createPane({ env: paneEnv(), run: linked.run });
    await pane.routes["/api/bind"]({ workspaceUris: [byLink], ref: "https://isocan.io/p/prj_acme7?embed=1#pass" });
    expect(linked.calls.find((c) => c.args[0] === "use")).toMatchObject({ args: ["use", "prj_acme7"], cwd: byLink });
    expect(linked.calls.some((c) => c.args.includes("canvas"))).toBe(false);

    const fresh = dir("acme-fresh");
    const created = fakeRun({ harness: JSON.stringify(SCAN), "canvas new": JSON.stringify({ canvasId: "prj_acmenew" }), use: "bound\n" });
    const again = createPane({ env: paneEnv(), run: created.run });
    await again.routes["/api/bind"]({ workspaceUris: [fresh] });
    await again.routes["/api/bind"]({ workspaceUris: [dir("acme-titled")], title: "Acme Board" });
    const acts = created.calls.filter((c) => c.args[0] !== "--json" || c.args[1] !== "harness").map((c) => c.args);
    expect(acts).toEqual([
      ["--json", "canvas", "new", path.basename(fresh)],
      ["use", "prj_acmenew"],
      ["--json", "canvas", "new", "Acme Board"],
      ["use", "prj_acmenew"],
    ]);

    await expect(again.routes["/api/bind"](bindings())).rejects.toThrow("already bound");
    await expect(again.routes["/api/bind"]({ workspaceUris: [] })).rejects.toThrow("has not said which folder");
  });

  it("enrols a standing agent from a preset or outright, in the bound folder", async () => {
    const enrolled = (name: string) => JSON.stringify({ enrolled: { id: `usr_${name.toLowerCase()}`, name }, canvasId: "prj_acme" });
    const { run, calls } = fakeRun({ "rc add": enrolled("Orla") });
    const { routes } = createPane({ env: paneEnv(), run });

    const orla = await routes["/api/model-agent"]({ ...bindings(), presetId: "opus" });
    expect(orla).toEqual({ enrolled: { id: "usr_orla", name: "Orla" }, canvasId: "prj_acme", harness: "claude-code", model: "claude-opus-5-5" });
    await routes["/api/model-agent"]({ ...bindings(), presetId: "barium" });
    await routes["/api/model-agent"]({ ...bindings(), name: "Ada", harness: "acme-agent" });
    expect(calls.map((c) => c.args)).toEqual([
      ["--json", "rc", "add", "Orla", "--dir", acme, "--harness", "claude-code", "--model", "claude-opus-5-5"],
      ["--json", "rc", "add", "Bram", "--dir", acme, "--model", "barium"],
      ["--json", "rc", "add", "Ada", "--dir", acme, "--harness", "acme-agent"],
    ]);
    expect(calls.every((c) => c.cwd === acme && c.env["ANTIGRAVITY_CONVERSATION_ID"] === undefined)).toBe(true);

    await expect(routes["/api/model-agent"]({ ...bindings(), presetId: "nope" })).rejects.toThrow('no preset "nope"');
    await expect(routes["/api/model-agent"](bindings())).rejects.toThrow("an agent needs a name");
    await expect(routes["/api/model-agent"]({ workspaceUris: [dir("plain")], presetId: "opus" })).rejects.toThrow("not bound");
  });

  it("reads what a person pastes, and knows a loopback daemon when it sees one", () => {
    expect(canvasRef("https://isocan.io/p/prj_Acme9?embed=1#pass_x")).toBe("prj_Acme9");
    expect(canvasRef(" prj_acme ")).toBe("prj_acme");
    expect(canvasRef("Acme Board")).toBe("Acme Board");
    expect(canvasRef("  ")).toBeNull();
    expect(canvasRef(undefined)).toBeNull();

    for (const local of ["http://127.0.0.1:4173/p/x", "http://localhost:4173/", "http://[::1]:4173/", "http://acme.localhost/"]) {
      expect(isLoopback(local)).toBe(true);
    }
    for (const away of ["https://isocan.io/p/x", "http://10.0.0.1/", "not an address"]) expect(isLoopback(away)).toBe(false);

    expect(tabAddress("http://127.0.0.1:4173/p/prj_acme?embed=1&chat=on#pass_x")).toBe("http://127.0.0.1:4173/p/prj_acme");
    expect(tabAddress("https://acme.example/p/prj_acme?embed=1&view=grid")).toBe("https://acme.example/p/prj_acme?view=grid");
  });

  it("reads presets from the file beside it, or from one a person names", () => {
    const shipped = loadPresets({});
    expect(shipped.map((p: { id: string }) => p.id)).toEqual(["opus", "barium", "gemini-pro", "gemini-flash", "codex"]);

    const own = path.join(dir("presets"), "mine.json");
    fs.writeFileSync(own, JSON.stringify([{ name: "Ada", harness: "acme-agent" }, { label: "no name" }, { name: " " }]));
    expect(loadPresets({ ISOCAN_JETSKI_PRESETS: own })).toEqual([{ id: "ada", name: "Ada", label: "Ada", harness: "acme-agent", model: null }]);
  });
});

describe("through real processes", () => {
  let fake = "";
  let log = "";
  beforeAll(() => {
    const d = dir("fake-cli");
    log = path.join(d, "calls.jsonl");
    fake = path.join(d, "isocan.mjs");
    fs.writeFileSync(
      fake,
      [
        'import fs from "node:fs";',
        'import path from "node:path";',
        "const args = process.argv.slice(2);",
        'const words = args.filter((a) => a !== "--json");',
        "fs.appendFileSync(process.env.FAKE_ISOCAN_LOG, JSON.stringify({",
        "  args, cwd: process.cwd(),",
        "  conversation: process.env.ANTIGRAVITY_CONVERSATION_ID ?? null,",
        "  leaked: process.env.CLAUDE_CODE_SESSION_ID ?? null,",
        '}) + "\\n");',
        'const say = (v) => process.stdout.write(typeof v === "string" ? v : JSON.stringify(v) + "\\n");',
        "switch (words[0]) {",
        `  case "identity": say(${JSON.stringify(SAVED)}); break;`,
        '  case "session": say("session started\\n"); break;',
        `  case "harness": say(${JSON.stringify(SCAN)}); break;`,
        '  case "embed": say({ address: "http://127.0.0.1:4173/p/prj_acme?embed=1#pass_acme", canvas: "http://127.0.0.1:4173/p/prj_acme?embed=1", expiresAt: "2026-01-01T00:10:00.000Z" }); break;',
        '  default: process.stderr.write("fake isocan: nothing for " + words.join(" ") + "\\n"); process.exit(2);',
        "}",
      ].join("\n"),
    );
  });
  const calls = () =>
    fs.existsSync(log)
      ? fs.readFileSync(log, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line) as Record<string, unknown>)
      : [];

  it("runs hooks.json's command from an installed (symlinked) plugin, and prints exactly the hook result", async () => {
    const link = path.join(dir("plugins"), "isocan");
    expect(installJetskiPlugin({ target: link })).toContain("installed");
    const hooks = JSON.parse(fs.readFileSync(path.join(link, "hooks.json"), "utf8"));
    const command: string = hooks["isocan-session-start"].SessionStart[0].command;
    const acme = mark(dir("acme-app"), { projectId: "prj_acme", title: "Acme" });
    const env = {
      ...process.env,
      ISOCAN_CLI: fake,
      FAKE_ISOCAN_LOG: log,
      ISOCAN_HOME: dir("isocan-home"),
      CLAUDE_CODE_SESSION_ID: "leaked",
    };
    // The host writes the hook's input to its stdin and closes it; so does this.
    const withStdin = (input: unknown) =>
      new Promise<string>((resolve, reject) => {
        const child = execFile("sh", ["-c", command], { cwd: link, env, timeout: 20_000, encoding: "utf8" }, (err, stdout) =>
          err ? reject(err) : resolve(stdout),
        );
        child.stdin?.end(JSON.stringify(input));
      });

    const printed = await withStdin({ conversationId: "conv-acme", workspacePaths: [acme] });
    const out = JSON.parse(printed);
    expect(Object.keys(out)).toEqual(["injectSteps"]);
    expect(out.injectSteps[0].ephemeralMessage).toContain("You are Acme Bot here");
    expect(calls().map((c) => [c["args"], c["cwd"], c["conversation"], c["leaked"]])).toEqual([
      [["identity", "--session"], acme, "conv-acme", null],
      [["session", "start", "--label", "Acme Bot 🤖"], acme, "conv-acme", null],
    ]);

    expect(await withStdin({ conversationId: "conv-acme", workspacePaths: [dir("plain")] })).toBe("");
    expect(calls()).toHaveLength(2);
  });

  it("serves the pane over loopback with the SDK's token rule", async () => {
    const acme = mark(dir("acme-app"), { projectId: "prj_acme", title: "Acme" });
    const env = { ...process.env, ISOCAN_CLI: fake, FAKE_ISOCAN_LOG: log, ISOCAN_HOME: dir("isocan-home"), CLAUDE_CODE_SESSION_ID: "leaked" };
    const fakeHost = {
      sendMessage: (c: string, m: string, o: unknown) => ({ sent: { c, m, o } }),
      startConversation: (m: string, o: unknown) => ({ started: { m, o } }),
      getConversationMetadata: (c: string) => ({ meta: c }),
    };
    const server = createServer({ ...hostRoutes(fakeHost), ...createPane({ env }).routes }, { token: "tok-acme", preload: "window.sidecar = {};" });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const post = (route: string, body: unknown, headers: Record<string, string> = { "x-sidecar-token": "tok-acme" }) =>
      fetch(`${base}${route}`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
    try {
      const page = await fetch(`${base}/`);
      expect(page.status).toBe(200);
      expect(await page.text()).toContain('<script src="/preload.js"></script>');
      const preload = await fetch(`${base}/preload.js`);
      expect(preload.status).toBe(200);
      expect(await preload.text()).toBe("window.sidecar = {};");
      expect(await (await post("/_sidecar/send-message", { conversationId: "c1", message: "hi" })).json()).toMatchObject({ sent: { c: "c1", m: "hi" } });
      expect((await fetch(`${base}/elsewhere`)).status).toBe(404);

      const body = { workspaceUris: [pathToFileURL(acme).href] };
      expect((await post("/api/workspace", body, {})).status).toBe(401);
      expect((await post("/api/workspace", body, { "x-sidecar-token": "wrong" })).status).toBe(401);
      expect((await post("/api/nowhere", body)).status).toBe(404);
      expect((await fetch(`${base}/api/workspace?token=tok-acme`, { method: "PUT" })).status).toBe(405);

      const state = await post("/api/workspace", body);
      expect(state.status).toBe(200);
      expect(await state.json()).toMatchObject({ bound: true, canvasId: "prj_acme", defaultHarness: "acme-agent" });
      const embed = await (await fetch(`${base}/api/embed?token=tok-acme`, { method: "POST", body: JSON.stringify(body) })).json();
      expect(embed).toMatchObject({ tab: "http://127.0.0.1:4173/p/prj_acme", loopback: true });

      const refused = await post("/api/embed", { workspaceUris: [pathToFileURL(dir("plain")).href] });
      expect(refused.status).toBe(500);
      expect(await refused.json()).toEqual({ error: "this workspace is not bound to a canvas yet" });

      const ran = calls().slice(-2);
      expect(ran.map((c) => c["args"])).toEqual([["--json", "harness"], ["--json", "embed"]]);
      expect(ran.every((c) => c["leaked"] === null && c["conversation"] === null)).toBe(true);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});

describe("the bundle", () => {
  const read = (rel: string) => fs.readFileSync(path.join(plugin, rel), "utf8");
  const json = (rel: string) => JSON.parse(read(rel));

  it("is one plugin named isocan, so its pane's pill is sidecar://isocan/canvas/", () => {
    const manifest = json("plugin.json");
    expect(manifest.name).toBe("isocan");
    expect(manifest.suggestedPrompts.length).toBeLessThanOrEqual(3);
    expect(fs.existsSync(path.join(plugin, manifest.logo))).toBe(true);
    expect(fs.existsSync(path.join(plugin, "sidecars", "canvas", "sidecar.json"))).toBe(true);
    for (const file of ["rules/AGENTS.md", "scripts/session-start.mjs"]) expect(read(file)).toContain("(sidecar://isocan/canvas/)");
  });

  it("hooks only SessionStart, and only where node exists", () => {
    const hooks = json("hooks.json");
    expect(Object.keys(hooks)).toEqual(["isocan-session-start"]);
    expect(Object.keys(hooks["isocan-session-start"])).toEqual(["SessionStart"]);
    const [entry] = hooks["isocan-session-start"].SessionStart;
    expect(entry.command).toMatch(/^if command -v node .*; then exec node \.\/scripts\/session-start\.mjs; fi$/);
    expect(entry.timeout).toBeLessThanOrEqual(30);
  });

  it("frames its page in the AuxPane with a node command", () => {
    const sidecar = json("sidecars/canvas/sidecar.json");
    expect(sidecar).toMatchObject({ command: "node", args: ["main.mjs"], has_web_ui: true });
    expect(sidecar.ui_config.views).toEqual([expect.objectContaining({ path: "/", entrypoint: "SIDECAR_UI_ENTRYPOINT_AUX_PANE" })]);
  });

  it("speaks the web client's bridge in the web client's words", () => {
    const page = read("sidecars/canvas/public/index.html");
    const bridge = fs.readFileSync(path.join(repo, "packages", "web", "src", "lib", "hostbridge.ts"), "utf8");
    for (const type of ["isocan:ready", "isocan:hello", "isocan:selection", "isocan:focus-item"]) {
      expect(page).toContain(type);
      expect(bridge).toContain(type);
    }
  });

  it("carries its own rule, and the collaboration skill as a doorway rather than a copy", () => {
    // A symlink here once pulled this repo's whole developer guide into every workspace.
    expect(fs.lstatSync(path.join(plugin, "rules", "AGENTS.md")).isFile()).toBe(true);
    const skill = path.join(plugin, "skills", "isocan-collab");
    expect(fs.lstatSync(skill).isSymbolicLink()).toBe(true);
    expect(path.isAbsolute(fs.readlinkSync(skill))).toBe(false);
    expect(fs.realpathSync(skill)).toBe(fs.realpathSync(path.join(repo, ".agents", "skills", "isocan-collab")));
    for (const agent of ["canvas-builder.md", "visual-arena.md"]) {
      const body = read(path.join("agents", agent));
      expect(body.startsWith("---\n")).toBe(true);
      expect(body).toMatch(/^name: \S+/m);
      expect(body).toMatch(/^description: \S+/m);
    }
  });

  it("names every preset agent as an agent, never after its model or vendor", () => {
    const vendors = ["claude", "anthropic", "gemini", "google", "openai", "gpt", "codex", "opus", "barium"];
    const words = (s: string | null) => (s ?? "").toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 3);
    const presets = loadPresets({});
    expect(new Set(presets.map((p: { id: string }) => p.id)).size).toBe(presets.length);
    for (const p of presets as { name: string; label: string; model: string | null }[]) {
      for (const word of [...vendors, ...words(p.label), ...words(p.model)]) expect(p.name.toLowerCase()).not.toContain(word);
    }
  });
});

describe("the installer", () => {
  it("links, re-links idempotently, refuses a real directory unless forced, and removes only its own link", () => {
    const root = dir("plugins");
    const target = path.join(root, "isocan");
    expect(installJetskiPlugin({ target })).toBe(`installed: ${target} → ${plugin}`);
    expect(fs.realpathSync(target)).toBe(fs.realpathSync(plugin));
    expect(installJetskiPlugin({ target })).toContain("already installed");

    const elsewhere = dir("elsewhere");
    fs.unlinkSync(target);
    fs.symlinkSync(elsewhere, target, "dir");
    expect(() => uninstallJetskiPlugin({ target })).toThrow("not this script's to remove");
    expect(installJetskiPlugin({ target })).toContain("installed");
    expect(fs.realpathSync(target)).toBe(fs.realpathSync(plugin));

    fs.unlinkSync(target);
    fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, "keep.txt"), "somebody's copy");
    expect(() => installJetskiPlugin({ target })).toThrow("real directory");
    expect(fs.existsSync(path.join(target, "keep.txt"))).toBe(true);
    expect(installJetskiPlugin({ target, force: true })).toContain("installed");

    expect(uninstallJetskiPlugin({ target })).toContain("uninstalled");
    expect(fs.existsSync(target)).toBe(false);
    expect(uninstallJetskiPlugin({ target })).toContain("nothing installed");
    expect(defaultTarget({ ISOCAN_JETSKI_PLUGIN_DIR: target })).toBe(path.resolve(target));
  });
});
