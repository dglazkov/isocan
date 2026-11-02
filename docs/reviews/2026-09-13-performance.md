# performance — 2026-09-13

Run by `scripts/persona-run.mjs` at `7e15edc`. **Nothing was changed.**

| Goal | Target | Now | Verdict |
| --- | --- | --- | --- |
| the entry chunk a first visit downloads | at most 640000 | 707695 (was 600420 on 2026-09-02) | **MISSED** |
| bytes past the last size somebody agreed to | at most 0 | 5295 (was 0 on 2026-09-07) | **MISSED** |

## Findings

| Finding | Outcome |
| --- | --- |
| the entry chunk a first visit downloads is 707695, past 640000 | accepted — past the 640,000 target, which stays as the goal; the design-partner workflow and module additions were agreed and covered by raising CEILING in `scripts/bundle-ceiling.mjs`. |
| bytes past the last size somebody agreed to is 5295, past 0 | accepted — CEILING raised in `scripts/bundle-ceiling.mjs` to cover the design-partner additions; subsequent runs (15 Sep, 16 Sep) hold 0 bytes past CEILING. |

`unanswered` until somebody writes `accepted` or `rejected`. **After 3 days
an unanswered row fails `npm test`** — the queue can fail, so a correct report
cannot be quietly ignored the way six nights of them were (#197).

---

Read `docs/reviews/README.md` before the next run: a finding that keeps
reappearing is a finding that needs a guard, not a third mention.
