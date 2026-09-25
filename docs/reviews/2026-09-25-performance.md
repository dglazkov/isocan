# performance — 2026-09-25

Run by `scripts/persona-run.mjs` at `b82468f`. **Nothing was changed.**

| Goal | Target | Now | Verdict |
| --- | --- | --- | --- |
| the entry chunk a first visit downloads | at most 747000 | 729717 (was 600420 on 2026-09-02) | held |
| bytes past the last size somebody agreed to | at most 0 of 730100 | 0 | held |

## Findings

| Finding | Outcome |
| --- | --- |
| — | — |

`unanswered` until somebody writes `accepted` or `rejected`. **After 3 days
an unanswered row fails `npm test`** — the queue can fail, so a correct report
cannot be quietly ignored the way six nights of them were (#197).

---

Read `docs/reviews/README.md` before the next run: a finding that keeps
reappearing is a finding that needs a guard, not a third mention.
