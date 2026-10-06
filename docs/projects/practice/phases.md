---
status: partial
since: 2026-10-02
see: evals, personas
note: "the walk: the nightly practice page, records that can't disagree, issues as the public ledger, queues with ages, gates that tell the truth, evals of the product, evals of the build loop, prune."
---

# The practice — the walk

**2 October 2026.** Held to [design.md](design.md).

**Where we are, 5 Oct 2026: phase 0 is CLOSED, and its page now comes from keel — isocan's `practice.mjs` taught keel 0.7.0 its measures (keel phase 27), and `keel-night.yml` writes the nightly health page into `docs/practice/`. Next: practice phase 1, records that can't disagree.**

Rules for every phase, on top of `AGENTS.md`:

- **Deterministic, no model.** The page is computed from the tree, git and
  GitHub. A judgement has a row of its own, labelled as one, or it does not
  appear.
- **Every number has a *was*.** The page reads yesterday's page. A row whose
  bound moved says so on the row.
- **Worst first, and actionable.** Each row names the file, issue or command
  that would move it.
- **Outward acts are a person's.** Closing issues, editing `.claude/`, and
  moving a ceiling are proposed on the page, never done by the run.

## Phase 0 — The page

**Status: CLOSED, 2 October 2026.** `scripts/practice.mjs` (checks pure in `scripts/lib/practice.mjs`) writes `docs/practice/YYYY-MM-DD.md`: 29 rows in six groups, each with *was*, worst first, each naming its top offender. `--json`, `--offline`, `--day`, `--no-write`. `practice.yml` runs at 09:33 UTC on the grades pattern, through a drain now shared with grades (`scripts/lib/drain.mjs`). 24 fixture tests; the workflow test holds its bounds; the first real page matches the audit on 18 rows and explains the rest.

**Outcome:** `node scripts/practice.mjs` writes `docs/practice/YYYY-MM-DD.md`.
Each leak in design.md's "Where it leaks" is a counted row with yesterday's
value, and the rows are grouped as records, issues, queues, gates, instruments
and build loop. `--json` prints the numbers and `--offline` skips GitHub.
`practice.yml` runs nightly on the grades pattern: it opens a PR that touches
`docs/practice/` only, merges it itself after the suite runs on the branch, and
drains older practice PRs.

**Proof:** `test/practice.test.ts` against fixture trees, covering each check's
positive and negative case and the *was* column. One real run whose numbers
match the audit in design.md (or explain why they differ). The workflow test
holds `practice.yml` to the night shift's bounds.

### Trajectory

- **2026-10-02** — The first page reads 4 issues of finished work still open, not the audit's 6: wireframes' front matter names #369, and sheep-harness has no `status:`. The page reads front matter; the audit was a judgement, and the page is what holds.
- **2026-10-02** — The index-vs-front-matter row is a heuristic that reads only a cell's lead: it catches anatomy, standing-agents and inception, and misses mindmap. Phase 1 replaces it with a check, not a guess.
- **2026-10-02** — Two targets are placeholders for sorting, not policy: bundle headroom 5,000 bytes and grades ≥2 pages. Both are Dion's decisions on design.md's list.
- **2026-10-02** — The conductor's commit of keys and copy phase 4 swept in this phase's half-built script without its lib: staging "everything but" while a builder works in the tree. Stage an explicit list. The left-behind row counts this shape.
- **2026-10-05** — The page moved into keel. isocan adopted keel (practice 0.6.7); Dion's rule is that what isocan does better goes upstream, so `scripts/practice.mjs`'s general measures became keel 0.7.0's (records_disagree, changelog_gaps, research_unindexed, verify_owed, issues_unnamed, issues_done_open, prs_stale, and the projects shape read), and `practice.yml` gave way to keel's `keel-night.yml`, writing to the same directory. The isocan-only rows (bundle headroom, export ratchets) were already isocan's own tests. `grade.yml` was retired with it: it graded one unchanging page for 34 nights.

## Phase 1 — Records that can't disagree

**Status: NOT STARTED.**

**Outcome:** the index cell is checked against front matter. `status.sh`'s
loophole is closed and DONE is rejected. Front matter and phases are checked
against each other. The research index is complete. All of these run in
`npm test`.

**Proof:** the section 1 rows read 0, and a test fails for each kind of
disagreement.

## Phase 2 — Issues as the public ledger

**Status: NOT STARTED.**

**Outcome:** a check that links issues and docs in both directions, and one
label per project. The closing and triage list goes to Dion.

**Proof:** the section 2 rows read 0, or each remaining row is named on the
page as Dion's.

## Phase 3 — Queues with ages

**Status: NOT STARTED.**

**Outcome:** `owed_since` on verify walks. A PART-DONE phase that needs a
person has a walk. Loop triage age and stale phases appear on the page and
on ROADMAP.

**Proof:** roadmap tests. The page shows each queue's oldest item.

## Phase 4 — Gates that tell the truth

**Status: NOT STARTED.**

**Outcome:**

- Ratchets count untracked files.
- Lint runs on main.
- An opt-in pre-push hook runs `test:deep`.
- A lock guards `dist`.
- The review queue is dated by commit, not by the clock.
- Smoke journeys run before `green` if Dion agrees.
- A bundle headroom decision is recorded.

**Proof:** a ratchet test that adds an untracked fixture. The red-main rate is
trended on the page.

## Phase 5 — Evals of the product

**Status: NOT STARTED.**

**Outcome:**

- A nightly corpus section: agent undo rate, ask outcomes, and pairs gained.
- Golden-v1 run weekly through `lift.mjs`.
- Grades pointed at real output.

**Proof:** two nights of the corpus section with *was*, and one weekly golden
page.

## Phase 6 — Evals of the build loop

**Status: NOT STARTED.**

**Outcome:**

- Conductor commit trailers (`Verify-Rounds`, `Claims-Held`, `Wall`, `Cost`), once Dion approves the skill edit.
- The page reads the trailers, rework, red main, time to green and flakes.

**Proof:** a week of phases with trailers, read back as numbers.

## Phase 7 — Prune

**Status: NOT STARTED.**

**Outcome:** every persona has a number or is off the schedule. One-shot
instruments are scheduled or retired. The stale docs are corrected.

**Proof:** the page's instruments section shows no instrument without a
moving number.
