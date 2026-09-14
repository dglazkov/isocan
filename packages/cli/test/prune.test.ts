import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startDaemon, type Daemon } from "@isocan/server";
import { harnessVars } from "@isocan/api";

/**
 * **The confirmation on a verb that forgets for good.**
 *
 * `isocan version prune` is one of two verbs in the CLI that destroy
 * something no undo can bring back (`trash empty --force` is the other).
 * Everything underneath it is held elsewhere — the reducer's rule in
 * `reducer.test.ts`, the replica's agreement in `home-link.test.ts`, the
 * bytes in `gc.test.ts` — and none of that notices if the verb above them
 * stops asking. A `--force` that quietly becomes optional in a refactor
 * fails no test that exists, and the first person to find out is somebody
 * whose history is gone.
 *
 * So: the refusal, the count inside the refusal (an "are you sure" that
 * names the wrong number teaches people to ignore it), the stack afterwards,
 * and the one rule the destructive path must never break — the version an
 * item is SHOWING survives a prune, however old it is.
 */

const cliBin = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));
const nico = { id: "usr_nico", name: "Nico" };

let home: string;
let daemon: Daemon;
let base: string;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-prune-"));
  await fs.writeFile(
    path.join(home, "identity.json"),
    JSON.stringify({ ...nico, createdAt: new Date().toISOString() }),
  );
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});

afterEach(async () => {
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

interface Run {
  code: number;
  stdout: string;
  stderr: string;
}

function isocan(...args: string[]): Promise<Run> {
  const env = { ...process.env };
  for (const name of harnessVars) delete env[name];
  const child: ChildProcess = spawn(process.execPath, [cliBin, ...args], {
    env: { ...env, ISOCAN_HOME: home, ISOCAN_PORT: new URL(base).port },
    cwd: home,
    stdio: ["ignore", "pipe", "pipe"],
  });
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

async function json(...args: string[]): Promise<any> {
  const run = await isocan(...args, "--json");
  expect(run.code, run.stderr).toBe(0);
  return JSON.parse(run.stdout);
}

/** An item with `depth` versions on it: the first, then `depth - 1` edits. */
async function stack(depth: number): Promise<string> {
  const file = path.join(home, "note.txt");
  await fs.writeFile(file, "v1");
  const added = await json("add", file, "--title", "Generated");
  for (let n = 2; n <= depth; n++) {
    await fs.writeFile(file, `v${n}`);
    const edit = await isocan("edit", added.itemId, file);
    expect(edit.code, edit.stderr).toBe(0);
  }
  return added.itemId;
}

/** `isocan versions --json` prints the stack itself, so these are real ids. */
async function versionIds(itemId: string): Promise<string[]> {
  const rows = await json("versions", itemId);
  const ids = rows.map((row: any) => row.id);
  // Guard the guard: a shape change here would otherwise turn every
  // assertion below into a comparison of undefineds that always holds.
  expect(ids.every((id: unknown) => typeof id === "string" && id.length > 0)).toBe(true);
  return ids;
}

describe("isocan version prune", () => {
  beforeEach(async () => {
    const made = await isocan("canvas", "create", "Board");
    expect(made.code, made.stderr).toBe(0);
  });

  it("refuses without --force, and says how much it would forget", async () => {
    const itemId = await stack(10);
    const run = await isocan("version", "prune", itemId, "--keep", "3");
    expect(run.code).not.toBe(0);
    expect(run.stderr).toMatch(/not undoable/);
    expect(run.stderr).toMatch(/--force/);
    // The number in the warning is the number it would actually drop.
    expect(run.stderr).toMatch(/\b7 versions\b/);
    // And it really did nothing.
    expect(await versionIds(itemId)).toHaveLength(10);
  });

  it("keeps the newest N with --force, and reports what it dropped", async () => {
    const itemId = await stack(10);
    const before = await versionIds(itemId);
    const out = await json("version", "prune", itemId, "--keep", "3", "--force");
    expect(out).toMatchObject({ dropped: 7, keep: 3 });
    const after = await versionIds(itemId);
    expect(after).toEqual(before.slice(-3));
  });

  it("keeps the version the item is SHOWING, however old it is", async () => {
    const itemId = await stack(10);
    const all = await versionIds(itemId);
    const oldest = all[0]!;
    const promoted = await isocan("version", "promote", itemId, oldest);
    expect(promoted.code, promoted.stderr).toBe(0);

    await json("version", "prune", itemId, "--keep", "3", "--force");
    const after = await versionIds(itemId);
    // The newest three AND the one on top, which the cut would have taken.
    expect(after).toContain(oldest);
    expect(after).toEqual([oldest, ...all.slice(-3)]);
  });

  it("says so rather than logging a no-op when no stack is deep enough", async () => {
    const itemId = await stack(3);
    const out = await json("version", "prune", itemId, "--keep", "5", "--force");
    expect(out).toMatchObject({ pruned: [], dropped: 0 });
    expect(await versionIds(itemId)).toHaveLength(3);
  });

  it("wants a whole number of at least one to keep", async () => {
    const itemId = await stack(4);
    for (const bad of ["0", "-1", "2.5", "lots"]) {
      const run = await isocan("version", "prune", itemId, "--keep", bad, "--force");
      expect(run.code, `--keep ${bad} should be refused`).not.toBe(0);
      expect(run.stderr).toMatch(/whole number of at least 1/);
    }
    expect(await versionIds(itemId)).toHaveLength(4);
  });

  it("wants to be told what to prune — nothing is not everything", async () => {
    await stack(10);
    const run = await isocan("version", "prune", "--keep", "3", "--force");
    expect(run.code).not.toBe(0);
    expect(run.stderr).toMatch(/--all/);
  });
});

describe("isocan gc --keep-versions", () => {
  beforeEach(async () => {
    const made = await isocan("canvas", "create", "Board");
    expect(made.code, made.stderr).toBe(0);
  });

  it("refuses without --force, the same way the verb does", async () => {
    const itemId = await stack(10);
    const run = await isocan("gc", "--keep-versions", "3");
    expect(run.code).not.toBe(0);
    expect(run.stderr).toMatch(/--force/);
    expect(await versionIds(itemId)).toHaveLength(10);
  });

  it("refuses to be a home-wide prune", async () => {
    await stack(10);
    const run = await isocan("gc", "--keep-versions", "3", "--force", "--all");
    expect(run.code).not.toBe(0);
    expect(run.stderr).toMatch(/one canvas/);
  });

  it("prunes every stack here before it sweeps", async () => {
    const deep = await stack(10);
    const shallow = await stack(2);
    const run = await isocan("gc", "--keep-versions", "3", "--force");
    expect(run.code, run.stderr).toBe(0);
    expect(await versionIds(deep)).toHaveLength(3);
    expect(await versionIds(shallow)).toHaveLength(2);
  });

  it("--dry-run forgets nothing", async () => {
    const itemId = await stack(10);
    const run = await isocan("gc", "--keep-versions", "3", "--dry-run");
    expect(run.code, run.stderr).toBe(0);
    expect(await versionIds(itemId)).toHaveLength(10);
  });
});
