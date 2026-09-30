# performance — 2026-09-29

Run by `scripts/persona-run.mjs` at `6841df9`. **Nothing was changed.**

| Goal | Target | Now | Verdict |
| --- | --- | --- | --- |
| the entry chunk a first visit downloads | at most 747000 | 705006 (was 600420 on 2026-09-02) | held |
| bytes past the last size somebody agreed to | at most 0 of 701300 | 3706 (was 0 on 2026-09-07) | **MISSED** |

## Findings

| Finding | Outcome |
| --- | --- |
| bytes past the last size somebody agreed to is 3706, past 0 of 701300 | accepted — fixed, not raised: down to 700,602 (0 past 701,300) after extracting `@isocan/core`'s `design-partner-values.ts` leaf and deferring `hostbridge.ts` (`?embed=1` only) and `ElsewherePage.tsx` (`lazy()`). |

`unanswered` until somebody writes `accepted` or `rejected`. **After 3 days
an unanswered row fails `npm test`** — the queue can fail, so a correct report
cannot be quietly ignored the way six nights of them were (#197).

---

Read `docs/reviews/README.md` before the next run: a finding that keeps
reappearing is a finding that needs a guard, not a third mention.
