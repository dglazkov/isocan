# Working in this repo as an agent

isocan is an isomorphic canvas: a daemon owns the state, and the web app and
the `isocan` CLI are equal clients over one operation vocabulary. `README.md`
is the orientation; `isocan --help` is the command reference, and it is
written for you.

## The guide, and the skill that points at it

If you are here to **collaborate on a canvas** — address comments, build or
edit items, park on `isocan wait` — run `isocan --agent-help` first. That is
the protocol in full, and it lives in
[`packages/cli/src/agent-guide.md`](packages/cli/src/agent-guide.md): shipped
with the CLI so an upgrade upgrades the instructions too (#75). Instructions
about using the CLI belong there, not in the skill.

The skill at
[`.agents/skills/isocan-collab/SKILL.md`](.agents/skills/isocan-collab/SKILL.md)
is the doorway: what isocan is, how to install the CLI if it is missing, and
"now go run `isocan --agent-help`". It is an
[Agent Skill](https://agentskills.io/specification): most harnesses discover
it themselves under `.agents/skills/`, and Claude Code reaches the same file
through the committed symlink at `.claude/skills/isocan-collab`. One file,
many doorways — please keep it that way rather than copying it into a new
harness's directory, and keep it short: a skill sits in a directory for
months, so anything it says about the CLI is a copy that ages.

## Starting a project from scratch

[`docs/new-project.md`](docs/new-project.md) is the bootstrap walk: empty
directory → git repo → a canvas bound to the directory by a committed
`.isocan/project.json` → several agents, each named by its own harness session,
parked on `isocan wait`. Read it when someone asks how to *start* something on a
canvas rather than how to work on one that exists.
[`scripts/new-project.sh`](scripts/new-project.sh) is that walk in one
idempotent command; the doc stays the explanation of what each step was for.

## The multiuser build

The hosted/multiuser work is one project directory,
[`docs/projects/multiuser/`](docs/projects/multiuser/), read in this order:
[`journey.md`](docs/projects/multiuser/journey.md) (the experience, ground
truth), the design docs beside it (the mechanisms —
[`identity-desk.md`](docs/projects/multiuser/identity-desk.md),
[`innkeeper.md`](docs/projects/multiuser/innkeeper.md), and the rest),
[`docs/architecture.md`](docs/architecture.md) (the physical map, which is the
whole product's and not this project's), and
[`phases.md`](docs/projects/multiuser/phases.md) (the walk — its "where we are"
line says which phase is next; start there).

## Changelog

`docs/changelog/` is a page per day: what changed and why, written from the
commit history. Add the day's entry when you finish a session's work — the
reasoning is the expensive part to recover later, and the diff is not.

A nightly workflow (`.github/workflows/changelog.yml`) covers the days nobody
remembers to. `scripts/changelog-day.mjs` gathers the day's commits with their
full messages into a draft; the model step turns that into an entry and adds
the index row; the result arrives as a pull request. It never touches a page
somebody already wrote. Writing the day yourself is still better — you were
there — and the workflow finds nothing to do when you have.

## The night shift's pull requests

Three workflows open a pull request on a schedule — `changelog.yml`,
`grade.yml`, `persona.yml` — and until this section existed, nothing said what
happens to yesterday's machine PR when today's lands. What that cost: five
open machine PRs at once on 9 Sep 2026 (three grades, two changelogs), each
waiting on a person remembering — the same failure as the hand-kept review
index, which produced daily and drained never.

The rule is one line: **a workflow's queue never holds more than one open PR,
the newest run's, and machinery enforces that — not a person remembering.**
What "enforces" means is per-workflow, because the three PRs are different
kinds of thing.

**Persona runs merge themselves, and only themselves.** Settled already, and
the template for the rest: the run merges its own PR when the diff is entirely
`docs/reviews/` and leaves anything wider for a person. The half that forces a
person exists too, elsewhere: a finding left `unanswered` for three days
reddens the suite (`test/review-queue.test.ts`).

**Grades are the easy case.** The graders are deterministic — "nothing here is
a judgement", says the PR body — and each night adds one dated page under
`docs/grades/`, so nights never touch the same bytes and any drain is a clean
merge. The run merges its own PR and then drains its predecessors oldest
first: merging each that still merges, closing as *superseded* any that no
longer does, with a comment naming the run that closed it. Merging is the
default because the pages are a time series — yesterday's readings are
yesterday's, not stale — and a conflict can only mean somebody hand-edited a
generated page, which is what supersede is for.

**Changelogs are the exception, and the reason the rule is per-workflow.** The
entry is a judgement — "read it before merging", says the PR body — and a day
is not made stale by a later day: Tuesday's entry is not superseded on
Wednesday. So a changelog PR is the one machine PR that waits for a writer.
The PR is the drafting surface; whoever writes the entry — person or agent —
deletes the draft marker, adds the index row, and merges. Machinery owns the
floor and the door: a draft still unmerged after three days is merged *as a
draft*, marker intact and index row saying so — the workflow's founding
argument is that a draft nobody has written up beats a missing day, and a
merged draft on `main` stays editable where a closed PR does not. And the one
supersede-close: when the day's page already exists on `main`, written by a
person, the run closes its own PR and says so.

Three bounds hold all of them:

- **A workflow touches only its own branches** (`changelog/`, `grades/`,
  `personas/`) — never another workflow's PRs, never a person's.
- **A merge is checked, not trusted — and the check has to be run, not
  awaited.** PRs opened by `GITHUB_TOKEN` fire no `pull_request` workflows, so
  no machine PR has ever carried a suite check — including the persona PRs
  that merge themselves. The merge step runs the suite against the branch
  itself; a red suite leaves the PR for a person.
- **Closing is reversible.** Supersede closes the PR, keeps the branch, and
  the closing comment says how to recover it.

What this changes for the morning: with the reports landing on `main` nightly,
the job stops being "merge the queue" and becomes "read the page" — which is
what the pages were for.

## Research

`docs/research/` holds findings that took longer to reach than they take to
read — format evaluations, ecosystem surveys, readiness assessments. Its index
says what each one found. Read the relevant one before re-deciding something it
already measured, and add to it when you learn something a month from now would
want.

## The standing reviews

Nine personas in `.agents/personas/` (with doorways in `.claude/agents/`)
watch what shipping tends to erode — among them a market researcher, a design
auditor, an architect, a QA tester, and one that opens the app and uses it.
[`docs/projects/personas/README.md`](docs/projects/personas/README.md) has the
full table, each with the number it owns. Each reads
`docs/reviews/README.md` before it looks, so a run in October knows what a run
in August measured, and writes its findings back there as a dated page.

`docs/reviews/lessons.md` is the one to read even if you never run them: the
failure modes this codebase has actually produced, each with the guard that
now catches it. Add to it when a bug turns out to have a shape.

## Where a document goes

**A project is a directory.** `docs/projects/<name>/` holds everything about
one body of work — the ideal (`journey.md`), the walk (`phases.md`), and the
mechanisms it forced, one bounded mechanism per file, each opening by naming
the debt it discharges. A project with a single design has one `design.md`; a
project with several names each for what it designs. Nothing outside the
directory has to be edited when a project grows a doc, and reading one project
end to end is `ls` and then reading in order.

That is already the shape the docs had, spelled as directories rather than as
a convention: `multiuser/journey.md` spawned `identity-desk.md`, `innkeeper.md`
and `offline-birth.md`; `atlas/journey.md` spawned `convergence.md` and
`content-origin.md`; `evals/plan.md` will spawn the corpus report, the
telemetry payload and the grader harness the same way — and they will land
beside it.

**What stays at the top level is what belongs to no single project**:
`architecture.md` (one physical map of one system — every project moves it, so
it cannot live inside any of them), the guides (`development.md`,
`new-project.md`), and the three cross-cutting records, which are indexed by
time rather than by subject: `changelog/`, `research/`, `reviews/`.

[`docs/projects/README.md`](docs/projects/README.md) is the index — what each
project is and where it stands. Add the row when you add the directory.

## Journeys

`docs/projects/multiuser/journey.md` and `docs/projects/atlas/journey.md` are
written as scenes and held as the ideal: mechanism appears only where a scene
forced it. Each ends with "what the scenes force" — the load-bearing minimum —
which is the part to read before building anything they describe. A project
that begins with a journey keeps it as `journey.md`, whatever else it grows.

## Evals

`docs/projects/evals/plan.md` is the staged plan for finding out whether isocan is any
good
at what it exists for. The short version, if you only read one thing: the
oplog already records more evaluation signal than most products collect on
purpose — undo is a labelled failure, and a version stack is a preference pair
a person produced for free. Measure what is measurable before asking a model's
opinion about anything.

## House rules

- `npm test` (vitest) and `npm run typecheck` before you call something done.
- Work on `main`. Two other refs are GENERATED and neither is ever edited by
  hand: `release` is what people install from
  (`github:dglazkov/isocan#release`) — CI rebuilds it from every commit you
  push to main, and you must never advertise an install spec without the
  branch, because from `main` npm installs an empty directory (#47);
  `npm run release` does it locally when you need one before CI gets there.
  `green` is main's own commit moved forward once `npm test` and
  `npm run typecheck` have passed on CI, and **it is what dev.isocan.io
  deploys** — so a commit that is green on your laptop and red on CI never
  reaches the dogfood home (phase 10.5). Three refs, three jobs: main is the
  source, `green` is the tested source, `release` is the shipped CLI.
- Mutations are `Operation` values applied by one reducer — if a change makes
  the CLI and the web app able to disagree, it is the wrong change.
- Presence is honest: never claim work you did not do.
- Fixtures and examples are SYNTHETIC. Test against a real canvas all you
  like — it is the fastest way to find real bugs — but never carry its names
  into the repo. A screen title from the canvas you happened to be using ends
  up in a fixture, then in a shipped example, and the product starts looking
  like it was built for one customer. "Acme", "Test", a made-up title: always.

## Done means done on both surfaces

A feature that only a human can reach is half a feature: this is a canvas for
people AND agents, and an agent's hands are the CLI. Before calling feature
work finished, walk this list and say which lines you touched and which you
deliberately did not.

1. **Op vocabulary** — does the change need a new `Operation`, or an extension
   of one? One op per user-visible act, so it is one undo.
2. **CLI verb** — can an agent do this without a pointer? A gesture (drag,
   pinch, hover) does not need a verb, but the INTENT behind it usually does:
   dragging until edges line up became `isocan align`.
3. **Agent guide** — `packages/cli/src/agent-guide.md` (`isocan --agent-help`)
   is what an agent reads before it acts. A verb nobody is told about does not
   exist. `npm test` fails if a command is missing from the quick reference
   there.
4. **Shared helpers in core** — if the web app and the CLI both compute
   something (a filename from a title, what kind an item is, where "aligned"
   is), the computation belongs in `@isocan/core`, not in one client.
5. **README** — the feature list is the product's own description of itself.
6. **Tests** — pure logic goes in `packages/*/test`. Interaction that only a
   browser can prove (a drag, a hover) is verified by driving a real browser
   and SAYING SO in the report, not by asserting nothing.

The forcing function is `packages/cli/test/surface.test.ts`: it reads the
commands the CLI actually registers and fails when one is missing from the
agent guide's quick reference. Adding a verb without telling agents about it
breaks the build.
