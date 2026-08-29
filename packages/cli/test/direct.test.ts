import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Canvas } from "@isocan/core";
import { startDaemon, stopDaemons, type Daemon } from "@isocan/server";
import { mintTestBadge, type TestBadge } from "./badge.ts";

/**
 * **Direct mode: a machine with no daemon of its own** (phase 11, Scene 6).
 *
 * The scene is an agent in an empty ephemeral directory working the canvas
 * with no replica and nothing to lose. What stands in for the cloud workspace
 * here is a scratch `ISOCAN_HOME` that has never held anything, pointed at a
 * daemon started by the test — which IS a home, because a home is an ordinary
 * daemon at a different address. That substitution is the whole reason the
 * scene can be proved without a cloud: the CLI cannot tell the difference, and
 * if it ever could, that would itself be the bug.
 *
 * The assertion that matters most is the negative one — **no daemon is ever
 * started on the direct machine**. A test that only checked commands succeed
 * would pass just as well if `ensureDaemon` quietly spawned one and everything
 * worked through a replica, which is the exact failure this mode exists to
 * prevent.
 */

const cliBin = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));

/** The home: a real daemon, at an address that is not this machine's. */
let homeDaemon: Daemon;
let homeStore: string;
let homePort: number;
let homeUrl: string;
/** For the raw pokes at the home: seeding a canvas, reading the roster. The
 * CLI gets its own badge at the door, which is what these tests assert stays
 * invisible. */
let badge: TestBadge;

/** The direct machine: a scratch `~/.isocan` that must stay empty of a store,
 * and a working directory that has never seen a canvas. */
let machine: string;
let work: string;

beforeEach(async () => {
  homeStore = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-direct-home-"));
  machine = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-direct-machine-"));
  work = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-direct-work-"));
  homeDaemon = await startDaemon({ port: 0, home: homeStore });
  const address = homeDaemon.app.server.address();
  homePort = typeof address === "object" && address ? address.port : 0;
  homeUrl = `http://127.0.0.1:${homePort}`;
  badge = await mintTestBadge(homeUrl);
});

afterEach(async () => {
  await homeDaemon.close();
  await stopDaemons(homePort, homeStore).catch(() => {});
  // Whatever a test may have started on the direct machine, so a leak fails
  // the next test rather than this one.
  await stopDaemons(DIRECT_PORT, machine).catch(() => {});
  for (const dir of [homeStore, machine, work]) {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

/**
 * A port the direct machine would use if it ever started a daemon — chosen so
 * it cannot collide with the home's, and never bound by anything in this file.
 * The point is that nothing ever answers here.
 */
const DIRECT_PORT = 4497;

function isocan(
  args: string[],
  env: Record<string, string> = {},
): Promise<{ code: number; stdout: string; stderr: string }> {
  const child = spawn(process.execPath, [cliBin, ...args], {
    cwd: work,
    env: {
      ...process.env,
      ISOCAN_HOME: machine,
      ISOCAN_PORT: String(DIRECT_PORT),
      // Scene 6's agent claims its own actor against its harness session id,
      // which is also what lets a non-TTY process have an identity at all.
      CLAUDE_CODE_SESSION_ID: "sonia-1",
      // Inherited `CI=true` on a CI runner would make the guess fire in tests
      // that are asserting what happens when nobody has declared. Every test
      // that wants the guess sets it back on for itself.
      CI: "",
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => (stdout += chunk));
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => (stderr += chunk));
  return new Promise((resolve) =>
    child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr })),
  );
}

/** Did anything come up on the direct machine's port? The negative assertion
 * this whole file is built around. */
async function daemonStarted(): Promise<boolean> {
  const res = await fetch(`http://127.0.0.1:${DIRECT_PORT}/healthz`, {
    signal: AbortSignal.timeout(500),
  }).catch(() => null);
  return res?.ok ?? false;
}

/** A store on disk is the other half of "no replica" — `canvases/` is where a
 * daemon puts one, and on a direct machine it must never appear. */
async function hasStore(): Promise<boolean> {
  return fs
    .readdir(path.join(machine, "canvases"))
    .then((entries) => entries.length > 0)
    .catch(() => false);
}

describe("declaring the mode", () => {
  it("ISOCAN_DIRECT=<url> works the canvas with no daemon and no replica", async () => {
    // `--name` without `--session`: naming the agent, not binding the
    // directory. `identity --session` in a fresh directory would CREATE a
    // canvas, and this test is about the one it makes on purpose.
    const named = await isocan(["identity", "--name", "Sonia"], { ISOCAN_DIRECT: homeUrl });
    expect(named.code, named.stderr).toBe(0);

    const made = await isocan(["canvas", "create", "Acme redesign", "--json"], {
      ISOCAN_DIRECT: homeUrl,
    });
    expect(made.code, made.stderr).toBe(0);

    // `--all`, because `canvas list` scopes to the directory's own canvas —
    // and naming the agent bound this directory to one of its own.
    const listed = await isocan(["canvas", "list", "--all", "--json"], {
      ISOCAN_DIRECT: homeUrl,
    });
    expect(listed.code, listed.stderr).toBe(0);
    expect(listed.stdout).toContain("Acme redesign");

    // The canvas is really at the home, not in some local store the CLI made.
    const atHome = (await fetch(`${homeUrl}/api/projects`, { headers: badge.headers }).then((r) =>
      r.json(),
    )) as Canvas[];
    expect(atHome.map((canvas) => canvas.title)).toContain("Acme redesign");

    expect(await daemonStarted()).toBe(false);
    expect(await hasStore()).toBe(false);
  });

  it("ISOCAN_DIRECT=1 takes the address from the directory's marker", async () => {
    // What a cloned repo carries: the committed marker naming the canvas and
    // the home, which is the whole of how Scene 6's workspace knows where to
    // go with nothing but a variable set.
    const seeder = { id: "usr_priya", name: "Priya" };
    await badge.speakAs(seeder);
    const seeded = await fetch(`${homeUrl}/api/ops`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...badge.headers },
      body: JSON.stringify({
        canvasId: null,
        actor: seeder,
        op: { type: "project.create", canvasId: "prj_acme", title: "Acme redesign" },
      }),
    });
    expect(seeded.ok, await seeded.clone().text()).toBe(true);
    await fs.mkdir(path.join(work, ".isocan"), { recursive: true });
    await fs.writeFile(
      path.join(work, ".isocan", "project.json"),
      JSON.stringify({ projectId: "prj_acme", home: homeUrl }),
    );

    const listed = await isocan(["canvas", "list", "--json"], { ISOCAN_DIRECT: "1" });
    expect(listed.code, listed.stderr).toBe(0);
    expect(listed.stdout).toContain("Acme redesign");
    expect(await daemonStarted()).toBe(false);
  });

  it("refuses when direct is on and nothing says which home", async () => {
    const listed = await isocan(["canvas", "list"], { ISOCAN_DIRECT: "1" });
    expect(listed.code).not.toBe(0);
    // Names all three places it looked, so the fix is readable off the
    // refusal rather than guessable.
    expect(listed.stderr).toContain("ISOCAN_DIRECT");
    expect(listed.stderr).toMatch(/config\.json/);
    expect(listed.stderr).toContain("project.json");
    // And above all: it did NOT quietly fall back to a daemon.
    expect(await daemonStarted()).toBe(false);
  });

  it("ISOCAN_DIRECT=0 puts a configured machine back on its daemon for one shell", async () => {
    await fs.writeFile(
      path.join(machine, "config.json"),
      JSON.stringify({ direct: homeUrl }),
    );
    const shown = await isocan(["direct", "--json"], { ISOCAN_DIRECT: "0" });
    expect(shown.code, shown.stderr).toBe(0);
    expect(JSON.parse(shown.stdout).mode).toBe("daemon");
  });
});

describe("files, with nowhere to keep them", () => {
  /**
   * **The half of direct mode that was a hypothesis until it was driven.**
   *
   * "Blobs already travel over HTTP" was read off the code — `paths.canvasesDir`
   * having one caller — and reading is not proving. An agent's whole job is
   * files: `add` uploads bytes, `get` writes them back to disk, `edit` stacks a
   * version. Without a local store every one of those crosses the network, and
   * a break in any of them would make Scene 6's agent useless while every other
   * test in this file still passed.
   */
  it("uploads, downloads and re-versions a file with no local store", async () => {
    await isocan(["identity", "--name", "Sonia", "--session"], { ISOCAN_DIRECT: homeUrl });
    const svg = (size: number) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"></svg>`;
    await fs.writeFile(path.join(work, "card.svg"), svg(10));

    const added = await isocan(["add", "card.svg"], { ISOCAN_DIRECT: homeUrl });
    expect(added.code, added.stderr).toBe(0);

    // Down again, into a file — the bytes made a full round trip to the home
    // and back rather than being read out of a replica that does not exist.
    const got = await isocan(["get", "card.svg", "out.svg"], { ISOCAN_DIRECT: homeUrl });
    expect(got.code, got.stderr).toBe(0);
    expect(await fs.readFile(path.join(work, "out.svg"), "utf8")).toBe(svg(10));

    // And a second version stacks, which is the op an agent's rebuild sends.
    await fs.writeFile(path.join(work, "card.svg"), svg(20));
    const edited = await isocan(["edit", "card.svg", "card.svg"], { ISOCAN_DIRECT: homeUrl });
    expect(edited.code, edited.stderr).toBe(0);
    expect(edited.stdout).toContain("2 total");

    expect(await hasStore()).toBe(false);
    expect(await daemonStarted()).toBe(false);
  });
});

describe("the daemon verbs", () => {
  for (const verb of ["serve", "restart", "stop"]) {
    it(`\`isocan ${verb}\` refuses on a direct machine, and starts nothing`, async () => {
      const out = await isocan([verb], { ISOCAN_DIRECT: homeUrl });
      expect(out.code).not.toBe(0);
      expect(out.stderr).toContain("this machine is direct");
      // The refusal names the way back, because every refusal here does.
      expect(out.stderr).toContain("isocan direct --clear");
      expect(await daemonStarted()).toBe(false);
    });
  }

  it("`isocan home` refuses — there is no birth default to hold", async () => {
    const out = await isocan(["home", homeUrl], { ISOCAN_DIRECT: homeUrl });
    expect(out.code).not.toBe(0);
    expect(out.stderr).toContain("no birth default");
  });

  it("`isocan status` describes the home instead of reporting a missing daemon", async () => {
    const out = await isocan(["status"], { ISOCAN_DIRECT: homeUrl });
    expect(out.code, out.stderr).toBe(0);
    expect(out.stdout).toContain("direct");
    expect(out.stdout).toContain(homeUrl);
    // The sentence a broken machine gives must not be the sentence a working
    // direct machine gives.
    expect(out.stdout).not.toContain("not running");
  });
});

describe("isocan direct", () => {
  it("sets, shows and clears the mode", async () => {
    const set = await isocan(["direct", homeUrl]);
    expect(set.code, set.stderr).toBe(0);
    expect(JSON.parse(await fs.readFile(path.join(machine, "config.json"), "utf8")).direct).toBe(
      homeUrl,
    );

    const shown = await isocan(["direct", "--json"]);
    expect(JSON.parse(shown.stdout)).toMatchObject({ mode: "direct", direct: homeUrl });

    const cleared = await isocan(["direct", "--clear"]);
    expect(cleared.code, cleared.stderr).toBe(0);
    const after = JSON.parse(await fs.readFile(path.join(machine, "config.json"), "utf8"));
    expect(after.direct).toBeUndefined();
  });

  it("refuses an address that does not answer — there is no replica to fall back on", async () => {
    // Deliberately different from `isocan home`, which warns and continues: a
    // bad birth default costs you the next canvas, a bad direct address costs
    // you every command.
    const out = await isocan(["direct", "http://127.0.0.1:9"]);
    expect(out.code).not.toBe(0);
    expect(out.stderr).toContain("no local");
    const config = await fs.readFile(path.join(machine, "config.json"), "utf8").catch(() => "{}");
    expect(JSON.parse(config).direct).toBeUndefined();
  });

  it("refuses to write the file when the environment would win over it", async () => {
    const out = await isocan(["direct", homeUrl], { ISOCAN_DIRECT: "0" });
    expect(out.code).not.toBe(0);
    expect(out.stderr).toContain("wins over the config file");
  });
});

describe("the guess", () => {
  it("does not fire on a laptop: nobody said anything, so the daemon is the default", async () => {
    // No CI variable, no flag, no config — and critically an ARRIVAL, so the
    // only reason this stays on a daemon is the default itself.
    const shown = await isocan(["direct", "--json"]);
    expect(JSON.parse(shown.stdout).mode).toBe("daemon");
  });

  it("does not fire on CI alone without an address to go to", async () => {
    // `CI` says disposable; it does not say where. A machine with nowhere to
    // speak to must never be guessed into having no daemon.
    const shown = await isocan(["direct", "--json"], { CI: "true" });
    expect(JSON.parse(shown.stdout).mode).toBe("daemon");
  });

  it("`CI=false` is a no, not a yes", async () => {
    const shown = await isocan(["direct", "--json"], { CI: "false" });
    expect(JSON.parse(shown.stdout).mode).toBe("daemon");
  });
});
