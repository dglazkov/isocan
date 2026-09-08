import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startDaemon, type Daemon } from "@isocan/server";
import { harnessVars } from "@isocan/api";

/**
 * **A backup is the log and the bytes, and a restore folds the same canvas.**
 *
 * `docs/isocan-export.md` is the walkthrough; this is the claim underneath it,
 * checked against two real daemons and the real CLI: what `export` writes is
 * what the store holds, verbatim — same seqs, same timestamps — and what
 * `import` hands back is the same canvas at a home that had never seen it.
 * The git half is checked against a bare repository on disk, so the push is
 * a real push with no network in it.
 */

const cliBin = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));
const nico = { id: "usr_nico", name: "Nico" };

let homeDir: string;
let thereDir: string;
let work: string;
let scratch: string;
let here: Daemon;
let there: Daemon;
let port: number;

function baseOf(daemon: Daemon): string {
  const address = daemon.app.server.address();
  return `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
}

beforeEach(async () => {
  homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-export-home-"));
  thereDir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-export-there-"));
  work = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-export-work-"));
  scratch = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-export-out-"));
  await fs.writeFile(
    path.join(homeDir, "identity.json"),
    JSON.stringify({ ...nico, createdAt: new Date().toISOString() }),
  );
  here = await startDaemon({ port: 0, home: homeDir, birthHome: null });
  there = await startDaemon({ port: 0, home: thereDir, birthHome: null });
  port = Number(new URL(baseOf(here)).port);
});

afterEach(async () => {
  await here?.close();
  await there?.close();
  await Promise.allSettled(
    [homeDir, thereDir, work, scratch].map((dir) => fs.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })),
  );
});

interface Run {
  code: number;
  stdout: string;
  stderr: string;
}

function cli(...args: string[]): Promise<Run> {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ISOCAN_HOME: homeDir,
    ISOCAN_PORT: String(port),
    GIT_AUTHOR_NAME: "Test",
    GIT_AUTHOR_EMAIL: "test@example.com",
    GIT_COMMITTER_NAME: "Test",
    GIT_COMMITTER_EMAIL: "test@example.com",
  };
  for (const v of harnessVars) delete env[v];
  const child = spawn(process.execPath, [cliBin, ...args], {
    cwd: work,
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

const json = <T>(run: Run): T => {
  expect(run.code, run.stderr).toBe(0);
  return JSON.parse(run.stdout) as T;
};

/** A canvas with one item in two versions — two blobs the log names. */
async function seed(): Promise<{ canvasId: string; itemId: string }> {
  const { canvasId } = json<{ canvasId: string }>(await cli("canvas", "create", "Backup Me", "--json"));
  await fs.writeFile(path.join(work, "note.md"), "# first\n");
  await fs.writeFile(path.join(work, "note2.md"), "# second, longer than the first\n");
  const added = await cli("add", "note.md", "--title", "A note", "--json");
  expect(added.code, added.stderr).toBe(0);
  const snapshot = await here.engine.getSnapshot(canvasId);
  const itemId = Object.keys(snapshot.canvas.items)[0]!;
  const edited = await cli("edit", itemId, "note2.md", "--json");
  expect(edited.code, edited.stderr).toBe(0);
  return { canvasId, itemId };
}

const lines = async (file: string) =>
  (await fs.readFile(file, "utf8")).split("\n").filter((l) => l.trim() !== "");

describe("isocan export", () => {
  it("writes the log verbatim and the bytes it names; import folds the same canvas elsewhere", async () => {
    const { canvasId } = await seed();
    const mine = (await here.store.load(canvasId))!.entries;
    expect(mine.length).toBeGreaterThan(2);

    const backup = path.join(scratch, "backup");
    const report = json<{
      canvases: Array<{ id: string; entries: number; blobs: number; missing: string[] }>;
      written: string[];
    }>(await cli("export", "--to", backup, "--json"));
    expect(report.canvases).toHaveLength(1);
    expect(report.canvases[0]).toMatchObject({ id: canvasId, entries: mine.length, blobs: 2, missing: [] });

    // The log on disk IS the log in the store: same seqs, same timestamps.
    const canvasDir = path.join(backup, "projects", canvasId);
    const written = (await lines(path.join(canvasDir, "oplog.jsonl"))).map((l) => JSON.parse(l));
    expect(written.map((e) => e.seq)).toEqual(mine.map((e) => e.seq));
    expect(written.map((e) => e.envelope.ts)).toEqual(mine.map((e) => e.envelope.ts));
    // Both versions' bytes, filed under their hashes the way the daemon files them.
    const blobs = (await fs.readdir(path.join(canvasDir, "blobs"))).sort();
    expect(blobs).toHaveLength(2);
    const index = JSON.parse(await fs.readFile(path.join(canvasDir, "blobs.json"), "utf8"));
    expect(Object.values(index).map((b: any) => b.file).sort()).toEqual(blobs);
    expect(await fs.readFile(path.join(canvasDir, "blobs", index[Object.keys(index)[0]!].file), "utf8")).toMatch(/^# /);
    const manifest = JSON.parse(await fs.readFile(path.join(backup, "manifest.json"), "utf8"));
    expect(manifest.format).toBe("isocan-export/1");
    expect(manifest.from).toBe(baseOf(here));
    expect(manifest.canvases[0].id).toBe(canvasId);

    // A dry run says what it would write and writes nothing.
    const dry = json<{ dryRun: boolean; canvases: Array<{ entries: number }> }>(
      await cli("export", "--to", path.join(scratch, "never"), "--dry-run", "--json"),
    );
    expect(dry.dryRun).toBe(true);
    expect(dry.canvases[0]!.entries).toBe(mine.length);
    await expect(fs.stat(path.join(scratch, "never"))).rejects.toThrow();

    // Restore at a home that has never heard of it.
    const restored = json<{
      restored: Array<{ id: string; entries: number; uploaded: number; failed: unknown[] }>;
      refused: unknown[];
    }>(await cli("import", backup, "--to", baseOf(there), "--json"));
    expect(restored.refused).toEqual([]);
    expect(restored.restored[0]).toMatchObject({ id: canvasId, entries: mine.length, uploaded: 2, failed: [] });
    const theirs = (await there.store.load(canvasId))!.entries;
    expect(theirs.map((e) => e.seq)).toEqual(mine.map((e) => e.seq));
    expect(theirs.map((e) => e.envelope.ts)).toEqual(mine.map((e) => e.envelope.ts));
    expect(await there.store.listBlobs(canvasId)).toHaveLength(2);

    // The restorer was admitted to what it restored: reading it back from
    // that home BY ADDRESS works, on the badge the door handed this machine.
    const again = json<{ canvases: Array<{ id: string; entries: number; blobs: number }> }>(
      await cli("export", `${baseOf(there)}/p/${canvasId}`, "--to", path.join(scratch, "from-there"), "--json"),
    );
    expect(again.canvases[0]).toMatchObject({ id: canvasId, entries: mine.length, blobs: 2 });

    // Creates, never merges: the second restore is refused, and says so.
    const twice = await cli("import", backup, "--to", baseOf(there), "--json");
    expect(twice.code).toBe(1);
    const refusal = JSON.parse(twice.stdout) as { refused: Array<{ id: string; error: string }> };
    expect(refusal.refused[0]!.id).toBe(canvasId);
    expect(refusal.refused[0]!.error).toMatch(/already here/);
  }, 90_000);

  it("backs one item up: every version's bytes, and the ops that name it", async () => {
    const { canvasId, itemId } = await seed();
    const backup = path.join(scratch, "item");
    const report = json<{ items: Array<{ itemId: string; versions: number; ops: number; missing: string[] }> }>(
      await cli("export", "--item", itemId, "--to", backup, "--json"),
    );
    expect(report.items[0]).toMatchObject({ itemId, versions: 2, missing: [] });
    expect(report.items[0]!.ops).toBeGreaterThanOrEqual(2);
    const dir = path.join(backup, "items", canvasId, itemId);
    const versions = (await fs.readdir(path.join(dir, "versions"))).sort();
    expect(versions).toEqual(["01-note.md", "02-note2.md"]);
    expect(await fs.readFile(path.join(dir, "versions", "02-note2.md"), "utf8")).toContain("second");
    expect((await lines(path.join(dir, "ops.jsonl"))).length).toBe(report.items[0]!.ops);
  }, 60_000);

  it("commits the export, and pushes it to a remote", async () => {
    const { itemId } = await seed();
    const bare = path.join(scratch, "remote.git");
    expect(spawnSync("git", ["init", "-q", "--bare", bare]).status).toBe(0);
    const backup = path.join(scratch, "repo");

    const first = json<{ git: { committed: boolean; pushed?: string; initialized: boolean } }>(
      await cli("export", "--to", backup, "--git", bare, "--json"),
    );
    expect(first.git).toMatchObject({ committed: true, initialized: true, pushed: bare });
    // `--git-dir`, not `-C`: a bare repository is only usable when named
    // explicitly under `safe.bareRepository=explicit`, which developers set.
    const log = spawnSync("git", ["--git-dir", bare, "log", "--oneline"], { encoding: "utf8" });
    expect(log.stdout.trim().split("\n")).toHaveLength(1);
    expect(log.stdout).toContain("isocan export: Backup Me");

    // Nothing changed: nothing to commit, and it says so rather than making
    // an empty commit.
    const same = json<{ git: { committed: boolean } }>(await cli("export", "--to", backup, "--commit", "--json"));
    expect(same.git.committed).toBe(false);

    // Something changed: a new version is a new blob and a longer log.
    await fs.writeFile(path.join(work, "note3.md"), "# third\n");
    expect((await cli("edit", itemId, "note3.md")).code).toBe(0);
    const changed = json<{ git: { committed: boolean; pushed?: string } }>(
      await cli("export", "--to", backup, "--git", bare, "--json"),
    );
    expect(changed.git.committed).toBe(true);
    const twoNow = spawnSync("git", ["--git-dir", bare, "log", "--oneline"], { encoding: "utf8" });
    expect(twoNow.stdout.trim().split("\n")).toHaveLength(2);
    // Only the export's own paths were staged — never the directory at large.
    const tracked = spawnSync("git", ["-C", backup, "ls-files"], { encoding: "utf8" }).stdout;
    expect(tracked).toContain("manifest.json");
    expect(tracked).toContain("projects/");
    expect(tracked).not.toContain("note.md");

    // A different remote is refused by name, never silently re-pointed.
    const other = await cli("export", "--to", backup, "--git", path.join(scratch, "other.git"), "--json");
    expect(other.code).toBe(1);
    expect(other.stderr).toContain("already pushes to");
  }, 90_000);
});
