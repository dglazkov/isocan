# performance — 2026-09-09

Run by `scripts/persona-run.mjs` at `20c9f38`. **Nothing was changed.**

| Goal | Target | Now | Verdict |
| --- | --- | --- | --- |
| the entry chunk a first visit downloads | at most 640000 | 638569 (was 600420 on 2026-09-02) | held |
| bytes past the last size somebody agreed to | at most 0 | 1169 (was 0 on 2026-09-07) | **MISSED** |

## Findings

| Finding | Outcome |
| --- | --- |
| bytes past the last size somebody agreed to is 1169, past 0 | accepted — CEILING raised 641,100 → 653,500 on 11 Sep, at Dion's call: 653,406 measured at `1e846a1f` plus a 94-byte margin. The 12,306 bytes are features in core and the canvas shell, itemised commit by commit beside the number in `scripts/bundle-ceiling.mjs`; the largest single step is 3,373, a sixth of `JUMP`, so none of it is the eager-import accident the hard gate is for. Answered four nights late, with the queue a day from reddening `main` over it. |

`unanswered` until somebody writes `accepted` or `rejected`. **After 3 days
an unanswered row fails `npm test`** — the queue can fail, so a correct report
cannot be quietly ignored the way six nights of them were (#197).

---

Read `docs/reviews/README.md` before the next run: a finding that keeps
reappearing is a finding that needs a guard, not a third mention.
