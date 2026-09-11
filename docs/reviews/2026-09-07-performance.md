# performance — 2026-09-07

Run by `scripts/persona-run.mjs` at `990062e`. **Nothing was changed.**

| Goal | Target | Now | Verdict |
| --- | --- | --- | --- |
| the entry chunk a first visit downloads | at most 640000 | 694503 (was 600420 on 2026-09-02) | **MISSED** |

## Findings

| Finding | Outcome |
| --- | --- |
| the entry chunk a first visit downloads is 694503, past 640000 | accepted — past the goal, and the goal stays: 653,406 at `1e846a1f`, 13,406 over 640,000. Dion's call was to raise the last agreed size (CEILING, now 653,500), not the target. What grew and the first bytes to take back — the Help panel, imported statically and paid by every visit before anyone presses `?` — are written beside the number in `scripts/bundle-ceiling.mjs`. |

`unanswered` until somebody writes `accepted` or `rejected`. **After 3 days
an unanswered row fails `npm test`** — the queue can fail, so a correct report
cannot be quietly ignored the way six nights of them were (#197).

---

Read `docs/reviews/README.md` before the next run: a finding that keeps
reappearing is a finding that needs a guard, not a third mention.
