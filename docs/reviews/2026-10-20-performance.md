# performance — 2026-10-20

Run by `scripts/persona-run.mjs` at `83e3fac`. **Nothing was changed.**

| Goal | Target | Now | Verdict |
| --- | --- | --- | --- |
| the entry chunk a first visit downloads | at most 747000 | 750368 (was 600420 on 2026-09-02) | **MISSED** |
| bytes past the last size somebody agreed to | at most 0 of 734500 | 15868 (was 0 on 2026-09-07) | **MISSED** |
| main-thread time the costliest living ground adds to a frame, CPU throttled 4x | at most 2ms | 1.5ms | held |
| p90 frame time while panning and zooming a populated canvas | at most 25ms | 16.7ms (was 16.8ms on 2026-10-16) | held |
| blank or flickering frames while panning and zooming a canvas | at most 0 | 0 | held |

## Findings

| Finding | Outcome |
| --- | --- |
| the entry chunk a first visit downloads is 750368, past 747000 | accepted — fixed on 20 Oct: production entry 750,572 → 733,721 bytes after separating harness classification, sprint setup and inbox routing; overage 0 against the unchanged 734,500 baseline, also below 747,000. Full runtime API preserved in the production browser check; [evidence](../changelog/2026-10-20.md#later-the-entry-bundle-returns-below-the-agreed-baseline). |
| bytes past the last size somebody agreed to is 15868, past 0 of 734500 | accepted — fixed on 20 Oct: production entry 750,572 → 733,721 bytes after separating harness classification, sprint setup and inbox routing; overage 0 against the unchanged 734,500 baseline, also below 747,000. Full runtime API preserved in the production browser check; [evidence](../changelog/2026-10-20.md#later-the-entry-bundle-returns-below-the-agreed-baseline). |

`unanswered` until somebody writes `accepted` or `rejected`. **After 3 days
an unanswered row fails `npm test`** — the queue can fail, so a correct report
cannot be quietly ignored the way six nights of them were (#197).

---

Read `docs/reviews/README.md` before the next run: a finding that keeps
reappearing is a finding that needs a guard, not a third mention.
