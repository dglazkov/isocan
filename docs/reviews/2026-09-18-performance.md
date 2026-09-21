# performance — 2026-09-18

Run by `scripts/persona-run.mjs` at `da81ea1`. **Nothing was changed.**

| Goal | Target | Now | Verdict |
| --- | --- | --- | --- |
| the entry chunk a first visit downloads | at most 640000 | 745811 (was 600420 on 2026-09-02) | **MISSED** |
| bytes past the last size somebody agreed to | at most 0 of 745900 | 0 | held |

## Findings

| Finding | Outcome |
| --- | --- |
| the entry chunk a first visit downloads is 745811, past 640000 | accepted — Dion, 20 Sep 2026. The goal moved 640000 → 747000 to meet the agreed ceiling, and every night above is under it. Same decision as the 15 and 16 September pages, applied to this night so the queue stops asking a question already settled. |

`unanswered` until somebody writes `accepted` or `rejected`. **After 3 days
an unanswered row fails `npm test`** — the queue can fail, so a correct report
cannot be quietly ignored the way six nights of them were (#197).

---

Read `docs/reviews/README.md` before the next run: a finding that keeps
reappearing is a finding that needs a guard, not a third mention.
