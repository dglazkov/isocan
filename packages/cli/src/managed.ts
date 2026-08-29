import { promises as fs } from "node:fs";
import { spawn, type SpawnSyncReturns } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { healthPath, type UpgradeVerdict } from "@isocan/core";
import { buildStamp, paths, plausibleSha, readConfigFile } from "@isocan/server";
import { findOnPath, rootOfBin } from "./onpath.ts";
import { resolved, whichInstall, type Install, type InstallKind } from "./upgrade.ts";

/**
 * **The managed install root** (auto-upgrade phase 3).
 *
 * `npm i -g` overwrites in place, and that single fact disqualifies it from
 * running unattended: a failed install leaves no working CLI and nothing to
 * fall back to (#47's empty-directory failure had exactly that shape), and
 * `main.ts` resolves `@isocan/server` through a lazy `await import`, so
 * rewriting the tree under a running command can break that command
 * mid-flight.
 *
 * So isocan owns its install root, and an upgrade becomes four steps in which
 * only the last one is visible:
 *
 * 1. **install aside** into `builds/<sha>` — a directory nothing points at, so
 *    a failure here is a directory to delete rather than an outage;
 * 2. **smoke-test it** by starting it and asking it which commit it is;
 * 3. **flip `current`**, one `rename` of one symlink — that is the upgrade;
 * 4. **prune**, never touching a tree a live process is running from.
 *
 * Every function here takes `home` rather than reading `ISOCAN_HOME` itself,
 * so a test can drive the whole cycle against a scratch directory.
 */

/** A build on disk, as `builds/` holds it. */
export interface Build {
  /** The commit it is of — the directory's name, and its identity. */
  sha: string;
  /** The npm prefix: `builds/<sha>`. */
  dir: string;
  /** The package root inside it — what a daemon started here reports as its
   * `root`, and so what `stalenessOf` compares. */
  root: string;
  /** When this tree landed (the directory's mtime). Orders the builds, which
   * is what "keep the newest three" and `--rollback` both need. */
  installedAt: number;
}

function buildOf(home: string, sha: string, installedAt: number): Build {
  const dir = paths.buildDir(home, sha);
  return { sha, dir, root: paths.buildRoot(dir), installedAt };
}

/**
 * Every build in `builds/`, newest first.
 *
 * Dotted entries are skipped, which is the whole reason staging is called
 * `.staging`: a tree that is still being written must never be readable as a
 * build, because the next thing anyone does with a build is point PATH at it.
 */
export async function listBuilds(home: string): Promise<Build[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(paths.buildsDir(home));
  } catch {
    return [];
  }
  const builds: Build[] = [];
  for (const name of entries) {
    if (name.startsWith(".")) continue;
    try {
      const stat = await fs.stat(paths.buildDir(home, name));
      if (stat.isDirectory()) builds.push(buildOf(home, name, stat.mtimeMs));
    } catch {
      // Vanished between readdir and stat — a concurrent prune, and not ours
      // to report.
    }
  }
  return builds.sort((a, b) => b.installedAt - a.installedAt);
}

/**
 * The sha `current` names, or null when this machine has no managed install.
 *
 * Read with `readlink` rather than `realpath` deliberately: the answer wanted
 * here is "which build did somebody choose", and that is what the link says.
 * `realpath` would answer it too, until the day the link is repaired by hand
 * into an absolute path and the two stop agreeing.
 */
export async function currentSha(home: string): Promise<string | null> {
  try {
    const target = await fs.readlink(paths.currentLink(home));
    const sha = path.basename(target);
    return sha.length > 0 ? sha : null;
  } catch {
    return null;
  }
}

export async function currentBuild(home: string): Promise<Build | null> {
  const sha = await currentSha(home);
  if (!sha) return null;
  try {
    const stat = await fs.stat(paths.buildDir(home, sha));
    return stat.isDirectory() ? buildOf(home, sha, stat.mtimeMs) : null;
  } catch {
    return null;
  }
}

/**
 * **Point `current` at a build.** This one call is the upgrade; everything
 * else in this file is preparation for it or cleanup after it.
 *
 * A symlink written aside and `rename`d over the old one, because `rm` then
 * `symlink` has a window — small, but it is the window in which `isocan` on
 * PATH resolves to nothing at all, and the machines this runs on are the ones
 * nobody is watching. `rename` over an existing symlink is atomic on POSIX.
 *
 * The target is RELATIVE (`builds/<sha>`), so a `~/.isocan` that gets moved or
 * copied still resolves. Windows takes an absolute junction instead — it has
 * no relative-symlink story worth relying on, and nobody has run this there
 * (recorded as open in the phase document, not silently assumed to work).
 */
export async function flipTo(home: string, sha: string): Promise<void> {
  const link = paths.currentLink(home);
  const tmp = `${link}.tmp-${process.pid}`;
  const target =
    process.platform === "win32" ? paths.buildDir(home, sha) : path.join("builds", sha);
  await fs.mkdir(home, { recursive: true });
  await fs.rm(tmp, { force: true });
  await fs.symlink(target, tmp, process.platform === "win32" ? "junction" : "dir");
  await fs.rename(tmp, link);
}

// ---------- the smoke test ----------

export interface SmokeResult {
  ok: boolean;
  /** Empty when it passed; otherwise what happened, in one line. */
  why: string;
  /** What the candidate said it was, when it managed to say anything. */
  commit: string | null;
}

/**
 * **Does this tree actually run, and is it the build it claims to be?**
 *
 * `--version` would prove a process boots and can read its own manifest, and
 * that is not the claim being tested — a tree with a broken `@isocan/server`
 * import passes it, and that is precisely the tree an unattended upgrade must
 * not hand anybody. So the candidate is started as a DAEMON, against a scratch
 * `ISOCAN_HOME` so it can never write into the real registry, and asked
 * `/healthz` for the sha it should be. That is the whole upgrade in one
 * assertion, and it is only possible because auto-upgrade phase 1 made a build
 * able to report its own commit.
 *
 * **The port is a guess, so losing it is retried rather than reported.**
 * `ISOCAN_PORT=0` would be exact — the daemon would take any free port — but
 * a build only knows where it landed if it RECORDS where it landed, and every
 * build already on `release` writes the literal `0` it was asked for into
 * `daemon.json` (`startDaemon` never re-reads the bound address). A candidate
 * is by definition a build we have not shipped yet but also not necessarily a
 * new one — a rollback re-runs this against an old tree — so the test has to
 * work against builds that predate it. It picks a free port, and treats a
 * candidate that could not bind as a lost race rather than a bad build:
 * `attempts` ports before it gives up. The alternative — reporting a fine
 * build as broken because something else took a port for a millisecond — is
 * the one failure this test must not have.
 */
export async function smokeTest(options: {
  /** The isocan home whose `builds/` this candidate lives in. The scratch home
   * the candidate runs against is made INSIDE it — dot-prefixed, so
   * `listBuilds` never sees it — rather than in the OS temp directory. A
   * process killed mid-upgrade otherwise leaves a directory in `/tmp` that
   * nothing owns and nothing sweeps; here it is litter in a directory this
   * tool already cleans. */
  home: string;
  /** The candidate's package root. */
  root: string;
  /** The sha it must report. */
  expect: string;
  timeoutMs?: number;
  attempts?: number;
}): Promise<SmokeResult> {
  const { home, root, expect } = options;
  const attempts = options.attempts ?? 3;
  let last: SmokeResult & { raced?: boolean } = {
    ok: false,
    commit: null,
    why: "no attempt was made",
  };
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    last = await smokeAttempt(home, root, expect, options.timeoutMs ?? 30_000);
    if (last.ok || !last.raced) return strip(last);
  }
  return strip(last);
}

/** The retry flag is an implementation detail of `smokeTest`; callers get a
 * verdict, not a diagnosis of how many ports were tried. */
function strip(result: SmokeResult & { raced?: boolean }): SmokeResult {
  return { ok: result.ok, why: result.why, commit: result.commit };
}

async function smokeAttempt(
  home: string,
  root: string,
  expect: string,
  timeoutMs: number,
): Promise<SmokeResult & { raced?: boolean }> {
  await fs.mkdir(paths.buildsDir(home), { recursive: true });
  const scratch = await fs.mkdtemp(path.join(paths.buildsDir(home), ".smoke-"));
  const bin = path.join(root, "packages", "cli", "bin", "isocan.js");
  const logFile = path.join(scratch, "smoke.log");
  const port = await freePort();
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ISOCAN_HOME: scratch,
    ISOCAN_PORT: String(port),
  };
  /**
   * The candidate must answer for ITSELF, not for the machine's configuration.
   * A home URL would have it dial out; a cloud store would have it write to
   * somebody's Firestore; a wide bind would put an untested build on the
   * network for the length of the test. All four are innkeeper configuration
   * that has no business reaching a candidate nobody has approved yet.
   */
  delete env.ISOCAN_HOME_URL;
  delete env.ISOCAN_STORE;
  delete env.ISOCAN_BIND;
  env.ISOCAN_CONTENT_PORT = "off";
  const log = await fs.open(logFile, "a");
  const child = spawn(process.execPath, [bin, "serve", "--foreground"], {
    stdio: ["ignore", log.fd, log.fd],
    env,
  });
  /**
   * The one line of a crash worth repeating back.
   *
   * The LAST line is the obvious choice and it is the wrong one: node ends an
   * uncaught exception with its own version, so "it exited before answering
   * (Node.js v24.11.0)" is what a person gets told about a build that could
   * not find `@isocan/server` — a true statement that names nothing. The error
   * line itself is what they need, so it is preferred, and the last line
   * remains the fallback for output that has no error line at all.
   */
  const tail = async (): Promise<string> => {
    try {
      const lines = (await fs.readFile(logFile, "utf8")).trim().split("\n").filter(Boolean);
      const said = lines.find((line) => /(^|\s)[A-Za-z]*Error\b/.test(line))?.trim();
      return said ?? lines.at(-1)?.trim() ?? "no output";
    } catch {
      return "no output";
    }
  };
  const done = async (
    result: SmokeResult & { raced?: boolean },
  ): Promise<SmokeResult & { raced?: boolean }> => {
    await stopChild(child);
    await log.close().catch(() => {});
    await fs.rm(scratch, { recursive: true, force: true });
    return result;
  };
  try {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const health = await healthOn(port);
      if (health) {
        const said = plausibleSha(health.commit ?? undefined);
        if (said === expect) return await done({ ok: true, why: "", commit: said });
        return await done({
          ok: false,
          commit: said,
          why: `it started and reported ${said ?? "no commit at all"}, not ${expect}`,
        });
      }
      if (child.exitCode !== null || child.signalCode !== null) {
        const said = await tail();
        return await done({
          ok: false,
          commit: null,
          raced: /EADDRINUSE|already holds port|is held by something/i.test(said),
          why: `it exited before answering (${said})`,
        });
      }
      if (Date.now() >= deadline) {
        return await done({
          ok: false,
          commit: null,
          why: `it did not answer within ${Math.round(timeoutMs / 1000)}s (${await tail()})`,
        });
      }
      await sleep(100);
    }
  } catch (err) {
    return await done({ ok: false, commit: null, why: (err as Error).message });
  }
}

/** A port nothing is on, a moment ago. See `smokeTest` for why a guess is
 * acceptable here and how losing it is handled. */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen({ port: 0, host: "127.0.0.1" }, () => {
      const bound = probe.address();
      const port = bound && typeof bound !== "string" ? bound.port : 0;
      probe.close(() => (port > 0 ? resolve(port) : reject(new Error("no ephemeral port"))));
    });
  });
}

async function healthOn(port: number): Promise<{ commit?: string | null } | null> {
  const base = `http://127.0.0.1:${port}`;
  try {
    const res = await fetch(`${base}${healthPath(base)}`, { signal: AbortSignal.timeout(1000) });
    return res.ok ? ((await res.json()) as { commit?: string | null }) : null;
  } catch {
    return null;
  }
}

/** SIGTERM, and SIGKILL for a candidate that will not go. A smoke test that
 * left a daemon behind would be a stale daemon of exactly the kind this whole
 * project exists to prevent. */
async function stopChild(child: ReturnType<typeof spawn>): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
  try {
    child.kill("SIGTERM");
  } catch {
    return;
  }
  const killed = await Promise.race([exited.then(() => true), sleep(3000).then(() => false)]);
  if (!killed) {
    try {
      child.kill("SIGKILL");
    } catch {
      // already gone
    }
    await Promise.race([exited, sleep(1000)]);
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// ---------- fetching a build ----------

export interface InstallResult {
  ok: boolean;
  build: Build | null;
  /** Why it did not happen, or what happened. Always says something. */
  why: string;
}

/**
 * How the fetch actually runs. `spawnSync` by default; the seam exists so a
 * test can install a fixture into the staging prefix, which is the only way to
 * reach the cases that matter — npm can fetch exactly one build, so "two
 * builds", "a build that lies about its sha" and "a build that will not start"
 * are all unreachable through the real thing. Async is allowed for the same
 * reason: a fixture is written with `fs.promises`.
 */
export type RunResult = Pick<SpawnSyncReturns<string>, "status" | "stdout" | "stderr"> & {
  error?: Error;
};
export type Runner = (command: string, args: string[]) => RunResult | Promise<RunResult>;

/**
 * **`spawn`, not `spawnSync`, and the difference is load-bearing** (auto-
 * upgrade phase 4). A fetch takes tens of seconds, and from phase 4 one of its
 * callers is a process that is in the middle of a long-poll: `isocan wait`
 * applies an upgrade while parked. `spawnSync` blocks the event loop for the
 * whole install, so the park would stop answering, the presence heartbeat
 * would stop beating, and the canvas would show a frozen agent — for a minute,
 * on purpose, as a side effect of keeping itself current.
 */
const defaultRunner: Runner = (command, args) =>
  new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr?.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
    child.once("error", (error) => resolve({ status: 1, stdout, stderr, error }));
    child.once("close", (code) => resolve({ status: code ?? 1, stdout, stderr }));
  });

/**
 * **Fetch a build into `builds/<sha>`, or explain why not.**
 *
 * `want` is the sha the verdict named — what the home is running. It is a
 * PRECONDITION, not a request, and that is the constraint that shapes this
 * function: npm can fetch exactly one build, the tip of `#release`, and the
 * tip is not always what the home runs. When CI lags, the tip is older than
 * the home; installing it anyway would defeat using the home as the oracle
 * and start the flapping the design warns about — report, install nothing,
 * try again later. `want` of null means nobody named a sha (a machine with no
 * home, or an offline one), and then the tip is simply accepted.
 *
 * The check happens AFTER the fetch because it cannot happen before: the tip's
 * manifest is the only thing that knows which main commit the release was cut
 * from, and reading it means having it. What the check protects is the flip,
 * not the download — a mismatched tree is deleted and `current` never moves.
 */
export async function installBuild(options: {
  home: string;
  spec: string;
  want: string | null;
  npm?: string;
  run?: Runner;
}): Promise<InstallResult> {
  const { home, spec, want } = options;
  /**
   * **The build we were asked for may already be here**, and then there is
   * nothing to fetch. A rollback followed by a step forward is the ordinary
   * way this happens — the tree was smoke-tested when it landed and nothing
   * has touched it since — and re-downloading tens of megabytes to arrive at
   * a directory that already exists is the kind of waste that only shows up
   * on somebody's metered connection. Only when a sha was NAMED: with no
   * verdict there is nothing to check `builds/` against.
   */
  if (want) {
    const dir = paths.buildDir(home, want);
    if (await exists(paths.buildRoot(dir))) {
      const stat = await fs.stat(dir);
      return {
        ok: true,
        build: buildOf(home, want, stat.mtimeMs),
        why: `${want} is already on disk`,
      };
    }
  }
  const npm = options.npm ?? (process.platform === "win32" ? "npm.cmd" : "npm");
  const run = options.run ?? defaultRunner;
  const staging = paths.stagingBuildDir(home);
  await fs.rm(staging, { recursive: true, force: true });
  await fs.mkdir(staging, { recursive: true });
  const discard = async (why: string): Promise<InstallResult> => {
    await fs.rm(staging, { recursive: true, force: true });
    return { ok: false, build: null, why };
  };
  const done = await run(npm, ["install", "--prefix", staging, spec, "--no-audit", "--no-fund"]);
  if (done.status !== 0) {
    const said = (done.stderr || done.stdout || done.error?.message || "").trim();
    return await discard(
      `could not fetch ${spec} (${said.split("\n").pop() ?? "no output"}) — ` +
        "nothing was swapped; the copy you are running is untouched",
    );
  }
  let stamped: string | null = null;
  try {
    const manifest = JSON.parse(
      await fs.readFile(path.join(paths.buildRoot(staging), "package.json"), "utf8"),
    ) as { isocan?: { commit?: string } };
    stamped = plausibleSha(manifest.isocan?.commit);
  } catch {
    return await discard(
      `the tree fetched from ${spec} has no readable manifest — nothing was swapped`,
    );
  }
  if (!stamped) {
    return await discard(
      `the build at ${spec} does not say which commit it is, so nothing can check it — ` +
        "nothing was swapped",
    );
  }
  if (want && stamped !== want) {
    return await discard(
      `the release tip is ${stamped}, but your home runs ${want} — the release has not ` +
        "caught up yet. Nothing was installed; this will succeed once it has",
    );
  }
  const dir = paths.buildDir(home, stamped);
  if (await exists(dir)) {
    // Already here — a re-run, or a rollback that came back forward. The tree
    // on disk was smoke-tested when it landed; the fresh one is redundant.
    await fs.rm(staging, { recursive: true, force: true });
  } else {
    await fs.rename(staging, dir);
  }
  const stat = await fs.stat(dir);
  return { ok: true, build: buildOf(home, stamped, stat.mtimeMs), why: `${stamped} is on disk` };
}

// ---------- keeping three, and never one in use ----------

/**
 * Which builds a live daemon is running out of — the trees that must not be
 * deleted however old they are.
 *
 * The witness is this home's pidfile plus the health route: a pid that is
 * alive AND answers on its recorded port, reporting the root it loaded. That
 * is the same evidence `stopDaemons` insists on, and for the same reason — a
 * bare pid outlives its process and the number gets reused.
 *
 * **What it cannot see is a daemon under a different `ISOCAN_HOME`.** Nothing
 * on this machine records those, and inventing a cross-home registry to
 * protect them would be a new durable file for a case that is a developer
 * running two scratch homes. `keep` covers it in practice: three builds is
 * several days of a project that ships several times a day.
 */
export async function liveBuildShas(home: string): Promise<Set<string>> {
  const live = new Set<string>();
  let recorded: { pid?: number; port?: number };
  try {
    recorded = JSON.parse(await fs.readFile(paths.daemonFile(home), "utf8")) as {
      pid?: number;
      port?: number;
    };
  } catch {
    return live;
  }
  if (typeof recorded.pid !== "number" || typeof recorded.port !== "number") return live;
  try {
    process.kill(recorded.pid, 0);
  } catch {
    return live;
  }
  const health = (await healthOn(recorded.port)) as { root?: string } | null;
  const sha = health?.root ? shaOfRoot(home, health.root) : null;
  if (sha) live.add(sha);
  return live;
}

/**
 * The build a path belongs to, or null when it is outside `builds/`.
 *
 * **Both sides are resolved through their symlinks first, and that is the
 * whole of the care here.** A daemon reports `buildStamp().root`, which node
 * has already realpath'd on its way to loading the module; `ISOCAN_HOME` is
 * whatever a person or a test typed. On macOS those two spellings differ for
 * every temporary directory in existence — `/tmp` is a symlink to
 * `/private/tmp`, `$TMPDIR` to `/private/var/folders/…` — so comparing them
 * literally answers "not one of ours" about a tree that plainly is, and the
 * consequence of that wrong answer is deleting a build out from under a
 * running daemon. Found by a test that started a real process and asked.
 */
export function shaOfRoot(home: string, root: string): string | null {
  const relative = path.relative(resolved(paths.buildsDir(home)), resolved(root));
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  const sha = relative.split(path.sep)[0];
  return sha && sha.length > 0 ? sha : null;
}


/**
 * Delete the builds nobody needs, and only those. Returns what went.
 *
 * Three are kept because `--rollback` needs one behind and a bisect needs room
 * to move; `protect` is the hard rule the count does not override — a tree a
 * process is running out of is never deleted, however old, because deleting it
 * does not stop that process, it breaks it.
 */
export async function pruneBuilds(
  home: string,
  options: { keep?: number; protect?: Iterable<string> } = {},
): Promise<string[]> {
  const keep = options.keep ?? 3;
  const protect = new Set(options.protect ?? []);
  const current = await currentSha(home);
  if (current) protect.add(current);
  const builds = await listBuilds(home);
  const removed: string[] = [];
  let kept = 0;
  for (const build of builds) {
    if (protect.has(build.sha)) {
      kept += 1;
      continue;
    }
    if (kept < keep) {
      kept += 1;
      continue;
    }
    await fs.rm(build.dir, { recursive: true, force: true });
    removed.push(build.sha);
  }
  return removed;
}

/**
 * **Give the copy that is being adopted a name in `builds/`, so the first
 * upgrade is reversible like every one after it.**
 *
 * Without this, adoption is the one upgrade with no way back: `current` moves
 * to the new build, PATH follows it, and `--rollback` finds `builds/` holding
 * exactly one entry and says there is nowhere to go. The old tree is still on
 * disk — nothing deleted it — but nothing can reach it either, and the moment
 * it is least reachable is the first unattended upgrade on a machine nobody
 * is watching, which is the whole population this project was written for.
 *
 * **It is a symlink, not a copy.** `builds/<sha>` is an npm PREFIX, and a
 * global install is already laid out as one: `<prefix>/lib/node_modules/
 * isocan` is exactly what `builds/<sha>/node_modules/isocan` has to resolve
 * to, so pointing at `<prefix>/lib` costs one inode instead of duplicating
 * four hundred packages. "The global copy is left in place" stays literally
 * true — it is not moved, not rewritten, and `npm uninstall -g` still knows
 * about it. What it gains is a second name.
 *
 * Returns the shelved build, or null when there is nothing to shelve: the sha
 * is unknown (a copy that cannot say which build it is cannot be rolled back
 * TO either), or `builds/` already has an entry under that name.
 */
export async function shelveExisting(
  home: string,
  root: string,
  sha: string | null,
): Promise<Build | null> {
  if (!sha) return null;
  const dir = paths.buildDir(home, sha);
  if (await exists(dir)) return null;
  // `<prefix>/lib/node_modules/isocan` → `<prefix>/lib`, the prefix shape
  // `builds/<sha>` is. Refuse anything that is not laid out that way rather
  // than linking at a guess.
  const prefix = path.resolve(root, "..", "..");
  if (!(await exists(paths.buildRoot(prefix)))) return null;
  await fs.mkdir(paths.buildsDir(home), { recursive: true });
  try {
    await fs.symlink(prefix, dir, process.platform === "win32" ? "junction" : "dir");
  } catch {
    return null;
  }
  const stat = await fs.stat(dir);
  return buildOf(home, sha, stat.mtimeMs);
}

// ---------- adoption ----------

export interface Adoption {
  /** Did `isocan` on PATH end up resolving through `current`? */
  managed: boolean;
  /** Was it moved by this call (as opposed to already being there)? */
  moved: boolean;
  bin: string | null;
  why: string;
}

/**
 * **Make `isocan` on PATH resolve through `current`.**
 *
 * This is the whole of "adoption", and it is one symlink: the global bin entry
 * npm wrote — `<prefix>/bin/isocan` → `<prefix>/lib/node_modules/isocan/…` —
 * is replaced by one pointing at `~/.isocan/current/…`. Because `current` is
 * itself a symlink, every later upgrade is a flip that PATH follows for free,
 * and `rootOfBin`'s `realpath` reaches `builds/<sha>` — which is why
 * `stalenessOf`'s root comparison starts working here without being told.
 *
 * **The global package tree is not touched.** It stays installed, exactly as
 * npm left it, and `npm uninstall -g isocan` still knows about it. What moves
 * is one link.
 *
 * Two copies are refused rather than adopted, and the refusals matter more
 * than the success: a CHECKOUT on PATH (`npm link`) is somebody's working
 * copy and this machinery never modifies one, and an NPX cache is a directory
 * npm is about to delete.
 */
/**
 * **Where npm put the bin for a global install, derived rather than searched.**
 *
 * npm's global layout is `<prefix>/lib/node_modules/<pkg>` and
 * `<prefix>/bin/<bin>`, so a package root names its own bin exactly. Asking
 * PATH instead answers a different question — "which isocan would a shell run"
 * — and on a machine with more than one copy that is somebody else's link.
 * The unattended path in particular must repoint the install it is replacing
 * and nothing else: it runs with no one watching, and a swap that repointed a
 * checkout's `npm link` would be this machinery modifying a working copy,
 * which is the one thing it must never do.
 */
export function binOfInstall(root: string): string {
  const prefix = path.resolve(root, "..", "..", "..");
  return process.platform === "win32"
    ? path.join(prefix, "isocan.cmd")
    : path.join(prefix, "bin", "isocan");
}

export async function adoptGlobal(
  home: string,
  bin: string | null = findOnPath("isocan"),
): Promise<Adoption> {
  const target = path.join(
    paths.currentLink(home),
    "node_modules",
    "isocan",
    "packages",
    "cli",
    "bin",
    "isocan.js",
  );
  if (!bin) {
    return {
      managed: false,
      moved: false,
      bin: null,
      why: `isocan is not on your PATH — point it at ${target}`,
    };
  }
  let linked: string | null = null;
  try {
    linked = await fs.readlink(bin);
  } catch {
    // A regular file: npm's Windows shims, or a wrapper somebody wrote.
  }
  if (linked && path.resolve(path.dirname(bin), linked) === path.resolve(target)) {
    return { managed: true, moved: false, bin, why: `${bin} already resolves through current` };
  }
  const kind = (await whichInstall(rootOfBin(bin), home)).kind;
  if (kind === "checkout") {
    return {
      managed: false,
      moved: false,
      bin,
      why: `${bin} is a checkout (${rootOfBin(bin)}) — that is your working copy, and this never modifies one`,
    };
  }
  if (kind === "npx") {
    return {
      managed: false,
      moved: false,
      bin,
      why: `${bin} runs from an npx cache, which npm deletes — \`npm i -g\` first, then upgrade`,
    };
  }
  if (process.platform === "win32" && !linked) {
    return {
      managed: false,
      moved: false,
      bin,
      why: `${bin} is a shim, not a symlink — Windows adoption is not built (auto-upgrade phase 3)`,
    };
  }
  const tmp = `${bin}.isocan-tmp-${process.pid}`;
  try {
    await fs.rm(tmp, { force: true });
    await fs.symlink(target, tmp);
    await fs.rename(tmp, bin);
  } catch (err) {
    await fs.rm(tmp, { force: true }).catch(() => {});
    return {
      managed: false,
      moved: false,
      bin,
      why: `could not repoint ${bin} (${(err as Error).message}) — the build is installed, but PATH still finds the old copy`,
    };
  }
  return { managed: true, moved: true, bin, why: `${bin} now resolves through ${paths.currentLink(home)}` };
}

async function exists(target: string): Promise<boolean> {
  return fs.stat(target).then(
    () => true,
    () => false,
  );
}

// ---------- applying it: the mode, the lock, and the swap ----------
//
// Auto-upgrade phase 4. Phase 3 built the mechanism and gave it one caller —
// a person typing `isocan upgrade`. What follows is what lets it run when
// nobody is typing anything, which is the population the whole project was
// written for.

/**
 * **What this machine is allowed to do about an upgrade.**
 *
 * - `auto` — apply it, at the points that are idle by construction.
 * - `notify` — say so and stop. The decision belongs to a person, and an agent
 *   that upgrades itself in notify mode has re-implemented auto mode without
 *   its controls.
 * - `off` — say nothing about applying, and apply nothing.
 */
export type UpgradeMode = "auto" | "notify" | "off";

/** The keys phase 4 reads from `~/.isocan/config.json`. */
export interface UpgradeConfig {
  upgrade?: UpgradeMode;
  /**
   * A build this machine has been held on. It is a sha in `builds/`, never an
   * arbitrary commit: reaching further would mean building from source, which
   * is a separate project rather than a flag.
   */
  upgradePin?: string;
}

export interface UpgradePolicy {
  mode: UpgradeMode;
  pin: string | null;
  /** One clause naming what decided this, for `isocan status`. A mode nobody
   * can account for is a mode nobody trusts. */
  why: string;
}

const MODES: readonly UpgradeMode[] = ["auto", "notify", "off"];

export function isUpgradeMode(value: unknown): value is UpgradeMode {
  return typeof value === "string" && (MODES as readonly string[]).includes(value);
}

/**
 * **`auto` is the managed install's default, and only the managed install's.**
 *
 * The argument for a default this strong is in the phase document and worth
 * restating where it is implemented: in notify mode, applying an upgrade takes
 * four steps on an unattended machine — the notice appears, the agent reports
 * it, a person approves, the agent runs the command — and that chain never
 * completes on the machines nobody watches, which is the normal case. A notify
 * default would deny this feature to exactly the machines that need it.
 *
 * Safety does not come from the mode. It comes from the smoke test, the kept
 * builds and the pin.
 *
 * **Everything that is not a managed install gets `notify`**, and a checkout
 * gets it by construction: this machinery never modifies a working copy.
 * A global install that has not been adopted yet also gets it — the first
 * adoption stays a thing somebody asked for.
 *
 * Precedence: the environment (one shell), then the file (one machine), then
 * the default (the kind of install). The environment goes first because
 * `ISOCAN_NO_UPGRADE=1` is what somebody reaches for when they need this to
 * stop right now, and a control you have to edit a file to use is not that.
 */
export async function upgradePolicy(home: string, kind: InstallKind): Promise<UpgradePolicy> {
  const config = await readConfigFile<UpgradeConfig>(home);
  const pin = plausibleSha(config.upgradePin);
  const held = pin ? `, pinned to ${pin}` : "";
  const halted = process.env.ISOCAN_NO_UPGRADE?.trim();
  if (halted && halted !== "0") {
    return { mode: "off", pin, why: `ISOCAN_NO_UPGRADE is set in this shell${held}` };
  }
  /**
   * **A checkout is never `auto`, whatever the file says.** Every other
   * control here is a preference; this one is the rule the whole project turns
   * on — this machinery does not modify somebody's working copy. `config.json`
   * is per-machine and a developer's machine is the one most likely to have
   * been set to `auto` for a managed install months earlier and then have a
   * checkout put on its PATH with `npm link`. Downgrading rather than
   * refusing, because there is nothing wrong with wanting the notice.
   */
  if (kind === "checkout" && config.upgrade === "auto") {
    return {
      mode: "notify",
      pin,
      why: `config.json says auto, but this is a checkout — a working copy is never upgraded for you${held}`,
    };
  }
  if (isUpgradeMode(config.upgrade)) {
    return { mode: config.upgrade, pin, why: `config.json says ${config.upgrade}${held}` };
  }
  /**
   * **A global install is `auto` too, and its first upgrade is what adopts
   * it.** The front door's `setup` runs `npm i -g`, so a global install is
   * what EVERY machine that came through the front door is — Priya's included,
   * and Priya is the person this project was written for. Leaving that on
   * `notify` denied the outcome to the whole population it exists for, on the
   * reasoning that "the first adoption stays a thing somebody asked for": a
   * caution that sounds careful and is not, because the thing it makes
   * somebody ask for is the step that makes every later step unattended.
   *
   * Journey Scene 0 had already decided this — *"after phase 4, `auto` closes
   * the gap on her machine before it grows"* — and names the two populations
   * that keep the notice: a checkout, and a machine where somebody chose
   * `notify`. A fresh install is neither.
   *
   * What adoption actually risks is one symlink in the global bin directory,
   * which is the only write this project makes outside `~/.isocan`. It is
   * reversible by the command that created it (`npm i -g` rewrites that link),
   * it leaves the package tree npm installed exactly where npm put it, and it
   * happens only after a build has been installed aside and started and asked
   * which commit it is. `adoptGlobal` refuses a checkout, refuses an npx
   * cache, and reports a permission failure rather than throwing.
   */
  if (kind === "managed" || kind === "global") {
    return {
      mode: "auto",
      pin,
      why: `the default for a ${kind} install${held}`,
    };
  }
  /**
   * **`npx` and `local` keep the notice, for reasons that are not caution.**
   * An npx cache is a directory npm is about to delete, so a build installed
   * into it is thrown away and PATH never resolved through it anyway. A
   * `local` copy is somebody's `node_modules/isocan` inside another project,
   * and the `isocan` on PATH is very likely a different copy — adopting would
   * repoint a link this copy has no claim on.
   */
  return {
    mode: "notify",
    pin,
    why: `the default for a ${kind} install — it is not a copy that can adopt itself${held}`,
  };
}

/**
 * **One upgrade at a time on this machine.**
 *
 * Phase 3 had one caller and it was a person; phase 4 has three, and two of
 * them fire without anybody asking. Two of them at once share `builds/.staging`
 * and would race the flip — so the whole swap is taken under a directory
 * created with `mkdir`, which is atomic everywhere this runs.
 *
 * A lock whose owner is gone is not a lock: the pid is recorded, and a lock
 * naming a process that no longer exists is taken over rather than waited on.
 * The alternative is a machine that stops upgrading forever because something
 * was once killed at the wrong moment — a failure that would be invisible for
 * weeks, which is the failure mode this project keeps finding.
 */
export async function withUpgradeLock<T>(
  home: string,
  work: () => Promise<T>,
): Promise<T | null> {
  const lock = path.join(paths.buildsDir(home), ".lock");
  await fs.mkdir(paths.buildsDir(home), { recursive: true });
  const claim = async (): Promise<boolean> => {
    try {
      await fs.mkdir(lock);
      await fs.writeFile(path.join(lock, "pid"), String(process.pid));
      return true;
    } catch {
      return false;
    }
  };
  if (!(await claim())) {
    const owner = Number(await fs.readFile(path.join(lock, "pid"), "utf8").catch(() => ""));
    const alive = Number.isInteger(owner) && owner > 0 && isAlive(owner);
    if (alive) return null;
    await fs.rm(lock, { recursive: true, force: true });
    if (!(await claim())) return null;
  }
  try {
    return await work();
  } finally {
    await fs.rm(lock, { recursive: true, force: true }).catch(() => {});
  }
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * **Adoption is a global install's step and only a global install's.** A
 * managed copy already resolves through `current` — that is what managed
 * means — and `binOfInstall` would not even name the right file for one, since
 * its root is not laid out as an npm prefix. Everything else is a copy this
 * machinery does not own: a checkout is somebody's working tree, an npx cache
 * is about to be deleted, and a `local` copy has no claim on the `isocan` a
 * shell would run.
 */
async function adopt(home: string, install?: Install): Promise<Adoption | null> {
  if (install?.kind !== "global") return null;
  return adoptGlobal(home, binOfInstall(install.root));
}

/** Where a swap stopped, so a caller can say something true about it without
 * parsing a sentence. */
export type SwapStep = "locked" | "fetch" | "smoke" | "done" | "current";

export interface SwapOutcome {
  ok: boolean;
  step: SwapStep;
  from: string | null;
  to: string | null;
  /** Always says something, including when it succeeded. */
  why: string;
  removed: string[];
  /** The outgoing copy, given a name in `builds/` so it can be rolled back to. */
  shelved: string | null;
  /**
   * **Whether `isocan` on PATH ends up resolving through `current`** — which is
   * the difference between a swap that happened and a swap that took effect.
   * Null when no swap was attempted.
   */
  adoption: Adoption | null;
}

/**
 * **Install aside, prove it, flip one symlink, keep three.** The mechanism,
 * with no opinion about who asked for it and nothing printed: `isocan upgrade`
 * narrates it, and phase 4's unattended points report it in a wake message.
 * One implementation, because two would drift and only one of them would be
 * the one running while nobody watches.
 */
export async function applySwap(options: {
  home: string;
  spec: string;
  want: string | null;
  /**
   * The copy being replaced. Given one, the swap SHELVES it first and ADOPTS
   * afterwards — the two steps that make a flip take effect on a machine whose
   * PATH does not already run through `current`.
   *
   * **These belong here and nowhere else, and that is not a style
   * preference.** They lived in `isocan upgrade`'s own code path for a day, so
   * the unattended path fetched a build, smoke-tested it, flipped `current`,
   * and left PATH pointing at the old copy — an upgrade that reported success
   * and changed nothing, on the front-door population, which is every machine
   * that came through `npm i -g`. The comment on this function already claimed
   * one implementation because two would drift; two steps had been left
   * outside it, and they drifted.
   */
  install?: Install;
  protect?: Iterable<string>;
  keep?: number;
  run?: Runner;
}): Promise<SwapOutcome> {
  const { home, spec, want } = options;
  const taken = await withUpgradeLock(home, async (): Promise<SwapOutcome> => {
    const from = await currentSha(home);
    /**
     * Before anything is fetched, so a first upgrade is as reversible as every
     * later one — and before the lock is given up, so two processes cannot
     * both decide they are the outgoing copy.
     */
    const shelved = options.install
      ? await shelveExisting(home, options.install.root, buildStamp().commit)
      : null;
    const idle = { shelved: shelved?.sha ?? null, adoption: null };
    const fetched = await installBuild({
      home,
      spec,
      want,
      ...(options.run ? { run: options.run } : {}),
    });
    if (!fetched.ok || !fetched.build) {
      return { ok: false, step: "fetch", from, to: null, why: fetched.why, removed: [], ...idle };
    }
    const build = fetched.build;
    if (build.sha === from) {
      // Already current, but PATH may still not run through it — which is the
      // whole of what adoption is, and the case a machine sits in forever if
      // this returns before doing it.
      return {
        ok: true,
        step: "current",
        from,
        to: build.sha,
        why: `${build.sha} is already the current build`,
        removed: [],
        shelved: shelved?.sha ?? null,
        adoption: await adopt(home, options.install),
      };
    }
    const smoke = await smokeTest({ home, root: build.root, expect: build.sha });
    if (!smoke.ok) {
      return {
        ok: false,
        step: "smoke",
        from,
        to: build.sha,
        why:
          `${build.sha} did not start cleanly — ${smoke.why}. Nothing was swapped: ` +
          `you are still on ${from ?? "the copy you were on"}. The tree is at ${build.dir} ` +
          "if you want to look at it",
        removed: [],
        ...idle,
      };
    }
    await flipTo(home, build.sha);
    // The flip moved `current`; adoption is what moves PATH onto it. A flip
    // without it is a build nothing resolves to.
    const adoption = await adopt(home, options.install);
    const protect = await liveBuildShas(home);
    for (const sha of options.protect ?? []) protect.add(sha);
    const removed = await pruneBuilds(home, {
      protect,
      ...(options.keep !== undefined ? { keep: options.keep } : {}),
    });
    return {
      ok: true,
      step: "done",
      from,
      to: build.sha,
      why: `now on ${build.sha}${from ? ` (was ${from})` : ""}`,
      removed,
      shelved: shelved?.sha ?? null,
      adoption,
    };
  });
  return (
    taken ?? {
      ok: false,
      step: "locked",
      from: null,
      to: null,
      why: "another isocan process is already installing a build — leaving this one to it",
      removed: [],
      shelved: null,
      adoption: null,
    }
  );
}

/**
 * **An upgrade applied at a moment that is idle by construction** (auto-
 * upgrade phase 4). Returns the line to report, or null when nothing was done
 * — and it never throws, because every one of its callers is doing something
 * else and none of them should fail because a fetch did.
 *
 * The three callers are the three idle points, and they are idle for different
 * reasons: an agent parked in `isocan wait` is idle by definition; `isocan
 * restart` already means "come back on current code"; and `ensureDaemon`
 * starting a daemon is a fresh process either way. Nothing here has to guess
 * whether a swap is safe, which is the whole reason the points were chosen
 * rather than a timer.
 *
 * **A failure is remembered, and that matters more than it looks.** Without
 * the marker, a build that cannot start would be re-fetched and re-tested at
 * every park — tens of megabytes and half a minute, forever, on a machine
 * nobody is watching. The marker is keyed on the target sha, so the next build
 * the home cuts is tried immediately.
 */
export async function autoUpgrade(options: {
  home: string;
  install: Install;
  health: { upgrade?: UpgradeVerdict } | null;
  spec: string;
  /** Builds the caller knows are in use — its own, usually. */
  protect?: Iterable<string>;
}): Promise<string | null> {
  const { home, install, health, spec } = options;
  try {
    const verdict = health?.upgrade;
    if (!verdict?.available) return null;
    // A home on the OLDER build is a notice, never a downgrade. Downgrades
    // happen from `builds/`, on a person's command.
    if (verdict.direction === "ahead") return null;
    const policy = await upgradePolicy(home, install.kind);
    if (policy.mode !== "auto") return null;
    if (policy.pin) return null;

    if ((await lastRefusal(home))?.sha === verdict.homeCommit) return null;
    const swapped = await applySwap({
      home,
      spec,
      want: verdict.homeCommit,
      install,
      ...(options.protect ? { protect: options.protect } : {}),
    });
    if (swapped.step === "locked" || swapped.step === "current") return null;
    if (!swapped.ok) {
      await fs
        .writeFile(
          refusalFile(home),
          JSON.stringify({ sha: verdict.homeCommit, why: swapped.why, at: new Date().toISOString() }),
        )
        .catch(() => {});
      return `isocan: could not upgrade to ${verdict.homeCommit} — ${swapped.why}`;
    }
    await fs.rm(refusalFile(home), { force: true }).catch(() => {});
    /**
     * **"On the new build", stated precisely, twice over.**
     *
     * No symlink flip moves a running process, so the process reading this
     * line is still the old one — telling an agent otherwise, when it is about
     * to re-read a guide that ships inside the build, would be a lie it would
     * act on.
     *
     * And the *next* command is only on the new build if PATH was repointed.
     * That sentence was written when it could not fail, because adoption
     * happened in a code path this one did not run: a machine could be told
     * its next command was on the new build while `isocan` on PATH still
     * resolved to the old copy, permanently. So the claim is now made only
     * when the adoption that backs it succeeded, and the other case says what
     * to do about it.
     */
    const swap = `upgraded to ${swapped.to}${swapped.from ? ` from ${swapped.from}` : ""}`;
    if (swapped.adoption && !swapped.adoption.managed) {
      return (
        `isocan: ${swap} while you were parked, but \`isocan\` on your PATH still ` +
        `resolves to the old copy — ${swapped.adoption.why}. Until that is fixed every ` +
        "command you run is the old build, whatever `current` says."
      );
    }
    return (
      `isocan: ${swap} while you were parked. This process is still running the old ` +
      "build — the next command you run is on the new one, so re-read your guide " +
      "(`isocan agent-guide`) before acting on anything that depends on it."
    );
  } catch (err) {
    // A courtesy must never be the reason a park, a restart or a daemon start
    // fails.
    return `isocan: upgrade attempt failed — ${(err as Error).message}`;
  }
}

/**
 * **The last build this machine refused, and why** — journey Scene 2's "a
 * refused build is always reported".
 *
 * The record exists for two jobs and it is worth being explicit that they are
 * different. The first is not repeating work: without it a build that cannot
 * start is re-fetched and re-tested at every park, forever, on a machine
 * nobody is watching. The second is being answerable — `isocan status` reads
 * this, because a refusal that was reported once into a transcript nobody kept
 * is a machine that silently stopped upgrading.
 *
 * Keyed on the sha, so the next build the home cuts is tried at once rather
 * than inheriting the last one's verdict.
 */
export interface Refusal {
  sha: string;
  why: string;
  at: string;
}

const refusalFile = (home: string) => path.join(home, ".upgrade-failed");

export async function lastRefusal(home: string): Promise<Refusal | null> {
  try {
    const raw = JSON.parse(await fs.readFile(refusalFile(home), "utf8")) as Partial<Refusal>;
    return typeof raw.sha === "string" && typeof raw.why === "string"
      ? { sha: raw.sha, why: raw.why, at: typeof raw.at === "string" ? raw.at : "" }
      : null;
  } catch {
    // Absent (nothing has been refused) or unreadable (a file nobody should
    // have been editing). Both mean the same thing here: no refusal to report.
    return null;
  }
}
