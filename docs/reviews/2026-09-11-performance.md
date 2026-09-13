# performance — 2026-09-11

Run by `scripts/persona-run.mjs` at `a2deb19`. **Nothing was changed.**

| Goal | Target | Now | Verdict |
| --- | --- | --- | --- |
| the entry chunk a first visit downloads | at most 640000 | 646899 (was 600420 on 2026-09-02) | **MISSED** |
| bytes past the last size somebody agreed to | at most 0 | 5799 (was 0 on 2026-09-07) | **MISSED** |

## Findings

| Finding | Outcome |
| --- | --- |
| the entry chunk a first visit downloads is 646899, past 640000 | accepted — past the goal, and the goal stays: 653,406 at `1e846a1f`, 13,406 over 640,000. Dion's call was to raise the last agreed size (CEILING, now 653,500), not the target. What grew and the first bytes to take back — the Help panel, imported statically and paid by every visit before anyone presses `?` — are written beside the number in `scripts/bundle-ceiling.mjs`. |
| bytes past the last size somebody agreed to is 5799, past 0 | accepted — CEILING raised 641,100 → 653,500 on 11 Sep, at Dion's call: 653,406 measured at `1e846a1f` plus a 94-byte margin. The 12,306 bytes are features in core and the canvas shell, itemised commit by commit beside the number in `scripts/bundle-ceiling.mjs`; the largest single step is 3,373, a sixth of `JUMP`, so none of it is the eager-import accident the hard gate is for. Answered four nights late, with the queue a day from reddening `main` over it. |

`unanswered` until somebody writes `accepted` or `rejected`. **After 3 days
an unanswered row fails `npm test`** — the queue can fail, so a correct report
cannot be quietly ignored the way six nights of them were (#197).

---

Read `docs/reviews/README.md` before the next run: a finding that keeps
reappearing is a finding that needs a guard, not a third mention.
