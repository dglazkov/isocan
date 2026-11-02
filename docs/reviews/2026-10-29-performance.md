# performance — 2026-10-29

Run by `scripts/persona-run.mjs` at `709aa77`. **Nothing was changed.**

| Goal | Target | Now | Verdict |
| --- | --- | --- | --- |
| the entry chunk a first visit downloads | at most 747000 | 735723 (was 600420 on 2026-09-02) | held |
| bytes past the last size somebody agreed to | at most 0 of 734500 | 1223 (was 0 on 2026-09-07) | **MISSED** |
| main-thread time the costliest living ground adds to a frame, CPU throttled 4x | at most 2ms | 1.5ms | held |
| p90 frame time while panning and zooming a populated canvas | at most 25ms | 16.7ms (was 16.8ms on 2026-10-16) | held |
| blank or flickering frames while panning and zooming a canvas | at most 0 | 0 | held |

## Findings

| Finding | Outcome |
| --- | --- |
| bytes past the last size somebody agreed to is 1223, past 0 of 734500 | unanswered |

`unanswered` until somebody writes `accepted` or `rejected`. **After 3 days
an unanswered row fails `npm test`** — the queue can fail, so a correct report
cannot be quietly ignored the way six nights of them were (#197).

---

Read `docs/reviews/README.md` before the next run: a finding that keeps
reappearing is a finding that needs a guard, not a third mention.
