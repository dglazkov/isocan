import { afterEach, beforeEach } from "vitest";
import { promises as fs } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startDaemon, stopDaemons, type Daemon } from "@isocan/server";
import { harnessVars } from "@isocan/api";
import { rcAgentsFile, type RcAgentRow } from "../src/rc.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

/**
 * **One machine, for the files that test `isocan rc`** — a scratch
 * `ISOCAN_HOME`, a daemon on an ephemeral port, a badge speaking as Dimitri
 * and one canvas, plus the helpers every rc test spawns the CLI through.
 *
 * It lives in its own module because `rc.test.ts` used to be one file of
 * forty-two tests, every one of them starting a daemon and several
 * processes, and vitest runs a FILE's tests one after another: 90 s on a
 * laptop and up to 126 s on CI, the slowest file in the suite by a wide
 * margin, all of it on one core while the others idled. Splitting it gives
 * the runner something to overlap; nothing here weakens, because each test
 * always had its own home and daemon and never saw another's.
 *
 * `home`, `daemon`, `base` and `badge` are exported `let`s written by the
 * hooks `useRcHome()` installs. ESM live bindings mean an importer reads
 * the current run's values without a ceremony of getters — the same names,
 * in the same shapes, as when this was one file.
 */

const cliBin = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));
export const nico = { id: "usr_nico", name: "Nico" };
export const dimitri = { id: "usr_dimitri", name: "Dimitri" };

/**
 * **A team's agent, said out loud** (owner-only summons, 11 Sep 2026). The
 * summonses in these files come from Dimitri at the test badge, and the rc is
 * Nico's — so an agent enrolled with nothing said answers Nico alone. Where a
 * test is about something other than consent, its agent is opened to everyone
 * explicitly; `dispatch.test.ts` pins what the default does.
 */
export const TEAM = ["--listen", "everyone"];

export let home: string;
export let daemon: Daemon;
export let base: string;
export let badge: TestBadge;

/** Install the hooks. Called once at the top level of each rc test file. */
export function useRcHome(): void {
  beforeEach(async () => {
    home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-rc-"));
    await fs.writeFile(
      path.join(home, "identity.json"),
      JSON.stringify({ ...nico, createdAt: new Date().toISOString() }),
    );
    // Phase 4: a summons DISPATCHES now. The scripted adapter answers for
    // every harness this suite enrols, so no test can reach for a real one.
    const fakeAcp = fileURLToPath(new URL("./fake-acp.mjs", import.meta.url));
    await fs.writeFile(
      path.join(home, "config.json"),
      // …and named as the default outright: a web add's row says null, which
      // means the machine's default, and the runner's PATH must not vote.
      JSON.stringify({ adapterEnv: ["FAKE_ACP_*"], acpAdapters: { "claude-code": [process.execPath, fakeAcp] }, defaultHarness: "claude-code" }),
    );
    daemon = await startDaemon({ port: 0, home });
    const address = daemon.app.server.address();
    base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
    badge = await mintTestBadge(base);
    await badge.speakAs(dimitri);
    await post("/api/ops", {
      canvasId: null,
      actor: dimitri,
      op: { type: "project.create", canvasId: "prj_1", title: "P" },
    });
  });

  afterEach(async () => {
    /**
     * **Reap first, then remove.** A test that reached its own `rc.kill` has
     * nothing here; a test that did not leaves a parked process, and removing
     * its home underneath it leaves the process running with a deleted working
     * directory — quieter than the `ENOTEMPTY` it used to cause, and worse,
     * because the noise WAS the signal that something was still alive.
     *
     * `SIGKILL` after a grace period, not just `SIGINT`: an rc mid-turn is
     * exactly the case that ignores a polite ask, and a teardown that waits
     * forever is a hang rather than a failure.
     *
     * **And then WAIT for it to be gone** (9 Sep 2026). Sending a signal is not
     * tearing down; observing the exit is. The first version fired `SIGKILL` and
     * returned, so the next test's `beforeEach` could raise a daemon while the
     * last test's rc was still in the process table — and an rc that outlives
     * its daemon by a few milliseconds reconnects to whatever is on that port
     * next and registers a park. What the innocent later test then sees is
     * *"another park adopted Sian's cursor — standing down for it"*, which is
     * precisely the line that reddened the release for `ce10535c` on CI, where
     * there is no previous RUN to leak from and so no other explanation.
     *
     * That is lesson #44 one step further than it went: it put every spawn on a
     * list the teardown drains, and draining meant asking rather than checking.
     */
    for (const child of started.splice(0)) {
      if (child.exitCode !== null || child.signalCode !== null) continue;
      const gone = new Promise<void>((resolve) => child.once("exit", () => resolve()));
      child.kill("SIGINT");
      await Promise.race([gone, new Promise<void>((resolve) => setTimeout(resolve, 2000))]);
      if (child.exitCode !== null || child.signalCode !== null) continue;
      child.kill("SIGKILL");
      // Bounded, for the teardown-that-hangs reason above — but a SIGKILL that
      // has not landed within a second is a machine in trouble, not a slow rc.
      await Promise.race([gone, new Promise<void>((resolve) => setTimeout(resolve, 1000))]);
    }
    await daemon.close();
    // And the daemon an rc started for itself, which is not the fixture's `daemon`
    // and so survives closing that one.
    await stopDaemons(Number(new URL(base).port), home).catch(() => {});
    await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });
}

/**
 * **A daemon restart, from a test's side**: this home's daemon closed and a
 * new one raised on a new port, with a fresh badge. It lives here rather
 * than in the test because `daemon`, `base` and `badge` are this module's to
 * write — an importer reads them, and an ESM import cannot be assigned to.
 */
export async function restartDaemon(): Promise<void> {
  await daemon.close();
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  badge = await mintTestBadge(base);
}

export async function post(url: string, body: unknown): Promise<any> {
  const res = await fetch(`${base}${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...badge.headers },
    body: JSON.stringify(body),
  });
  return res.json().catch(() => null);
}

/**
 * **Who a live rc holds a cursor for**, straight from the daemon — the
 * connection-bound fact `isocan who` reads to print `answerable`, and the
 * only thing that says an rc has finished taking its roster up. The start's
 * *"answering on …"* line does not: it is printed near the top of the
 * start, and the claims come several round trips after it.
 */
export async function answeringFor(canvasId = "prj_1"): Promise<string[]> {
  const res = await fetch(`${base}/api/projects/${canvasId}/rc`, { headers: badge.headers });
  return ((await res.json()) as { actorIds?: string[] }).actorIds ?? [];
}

export async function snapshotAgents(): Promise<Record<string, { actor: { id: string; name: string } }>> {
  const res = await fetch(`${base}/api/projects/prj_1/canvas`, { headers: badge.headers });
  const snapshot = (await res.json()) as { canvas: { agents?: Record<string, any> } };
  return snapshot.canvas.agents ?? {};
}

export interface Run {
  code: number;
  stdout: string;
  stderr: string;
}

/**
 * **Everything the rc tests have started that is still alive.**
 *
 * Every test here kills its own `rc` on its last line, and that is enough
 * right up until a test fails or times out before reaching it — at which point
 * a parked rc outlives the run, and the NEXT run's rc finds it holding the
 * cursor: *"another park adopted Sian's cursor — standing down for it."* The
 * failure lands on a later, innocent test, which is why it reads as the suite
 * being unreliable rather than as one thing.
 *
 * Two of these were found alive on 8 Sep 2026, from runs 37 minutes apart,
 * with an `rc` and a `serve` each — `ps` and `lsof` said their working
 * directories were `/T/isocan-rc-*`, so they were nobody's but the rc tests'.
 */
export const started: ChildProcess[] = [];

export function spawnCli(args: string[], extraEnv: Record<string, string> = {}): ChildProcess {
  // The runner's own harness variables must not leak in: this suite asserts
  // the same person/agent split under every harness, park.test.ts's rule.
  const env = { ...process.env };
  for (const name of harnessVars) delete env[name];
  const child = spawn(process.execPath, [cliBin, ...args], {
    env: { ...env, ISOCAN_HOME: home, ISOCAN_PORT: new URL(base).port, ...extraEnv },
    cwd: home,
    stdio: ["ignore", "pipe", "pipe"],
  });
  started.push(child);
  return child;
}

export function collect(child: ChildProcess): Promise<Run> {
  let stdout = "";
  let stderr = "";
  child.stdout!.setEncoding("utf8");
  child.stdout!.on("data", (chunk) => (stdout += chunk));
  child.stderr!.setEncoding("utf8");
  child.stderr!.on("data", (chunk) => (stderr += chunk));
  return new Promise((resolve) =>
    child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr })),
  );
}

export function isocan(...args: string[]): Promise<Run> {
  return collect(spawnCli(args));
}

/**
 * **A deadline under the test's own, and a message that says what it saw.**
 *
 * This was ten seconds flat, and `vitest.config.ts` already records what that
 * costs: *"a hard 5s line straight through the middle of the distribution —
 * so a test passed alone, passed on a fast laptop, and failed on a shared
 * runner, which is the most expensive kind of failure there is because it
 * teaches people to re-run."* Same shape, one level down. These tests start
 * an rc, an ACP adapter and a daemon; on a two-core CI box that is seconds
 * before anything is asked. "a web add gets its rc half from the parked rc"
 * failed twice on CI at 10.9s, on two unrelated commits, passing 3/3 locally
 * each time.
 *
 * Twenty seconds sits under the 30s the tests declare, so a genuinely wedged
 * wait still fails HERE — with the name of what it was waiting for — rather
 * than as vitest's anonymous timeout.
 *
 * And it says what it last saw. "timed out waiting for the adoption" tells you
 * nothing about whether the adoption half-happened; the tail does, and this is
 * the same fix `dispatch.test.ts` got for the same reason.
 */
export async function until<T>(fn: () => Promise<T>, ok: (value: T) => boolean, what: string): Promise<T> {
  const deadline = Date.now() + 20_000;
  let last: T | undefined;
  for (;;) {
    const value = await fn();
    last = value;
    if (ok(value)) return value;
    if (Date.now() > deadline) {
      const saw = typeof last === "string" ? last : JSON.stringify(last);
      throw new Error(
        `timed out waiting for ${what} after 20s. What it saw:\n${String(saw).slice(-1200)}`,
      );
    }
    await new Promise((r) => setTimeout(r, 50));
  }
}

export async function rcRows(): Promise<RcAgentRow[]> {
  try {
    return JSON.parse(await fs.readFile(rcAgentsFile(home), "utf8")) as RcAgentRow[];
  } catch {
    return [];
  }
}
