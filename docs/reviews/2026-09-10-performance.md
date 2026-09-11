# performance — 2026-09-10

Run by `scripts/persona-run.mjs` at `86cc4cb`. **Nothing was changed.**

| Goal | Target | Now | Verdict |
| --- | --- | --- | --- |
| the entry chunk a first visit downloads | at most 640000 | 645806 (was 600420 on 2026-09-02) | **MISSED** |
| bytes past the last size somebody agreed to | at most 0 | 4706 (was 0 on 2026-09-07) | **MISSED** |

## Findings

| Finding | Outcome |
| --- | --- |
| the entry chunk a first visit downloads is 645806, past 640000 | unanswered |
| bytes past the last size somebody agreed to is 4706, past 0 | accepted — see the 8 September row: the ceiling moves to 646,844, with its reason in `scripts/bundle-ceiling.mjs`. |

`unanswered` until somebody writes `accepted` or `rejected`. **After 3 days
an unanswered row fails `npm test`** — the queue can fail, so a correct report
cannot be quietly ignored the way six nights of them were (#197).

---

Read `docs/reviews/README.md` before the next run: a finding that keeps
reappearing is a finding that needs a guard, not a third mention.
