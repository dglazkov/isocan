import type { BuildStamp, UpgradeVerdict } from "../../core/src/index.js";
/** Which copy of isocan is this, and how old is it? The type lives in
 * `@isocan/core` beside `UpgradeVerdict` (docs/projects/room/design.md: the
 * route surface names it and must not import this package); this file keeps
 * the function that reads it off the disk. */
export type { BuildStamp } from "../../core/src/index.js";
/** The package root, for anything else that has to find a file this build
 *  shipped with — `docs/changelog` is one. */
export declare const buildRoot: () => string;
export declare function buildStamp(): BuildStamp;
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
export declare function plausibleSha(raw: string | undefined): string | null;
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
export declare function gitHead(from?: string): {
    commit: string;
    committedAt: string | null;
} | null;
/**
 * **One phrasing of "which build is this", for every command that says it.**
 *
 * `0.1.0` on its own is not an answer — every build says it — so the sha is
 * the identity and the version rides along for the day it starts moving.
 */
export declare function describeBuild(stamp: Partial<BuildStamp>): string;
/**
 * Is `daemon` running code that has since been replaced? Two ways to be stale,
 * and the messages differ because the fixes do: another copy holds the port,
 * or this copy changed under a daemon that started before it.
 */
export declare function stalenessOf(daemon: {
    root?: string;
    codeAt?: string;
    startedAt?: string;
    commit?: string | null;
}, mine?: BuildStamp): {
    stale: boolean;
    why: string;
};
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
export declare function upgradeVerdict(home: HomeBuild | null, mine?: BuildStamp): UpgradeVerdict | null;
