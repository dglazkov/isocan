import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Project } from "@isocan/core";
import { startDaemon, stopDaemons, type Daemon } from "@isocan/server";
import { harnessVars } from "../src/harness.ts";

/**
 * Two agents, one directory.
 *
 * A directory has one identity file, so agents sharing a checkout used to
 * share a name — which is why there is no directory identity slot (#56).
 * Every harness exports a session id into the commands it runs; claiming an
 * actor against that id (`actor.claim`, applied by the daemon's single
 * writer) is what makes them two people — without either of them having to
 * be told the other exists (#57).
 */

const cliBin = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));
const nico = { id: "usr_nico", name: "Nico" };

let home: string;
let work: string;
let daemon: Daemon;
let base: string;
let port: number;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-session-"));
  work = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-session-work-"));
  await fs.writeFile(
    path.join(home, "identity.json"),
    JSON.stringify({ ...nico, createdAt: new Date().toISOString() }),
  );
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  port = typeof address === "object" && address ? address.port : 0;
  base = `http://127.0.0.1:${port}`;
});

afterEach(async () => {
  await daemon.close();
  await stopDaemons(port, home).catch(() => {});
  await fs.rm(home, { recursive: true, force: true });
  await fs.rm(work, { recursive: true, force: true });
});

/**
 * The CLI as one agent runs it. The suite itself runs inside some harness or
 * other, so every session variable is cleared before the caller's are set:
 * a test must assert the same thing under Claude Code, codex and a bare shell.
 */
function asAgent(session: Record<string, string>, ...args: string[]) {
  const env: NodeJS.ProcessEnv = { ...process.env, ISOCAN_HOME: home, ISOCAN_PORT: String(port) };
  for (const v of harnessVars) delete env[v];
  Object.assign(env, session);
  const child = spawn(process.execPath, [cliBin, ...args], {
    cwd: work,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (c) => (stdout += c));
  child.stderr.on("data", (c) => (stderr += c));
  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve) =>
    child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr })),
  );
}

const claude = (id: string) => ({ CLAUDE_CODE_SESSION_ID: id });

/** The daemon's registry, read from its snapshot on disk. */
const registry = () =>
  fs
    .readFile(path.join(home, "actors.json"), "utf8")
    .then(
      (raw) =>
        JSON.parse(raw) as { claims: Record<string, { id: string; name: string; boundAt: string }> },
    );

/**
 * Put a claim in the past. The registry lives in the daemon's memory, so
 * aging a binding means editing the snapshot UNDER a stopped daemon and
 * starting a fresh one — which doubles as a persistence test.
 */
async function age(key: string, hours: number): Promise<void> {
  await daemon.close();
  const file = path.join(home, "actors.json");
  const reg = await registry();
  reg.claims[key]!.boundAt = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  await fs.writeFile(file, JSON.stringify(reg, null, 2));
  daemon = await startDaemon({ port, home });
}

const projects = (): Promise<Project[]> =>
  fetch(`${base}/api/projects`).then((r) => r.json() as Promise<Project[]>);
const idOf = (out: string) => /\((usr_[^)]+)\)/.exec(out)?.[1];

describe("two agents in one directory", () => {
  it("are two actors, and neither of them is the human", async () => {
    await asAgent(claude("s-1"), "identity", "--name", "Kenny", "--session");
    await asAgent(claude("s-2"), "identity", "--name", "Isaac", "--session");

    expect((await asAgent(claude("s-1"), "whoami")).stdout).toContain("Kenny");
    expect((await asAgent(claude("s-2"), "whoami")).stdout).toContain("Isaac");

    await asAgent(claude("s-1"), "project", "create", "Kenny's Canvas");
    await asAgent(claude("s-2"), "project", "create", "Isaac's Canvas");
    const by = Object.fromEntries((await projects()).map((p) => [p.title, p.createdBy.name]));
    expect(by["Kenny's Canvas"]).toBe("Kenny");
    expect(by["Isaac's Canvas"]).toBe("Isaac");

    // The one file they share is untouched: no directory identity was written.
    await expect(fs.access(path.join(work, ".isocan", "identity.json"))).rejects.toThrow();
    const human = JSON.parse(await fs.readFile(path.join(home, "identity.json"), "utf8"));
    expect(human.name).toBe("Nico");
  });
});

describe("a session is a key, not a person", () => {
  it("the same key later — even after a restart — is the same actor", async () => {
    const first = await asAgent(claude("s-1"), "identity", "--name", "Kenny", "--session");
    await age("claude-code:s-1", 26); // restarts the daemon: registry reloads
    // `--continue` semantics: the conversation resumed, the key is the same.
    const later = await asAgent(claude("s-1"), "identity", "--session");
    expect(later.code).toBe(0);
    expect(later.stdout).toContain("Kenny");
    expect(idOf(later.stdout)).toBe(idOf(first.stdout));
  });

  it("a NEW session wanting a used name is refused — coincidence is not identity", async () => {
    // The old rule resumed "a name you used before" by lookup, which made a
    // returning Kenny indistinguishable from a second Kenny. No name lookup
    // anywhere now: a different key asking for Kenny is somebody else.
    const first = await asAgent(claude("s-1"), "identity", "--name", "Kenny", "--session");
    const second = await asAgent(claude("s-9"), "identity", "--name", "Kenny", "--session");
    expect(second.code).not.toBe(0);
    expect(second.stderr).toContain("taken here");
    expect(second.stderr).toContain(`--as ${idOf(first.stdout)}`); // the deliberate way back
  });

  it("--as resumes a lost actor on purpose, and unseats the dead session", async () => {
    const first = await asAgent(claude("s-1"), "identity", "--name", "Kenny", "--session");
    const kenny = idOf(first.stdout)!;
    await age("claude-code:s-1", 26); // the old conversation is long gone

    const back = await asAgent(claude("s-9"), "identity", "--as", kenny);
    expect(back.code).toBe(0);
    expect(back.stdout).toContain("Kenny");
    expect(idOf(back.stdout)).toBe(kenny);

    // One actor is one session: the abandoned key no longer speaks as Kenny.
    expect(Object.keys((await registry()).claims)).toEqual(["claude-code:s-9"]);
  });

  it("--as is refused while the actor is visibly somebody", async () => {
    // The suggestion "use --as if you are them" must not be followable by
    // somebody who is not: a just-claimed session is presumed alive.
    const first = await asAgent(claude("s-1"), "identity", "--name", "Kenny", "--session");
    const steal = await asAgent(claude("s-9"), "identity", "--as", idOf(first.stdout)!);
    expect(steal.code).not.toBe(0);
    expect(steal.stderr).toContain("two faces");
  });

  it("unless --new, which makes you someone else", async () => {
    const first = await asAgent(claude("s-1"), "identity", "--name", "Kenny", "--session");
    const other = await asAgent(claude("s-9"), "identity", "--name", "Kenny", "--session", "--new");
    expect(other.code).toBe(0);
    expect(idOf(other.stdout)).not.toBe(idOf(first.stdout));
  });

  it("speaks as itself from a subdirectory — the id is not a path", async () => {
    await asAgent(claude("s-1"), "identity", "--name", "Kenny", "--session");
    const deep = path.join(work, "packages", "thing");
    await fs.mkdir(deep, { recursive: true });
    const env = { ...process.env, ISOCAN_HOME: home, ISOCAN_PORT: String(port), ...claude("s-1") };
    const out = await new Promise<string>((resolve) => {
      const child = spawn(process.execPath, [cliBin, "whoami"], { cwd: deep, env, stdio: ["ignore", "pipe", "pipe"] });
      let s = "";
      child.stdout.on("data", (c) => (s += c));
      child.on("close", () => resolve(s));
    });
    expect(out).toContain("Kenny");
  });
});

describe("ask, receive", () => {
  it("a claim with no name is handed the next free isocan name", async () => {
    const first = await asAgent(claude("s-1"), "identity", "--session");
    expect(first.code).toBe(0);
    expect(first.stdout).toContain("Isaac"); // the roster, in order

    const second = await asAgent(claude("s-2"), "identity", "--session");
    expect(second.stdout).toContain("Kenny"); // Isaac is taken — no race, no retry

    // And asking again is being told who you already are, not a third name.
    const again = await asAgent(claude("s-1"), "identity", "--session");
    expect(again.stdout).toContain("Isaac");
    expect(idOf(again.stdout)).toBe(idOf(first.stdout));
  });

  it("allocation skips names the canvases answer to, not just claimed ones", async () => {
    await asAgent({}, "project", "create", "Isaac's Own"); // Nico's canvas...
    await asAgent({}, "session", "start", "--project", "Isaac's Own");
    // ...but rename the human to Isaac so the name is on the canvas's record.
    await asAgent({}, "identity", "--name", "Isaac", "--home");
    await asAgent({}, "ls", "--project", "Isaac's Own"); // put the new name on a live face

    const claimed = await asAgent(claude("s-1"), "identity", "--session");
    expect(claimed.code).toBe(0);
    expect(claimed.stdout).not.toContain("Isaac ("); // not handed the human's name
    expect(claimed.stdout).toContain("Kenny");
  });
});

describe("agents launched by agents", () => {
  it("the inner one speaks, though it can see the outer one's session too", async () => {
    // Claude Code names itself, then starts codex: the child inherits
    // CLAUDE_CODE_SESSION_ID, so both keys are visible to every command it runs.
    await asAgent(claude("outer"), "identity", "--name", "Kenny", "--session");
    const nested = { ...claude("outer"), CODEX_THREAD_ID: "inner" };
    await asAgent(nested, "identity", "--name", "Isaac", "--session");

    expect((await asAgent(nested, "whoami")).stdout).toContain("Isaac");
    expect((await asAgent(claude("outer"), "whoami")).stdout).toContain("Kenny");
  });
});

describe("nothing to name", () => {
  it("--session says so, and points at the variable that does work", async () => {
    const out = await asAgent({}, "identity", "--name", "Kenny", "--session");
    expect(out.code).not.toBe(0);
    expect(out.stderr).toContain("no harness session");
    expect(out.stderr).toContain("ISOCAN_SESSION_ID");
    expect(out.stderr).toContain("harnessVars");
  });
});

describe("harnesses isocan has not met", () => {
  it("ISOCAN_SESSION_ID names an agent when nothing else does", async () => {
    await asAgent({ ISOCAN_SESSION_ID: "own-1" }, "identity", "--name", "Sonia", "--session");
    const who = await asAgent({ ISOCAN_SESSION_ID: "own-1" }, "whoami");
    expect(who.stdout).toContain("Sonia");
    expect(who.stdout).toContain("this agent session");
    // And it is one agent among several: a second value is a second person.
    await asAgent({ ISOCAN_SESSION_ID: "own-2" }, "identity", "--name", "Iona", "--session");
    expect((await asAgent({ ISOCAN_SESSION_ID: "own-1" }, "whoami")).stdout).toContain("Sonia");
  });

  it("ISOCAN_HARNESS is what it gets called", async () => {
    const env = { ISOCAN_SESSION_ID: "own-1", ISOCAN_HARNESS: "jetski" };
    const out = await asAgent(env, "identity", "--name", "Sonia", "--session");
    expect(out.stdout).toContain("(jetski session)");
    expect((await asAgent(env, "identity")).stdout).toContain("this agent session (jetski)");
  });

  it("deliberate beats ambient: the escape hatch is the session claimed", async () => {
    await asAgent(
      { ISOCAN_SESSION_ID: "own-1", ...claude("ambient") },
      "identity",
      "--name",
      "Sonia",
      "--session",
    );
    expect(Object.keys((await registry()).claims)).toEqual(["isocan:own-1"]);
  });

  it("config.json adopts a harness isocan never shipped", async () => {
    await fs.writeFile(
      path.join(home, "config.json"),
      JSON.stringify({ harnessVars: { jetski: "JETSKI_CONVO", bad: "not a var name" } }),
    );
    const out = await asAgent({ JETSKI_CONVO: "j-1" }, "identity", "--name", "Cana", "--session");
    expect(out.code).toBe(0);
    expect(out.stdout).toContain("(jetski session)"); // and the typo alongside it was ignored
    expect(Object.keys((await registry()).claims)).toEqual(["jetski:j-1"]);
    expect((await asAgent({ JETSKI_CONVO: "j-1" }, "whoami")).stdout).toContain("Cana");
  });
});

describe("one name, one agent", () => {
  it("the second agent to reach for a name is refused, not merged into the first", async () => {
    // The bug this exists for: both agents entered a checkout, both were told
    // to be Kenny, and name-continuity handed the second one the first one's
    // actor id. Two processes, one actor, and `@Kenny` reaching both.
    await asAgent(claude("s-1"), "identity", "--name", "Kenny", "--session");
    const second = await asAgent(claude("s-2"), "identity", "--name", "Kenny", "--session");

    expect(second.code).not.toBe(0);
    expect(second.stderr).toContain("taken here");
    expect(Object.keys((await registry()).claims)).toEqual(["claude-code:s-1"]);
    // And the loser is still nobody, rather than quietly being the winner.
    expect((await asAgent(claude("s-2"), "whoami")).stdout).not.toContain("Kenny");
  });

  it("a live name is taken however its wearer got it — the human's counts too", async () => {
    // The reducer compares against everyone a canvas answers to, not just the
    // registry: here the Nico on the canvas belongs to no session at all.
    await asAgent({}, "project", "create", "Shared");
    await asAgent({}, "session", "start", "--project", "Shared");

    const taken = await asAgent(claude("s-1"), "identity", "--name", "Nico", "--session");
    expect(taken.code).not.toBe(0);
    expect(taken.stderr).toContain("taken here");
    expect(taken.stderr).toContain("Shared"); // and says where it is worn
  });

  it("--new takes the name on purpose, and is still a different person", async () => {
    const first = await asAgent(claude("s-1"), "identity", "--name", "Kenny", "--session");
    const second = await asAgent(
      claude("s-2"), "identity", "--name", "Kenny", "--session", "--new",
    );
    expect(second.code).toBe(0);
    expect(idOf(second.stdout)).not.toBe(idOf(first.stdout));
  });

  it("renaming yourself is never a collision with yourself", async () => {
    await asAgent(claude("s-1"), "identity", "--name", "Kenny", "--session");
    const again = await asAgent(claude("s-1"), "identity", "--name", "Kenny", "--session");
    expect(again.code).toBe(0);
    const renamed = await asAgent(claude("s-1"), "identity", "--name", "Kenny the Second", "--session");
    expect(renamed.code).toBe(0);
    expect(idOf(renamed.stdout)).toBe(idOf(again.stdout));
  });
});
