# performance — 2026-09-08

Run by `scripts/persona-run.mjs` at `cec25ce`. **Nothing was changed.**

| Goal | Target | Now | Verdict |
| --- | --- | --- | --- |
| the entry chunk a first visit downloads | at most 640000 | 699999 (was 600420 on 2026-09-02) | **MISSED** |
| bytes past the last size somebody agreed to | at most 0 | 3899 (was 0 on 2026-09-07) | **MISSED** |

## Findings

| Finding | Outcome |
| --- | --- |
| the entry chunk a first visit downloads is 699999, past 640000 | unanswered |
| bytes past the last size somebody agreed to is 3899, past 0 | accepted — the ceiling moves to 646,844, the entry chunk as built at the commit that raises it, with the reason written beside `CEILING` in `scripts/bundle-ceiling.mjs`. Building every commit since the last raise accounts for all 5,744 bytes over 641,100: 1,305 are #214, areas that grow to fit, which landed underneath that raise and so were over before it was written; 2,263 are #221, telling an agent whose word wakes it; 1,053 are #215, the dual faces; 888 are the Site address field (#231 and the commit after it); and 235 are four small changes. Each is a feature somebody asked for, and none is the eager import `JUMP` exists to stop. The 3,899 on this page was measured against an earlier ceiling, but it is the same question and this is its answer. |

`unanswered` until somebody writes `accepted` or `rejected`. **After 3 days
an unanswered row fails `npm test`** — the queue can fail, so a correct report
cannot be quietly ignored the way six nights of them were (#197).

---

Read `docs/reviews/README.md` before the next run: a finding that keeps
reappearing is a finding that needs a guard, not a third mention.
