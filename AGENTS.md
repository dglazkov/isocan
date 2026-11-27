# Working in this repo as an agent

isocan is an isomorphic canvas: a daemon owns the state, and the web app and
the `isocan` CLI are equal clients over one operation vocabulary. `README.md`
is the orientation; `isocan --help` is the command reference, and it is
written for you.

## The guide, and the skill that points at it

If you are here to **collaborate on a canvas** — address comments, build or
edit items, park on `isocan wait` — run `isocan --agent-help` first. That is
the cold start — what isocan is, the lap, and every verb on one line — with a
list of topics; `isocan --agent-help <topic>` prints one, and `all` prints the
lot. It is one file, [`packages/cli/src/agent-guide.md`](packages/cli/src/agent-guide.md):
the cold start first, then each topic opened by a `<!-- topic: slug | summary -->`
line. It ships with the CLI so an upgrade upgrades the instructions too (#75). Instructions about using the CLI
belong there, not in the skill. The cold start has a token budget (#124,
`packages/cli/test/agent-guide.test.ts`): new prose goes in a topic, and the
cold start gets one line.

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

## The conductor

`/spin <project>` (`.claude/skills/spin/SKILL.md`) is how a project's
`phases.md` is walked: the session that runs it briefs a subagent on the next
phase, verifies the named proof itself, writes the record, and commits the
phase whole to `main`, then goes on to the next one until a step needs a
person. `status.sh <project>` beside it prints where a project stands and
lints the docs' own rules. It lives under `.claude/skills/` rather than
`.agents/skills/` on purpose: it is this repo's own workflow, and
`npx skills add dglazkov/isocan` must hand a stranger the collaboration skill
and nothing else. The old `/conduct` command remains a thin forwarding
skill at `.claude/skills/conduct/SKILL.md`; its `status.sh` path also forwards
to the local spin script. Both names keep the same behavior and permissions.

<!-- practice:begin 1.0.0 -->
## How we work (practice 1.0.0)

This project runs [practice 1.0.0](https://github.com/dalmaer/practice/blob/v1.0.0/PRACTICE.md). In short:

- **The backlog is the project's Unison workspace.** Outcomes live in the main Backlog. Agent work goes in **Agent work**, scheduled runs in **Scheduled runs**, and anything waiting on a person in **Needs you**. File each item in its section.
- **An item is an outcome.** Its body starts with `Done when:` and `Check:`. Children start with `Parent: #N` and, when order matters, `Needs: #a, #b`. Build nothing that has no done-when; propose one and ask the owner first.
- **Assignment is readiness.** Create items assigned (`--to`). Claim only unassigned leaves whose needs are closed. Take assignments only from the owner.
- **Every PR gets a review from a different provider**, on the exact commit that merges, with the checks green on the PR merged with current `main`.
- **Found work is a new item, never a fix in passing.** File leftover review findings as items.
- **One-way steps go to a person**: production deploys, publishing, secrets, spend, and merges that ship. This project's list is in its own guide.
- **Close on proof**: the merged PR and its green CI run.
<!-- practice:end -->

## Where the work is planned

The backlog lives in this project's Unison workspace: https://unison.cloud.run/w/ws_7ea6df51
(#1 is the highest priority). Work is claimed and tracked there; each project's plan stays in
`docs/projects/<name>/phases.md`, and each open phase has an item in the workspace.

**First time on this machine:** install the CLI with `npm install -g @digitalex99/unison`,
then run `unison --agent-help`. It is the whole protocol, so read it before acting.
Agents join only with a pass from the person who invited you (`unison join <workspace-url> --pass <pass>`);
never use `--account`. `.unison.json` holds your token and is git-ignored: never commit it.
If a command exits 4, stop and ask the person who invited you for a new pass.

**The loop:**
- `unison backlog claim` takes the top open item (or `backlog start <id>` for a given one;
  it renews your 12-hour lease).
- `unison backlog comment <id> "<status>"` while you work.
- `unison backlog pr <id> <url>` links each PR.
- `unison backlog close <id> --note "<what landed>"` once it's on main.
- New work you find: `unison backlog add "<title>" --body "<why, and done when>"`.
  Don't fix it in passing.
- Need your human (a decision, a login, money): `unison chat send "@<them> <ask>" --item <id> --action`.

A phase's **Status:** line in `phases.md` stays the record of what was proved.

**The workspace's sections**, from [practice 1.0.0](https://github.com/dalmaer/practice/blob/v1.0.0/PRACTICE.md):
**Needs you** (waiting on an owner: a check only they can do, a decision, access), **Agent work**
(research, audits, builds and verification behind an outcome) and **Scheduled runs** (one item
per run of a recurring task). Outcomes stay in the main Backlog.

**This project's one-way steps** go to an owner, never an agent alone: promoting isocan.io
(moving the `prod` tag), the ⚑ steps under *Asked first* (repos, secrets, Pages, issues on
another repo, recurring model spend), and any change to how the practice runs here. isocan is
co-owned by both of its owners, so a practice upgrade lands only with both agreeing.

**Maintenance scopes**, for agent work that serves no single outcome: the night shift and its
pull requests, the standing reviews, the persona runs, the changelog, journeys and evals, and
dependency and CI upkeep.

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

Two workflows open a pull request on a schedule — `changelog.yml` and
`persona.yml` — beside Renovate's lanes, and until this section existed, nothing said what
happens to yesterday's machine PR when today's lands. What that cost: five
open machine PRs at once on 9 Sep 2026 (three grades, two changelogs), each
waiting on a person remembering — the same failure as the hand-kept review
index, which produced daily and drained never.

The rule is one line: **a workflow's queue never holds more than one open PR,
the newest run's, and machinery enforces that — not a person remembering.**
What "enforces" means is per-workflow, because the PRs are different
kinds of thing.

**Persona runs merge themselves, and only themselves.** Settled already, and
the template for the rest: the run merges its own PR when the diff is entirely
`docs/reviews/` and leaves anything wider for a person. The half that forces a
person exists too, elsewhere: a finding left `unanswered` for three days
reddens the suite (`test/review-queue.test.ts`).

**Loop pulls are run by hand.** `node scripts/loop.mjs pull` reads Stitch
Loop and files new insights in `docs/loop/` as untriaged findings, with
`docs/LOOP.md` and the roadmap's Loop counts. Proving a claim against the code
and recording a proposal (`loop.mjs propose`, `decision: proposed`) is an
agent's step. A pull never decides, pushes or mines, because a decision
dismisses an insight for everyone in the workspace.

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
person, the run closes its own PR and says so. Both halves are
`scripts/changelog-drain.mjs`, the workflow's last step, run every night.

**Dependencies are Renovate's, in four lanes** (22 Sep 2026). `renovate.json`
is the whole policy; one branch per lane, updated in place, so the rule above
holds without anybody draining anything:

- `renovate/patch-minor`, **daily** — every patch and minor bump, npm and
  Actions alike, one PR, merged by Renovate itself once the checks are green.
- `renovate/lock-file-maintenance`, **Mondays** — the lockfile refreshed,
  merged the same way.
- `renovate/major-weekly`, **Mondays** — every major together, for a person:
  a major changes behaviour, and jsdom 30 raising its Node floor is what one
  looks like.
- `renovate/node`, **Mondays** — `.nvmrc`, the Dockerfile's image and
  `@types/node` in one PR, for a person, because `test/workflows.test.ts`
  holds the first two to one major and a split PR would fail it.

Renovate's PRs come from its app, not `GITHUB_TOKEN`, so unlike the ones
above they DO run `pr.yml` — automerge is waiting on the real suite, not
trusting it. `test/fixtures/` is ignored (its `package.json`s are inputs, not
dependencies), as are the `@isocan/*` workspaces, and the presets that would
split the lanes (`group:monorepos`, `group:recommended`,
`workarounds:groupings`) are turned off. The Dependency Dashboard issue is the
one place to see what is pending.

Three bounds hold all of them:

- **A workflow touches only its own branches** (`changelog/`, `personas/`,
  `renovate/`) — never another workflow's PRs,
  never a person's.
- **A merge is checked, not trusted — and the check has to be run, not
  awaited.** A PR opened by `GITHUB_TOKEN` never runs `pr.yml`, so no machine
  PR has ever carried a suite check — including the persona PRs that merge
  themselves. GitHub does record a `pr.yml` run against it: zero jobs, held
  `action_required` while the PR is open, then marked **failure** the moment
  it is merged or closed. That red is not a verdict on the PR, because nothing
  ran. The merge step runs the suite against the branch itself; a red suite
  leaves the PR for a person.
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

## Loop's findings

isocan's own differences: Ledger's `scripts/loop.ts` is where this ran first,
and `scripts/loop.mjs` (settings in `scripts/loop.json`) carries it here. A finding names a *project* here
(`docs/projects/<name>/`), so the Loop counts in
[`docs/ROADMAP.md`](docs/ROADMAP.md) move with every render. The context Loop
gets beside the triage one is the repo's own `measure.mjs` numbers
(`scripts/loop-measures.mjs`), not an oplog digest — that would carry what
people did on their canvases to a third party.

## What needs a person

[`docs/verify/`](docs/verify/README.md) is the third lane, and the shortest.
`npm test` proves the code does what it says; the `journeys` persona proves a
screen renders and a walk completes; **neither can hold a microphone, a phone,
or an opinion.** A thing lands in that queue when it is built, shipped, and
never once exercised by a human being — the voice agent talked to out loud,
a colour agreed with by eyes, a pause judged to feel like a conversation.

Each entry is a dated page with numbered steps, written by whoever built the
thing for somebody who knows nothing about it, and front matter saying what was
never exercised and what the person needs (`never`, `needs`). The queue is the
first section of `docs/ROADMAP.md`, generated from that front matter — so when
a phase's acceptance is something only people can do, write the walk and it
appears there; a phase that merely says "human walk owed" does not. There is deliberately **no
gate**: answering a review finding costs a word, and running a walk costs
twenty minutes and a microphone, so a hard stop would be switched off by the
first person shipping at midnight. It is a list that can be read, not a bound
that can be missed.

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

- `npm test` (vitest) and `npm run typecheck` before you call something done —
  and **`npm run test:deep` before you push**. `npm test` is the fast lane: it
  leaves out the files that spawn the CLI per case (fifty-three on 27 Sep),
  about half the run's CPU, and prints at the end exactly what it left out. That is the right
  default for the loop and the wrong thing to push on. Three times in one week
  a green subset hid a real failure here — every time in a file the change did
  not name, every time found by the whole suite after the push. A subset is
  never the gate.
- `npm run test:ci` is what both workflows run: the deep lane plus every
  anti-skip switch, so no suite in it can decide at runtime that it cannot run.
  It needs a 21+ JRE for the Firestore emulator and a built `packages/web/dist`
  for the bundle budget; without those it fails rather than skips, which is the
  point of it and the reason `test:deep` is the pre-push command instead. Run
  `test:ci` when your machine can, and know that otherwise those two thirds of
  the gate are CI's. The list of switches and the argument for each is
  `scripts/switches.mjs`; which files are deep and why is `test/deep.ts`.
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
3. **Agent guide** — `isocan --agent-help` is what an agent reads before it
   acts: the cold start at the head of `packages/cli/src/agent-guide.md` and
   the topics it indexes, below it in the same file. A verb nobody is told about
   does not exist. `npm test` fails if a command is in neither the cold start
   nor a topic it points to, and if a top-level verb has no line in the cold
   start's verb index.
4. **Shared helpers in core** — if the web app and the CLI both compute
   something (a filename from a title, what kind an item is, where "aligned"
   is), the computation belongs in `@isocan/core`, not in one client.
5. **README** — the feature list is the product's own description of itself.
6. **Tests** — pure logic goes in `packages/*/test`. Interaction that only a
   browser can prove (a drag, a hover) is verified by driving a real browser
   and SAYING SO in the report, not by asserting nothing.

The forcing function is `packages/cli/test/surface.test.ts`: it reads the
commands the CLI actually registers and fails when one is missing from the
cold start and from every topic it points to. Adding a verb without telling agents about it
breaks the build.

## Asked first

**⚑ steps are asked, with the price.** Creating repos, setting secrets,
enabling Pages, filing issues on another repo, scheduling model spend: each
one waits for the owner's yes.
(why: External resources and recurring spend create obligations only the owner can accept.)

