---
status: designed
since: 2026-09-07
issue: 206
see: personas, standing-agents, on-demand, evals
note: six systems already run this project and none of them knows about the others — a persona declares a cadence nothing observes, a finding carries an outcome nothing can decide except by hand-editing markdown, and the board that shows it all is read-only ON PURPOSE. The spine is one rule from #148 applied to five kinds of row: derived, or decided, never both. The canvas decides and the repo keeps, so the guard never has to reach a network. No new op.
---

# The docket: what a project knows about itself

**7 September 2026.** Research. Nothing built.

> "I need to fully flesh out the system of building with standing agents and
> personas etc. I want the ledger and learnings and issues and research and all
> the things to be able to run this as a full system. I want the system to show
> up on the canvas etc including the ledger with humans and agents all working
> on it together."

## The finding, first

**Six systems already run this project. None of them knows about the others.**

Personas measure. The findings queue collects. Lessons remember. Research
plans. Evals grade. The board displays. Each is well built and each is
complete on its own terms — and a person asking *what is happening on this
project* opens six artifacts in three formats and joins them in their head.

Here is what that costs, live in the tree this afternoon:

```
$ sed -n 18,22p .agents/personas/design-auditor.md
trigger:
  cron: 43 8 * * *
trigger:
  cron: 23 8 * * *
```

`design-auditor` declares its cadence **twice**. YAML takes the last key, so
`parsePersona` returns `23 8 * * *` and the 08:43 line is dead text in a file
whose entire job is to say when this runs. Nothing caught it, because **nothing
observes cadence at all** — nine files declare a trigger and no artifact
anywhere records what actually ran against what was meant to.

That is the shape of the whole request. Not "these systems are missing" — they
are built. **They are not joined, and nothing checks that what they declare is
what happens.**

## What is already here, because that is most of the design

| The idea | Where it lives now | State |
| --- | --- | --- |
| **A lens with a number** | `.agents/personas/*.md` — nine, each with `goal: (name, at most, measured by, baseline)` | Built. All nine are `model: opus`, `effort: xhigh` — there is one tier and it is the expensive one (#205) |
| **A run** | `docs/reviews/YYYY-MM-DD-<persona>.md`, nightly via `.github/workflows/persona.yml` | Built |
| **A finding, and its outcome** | the Findings table in each run page: `accepted` / `rejected` / `unanswered` | Built. Since 7 Sep an unanswered finding past three days **fails `npm test`**, and repeated questions get their own table (`askedAgain`) |
| **Learnings** | `docs/reviews/lessons.md` — 36 numbered, each (shape, cost, guard) | Built, by hand |
| **Plans** | `docs/research/*.md` front matter → `docs/ROADMAP.md` | Built, derived |
| **Projects** | `docs/projects/*/design.md`, `phases.md`, `journey.md` | Built, by hand |
| **Grading** | `docs/projects/evals/` — corpus, golden tasks, `calibrate.mjs`, `lift.mjs` | Partial |
| **Standing agents** | `isocan rc --all`, presence, `narrate`, summons, `isocan history <actor>` | Built, all four phases |
| **The board on a canvas** | `scripts/canvas-board.mjs` — six panel kinds including one per persona; `board-watch.mjs` tails **both** the repo and the repo's own canvas | Built, and **read-only on purpose** |

Two of those rows deserve their own paragraph, because they are the ones this
note is built on.

**The board already refused to be a dashboard.** Its design note (#148,
30 Aug) is emphatic and correct: *"If the canvas only ever displays, it is a
dashboard and will be looked at twice."* It names exactly one fact that must be
**decided** on the canvas — the outcome of a finding — and then deliberately
does not build it, because at the time nothing could reach a canvas from
outside and a second editable panel would have brought back the mirror bug
silently.

**And the hinge it was waiting for exists.** `scripts/board-watch.mjs` already
holds an open `canvas.tail()` on the repo's own canvas, with its own resumable
cursor, debounced, in the foreground. It watches the canvas today and does
nothing with what it sees except refresh panels. **The process that would turn
a click into a commit is already running and already listening.**

## The spine: derived, or decided — never both

#148's one rule is the architecture, and applying it to the five kinds of row
this request names is the whole design:

| Row | The derived half | The decided half | Who may write the decision |
| --- | --- | --- | --- |
| **A finding** | the number, its bound, which persona, when | **the outcome** | a person |
| **Work in flight** | presence, session status, commits, `isocan history` | **the claim** — *I am taking this* | a person **or** an agent |
| **A decision** | which research note or lesson it came from | the decision and its reason | whoever decided |
| **Trust** | accepted / rejected per agent, over time | **nothing** | **nobody, ever** |
| **Cadence** | what ran, and when it last ran | **how often it should** | a person |

Three things fall out of that table, and they are the three findings of this
note.

### 1. A finding is the only row that is half of each — which is why it is the one worth building

Every other row is cleanly one kind. A finding is a measurement (derived,
regenerated, never touched by hand) carrying a verdict (decided, and decided
nowhere else). That is the shape the board avoided, and it is buildable now
precisely **because the two halves are separable**: regenerate the left, never
regenerate the right.

It is also the row that already matters. Before 7 September the outcome column
was ignorable, so it was decorative — 26 findings sat unanswered across six
nights while the number one of them described grew by a hundred kilobytes.
Now an unanswered finding reddens the build after three days. **Deciding one is
real work, and it is currently done by hand-editing a markdown table.**

### 2. Trust must be uneditable, and that is not a policy — it is what makes it a reading

A trust figure somebody can adjust is a score, not a measurement. It is a fold
over the outcome column and over nothing else: *of the findings this persona
filed, how many did a person accept.* `evals/plan.md` measured the absence
directly — nine fan-outs and two choices — and the reason it could not be
computed was that the outcomes were not being decided, not that the arithmetic
was hard.

So trust is the **last** thing to build, not the first, and it needs no design
of its own: once outcomes are decided somewhere a program can read, the reading
is a `groupBy`. Building it earlier would mean inventing a number, which is the
one thing this project's own rules forbid — *a measurement that cannot fail
reports success forever, which is worse than no measurement because it is
believed.*

### 3. Cadence is declared nine times and observed nowhere

The duplicate `trigger:` above is the visible symptom. The general fact is that
`trigger` is a **claim about the future** that nothing ever reconciles against
the past. There is no artifact anywhere that says "this persona was meant to
run at 08:23 and last ran 31 hours ago", so a cron that silently stops is
indistinguishable from a quiet week.

This is also where #205's two unbuilt pieces belong: `trigger: { idle: … }`
(per-canvas idle from presence, machine idle for repo-wide work) and a declared
budget in `rcLimits`' shape. Both are cadence, and cadence is a row.

## The naming, settled before any code

**`ledger` is taken twice in this codebase.** `packages/web/src/lib/ledger.ts`
is the front page's split ledger — a gesture on the left, the identical CLI
command on the right — and the desk's grants and claims are described as a
ledger throughout `server/`. A third meaning on one word in one codebase is how
`faceMark`/`initial` and `backingOf`/`writeBound` happened, and both cost a day.

So the code says **`docket`** — free in this tree, and it means precisely *the
list of matters to be dealt with*, which is what this is. What the canvas
**says** is Dion's, and "Ledger" is a perfectly good label for it: the
precedent is #194, where the property is `shelved` and the UI says Archive, and
the two never meet because one is read by grep and the other by a person.

## What it costs in operations: nothing

A docket row is an **item** with properties. An outcome is an `item.update` on
a property. A claim is a property. A decision is a comment on a thread. Every
one of those already exists.

**The op vocabulary stays at 33**, which is a ratcheted bound (`op-types`,
`at most: 33`) and the one number a feature like this would be expected to
raise. It stays at 33 for the reason the shelf and the ground did: this product
already has a vocabulary for *a thing on a surface with facts attached*, and a
docket is a thing on a surface with facts attached.

And because it is a canvas, **the CLI gets it for nothing**. `isocan docket`,
`isocan docket accept <finding>` — the same ops, the same reducer, on the
surface where an agent already lives. That is the isomorphism paying for
itself rather than being paid for.

## The hard problem, and its answer

If the outcome is decided on the canvas, and `findUnanswered` reads
`docs/reviews/*.md`, then **the outcome has two homes** — which is exactly the
mirror bug #148 is written around, arriving through the front door.

Three ways out, and only one survives.

| | | Verdict |
| --- | --- | --- |
| **The canvas is the source; the guard reads the canvas** | `npm test` now needs a daemon, a badge and a network | **No.** It converts a text file every harness can read into a distributed system — the argument `personas/design.md` already makes about persona files, for the same reason |
| **The outcome lives only on the canvas; drop the guard** | the column stops being able to fail | **No.** The guard is the entire reason the column stopped being decorative |
| **The canvas DECIDES; the repo KEEPS** | a click emits a commit that edits the row; the guard is unchanged | **Yes** |

**The canvas decides, the repo keeps.** The canvas holds no authority — it is a
control surface that emits a commit, the same shape `design import` / `design
set` already has for a design system. `board-watch.mjs` is already tailing and
already has a checkout; it gains one branch: an outcome op on a docket row
becomes an edit to the run page and a commit.

Two properties fall out of it, and both are worth more than the mechanism:

- **The guard never changes.** `findUnanswered` goes on reading markdown with
  no network, which is what lets it run in CI, in a worktree, and on a plane.
- **Every decision arrives in git history with an author.** *Humans and agents
  working on it together* is only auditable if you can see who decided what,
  and a commit is the artifact this project already trusts for that.

## What still cannot happen, stated plainly

**CI cannot reach a canvas.** `.github/workflows/persona.yml` says so in its
own pull-request body: *"Nothing was changed — not the code, not the personas,
not a canvas."* So the nightly that produces most of the rows cannot put them
there from where it runs.

This does **not** block the design, and the reason matters: the docket's rows
are derived from files that arrive in the repo anyway, and the local watcher
projects them. The honest statement of the limit is therefore narrow —
**the docket is fresh whenever a machine with a checkout is watching, and stale
when every laptop is shut.** That is the same limitation the morning brief
already has, and #148 already wrote the crontab for it.

Closing it properly is the on-demand ACP address hook, which is designed and is
a different note. It should not gate this one.

## Decisions

**D1. `docket` in code; the canvas says whatever Dion wants.** `ledger` is
taken twice. Precedent: #194's `shelved` / Archive.

**D2. Every row is derived or decided, never both** — and a finding, which is
one of each, keeps the halves in separate properties so that regenerating the
measurement can never touch the verdict.

**D3. The canvas decides; the repo keeps.** A decision on the canvas emits a
commit. The guard goes on reading files with no network. Nothing on the canvas
is authoritative for anything.

**D4. Trust is derived and uneditable, and it is built last.** It is a fold
over accepted/rejected once there are outcomes to fold. Inventing it earlier
would be inventing a number.

**D5. No new op.** Items, properties, threads. The vocabulary stays at 33.

**D6. Cadence gains an observed half.** What a persona declares is reconciled
against what actually ran, and a persona that declares two triggers is a
failure rather than a silent last-key-wins.

**D7. Both surfaces, as ever.** `isocan docket [--mine|--open]` and
`isocan docket accept|reject <finding> [--because …]` beside the canvas rows.
An agent is the population this is for as much as a person is; a docket only a
web app can read is a dashboard with a second name.

**D8. It is one surface with several kinds of row, not five artifacts.** The
kind decides who may write and whether it regenerates. That is what makes it a
place where humans and agents work together rather than five places they each
visit.

## Phases

Ordered by what unblocks the rest, and by what is cheapest to undo.

**Phase 1 — Cadence, observed.** A guard that refuses a persona declaring
`trigger` twice (there is one in the tree today), and a derived reading of
*declared versus last actually run*. No canvas, no new concepts, and it fixes a
live bug. It is also the smallest complete row of the five, which makes it the
right place to learn the row's shape.

**Phase 2 — The docket as a derived panel.** Every open finding, its number,
its bound, its persona, its age, and how many nights it has been asked — all of
which `scripts/reviews.mjs` already computes. Read-only, and explicitly a
projection. Worth little alone, by #148's own argument, which is why it is not
where this stops.

**Phase 3 — The outcome, decided on the canvas.** D3. A click on a row emits a
commit through the watcher; the run page is edited; the guard is untouched. This
is the phase the whole note is for, and the first moment the canvas is somewhere
work happens rather than somewhere work is displayed.

**Phase 4 — The claim.** *I am taking this* — a person or an agent, on a row.
Presence and `narrate` already say where somebody is standing; this says what
they are standing there **for**, which is the half that does not exist. Cheap
once phase 3's write path works, and it is what makes the surface shared.

**Phase 5 — Decisions, projected.** Research notes already carry structured
`## Decisions` sections and lessons are already numbered with (shape, cost,
guard). This is a derivation, not a new artifact — and the decisions index has
been unstarted on the board for a while for want of somewhere to put it.

**Phase 6 — Trust, folded.** D4. Only once phases 3 and 5 have been running
long enough that the fold has something to say.

**Phase 7 — CI reaches the canvas.** The on-demand address hook, so the docket
is fresh when every laptop is shut. Deliberately last: everything above works
from a watching checkout.

## What this leaves open

- **Which canvas.** `board-watch.mjs` tails the repo's own canvas
  (`.isocan/project.json`, committed) while the board publishes to a different
  one (`.isocan/board.json`, per-machine and git-ignored). The docket is a
  shared fact and wants the committed marker; the board's panels are one
  person's view and want the other. Saying that out loud is probably the fix,
  but it is currently a trap.

- **Whether issues belong in it.** The request names them and this note does
  not place them. GitHub issues are a real store with a real UI, and mirroring
  them onto a canvas is the mirror bug wearing a different hat. The honest
  candidate is a derived row — *this finding has an issue, and it is open* —
  rather than the issue itself.

- **What happens when two people decide one finding.** Last-writer-wins is the
  reducer's answer everywhere else, and it is probably right here; but a
  verdict is not a drag, and the losing decision vanishing without trace is a
  different failure from a rectangle ending up in one of two places.

- **Whether a rejected finding should be able to come back.** Today `rejected`
  ends it and the row stays as the record. A bound somebody rejected at 60 that
  is now 200 is arguably a new question — `WORSE_BY` already makes exactly that
  judgement for accepted findings, and it is not obvious that rejected should
  be different.

- **The cheap tier is still a population of zero.** #205's finding stands: all
  nine personas are opus at xhigh, so "cheap finds, expensive decides" remains
  a shape nothing uses. A docket makes the handoff visible; it does not create
  the tier.

- **The other answer to "where is everything", refused on purpose.** herdr
  aggregates agents that live on machines into one terminal client, over SSH,
  and it is good at it — 700,000 downloads. It is the alternative shape for
  this note's request and it is not the one taken, because it is a window onto
  several places and a canvas is one place; and because a display is what #148
  says gets looked at twice. Surveyed in
  [Herding machines](2026-09-07-herding-machines.md).
