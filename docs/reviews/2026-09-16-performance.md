# performance — 2026-09-16

Run by `scripts/persona-run.mjs` at `fba4b87`. **Nothing was changed.**

| Goal | Target | Now | Verdict |
| --- | --- | --- | --- |
| the entry chunk a first visit downloads | at most 640000 | 746413 (was 600420 on 2026-09-02) | **MISSED** |
| bytes past the last size somebody agreed to | at most 0 of 745000 | 1413 (was 0 on 2026-09-07) | **MISSED** |

## Findings

| Finding | Outcome |
| --- | --- |
| the entry chunk a first visit downloads is 746413, past 640000 | accepted — Dion, 20 Sep 2026. The goal moves 640000 → 747000 to meet the agreed ceiling in `scripts/bundle-ceiling.mjs`. The cost is stated in the persona file: the entry chunk leaves this queue until it passes 747000, and CEILING's own raises are what keep creep legible in the meantime. |
| bytes past the last size somebody agreed to is 1413, past 0 of 745000 | accepted — Dion, 20 Sep 2026. The ceiling has since been raised to 747000, which covers the 746413 measured today, so this creep is inside the agreed number rather than past it. |

`unanswered` until somebody writes `accepted` or `rejected`. **After 3 days
an unanswered row fails `npm test`** — the queue can fail, so a correct report
cannot be quietly ignored the way six nights of them were (#197).

---

Read `docs/reviews/README.md` before the next run: a finding that keeps
reappearing is a finding that needs a guard, not a third mention.
