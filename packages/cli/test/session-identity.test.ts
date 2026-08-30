import { reservePort } from "../../../test/ports.ts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Canvas } from "@isocan/core";
import { startDaemon, stopDaemons, type Daemon } from "@isocan/server";
import { harnessVars } from "../src/harness.ts";
import { mintTestBadge } from "./badge.ts";

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
  daemon = await startDaemon({ port: await reservePort(), home });
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

const deskFile = () => path.join(home, "desk", "badges.json");

interface DeskSnapshot {
  badges: Record<string, { claims: { actorId: string; boundAt: string; sessionKey?: string }[] }>;
}

/**
 * Who this home's claims belong to, keyed by session key — read off the
 * DESK's snapshot rather than `actors.json`, because the claims half of the
 * registry moved behind the desk when it re-keyed onto badges. The machine
 * has exactly one badge (one per `~/.isocan`), and its claims are the agents
 * on it, so flattening reads exactly as the old table did.
 */
const registry = async (): Promise<{
  claims: Record<string, { id: string; boundAt: string }>;
}> => {
  const desk = JSON.parse(await fs.readFile(deskFile(), "utf8")) as DeskSnapshot;
  const claims: Record<string, { id: string; boundAt: string }> = {};
  for (const badge of Object.values(desk.badges)) {
    for (const row of badge.claims) {
      if (row.sessionKey) claims[row.sessionKey] = { id: row.actorId, boundAt: row.boundAt };
    }
  }
  return { claims };
};

/**
 * Put a claim in the past. The claims table lives in the daemon's memory, so
 * aging a binding means editing the desk's snapshot UNDER a stopped daemon
 * and starting a fresh one — which doubles as a persistence test.
 */
async function age(key: string, hours: number): Promise<void> {
  await daemon.close();
  const desk = JSON.parse(await fs.readFile(deskFile(), "utf8")) as DeskSnapshot & {
    lastSeq: number;
  };
  const at = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  for (const badge of Object.values(desk.badges)) {
    for (const row of badge.claims) if (row.sessionKey === key) row.boundAt = at;
  }
  await fs.writeFile(deskFile(), JSON.stringify(desk, null, 2));
  daemon = await startDaemon({ port, home });
}

/** Reading the daemon directly needs a badge like anything else does. */
const badgeHeaders = async (): Promise<Record<string, string>> =>
  (await mintTestBadge(base)).headers;

const canvases = async (): Promise<Canvas[]> =>
  fetch(`${base}/api/projects`, { headers: await badgeHeaders() }).then(
    (r) => r.json() as Promise<Canvas[]>,
  );
const idOf = (out: string) => /\((usr_[^)]+)\)/.exec(out)?.[1];
/** The name out of `identity saved: <name> (usr_…)`. Read rather than
 *  asserted, because allocation enters its roster at a hashed point — the
 *  LETTER is the promise, not the index. */
const nameOf = (out: string) => /identity saved: (.+?) \(usr_/.exec(out)?.[1] ?? "";

describe("two agents in one directory", () => {
  it("are two actors, and neither of them is the human", async () => {
    await asAgent(claude("s-1"), "identity", "--name", "Kenny", "--session");
    await asAgent(claude("s-2"), "identity", "--name", "Isaac", "--session");

    expect((await asAgent(claude("s-1"), "whoami")).stdout).toContain("Kenny");
    expect((await asAgent(claude("s-2"), "whoami")).stdout).toContain("Isaac");

    await asAgent(claude("s-1"), "canvas", "create", "Kenny's Canvas");
    await asAgent(claude("s-2"), "canvas", "create", "Isaac's Canvas");
    const by = Object.fromEntries((await canvases()).map((p) => [p.title, p.createdBy.name]));
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
  it("a claim with no name is handed a name that starts like its harness", async () => {
    // These claim as `claude-code`, so they draw from the C roster before the
    // isocan one — a person looking at three agents can tell which is which.
    const first = await asAgent(claude("s-1"), "identity", "--session");
    expect(first.code).toBe(0);
    const firstName = nameOf(first.stdout);
    expect(firstName[0], `${firstName} is not a C name`).toBe("C");

    const second = await asAgent(claude("s-2"), "identity", "--session");
    const secondName = nameOf(second.stdout);
    // Also a C name, and NOT the first one — no race, no retry, no "Charlie 2".
    expect(secondName[0], `${secondName} is not a C name`).toBe("C");
    expect(secondName).not.toBe(firstName);

    // And asking again is being told who you already are, not a third name.
    const again = await asAgent(claude("s-1"), "identity", "--session");
    expect(nameOf(again.stdout)).toBe(firstName);
    expect(idOf(again.stdout)).toBe(idOf(first.stdout));
  });

  it("allocation skips names the canvases answer to, not just claimed ones", async () => {
    // The taken name has to be one this agent would otherwise WANT, or the case
    // passes for the wrong reason. So: find out what it would be handed, then
    // park the human on exactly that.
    const probe = await asAgent(claude("probe"), "identity", "--session");
    const wanted = nameOf(probe.stdout);

    await asAgent({}, "canvas", "create", `${wanted}'s Own`);
    await asAgent({}, "session", "start", "--canvas", `${wanted}'s Own`);
    await asAgent({}, "identity", "--name", wanted, "--home");
    await asAgent({}, "ls", "--canvas", `${wanted}'s Own`); // put it on a live face

    const claimed = await asAgent(claude("s-1"), "identity", "--session");
    expect(claimed.code).toBe(0);
    const got = nameOf(claimed.stdout);
    expect(got).not.toBe(wanted); // not handed the human's name
    expect(got[0], `${got} is not a C name`).toBe("C"); // still its own roster
  });
});

describe("two agents, two faces", () => {
  it("presence beats never cross — each agent touches only its own session", async () => {
    await asAgent(claude("s-1"), "identity", "--name", "Iona", "--session");
    await asAgent(claude("s-2"), "identity", "--name", "Osian", "--session");
    await asAgent(claude("s-1"), "canvas", "create", "Surfaces");
    await asAgent(claude("s-1"), "session", "start", "--canvas", "Surfaces", "--label", "Iona 🤖");
    await asAgent(claude("s-2"), "session", "start", "--canvas", "Surfaces", "--label", "Osian 🤖");

    // The facepile bug: the session pointer was ONE file per home, and every
    // update re-states who is holding the session — so Iona's next command
    // read the pointer Osian had just overwritten and beat HER actor into
    // HIS session: Iona's face under the label "Osian 🤖", while Iona's own
    // session starved. Narrating commands are the beats that did it.
    await asAgent(claude("s-1"), "ls", "--canvas", "Surfaces");
    await asAgent(claude("s-2"), "comment", "list", "--canvas", "Surfaces");
    await asAgent(claude("s-1"), "ls", "--canvas", "Surfaces");

    const canvas = (await canvases()).find((p) => p.title === "Surfaces")!;
    const roster = (await fetch(`${base}/api/projects/${canvas.id}/sessions`, { headers: await badgeHeaders() }).then((r) =>
      r.json(),
    )) as { sessionId: string; label: string | null; actor: { id: string; name: string } }[];

    expect(roster).toHaveLength(2); // two faces, neither starved out
    const byLabel = Object.fromEntries(roster.map((s) => [s.label, s.actor.name]));
    expect(byLabel).toEqual({ "Iona 🤖": "Iona", "Osian 🤖": "Osian" });
    expect(new Set(roster.map((s) => s.actor.id)).size).toBe(2);
    /**
     * **Eight real CLI spawns, so eight Node starts** — the most of any test
     * here, and every one of them is load-bearing: two claims and two session
     * starts to get two faces onto the canvas, and the three narrating
     * commands are the beats that reproduced the pointer bug in the first
     * place. Nothing here can be dropped without the test stopping to pin
     * what it pins.
     *
     * That makes it the slowest test in the suite against vitest's default
     * 5s, which was always thin and which phase 10 tipped over by adding
     * three more files for the workers to run in parallel. CI failed it three
     * times in six runs while every local run passed — the flake phase 8
     * recorded as unnamed, finally named by a machine slower than this one.
     *
     * **This is not a timeout lengthened to hide a signal** (phase 7.5's
     * finding, and the rule still stands). There is no signal: the assertions
     * above are about roster state, not about time, and the failure was
     * always "eight process spawns did not fit in five seconds on a shared
     * runner". The honest fix for a test that is genuinely slow is to say how
     * slow it is allowed to be, next to the reason it is slow.
     */
  }, 30_000);
});

describe("leaving is leaving", () => {
  it("session end clears the face even when the pointer is lost", async () => {
    // The transition ghost: sessions started before the per-actor pointer
    // existed could never be ended by the file — "no active session" — and
    // the face blinked on until its TTL. End by ACTOR instead: the pointer
    // is a cache, the daemon is the truth.
    await asAgent(claude("s-1"), "identity", "--name", "Iona", "--session");
    await asAgent(claude("s-1"), "canvas", "create", "Surfaces");
    await asAgent(claude("s-1"), "session", "start", "--canvas", "Surfaces", "--label", "Iona 🤖");
    await fs.rm(path.join(home, "sessions"), { recursive: true, force: true });

    const ended = await asAgent(claude("s-1"), "session", "end", "--canvas", "Surfaces");
    expect(ended.stdout).toContain("session ended");

    const canvas = (await canvases()).find((p) => p.title === "Surfaces")!;
    const roster = (await fetch(`${base}/api/projects/${canvas.id}/sessions`, { headers: await badgeHeaders() }).then((r) =>
      r.json(),
    )) as unknown[];
    expect(roster).toEqual([]); // nobody left blinking
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
    await asAgent({}, "canvas", "create", "Shared");
    await asAgent({}, "session", "start", "--canvas", "Shared");

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
