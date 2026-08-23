import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { paths, startDaemon, stopDaemons, type Daemon } from "@isocan/server";
import { harnessVars } from "../src/harness.ts";

/**
 * **`isocan home` — the verb phase 7.5 exists for.**
 *
 * `config.json` has had a `home` key since phase 6 and `resolveHomeUrl` has
 * always read it; nothing could write it, so becoming a replica meant an
 * environment variable and a text editor. What has to be true of the verb that
 * replaces them:
 *
 * - setting a home really makes the daemon a replica (it stops serving pages
 *   and starts forwarding), and the setting SURVIVES the restart — the daemon
 *   reads its home once, at boot, so a write that is not followed by a
 *   restart is a write that did nothing;
 * - clearing it makes the daemon a home again;
 * - a nonsense address is refused, with the shape shown;
 * - a home that does not answer is REPORTED, not silently accepted — a replica
 *   that cannot reach its home refuses every write, and nothing is queued.
 *
 * These drive the real binary and let the CLI spawn its own daemon, the way
 * `restart.test.ts` does, because the restart is half of what is under test.
 * The home on the other end is a real second daemon on a temp `ISOCAN_HOME`
 * — never a shared one; creating canvases on `dev.isocan.io` is the
 * conductor's call, not a test's.
 */

const cliBin = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));

let isocanHome: string;
let upstreamDir: string;
let work: string;
let port: number;
let upstream: Daemon;
let homeBase: string;

/** A port nobody is on. Two uses here: the replica's own (the CLI spawns the
 * daemon itself, which is the path the verb walks) and, once, an address that
 * is guaranteed to answer nothing. */
function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address() as net.AddressInfo;
      probe.close(() => resolve(address.port));
    });
  });
}

beforeEach(async () => {
  isocanHome = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-home-verb-"));
  upstreamDir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-home-verb-up-"));
  work = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-home-verb-work-"));
  port = await freePort();
  upstream = await startDaemon({ port: 0, home: upstreamDir, homeUrl: null });
  const address = upstream.app.server.address();
  homeBase = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});

afterEach(async () => {
  // Awaited, in-process: a detached daemon outliving the worker is how a run
  // ends with "Channel closed" instead of a summary.
  await stopDaemons(port, isocanHome).catch(() => {});
  await upstream.close();
  await Promise.allSettled(
    [isocanHome, upstreamDir, work].map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});

interface Run {
  code: number;
  stdout: string;
  stderr: string;
}

function isocan(...args: string[]): Promise<Run> {
  return isocanWith({}, ...args);
}

/** The same, with extra environment — a harness session id, or the variable
 * this verb refuses to compete with. */
function isocanWith(extra: Record<string, string>, ...args: string[]): Promise<Run> {
  return isocanIn(work, extra, ...args);
}

function isocanIn(cwd: string, extra: Record<string, string>, ...args: string[]): Promise<Run> {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ISOCAN_HOME: isocanHome,
    ISOCAN_PORT: String(port),
  };
  for (const v of harnessVars) delete env[v];
  Object.assign(env, extra);
  const child = spawn(process.execPath, [cliBin, ...args], {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (c) => (stdout += c));
  child.stderr.on("data", (c) => (stderr += c));
  return new Promise((resolve) =>
    child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr })),
  );
}

const json = async (...args: string[]) => {
  const run = await isocan(...args, "--json");
  expect(run.code, run.stderr).toBe(0);
  return JSON.parse(run.stdout) as Record<string, unknown>;
};

async function configuredHome(): Promise<unknown> {
  const raw = await fs.readFile(paths.configFile(isocanHome), "utf8").catch(() => "{}");
  return (JSON.parse(raw) as Record<string, unknown>).home;
}

describe("isocan home, the reading", () => {
  it("says a daemon is a home when nothing is configured", async () => {
    await isocan("serve");
    const shown = await json("home");
    expect(shown.role).toBe("home");
    expect(shown.home).toBeNull();

    const text = await isocan("home");
    expect(text.stdout).toContain("home — this daemon holds the canvases");
  }, 30_000);

  it("answers without starting a daemon, and says so", async () => {
    const shown = await json("home");
    expect(shown.running).toBe(false);
    expect((await isocan("home")).stdout).toContain("no daemon is running");
  }, 30_000);
});

describe("isocan home <url>", () => {
  it("makes the daemon a replica, and the setting outlives the restart", async () => {
    await isocan("serve");
    const set = await json("home", homeBase);
    expect(set.role).toBe("replica");
    expect(set.home).toBe(homeBase);
    expect(set.restarted).toBe(true);

    // The file, and the daemon that came back reading it. Both, because
    // either one alone is the bug this verb exists to remove: a write nobody
    // reads, or a daemon nobody wrote down.
    expect(await configuredHome()).toBe(homeBase);
    expect((await json("status")).home).toBe(homeBase);
    expect((await json("home")).reachable).toBe(true);

    // A replica really is one: it forwards. The canvas this directory gets
    // is born AT THE HOME, which is the phase 6 behaviour the setting turns on.
    const named = await isocanWith({ ISOCAN_SESSION_ID: "s-home-verb" }, "identity", "--session");
    expect(named.code, named.stderr).toBe(0);
    expect((await upstream.engine.listProjects()).length).toBe(1);
  }, 30_000);

  it("does not bounce a daemon that already answers to that home", async () => {
    await isocan("home", homeBase);
    const before = (await json("status")).pid;
    const again = await json("home", homeBase);
    expect(again.restarted).toBe(false);
    expect((await json("status")).pid).toBe(before);
  }, 30_000);

  it("refuses an address that is not one, and shows the shape", async () => {
    const run = await isocan("home", "dev.isocan.io");
    expect(run.code).toBe(1);
    expect(run.stderr).toContain("https://isocan.io");
    expect(await configuredHome()).toBeUndefined();
  }, 30_000);

  it("refuses a canvas link by naming the origin inside it", async () => {
    const run = await isocan("home", `${homeBase}/p/prj_abc123`);
    expect(run.code).toBe(1);
    expect(run.stderr).toContain(`isocan home ${homeBase}`);
    expect(await configuredHome()).toBeUndefined();
  }, 30_000);

  it("reports a home that does not answer rather than walking into it", async () => {
    const nowhere = `http://127.0.0.1:${await freePort()}`;
    const refused = await isocan("home", nowhere);
    expect(refused.code).toBe(1);
    expect(refused.stderr).toContain("refuses every write");
    expect(refused.stderr).toContain("--force");
    expect(await configuredHome()).toBeUndefined();

    // …and the escape is honest: --force means what it says, and still warns.
    const forced = await isocan("home", nowhere, "--force");
    expect(forced.code, forced.stderr).toBe(0);
    expect(forced.stdout).toContain("did not answer");
    expect(await configuredHome()).toBe(nowhere);
  }, 30_000);
});

describe("isocan home --clear", () => {
  it("makes the daemon a home again", async () => {
    await isocan("home", homeBase);
    expect((await json("status")).home).toBe(homeBase);

    const cleared = await json("home", "--clear");
    expect(cleared.role).toBe("home");
    expect(cleared.home).toBeNull();
    expect(await configuredHome()).toBeUndefined();
    expect((await json("status")).home).toBeUndefined();
  }, 30_000);

  it("is a no-op on a daemon that was never a replica", async () => {
    await isocan("serve");
    const cleared = await json("home", "--clear");
    expect(cleared.restarted).toBe(false);
  }, 30_000);

  it("cannot be combined with an address", async () => {
    const run = await isocan("home", homeBase, "--clear");
    expect(run.code).toBe(1);
    expect(run.stderr).toContain("not both");
  }, 30_000);
});

describe("what a configured home puts in the marker", () => {
  it("`isocan use` records the address, the way birth does", async () => {
    // Found walking this phase's own outcome: `bindFresh` and the session
    // handshake both write `home` into the marker, and binding BY HAND was the
    // one path that did not — so a committed marker promised "wherever the
    // daemon reading this lives" for a canvas that demonstrably lives
    // somewhere (offline-birth.md, "birth writes a promise").
    await isocan("home", homeBase);
    const session = { ISOCAN_SESSION_ID: "s-use" };
    const named = await isocanWith(session, "identity", "--session");
    expect(named.code, named.stderr).toBe(0);
    const made = await isocanWith(session, "project", "create", "Acme Sprint Board");
    expect(made.code, made.stderr).toBe(0);

    // The write forwarded, so the canvas exists AT THE HOME first and arrives
    // back here when the replica's next poll discovers it (`HomeLink.sync`).
    // Waiting for it is the honest shape of the test — `use` resolves against
    // the local list, like every other command.
    const deadline = Date.now() + 15_000;
    for (;;) {
      const here = (await isocan("project", "list", "--all", "--json")).stdout;
      if (here.includes("Acme Sprint Board")) break;
      if (Date.now() > deadline) throw new Error(`the canvas never replicated back: ${here}`);
      await new Promise((r) => setTimeout(r, 200));
    }

    // A directory with no marker of its own, bound BY HAND — the path that
    // used to write the id and forget the address.
    const elsewhere = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-home-verb-use-"));
    try {
      const bound = await isocanIn(elsewhere, session, "use", "Acme");
      expect(bound.code, bound.stderr).toBe(0);
      const marker = JSON.parse(
        await fs.readFile(path.join(elsewhere, ".isocan", "project.json"), "utf8"),
      ) as Record<string, unknown>;
      expect(marker).toMatchObject({ title: "Acme Sprint Board", home: homeBase });
    } finally {
      await fs.rm(elsewhere, { recursive: true, force: true });
    }
  }, 30_000);
});

describe("setup finishes the walk", () => {
  it("hands over the canvas's address AT THE HOME, not a marker file to read", async () => {
    await isocan("home", homeBase);
    await isocanWith({ ISOCAN_SESSION_ID: "s-setup" }, "identity", "--session");
    const [born] = await upstream.engine.listProjects();

    const report = await json("setup", "--no-install", "--no-open");
    expect(report.canvas).toBe(`${homeBase}/p/${born!.id}`);
    expect(report.app).toContain(`replica of ${homeBase}`);
  }, 30_000);

  it("still makes no canvas — it says what would, instead", async () => {
    // The decision that stands: setup has no identity of its own, so a canvas
    // made here would be stamped with whoever typed the command. Only the
    // REPORT changed.
    await isocan("home", homeBase);
    const report = await json("setup", "--no-install", "--no-open");
    expect(report.canvas).toContain("none in this directory yet");
    expect(await upstream.engine.listProjects()).toEqual([]);
  }, 30_000);
});

describe("the environment still wins, and is said so out loud", () => {
  it("refuses to write a file ISOCAN_HOME_URL would override", async () => {
    // `resolveHomeUrl` reads the variable first and `ensureDaemon` hands the
    // daemon this process's environment — so the write would change nothing
    // and the restart would bring the daemon back on the variable's address.
    // Quietly. That is the one outcome this verb must never produce.
    const run = await isocanWith(
      { ISOCAN_HOME_URL: "https://elsewhere.invalid" },
      "home",
      homeBase,
    );
    expect(run.code).toBe(1);
    expect(run.stderr).toContain("unset ISOCAN_HOME_URL");
    expect(await configuredHome()).toBeUndefined();
  }, 30_000);
});
