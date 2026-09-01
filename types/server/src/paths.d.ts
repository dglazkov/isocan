/** Root of all isocan state. Tests and dev point ISOCAN_HOME at scratch dirs. */
export declare function isocanHome(): string;
/**
 * **The on-disk layout is a deliberate holdout** (phase 13.5's rename). The
 * helpers say canvas; the directory and file names on disk — `projects/<id>/`,
 * `deleted-projects/`, and the `project.json` record inside each — do not,
 * because every `~/.isocan` on every machine is already laid out that way and
 * a rename would be a migration bought for a word nobody outside this file
 * reads.
 */
export declare const canvasesDir: (home: string) => string;
export declare const deletedCanvasesDir: (home: string) => string;
export declare const canvasDir: (home: string, id: string) => string;
export declare const canvasMetaFile: (home: string, id: string) => string;
export declare const canvasFile: (home: string, id: string) => string;
export declare const trashFile: (home: string, id: string) => string;
export declare const oplogFile: (home: string, id: string) => string;
export declare const oplogArchiveFile: (home: string, id: string) => string;
export declare const blobsDir: (home: string, id: string) => string;
export declare const blobsIndexFile: (home: string, id: string) => string;
export declare const daemonFile: (home: string) => string;
export declare const daemonLogFile: (home: string) => string;
export declare const identityFile: (home: string) => string;
/** The actor registry snapshot: which session key speaks as whom (#57). */
export declare const actorsFile: (home: string) => string;
/** The home's identity oplog — every actor.claim, append-only. */
export declare const actorsLogFile: (home: string) => string;
/** The registry as it was before the badge — claims keyed by session key.
 * Renamed aside by the one-time migration, and kept: it is the record of who
 * held what when the desk opened. */
export declare const preBadgeActorsFile: (home: string) => string;
/** The desk's ledgers: innkeeper-private, never replicated (the two-ledger
 * rule). A DIRECTORY rather than a loose file, because the desk grows
 * `grants`, `registrations`, and an audit ledger in phases 7, 9, and 12, and
 * because encryption at rest and key custody for these is a debt innkeeper.md
 * already owes — a directory makes that a directory-level operation later
 * instead of a scavenger hunt. */
export declare const deskDir: (home: string) => string;
/** The badge snapshot: every badge this home has minted. Derived. */
export declare const badgesFile: (home: string) => string;
/** The desk's durable log — mints, claims, and the migration shelf,
 * append-only, fsynced before a write is acknowledged. A claim carries
 * AUTHORIZATION now, so the claims half is snapshot-plus-tail like everything
 * else in this house: losing one file must not lock somebody out of their own
 * name. Admissions and `lastSeen` are deliberately NOT logged — the address
 * admits, so a returning badge re-admits itself on its next request, and one
 * fsync per (badge, canvas) pair for data that rebuilds itself is ceremony. */
export declare const badgesLogFile: (home: string) => string;
/** Says the phase 7 link-grant migration has run here. A marker file rather
 * than a renamed-aside input, because that migration has no input file to
 * rename: what it reads is the canvas list. See
 * `grantTheLinkOnOldCanvases` for what a container with no durable
 * filesystem does with it. */
export declare const linkGrantsMigratedFile: (home: string) => string;
/** The CLI-era session registry (pre-#57); read only to migrate (#59). */
export declare const agentsFile: (home: string) => string;
/** Pre-facepile-fix single pointer; read by nobody, removed on sight. */
export declare const legacySessionFile: (home: string) => string;
/** One presence-session pointer PER ACTOR — a home-scoped single file was
 * how two agents ended up beating each other's actor into one session. */
export declare const cliSessionFile: (home: string, actorId: string) => string;
export declare const configFile: (home: string) => string;
/**
 * **The managed install root** (auto-upgrade phase 3): one tree per build,
 * and a symlink naming the one in use.
 *
 * ```
 * ~/.isocan/builds/<sha>/     an npm prefix — the package lands in node_modules/isocan
 * ~/.isocan/current -> builds/<sha>
 * ```
 *
 * It lives under `ISOCAN_HOME` rather than beside the global install for one
 * reason worth more than tidiness: `ISOCAN_HOME` already redirects everything
 * else here, so a test can drive a whole install-smoke-flip-rollback cycle
 * against a scratch directory without touching the machine it runs on. The
 * alternative — a fixed `~/.isocan` — would make every test of this an
 * experiment on the developer's own PATH.
 */
export declare const buildsDir: (home: string) => string;
export declare const buildDir: (home: string, sha: string) => string;
/** Where a build is being installed before it has earned a name. Dot-prefixed
 * so a half-written tree can never be read back as a build (`listBuilds`
 * skips dotted entries), and inside `builds/` so the rename that promotes it
 * stays on one filesystem — a cross-device rename is a copy, and a copy is
 * not atomic. */
export declare const stagingBuildDir: (home: string) => string;
/** The symlink `isocan` on PATH resolves through. Flipping it IS the upgrade:
 * every other step happens in a directory nothing points at. */
export declare const currentLink: (home: string) => string;
/** The package root inside a build tree — what `buildStamp().root` reports for
 * a managed copy, and so what a daemon's `root` is compared against. */
export declare const buildRoot: (dir: string) => string;
/** Slash commands this home has written: one markdown file per command, named
 * by the command. A home file shadows the built-in of the same name. */
export declare const commandsDir: (home: string) => string;
export declare const commandFile: (home: string, name: string) => string;
/** The directory roster: realpath → canvasId, a discovery cache healed by
 * the CLI whenever a command runs from a bound directory (#60). The
 * authoritative binding is the `.isocan/project.json` marker in the
 * directory itself; this file only answers "where on disk does that canvas's
 * work live" without a filesystem crawl. */
export declare const dirsFile: (home: string) => string;
/**
 * **Which home each canvas on this machine belongs to** — `canvasId →
 * homeUrl | null`, phase 10.3's one new file.
 *
 * A sibling of `dirs.json` and `config.json` rather than anything inside
 * `projects/<id>/`, and the placement carries the argument. `project.json` in
 * there IS the replicated `Canvas` record, so a home written into it would be
 * overwritten by the next snapshot from the home — on the machine that most
 * needs it stable. A sidecar beside it would be a fifth file-shaped thing
 * crossing the `Store` seam for data no backing has any business holding:
 * this is a fact about ONE MACHINE's relationship to a canvas, not canvas
 * state, and canvas state is the only thing that replicates.
 *
 * **Absent and `null` mean the same thing** — this daemon is that canvas's
 * home. Both spellings exist because absent is what a pre-10.3 machine has
 * and `null` is what a post-10.3 local birth writes, and collapsing them at
 * read time is exactly what makes the upgrade a no-op for Dion.
 *
 * **Daemon-owned. The CLI never writes it.** `dirs.json` next door is a
 * CLI-owned discovery cache and this is deliberately not modelled on it: this
 * is routing state the daemon needs at boot with no CLI running, and two
 * writers on one file is how a file drifts. The CLI's way to change a row is
 * `POST /api/home/join`, which goes through the daemon like everything else.
 */
export declare const homesFile: (home: string) => string;
