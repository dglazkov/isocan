# Grades

One page per run of the deterministic graders, dated.

**These are measurements, not opinions.** Every check here has a right answer
that a machine can be certain of — a contrast ratio against what is actually
painted behind the text, an image drawn to a ratio nobody chose, a control
with no accessible name, a page that scrolls sideways at 390px. Stage 2 of
[the evals plan](../projects/evals/plan.md) argues for spending these first
and hardest: a deterministic grader is reproducible, costs nothing per run,
cannot drift, and never needs calibrating, so every point of quality it scores
is a point no judge has to argue about.

**Nothing here writes to a canvas.** The night shift's step 1 answers *is
anything already broken* before anything tries to fix it, and a grader with an
interest in what it finds is a grader you cannot read.

## How a page gets here

```bash
node scripts/grade-night.mjs
```

Nightly in CI over the pages this repository ships, opened as a pull request
— the changelog's shape, and for the changelog's reason: a machine writing
straight into `main` every night is how a directory quietly fills with things
nobody agreed to.

`--canvases` points the same run at every HTML item on every canvas in the
isocan home. That one cannot run in CI and never will: canvases live in
somebody's home on their own machine, and a GitHub runner has none.

## The gate

The run begins with `grade.mjs --selftest` — every check against a page built
to break all of them — and if any check stays **silent**, the run reports
nothing at all rather than a page of zeroes.

That is not caution. The first version of the grader scored a page with a
stretched image 8/8, because a syntax error in the probe made every reading
`undefined`. And the CI step that was supposed to catch that spawned a
macOS-only Chrome path on an Ubuntu runner, failed with `ENOENT` on every
commit for weeks, and was marked `continue-on-error` — so the check that
existed to stop us believing a silent zero **was one**, in the exact place we
pointed at when we said it was checked.

A grader that reports zeros when it breaks is worse than no grader, because it
is believed. A nightly page of them is that belief on a schedule.
