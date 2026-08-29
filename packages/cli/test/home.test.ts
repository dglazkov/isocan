import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { paths, startDaemon, stopDaemons, type Daemon } from "@isocan/server";
import { reservePort } from "../../../test/ports.ts";
import { harnessVars } from "../src/harness.ts";

/**
 * **`isocan home` — the verb phase 7.5 exists for, re-scoped by phase 10.3.**
 *
 * `config.json` has had a `home` key since phase 6 and `resolveHomeUrl` has
 * always read it; nothing could write it, so reaching it meant an environment
 * variable and a text editor. What that key MEANS narrowed in phase 10.3: it
 * is the **birth default** — where a canvas born here is born — and not "the
 * home this daemon answers to", which is a per-canvas question now. What has
 * to be true of the verb:
 *
 * - setting it really sends the next canvas to that home, and the setting
 *   SURVIVES the restart — the daemon reads it once, at boot, so a write that
 *   is not followed by a restart is a write that did nothing;
 * - clearing it sends the next canvas here — and **leaves every canvas already
 *   at a home answering to that home**, which is the property that makes phase
 *   14's flip of a shipped default address safe;
 * - it reports, per canvas, who lives where;
 * - a nonsense address is refused, with the shape shown;
 * - a home that does not answer is REPORTED, not silently accepted — a canvas
 *   that lives at an unreachable home refuses every write, and nothing is
 *   queued.
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

beforeEach(async () => {
  isocanHome = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-home-verb-"));
  upstreamDir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-home-verb-up-"));
  work = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-home-verb-work-"));
  port = await reservePort();
  upstream = await startDaemon({ port: 0, home: upstreamDir, birthHome: null });
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
  it("says canvases born here stay here when nothing is configured", async () => {
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
  it("sets the birth default, and the setting outlives the restart", async () => {
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

    // The birth default really is one: the canvas this directory gets is born
    // AT THE HOME rather than here, which is the whole of what this key does.
    const named = await isocanWith({ ISOCAN_SESSION_ID: "s-home-verb" }, "identity", "--session");
    expect(named.code, named.stderr).toBe(0);
    expect((await upstream.engine.listCanvases()).length).toBe(1);
  }, 30_000);

  it("does not bounce a daemon whose birth default is already that home", async () => {
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
    const nowhere = `http://127.0.0.1:${await reservePort()}`;
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
  it("births canvases here again — and the ones already at a home still answer to it", async () => {
    /**
     * The strictly stronger assertion phase 10.3 makes available, and the one
     * that matters most: clearing the birth default used to promote a whole
     * daemon back to being a home, which meant every canvas on it started
     * being written locally. It does not any more — it only says where the
     * NEXT canvas goes — and the canvas born at the home a moment ago still
     * lives there afterwards.
     *
     * This is the same property phase 14's default-address flip rides on: a
     * shipped default cannot re-point existing work, because setting or
     * clearing one moves nothing.
     */
    await isocan("home", homeBase);
    expect((await json("status")).home).toBe(homeBase);
    const session = { ISOCAN_SESSION_ID: "s-clear" };
    const named = await isocanWith(session, "identity", "--session");
    expect(named.code, named.stderr).toBe(0);
    const [born] = await upstream.engine.listCanvases();
    expect(born).toBeTruthy();

    const cleared = await json("home", "--clear");
    expect(cleared.role).toBe("home");
    expect(cleared.home).toBeNull();
    expect(await configuredHome()).toBeUndefined();
    expect((await json("status")).home).toBeUndefined();

    // The canvas did not come home with the setting. This machine still
    // records it as living at that address, and still says so.
    const shown = (await json("home")) as { canvases: Record<string, string | null> };
    expect(shown.canvases[born!.id]).toBe(homeBase);
    const text = await isocan("home");
    expect(text.stdout).toContain(born!.id);
    expect(text.stdout).toContain(homeBase);
  }, 30_000);

  it("is a no-op on a daemon that never had a birth default", async () => {
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

describe("one daemon, both roles at once", () => {
  it("reports per canvas, and the role line says all three things", async () => {
    /**
     * **The rig phase 10.3 exists to make possible**, described by the verb
     * that used to have only two things it could say.
     *
     * One daemon, two canvases: one born at a home, one born here after the
     * birth default was cleared. Before this phase that state was
     * unreachable — a daemon was a home or a replica, and becoming one made
     * every canvas on the machine follow. The role line had two sentences and
     * neither of them is true of this machine, so it grew a third; and the
     * only honest answer to "where does my work live" is now a list.
     */
    const away = { ISOCAN_SESSION_ID: "s-mixed-away" };
    await isocan("home", homeBase);
    expect((await isocanWith(away, "identity", "--session")).code).toBe(0);
    const [there] = await upstream.engine.listCanvases();
    expect(there).toBeTruthy();

    // Cleared, so the next canvas is born right here — beside the one that
    // is not.
    await isocan("home", "--clear");
    const localDir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-home-verb-local-"));
    try {
      const here = { ISOCAN_SESSION_ID: "s-mixed-here" };
      const made = await isocanIn(localDir, here, "identity", "--session");
      expect(made.code, made.stderr).toBe(0);
      const marker = JSON.parse(
        await fs.readFile(path.join(localDir, ".isocan", "project.json"), "utf8"),
      ) as { projectId: string; home?: string }; // on-disk spelling: holdout
      // Born here means born here: no address in the marker at all, which is
      // the same file Dion's rig has always written.
      expect(marker.home).toBeUndefined();

      const shown = (await json("home")) as { canvases: Record<string, string | null> };
      expect(shown.canvases[there!.id]).toBe(homeBase);
      expect(shown.canvases[marker.projectId]).toBeNull();

      // And the sentence, in both places that say it. "Home of 1 canvas" and
      // "replica of <home> (1)" in one line is the thing that could not be
      // said before.
      const role = ((await json("status")) as { role: string }).role;
      expect(role).toContain("home of 1 canvas");
      expect(role).toContain(`replica of ${homeBase} (1)`);
      const text = await isocan("home");
      expect(text.stdout).toContain("here — this daemon is its home");
      expect(text.stdout).toContain(homeBase);

      /**
       * **The address, per canvas — the assertion the phase's worst bug would
       * fail.**
       *
       * `isocan share` prints the string a person pastes to another person.
       * On this machine two canvases have two different doors, and a
       * daemon-wide value would put one of them on the wrong one: a stranger
       * sent to a home that has never heard of that canvas, or — worse — to
       * `127.0.0.1` on a laptop that is not theirs. Both directions are
       * checked, because getting it right in one and wrong in the other is
       * exactly what a single shared value does.
       */
      const remote = JSON.parse(
        (await isocanWith(away, "share", "--json")).stdout,
      ) as { address: string };
      expect(remote.address).toBe(`${homeBase}/p/${there!.id}`);
      const local = JSON.parse(
        (await isocanIn(localDir, here, "share", "--json")).stdout,
      ) as { address: string };
      expect(local.address).toBe(`http://127.0.0.1:${port}/p/${marker.projectId}`);
    } finally {
      await fs.rm(localDir, { recursive: true, force: true });
    }
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
    const made = await isocanWith(session, "canvas", "create", "Acme Sprint Board");
    expect(made.code, made.stderr).toBe(0);

    // The write forwarded, so the canvas exists AT THE HOME first and arrives
    // back here when the replica's next poll discovers it (`HomeLink.sync`).
    // Waiting for it is the honest shape of the test — `use` resolves against
    // the local list, like every other command.
    const deadline = Date.now() + 15_000;
    for (;;) {
      const here = (await isocan("canvas", "list", "--all", "--json")).stdout;
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
    const [born] = await upstream.engine.listCanvases();

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
    expect(await upstream.engine.listCanvases()).toEqual([]);
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
