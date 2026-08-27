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

**Where we are: PHASE 1 DONE (27 Aug 2026), phases 2–4 not started.**
isocan.io can now say which commit it is running — the defect this project
was built on top of is fixed in production, and the proof is in phase 1's
status below. Nothing else here is built.

Phase 1 was four lines of code and one build-arg, and it was worth doing
regardless of what happens to the rest: it fixed a live production defect and
depended on nothing else in this document. **Phase 2 is the natural next
step** and its test rig now exists, because two daemons on one laptop can be
given two different shas.

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
  The likely answer is the birth home, and the verdict should name the home it
  came from rather than silently using the newest.
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
  there, and nobody has run this on Windows. Recorded so it is a decision
  rather than a surprise.
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

**Status: NOT STARTED**

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

**Findings:** none yet.

---

## Phase 3 — The managed install root

**Status: NOT STARTED**

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

**Findings:** none yet.

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
