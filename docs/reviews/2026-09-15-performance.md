# performance — 2026-09-15

Run by `scripts/persona-run.mjs` at `9631383`. **Nothing was changed.**

| Goal | Target | Now | Verdict |
| --- | --- | --- | --- |
| the entry chunk a first visit downloads | at most 640000 | 740427 (was 600420 on 2026-09-02) | **MISSED** |
| bytes past the last size somebody agreed to | at most 0 of 743900 | 0 | held |

## Findings

| Finding | Outcome |
| --- | --- |
| the entry chunk a first visit downloads is 740427, past 640000 | accepted — Dion, 20 Sep 2026. The goal moves 640000 → 747000 to meet the agreed ceiling in `scripts/bundle-ceiling.mjs`. The cost is stated in the persona file: the entry chunk leaves this queue until it passes 747000, and CEILING's own raises are what keep creep legible in the meantime. |

`unanswered` until somebody writes `accepted` or `rejected`. **After 3 days
an unanswered row fails `npm test`** — the queue can fail, so a correct report
cannot be quietly ignored the way six nights of them were (#197).

---

Read `docs/reviews/README.md` before the next run: a finding that keeps
reappearing is a finding that needs a guard, not a third mention.
