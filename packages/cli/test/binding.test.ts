import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PresenceSession, Canvas } from "@isocan/core";
import { startDaemon, type Daemon } from "@isocan/server";
import { harnessVars } from "@isocan/api";
import { mintTestBadge, type TestBadge } from "./badge.ts";

/**
 * A directory IS its canvas (#60).
 *
 * The binding is `<dir>/.isocan/project.json` — identity, not state: it names
 * the canvas, while the oplog and blobs stay in the isocan home. These tests
 * cover the whole lifecycle: the handshake creating a canvas for a fresh
 * directory, resolution walking up like `.git` discovery, a cloned marker
 * being materialized under ITS OWN id, and the narrowed defaults (`canvas
 * list`, `wait`) that keep an agent's attention on the directory it landed in.
 */

const cliBin = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));
const nico = { id: "usr_nico", name: "Nico" };

let home: string;
let work: string;
let daemon: Daemon;
let base: string;
let port: number;
/** The CLI badges itself; a test poking the daemon directly needs its own. */
let badge: TestBadge;

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
  badge = await mintTestBadge(base);
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

const canvases = (): Promise<Canvas[]> =>
  fetch(`${base}/api/projects`, { headers: badge.headers }).then((res) => res.json() as Promise<Canvas[]>);

const sessionsOf = (canvasId: string): Promise<PresenceSession[]> =>
  fetch(`${base}/api/projects/${canvasId}/sessions`, { headers: badge.headers }).then(
    (res) => res.json() as Promise<PresenceSession[]>,
  );

const marker = (dir: string): Promise<{ projectId: string; title?: string }> =>
  fs
    .readFile(path.join(dir, ".isocan", "project.json"), "utf8")
    .then((raw) => JSON.parse(raw) as { projectId: string; title?: string });

describe("the handshake binds a directory to its canvas", () => {
  it("identity --session in a fresh directory creates the canvas, the marker, and the roster row", async () => {
    const run = await cli(work, claude("s-1"), "identity", "--session");

    expect(run.code).toBe(0);
    expect(run.stdout).toContain("this directory's canvas");
    const bound = await marker(work);
    const listed = await canvases();
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
    expect(await canvases()).toHaveLength(1);
  }, 30_000);

  it("commands in a subdirectory resolve to the bound canvas — nearest marker wins, like .git", async () => {
    await cli(work, claude("s-1"), "identity", "--session");
    const sub = path.join(work, "packages", "deep");
    await fs.mkdir(sub, { recursive: true });

    const ls = await cli(sub, claude("s-1"), "ls");
    expect(ls.code).toBe(0);

    const show = await cli(sub, claude("s-1"), "--json", "canvas", "show");
    expect((JSON.parse(show.stdout) as Canvas).id).toBe((await marker(work)).projectId);
  }, 30_000);

  it("a git checkout binds at the toplevel, wherever the agent stands", async () => {
    await fs.mkdir(path.join(work, ".git"), { recursive: true });
    const sub = path.join(work, "src", "lib");
    await fs.mkdir(sub, { recursive: true });

    const run = await cli(sub, claude("s-1"), "identity", "--session");

    expect(run.code).toBe(0);
    const bound = await marker(work); // at the toplevel, not in src/lib
    expect((await canvases())[0]!.id).toBe(bound.projectId);
    await expect(marker(sub)).rejects.toThrow();
  }, 30_000);

  it("the user's home directory refuses a binding — it would bind everything under it", async () => {
    const fakeHome = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-binding-userhome-"));
    try {
      const run = await cli(fakeHome, { ...claude("s-1"), HOME: fakeHome }, "identity", "--session");

      expect(run.code).toBe(0); // the name was still saved
      expect(run.stdout).not.toContain("this directory's canvas");
      await expect(marker(fakeHome)).rejects.toThrow();
      expect(await canvases()).toHaveLength(0);
    } finally {
      await fs.rm(fakeHome, { recursive: true, force: true });
    }
  }, 30_000);
});

describe("a marker whose canvas this home has never seen", () => {
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
    expect(await canvases()).toHaveLength(0);
  }, 30_000);

  it("a command that adds something ADOPTS the marker's id — two homes, one canvas", async () => {
    await fs.writeFile(path.join(work, "note.md"), "# hello\n");
    const run = await cli(work, {}, "add", "note.md");

    expect(run.code).toBe(0);
    const listed = await canvases();
    expect(listed).toHaveLength(1);
    expect(listed[0]!.id).toBe("prj_cloned"); // the id travels; nothing minted a new one
    expect(listed[0]!.title).toBe("Cloned Canvas");
  }, 30_000);
});

describe("isocan use and the narrowed defaults", () => {
  it("use binds the directory; use --home sets the fallback for unbound ones", async () => {
    await cli(work, {}, "canvas", "create", "Roadmap");
    await cli(work, {}, "canvas", "create", "Elsewhere");

    const bind = await cli(work, {}, "use", "Roadmap");
    expect(bind.code).toBe(0);
    const bound = await marker(work);
    expect((await canvases()).find((p) => p.id === bound.projectId)!.title).toBe("Roadmap");

    // The home default only answers OUTSIDE bound directories.
    const other = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-binding-unbound-"));
    try {
      const setDefault = await cli(other, {}, "use", "Elsewhere", "--home");
      expect(setDefault.code).toBe(0);
      const showOther = await cli(other, {}, "--json", "canvas", "show");
      expect((JSON.parse(showOther.stdout) as Canvas).title).toBe("Elsewhere");
      // …while the bound directory still means its own canvas.
      const showBound = await cli(work, {}, "--json", "canvas", "show");
      expect((JSON.parse(showBound.stdout) as Canvas).title).toBe("Roadmap");
    } finally {
      await fs.rm(other, { recursive: true, force: true });
    }
  }, 30_000);

  /**
   * **The marker is committed, so rebinding is somebody else's git diff.**
   *
   * `use` overwrote a marker naming another canvas without a word. Run it in
   * a repo a teammate bound and the file changes under both of you, the only
   * evidence a line in `git status` nobody expected. The WEB has refused this
   * since the picker shipped — the surfaces simply disagreed, and the one
   * that was right is the one whose gesture is cheapest.
   */
  it("refuses to steal a directory that belongs to another canvas", async () => {
    await cli(work, {}, "canvas", "create", "Roadmap");
    await cli(work, {}, "canvas", "create", "Elsewhere");
    await cli(work, {}, "use", "Roadmap");
    const before = await marker(work);

    const steal = await cli(work, {}, "use", "Elsewhere");
    expect(steal.code).not.toBe(0);
    // It NAMES the canvas that has it: "already bound" names nobody, and a
    // person then has to go looking for who took their folder.
    expect(steal.stderr).toContain("already belongs to Roadmap");
    // And the marker is untouched — a refusal that half-wrote would be worse
    // than the overwrite it replaced.
    expect((await marker(work)).projectId).toBe(before.projectId);

    // Rebinding stays possible; it is a choice somebody makes on purpose.
    const forced = await cli(work, {}, "use", "Elsewhere", "--force");
    expect(forced.code).toBe(0);
    expect((await marker(work)).projectId).not.toBe(before.projectId);
  }, 30_000);

  it("adoption is not a rebind, and says so", async () => {
    // A clone carrying its marker: the repo already knows what it is and only
    // this machine's roster row is missing. Nothing is written to the repo,
    // so "attached" would be a claim about a change that did not happen.
    await cli(work, {}, "canvas", "create", "Roadmap");
    await cli(work, {}, "use", "Roadmap");
    const before = await marker(work);

    const again = await cli(work, {}, "use", "Roadmap");
    expect(again.code).toBe(0);
    expect(again.stdout).toContain("already meant");
    expect((await marker(work)).projectId).toBe(before.projectId);
  }, 30_000);

  it("canvas list narrows to the directory's canvas; --all opens the home back up", async () => {
    await cli(work, {}, "canvas", "create", "Roadmap");
    await cli(work, {}, "canvas", "create", "Elsewhere");
    await cli(work, {}, "use", "Roadmap");

    const narrowed = await cli(work, {}, "--json", "canvas", "list");
    const shown = JSON.parse(narrowed.stdout) as Canvas[];
    expect(shown.map((p) => p.title)).toEqual(["Roadmap"]);
    expect(narrowed.stderr).toContain("--all");

    const everything = await cli(work, {}, "--json", "canvas", "list", "--all");
    expect((JSON.parse(everything.stdout) as Canvas[]).map((p) => p.title).sort()).toEqual([
      "Elsewhere",
      "Roadmap",
    ]);
  }, 30_000);
});

describe("wait is on one canvas", () => {
  it("bound directory: pinned to its canvas; unbound with several canvases: refused", async () => {
    // Two canvases, both born from handshakes (which set no home default) —
    // so nothing can answer for an unbound directory.
    await cli(work, claude("s-1"), "identity", "--session");
    const other = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-binding-other-"));
    const unbound = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-binding-unbound-wait-"));
    try {
      await cli(other, claude("s-2"), "identity", "--session");
      const otherId = (await marker(other)).projectId;
      const elsewhere = (await canvases()).find((p) => p.id === otherId)!;

      // Bound: the park is canvas-scoped, so the other canvas sees nobody.
      const pinned = await cli(work, claude("s-1"), "wait", "--timeout", "1");
      expect(pinned.code).toBe(2);
      expect(await sessionsOf(elsewhere.id)).toEqual([]);

      // Unbound with nothing to resolve: wait refuses rather than listening
      // home-wide — there is no home-wide mode any more (on-call retired).
      const refused = await cli(unbound, claude("s-1"), "wait", "--timeout", "1");
      expect(refused.code).toBe(1);
      expect(refused.stderr).toContain("--canvas");
    } finally {
      await fs.rm(other, { recursive: true, force: true });
      await fs.rm(unbound, { recursive: true, force: true });
    }
  }, 30_000);
});
