import { promises as fs } from "node:fs";
import { spawn, type SpawnSyncReturns } from "node:child_process";
import { spawnSync } from "node:child_process";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { healthPath } from "@isocan/core";
import { paths, plausibleSha } from "@isocan/server";
import { findOnPath, rootOfBin } from "./onpath.ts";
import { resolved, whichInstall } from "./upgrade.ts";

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
export async function smokeTest(
  root: string,
  expect: string,
  options: { timeoutMs?: number; attempts?: number } = {},
): Promise<SmokeResult> {
  const attempts = options.attempts ?? 3;
  let last: SmokeResult & { raced?: boolean } = {
    ok: false,
    commit: null,
    why: "no attempt was made",
  };
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    last = await smokeAttempt(root, expect, options.timeoutMs ?? 30_000);
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
  root: string,
  expect: string,
  timeoutMs: number,
): Promise<SmokeResult & { raced?: boolean }> {
  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-smoke-"));
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

const defaultRunner: Runner = (command, args) =>
  spawnSync(command, args, { encoding: "utf8" });

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
