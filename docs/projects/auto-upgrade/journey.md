# The auto-upgrade journey

This document describes the intended user experience of auto-upgrade as a set
of scenes. It is the acceptance suite for [`phases.md`](phases.md): a phase
that claims a scene is done only when the scene plays. Unlike the
[multiuser journey](../multiuser/journey.md), which was written before its
design, this document was written after [`design.md`](design.md). Writing it
still surfaced design gaps; they are listed at the end.

How to read a scene: each one opens with the claim it exists to establish,
in italics. The narrative plays that claim out. Where a scene carries hard
assertions, they close it as **What must hold** — the list a phase review
checks.

The scenes are ordered by when their phases ship, not by mode. The notice
(phases 1–2) comes before the unattended upgrade (phases 3–4), and `notify`
mode remains supported after `auto` becomes the managed default — so a
machine that is weeks stale after phase 4 is one running only phases 1–2, a
checkout, or a machine where someone chose `notify`.

A **managed install** is one the upgrade machinery owns: each build in its
own `builds/<sha>` directory, with a `current` symlink pointing at the one
in use. The front door's `npm i -g` produces it — the shim adopts the
global install into this layout. Only a managed install upgrades itself; a
checkout is never modified (Scene 4), and an on-demand install is recreated
fresh each summons (Scene 7).

The cast is the multiuser cast. Auto-upgrade is not a feature these people
use directly. It is what keeps their scenes working as the code changes
underneath them.

## Cast

- **Priya** — works thick: local daemon, browser, agent. The CLI on her
  machine was installed by the front door's `npm i -g`. She has never chosen
  a version and rarely opens a terminal.
- **Isaac** — Priya's agent. Runs the CLI constantly; parks in `isocan wait`
  between tasks.
- **Jordan** — escalated to a thick setup in multiuser Scene 5. She installed
  the CLI with one pasted command and has not thought about it since.
- **Nico** — Jordan's agent.
- **Inna and Sonia** — Sonia is an on-demand agent: created for each summons,
  gone afterward.
- **The conductor** — the developer machine, which runs a checkout of the
  repo. Auto-upgrade never modifies it.

## Scene 0 — A stale CLI says so, once

*A CLI that has fallen behind its home produces a notice: once per verdict,
in a form an agent can act on, and silent when there is no verdict.*

Three weeks after Priya pasted the setup line, her copy is forty commits
behind the home she works against. She hasn't opened a terminal since; her
surface is the browser, which updates on every reload. Isaac operates the
CLI.

Priya is this scene's first player, not its permanent one. Her copy can
drift like this only before phase 3 adopts it into the managed layout;
after phase 4, `auto` closes the gap on her machine before it grows. The
scene itself never retires — it is the standing contract for every machine
that only watches: a checkout, or a machine where someone chose `notify`.
Replay it there.

The notice has two forms, one per reader:

- A field on `isocan status --json` and on every wake payload: both shas,
  both dates, and the home the verdict came from. This is the form an agent
  acts on.
- One stderr line. Its audience is a person reading the transcript of an
  agent's session.

> isocan: this copy is `04279b2` (built Aug 12); your home isocan.io runs
> `a1b2c3d` (Aug 25). `isocan upgrade` catches up; `upgrade: "auto"` in
> config.json makes it unattended.

The line states facts and names commands. It does not tell anyone to act.
Who may act is a separate rule: in notify mode, the upgrade decision belongs
to a person. When Isaac sees the notice, he reports it to Priya. He does not
run `isocan upgrade` on his own judgment; an agent that upgrades itself in
notify mode has re-implemented auto mode without its controls.

**What must hold:**

- The `--json`/wake field carries both shas, both dates, and the source
  home; the stderr line is one line.
- The notice states facts and names commands; it does not instruct.
- In notify mode, the upgrade decision belongs to a person. An agent does
  not act on the notice alone.
- Offline produces no verdict and no notice — never "you are current."
- A home that cannot report its build (a pre-phase-1 image) also produces
  no verdict.
- The notice prints once per verdict — keyed on the sha pair, not per
  command and not per daemon. A new sha pair gets one new notice.

## Scene 1 — The upgrade happens while nobody watches

*On a managed install, upgrades are unattended by default: installed aside,
smoke-tested, flipped at an idle seam, and reported in the next wake.*

Priya configures nothing. `auto` is the default for managed installs;
safety comes from the smoke test, the kept builds, and the pin — not from a
human in the loop. `notify` remains available for anyone who wants to hold
the decision.

Overnight, the home moves twice. Isaac is parked in `isocan wait`, and
parked is idle, so the machinery installs the new build into
`builds/a1b2c3d`, smoke-tests it against a scratch home, and flips the
`current` symlink. The parked process keeps running the old build; no flip
moves a running process.

In the morning, Jordan's comment wakes Isaac. The wake message carries the
feedback and the upgrade together:

> comment from Jordan on itm_k3f: "match the spacing on these" · upgraded to
> `a1b2c3d` — 4 commits, incl. "the face that never went up"

The wake also tells Isaac to re-read `agent-guide.md`, because the guide
ships inside the build and may have changed. The next command Isaac runs
resolves through `current` to the new build.

**What must hold:**

- Upgrades apply only at idle seams; no flip moves a running process.
- The wake reports what changed — sha, commit count, a notable subject
  line — because an upgrade that reports what changed is one people leave
  enabled, and one that changes things silently gets turned off.
- A wake that upgraded the agent tells it to re-read `agent-guide.md`.
- The next command after the flip runs the new build.

**Played 29 Aug 2026, except one line.** Phase 4 closes every item above but
the commit count and the subject: the home has no `.git` — `.dockerignore`
excludes it, correctly, and that exclusion is why phase 1 existed — so nothing
at the home can read the history between two shas. Producing it would mean a
GitHub API call from the home, the dependency the design rejected when it
chose the home as the oracle. Until somebody decides that trade, the wake
names both shas and says nothing it cannot know. **The scene is not amended to
match what shipped**, because the shortfall is worth keeping visible: an
upgrade that says what changed is the one people leave enabled, and this one
does not say it yet.

## Scene 2 — A broken build never reaches PATH

*A build that fails the smoke test is refused: `current` does not move, the
refusal is reported, and the next release installs normally.*

Thursday's release is broken in a way CI missed. Priya's machine installs it
into `builds/`, starts it on an ephemeral port, and asks `/healthz` for its
sha. The candidate fails.

The refusal reaches a person the same way the notice does: Isaac reports it,
or Priya reads it in a transcript. "Not silent" means the refusal can reach
a person, not that it interrupts one.

**What must hold:**

- `current` still points at the working build; the broken build never
  reached PATH. A failed upgrade is a directory nothing points at.
- The next `isocan status` reports that a build was tried and why it was
  refused. A refused build is always reported.
- The next check retries. Friday's release installs normally.

## Scene 3 — Recovery is two memorable commands on a suspect build

*When a regression escapes the smoke test, a human recovers with two simple
commands — and rollback must work even though it runs on the build it rolls
back.*

The next week, a regression gets past the smoke test. This is the one scene
where a human runs the CLI, because the code under her agent is what she
suspects, and a recovery path cannot require trusting the thing it recovers
from. Priya opens a terminal:

- `isocan upgrade --rollback` flips `current` to the previous build. The
  regression disappears. Because `builds/` keeps three builds, the bisect
  took one command.
- `isocan upgrade --pin 04279b2` holds the machine there while she files the
  issue with both shas in it.

**What must hold:**

- These are the only commands humans run, so they must be simple and
  memorable.
- `--rollback` executes on the suspect build itself, so it must stay
  minimal: read a directory, flip a symlink.
- A pinned machine still receives notices — otherwise it is a machine
  everyone forgot.

## Scene 4 — A checkout is notified, never modified

*Auto-upgrade applies only to managed installs; a checkout gets the notice
and nothing else.*

The conductor's machine has a dirty working tree when the home moves. It
receives the notice, which names the copy it refers to ("the checkout at
…"). Nothing else happens: no stash, no pull, no merge — regardless of
settings. `--channel main` changes what the checkout is compared against,
not this rule.

Even here, an agent types the commands — the conductor model has Claude
doing the work. The human's part in this scene is the dirty tree.

## Scene 5 — A home is a distribution channel

*Whoever works at a home runs what the home runs. The design does not hide
this; it makes it visible and controllable, per machine.*

Multiuser Scene 5 installed the CLI on Jordan's machine. Tonight, Priya
merges to main, CI cuts a release, and Jordan's machine upgrades while she
sleeps. Jordan did not choose that build. She chose the home.

Running code from `release` unattended on Jordan's machine is a trust
decision. It is acceptable today because one innkeeper runs the project and
Jordan knows them. The "Deliberately open" list in `phases.md` records where
this acceptance ends.

**What must hold:**

- Nico's next wake reports what changed and which home the verdict came
  from.
- The controls are per machine: `off`, a pin, `ISOCAN_NO_UPGRADE=1`.
  Priya's settings do not reach Jordan's machine.
- Jordan exercises her controls by telling Nico. Because an agent flips the
  setting, `isocan status` must show the current setting, so a person can
  verify it.

## Scene 6 — The fleet follows the home, even backward

*The oracle question is "does my copy disagree with my home," not "is there
newer code on GitHub" — so rolling the home back holds the fleet, with no
prompt to move forward.*

The newest build misbehaves in production, and the innkeeper rolls the
home's image back one step. Nothing else is needed: every CLI compares
itself to its home, so the fleet holds.

**What must hold:**

- A CLI now ahead of its home reports the disagreement. It never downgrades
  itself; downgrades happen only from `builds/`, on a person's command.
- On a machine with several homes, the verdict names which home it came
  from — two homes at two builds is a reportable state, not a loop of
  conflicting upgrades.

## Scene 7 — The agent with no version

*On-demand agents get this project's outcome from their lifecycle: the
freshest fleet member is the one that does not exist between summonses. But
"fresh" must be verified.*

Sonia never upgrades. Each summons boots a sandbox, installs the CLI from
the release tip, does the work, and exits.

One requirement carries over: npx's cache can serve a stale copy while
reporting otherwise (#48), which is why `transientDir()` exists. A reborn
agent on a stale cache is Scene 0's bug in a new place.

## The seats

The design's premise in one table: served surfaces update themselves, and
the CLI is the only surface that does not. No human appears in the middle
column.

| seat | who runs the CLI | how it stays current |
| --- | --- | --- |
| person (browser) | nobody — this seat has no CLI | served by the home; every reload updates it |
| agent, thick, managed install | the agent | `builds/` + `current`, applied at idle seams |
| agent on a checkout | the conductor's agent | notified, never modified |
| agent, on-demand | the harness, per summons | reinstalled each run; never upgrades |

## What the scenes force

1. Every build can report its commit, anywhere it runs. A build that cannot
   reports null, never a guess (phase 1).
2. The home is the oracle. The verdict rides existing traffic, names its
   home, and is absent when the home is unreachable or cannot report its
   build.
3. The CLI's operator is an agent. A person touches it twice: the setup line
   and the recovery commands. Consequences: the `--json` field is the
   primary notice surface; stderr is for transcripts; notify mode reserves
   the decision for a person; a wake that upgraded the agent tells it to
   re-read its guide; the recovery commands must work on a suspect build.
4. Notices print once per verdict. Silence is correct when there is no
   verdict; a refused build is always reported.
5. The swap is install-aside, smoke-test, flip. It is atomic and reversible,
   and no flip moves a running process — including cleanup: keeping three
   builds must never delete a tree a live process is using.
6. npm can fetch only the release tip, so the swap installs only when the
   tip matches the verdict, and otherwise reports "not yet."
7. `auto` is the managed install's default; `notify` is for working copies
   and for anyone who wants to hold the decision. Three reasons: a notify
   default asks the least-watched machines to act on a notice their
   operator may not act on; in notify mode an upgrade on Priya's machine
   takes four steps (notice, report, approval, command) to guard a decision
   she already delegated when the setup line chose its own version; and the
   browser set the precedent — every reload is an upgrade nobody approved.
   Safety comes from the smoke test, the kept builds, and the pin, not from
   the mode.
8. The controls ship with auto mode, not after it: `off`/`notify`/`auto`,
   pin, rollback, `ISOCAN_NO_UPGRADE=1` — per machine, and visible in
   `status`, because agents often set them on a person's behalf.

## What the scenes found

Written 2026-08-25, the same day as the design. Each item is a gap the
scenes exposed in a document reviewed hours earlier:

- The fetch step was missing. Phases 3–4 covered installing and applying
  builds but not where builds come from. `INSTALL_SPEC` fetches only the
  release tip, which forces the rule: install only what the verdict named,
  otherwise report "not yet" (now in phase 3).
- A parked waiter is a running process on the old build. "Wakes on the new
  build" was impossible as first written. The actual mechanism: flip while
  parked, report in the wake, next command runs the new build (now in
  phase 4).
- Cleanup could break atomicity. Keeping three builds while a long-lived
  daemon runs an old one would delete a tree in use, unless the sweep checks
  the registry (now in phase 3).
- "Once per daemon" was the wrong notice key. Daemons outlive verdicts, so
  the marker keys on the sha pair (now in phase 2).
- The trust boundary has a date. Multiuser Scene 5 already put Nico on Jordan's
  machine, so both projects shipping is the day someone else's machine runs
  this train (now in Deliberately open).
- The first draft had a human at the keyboard. Rewriting the scenes with the
  agent operating the CLI made `--json` the primary surface, separated
  notify mode from agents upgrading themselves, and added the guide re-read
  to the wake (now in phases 2 and 4).
- Recovery runs on the build it recovers from. `--rollback` executes on the
  code being rolled back, so it must stay minimal (now in Deliberately
  open).
- No phase stated the default mode. With an agent that may not act on the
  notice and a human who rarely sees it, a notify default reaches nobody, so
  `auto` is the managed default (now in phase 4).

## Open debts

The canonical list is "Deliberately open" in [`phases.md`](phases.md). This
document adds one fact: three of those debts have no scene, deliberately.
Nobody plays the homeless daemon (the fallback oracle is designed but
unbuilt), nobody plays a `minCli` refusal (refusing is a compatibility
promise the product has not made), and nobody plays Windows. When one
becomes real, write its scene first.
