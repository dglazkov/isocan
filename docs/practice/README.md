# Practice

One page a night, `YYYY-MM-DD.md`. It shows where the way isocan is built
leaks, measured from the tree, git and GitHub, with every number beside
yesterday's. [`docs/projects/practice/design.md`](../projects/practice/design.md)
is the argument, and its "Where it leaks" section is the list of rows.

**The morning lap reads this page.** Open the newest one, take the worst row,
fix it, and commit. The next night's page shows whether the number moved. That
loop is the point; the page is only where it starts.

The lap, for whoever runs it (a person, `/goal`, or a scheduled session):

> Read the newest page in `docs/practice/`. Take the worst row you can fix
> without a person. Fix it at its cause rather than its count. Prove it with
> `node scripts/practice.mjs --no-write` (the row moved) and the usual gates.
> Commit with the row's key in the subject (`practice: research-unindexed 25 → 0`).
> If the worst rows all need a person, list them for Dion instead.

- **One row a lap.** A lap that fixes one row and holds it beats one that nudges five.
- **Rows that need a person stay on the page.** Closing issues, editing
  `.claude/`, moving a ceiling and deciding a Loop finding are Dion's. The
  lap writes the proposal, not the act.
- **A fix gets a guard where it can.** If the row can come back, the fix
  ships with the test that stops it, as in `docs/reviews/lessons.md`. Phase 1
  of [the walk](../projects/practice/phases.md) is mostly that.

What a page holds:

- **Front matter**: the date and every number, as `key: value`. Tomorrow's
  page reads these back as *was*. A number that could not be taken is left
  out, so tomorrow's *was* is blank rather than a zero nobody measured.
- **Worst first**: one table of every row. A row that got worse since *was*
  comes first, then the row with the bigger leak. A row whose bound moved says
  so, because a number that improves by moving its bound has not improved.
- **By group**: records, issues, queues, gates, instruments and build loop,
  each row with up to five offenders by file, issue or commit.

Rows marked *heuristic* can be wrong in either direction, and the row says
how. `--offline` leaves out the GitHub rows and the page says so.

```
node scripts/practice.mjs                 # today's page
node scripts/practice.mjs --json          # the numbers (still writes the page)
node scripts/practice.mjs --offline       # no GitHub
node scripts/practice.mjs --day 2026-10-02
node scripts/practice.mjs --no-write      # print only
```

`.github/workflows/practice.yml` writes the page nightly at 09:33 UTC. It
works like the grades run: a `practice/<day>` PR that touches only this
directory, merged by the run itself once `npm test` passes on the branch, and
then older practice PRs are drained. Deterministic, with no model. Closing
issues and moving ceilings are proposed here and never done by the run.
