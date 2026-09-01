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
 *      Tailed through the API (`canvas.tail()`, iso-api journey 2): one async
 *      iterator in this process. No `isocan wait` children, no re-parking loop —
 *      the watcher holds no process but its own.
 *
 * **The cursor is this script's own.** `tail({ since })` keeps the cursor with
 * the caller, and each entry carries its seq — so the last seq handled is
 * written to `.isocan/board-watch.json` (git-ignored, per-machine), and a
 * watcher that dies resumes where it stopped: kill it after entry N, and the
 * first entry the next run handles is N+1. A daemon restart is not even that —
 * the tail rides it out on an unchanged cursor and yields nothing for the
 * reconnect.
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
import { existsSync, readFileSync, watch, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { register } from "tsx/esm/api";
import { BOARD_IDENTITY } from "./board-identity.mjs";

// The bin's own trick, same as canvas-board.mjs: register tsx so the
// workspace's TypeScript sources import directly, then load the API.
register();
const { connect } = await import("@isocan/api");

const repo = fileURLToPath(new URL("..", import.meta.url));
const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : fallback;
};
/** Long enough that a burst of ops is one refresh, short enough to feel live. */
const QUIET_MS = Number(arg("--quiet", 4000));

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
/** Where the panels live — resolved the way canvas-board.mjs resolves it, and
 * passed through to it when stated, so the two agree on every run. */
const boardRef = arg("--canvas") ?? process.env.ISOCAN_BOARD_CANVAS ?? canvasOf("board.json", "canvas");

if (!boardRef) {
  console.error(
    "no board canvas — pass --canvas <ref>, export ISOCAN_BOARD_CANVAS, or write .isocan/board.json (see scripts/canvas-board.mjs)",
  );
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
  const child = spawn(
    "node",
    [
      path.join(repo, "scripts/canvas-board.mjs"),
      "--notify",
      ...(arg("--canvas") ? ["--canvas", boardRef] : []),
    ],
    { cwd: repo, stdio: ["ignore", "inherit", "inherit"] },
  );
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
function pollHead() {
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
    if (!file || /^(HEAD|ORIG_HEAD|refs|packed-refs)/.test(String(file))) pollHead();
  });
  say(`watching the repository at ${gitDir}`);
} catch (err) {
  say(`could not watch ${gitDir} — ${err.message}`);
}
// A belt for filesystems where watch misses things (network mounts, some
// containers). Cheap: one `rev-parse` a minute.
setInterval(pollHead, 60_000).unref?.();

/* ── source 2: the repo's own canvas ─────────────────────────────────────── */

/**
 * **The watcher tails as the BOARD, never as whoever launched it** — the same
 * actor the refresh writes as, so its own panel versions (should the board
 * and repo canvas ever be one) are recognisably its own and skipped below.
 * The tail itself filters nothing: it is the raw log, and the deciding is
 * done here, where a line can say what was decided.
 */
const stateFile = path.join(repo, ".isocan", "board-watch.json");
const savedSeq = (() => {
  try {
    const state = JSON.parse(readFileSync(stateFile, "utf8"));
    return state.canvas === repoCanvas ? state.seq : undefined;
  } catch {
    return undefined;
  }
})();

let seq = savedSeq;

async function watchCanvas(id) {
  const home = await connect({ identity: BOARD_IDENTITY });
  const me = home.actor;
  const canvas = await home.canvas(id);
  say(
    seq !== undefined
      ? `tailing canvas ${id} from seq ${seq} — resuming where the last watcher stopped`
      : `tailing canvas ${id} from now`,
  );
  for (;;) {
    try {
      for await (const entry of canvas.tail(seq !== undefined ? { since: seq } : {})) {
        seq = entry.seq;
        // Handled-means-recorded: the cursor moves the moment an entry is
        // seen, so a killed watcher never re-triggers a refresh it already
        // scheduled — at worst it re-reads the entry it died on.
        writeFileSync(stateFile, JSON.stringify({ canvas: id, seq }) + "\n");
        // Own ops are not news: the board's writes must not wake the board.
        if (entry.envelope.actor.id === me.id) continue;
        say(`canvas ${id} → ${entry.opType} by ${entry.envelope.actor.name} (seq ${entry.seq})`);
        schedule(`${entry.opType} on ${id}`);
      }
      return; // unreachable — tail() only ends by throwing or being aborted
    } catch (err) {
      // A refusal, not a blip — tail rides out blips itself. Wait a beat and
      // re-tail from the recorded seq rather than spinning on it.
      say(`tail refused: ${err.message} — retrying in 10s`);
      await new Promise((r) => setTimeout(r, 10_000));
    }
  }
}

if (repoCanvas) {
  watchCanvas(repoCanvas).catch((err) => {
    console.error(err.message);
    process.exit(2);
  });
} else {
  say("no .isocan/project.json — this directory names no canvas of its own, so only the repo is watched");
}

say(`board is ${boardRef}; debounce ${QUIET_MS}ms. Ctrl-C to stop.`);
schedule("first run");
