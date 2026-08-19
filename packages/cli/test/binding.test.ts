import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PresenceSession, Project } from "@isocan/core";
import { startDaemon, type Daemon } from "@isocan/server";
import { harnessVars } from "../src/harness.ts";

/**
 * A directory IS its project (#60).
 *
 * The binding is `<dir>/.isocan/project.json` — identity, not state: it names
 * the canvas, while the oplog and blobs stay in the isocan home. These tests
 * cover the whole lifecycle: the handshake creating a canvas for a fresh
 * directory, resolution walking up like `.git` discovery, a cloned marker
 * being materialized under ITS OWN id, and the narrowed defaults (`project
 * list`, `wait`) that keep an agent's attention on the directory it landed in.
 */

const cliBin = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));
const nico = { id: "usr_nico", name: "Nico" };

let home: string;
let work: string;
let daemon: Daemon;
let base: string;
let port: number;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-binding-"));
  work = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-binding-work-"));
  await fs.writeFile(
    path.join(home, "identity.json"),
    JSON.stringify({ ...nico, createdAt: new Date().toISOString() }),
  );
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  port = typeof address === "object" && address ? address.port : 0;
  base = `http://127.0.0.1:${port}`;
});

afterEach(async () => {
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true });
  await fs.rm(work, { recursive: true, force: true });
});

interface Run {
  code: number;
  stdout: string;
  stderr: string;
}

/** The CLI as one process runs it: a cwd, a controlled set of session
 * variables (the suite itself runs inside some harness), and the test home. */
function cli(cwd: string, session: Record<string, string>, ...args: string[]): Promise<Run> {
  const env: NodeJS.ProcessEnv = { ...process.env, ISOCAN_HOME: home, ISOCAN_PORT: String(port) };
  for (const v of harnessVars) delete env[v];
  Object.assign(env, session);
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

const claude = (id: string) => ({ CLAUDE_CODE_SESSION_ID: id });

const projects = (): Promise<Project[]> =>
  fetch(`${base}/api/projects`).then((res) => res.json() as Promise<Project[]>);

const sessionsOf = (projectId: string): Promise<PresenceSession[]> =>
  fetch(`${base}/api/projects/${projectId}/sessions`).then(
    (res) => res.json() as Promise<PresenceSession[]>,
  );

const marker = (dir: string): Promise<{ projectId: string; title?: string }> =>
  fs
    .readFile(path.join(dir, ".isocan", "project.json"), "utf8")
    .then((raw) => JSON.parse(raw) as { projectId: string; title?: string });

async function until<T>(fn: () => Promise<T>, ok: (v: T) => boolean, what: string): Promise<T> {
  const deadline = Date.now() + 10_000;
  for (;;) {
    const value = await fn();
    if (ok(value)) return value;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 50));
  }
}

describe("the handshake binds a directory to its canvas", () => {
  it("identity --session in a fresh directory creates the project, the marker, and the roster row", async () => {
    const run = await cli(work, claude("s-1"), "identity", "--session");

    expect(run.code).toBe(0);
    expect(run.stdout).toContain("this directory's canvas");
    const bound = await marker(work);
    const listed = await projects();
    expect(listed).toHaveLength(1);
    expect(listed[0]!.id).toBe(bound.projectId);
    expect(listed[0]!.title).toBe(path.basename(work));
    // The roster remembers where the canvas's directory lives.
    const roster = JSON.parse(await fs.readFile(path.join(home, "dirs.json"), "utf8")) as Record<
      string,
      string
    >;
    expect(Object.values(roster)).toContain(bound.projectId);
  }, 30_000);

  it("a second agent's handshake reuses the binding — one directory, one canvas", async () => {
    await cli(work, claude("s-1"), "identity", "--session");
    const again = await cli(work, claude("s-2"), "identity", "--session");

    expect(again.code).toBe(0);
    expect(again.stdout).toContain("this directory's canvas");
    expect(again.stdout).not.toContain("created");
    expect(await projects()).toHaveLength(1);
  }, 30_000);

  it("commands in a subdirectory resolve to the bound project — nearest marker wins, like .git", async () => {
    await cli(work, claude("s-1"), "identity", "--session");
    const sub = path.join(work, "packages", "deep");
    await fs.mkdir(sub, { recursive: true });

    const ls = await cli(sub, claude("s-1"), "ls");
    expect(ls.code).toBe(0);

    const show = await cli(sub, claude("s-1"), "--json", "project", "show");
    expect((JSON.parse(show.stdout) as Project).id).toBe((await marker(work)).projectId);
  }, 30_000);

  it("a git checkout binds at the toplevel, wherever the agent stands", async () => {
    await fs.mkdir(path.join(work, ".git"), { recursive: true });
    const sub = path.join(work, "src", "lib");
    await fs.mkdir(sub, { recursive: true });

    const run = await cli(sub, claude("s-1"), "identity", "--session");

    expect(run.code).toBe(0);
    const bound = await marker(work); // at the toplevel, not in src/lib
    expect((await projects())[0]!.id).toBe(bound.projectId);
    await expect(marker(sub)).rejects.toThrow();
  }, 30_000);

  it("the user's home directory refuses a binding — it would bind everything under it", async () => {
    const fakeHome = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-binding-userhome-"));
    try {
      const run = await cli(fakeHome, { ...claude("s-1"), HOME: fakeHome }, "identity", "--session");

      expect(run.code).toBe(0); // the name was still saved
      expect(run.stdout).not.toContain("this directory's canvas");
      await expect(marker(fakeHome)).rejects.toThrow();
      expect(await projects()).toHaveLength(0);
    } finally {
      await fs.rm(fakeHome, { recursive: true, force: true });
    }
  }, 30_000);
});

describe("a marker whose project this home has never seen", () => {
  beforeEach(async () => {
    await fs.mkdir(path.join(work, ".isocan"), { recursive: true });
    await fs.writeFile(
      path.join(work, ".isocan", "project.json"),
      JSON.stringify({ projectId: "prj_cloned", title: "Cloned Canvas" }),
    );
  });

  it("a read refuses with the way forward, and creates nothing", async () => {
    const run = await cli(work, {}, "ls");

    expect(run.code).toBe(1);
    expect(run.stderr).toContain("does not exist in this home yet");
    expect(await projects()).toHaveLength(0);
  }, 30_000);

  it("a command that adds something ADOPTS the marker's id — two homes, one project", async () => {
    await fs.writeFile(path.join(work, "note.md"), "# hello\n");
    const run = await cli(work, {}, "add", "note.md");

    expect(run.code).toBe(0);
    const listed = await projects();
    expect(listed).toHaveLength(1);
    expect(listed[0]!.id).toBe("prj_cloned"); // the id travels; nothing minted a new one
    expect(listed[0]!.title).toBe("Cloned Canvas");
  }, 30_000);
});

describe("isocan use and the narrowed defaults", () => {
  it("use binds the directory; use --home sets the fallback for unbound ones", async () => {
    await cli(work, {}, "project", "create", "Roadmap");
    await cli(work, {}, "project", "create", "Elsewhere");

    const bind = await cli(work, {}, "use", "Roadmap");
    expect(bind.code).toBe(0);
    const bound = await marker(work);
    expect((await projects()).find((p) => p.id === bound.projectId)!.title).toBe("Roadmap");

    // The home default only answers OUTSIDE bound directories.
    const other = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-binding-unbound-"));
    try {
      const setDefault = await cli(other, {}, "use", "Elsewhere", "--home");
      expect(setDefault.code).toBe(0);
      const showOther = await cli(other, {}, "--json", "project", "show");
      expect((JSON.parse(showOther.stdout) as Project).title).toBe("Elsewhere");
      // …while the bound directory still means its own canvas.
      const showBound = await cli(work, {}, "--json", "project", "show");
      expect((JSON.parse(showBound.stdout) as Project).title).toBe("Roadmap");
    } finally {
      await fs.rm(other, { recursive: true, force: true });
    }
  }, 30_000);

  it("project list narrows to the directory's project; --all opens the home back up", async () => {
    await cli(work, {}, "project", "create", "Roadmap");
    await cli(work, {}, "project", "create", "Elsewhere");
    await cli(work, {}, "use", "Roadmap");

    const narrowed = await cli(work, {}, "--json", "project", "list");
    const shown = JSON.parse(narrowed.stdout) as Project[];
    expect(shown.map((p) => p.title)).toEqual(["Roadmap"]);
    expect(narrowed.stderr).toContain("--all");

    const everything = await cli(work, {}, "--json", "project", "list", "--all");
    expect((JSON.parse(everything.stdout) as Project[]).map((p) => p.title).sort()).toEqual([
      "Elsewhere",
      "Roadmap",
    ]);
  }, 30_000);
});

describe("wait scopes itself by where it stands", () => {
  it("bound directory: pinned to its canvas; unbound directory: on call for the home", async () => {
    await cli(work, {}, "project", "create", "Elsewhere");
    await cli(work, claude("s-1"), "identity", "--session");
    const elsewhere = (await projects()).find((p) => p.title === "Elsewhere")!;

    // Bound: the park is project-scoped, so the other canvas sees nobody.
    const pinned = await cli(work, claude("s-1"), "wait", "--timeout", "1");
    expect(pinned.code).toBe(2);
    expect(await sessionsOf(elsewhere.id)).toEqual([]);

    // The same agent parked from an UNBOUND directory is on call everywhere
    // — the posture is chosen by standing there, not by a flag.
    const unbound = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-binding-concierge-"));
    try {
      const widened = cli(unbound, claude("s-1"), "wait", "--timeout", "3");
      await until(
        () => sessionsOf(elsewhere.id),
        (list) => list.some((s) => s.scope === "home"),
        "the on-call face on the other canvas",
      );
      expect((await widened).code).toBe(2);
    } finally {
      await fs.rm(unbound, { recursive: true, force: true });
    }
  }, 30_000);
});
