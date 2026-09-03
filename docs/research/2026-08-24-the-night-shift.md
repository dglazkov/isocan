---
status: partial
since: 2026-08-29
see: evals,personas
note: steps 1–4 built — nightly grades (29 Aug), convergence (the fold), and on 3 Sep the converge lane one item wide (`scripts/converge-night.mjs`, its verdicts read by `isocan evals converge`) and the morning comment (`npm run night`, posted by the Night actor); the diverge lane and "what changed while you were gone" are open
---
# The night shift

**24 August 2026**

**Where this stands, 29 Aug 2026: step 1 is BUILT** —
`scripts/grade-night.mjs`, `.github/workflows/grade.yml`, and a dated page per
run in `docs/grades/`. Nightly, selftest-gated, and it writes to no canvas.

**And the sentence this note used to open with was false.** It read "`grade.mjs
--selftest` runs in CI, which is the graders grading themselves." It did not.
The step spawned a macOS-only Chrome path on an Ubuntu runner, failed with
`ENOENT` on every commit for weeks, and carried `continue-on-error: true` — so
the check that exists to stop us believing a silent zero **was one**, in the
exact place this document pointed at when it said the graders were verified.
Found by reading a real run's log while wiring the schedule; the grader now
finds Chrome wherever it is, and the flag is gone.

The first night's reading, on the pages this repo ships: isocan.io's own front
door fails contrast on three headings (3.83, needs 4.5) and has targets under
24px. Which is the argument for step 1 in one line — *is anything already
broken* had an answer, and nobody had asked.

The question: *what could a self-improvement loop be — for isocan itself, for
the projects isocan holds canvases for, and on the canvas as the surface that
displays it — such that a person wakes up to changes that are verified to be
improvements, and to ideas worth having?*

The commitment is not new. "A Tiny Stitch" lists it second among five build
commitments: **improves itself 24/7 — off-hours night shift.** What follows is
what that costs, what it is blocked on, and what it is actually *for*, which
turns out not to be free labour.

---

## The measurement that decides the design

Every canvas in this home, counted from the oplogs today:

| | Count |
| --- | --- |
| Canvases with a log | 17 |
| Operations | 676 |
| Items added | 162 |
| …declaring a `parent` | 25 |
| **Parents with more than one child** (a real fan-out) | **9** |
| Versions stacked (`item.addVersion`) | 54 |
| **Deliberate version choices** (`item.setCurrentVersion`) | **2** |
| Operations reversed by an undo | 19 |

`docs/projects/evals/plan.md` measured the same home on 23 August and found **1** multi-child
parent and **2** version choices. A day later divergence has gone 1 → 9 and
convergence has gone 2 → 2. Fifteen more versions were stacked in that day and
not one of them was chosen between.

This is the finding, and it reverses the conclusion evals.md drew. That
document said the preference mine was empty because nobody reached for
`/variation`. They reach for it now. **The mine is no longer empty of ore; it is
empty of the act of choosing** — which is exactly what
[`docs/projects/atlas/convergence.md`](../projects/atlas/convergence.md) predicted when it said
the canvas "can diverge and cannot converge… no verb in the CLI says *this one
won*."

So the first thing to say about a night shift is a dependency, not a feature:

> **A night shift multiplies divergence. Without the convergence operation,
> everything it makes overnight arrives somewhere a person cannot accept it
> from.** Nine fan-outs and two choices is what that looks like at human speed.
> A machine working eight hours unattended makes it the dominant fact about the
> canvas by Tuesday.

Convergence is not a nice-to-have for this loop. It is the loop's exit.

---

## What "verified to have improvements" has to mean

The hard word in the request is *verified*. An agent that works all night and
produces plausible diffs is a liability, because someone has to review them
while less rested than the machine that wrote them.

This repository already keeps the catalogue of how that fails.
`docs/reviews/lessons.md` is twenty-six entries long and most of them are one
shape: **work that looked done and was not, believed because it was green.** A
grader that scored a stretched image 8/8 because its probe returned `undefined`
(#8). A guard that tested its own local copy of the rule (#5). A test written
around the keystroke instead of the invariant (#4). A button verified with
`.click()`, which never consults hit-testing, so it passed on a control no
human could reach (#20). Every one of those was written by someone competent,
in good faith, awake.

The discipline that follows is a single rule, and the whole design hangs off it:

> **An overnight change may be called an improvement only if it names, before
> the work starts, a number that is already being measured — and moves it in
> the right direction without moving another one the wrong way.**

Not "this is cleaner". Not "this reads better". A number that existed at 22:00,
measured by something that has been mutation-tested, and that reads differently
at 06:00.

Everything that cannot be stated that way is not a failed improvement. It is a
different thing with different rules, and it belongs in the other lane.

---

## Two lanes, because they have different acceptance criteria

**The converge lane — verified, and allowed to land.**
Work whose success is a number. It runs, it measures before and after, and it
either moves the number or is thrown away by the agent itself before anyone
sees it. Its output is a small number of changes with the measurement attached.
A person's morning gesture is *read the number, glance at the diff, keep or
revert*. Reverting is one command, per-actor, already built.

**The diverge lane — provocations, and never allowed to land.**
Alternatives, variations, "what if the whole thing were a list instead". Its
success criterion is not a number and must not pretend to be one. Its output is
siblings on the canvas with `parent=` set, sitting under what they came from.
A person's morning gesture is *look, choose one or none*. Nothing is at risk
because nothing was replaced.

Keeping these apart matters more than either of them. A loop that mixes them
produces a morning where every item needs adjudicating and the person cannot
tell which two of the forty were measured. The lanes have different
verification, different display, different risk, and should have different
budgets.

---

## What can actually be measured tonight

The converge lane is only as good as the graders it can run, so here is the
honest inventory of what exists today, in this repository, already
mutation-tested:

| Instrument | What it answers | State |
| --- | --- | --- |
| `scripts/grade.mjs` | 8 checks on a real screen at 390/768/1440: renders, plus 7 failable — contrast against what is actually painted, stretched images, sideways scroll, unnamed controls, target size, alt text, string-matchable tells | `--selftest` run today: all 7 fire on `deliberately-bad.html`. **Wired to nothing** |
| The style guards | 84 assertions: tokens, spacing and type scales, z-index layering, one-block-per-class, accent-as-text contrast, world-vs-screen pixels | Green, run every suite |
| `packages/core/src/contrast.ts` | Ratios in both themes | Pure, importable |
| `designcheck.ts` / `isocan design check` | Does the declared system hold up — dead references, non-colours, failing contrast | Both surfaces |
| `slop.ts` | 23 moves a machine-made interface reaches for | Pure |
| `npm test` / `typecheck` | 1,359 assertions; whether it compiles | Green |
| Bundle size | **585 kB**, over Vite's 500 kB warning — and up from 563 kB earlier today | Measured every build |

Lesson #13 is worth reading twice here: `grade.mjs` "is invoked by no test, no
npm script and no workflow; only by a sentence in `docs/projects/evals/plan.md` saying to run
it." Running `--selftest` for this write-up meant reading that sentence and
typing the command — which is the lesson demonstrating itself.

**The night shift is the first thing that would actually have a use for
the graders this repo already built.** That alone is an argument for it — not
because the loop needs the graders, but because the graders need the loop.

The gap, stated plainly: everything above measures *artifacts*. Nothing
measures whether the product got better at what it exists for. That is Stages
1–4 of `evals.md`, and the night shift should not pretend to substitute for
them.

---

## Two subjects, which are not the same problem

### Improving isocan itself

The narrow case, and the safe one, because the acceptance criteria are code.
Candidates, in the order their measurement is trustworthy:

- **Run the graders nobody runs.** `grade.mjs --selftest`, then `grade.mjs`
  over every screen on every canvas. Report regressions. Zero risk: it writes
  nothing.
- **Mutation-test one guard per night.** The suite has 1,359 assertions and
  lessons #4, #5, #8, #11 and #14 are all "a check that could not say no". A
  night is enough to break one guard deliberately, confirm it fails, and
  restore. Findings, not diffs.
- **Close a lesson.** `lessons.md` names guards that do not exist yet and
  habits with no enforcement. Each is a well-specified night's work with a
  binary outcome.
- **The unglamorous measured wins.** Bundle size against the warning it already
  exceeds. Contrast failures. Accessibility beyond contrast — focus order,
  accessible names, target size — which evals.md calls "all mechanical, all
  currently unmeasured".

Notably **not** on this list: refactors, renames, and anything whose case is
taste. Those are diverge-lane, or they are for a person.

### Improving a project the canvas holds

The general case, and the one the product is for. A canvas of screens with a
design system on it is a gradeable object:

- `isocan design check` says whether the system itself holds up.
- `grade.mjs` grades each screen against reality — contrast, overflow, target
  size, at three widths.
- `/design-audit` grades a screen against the system *and* against the 23 tells.

So the night shift for a project canvas is: **grade every screen, and for each
failure produce a fix as a new version on that item's stack, with the before
and after numbers in the reply.** Nothing is replaced — `edit` stacks a
version, `F` fans it out, the person promotes or ignores. The risk is bounded
by the data model rather than by the agent's judgement, which is the property
worth having.

And its diverge lane: variations of the screens the person **starred**, because
starring is the only signal on the canvas that says *this one matters to me*.

---

## How the canvas displays it

The canvas is not incidental here. It is the reason this loop can be safe, and
most of the mechanism already exists.

**The version stack is the safe medium for unattended work.** An overnight
change that arrives as `item.addVersion` has replaced nothing: the previous
version is intact, `F` shows them side by side, `version promote` chooses, and
`undo` is per-actor so the night shift can never revert a human's morning. No
other place in this product lets a machine work unattended with that property.

**`parent=` and `format` make the night's work self-arranging.** A variation
carrying `parent=<source>` is hung under the thing it came from by
`isocan format`, which is one operation and therefore one undo. A person waking
to a formatted canvas sees a tree — *here is the screen, here are the three
things the night thought of* — rather than a scatter.

**The main thread is the morning briefing, and it should be short.** It is the
docked panel, it wakes every parked agent, and it is where a person looks
first. One comment. Three lines. `#Title` chips fly them to the work. Not a
report: a *summary with handles*.

**`isocan activity` is the honest long version** — who made what, newest first,
already built, already on both surfaces.

**Starred items scope the night.** `ls --starred` is the person's own
shortlist. A night shift that works on everything produces a morning nobody can
face; one that works on the four starred screens produces a morning that reads
in a minute.

**Presence should tell the truth at 3am.** An agent working overnight has a
cursor and a status, and `quiet Ns` is already honest about silence. Waking to
a canvas that shows where the night went is different from waking to a diff.

The one thing that does not exist and would matter most: **a way to see what
changed while you were gone.** Not a diff view — a *what-is-new* filter over
the oplog since your last session, which the log already supports exactly
(`since=<seq>`; the WebSocket already replays from a sequence number). The
morning question is "what happened", and the canvas can answer it precisely
because every change is an operation with an order.

---

## The morning ritual, which is the actual product

The loop's value is not what happens at 3am. It is what the person does at 6am,
and that is a design problem more than an engineering one.

**Choosing must be cheaper than reading.** The measurement above says people
stack fifty-four versions and choose twice. If the morning gesture costs more
than a keystroke, the night's work accumulates unchosen and the canvas silts
up. This is why convergence is the dependency and not a follow-up.

**The morning budget is small and should be enforced by the agent.** Three
converge items and three diverge items is a morning. Forty of either is a
backlog, and a backlog is what this loop is supposed to prevent. If the night
found more, it says so and keeps the rest.

**Every accepted or rejected choice is a labelled preference pair** — which is
Stage 4 of the eval programme arriving as a byproduct of the morning ritual
rather than as a project. That is the strongest argument for the whole
enterprise: the night shift is not primarily a way to get free work. It is the
only realistic way to generate the human-labelled comparison data the eval plan
needs, because the measurement says humans do not generate it on their own.

**And it is where the trust battery becomes concrete.** The vision's first
partnership principle is that trust charges and drains per action and governs
autonomy. A night shift has an accept rate. It is measurable per lane, per
agent, per kind of work — and *that* is the number that should widen or narrow
what tomorrow night is allowed to do without asking.

---

## What to build, smallest first

Each of these is useful alone, and none requires the next — the same discipline
`evals.md` set for itself, for the same reason.

1. **Wire the graders to a schedule.** `grade.mjs --selftest && grade.mjs` over
   every screen, nightly, output to a dated page. No writes to any canvas.
   Answers "is anything already broken" before anything tries to fix it, and
   gives lesson #13 its overdue fix.
2. **The morning comment.** One agent, one canvas, posts one summary to the
   main thread. No changes at all. Proves the ritual before trusting it with
   work.
   **Built 3 Sep 2026, after step 3 rather than before it:** `npm run night
   -- --canvas <ref>` runs the converge lane on each canvas named and then
   posts one comment in its Chat — three lines: what was graded, what landed
   (with the `#Title` handle and how to say no) or why nothing did, and
   where the score is. The night is its own actor, **Night**, claimed once
   per machine and known to the registry as an agent, so the morning can
   tell its work from a person's. A dry run posts nothing.
3. **The converge lane, one item wide.** One measured fix per night, landed as
   a version, with the before/after in the reply. Track the accept rate from
   the first night — it is the trust battery's first reading.
   **Built 3 Sep 2026:** `scripts/converge-night.mjs` grades every screen on
   a canvas, picks the one with the most failing mechanical checks (contrast,
   unnamed controls, missing alt, stretched images, sideways scroll) that the
   lane has not touched in a day, has an agent fix exactly those in a room
   with nothing but the file, and lands a version only if every targeted
   check now passes, nothing regressed and the visible words are unchanged —
   otherwise the attempt is discarded and the page says so. The landing is
   recorded on the item as `converged=<version>@<time>` and the reply says
   the numbers and how to say no (bring the previous version back).
   `isocan evals converge` reads every landing as kept, built on, reverted
   or standing, and the accept rate over the judged ones — standing is
   excluded, so a fresh night cannot move the battery before anyone looked.
   Pages in `docs/converge/`.
4. **Convergence** (`docs/projects/atlas/convergence.md`). Now the loop has an exit and
   the diverge lane becomes possible.
5. **The diverge lane**, scoped to starred items.
6. **What changed while you were gone** — the since-last-session view.

The shape to copy for 1–2 is already in the repository:
`.github/workflows/changelog.yml` runs nightly, gathers deterministically with
`scripts/changelog-day.mjs`, has a model write it up, opens a pull request, and
**never touches a page somebody already wrote.** That last property is the one
to preserve everywhere in this design.

---

## What would make this fail

- **Plausible work, believed.** The whole of `lessons.md`. Mitigated only by
  the rule about naming the number first, and by the agent throwing away its
  own unverified work before a person sees it.
- **Volume.** A morning of forty items is worse than no night shift, because it
  converts sleep into a queue. The budget is a feature.
- **Concurrent agents in one working tree.** Observed here today, repeatedly:
  three rebase conflicts and one red suite from agents racing on the same
  files, and lesson #7 already names it. A night shift with several agents
  needs a worktree each, or a lock, and the choice should be made before rather
  than after.
- **The graders drifting into decoration.** Every instrument in the inventory
  needs `--selftest`'s discipline. A night shift is a machine for believing
  graders at scale.
- **Cost, unbounded and unwatched.** A loop that runs until it runs out of
  ideas will run out of budget first.
- **Silting.** Unchosen alternatives are litter. If the accept rate falls, the
  right response is fewer proposals, not more.

---

## The one-line answer

A night shift is worth building, and its point is not the work it does while
you sleep — it is that **it manufactures the one thing this canvas has never
produced: the act of choosing.** Nine fan-outs and two choices is the measured
state of that today. Fix the exit first, keep the verified and the speculative
in separate lanes with separate budgets, make the morning gesture one keystroke,
and the loop pays for itself twice — once in the improvements, and once in the
preference data that tells you whether any of this is any good.
