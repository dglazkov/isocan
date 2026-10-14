import { afterEach, beforeEach, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { type Daemon } from "@isocan/server";
import { startDaemon } from "@isocan/server/daemon";
import { markerFile } from "@isocan/server";
import { cliEnv, runCli, type Run } from "./cli.ts";

/**
 * **`isocan design workflow` on a canvas this machine holds as a replica**
 * (14 Oct 2026). A replica that has never held a canvas is started by the
 * home's SNAPSHOT (`ws.ts`: no cursor, no tail), so its own log begins after
 * the snapshot's `lastSeq` — and the review reader, which refuses to count a
 * repair budget from incomplete history, said "Canonical review history is
 * incomplete at sequence 1" on every such canvas. The complete history is the
 * home's, and it is read there; a home whose history really has a hole is
 * still refused (`design-review-reader.ts`).
 */

const kit = { id: "usr_kit", name: "Kit" };
let homeDir: string;
let firstDir: string;
let machineDir: string;
let firstWork: string;
let work: string;
let home: Daemon;
let first: Daemon;
let machine: Daemon | null = null;

const baseOf = (daemon: Daemon) => {
  const address = daemon.app.server.address();
  return `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
};

beforeEach(async () => {
  homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-review-home-"));
  firstDir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-review-first-"));
  machineDir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-review-replica-"));
  firstWork = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-review-work-a-"));
  work = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-review-work-b-"));
  home = await startDaemon({ port: 0, home: homeDir, birthHome: null });
  first = await boot(firstDir);
});

async function boot(dir: string): Promise<Daemon> {
  await fs.writeFile(path.join(dir, "identity.json"), JSON.stringify({ ...kit, createdAt: new Date().toISOString() }));
  return startDaemon({ port: 0, home: dir, birthHome: baseOf(home), homePollMs: 50 });
}

afterEach(async () => {
  await Promise.allSettled([machine?.close(), first.close()]);
  machine = null;
  await home.close();
  await Promise.allSettled([homeDir, firstDir, machineDir, firstWork, work].map((dir) => fs.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })));
});

function on(daemon: Daemon, dir: string, cwd: string, ...args: string[]): Promise<Run> {
  return runCli(args, { cwd, env: cliEnv({ ISOCAN_HOME: dir, ISOCAN_PORT: new URL(baseOf(daemon)).port }) });
}

it("reads the canvas's complete history at its home, not the replica's partial log", async () => {
  // Made on one machine — born at the home — and bound to a directory whose
  // marker a second machine is handed, the clone case.
  const made = await on(first, firstDir, firstWork, "canvas", "create", "Acme review");
  expect(made.code, made.stderr).toBe(0);
  const canvasId = /prj_[\w-]+/.exec(made.stdout)![0];
  const ok = (run: Run) => expect(run.code, run.stderr).toBe(0);
  for (const words of ["Acme one", "Acme two"]) ok(await on(first, firstDir, firstWork, "--canvas", canvasId, "text", words));
  ok(await on(first, firstDir, firstWork, "use", canvasId));
  await fs.mkdir(path.join(work, ".isocan"), { recursive: true });
  await fs.copyFile(markerFile(firstWork), markerFile(work));

  const second = machine = await boot(machineDir);
  const isocan = (...args: string[]) => on(second, machineDir, work, ...args);
  ok(await isocan("ls"));
  // The replica adopted the home's snapshot: it holds the state, not seq 1.
  const held = await second.engine.getSnapshot(canvasId);
  expect(held.lastSeq).toBeGreaterThanOrEqual(3);
  expect((await second.engine.getLog(canvasId, 0)).some((entry) => entry.seq === 1)).toBe(false);

  const workflow = await isocan("design", "workflow", "--json");
  expect(workflow.stderr).not.toMatch(/history is incomplete/);
  expect(workflow.code, workflow.stderr).toBe(0);
  expect(JSON.parse(workflow.stdout).reviews.runs).toEqual([]);
}, 60_000);
