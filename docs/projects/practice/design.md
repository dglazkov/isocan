---
status: designed
since: 2026-10-02
see: evals, personas, judge
note: "How isocan is built, measured and improved, audited end to end: nine instruments that each work and do not add up. The plan is one deterministic page a night (docs/practice/) that reads all of them, a daily lap that fixes one leak it names, and evals of two things: the product (the oplog's undo and preference signal, golden tasks) and the loop that builds it (builder claims vs proof, rework, red main, time to green)."
---

# The practice: how isocan is built, and how that gets better

**2 October 2026.** Dion: *"Can you go through the AGENTS.md and all of the
setup for the way that we do testing, mapping to outcomes, loop, github issues,
projects, phases, milestones, research, exploring… and come up with a plan for
how to make improvements and have this setup so we can re-run this daily to
keep improving. How can we do evals to improve things too?"*

**The debt this discharges.** Over seven weeks the repo grew a working practice:
gates and ratchets, a conductor that walks phases, nine standing personas,
nightly grades, journeys and Loop, a verify queue, a changelog and research
notes. Each piece was built for a reason, and each mostly works. But nothing
reads them together. The records they keep disagree with each other. The loop
that builds the product is the one thing in the repo nobody measures.

This is the audit and the plan. It is measured from the tree, GitHub and git on
2 Oct 2026 by three read-only sweeps, plus `gh run list` and `git log`. Every
number below can be recomputed, and phase 0 is the thing that recomputes them
every night.

## What there is

| Instrument | Cadence | Closes the loop? |
|---|---|---|
| `npm test` / `test:deep` / `test:ci`, typecheck, lint | local; PR; main (`release.yml`, 4 shards) | **Yes**: `green` waits on the suite. Lint runs on PRs only, and work is pushed to main. |
| Ratchets in the suite (unused exports ≤39, undocumented ≤238, lazy CSS ≤317, `--version` <40 modules, one block per class, bundle ceiling 701,300) | every run | **Yes**, though some numbers have closed by moving the bound (see below) |
| `docs/reviews/lessons.md` (~106 failure shapes, each with a guard) | when a bug has a shape | **Yes**: the strongest loop in the repo |
| Personas (10, `persona.yml`) and review-on-push (`review.yml`) | nightly; every push | **Partly**: 87 rows accepted, but from 3 personas and about 9 distinct findings re-filed nightly; 7 personas have never filed one |
| Grades (`grade.yml`) | nightly | **No**: grades one page (`docs/index.html`), 8/8 for 34 nights |
| Journeys (25 browser walks, `journeys.yml`) | nightly | **Advisory**: a broken screen still reaches `green` and dev |
| Stitch Loop (`loop.yml`, `docs/loop/`) | nightly | **Partly**: 14 of 43 decided findings led to action; 13 untriaged |
| Verify queue (`docs/verify/`) | when a phase needs a person | **No**: 14 of 15 walks unverified; one done, by its builder |
| Conductor (`/conduct`, `status.sh`) | per phase | **Yes** for the phase; its own outcomes are not recorded |
| Changelog / WHATSNEW / research notes | daily / per feature / per question | **Records**, not loops; coverage has holes |
| Evals plan (`docs/projects/evals/plan.md`) | stages 0–7 | Stages 0–3 and 5 built; **4 uncalibrated, 6 not built, 7 partial**. Golden, lift and calibrate ran once (3–4 Sep) and never again. |

## Where it leaks

### 1. The records disagree with each other

The same status is written in three places: the `docs/projects/README.md` index
row, the doc's front matter (which `docs/ROADMAP.md` reads), and the phases.
The hand-written copy is the one that goes stale.

- inception: the index says "unbuilt… Phase 0 is next"; ROADMAP says phases 0–3 are built.
- mindmap: the index says stages 1, 2 and 4; ROADMAP says all four.
- standing-agents: the phases say all four are closed; the front matter says `partial`.
- anatomy: the index says "on branch `anatomy`"; the front matter says `built`.

`status.sh` cannot catch these. Its "every phase or none" rule lets sprint,
ui-refresh and modules pass with no Status lines at all; their where-we-are
lines are weeks old. Ten phases say **DONE**, which is not in the vocabulary
and is read by nothing. 25 of 73 research notes are missing from the research
index. Changelog 22 Sep is missing (19 commits; its draft PR #347 was closed
with no page), and 7–8 Sep were merged as drafts.

### 2. Issues and projects don't line up

- 17 of 49 projects name an issue.
- 60 issues are open; 14 of them are named nowhere in `docs/projects`.
- Issues of finished work are still open: cleanup #355, groups-by-hand #373, jetski #364, inbox #147, sheep-harness #210, wireframes #350.
- A verify walk points at #261, which is closed, though the walk is still owed.
- There are 0 milestones and labels on about 25 issues. 31 issues have had no update since 11 Sep.
- Three PRs (#246–248, a parallel roadmap registry) have been open since 11 Sep.

GitHub is the record people outside the repo read, and it is out of date.

### 3. The queues don't record how old anything is

- The verify queue has 14 unverified walks.
  - A walk's `since` is when the page was written, not when the debt began: sprint phase 6 has been owed since 2 Sep and reads 1 Oct.
  - Four PART-DONE phases that need a person have no walk at all: design-lint, design-partner 7, hosted-sharing and first-minute 6.
- Loop has 13 untriaged findings.
- NOT STARTED phases have sat untouched for 14 days or more in operator, design-competition, embed and extensions.

Nothing shows any of this as a number that grows.

### 4. Some gates report something other than the truth

- **Ratchets don't see untracked files.** `scanExports` reads `git ls-files` without `--others` (`scripts/measure.mjs:567`). A builder's suite reads differently before and after `git add`. That happened in every builder round this week (copy-mix, live-token, copy-lint), and `deeplist`, `switches` and `typecheck` do include untracked files.
- **The push gate is a rule, not a hook.** `scripts/hooks/pre-push` checks only the roadmap. `npm test` leaves out 56 files. AGENTS.md records a green subset hiding a real failure three times in one week. Main's `release` went **red in 4 of its last 40 runs**. One of those (keys phase 2) was a commit that left half its files unstaged.
- **The bundle has 15 bytes of headroom** (701,285 / 701,300). Every web change becomes a byte hunt. In September the performance goal itself moved from 640k to 747k, and the ceiling was raised several times. Those raises were "accepted" findings, which means the number counts them as wins.
- **Load flakes.** 23 commit messages since 1 Sep mention a flake. `scripts/flakes.mjs` exists but runs on no schedule. Two `npm run build`s write the same `dist` with no lock.
- **The review queue goes red by date.** It compares against `new Date()` (`scripts/reviews.mjs:338`), so a tree nobody touched turns red on day 4. That is the shape lessons #49 warns about.
- **Stale counts.** `switches.mjs` says thirty-five deep files, AGENTS.md says 53, and the actual number is 56.

### 5. Instruments measuring nothing that changes

- Grades read one page that never changes.
- journeys and market-researcher have no number. Their own pages say "give it a number, or take it off the schedule".
- Seven personas have never filed a finding.
- Golden v1 (20 tasks), lift and calibrate each ran once.
- `docs/evals.md` says journeys run weekly; they have run nightly since 8 Sep.

### 6. Nothing measures the loop that builds the product

903 commits since 1 Sep. The conductor's verify step sends work back routinely. This week it caught:

- a builder's unused-exports overage;
- an untested web toggle;
- a billing hazard (stored keys silently moving Claude Code to per-call billing).

None of it is recorded. A builder's claims against what verify proved, rework commits, time from push to `green`, and dollars per phase: the data exists in git, in GitHub Actions and in session transcripts, and no page reads it.

## The plan

Three principles, all already in the repo, applied to the practice itself:

- **Measure before forming an opinion** (the evals plan).
- **One page per day, deterministic, every number next to what it was** (grades and personas).
- **A number never improves by moving its bound unless the page says so** (the ratchets' own rule).

The pieces:

- **The practice page.** Each night, `scripts/practice.mjs` writes `docs/practice/YYYY-MM-DD.md`, with no model and nothing written to a canvas. Every leak above becomes a counted row with yesterday's value. The rows are worst-first, each naming the file or issue to fix.
- **The daily lap.** Each morning, a session reads the page and fixes one leak. This works by hand, or by re-running the goal that started this doc: *"read today's practice page; fix the worst row; record it"*. It commits, and the next night's page shows the number moved.

The phases make the rows go to zero, then add the evals.

| Phase | What | Outcome |
|---|---|---|
| **0. The page** | `scripts/practice.mjs` + `test/practice.test.ts` + a nightly `practice.yml` on the grades pattern (self-merge, drain, `docs/practice/` only) | Every number in "Where it leaks" recomputed nightly, with *was* |
| **1. Records that can't disagree** | The index's "where it stands" cell checked against (or generated from) front matter `note`. `status.sh` requires Status lines wherever `## Phase` headings exist and rejects DONE. Front matter is checked against the phases (all closed means `built`; anything open means `partial`). A research note missing from the index fails `roadmap --check`. All of this runs in `npm test`. | Rows in section 1 at 0, and held there by tests |
| **2. Issues are the public ledger** | A check that a built or superseded project's issue is closed, and that an open issue is named by some doc (or the doc says `issue: none`). One label per project in place of milestones. Closing issues and triaging #246–248 is **Dion's call**: outward-facing. | Rows in section 2 at 0 |
| **3. Queues with ages** | `owed_since` on verify walks. A PART-DONE phase that needs a person must have a walk. Untriaged Loop findings and stale phases show their age on the page, then on ROADMAP. | Every queue is a number with an age |
| **4. Gates that tell the truth** | Ratchets count untracked files (`git ls-files --cached --others --exclude-standard`). Lint runs on main. An opt-in pre-push hook runs `test:deep`. A lock on `dist`. A three-journey smoke run before `green`. A bundle headroom policy (**Dion's call**: re-baseline to real headroom, or a size-reduction project). The review queue compares against the commit date, not the clock. | Main's red rate trended toward 0; no gate reads differently before and after `git add` |
| **5. Evals of the product** | Nightly corpus page: undo rate of agent-authored ops, preference pairs gained, asks answered, cancelled or silent (`isocan evals corpus/pairs`). Weekly golden-v1 through `lift.mjs`. Grades pointed at canvases and golden output, not `docs/index.html`. A count toward the judge's ~470 labelled rows. | The product's quality as a trend, not a feeling |
| **6. Evals of the build loop** | The conductor records each phase in commit trailers: `Verify-Rounds:`, `Claims-Held: n/m`, `Wall:`, `Cost:`. The page reads them along with git (rework within 7 days of a phase commit) and Actions (red-main rate, push → `green` minutes). `flakes.mjs` runs weekly. **Needs an edit to `.claude/skills/conduct/SKILL.md`**, which is Dion's to approve. | The builder loop as numbers: what it claims, what holds, what it costs |
| **7. Prune** | Every persona has a number or comes off the schedule. One-shot instruments are scheduled or retired. `docs/evals.md` cadence is corrected. | Every instrument measures something that moves |

## Evals: what would actually make things better

There are two things to evaluate, and the repo already holds most of the data
for both.

**The product.** The oplog is the richest signal here, and nobody reads it
on a schedule: an undo is a labelled failure, and a version stack is a
preference pair a person produced for free (stage 0 counted 16,050 ops, 35
undone and 11 pairs on 1 Sep). The evals, cheapest first:

1. **Undo rate of agent-authored ops**, nightly. This is the closest thing the product has to "did the agent do what was wanted".
2. **Ask outcomes.** For each `categoriseAsk` category, the share of asks answered, cancelled or left silent.
3. **Golden v1 pass rate**, weekly. 20 tasks; turns and dollars per category.
4. **Preference pairs collected.** This is what moves the judge toward calibration, which reads κ 0.26 today and needs about 470 rows.
5. **Converge keep rate**: what the night shift built, then kept, built on or reverted.

Each gets a direction, and each regression gets a row on the practice page.

**The build loop.** Each eval below already has data:

| Eval | Reads | Today |
|---|---|---|
| Red main | `release.yml` conclusions | 4 / 40 |
| Push → `green` | Actions timestamps | ~11 min a run |
| Rework | commits touching a phase commit's files within 7 days, or "the rest", "missed", "left behind" | 21 fix commits and 4 left-behind commits since 1 Sep |
| Builder claims held | the trailers (phase 6) | not recorded |
| Verify rounds per phase | the trailers | not recorded |
| Flakes | `flakes.mjs`, `.isocan/timings.jsonl`, CI profiles | 23 mentions since 1 Sep; no schedule |
| Lesson recurrence | `lessons.mjs` citations against fix commits | not computed |
| Cost per phase | builder usage (tokens, minutes) | in the transcripts only |

A lower rework rate and fewer verify rounds at the same proof bar is what a
better brief, skill or AGENTS.md rule looks like. That turns the practice
itself into something that can be A/B-ed: change the conduct skill, then
watch two weeks of trailers.

## Decisions for Dion

1. **Bundle headroom.** Re-baseline the ceiling to give real room, for example 5 KB under a new number with the ratchet kept, or start a size-reduction project first. 15 bytes taxes every web change.
2. **Issues.** Close the six built projects' issues. Choose labels or milestones (labels are recommended: one per project). Decide on #246–248.
3. **Conductor trailers.** Approve the edit to `.claude/skills/conduct/SKILL.md` (agents cannot edit `.claude/`).
4. **Journeys as a gate.** Three smoke journeys before `green` adds about 3 minutes to `release`.
5. **The daily lap's owner.** Either a scheduled morning session, or whoever opens the repo first. The page works either way; the lap is what turns it into improvement.
