import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stopDaemons } from "@isocan/server";
import { harnessVars } from "../src/harness.ts";
import { reservePort } from "../../../test/ports.ts";

/**
 * **A park has to survive its daemon.**
 *
 * `isocan wait` is a long-poll against the LOCAL daemon — always, even for a
 * canvas whose home is elsewhere, because the CLI's one address is
 * `127.0.0.1`. So anything that restarts that daemon severs the connection
 * under a parked agent: `isocan restart`, an upgrade, a laptop waking.
 *
 * It used to be fatal. The fetch rejected, the command exited 1 with
 * `error: fetch failed`, and an agent that had done nothing wrong dropped out
 * of a session it was holding — reported from a real one: a developer
 * restarting a daemon all afternoon knocked every parked agent off, and one
 * wrote its own retry loop to stay reachable.
 */

const cliBin = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));

let home: string;
let work: string;
let port: number;

function cli(args: string[]): ReturnType<typeof spawn> {
  // A session of this test's own, and none of the ambient ones.
  //
  // `identity --session` needs a session to attach to, which it reads from
  // the environment — `ISOCAN_SESSION_ID` or a known harness's variable
  // (`harness.ts`). Inheriting whatever the runner happens to export means
  // the test passes on the laptop of anybody whose terminal is inside an
  // agent harness and fails everywhere else, which is exactly how it went:
  // green here under CLAUDE_CODE_SESSION_ID, red on CI, which exports none
  // of them. So it declares its own and clears the rest.
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const name of harnessVars) delete env[name];
  return spawn(process.execPath, [cliBin, ...args], {
    cwd: work,
    env: { ...env, ISOCAN_HOME: home, ISOCAN_PORT: String(port), ISOCAN_SESSION_ID: "s-park" },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function run(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  const child = cli(args);
  let stdout = "";
  let stderr = "";
  child.stdout!.on("data", (c) => (stdout += c));
  child.stderr!.on("data", (c) => (stderr += c));
  return new Promise((resolve) =>
    child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr })),
  );
}

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-park-home-"));
  work = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-park-work-"));
  port = await reservePort();
  // A name first: `canvas create` speaks as somebody, and an unclaimed CLI
  // has nobody to be. Then a canvas for the park to watch.
  await run(["identity", "--name", "Parker", "--session"]);
  const made = await run(["canvas", "create", "Parking"]);
  expect(made.code, `could not make a canvas: ${made.stderr}`).toBe(0);
});

afterEach(async () => {
  await stopDaemons(port, home);
  await fs.rm(home, { recursive: true, force: true });
  await fs.rm(work, { recursive: true, force: true });
});

describe("parking through a daemon restart", () => {
  it("keeps the park alive and still times out on its own deadline", async () => {
    const parked = cli(["wait", "--timeout", "20"]);
    let stderr = "";
    parked.stderr!.on("data", (c) => (stderr += c));
    const finished = new Promise<number>((resolve) =>
      parked.on("close", (code) => resolve(code ?? 0)),
    );

    // WAIT for the park's connection to actually be open before pulling the
    // rug — a fixed sleep is how a test like this becomes the flaky one on a
    // loaded machine. `status` answering means the daemon is up and serving,
    // which is the earliest moment the long-poll can be established.
    for (let tries = 0; tries < 40; tries++) {
      const up = await run(["status", "--json"]);
      if (up.code === 0 && up.stdout.includes('"pid"')) break;
      await new Promise((r) => setTimeout(r, 250));
    }
    await new Promise((r) => setTimeout(r, 500));
    await run(["restart"]);

    const code = await finished;
    // Exit 2 is "timed out with nobody there", which is a park ending
    // properly. Exit 1 with `fetch failed` is the bug: an agent thrown out
    // by somebody else's restart.
    expect(stderr, "the park died on the restart instead of riding it out").not.toContain(
      "fetch failed",
    );
    expect(code, `park exited ${code}: ${stderr}`).toBe(2);
    expect(stderr).toContain("timed out");
  }, 60_000);

  it("still ends when the daemon ANSWERS with a refusal", async () => {
    // A retry loop that cannot tell "nobody is there" from "somebody said no"
    // spins forever on a real error. An unknown canvas is answered, so it
    // must end the command rather than be retried.
    const out = await run(["wait", "--timeout", "5", "--canvas", "prj_nope"]);
    expect(out.code).not.toBe(0);
    expect(out.stderr).toMatch(/no canvas|not found|unknown/i);
  }, 30_000);
});

it("brings its daemon back when nobody else will", async () => {
  /**
   * The other half of the same bug, and the one the first fix created.
   *
   * Retrying a severed connection stopped the park EXITING on a restart.
   * But if nothing else happened to run a command, nothing started the
   * daemon again — so the agent sat in a silent retry loop, looking parked
   * on the canvas and hearing nothing. That is the original failure wearing
   * a calmer face, and worse to debug: the version before it at least said
   * `error: fetch failed` out loud.
   *
   * So a park starts the daemon it lost, the way every other verb in this
   * CLI already does. This stops it and then does nothing at all — no
   * command, no restart — and the park has to be the thing that heals it.
   */
  const parked = cli(["wait", "--timeout", "25"]);
  let out = "";
  parked.stdout!.on("data", (c) => (out += c));
  parked.stderr!.on("data", (c) => (out += c));

  for (let tries = 0; tries < 40; tries++) {
    const up = await run(["status", "--json"]);
    if (up.code === 0 && up.stdout.includes('"pid"')) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  await new Promise((r) => setTimeout(r, 500));
  await run(["stop"]);

  // Nobody asks for anything. The only process with an interest in that
  // daemon is the park itself.
  let revived = false;
  for (let tries = 0; tries < 40; tries++) {
    await new Promise((r) => setTimeout(r, 250));
    const res = await fetch(`http://127.0.0.1:${port}/healthz`).catch(() => null);
    if (res?.ok) {
      revived = true;
      break;
    }
  }
  expect(revived, `the park never restarted its daemon:\n${out}`).toBe(true);

  parked.kill();
}, 60_000);
