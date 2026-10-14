import { afterEach, beforeEach, expect, it } from "vitest";
import { existsSync, promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { type Daemon } from "@isocan/server";
import { startDaemon } from "@isocan/server/daemon";
import { cliEnv, runCli, type Run } from "./cli.ts";

/**
 * **A canvas deleted at its home while this machine was away** (14 Oct 2026).
 * The replica kept its copy — a replica never forgets on its own — and every
 * `isocan inbox` opened with "prj_… unavailable: canvas not found", then
 * failed as incomplete. Now the inbox says so once, with the verb, and
 * `isocan canvas forget` lets the copy go: refused for a canvas that lives
 * here and for one its home still has, recoverable when it does go.
 */

const kit = { id: "usr_kit", name: "Kit" };
let homeDir: string;
let machineDir: string;
let work: string;
let home: Daemon;
let machine: Daemon | null = null;

const baseOf = (daemon: Daemon) => {
  const address = daemon.app.server.address();
  return `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
};
const identity = (dir: string) => fs.writeFile(path.join(dir, "identity.json"), JSON.stringify({ ...kit, createdAt: new Date().toISOString() }));
const boot = () => startDaemon({ port: 0, home: machineDir, birthHome: baseOf(home), homePollMs: 50 });

beforeEach(async () => {
  homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-forget-home-"));
  machineDir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-forget-replica-"));
  work = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-forget-work-"));
  await identity(homeDir);
  await identity(machineDir);
  home = await startDaemon({ port: 0, home: homeDir, birthHome: null });
  machine = await boot();
});

afterEach(async () => {
  await machine?.close().catch(() => {});
  machine = null;
  await home.close();
  await Promise.allSettled([homeDir, machineDir, work].map((dir) => fs.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })));
});

const on = (daemon: Daemon, dir: string, ...args: string[]): Promise<Run> =>
  runCli(args, { cwd: work, env: cliEnv({ ISOCAN_HOME: dir, ISOCAN_PORT: new URL(baseOf(daemon)).port }) });
const ok = (run: Run) => { expect(run.code, run.stderr).toBe(0); return run; };

it("says once that a canvas is gone at its home, and forgets the copy only when asked and only then", async () => {
  const replica = (...args: string[]) => on(machine!, machineDir, ...args);
  const made = ok(await replica("canvas", "create", "Acme gone"));
  const canvasId = /prj_[\w-]+/.exec(made.stdout)![0];
  ok(await replica("--canvas", canvasId, "text", "Acme note"));

  // Its home still has it: this copy is a live replica, not forgotten.
  const live = await replica("canvas", "forget", canvasId);
  expect(live.code).not.toBe(0);
  expect(live.stderr).toMatch(/still has .* not forgotten/);
  // A canvas that lives on the machine asked has nothing to forget.
  const atHome = await on(home, homeDir, "canvas", "forget", canvasId);
  expect(atHome.code).not.toBe(0);
  expect(atHome.stderr).toMatch(/lives on this machine/);

  // Deleted at its home while this machine was away.
  await machine!.close();
  machine = null;
  // The home's own soft delete, in process: the canvas is gone there and the
  // machine never heard, which is all the inbox needs to meet.
  await home.engine.forgetReplica(canvasId);
  machine = await boot();
  expect((await machine.engine.listCanvases()).map((canvas) => canvas.id)).toEqual([canvasId]);

  const first = ok(await replica("inbox"));
  expect(first.stderr).toContain(`"Acme gone" (${canvasId}) is gone at its home — \`isocan canvas forget ${canvasId}\``);
  expect(first.stderr).not.toContain("unavailable: canvas not found");
  const second = ok(await replica("inbox"));
  expect(second.stderr).not.toContain(canvasId);
  const scripted = ok(await replica("inbox", "--json"));
  expect(JSON.parse(scripted.stdout)).toEqual([]);
  expect(JSON.parse(scripted.stderr.trim().split("\n").at(-1)!).unavailable).toEqual([
    expect.objectContaining({ canvasId, gone: true, title: "Acme gone" }),
  ]);

  const forgot = ok(await replica("canvas", "forget", canvasId, "--json"));
  const { keptAt } = JSON.parse(forgot.stdout) as { keptAt: string };
  expect(existsSync(keptAt)).toBe(true);
  expect(keptAt.startsWith(path.join(machineDir, "deleted-projects"))).toBe(true);
  expect(await machine.engine.listCanvases()).toEqual([]);
  const quiet = ok(await replica("inbox"));
  expect(quiet.stderr).not.toContain(canvasId);
}, 60_000);
