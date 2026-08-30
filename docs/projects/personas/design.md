---
status: partial
since: 2026-08-29
see: personas
note: steps 1-5 built; 6 waits on a second editor
---
# Personas

**29 August 2026.** Unbuilt.

A persona is a named role an agent can take on: a lens, a set of skills, a
goal it is judged against, and a memory of what it has already found. "Percy
the performance analyst." "Darren, who watches the design tokens."

The point is not to make agents fancier. It is that **the useful unit of
agent work is a standing role, not a request** — and this repository has been
proving that by hand for a week without giving it a name.

---

## What already exists, because that is most of the design

This is not a new idea here. It is an existing practice with no shape.

| The idea | What is in the tree today |
| --- | --- |
| A persona | `.claude/agents/*.md` — four of them: architect, design-auditor, qa-tester, market-researcher. Model, effort, tools, and a lens. |
| A directory of runs | `docs/reviews/YYYY-MM-DD-<persona>.md`. Nine so far. |
| Memory across runs | `docs/reviews/README.md`: *"Every run **reads before it looks**."* The index is the first thing a persona opens. |
| Learnings that stick | `docs/reviews/lessons.md`, whose first section is **"The guards that exist"**. |

`design-auditor.md` already carries two headings — **"Read before you look"**
and **"Measure, do not opine"** — which are the memory rule and the evidence
rule, written down and followed.

**And the vision has always been this.** "A Tiny Stitch" puts personas at the
centre: each person builds emissary personas of themselves, *"personas can also
be roles (a pedantic reviewer, a Jony-Ive-sensibility critic), composed into
teams"*, and they *"self-evolve and are shareable"*. This project is not adding
a feature to isocan. It is giving isocan's own working habit a shape so it can
be handed to somebody else.

So the design question is narrow, and worth stating that way before proposing
anything: **what are the four things this practice does not have?**

1. **A trigger.** A human types the name. Nothing runs on its own.
2. **A goal.** The personas say *measure, do not opine* — but none names a
   standing number it must move or hold. Without one, "how did the run go" has
   no answer but prose.
3. **A home that is not Claude's.** They live in `.claude/`, which makes them
   invisible to every other harness and to the canvas.
4. **A record of whether they were right.** Nothing tracks which of Darren's
   findings were accepted.

---

## Where a persona lives

**`.agents/personas/<name>.md`, with a doorway into `.claude/agents/`.**

This is not a new mechanism. It is the one this repo already uses for skills,
applied unchanged:

```
.agents/personas/percy.md                    ← the file. One copy.
.claude/agents/percy.md   -> ../../.agents/personas/percy.md
```

`installSkill` in `packages/cli/src/main.ts` does exactly this for
`isocan-collab` today, and its comment states the principle: *"One copy per
directory, several doorways to it."* The symlink is relative so it survives
being moved or cloned, it is never written over a real file somebody put
there, and on Windows without developer mode the `.agents` copy simply stands
alone.

**One honest difference from skills, and it should not be glossed.**
`.agents/skills/` is a real convention that pi, agy, Codex, Cursor, Gemini CLI
and OpenCode discover on their own. **`.agents/personas/` is not a convention;
we would be picking one.** No other harness reads it today, and this document
should not imply otherwise. What makes that acceptable is precisely the
doorway: the vendor directory is generated, so if a convention emerges with a
different name, the cost of moving is one symlink target and no content
changes.

`personas` rather than `agents`, deliberately. `.agents/agents/` is a path
nobody can read aloud, and the word the vision uses is *persona* — a role a
running agent takes on, which is exactly the distinction the feature depends
on. **The persona is the costume, not the actor.** Any agent can wear it; the
canvas already knows who is actually working, because presence is a session
with an actor behind it.

### Where this is going, so the first version does not close the door

**The model to end at: anyone on the canvas can edit a persona, and agents sign
up for work.** Two halves, and the second is a new idea rather than a
consequence of the first.

*Editing* is the part files already make awkward. A persona in `.agents/` is
editable by whoever holds the repo, which is exactly one machine — fine while
a persona is a habit one person keeps, wrong the moment a team has an opinion
about what Darren looks for. That is the canvas's job and the ordering is
argued below: the canvas becomes authoritative when a second person edits a
persona, not before.

*Signing up* is the half nothing here does yet, and it has since been
researched on its own:
[`docs/research/2026-08-29-one-agent-many-canvases.md`](../../research/2026-08-29-one-agent-many-canvases.md)
found that the fan-out is not blocked by the presence model at all — rooms are
per canvas and one actor may be in many — but by a vouch gate that cannot tell
the same agent arriving somewhere else from somebody claiming to be them. It
also names the consequence that matters most here: an agent working on four
canvases is four actors with four histories today, so **the trust battery can
never charge**. Sign-up is a precondition for the rest of this document, not a
later convenience. Today an agent is told what to
do. The model worth building toward is a **standing offer**: a persona
describes work that wants doing, and an agent that arrives — any agent, on any
harness, on any machine — can take it on, do it, and report against the goal.
The persona is the costume; the sign-up is the shift. It makes the canvas a
place where work is *available* rather than *assigned*, which is what makes a
night shift something other than a cron job with a name.

Three consequences worth writing down while they are cheap:

- **A persona must be readable by an agent that has never seen this
  repository.** It travels; it cannot depend on local paths that only mean
  something on one laptop.
- **A run needs an author.** "Percy said" is not enough once several agents
  can wear Percy: the run records the persona AND the session that wore it.
  Presence already carries the second, so nothing new is needed to store it —
  only the discipline of writing both down from the first run.
- **Taking work must be refusable.** Two agents claiming the same shift is the
  ordinary case, not the exception, and whatever mechanism grants it has to be
  able to say no. `openAsk` and the `blocked` tier are the nearest existing
  shape, and the roster is where a claim would be visible.

None of that is built. It is here because a format chosen without it becomes a
format that has to be broken later, and the two things this first version owes
the future are cheap: **one file per persona** (so it can become one item), and
**front matter that keeps keys it does not understand** (so a field added by a
later build survives a round trip through an editor that predates it). Both
are done.

### Why the canvas is the source of truth, eventually and not first

The long answer is that a persona is a shared fact — something a team writes,
forks, argues about and hands to each other — and every shared fact in this
product is an Operation on a canvas. `design import` is the shape to copy: it
reads a real CSS file into a canvas design system, and afterwards the canvas
is what people edit.

**But not in the first version, and the reason is a measured one.** Files on
disk are what a harness reads at the moment it starts, with no daemon, no
badge and no network. Making the canvas authoritative on day one means every
persona run depends on a canvas being reachable — which converts a text file
into a distributed system for no gain anybody has asked for yet. The canvas
becomes the source of truth when there is a second person editing a persona,
which is the moment it starts paying for itself.

Stated as an ordering rather than a preference: **files first, canvas when the
team is real, and the file layout chosen so the projection is possible later**
— one file per persona, front matter for the machine, prose for the reader.

---

## What a persona says

Front matter the same shape Claude Code already parses, so the doorway needs
no translation layer, plus three keys it ignores and we use:

```markdown
---
name: percy
description: Watches whether the app still runs well after a change.
model: opus
effort: xhigh
tools: Read, Write, Edit, Glob, Grep, Bash
# ---- the persona's own keys ----
goal:
  - name: pan p90
    at most: 12ms
    measured by: scripts/perf-census.mjs --pan
  - name: frames over 32ms during a pan
    at most: 0
    measured by: scripts/perf-census.mjs --pan
runs: docs/reviews/
trigger:
  on: push
  to: main
---
```

**The `goal` is the part that does not exist today and matters most.** The
night shift already wrote the rule this borrows, and it is worth quoting
because it is stricter than it looks:

> An overnight change may be called an improvement only if it **names, before
> the work starts, a number that is already being measured** — and moves it in
> the right direction without moving another one the wrong way.

A goal is therefore not an aspiration. It is `(number, bound, the command that
produces it)`. "Keep the design accessible" is not a goal. "Zero contrast
failures at 390, 768 and 1440, measured by `grade.mjs`" is one, and it is
already true and already enforced.

**A persona with a trigger and no mutation-tested measurement is worse than no
persona**, because it will report "all good" on a schedule and be believed.
This week produced three separate instances of exactly that failure — a CI
selftest that spawned a Chrome path that does not exist on the runner and was
marked `continue-on-error`; a nightly that printed "0 failing checks" three
lines above the contrast failures it had itself measured; and an event-loop
monitor whose first two versions reported a 1500ms stall as `0ms`. Each looked
like a working instrument. **So: no persona may declare a goal whose measuring
command has not been shown to fail on something broken.** That is a build
rule, not advice.

---

## Learnings, and the thing that quietly does not work

"Save learnings over time" is the part of this proposal most likely to produce
a directory nobody reads.

An agent appending a paragraph to its own memory after every run has, by run
twenty, a file whose length guarantees it will be skimmed, and skimming is how
a persona rediscovers what it already knew. The failure is silent: the memory
still exists, still gets loaded, and stops working.

**The answer is already in this repo, and it should become the rule rather than
the habit.** `docs/reviews/README.md` says it in one line:

> A finding that keeps reappearing across runs is a finding that needs a test,
> not a third mention.

And `lessons.md` opens with **"The guards that exist"**.

So: **a persona's memory is the guards it wrote, not the notes it left.** Prose
is the staging area; a finding that recurs is owed a test, and once it has one
the prose can go. That has three properties nothing else here has — it is
checkable by running it, it cannot be skimmed past, and it gets *cheaper* to
carry as it grows, because a guard costs nothing to re-read.

The two artefacts stay, with different jobs:

- **`runs/`** — one dated file per run. Append-only, and allowed to be
  forgotten. Its job is provenance: what was true on this day, on this commit.
- **`lessons.md`** — the standing list, curated, where **every entry names
  either the guard that now enforces it or the reason no guard can**. An entry
  that has been in the second category for three runs is either the next test
  to write or a lesson nobody believes.

---

## Triggers

Two kinds, and they are not equally ready.

**Time.** Solved, once, this morning: `.github/workflows/grade.yml` runs
nightly, gates on a selftest, writes a dated page and opens a pull request
rather than pushing. The shape to copy is the changelog's, and the property to
preserve everywhere is that **nothing writes to main and nothing writes to a
canvas.**

**Event.** *"After changes are made"* is the trigger Percy actually wants, and
it is the harder one, because the honest version has a cost: a persona that
runs on every push runs on pushes that could not possibly have affected it. A
performance persona woken by a change to a research document has burned tokens
to say nothing, and a persona that says nothing often enough stops being read.

Two mitigations, both cheap, neither certain:

- **A path filter in the persona.** Percy declares the paths it is about;
  nothing outside them wakes it. Blunt, obvious, and wrong at the edges — a
  reducer change can move a frame budget.
- **Debounce to a window.** Not per push but per hour, or per merge queue
  drain, so a burst of six commits is one run.

Start with **time**, because it is built and its failure mode is boring. Add
**event** when a persona exists whose numbers move often enough for a nightly
to be too slow to be useful.

### The budget, which is a feature

Also from the night shift, and it applies to every persona: *"a morning of
forty items is worse than no night shift, because it converts sleep into a
queue."* A persona reports its top few findings and says how many it held
back. **If the accept rate falls, the right response is fewer findings, not
more.**

---

## The roster, 29 Aug 2026

Seven, in `.agents/personas/`: `accessibility`, `architect`, `copy`,
`design-auditor`, `market-researcher`, `performance`, `qa-tester`.

Three were added and one was narrowed, and the gate each had to pass is the one
below rather than "would this lens be nice to have":

- **`accessibility`** split out of `design-auditor` — the argument in the next
  section, applied. Contrast, names, targets and alt are numbers; the rest of
  design is a judgement.
- **`performance`** owns the largest built chunk. The frame budget is the real
  subject and needs a daemon and a real canvas, so it lives in the run's prose
  with its numbers stated rather than in a nightly bound — an honest split
  between what CI can hold and what it cannot.
- **`copy`** owns greppable copy tells. It is the one added purely on
  judgement about what this project *is*: two surfaces speak one vocabulary, a
  thing named two ways is two things, and the two worst word bugs shipped here
  were both a sentence that was confidently wrong.
- **`design-auditor`** kept tokens, both themes and the tells, and its
  DESCRIPTION was corrected — it still claimed contrast and accessibility after
  those moved, which is the exact failure its own `copy` neighbour exists to
  catch.

**Two roles considered and refused**: `security` and `docs`. Both are real
concerns; neither has a standing number nobody else is watching, and both are
already named in the architect's charter. A persona per concern is the
temptation the rule below exists to resist.

## One persona per lens, and the reason is arithmetic

The question was whether "Darren the designer" is one persona or three —
accessibility, token adherence, design quality.

**Three.** Not for tidiness: because the accept rate is what earns autonomy,
and an accept rate can only be computed for a thing whose findings can be told
apart. A single Darren who is excellent on contrast and speculative on taste
averages to *sometimes right*, which is the one score that cannot govern
anything. Split, the contrast lens earns the right to land its own fixes while
the taste lens stays advisory — which is the correct outcome and is invisible
while they are one.

There is a natural line to split on, and it is the same line the night shift
draws between its two lanes: **is the finding a number, or a judgement?**
Accessibility and token adherence are numbers and already have graders.
"Design quality" is a judgement, belongs in the diverge lane, and must never
be allowed to pretend it has a number.

---

## Trust

The vision's currency: a battery that charges and drains per action, where
higher trust earns autonomy and governs ask-versus-assume.

The mechanism is already sitting in the runs, unread. Every finding a persona
files is either acted on or not, and that is a labelled outcome with an author
on both sides. Count them and a persona has an accept rate; an accept rate is
what decides whether it may open a pull request, post a comment, or only write
a page.

**This is also the evals plan's Stage 4 arriving as a byproduct rather than as
a project.** That plan measured the canvas on 23 Aug and found the mine empty:
39 versions across 14 items and **two** deliberate choices. Nothing generates
preference pairs until somebody is routinely choosing. A persona filing
findings that get accepted or rejected is a machine for generating exactly
that, and it produces them as a side effect of work somebody wanted done
anyway.

Deliberately **not** in the first version. An accept rate over five findings is
noise, and a trust score that governs autonomy before it is meaningful is a
way to lose trust in trust. Record the outcomes from day one; compute nothing
from them until there are enough to argue about.

---

## What to build, smallest first

Each is useful alone. None requires the next.

1. **Move the four personas to `.agents/personas/`, with doorways.** No
   behaviour change, no new concepts, and it is the step everything else
   assumes. A test asserts the doorway resolves and that the two are the same
   file, because a symlink that quietly became a copy is a persona that drifts
   in one harness only.
2. **Give each a `goal`.** Three of the four already have graders to point at
   — `grade.mjs` for design, the suite for QA, the guard tests for
   architecture. Writing them down will fail for at least one, and finding out
   which lens cannot state a number is worth more than the goals themselves.
3. **`isocan persona ls | show <name>`.** The read half, on the surface that
   is not a filesystem. Cheap, and it is what makes personas a thing the
   product has rather than a thing the repo has.
4. **One persona on the nightly**, writing a page and nothing else — the night
   shift's step 2, which exists to prove the ritual before trusting it with
   work. **Built 29 Aug**: `scripts/persona-run.mjs`, `.github/workflows/persona.yml`,
   a dated page per persona in `docs/reviews/`.
5. **Runs record their outcome.** A finding is accepted, rejected, or
   unanswered. Still no score, just the column. **Built 29 Aug**: the column is
   in the page, `runFindings`/`tallyOutcomes` are in core, and
   `isocan persona runs <name>` reads them.
6. **The canvas as source of truth**, projected out to `.agents/`. When there
   is a second person editing a persona, and not before.

### Why 6 is not built, stated rather than skipped

Its condition has not happened. The gate above is not a guess about effort, it
is the moment the canvas starts paying for itself — a second person with an
opinion about what Darren looks for. Until then, making the canvas
authoritative converts a text file that any harness can read with no daemon, no
badge and no network into a distributed system, in exchange for nothing anybody
has asked for.

The two things this version owed that future are done, so the move stays cheap
when it is due: one file per persona (so it can become one item), and front
matter that keeps keys it does not understand (so a later build's field
survives a round trip through an editor that predates it).

**What would move it:** the sign-up half of
[one agent, many canvases](../../research/2026-08-29-one-agent-many-canvases.md),
which is a stronger reason than editing. A persona that several agents can wear
needs a place both of them can read that is not one laptop's disk.

---

## What a run is, and what it is not

A run takes the persona's numbers, writes a dated page, and stops. Three rules
came out of building it, and each has a test:

**It may not edit the persona.** A runner that can change its own goal can pass
by lowering the bar. Enforced by comparing every persona file before and after
— not by asking git what is dirty, which was the first version and could not
tell "the runner changed this" from "this was already edited".

**A broken instrument is never a zero.** A command that fails, or prints
something that is not a number, is reported as *instrument broken*. "0 contrast
failures" and "nothing could be measured" look identical in a report that does
not separate them, and this week produced three instruments that reported the
first while meaning the second.

**A missed goal is news; a broken instrument is a failure.** The page is the
report, and a run that goes red every morning trains everybody to stop looking.
The run exits non-zero for exactly one reason: a number nobody could take.

---

## What would make this fail

- **A persona that cannot fail.** Covered above and repeated here because it is
  the one that has already happened three times this week.
- **Memory as prose.** A `learnings.md` per persona, appended to forever,
  loaded every run, read by nobody. The guard rule is the answer and it has to
  be enforced, not encouraged.
- **Too many personas.** Four are useful because four fit in a head. The
  temptation is a persona per concern; the discipline is that a persona needs a
  standing number nobody else is watching.
- **Triggers that outpace attention.** The budget is a feature.
- **The vendor directory becoming the real one.** The doorway only works while
  the `.agents/` copy is authoritative. The moment somebody edits
  `.claude/agents/percy.md` directly and it is a real file rather than a link,
  there are two personas with one name. The test in step 1 exists for this.

---

## Sources

- `.claude/agents/*.md`, `docs/reviews/README.md`, `docs/reviews/lessons.md`,
  and `installSkill` in `packages/cli/src/main.ts` — read this session.
- The improvement rule, the two lanes, the morning budget:
  [`docs/research/2026-08-24-the-night-shift.md`](../../research/2026-08-24-the-night-shift.md).
- The empty preference mine, and Stage 4:
  [`docs/projects/evals/plan.md`](../evals/plan.md).
- The three silent instruments of this week:
  [`docs/research/2026-08-29-performance.md`](../../research/2026-08-29-performance.md)
  and [`docs/grades/README.md`](../../grades/README.md).
- Emissary personas, roles, teams, the trust battery: "A Tiny Stitch".
