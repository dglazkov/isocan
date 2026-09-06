---
status: partial
since: 2026-08-30
issue: 148
see: on-demand
note: the read half is built, and both sources are watched — commits and the repo's own canvas; CI still cannot reach a canvas
---
# A canvas that watches its own repository

**30 August 2026.** Research. Nothing built.

The question: *a canvas called "isocan Repo Admin" showing the guards, the
personas and the agents — and when code lands, an agent fires, tells you, runs
reviews.*

**Short answer: the read half is buildable today with no new mechanism, and it
is the half most likely to be built wrong.** The write half — the canvas
reaching out and something reaching in — is a different note.

---

## Why this is worth doing at all, and it is not the dashboard

isocan's whole argument is that shared state should be *visible* and *acted on
in one place*. The repository's own health is currently the least visible thing
about it: eight personas, eleven metrics, five workflows, 206 test files, 17
run pages and a 45-row roadmap, all readable only as markdown in a git tree by
somebody who knows where to look.

So the pull is real. **The trap is equally real**, and this week has been three
days of removing exactly it: a canvas that MIRRORS the repo is a second copy of
state, and a second copy goes stale in one place with nothing able to tell.
`docs/ROADMAP.md` exists because a hand-kept roadmap had already done that;
`2026-08-26-attaching-a-directory.md` held two contradictory verdicts dated the
same day.

**The rule that keeps this honest:** every panel is either *derived and
regenerated*, or *decided here and nowhere else*. Nothing in between. A panel
that is edited AND regenerated is the stale copy, arriving by a new route.

---

## What is already data

Everything the question asks to see is already machine-readable, and mostly by
commands built this week:

| Panel | Where it comes from | Cost |
| --- | --- | --- |
| The eight personas, goals, and what held | `isocan --json persona ls` | free |
| The eleven metrics and their baselines | `scripts/measure.mjs --list` | free |
| Last night's runs and their findings | `isocan --json persona runs <name>` | free |
| The roadmap: 6 built, 22 open | `docs/ROADMAP.md`, itself derived | free |
| Guards | 206 test files — but see below | **not free** |
| CI and the nightlies | `gh run list` | free |

**"Guards" is the one that does not exist as data**, and it is the panel the
question most wants. This codebase's distinctive habit is a test that remembers
a bug and explains it — `oneblock`, `tokens`, `railspan`, `floats`, the doorway
guard, the ratchets. There is no marker distinguishing those from an ordinary
behavioural test, so "show me the guards" cannot be answered by counting files.

That is a finding rather than an obstacle: **if guards are worth seeing, they
are worth marking.** A one-line convention — a tag in the describe block, or a
`@guard` in the docblock naming what it remembers — would make the panel
possible and would also make the guards greppable for the people who keep
rediscovering them. It costs a convention and buys a lens.

---

## The read half, buildable today

`isocan add <file>` puts a page on a canvas, and `item.addVersion` writes a new
version of an existing item — which `isocan design set` already uses, for
exactly the reason this needs it: *"a version, never a replacement: the style
you are moving away from is the thing you will want to compare against
tomorrow."*

So a script can render the panels as self-contained HTML, add each once, and
push a new version on every run. The canvas's own version stack then becomes
the history of the repo's health, for free, with no store to keep and nothing
to reconcile.

**~~One gap in the CLI, and it is small.~~ There was no gap.** This note said
`isocan add` only ever creates a new item and nothing exposes
`item.addVersion` for an arbitrary one, so a regenerating dashboard would silt
— forty panels by Friday. **`isocan edit <item> <file>` is that verb**, and was
already there when this was written: *"Create a new version — from a file, or in
$EDITOR"*. Recorded rather than deleted, because a note that quietly loses a
wrong claim teaches nobody to check the next one.

**Rendering, not screenshotting.** A panel should be a page that reads its own
numbers, not an image of one. isocan already serves item content and already
renders HTML items; a panel that is an `<img>` is a fact nobody can select,
search or diff.

---

## The write half is where it stops being a dashboard

The question's second half — *an agent fires when code lands, tells you, runs
reviews* — is the interesting one, and it needs something that does not exist.

**What exists as of today:** `.github/workflows/review.yml` fires on every push
and takes every persona's numbers. When one moves the wrong way it comments on
the commit. That is already "an agent fires and tells you" — it just tells
GitHub, because GitHub is the only place it can reach.

**What it cannot do is tell the canvas.** CI has no isocan daemon, no badge,
and no route in. Every honest version of this panel stops at the same sentence,
and so does the agent-wake question. **Three doors, one hinge**, and the hinge
now has an authoritative design: the ACP address hook of
[`on-demand/design.md`](../projects/on-demand/design.md) (decided 2026-08-30;
phase 12 and its dispatch shape retired the same day).

### The one thing that must be decided ON the canvas

If the canvas only ever displays, it is a dashboard and will be looked at twice.
The fact that does not exist anywhere else — and therefore the fact worth
putting there — is **the outcome of a finding**: accepted, rejected, or
unanswered.

That column exists today in the run pages, and today it is edited by hand in
markdown. Moving the *deciding* onto the canvas gives the panel a reason to be
open, and gives the trust battery its first real reading, which is the thing
`docs/projects/evals/plan.md` measured as missing: nine fan-outs and two
choices.

**And it is the one thing that must not be regenerated.** A panel that redraws
outcomes from the markdown, while people click outcomes on the canvas, is two
sources for one fact — the bug this whole note is written around.

---

## What would make this fail

- **A mirror.** Every panel derived and regenerated except one, and that one
  decided here and nowhere else. If a second panel ever becomes editable, this
  has failed and the failure will be silent.
- **A canvas nobody opens.** The read half is easy and worth little on its own:
  the numbers are already one command away for anybody in a terminal. It earns
  its place when something arrives on it that was not going to arrive anywhere
  else — which is the write half, which is why building the read half first is
  a risk rather than a milestone.
- **Silting.** A new item per run rather than a new version. Named above
  because it is the single most likely way this goes wrong in week two.
- **Guards that are only a number.** "206 test files" is not a lens. The panel
  is worth something only if a guard can say what it remembers, which needs the
  convention above.

---

## What was built, 30 Aug 2026

The read half, and the half of the write half that is reachable from this
machine. Four files:

| | What it is |
| --- | --- |
| `scripts/canvas-board.mjs` | Renders eleven panels and publishes them — created once, a new **version** every time their bytes change, nothing at all when they have not. |
| `scripts/hooks/post-commit` | When code lands, refresh the board and say so in the Chat. |
| `scripts/install-hooks.mjs` | Symlinks the hooks into `.git/hooks`, one at a time, refusing to overwrite one it did not write. |
| `test/canvas-board.test.ts` | Sixteen guards, including the two bugs this build shipped and caught. |

```sh
npm run hooks              # install the post-commit hook (--remove, --status)
npm run board              # refresh every panel now
npm run board:brief        # just the morning brief, and say so in the Chat
node scripts/canvas-board.mjs --dry-run      # render, write nothing
```

**The canvas is named per machine, not per repo.** `.isocan/board.json` holds
`{"canvas":"prj_…"}` and `.isocan/` is git-ignored, so a clone of this repo
publishes to nobody's canvas until somebody says which — the correct default
for a file that would otherwise commit one person's canvas id into everybody's
checkout.

### The panels

**Tree status** — every persona as a dot, then a table of what is not holding,
at this commit and this working tree. **Persona · \<name\>**, one per persona:
its goals, each bound, the number now, the drift from its baseline, its model,
trigger and tool count, and the path to its own file and its last run page.
**Recently** — the fortnight's shape as a bar per day, then the last three days
in detail. **Morning brief** — "Welcome to Sunday!", the week's commits, what is
on deck from `docs/ROADMAP.md`, and what wants a person.

Green is *every goal inside its bound*; red is *a goal past it*. **Amber
outranks red**: an instrument that would not run is worse news than a number
going the wrong way, because it means the board is not reporting. Grey is *no
goal at all*, which is not the same as fine, and `market-researcher` wears it.
The board exits non-zero for amber alone — a board that goes red every morning
trains everybody to stop looking.

**A panel is found by a `board=<slug>` property, not by its title**, so renaming
one on the canvas keeps it the same panel. Title matching survives only as a
one-time adoption path for panels made before that rule.

### What it does not do, on purpose

**No panel is editable.** Everything is derived and regenerated; the one fact
this note says must be decided on the canvas — the outcome of a finding — is
deliberately absent rather than half-built. The moment a second panel becomes
editable, the mirror bug is back, and it will be silent.

**No guards panel.** Recommendation 1 below is still unbuilt: without a marker
distinguishing a guard from an ordinary behavioural test, "show me the guards"
is a file count, and a file count is not a lens.

### Two bugs, and the guard that nearly did not work

Both were the same shape — an instrument reporting success while meaning
nothing.

**The commit parser.** Asking git for `--shortstat` and `--pretty` in one pass
interleaves them, so a reader taking "up to the next separator" swallows every
commit after the first. The panel rendered *"nothing landed in the last 14
days"* against 470 commits, with a straight face. Two passes joined by sha now.

**The guard for it, which passed on the broken parser.** The first test checked
that HEAD's sha appeared and that the count was above one — and the broken
parser satisfied both, because it got record one right and turned every later
one into a stat line wearing a sha's place. The test now checks that *every* sha
the panel renders is one `git log` actually reports, and it was falsified
against the real bug before being kept.

That second one is the paragraph worth keeping. **A measurement that cannot fail
reports success forever, which is worse than no measurement because it is
believed** — the personas' own rule, met from the other side.

### The morning brief needs a clock

The hook refreshes the brief on every commit, so it is fresh whenever anybody is
working — and stale on a Monday morning before the first commit, which is
exactly when it is read. That wants a scheduler, and a scheduler is a change to
somebody's machine rather than to this repo, so it is written down and not
installed:

```sh
# every weekday at 07:30, in the user's own crontab
30 7 * * 1-5 cd /path/to/isocan && /usr/bin/env node scripts/canvas-board.mjs --only brief --notify
```

### Watching both sources

The question was about two kinds of change, and the first build only covered
one. `scripts/board-watch.mjs` (`npm run board:watch`) watches:

1. **The repository** — HEAD moving, whatever moved it: a commit here, a
   `pull`, a rebase, a checkout by another agent. The `post-commit` hook already
   covers a commit made in this tree; this covers the rest, and covers the
   commit too where nobody installed the hook. `fs.watch` on `.git` fires for
   index writes and lock files as well, so HEAD is **re-read and compared**
   rather than assumed — which is why an ordinary `git status` does not wake
   the board.
2. **The repo's own canvas** — the one `.isocan/project.json` names, watched
   with `isocan wait --all-ops`. That marker is committed, so it is the same
   canvas for everybody who clones; it is **not** the canvas the panels are
   published to, and conflating the two is the easy mistake here.

It runs in the **foreground**, one process, a line per wake — for the reason in
the next section. It **debounces**: a person dragging twelve items writes twelve
ops, and twelve refreshes would be twelve versions of every panel, which is the
silting the note warns about arriving through the watcher instead of the
generator. And two refreshes never overlap; a change that lands mid-run is
re-scheduled rather than dropped.

### The identity bug, which cost eleven silent failures

**A git hook inherits the environment of whatever committed.** In a repository
with several agents working in it, that is *another agent's session* — so the
board acted as that agent, and every one of the hook's first eleven runs died
on `"Kenny" is taken here`. The board had never once updated from a commit, and
said so only into `.isocan/board.log`, which nobody was reading.

The fix is `scripts/board-identity.mjs`: clear every harness variable the CLI
could be recognised by — the four it ships with, plus anything this machine
declared in `~/.isocan/config.json` — and pin `ISOCAN_SESSION_ID` to one stable
key. *Deliberate beats ambient* is the CLI's own rule
(`packages/cli/src/harness.ts`); clearing the rest is belt, because which leaked
session *is* this process is settled by the registry rather than the
environment. The board is now its own collaborator, **Board**, and its panels
and messages are signed that way whoever set it off.

**It matters a second time, and that one is easier to miss.** `isocan wait`
never wakes you on your own ops — so a watcher parked as the person who
launched it is blind to exactly the changes that person makes, which is most of
them. Caught by watching the watcher miss a text node this session had just
created. One module, imported by both scripts: two copies of this rule would
drift, and the drift would look exactly like the bug.

**Both are guarded**, and both guards were falsified against the real bug before
being kept — `test/canvas-board.test.ts`, 32 of them now.

### Two logs, and why one of them is foreground

The hook writes to a file and the watcher writes to a terminal, and that
difference is deliberate. A hook cannot hold a terminal — you are at a prompt —
so it detaches and names its log. A watcher can, and should: **the eleven silent
failures happened in the half that writes to a file.** Anything that can be
watched in front of a person is.

### The write half is still what it was

CI still cannot reach a canvas — no daemon, no badge, no route in. A git hook is
not a counter-example to that sentence; it is the case where the two machines
happen to be the same machine. **Three doors, one hinge**, unchanged.

## Recommendation

1. **Mark the guards.** A convention naming what each remembers. Useful
   immediately, independent of any canvas, and the prerequisite for the panel
   the question most wants.
2. **`isocan add --to <item>`** — a new version of an existing item, over an
   operation that already exists. One command, and the thing that makes any
   regenerating panel possible without silting.
3. **Then the read panels**, generated, versioned, and explicitly a projection.
4. **The write half only after the next note**, because until something can
   reach a canvas from outside, "an agent fires and tells you" tells GitHub —
   and a dashboard that cannot be told anything is a dashboard.

## Sources

- Personas, metrics, runs, roadmap: this repository, counted 30 Aug 2026.
- `item.addVersion` used as "a version, never a replacement":
  `packages/cli/src/main.ts`, in `design set`.
- Review on push, and what it can and cannot reach:
  `.github/workflows/review.yml`.
- The stale-copy failures this note is written to avoid:
  `docs/research/2026-08-26-attaching-a-directory.md` and the note at the top
  of `docs/ROADMAP.md`.
- Nine fan-outs and two choices: `docs/projects/evals/plan.md`.
