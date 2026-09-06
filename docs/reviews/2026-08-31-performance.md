# performance — 2026-08-31

Run by `scripts/persona-run.mjs` at `02c8099`. **Nothing was changed.**

| Goal | Target | Now | Verdict |
| --- | --- | --- | --- |
| largest built JavaScript chunk | at most 700000 | 713306 (was 673076 on 2026-08-29) | **MISSED** |

## Findings

| Finding | Outcome |
| --- | --- |
| largest built JavaScript chunk is 713306, past 700000 | rejected — the metric was retired. A max-over-chunks bound "could be satisfied by splitting an eager chunk in two and downloading exactly the same bytes", so it was replaced by `the entry chunk a first visit downloads` at 640,000. Superseded, not ignored. |

`unanswered` until somebody writes `accepted` or `rejected`. Nothing counts
them yet, and nothing should until there are enough to mean something.

---

Read `docs/reviews/README.md` before the next run: a finding that keeps
reappearing is a finding that needs a guard, not a third mention.
