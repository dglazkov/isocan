#!/usr/bin/env node
/**
 * **Watch both things that change, and refresh the board when either does.**
 *
 *   npm run board:watch
 *
 * Two sources, because the question was about two:
 *
 *   1. **The repository.** `git` — HEAD moving, whether that was a commit here,
 *      a `pull`, a rebase, or a checkout by another agent. The `post-commit`
 *      hook already covers a commit made in this tree; this covers everything
 *      else, and it covers the commit too on a machine where nobody installed
 *      the hook.
 *   2. **The repo's own canvas** — the one `.isocan/project.json` names, which
 *      is a committed marker and so is the same canvas for everybody who clones.
 *      Watched with `isocan wait --all-ops`, which is the daemon telling us
 *      rather than us asking it.
 *
 * **This runs in the foreground, and says what it is doing.** A detached
 * watcher whose output goes nowhere is precisely the failure this repo just
 * had: the `post-commit` hook failed on all eleven of its first eleven runs and
 * announced it only into a log nobody was reading. So: one process, one
 * terminal, a line per wake.
 *
 * **Debounced.** A person dragging twelve items writes twelve ops, and twelve
 * board refreshes would be twelve versions of every panel — the silting the
 * design note warns about, arriving through the watcher instead of the
 * generator. One refresh per quiet period.
 */
import { execFileSync, spawn } from "node:child_process";
import { existsSync, readFileSync, watch } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { boardEnv } from "./board-identity.mjs";

const repo = fileURLToPath(new URL("..", import.meta.url));
/**
 * **The watcher parks as the BOARD, never as whoever launched it.** `isocan
 * wait` does not wake you on your own ops — so a watcher wearing the launching
 * agent's identity is blind to precisely the changes that agent makes, which
 * is most of them. Caught by watching it miss a text node this session created.
 */
const env = boardEnv();
const cli = path.join(repo, "packages/cli/bin/isocan.js");
const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : fallback;
};
/** Long enough that a burst of ops is one refresh, short enough to feel live. */
const QUIET_MS = Number(arg("--quiet", 4000));
/** Each `wait` is a child; a short park just means more laps. */
const PARK_S = Number(arg("--park", 300));

const say = (...m) => console.log(new Date().toISOString().slice(11, 19), ...m);
const git = (...a) => execFileSync("git", a, { cwd: repo, encoding: "utf8" }).trim();

const canvasOf = (file, key) => {
  const at = path.join(repo, ".isocan", file);
  if (!existsSync(at)) return undefined;
  try {
    return JSON.parse(readFileSync(at, "utf8"))[key];
  } catch {
    return undefined;
  }
};
const repoCanvas = canvasOf("project.json", "projectId");
const boardCanvas = canvasOf("board.json", "canvas");

if (!boardCanvas) {
  console.error("no board canvas — write .isocan/board.json first (see scripts/canvas-board.mjs)");
  process.exit(2);
}

/* ── the refresh, debounced and never overlapping ────────────────────────── */

let timer;
let running = false;
let again = false;
const reasons = new Set();

/**
 * **Never two refreshes at once.** They would race on the same panels and the
 * loser would stack a version of something already stale. A change that
 * arrives mid-run sets `again` instead, so nothing is dropped either.
 */
function refresh() {
  if (running) {
    again = true;
    return;
  }
  running = true;
  const why = [...reasons].join(", ") || "change";
  reasons.clear();
  say(`refreshing — ${why}`);
  const child = spawn("node", [path.join(repo, "scripts/canvas-board.mjs"), "--notify"], {
    cwd: repo,
    stdio: ["ignore", "inherit", "inherit"],
    env,
  });
  child.on("exit", (code) => {
    running = false;
    // Non-zero is one thing only: an instrument that would not run. Said out
    // loud rather than swallowed, because a watcher that hides a broken
    // instrument is worse than no watcher.
    if (code !== 0) say(`board exited ${code} — an instrument would not run`);
    if (again) {
      again = false;
      schedule("changes arrived while refreshing");
    }
  });
}

function schedule(reason) {
  reasons.add(reason);
  clearTimeout(timer);
  timer = setTimeout(refresh, QUIET_MS);
}

/* ── source 1: the repository ────────────────────────────────────────────── */

let head = git("rev-parse", "HEAD");
const gitDir = path.resolve(repo, git("rev-parse", "--git-dir"));

/**
 * `fs.watch` on the git directory rather than a poll. It fires for far more
 * than HEAD — index writes, lock files, packs — so the HEAD it is watching for
 * is re-read and compared rather than assumed. That comparison is the whole
 * filter, and it is why an ordinary `git status` does not wake the board.
 */
function pollHead(why) {
  let now;
  try {
    now = git("rev-parse", "HEAD");
  } catch {
    return; // mid-rebase, mid-checkout: ask again next event
  }
  if (now === head) return;
  const subject = git("log", "-1", "--pretty=%s");
  head = now;
  say(`repo → ${now.slice(0, 7)} ${subject}`);
  schedule(`repo moved to ${now.slice(0, 7)}`);
}

try {
  watch(gitDir, { persistent: true }, (_e, file) => {
    if (!file || /^(HEAD|ORIG_HEAD|refs|packed-refs)/.test(String(file))) pollHead(String(file));
  });
  say(`watching the repository at ${gitDir}`);
} catch (err) {
  say(`could not watch ${gitDir} — ${err.message}`);
}
// A belt for filesystems where watch misses things (network mounts, some
// containers). Cheap: one `rev-parse` a minute.
setInterval(() => pollHead("poll"), 60_000).unref?.();

/* ── source 2: the repo's own canvas ─────────────────────────────────────── */

/**
 * One `wait --all-ops` after another. `wait` already survives a daemon
 * restart on its own, so there is no supervisor loop here beyond re-parking:
 * exit 2 is a timeout and means nothing arrived.
 */
async function watchCanvas(id) {
  say(`watching canvas ${id} for every op`);
  for (;;) {
    const code = await new Promise((done) => {
      const child = spawn(
        "node",
        [cli, "--canvas", id, "wait", "--all-ops", "--json", "--timeout", String(PARK_S)],
        { cwd: repo, stdio: ["ignore", "pipe", "pipe"], env },
      );
      let out = "";
      child.stdout.on("data", (d) => (out += d));
      child.stderr.on("data", () => {});
      child.on("exit", (c) => {
        if (c === 0) {
          const n = (() => {
            try {
              return JSON.parse(out).entries?.length ?? 0;
            } catch {
              return 0;
            }
          })();
          say(`canvas ${id} → ${n} op${n === 1 ? "" : "s"}`);
          schedule(`${n} op${n === 1 ? "" : "s"} on ${id}`);
        }
        done(c);
      });
    });
    // 0 = something came, 2 = nothing came. Anything else is the daemon being
    // unreachable; wait a beat rather than spinning on it.
    if (code !== 0 && code !== 2) {
      say(`wait exited ${code} — the daemon may be down; retrying in 10s`);
      await new Promise((r) => setTimeout(r, 10_000));
    }
  }
}

if (repoCanvas) {
  watchCanvas(repoCanvas);
} else {
  say("no .isocan/project.json — this directory names no canvas of its own, so only the repo is watched");
}

say(`board is ${boardCanvas}; debounce ${QUIET_MS}ms. Ctrl-C to stop.`);
schedule("first run");
