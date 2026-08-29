import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildStamp, startDaemon, stopDaemons, type Daemon } from "@isocan/server";
import { harnessVars } from "../src/harness.ts";

/**
 * **Auto-upgrade phase 2, end to end: a CLI that has fallen behind its home
 * says so, once.** Journey Scene 0.
 *
 * The rig is phase 1's, and phase 1 is what made it possible: a build reports
 * its own commit from `ISOCAN_BUILD_SHA`, so "a copy that disagrees with its
 * home" is an ordinary fixture rather than something needing two machines. It
 * is set BEFORE anything calls `buildStamp()` — the stamp is computed once and
 * cached for the life of a process — and the first test below asserts that it
 * took, so a cache warmed by an earlier import fails loudly instead of quietly
 * turning every case here into "no verdict, which is also what we expect".
 */
const MINE = "aaaaaaa";
const MINE_BUILT_AT = "2026-08-12T09:00:00.000Z";
process.env.ISOCAN_BUILD_SHA = MINE;
process.env.ISOCAN_BUILD_DATE = MINE_BUILT_AT;

const cliBin = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));

/**
 * **The home is a stub, not a daemon, and that is the point.**
 *
 * What is under test is the one question the daemon asks a home — "which build
 * are you" — and a stub can answer it differently on the next request, which
 * is the beat a real second daemon cannot play: `buildStamp()` caches, so a
 * daemon's sha is fixed for the life of its process, and "the home moved"
 * would be unreachable. It answers only the health routes; every other request
 * gets a 404, which also proves the probe is independent of the badge — a
 * replica whose badge has been swept is exactly the machine most likely to be
 * behind.
 */
let homeCommit: unknown = "bbbbbbb";
let homeBuiltAt: unknown = "2026-08-25T09:00:00.000Z";
let fakeHome: http.Server;
let homeBase: string;

let isocanHome: string;
let work: string;
let port: number;
let daemon: Daemon;

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
  isocanHome = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-upgrade-"));
  work = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-upgrade-work-"));
  homeCommit = "bbbbbbb";
  homeBuiltAt = "2026-08-25T09:00:00.000Z";
  fakeHome = http.createServer((req, res) => {
    const pathname = (req.url ?? "/").split("?")[0];
    if (pathname === "/healthz" || pathname === "/api/healthz") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          ok: true,
          pid: 1,
          startedAt: "2026-08-25T09:30:00.000Z",
          version: "0.1.0",
          root: "/app",
          codeAt: "2026-08-25T09:00:00.000Z",
          commit: homeCommit,
          builtAt: homeBuiltAt,
        }),
      );
      return;
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "this stub only answers health" }));
  });
  await new Promise<void>((resolve) => fakeHome.listen(0, "127.0.0.1", resolve));
  const address = fakeHome.address() as net.AddressInfo;
  homeBase = `http://127.0.0.1:${address.port}`;

  port = await freePort();
  // Started HERE rather than by the CLI, so the probe interval is a knob this
  // test can turn down: the real one is an hour, and "the home moved under a
  // running daemon" is a beat no test can wait out.
  daemon = await startDaemon({
    port,
    home: isocanHome,
    birthHome: homeBase,
    homePollMs: 50,
    homeProbeMs: 25,
  });
});

/**
 * **Teardown must not throw over the top of setup's error.**
 *
 * `beforeEach` here starts a real daemon, and when it fails — a port taken, a
 * hook that ran out of its 30 seconds under a loaded suite — `daemon` is never
 * assigned. An unguarded `daemon.close()` then throws a TypeError of its own,
 * and vitest reports BOTH: the real cause and this one. The real cause is the
 * first of the two, which is exactly the one a `tail` of a CI log cuts off.
 *
 * So every handle here is optional-chained. This fixes no flake; it is what
 * makes the next one legible instead of reading as "cannot read properties of
 * undefined", which describes the cleanup and not the failure.
 */
afterEach(async () => {
  await daemon?.close().catch(() => {});
  await stopDaemons(port, isocanHome).catch(() => {});
  if (fakeHome) await new Promise<void>((resolve) => fakeHome.close(() => resolve()));
  await Promise.allSettled([isocanHome, work].map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

interface Run {
  code: number;
  stdout: string;
  stderr: string;
}

function isocan(...args: string[]): Promise<Run> {
  const env: NodeJS.ProcessEnv = { ...process.env, ISOCAN_HOME: isocanHome, ISOCAN_PORT: String(port) };
  for (const v of harnessVars) delete env[v];
  const child = spawn(process.execPath, [cliBin, ...args], { cwd: work, env, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (c) => (stdout += c));
  child.stderr.on("data", (c) => (stderr += c));
  return new Promise((resolve) => child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr })));
}

/** The daemon's own health body — where the verdict rides. */
async function health(): Promise<Record<string, unknown>> {
  const res = await fetch(`http://127.0.0.1:${port}/healthz`);
  return (await res.json()) as Record<string, unknown>;
}

/**
 * Wait for the daemon to have ASKED. The probe is background work by design —
 * never in front of a command — so a test that read the health body once would
 * be racing the boot, and a race that usually wins is the worst kind.
 */
async function settled(want: (body: Record<string, unknown>) => boolean): Promise<Record<string, unknown>> {
  for (let i = 0; i < 400; i++) {
    const body = await health().catch(() => null);
    if (body && want(body)) return body;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("the daemon never reached the state this test waited for");
}

/** The one line the notice prints, if it printed one. */
function notices(run: Run): string[] {
  return run.stderr.split("\n").filter((line) => line.startsWith("note:"));
}

/** A read that builds a `Ctx` — which is where the notice is produced, and so
 * where every ordinary command produces it. `status` and `home` deliberately
 * do not build one, which is why neither is used to drive this. */
const read = () => isocan("canvas", "list", "--all");

describe("a CLI that has fallen behind its home", () => {
  it("was given a build to disagree from — the rig itself", () => {
    expect(buildStamp().commit).toBe(MINE);
  });

  it("prints the notice once, names both builds, and is silent after", async () => {
    await settled((body) => Boolean(body.upgrade));

    const first = await read();
    expect(first.code, first.stderr).toBe(0);
    expect(notices(first)).toHaveLength(1);
    // Both builds, both dates, and the home — the line states facts and names
    // a command; it does not tell anybody to act.
    expect(first.stderr).toContain(`this copy is ${MINE} (2026-08-12)`);
    expect(first.stderr).toContain(`your home ${homeBase} runs bbbbbbb (2026-08-25)`);
    expect(first.stderr).toContain("`isocan upgrade` catches up");

    // An agent runs thirty commands, and thirty notices would get ignored.
    const second = await read();
    expect(second.code, second.stderr).toBe(0);
    expect(notices(second)).toHaveLength(0);
  });

  it("carries the whole verdict on `status --json`, before and after the notice", async () => {
    await settled((body) => Boolean(body.upgrade));
    const shape = {
      available: true,
      direction: "behind",
      home: homeBase,
      homeCommit: "bbbbbbb",
      homeBuiltAt: "2026-08-25T09:00:00.000Z",
      mine: MINE,
      mineBuiltAt: MINE_BUILT_AT,
    };

    const before = await isocan("status", "--json");
    expect(JSON.parse(before.stdout).upgrade).toMatchObject(shape);

    await read();

    // The `--json` field is the form an agent acts on, so it is NOT once per
    // verdict: it is the state, and it is still true after the line was said.
    const after = await isocan("status", "--json");
    expect(JSON.parse(after.stdout).upgrade).toMatchObject(shape);
  });

  it("says it again, once, when the home moves under the same daemon", async () => {
    await settled((body) => Boolean(body.upgrade));
    const first = await read();
    expect(notices(first)).toHaveLength(1);

    // A daemon lives for days while its home moves about twice a day. A marker
    // keyed on the daemon would report the first skew and stay silent for
    // every later one; this one is keyed on the pair of shas.
    homeCommit = "ccccccc";
    homeBuiltAt = "2026-08-27T09:00:00.000Z";
    await settled((body) => (body.upgrade as { homeCommit?: string })?.homeCommit === "ccccccc");

    const second = await read();
    expect(notices(second)).toHaveLength(1);
    expect(second.stderr).toContain("runs ccccccc (2026-08-27)");
    const third = await read();
    expect(notices(third)).toHaveLength(0);
  });
});

describe("an oracle that cannot answer produces no verdict", () => {
  it("is silent about a home too old to name its own commit", async () => {
    // Today's production image, and every image built before phase 1: the
    // field is there and it is null. The assertion is the ABSENCE of a
    // verdict, not the wording of one — "you are current" would be the false
    // success this whole project is built on top of.
    homeCommit = null;
    await settled((body) => body.upgrade === undefined && body.commit === MINE);
    const run = await read();
    expect(run.code, run.stderr).toBe(0);
    expect(notices(run)).toHaveLength(0);
    expect(await health()).not.toHaveProperty("upgrade");
  });

  it("is silent about a word arriving where a sha belongs", async () => {
    // The Dockerfile's default. A home reporting `unknown` is a home that
    // cannot say, and re-gating at this end is what stops the word being
    // printed at a person as an identity.
    homeCommit = "unknown";
    await settled((body) => body.upgrade === undefined && body.commit === MINE);
    expect(await health()).not.toHaveProperty("upgrade");
  });

  it("is silent, and answers commands normally, when the home has gone", async () => {
    await settled((body) => Boolean(body.upgrade));
    await new Promise<void>((resolve) => fakeHome.close(() => resolve()));

    // The last good answer is dropped rather than kept: a verdict is a
    // statement about now, and a cached one would go on asserting a comparison
    // nobody re-made.
    await settled((body) => body.upgrade === undefined);
    const run = await read();
    expect(run.code, run.stderr).toBe(0);
    expect(notices(run)).toHaveLength(0);
  });
});
