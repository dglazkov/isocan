# Practice

One page a night, `YYYY-MM-DD.md`. It shows where the way isocan is built
leaks, measured from the tree, git and GitHub.
[`docs/projects/practice/design.md`](../projects/practice/design.md) is the
argument.

**Two series, one directory.** Pages from 6 Oct 2026 on are keel's health
pages: `node scripts/keel/improve.mjs --report` measures each instrument
against a bound in `.keel/bounds.json` that only tightens, and ends in one
proposal. The pages before that are isocan's own practice page
(`scripts/practice.mjs`, retired when keel's night took its rows over; the
rows keel does not measure, like the bundle ceiling and the export ratchets,
are isocan's own tests). Either way, the newest page is the one to read.

**The morning lap reads this page.** Open the newest one, take the worst row,
fix it, and commit. The next night's page shows whether the number moved. That
loop is the point; the page is only where it starts.

The lap, for whoever runs it (a person, `/goal`, or a scheduled session):

> Read the newest page in `docs/practice/`. Take the worst row you can fix
> without a person. Fix it at its cause rather than its count. Prove it with
> `node scripts/keel/improve.mjs --json` (the measure moved) and the usual
> gates. Commit with the measure's id in the subject
> (`practice: research_unindexed 25 → 0`). If the worst rows all need a
> person, list them for Dion instead.

- **One row a lap.** A lap that fixes one row and holds it beats one that nudges five.
- **Rows that need a person stay on the page.** Closing issues, editing
  `.claude/`, moving a bound and deciding a Loop finding are Dion's. The
  lap writes the proposal, not the act.
- **A fix gets a guard where it can.** If the row can come back, the fix
  ships with the test that stops it, as in `docs/reviews/lessons.md`. Phase 1
  of [the walk](../projects/practice/phases.md) is mostly that.

```
node scripts/keel/improve.mjs             # every measure against its bound
node scripts/keel/improve.mjs --json      # the numbers
node scripts/keel/improve.mjs --report    # write today's page and .keel/bounds.json
```

`.github/workflows/keel-night.yml` writes the page nightly at 07:23 UTC: a
`keel-night/<day>` PR that holds only data (this directory and
`.keel/bounds.json`), merged once the gate passed on that tree, and then older
`keel-night/` PRs are drained by `scripts/keel/drain.mjs`. Deterministic, with
no model. Closing issues and moving bounds are proposed on the page and never
done by the run.
