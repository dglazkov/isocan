import { statSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { UpgradeVerdict } from "@isocan/core";

/**
 * Which copy of isocan is this, and how old is it?
 *
 * The daemon outlives the command that started it — often across an upgrade,
 * because `ensureDaemon` only starts one when the port is silent. So a new CLI
 * talking to an old daemon is the normal outcome of `npm i -g …` or a moved
 * `main`, and until a build could say which one it was, nothing could notice.
 *
 * `root` is exact: an npx cache directory, a global install and a checkout are
 * three different paths. `codeAt` is a heuristic — the newest mtime among a
 * few files that every layout has — and it is a good one, because npm rewrites
 * the whole tree on install, so an in-place upgrade moves it even though the
 * path did not.
 */
export interface BuildStamp {
  version: string;
  /** Package root this build runs from. */
  root: string;
  /** When this copy's code was last written (ISO). */
  codeAt: string;
  /**
   * **The commit this build is of** — short sha, or null when nothing on disk
   * can say.
   *
   * `version` cannot answer this and never could: every build this project has
   * ever shipped says `0.1.0`, so the one field named after the question is
   * the one field with no information in it. A person comparing two machines,
   * or an agent asked what it is running, needs an identity that changes when
   * the code changes.
   *
   * Two sources, because there are two kinds of copy. An INSTALL gets it from
   * the manifest the release branch stamps (`scripts/release.mjs`) — the tree
   * npm hands out has no `.git`, so nothing else could know. A CHECKOUT reads
   * `.git` directly rather than shelling out to git: `buildStamp` is on the
   * health route, `isocan status` is a command agents run dozens of times, and
   * a subprocess per call is a subprocess per call.
   */
  commit: string | null;
  /**
   * When this build was cut (ISO), from the same two sources — or null.
   *
   * Distinct from `codeAt`, which is an mtime and therefore says when npm last
   * rewrote the tree. That is the right heuristic for "has this copy changed
   * under a running daemon" and the wrong answer to "how old is this code":
   * reinstalling the same release moves `codeAt` and moves nothing else.
   */
  builtAt: string | null;
}

/**
 * The block `scripts/release.mjs` stamps into the release branch's manifest.
 * Namespaced under one key rather than added as loose top-level fields: npm
 * owns that namespace, and a future `commit` key of its own would silently
 * win.
 */
interface ManifestStamp {
  commit?: string;
  builtAt?: string;
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

/** The package root, for anything else that has to find a file this build
 *  shipped with — `docs/changelog` is one. */
export const buildRoot = (): string => root;

/** Files present in a checkout and in an install alike. */
const WITNESSES = [
  "package.json",
  "packages/server/src/http.ts",
  "packages/core/src/reducer.ts",
  "packages/cli/src/main.ts",
];

let cached: BuildStamp | null = null;

export function buildStamp(): BuildStamp {
  if (cached) return cached;
  let version = "0.0.0";
  let stamped: ManifestStamp = {};
  try {
    const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as {
      version?: string;
      isocan?: ManifestStamp;
    };
    version = pkg.version ?? version;
    stamped = pkg.isocan ?? {};
  } catch {
    // An unreadable manifest is not worth failing a health check over.
  }
  let newest = 0;
  for (const witness of WITNESSES) {
    try {
      newest = Math.max(newest, statSync(path.join(root, witness)).mtimeMs);
    } catch {
      // Missing witness: the others still date this copy.
    }
  }
  // Precedence: manifest, then environment, then `.git`. A stamped manifest
  // is a deliberate statement (`release.mjs` wrote it); an environment
  // variable is what a container's build-arg happened to hold (the image has
  // no `.git` — `.dockerignore` excludes it — and is not built from the
  // release branch, so env is its only source); `.git` is a checkout reading
  // its own working tree. Only reach for the next source when the ones before
  // it cannot say (auto-upgrade phase 1).
  const envSha = plausibleSha(process.env.ISOCAN_BUILD_SHA);
  const envBuiltAt = envSha ? (process.env.ISOCAN_BUILD_DATE || null) : null;
  const head = stamped.commit || envSha ? null : gitHead();
  cached = {
    version,
    root,
    codeAt: new Date(newest).toISOString(),
    commit: stamped.commit ?? envSha ?? head?.commit ?? null,
    builtAt: stamped.builtAt ?? envBuiltAt ?? head?.committedAt ?? null,
  };
  return cached;
}

/**
 * A build-arg's value, but only when it is a commit — otherwise null.
 *
 * `ISOCAN_BUILD_SHA` defaults to the literal `unknown` for a hand-built image
 * and to `e2e-<timestamp>` under `infra/local-e2e.sh`. Reporting either as an
 * identity is the false-success the auto-upgrade lessons name ("an oracle
 * that cannot answer must produce no verdict"): a copy that cannot say which
 * commit it is says null, never a word pretending to be a sha. The shape is
 * `release.mjs`'s own — a seven-plus-character hex — so `unknown`, `e2e-…`,
 * empty and unset all fall through to null together.
 */
export function plausibleSha(raw: string | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  return /^[0-9a-f]{7,40}$/.test(value) ? value.slice(0, 7) : null;
}

/**
 * The checked-out commit, read out of `.git` by hand.
 *
 * Everything here is best-effort and every failure is the same answer: null,
 * meaning "this copy cannot say". A build stamp that threw would take the
 * health route with it, and the health route is how anything finds out whether
 * a daemon is alive at all.
 *
 * The four shapes it has to survive are the four this repo actually meets: a
 * plain clone; a WORKTREE (where `.git` is a file naming the real directory —
 * agents here work in worktrees; the `commondir` walk below is the rest of
 * that story); a repo whose refs have been packed by
 * `git gc`, where `refs/heads/main` is one line of one file; and a repo on
 * REFTABLE (`extensions.refStorage = reftable` — this repo's own dev machine
 * is one), where refs are binary tables under `.git/reftable` and `HEAD` is
 * a compatibility stub reading `ref: refs/heads/.invalid`, put there so
 * hand-readers like this one fail safely instead of plausibly. For that
 * shape the honest answer really is null: parsing reftable by hand is a
 * binary-format dependency this best-effort stamp does not want, and
 * shelling out to `git` at daemon boot is a failure surface it deliberately
 * does not have. The stub is matched EXPLICITLY below so nobody reading a
 * log ever chases `.invalid` as a corrupt branch name.
 *
 * `from` defaults to this build's own root and is a parameter only so the four
 * shapes above can be built on disk and asserted. They cannot be reached any
 * other way: which shape the machine running the tests is in is not something
 * a test gets to choose, and three of the four would otherwise be tested by
 * whoever happened to run them.
 */
export function gitHead(
  from: string = root,
): { commit: string; committedAt: string | null } | null {
  try {
    let dir = path.join(from, ".git");
    const stat = statSync(dir);
    if (stat.isFile()) {
      const pointer = readFileSync(dir, "utf8").match(/^gitdir:\s*(.+)$/m)?.[1]?.trim();
      if (!pointer) return null;
      dir = path.resolve(from, pointer);
    }
    /**
     * **HEAD is per-worktree; refs are not.** A worktree's gitdir holds its own
     * HEAD, index and logs, and a `refs/` with only `bisect` and `rewritten` in
     * it — the branch itself lives in the COMMON directory, which that gitdir
     * names in a one-line `commondir` file. Reading `refs/heads/<branch>`
     * beside HEAD therefore misses, `packed-refs` beside HEAD misses too, and
     * the whole function fell through to null: a worktree could follow the
     * `.git` pointer and still never name its commit, in the one shape this
     * file says agents here work in.
     *
     * A plain clone has no `commondir` and keeps its refs beside HEAD, which
     * is what the catch leaves in place.
     */
    let refs = dir;
    try {
      const common = readFileSync(path.join(dir, "commondir"), "utf8").trim();
      if (common) refs = path.resolve(dir, common);
    } catch {
      // Not a worktree: HEAD and the refs are in the same directory.
    }
    const head = readFileSync(path.join(dir, "HEAD"), "utf8").trim();
    // Reftable's stub: refs live in binary tables this reader will not parse.
    if (head === "ref: refs/heads/.invalid") return null;
    const ref = head.match(/^ref:\s*(.+)$/)?.[1]?.trim();
    // Detached HEAD names the sha outright.
    let sha = ref ? null : head;
    if (ref) {
      try {
        sha = readFileSync(path.join(refs, ref), "utf8").trim();
      } catch {
        // Packed: `git gc` moved the loose ref into one file of `sha ref` lines.
        const packed = readFileSync(path.join(refs, "packed-refs"), "utf8");
        sha = packed.match(new RegExp(`^([0-9a-f]{40})\\s+${ref}$`, "m"))?.[1] ?? null;
      }
    }
    if (!sha || !/^[0-9a-f]{7,40}$/.test(sha)) return null;
    // A worktree's HEAD moves when you switch branches, so its mtime dates the
    // checkout rather than the commit — close enough to be useful, and named
    // honestly by being the only date on offer here.
    let committedAt: string | null = null;
    try {
      committedAt = new Date(statSync(path.join(dir, "HEAD")).mtimeMs).toISOString();
    } catch {
      // The sha alone is still worth having.
    }
    return { commit: sha.slice(0, 7), committedAt };
  } catch {
    return null;
  }
}

/**
 * **One phrasing of "which build is this", for every command that says it.**
 *
 * `0.1.0` on its own is not an answer — every build says it — so the sha is
 * the identity and the version rides along for the day it starts moving.
 */
export function describeBuild(stamp: Partial<BuildStamp>): string {
  const version = stamp.version ?? "(unknown version)";
  const parts = [stamp.commit, stamp.builtAt?.slice(0, 10)].filter(Boolean);
  return parts.length > 0 ? `${version} (${parts.join(", ")})` : version;
}

/**
 * Is `daemon` running code that has since been replaced? Two ways to be stale,
 * and the messages differ because the fixes do: another copy holds the port,
 * or this copy changed under a daemon that started before it.
 */
export function stalenessOf(
  daemon: { root?: string; codeAt?: string; startedAt?: string; commit?: string | null },
  mine: BuildStamp = buildStamp(),
): { stale: boolean; why: string } {
  if (!daemon.root || !daemon.startedAt) {
    return { stale: true, why: "the daemon predates build stamps — restart it to know what it is" };
  }
  if (path.resolve(daemon.root) !== path.resolve(mine.root)) {
    return { stale: true, why: `the daemon is running another copy of isocan (${daemon.root})` };
  }
  /**
   * **Two builds that name themselves and disagree.** Exact where everything
   * below it is a heuristic, so it goes first — and it says the two shas,
   * which is the difference between "restart it" and knowing what you would be
   * restarting from and to.
   *
   * It cannot fire on a checkout, where both readings come from one `.git`;
   * that case is the mtime below, and still has to be.
   */
  if (daemon.commit && mine.commit && daemon.commit !== mine.commit) {
    return {
      stale: true,
      why: `the daemon is running ${daemon.commit}, this copy is ${mine.commit}`,
    };
  }
  if (daemon.codeAt && Date.parse(daemon.startedAt) < Date.parse(mine.codeAt)) {
    return { stale: true, why: "this copy has been updated since the daemon started" };
  }
  return { stale: false, why: "" };
}

/**
 * **What the home runs**, as this daemon last managed to read it. Null for
 * every reason at once — never asked, asked and got nothing, asked and the
 * home could not say — because all of them are the same answer downstream.
 */
export interface HomeBuild {
  /** The address that answered. Carried so the verdict can name it: a machine
   * can answer to several homes (multiuser phase 10.3). */
  url: string;
  commit: string | null;
  builtAt: string | null;
}

/**
 * **The third kind of stale: this copy disagrees with its home.**
 * (auto-upgrade phase 2.)
 *
 * A sibling of `stalenessOf` and deliberately shaped like it — pure, given
 * both sides, so the comparison can be tested without a network — but asking
 * one hop further out. `stalenessOf` compares a CLI with the daemon holding
 * its port; this compares that daemon with the home it forwards writes to,
 * which is the skew the op vocabulary actually depends on.
 *
 * **Null is the answer whenever either side cannot say which build it is**,
 * and that is the whole of the care here. A home with `commit: null` — a
 * pre-phase-1 image, which is most of what is deployed — must produce NO
 * verdict rather than "you are current": the recurring defect in this
 * codebase is a system that returns a cheerful success when it was given
 * nothing to compare against.
 */
export function upgradeVerdict(
  home: HomeBuild | null,
  mine: BuildStamp = buildStamp(),
): UpgradeVerdict | null {
  if (!home?.commit || !mine.commit) return null;
  const available = home.commit !== mine.commit;
  return {
    available,
    direction: available ? order(mine.builtAt, home.builtAt) : null,
    home: home.url,
    homeCommit: home.commit,
    homeBuiltAt: home.builtAt,
    mine: mine.commit,
    mineBuiltAt: mine.builtAt,
    /**
     * Facts, in the order a reader needs them: what this copy is, then what
     * the home is. It names no action — the CLI's line adds the command, and
     * whether anybody may run it is a mode's question, not a verdict's.
     */
    why: available
      ? `this copy is ${dated(mine.commit, mine.builtAt)}; your home ${home.url} runs ${dated(home.commit, home.builtAt)}`
      : "",
  };
}

/**
 * Which build is older, when the dates support saying so.
 *
 * **Shas identify builds; dates order them** — and only when both exist and
 * both parse. Equal dates give null rather than a coin flip: two builds cut
 * the same second are two builds, and this function's whole job is to not
 * invent an ordering the inputs do not contain.
 */
function order(mineBuiltAt: string | null, homeBuiltAt: string | null): "behind" | "ahead" | null {
  if (!mineBuiltAt || !homeBuiltAt) return null;
  const mine = Date.parse(mineBuiltAt);
  const theirs = Date.parse(homeBuiltAt);
  if (Number.isNaN(mine) || Number.isNaN(theirs) || mine === theirs) return null;
  return mine < theirs ? "behind" : "ahead";
}

/** `a1b2c3d (2026-08-25)`, or just the sha when the build carries no date —
 * `describeBuild`'s convention, so the two ways isocan says "which build" read
 * the same. */
function dated(commit: string, builtAt: string | null): string {
  return builtAt ? `${commit} (${builtAt.slice(0, 10)})` : commit;
}
