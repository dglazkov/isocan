---
name: conduct
description: Run the conductor pattern on a project under docs/projects/ — read where it stands, brief a subagent on the next phase, verify the named proof independently, record what changed course, move the status lines, commit the phase whole to main. Use for "/conduct <project>", "conduct operator", "do the next phase of modules", "where does operator stand", or "close sprint phase 3".
argument-hint: "<project> [status | <phase number> | one]"
---

# conduct: one phase of a project, verified, recorded, committed

A project under `docs/projects/<name>/` is a directory: `journey.md` (the
acceptance suite, held as the ideal), one or more design docs (the
argument; `design.md` when there is one), and `phases.md` (the walk).
This skill is how the walk is walked. The session that runs it is the
**conductor**. It does not build; it briefs a subagent that builds, then
it verifies the proof the phase named up front, never taking the
subagent's word for it, and only then writes the record and commits.
Then it goes on to the next phase. **The default is unattended**: the
conductor runs until the leg is done or until the next step needs a
person, and nothing else stops it. A person is needed for exactly three
things: a token or a login, a paid plan or a cloud resource (a ⚑ step),
and a hand the journey names (a second machine, a click in a browser
the conductor cannot drive, a decision the doc assigns to someone by
name). Everything else, a wrong design, a proof that cannot be run as
written, a doc that disagrees with another, is the conductor's decision
to take, record, and commit.

The project's `phases.md` is the contract. Its opening paragraphs carry
rules of their own (modules: each phase ends with something a person can
remove and watch disappear; operator: every act writes its ledger row
before it answers, and a phase closes on dev.isocan.io first). Those
rules win over anything here. The house rules in `AGENTS.md` apply to
everyone, conductor and subagent alike, and so does its "Done means done
on both surfaces" list.

Invoking `/conduct` is the "land this": the conductor commits and pushes
each phase to `main` without asking again.

## Arguments

- `/conduct <project>`: orient, then conduct phase after phase until a
  step needs a person or the leg is done. Commit and push after each
  phase; the user reads progress from the commits on `main`, not from
  a report they must wait for.
- `/conduct <project> status`: orient and report, change nothing.
- `/conduct <project> <N>`: conduct that phase and stop after it. If an
  earlier phase is NOT STARTED, conduct it first and say so; phases run
  in order for a reason.
- `/conduct <project> one`: the next phase only, then stop.

## Status vocabulary

One of four words on each phase's `**Status:**` line, followed by the
date it last moved and one sentence of what holds:

- **NOT STARTED.** Nothing built.
- **PART-DONE.** Every proof that can run here has run; the walk that
  closes it waits on something named in an Open entry (a person, a
  second machine, a paid plan).
- **CLOSED.** The proof held, walk included. A phase that claims a
  journey closes only when the journey was walked for real.
- **RETIRED**, or a phase re-cut with a `**Formerly: …**` record at the
  end of its section. What was built and why it went stays in the doc.

Older projects mark phases with ✅ in the heading or an italic *Built
<date>* line instead. A project the conductor takes up gets Status lines
on every phase, as part of the orient commit, so the status script can
read it; the words above are the only ones it reads.

## 0. Orient

Run the status script first. It is mechanical on purpose: where-we-are,
every phase's status, the next phase's proof and ⚑ steps, the Open
roster, and a lint of the docs' own rules.

```sh
/Users/dimitriglazkov/Documents/code/isocan/.claude/skills/conduct/status.sh <project>
```

Then read, in this order: the phase's section in `phases.md`; every
journey it names, in `journey.md`; the parts of the design docs those
cite; the Trajectory (or Findings) of the phases before it (they are the
things the design did not know); `AGENTS.md`. Note the wall clock; the
commit message records what a phase cost.

**Three gates before any code:**

- **The docs agree.** If the phase's Proof, the journey's steps, and the
  design's mechanism disagree, fix the docs first, as their own commit,
  before briefing anyone. Journey.md says which way: the mechanism
  changes. Building on a contradiction produces a facade that satisfies
  one document and not the other, and the subagent will not tell you
  which.
- **Nothing is owed to another project.** The where-we-are paragraph
  says when a phase waits on another project's phase (modules phase 5's
  frame half waits on extensions stages 3–4). If so, conduct that phase
  of the other project first, under the same rules, then come back. Say
  so in the report; do not stop for it.
- **⚑ provision steps are asked, not done.** Each one creates a cloud
  resource, spends money, or needs a login. Before the phase starts,
  list them to the user with the price, and get a yes for each. A step
  without a yes is the subagent's stop line: it builds up to it and
  reports. This is the one gate that waits on a person, so before
  stopping at it, do every phase and every part of this phase that does
  not need the answer, so the ask is the only thing left.

## 1. Brief

Write the brief to a file in the scratchpad so it can be reread, reused
if the subagent must be restarted, and quoted in the commit. The brief
is the phase's section verbatim plus what the subagent needs to not
guess:

```
# <project> phase <N>: <title>

## The phase                       (phases.md section, verbatim)
## The journeys it closes          (journey.md sections, verbatim)
## The mechanism                   (the design parts they cite; paths, not paraphrase)
## Trajectory so far that binds you (from earlier phases: each a one-liner and why it matters here)
## House rules                     (AGENTS.md "House rules" and "Done means done on both
                                    surfaces", verbatim; the project's own rules paragraph, verbatim)

## What you own
Files under <paths the phase names>. Nothing under docs/projects/: the
conductor writes the record. Nothing in WHATSNEW.md or docs/changelog/:
the conductor writes those too. No other project's code.

## Where you stop
- At each ⚑ step without a yes above: build up to it, report.
- When the proof would need a facade: something that passes the named
  test but is not the thing (a fixture that cannot fail, a shim that
  answers the test's question and no other). Stop and say so; that is a
  finding, not a failure.
- When the design turns out wrong: stop, say what you found and what
  you would change. The conductor changes the design, not you.

## What you return
1. What was built: files, and one paragraph of how it works.
2. The proof, as exact commands from the repo root, with the output you
   saw, exit codes included. Not "tests pass": the command and the line
   that says so.
3. The "Done means done on both surfaces" list: which of its six lines
   you touched and which you deliberately did not.
4. What you could not do and why, and where you stopped.
5. Candidate trajectory entries: dated one-liners, one claim each, about
   forty words, only for things that change what comes after. The
   conductor keeps, rewrites, or drops them.
6. Anything a later phase should know that the docs do not say.
```

Spawn with the Agent tool (`general-purpose`). Parallel subagents belong
inside a phase, splitting its Work list by file ownership, never across
phases. A subagent's final report is not shown to the user; you relay
what matters.

## 2. Verify

This is the conductor's job and nobody else's. The subagent's report is
a map; the phase's **Proof** paragraph (older docs say **Acceptance**)
is the territory. Run the proof as written there, from the repo root, in
the order written, and read exit codes rather than tails (`| tail` and a
trailing `echo` both report the last command's status, not the suite's).

The checklist, every phase:

- `git status --short`: only the phase's files changed, no leftovers,
  no `.env` or `prod.env` in the diff, nothing under `docs/projects/`,
  nothing under `.isocan/`.
- The whole suite and typecheck, not just the new tests: `npm test`
  (vitest, from the root, every workspace) and `npm run typecheck`. The
  surface guard in `packages/cli/test/surface.test.ts` is part of the
  suite: a new verb without its agent-guide line fails it, and that is
  the phase's failure, not a nuisance. If you ran a subset, say which
  subset and why in the report, or run it whole.
- The named proof, command by command.
- The walk, when the phase has one: against a real daemon (`isocan
  restart` first; the local daemon is usually stale), a real browser, a
  real model, and when the phase says so, dev.isocan.io, which deploys
  the `green` ref and so lags a push by one CI run. Walks find what
  fixtures cannot. A phase with a walk is not CLOSED until the walk is
  walked.
- Open the new tests and ask of each: could this fail? What does it
  exercise, the thing or a stand-in for the thing? A test that asserts
  what the code returns, rather than what the journey requires, proves
  the code agrees with itself.
- Read the diff for a facade: a surface that imitates a program, a shim
  that satisfies the fixture's calls only, a refusal sentence that
  changed without its test, a real canvas's names carried into a
  fixture (fixtures are synthetic: "Acme", a made-up title, always).

**Work that fails goes back down.** Send the failure to the same
subagent with `SendMessage`, so it keeps its context: the exact command,
the exact output, the line of the Proof or journey it violates. Do not
fix code yourself; the conductor edits documents. A doc fix the failure
exposes (a Proof that cannot be run as written) is yours, before
sending it back.

## 3. Record

When the proof holds, and only then, write the record. All of it in one
change, so the docs never disagree with each other:

- **Trajectory** (or **Findings**, in a project that already uses that
  heading), under the phase: only what changes the course of the
  project. A door decision reversed, a phase reordered, scope cut or
  added, a mechanism the design got wrong. One dated line per claim,
  about forty words, `- **YYYY-MM-DD** — Claim. Evidence.` A phase that
  went as planned writes `*nothing — the phase went as planned.*` Work
  done is not trajectory; the status line and git history already hold
  it, and the argument goes in the commit message. Something a later
  phase must pay for is an Open entry: `- **YYYY-MM-DD** — Open: what.
  Who or what it waits on.` The status script lists the roster.
- **The Status line** of the phase: the word, the date, one sentence of
  what holds.
- **The where-we-are paragraph**: which phases stand where, what the
  next thing to do is (`<project> phase N`), what waits on a person and
  what waits on work.
- **`journey.md` front matter**: `status:` (`designed`, `partial`,
  `done`, or the project's own word) and the `note:` retold to include
  this phase.
- **The projects index**, `docs/projects/README.md`: the project's
  "where it stands" cell, which must not be more right than the docs
  it summarizes, and must not be less.
- **Another project's docs**, when this phase changed something they
  describe. `grep -rn` the file or term across `docs/projects/` and fix
  each mention, so a reader of that project is not told a stale fact.
  A closed project is a record; its silence about later work is not a
  gap, so add no forward pointers into it.
- **Citations into another project name it**: `modules phase 5`, never
  `phase 5`, when the reader is in a different project's doc.
- **`WHATSNEW.md`**, only when the phase changed what a person using
  isocan can do; it ships, so nothing about how the work was done goes
  there.

Run the status script again. Its lint must be clean for what you
touched; pre-existing hits are reported, not silently absorbed.

## 4. Commit

One commit per phase, the phase whole: code, tests, the record. Title
`<project> phase <N>: <title>` for a phase that moved, `<project>: <what>`
for anything smaller. The body is the argument: what was built, what the
proof showed, what changed course, in prose a reader who was not here
can follow. End with the session trailer the harness gives you.

Land on `main`, no pull request: `git fetch` and rebase onto
`origin/main` first, because other sessions push all day and
`WHATSNEW.md` and `docs/ROADMAP.md` conflict routinely (after resolving,
`node scripts/roadmap.mjs` regenerates the roadmap). Run `npm test` and
`npm run typecheck` once more on the rebased tree, then push. Do not
bunch phases on a branch. The user reads progress from the commits.

Then go on to the next phase. Write a short report between phases (the
phase, its new status, the proof and what it printed, what changed
course) so a reader following along has one; do not wait for a reply
to it. The full report comes when you stop.

## Stopping

The conductor stops for a person, and for nothing else. The stop is
always recorded first, so a later session can pick up from the docs
alone:

- **PART-DONE, waits on a person.** Local proofs green; the walk needs a
  second machine, a login, a token, a paid plan, or a hand. Status
  PART-DONE, an Open entry naming exactly what and whom, where-we-are
  says so, commit, push. Then, before stopping, look past it: if the
  next phase needs none of that, conduct it. Stop only when every phase
  left needs the person. The final report puts every ask in one list,
  each one sentence with its price.

Before the final report, write the day's page in `docs/changelog/` (one
page per day, the index row too) from the commits the run produced. The
nightly workflow would do it; you were there, so it reads better.

Two things look like stops and are not. Decide them, record them, go on:

- **The design is wrong.** The subagent found the mechanism does not
  hold. Change the design doc as its own commit with the reason, then
  re-brief. A phase can be retired; it cannot be quietly redefined. This
  is the conductor's call, not the user's, and the commit message is
  where the user hears the argument.
- **The proof cannot be run as written.** The Proof paragraph asks for
  something the repo cannot produce. Fix the Proof, say why in the
  commit, then continue. Never mark a phase by a proof that was not the
  one named.

When in doubt whether something needs a person, ask: is the missing
thing a credential, money, or a hand? If not, it is yours.

## Things that have gone wrong before

- A subagent said the suite passed; it had run `npm test | tail`, and
  six tests had failed. Read the exit code.
- Two suites and two typechecks passed while a CLI verb was broken,
  because the break was in a path only the walk runs. Walk.
- A twelve-verb `git` passed every test against a fixture that used
  neither `--depth` nor `git diff`'s header, and the model fabricated a
  real-looking diff to cover for it. A facade that is almost the thing
  costs more than a shell that says it lacks it. Read the diff for one.
- Journey docs were recast while phases still said the old thing; a
  reader found three names for one phase. Record everything in one
  change.
- Provisioning happened before it was asked. ⚑ steps are asked with the
  price, every time.
- A subagent edited `phases.md` and the conductor edited it too; the
  merge lost an entry. The conductor owns the record.
- Findings sections became work logs, and the one entry that redrew the
  map was buried in twenty that did not. Trajectory holds course changes
  only.
- A subagent found a bug beside the phase and fixed it in the same
  turn; the fix was the wrong one, because what to do about it was a
  design call. Report a finding beside the phase; do not fix it unasked.
- A walk was run against a daemon started before the change and proved
  the old code. `isocan restart` first.
- A screen title from a real canvas ended up in a fixture and then in a
  shipped example. Fixtures are synthetic.
- The shell's cwd was reset between commands and a relative `cd` chain
  did nothing. Absolute paths in every command you give a subagent.
