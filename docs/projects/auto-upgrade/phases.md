# Auto-upgrade: implementation phases

[`design.md`](design.md) explains the reasoning; this document defines the
implementation phases. Each phase is a **discrete amount of work that ends in
a testable outcome**, and the demonstration is named up front.
[`journey.md`](journey.md) is the acceptance suite: a phase that claims a
scene is done only when the scene plays.

**How the work runs is defined once, in
[`../multiuser/phases.md`](../multiuser/phases.md), and applies here
unchanged**: the conductor model, one subagent per phase, the rule that the
conductor verifies the named proof itself rather than taking a subagent's
word, the finding budget (one claim, about forty words), and the Status line
that moves in the same change as "where we are". This document does not
restate any of it, because a second copy would drift.

**Phase citations must name their project.** About fifty code comments
reference a phase by bare number, and all of them mean the multiuser project —
they were written when it was the only one. From here on, write `auto-upgrade
phase 3`, never a bare "phase 3". Bare numbers in existing code continue to
mean multiuser phases.

**⚑ promote** marks a step whose proof requires deploying to a live home. It
creates no cloud resource, but moving the `prod` tag is deliberate and the
decision is the user's: ask first, the same way ⚑ provision is asked in the
multiuser project. Dev needs no permission — `green` already deploys it.

---

**Where we are: PHASES 1, 2 AND 3 DONE (27–29 Aug 2026), phase 4 not
started.** isocan.io can say which commit it is running; a CLI that disagrees
with its home says so, once, naming both builds; and an upgrade is now a
build installed aside, started and asked which commit it is, and a symlink
flipped only if it answered correctly. Nothing does any of that on its own
yet: every swap here is a command somebody ran. That is phase 4.

Phase 1 was four lines of code and one build-arg, and it was worth doing
regardless of what happens to the rest: it fixed a live production defect and
depended on nothing else in this document. Phase 2 stands on it and is worth
having on the same terms — nobody spends an afternoon debugging yesterday's
build again. Phase 3 is where the project stopped being a notice and became an
install root, and it paid for itself twice on the way: `buildStamp()` could
not name a commit in any git worktree, so phase 2's verdict had never once
fired on a development machine.

**Phase 4 is the natural next step**, and it is the one that changes what
happens on a machine nobody is watching. Two of its decisions are already
narrowed by what phase 3 built: `--rollback` exists, so `--pin` is the same
symlink flip with a name given to it, and adoption shelves the outgoing build,
so the first unattended upgrade has somewhere to go back to.

This project is not gated on the multiuser project, and nothing there is gated
on this. Multiuser phase 14 closed with next steps being a choice, not a
queue; this project competes with multiuser's phases 11, 12, 12.5, 12.7 and 13
rather than waiting behind them.

**Deliberately open.** Decisions postponed on purpose, so a later session
decides them deliberately instead of improvising mid-task:

- **The fallback for a daemon with no home.** Such a daemon has nothing to
  compare against. The fallback — `git ls-remote … release`, once a day — is
  designed and deliberately not scheduled in any phase: it is the second-best
  answer to a question the home answers better, and building it early would
  make it the version that gets maintained.
- **Whether a home may declare a minimum version.** A `minCli` field ("your
  build predates the ops I use") would turn a notice into a refusal, and
  refusing is a compatibility promise this product has not made. Phase 2 adds
  the comparison only; nothing enforces a minimum until someone decides this.
- **Which home wins on a machine with several.** Multiuser phase 10.3 made the
  home a property of the canvas, so one machine can answer to several homes.
  **Phase 2 answered half of this and left the other half open on purpose:**
  the verdict comes from the birth home, or from the single home when there is
  exactly one, and a machine answering to several homes with no birth default
  gets **no verdict at all** rather than the newest. Every verdict names its
  home. What is still open is what such a machine should be told — silence is
  the safe answer, not obviously the right one.
- **What a pin can reach, and what a verdict older than this copy means.**
  `--pin <sha>` can only name a sha still present in `builds/`; reaching
  arbitrary history would require building from source, which is a separate
  project, not a flag. A home behind its CLI (a pinned or lagging image)
  produces a notice, never a downgrade: downgrades happen only from `builds/`,
  on a person's command.
- **The recovery commands run on the build they recover from.** The CLI's
  ordinary operator is an agent; a person runs `--rollback` and `--pin`
  exactly when the current build — the code those commands execute on — is
  suspect. This is probably fine, because a rollback is a directory read and a
  symlink flip. It is recorded here so the commands stay that small and never
  gain a network call.
- **When a fresh machine becomes managed.** Phase 3 adopts an existing global
  install on its first upgrade, but the front door's `setup` still runs
  `npm i -g` — so every new machine starts unmanaged and needs one extra
  adoption step. Whether `setup` should install straight into `builds/` is a
  front-door change and is not decided here.
- **Windows.** Phase 3's symlink flip becomes a junction or a `.cmd` shim
  there, and nobody has run this on Windows. Still true after phase 3, which
  did the one thing that costs nothing: `flipTo` writes a junction with an
  absolute target on win32, and `adoptGlobal` REFUSES a bin that is a shim
  rather than a symlink, naming this line. So the failure on Windows is a
  message, not a broken PATH — but the path itself is unrun.
- **The stamp is self-reported, and always was.** A checkout reads its own
  `.git`; after phase 1 an image reads its own environment variable. Anyone
  who can set `ISOCAN_BUILD_SHA` can make a build claim to be another one.
  This is diagnostics, not attestation, and it must never become an
  authorization input.
- **The trust boundary.** Auto-upgrade means whatever is on `release` runs
  unattended on every machine. That is accepted for a single-innkeeper
  project; `--pin` and `off` are the recovery paths. It stops being acceptable
  once other people's machines auto-upgrade — and multiuser Scene 5 already
  put Nico on Jordan's machine, so if both projects ship, that situation is
  real, not hypothetical. It must be met as a decision, not discovered.

**Standing lessons that already apply.** They are multiuser's and are not
copied here; read them there. Two matter for every phase below: **an oracle
that cannot answer must produce no verdict** — never "you are current" (the
recurring multiuser bug: given a wrong address, the system returns a false
success); and **a proof states what was measured, and by whom** — "the test
passes" is not a measurement when the claim is about a real machine.

---

## Phase 1 — The home that can report which build it is ⚑ promote

**Status: DONE 27 Aug 2026 — proof taken on isocan.io.**

```
$ curl -s https://isocan.io/api/healthz
{"ok":true,…,"commit":"d7c886d","builtAt":"2026-08-27T08:19:41-06:00"}
$ git rev-parse --short prod
d7c886d
```

The field this whole project depends on was empty in production when the
phase was written (`"commit":null`, measured 2026-08-25) and now answers,
matching the tag that deployed it. The image's `ARG ISOCAN_BUILD_SHA` was
passed, stored in ENV, and read by nobody; it is read now. **What was
built:** `buildStamp()` reads a third
source between the manifest and `.git` — `ISOCAN_BUILD_SHA`, gated by
`plausibleSha` so `unknown`, `e2e-…`, empty and any non-hex map to null
rather than being reported as a commit. Precedence is manifest → env → `.git`,
each reached only when the ones before it cannot say. The Dockerfile now
carries `ISOCAN_BUILD_DATE` too (main's commit date, read from `.git` in the
`build` cloudbuild step, empty-and-absent when the workspace has none). Unit
proof landed (`plausibleSha` over every not-a-commit the image can hold);
live env-path proof taken locally (a daemon given `ISOCAN_BUILD_SHA=deadbee…`
reports `deadbee`), and the hosted measurement above closes it.

**This phase is also phase 2's test rig, and that is now real**: two daemons
on one laptop can be given two different shas, so "a CLI that disagrees with
its home" is an ordinary vitest fixture rather than something needing two
machines.

**Work:** `buildStamp()` learns a third source. Today it reads the release
manifest and `.git`, and a container has neither: `.dockerignore` excludes
`.git` (correctly), and the `isocan` manifest key is written only onto the
`release` branch, which the image is not built from. So the field this whole
project depends on is empty in production, measured 2026-08-25:

```
$ curl -s https://isocan.io/api/healthz
{"ok":true,"pid":10,"startedAt":"…","version":"0.1.0","root":"/app","codeAt":"…"}
```

The Dockerfile already passes `ARG ISOCAN_BUILD_SHA`, `cloudbuild.yaml`
already fills it with `${_TAG}`, and `grep -rn ISOCAN_BUILD_SHA` over the
TypeScript returns nothing: **passed, stored in ENV, read by nobody.** The
Dockerfile comment calling it "the build stamp `/healthz` reports" is, today,
false.

Three details decide whether this is worth having:

- **`unknown` is not an identity.** The `ARG` defaults to the literal string
  `unknown` for a hand-built image, and `infra/local-e2e.sh` sets
  `e2e-<timestamp>`. Neither is a commit. Any value that is not a plausible
  sha reads as **null** — "this copy cannot say" — because reporting
  `unknown` as an identity is a false answer, the defect the standing lesson
  names.
- **Both dates must be main's commit date.** `scripts/release.mjs` stamps
  `builtAt` as `git log -1 --pretty=%cI` — the commit date on main, not the
  time the release was cut. A second build-arg carries the same value into
  the image. If the image were stamped with its own build time instead, the
  comparison would measure the two pipelines' delays, and would eventually
  tell a current CLI that it is behind. If the Cloud Build workspace has no
  `.git` to read the date from, the arg stays empty and the date is simply
  absent — shas still identify builds; only the older/newer comparison is
  lost.
- **Precedence, stated rather than discovered:** manifest, then env, then
  `.git`. No copy has two of these today, so the order costs nothing to fix
  now — and a stamped manifest is a deliberate statement, while an
  environment variable is whatever the shell happened to hold.

**The two stamps already use the same format, which is why this is four lines
and not a design.** The trigger passes `_TAG=$SHORT_SHA`, and `green` is
main's own commit moved forward, so an image's sha is a **main** sha, seven
characters — the same value `release.mjs` writes with `head.slice(0, 7)`.
Nothing needs normalizing; one side has to start reading.

**This phase is also phase 2's test rig.** Once the env var is read, two
daemons on one laptop can be given two different shas, and "a CLI that
disagrees with its home" becomes an ordinary vitest fixture instead of
something that needs two machines to observe.

**Outcome:** Every isocan copy, wherever it runs, can report which commit it
is; a copy that genuinely cannot reports null instead of guessing.

**Proof:** `curl https://dev.isocan.io/api/healthz` returns a `commit` equal
to the short sha of the commit that built the running revision, checked
against the image tag on the revision — measured on dev, not asserted from
the YAML. Then, after the user approves the promote, the same on isocan.io.
In vitest: `unknown`, `e2e-…` and an empty value each yield `commit: null`,
and a plausible sha passes through.

**Findings:** none yet.

---

## Phase 2 — A third kind of stale

**Status: DONE 28 Aug 2026 — proof taken on this machine, against a stub
home.**

```
$ isocan canvas list --all
note: this copy is a1b2c3d (2026-08-12); your home http://127.0.0.1:4499 runs
b2c3d4e (2026-08-25) — `isocan upgrade` catches up.
(none)
$ isocan canvas list --all
(none)
```

**What was built.** `upgradeVerdict()` sits beside `stalenessOf()` in
`build.ts` and asks the same question one hop further out, pure and given both
sides. `HomeLink.askBuild()` fetches the home's health route — a plain
`fetch`, because the health routes are open, so a replica whose badge was
swept can still find out it is behind — on a self-rescheduling hourly timeout
and on every transition of a home back to answering. `HomeLinks.upgrade()`
picks the home and the verdict rides the daemon's own health body, which
`makeCtx` already fetches, so no command pays a round trip. `warnIfBehind()`
in `ctx.ts` says it once per **sha pair** (`.upgrade-noted`), and `isocan
status` carries the whole verdict in `--json` and one line in text.

**Three things the phase decided that the Work below did not.** The verdict
carries `available: false` when the home was asked and this copy is current —
"asked and current" and "could not ask" are different answers and only one of
them may be reported as reassurance. It carries `direction` (`behind` /
`ahead` / null), because a home running the older build is a real shape and
the notice for it must name no upgrade command. And `homeProbeMs` is a daemon
option for the reason `gcIntervalMs` is one: an hourly timer is not something
a test can wait out.

**What of Scene 0 is NOT closed:** the wake payload. The scene asks for the
field on `isocan status --json` *and on every wake payload*; the second is
phase 4's park-and-wake work and is untouched here.

**Work:** `stalenessOf` knows two ways to be stale — another copy holds the
port, and this copy changed under a running daemon. This phase adds the
third: **the daemon disagrees with the home it is talking to.** This is the
skew that matters, because the op vocabulary is the isomorphism contract and
the home is the other end of it.

Where each piece lives:

- **The daemon asks**, because it already holds a home-link and can ask in
  the background. A self-rescheduling timeout — `gc.ts`'s pattern, not a
  second `setInterval` — at most hourly, plus once on every home-link
  reconnect. **Not on the poll loop**: `DEFAULT_POLL_MS` is 2000, and
  checking there would be 1,800 requests an hour for an answer that changes
  about twice a day.
- **The verdict travels in the health body**, which `makeCtx` already fetches
  on every command, so the CLI adds no round trip and an offline machine
  simply has no field.
- **The CLI reports it once per verdict** — `warnIfStale`'s pattern and its
  own marker, but keyed on the pair of shas rather than on the daemon. An
  agent runs thirty commands, and thirty notices would get ignored. A daemon
  also lives for days while the home moves about twice a day, so a marker
  keyed on `startedAt` would report only the first skew and stay silent for
  every later one.
- **`isocan status --json` carries it, and `--json` is the primary surface**
  — the CLI's ordinary operator is an agent, and the stderr line's real
  audience is a person reading a transcript. The notice is a relay, not an
  instruction: in notify mode the upgrade decision is a person's even when
  the reader is an agent, and an agent that upgrades itself in notify mode
  has re-implemented auto mode without its controls.

**Notify only. Nothing is fetched, applied, or restarted.** This is most of
the value on its own: nobody spends an afternoon debugging yesterday's build
again.

Report only what the comparison supports: **shas identify builds, dates order
them**, and neither measures how far apart two builds are.

**Outcome:** A CLI that is behind its home reports it, once, in a line that
names both builds; a CLI that cannot find out reports nothing.

**Proof:** Two daemons on one machine at deliberately different shas (phase
1's rig): the CLI's first command prints the notice naming both builds, the
second command prints nothing, and `--json` carries the field on both. Move
the home's sha again under the same daemon, and the new pair produces one new
notice. A home whose `commit` is null — a pre-phase-1 image, which prod runs
today — produces **no verdict**, and the test asserts the absence, not the
message. A daemon with the network cut prints nothing and answers commands
normally.

**Taken 28 Aug 2026**, every beat, in
`packages/cli/test/upgrade-notice.test.ts`: the real `bin/isocan.js` against a
real daemon whose home is a stub that can change its sha between requests. The
comparison itself is unit-tested in `packages/server/test/build.test.ts`. Suite
green (1814 tests), plus the hand walk quoted in the status above.

**Findings:**

- **2026-08-28** — The home is a stub, not a second daemon, and it has to be:
  `buildStamp()` caches for the life of a process, so a real daemon's sha is
  fixed and "the home moved" is a beat no in-process rig can play.
- **2026-08-28** — A verdict is a statement about now, so a failed probe
  CLEARS the cached one rather than keeping the last good answer. The cheap
  recovery is the re-probe on a home that starts answering again, not a
  remembered comparison nobody re-made.
- **2026-08-28** — Links start after `listen`, so the first command against a
  cold daemon can beat the first probe and see no field. Acceptable: this is a
  notice, not a gate, and the next command carries it. It would not be
  acceptable for phase 4.
- **2026-08-28** — `HomeLink.start()` was running TWICE for every link created
  at boot: `linkFor` fires it, then `HomeLinks.start()` awaits it. Two poll
  intervals, of which `close()` cleared one. Pre-existing; found by counting
  the new probe's requests, fixed here, and the count is the guard.
- **2026-08-28** — A rate check on the sweeps could NOT see that doubling —
  `sync()` coalesces — and passed against the unfixed code. Deleted. A test
  that survives the bug it names is worse than no test.
- **2026-08-28** — `plausibleSha` is applied at BOTH ends. The home already
  gates its own stamp, but the value crosses a network from a machine this one
  does not control, and `unknown` printed at a person as an identity is the
  same defect phase 1 fixed.

---

## Phase 3 — The managed install root

**Status: DONE 29 Aug 2026 — proof taken on this machine, against the real
`release` branch on GitHub.**

```
$ isocan --version
0.1.0 (aaa1111, 2026-08-29)                    # a real global install of this branch
$ isocan upgrade --no-restart
isocan: aaa1111 is now reachable as a build — `isocan upgrade --rollback` comes back to it
isocan: adopting the global install at …/lib/node_modules/isocan — the copy stays
  where npm put it; what moves is `isocan` on your PATH, onto a build root that
  can be rolled back
isocan: checking that 4da3862 runs…
now on 4da3862 (was aaa1111)
isocan: …/npm/bin/isocan now resolves through …/home/current
$ ls ~/.isocan/builds ; readlink ~/.isocan/current ; isocan --version
4da3862  aaa1111
builds/4da3862
0.1.0 (4da3862, 2026-08-29)
$ isocan upgrade --rollback --no-restart ; isocan --version
rolled back to aaa1111 from 4da3862
0.1.0 (aaa1111, 2026-08-29)
```

Every step of that is real: a global install of this branch on a scratch npm
prefix, a real `npm install` of `github:dglazkov/isocan#release`, a real
daemon started from the candidate tree and asked which commit it was, and a
real symlink flip that `isocan` on PATH then resolved through. The scratch
`ISOCAN_HOME` and scratch `npm_config_prefix` are what kept it off the
machine's own PATH — which is exactly the property `builds/` living under
`ISOCAN_HOME` was chosen for.

**The other three beats, measured the same way:**

- **A candidate that will not start leaves `current` where it was.** Broken
  deliberately — `packages/server` deleted out of the fetched tree — and the
  message names the file: `4da3862 did not start cleanly — it exited before
  answering (Error: ENOENT … packages/server/src/index.ts). Nothing was
  swapped: you are still on aaa1111.` Exit 1, and `current` still
  `builds/aaa1111`.
- **A daemon left running survives the cleanup.** A real daemon out of
  `builds/4da3862` — the OLDEST build, and not the current one — with five
  builds on disk. Two prune rounds removed a *newer* build and left the
  daemon's alone; the daemon still answered `/healthz` from the same root
  afterwards, with its tree intact.
- **The managed path through PATH.** After adoption, `isocan upgrade` run
  through `current` reports `installing aside — nothing that is running
  changes until the new build answers for itself`, and swaps without saying
  anything about adoption, because there is nothing left to adopt.

**What was built.** `packages/cli/src/managed.ts` is the phase: `listBuilds`,
`currentSha`, `flipTo` (a symlink written aside and `rename`d over, so there
is no window in which `isocan` resolves to nothing), `smokeTest`,
`installBuild`, `liveBuildShas`, `pruneBuilds`, `shelveExisting` and
`adoptGlobal`. `whichInstall` grows the `managed` kind and checks it first;
`planUpgrade` grows a `swap` action that both `managed` and `global` take, so
a global install adopts rather than overwriting itself. `paths.ts` owns the
layout (`buildsDir`, `buildDir`, `stagingBuildDir`, `currentLink`,
`buildRoot`). `isocan upgrade` gains `--rollback`.

**Three things the phase decided that the Work below did not.**

- **Adoption shelves the outgoing copy**, as a symlink at `builds/<sha>`
  pointing at the global prefix's `lib`. Without it the first upgrade is the
  one upgrade with no way back — `builds/` holds a single entry and
  `--rollback` has nowhere to go — and that is the upgrade most likely to be
  unattended. A symlink rather than a copy: `builds/<sha>` is an npm prefix
  and a global install is already laid out as one, so it costs an inode
  instead of four hundred packages, and "the global copy is left in place"
  stays literally true.
- **The smoke test picks its own port and retries.** `ISOCAN_PORT=0` would be
  exact, but `startDaemon` records the port it was ASKED for, so every build
  already on `release` writes the literal `0` into `daemon.json` and cannot be
  found afterwards. A candidate is not always a NEW build — a rollback re-runs
  against an old tree — so the test has to work against builds that predate
  it. A candidate that could not bind is treated as a lost race and retried,
  never as a bad build.
- **Protected builds count toward the three.** Retention is "three builds,
  plus anything in use", not "three spare ones on top of what is pinned".
  Measured above: with a live daemon on the oldest build, the pruner removed a
  newer build instead of it.

**What is NOT closed here.** The refusal that matters most —
*the release tip is not the build your home runs, so nothing was installed* —
is unit-tested only. The real `release` tip and the real home were the same
commit throughout, and manufacturing the lag would have meant a stub home,
which is phase 2's rig rather than this one's. Windows is untouched:
`adoptGlobal` refuses a bin that is a shim rather than a symlink, and says so.

**Work:** `npm i -g` overwrites in place, which disqualifies it from running
unattended: a failed install leaves no working CLI and nothing to fall back
to (#47's empty-directory failure had that shape, and fixing it cost a
branch), and `main.ts` resolves `@isocan/server` through a **lazy** `await
import`, so rewriting the tree under a running command can break that
command.

So isocan owns its install root:

```
~/.isocan/builds/<sha>/     one tree per build, installed and smoke-tested
~/.isocan/current -> builds/<sha>
```

`isocan` on PATH is a shim that resolves through `current`. An upgrade
installs into `builds/<sha>` with `npm --prefix` — a failure is confined to a
directory nothing points at — smoke-tests it, and only then flips the
symlink. Three builds are kept, **and cleanup must never delete a tree a live
process is using**: the registry knows every running daemon's root, and a
build a running daemon resolved into is not eligible for deletion, however
old.

**Where builds come from is a core constraint, because npm can fetch exactly
one build.** `INSTALL_SPEC` is `github:dglazkov/isocan#release` — the *tip*.
So the swap installs the tip only when the tip's manifest claims the sha the
verdict named. When the home is ahead of the tip (pipelines lag), the upgrade
installs nothing and reports why. It never installs whatever the tip happens
to hold: that would defeat using the home as the oracle, and it is how the
flapping the design warns about starts.

**The smoke test is the phase's real content.** `--version` proves a process
boots and can read its own manifest, which is not the claim being tested. The
test that matches the claim: start the candidate on an ephemeral port,
against a scratch `ISOCAN_HOME` so a candidate never writes into the real
registry, and ask `/healthz` for the sha it should be. That is the whole
upgrade in one assertion, and it is only possible because phase 1 made builds
report their commit.

`whichInstall` grows a fifth kind, `managed`. An existing global install
adopts on its first upgrade: installed once into `builds/<sha>`, the symlink
flipped, and the global copy left in place.

`~/.isocan` is the right location: it is already the root of all state, and
`ISOCAN_HOME` already redirects it, so a test can drive a full upgrade cycle
against a scratch directory without touching the machine it runs on.

One thing comes free: `stalenessOf`'s **root** comparison starts firing on
its own, because the old daemon's root is `builds/<old>` and the new copy's
is `builds/<new>`. `rootOfBin` already resolves symlinks with `realpath` to
reach it.

**Outcome:** An upgrade is atomic and reversible, and a broken build never
reaches anyone's PATH.

**Proof:** On a real machine with a scratch `ISOCAN_HOME`: upgrade from build
A to build B, `isocan --version` reports B, `--rollback` reports A again, and
`builds/` holds both. A build whose smoke test is made to fail leaves
`current` pointing at the old build and reports why — measured by breaking it
deliberately, not by reasoning about the code path. An existing `npm i -g`
install adopts on its first upgrade, and the global copy is untouched
afterwards. And the cleanup check: a daemon left running on build A survives
two upgrades with its tree intact.

**Taken 29 Aug 2026**, every beat, quoted in the status above. Suite green
(2031 tests). The mechanics are unit-tested in
`packages/cli/test/managed.test.ts` against fixture builds, because npm can
fetch exactly one build — the tip — so "two builds", "a build that lies about
its sha" and "a build that will not start" are unreachable through the real
thing. One detail of the transcript is worth stating plainly: `--rollback` had
to be run from build A's own bin, because the build being rolled back FROM was
the release tip, which predates the flag. That is the open item "the recovery
commands run on the build they recover from", met in practice on the first
try.

**Findings:**

- **2026-08-29** — `gitHead()` returned null for every git WORKTREE. HEAD is
  per-worktree; `refs/` and `packed-refs` belong to the repository, named by
  `commondir`. Agents here work in worktrees, so every development copy
  reported `commit: null` — and phase 2's verdict was dead on all of them.
  **Found twice on the same day, independently**: this phase hit it building
  the smoke test, and `f35b01f` on main hit it running the suite from a
  worktree. Main's fix is the one that stands — it replaces the ref directory
  rather than searching both, which is what git actually does. Worth recording
  that two sessions found one bug by two routes on the day the project started
  depending on the field; the shared cause is that nothing had ever asserted
  the shape.
- **2026-08-29** — Two path comparisons compared a path node had already
  realpath'd against one nobody had. `whichInstall` called a plainly global
  install `local`, whose upgrade path is `npm i -g`: the first run of this
  phase's own proof overwrote the install it was meant to adopt. Both sides
  now go through `realpath`.
- **2026-08-29** — `build.test.ts` could only assert the `.git` shape of the
  machine it happened to be running on, so three of the four shapes the stamp
  claims to survive were tested by nobody — which is why the worktree bug
  above survived. `f35b01f` fixed the two assertions that were wrong about
  THIS machine; this phase adds the missing half, exporting `gitHead(from)` so
  a clone, a worktree, a packed repo, a detached HEAD and reftable are each
  built on disk and asked.
- **2026-08-29** — The last line of a node crash is node's own version, so a
  build that could not find `@isocan/server` was reported as "it exited before
  answering (Node.js v24.11.0)" — true, and naming nothing. The first `Error`
  line is preferred; the last line stays the fallback.
- **2026-08-29** — `startDaemon` records the port it was ASKED for, so
  `ISOCAN_PORT=0` writes `0` into `daemon.json` and the daemon cannot be found
  by anything outside its own process. Left alone deliberately: the smoke test
  must work against candidates that predate any fix, so it probes instead.

---

## Phase 4 — Applying it unattended

**Status: NOT STARTED**

**Work:** Auto-apply, at three points that are idle by construction, so
nothing has to guess whether it is safe: **park and wake** (an agent waiting
for feedback is idle by definition — on wake it is on the new build, told so,
and told to re-read its guide, since `agent-guide.md` ships inside the build,
in the same message as the feedback it woke for), **`ensureDaemon` starting a
daemon** (a fresh process either way), and **`isocan restart`** (which
already means "come back on current code").

**"On the new build," stated precisely, because the parked waiter is a
running process on the old one.** `isocan wait` blocks in-process, and no
symlink flip moves a running process — that is what atomicity means here.
What the wake actually delivers: the flip happens while the agent is parked,
the wake message carries the notice, and the *next* command the agent runs
resolves through `current` into the new build. The hard part is the daemon
under the waiter: restarting it drops the wait. Either the wait survives a
daemon restart on its seq cursor — the crash-recovery path again — or the
daemon's own swap defers to the `ensureDaemon` and `restart` points and the
wake moves only the CLI. Decide this during the phase; the proof below fails
either way if the waiter's "wake" is actually a dropped connection reported
as one.

**Never a checkout.** `planUpgrade` already refuses a dirty tree. The general
rule: auto is for managed installs; notify is for anyone with a working copy,
including the conductor's machine.

The controls are not optional, and they ship in this phase rather than after
it: `upgrade: "auto" | "notify" | "off"` in `config.json`,
`ISOCAN_NO_UPGRADE=1` for one shell, `isocan upgrade --pin <sha>`, and
`--channel release | main`. **`auto` is the managed install's default.** In
notify mode, applying an upgrade takes four steps on an unattended machine:
the notice appears, the agent reports it, a person approves, and the agent
runs the command. That chain never completes on the machines nobody watches —
which the design calls the normal case — so a notify default would deny this
phase's outcome to the machines that need it most. Safety does not come from
the mode; it comes from the smoke test, the kept builds, and the pin.
`notify` remains the choice for a machine where a person keeps the decision,
and the checkout's only mode by construction.

**Auto-upgrade without a pin makes "when did this start failing"
unanswerable**, and this project answers that question constantly. With
`builds/` kept, a bisect is a symlink flip.

One more field, cheap and important for trust: the home knows both shas and
can return the commit subject lines between them, so the notice reads
*"upgraded to a1b2c3d — 4 commits, incl. 'the face that never went up'"*. An
upgrade that reports what it changed is one people leave enabled.

**Outcome:** A machine nobody is watching runs current code, and can report
when it changed and to what.

**Proof:** An agent parked on `isocan wait` on build A, with a home on build
B, wakes with a message naming the upgrade, and the next command it runs
reports B — on a machine whose `config.json` says nothing about upgrades,
because the default is part of what is being measured. A dirty checkout in
the same situation is untouched and reports why. `off`, a pin, and
`ISOCAN_NO_UPGRADE=1` each hold across a home that has moved. And the
negative case, measured rather than reasoned: no flip moves a running
process — a long-running `isocan wait` interrupted mid-flight is still
running from `builds/A`, and that tree is intact.

**Findings:** none yet.
