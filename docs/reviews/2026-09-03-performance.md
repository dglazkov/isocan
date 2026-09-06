# performance — 2026-09-03

Run by `scripts/persona-run.mjs` at `5475a35`. **Nothing was changed.**

| Goal | Target | Now | Verdict |
| --- | --- | --- | --- |
| the entry chunk a first visit downloads | at most 640000 | 648435 (was 600420 on 2026-09-02) | **MISSED** |

## Findings

| Finding | Outcome |
| --- | --- |
| the entry chunk a first visit downloads is 648435, past 640000 | accepted — and it is the finding that exposed the pattern. It was true for four nights while every report sat in an unmerged PR. Now #185 step 1 (720,659 after route and modal splitting) and, more to the point, `test/bundle-budget.test.ts` — the number can redden a commit. |

`unanswered` until somebody writes `accepted` or `rejected`. Nothing counts
them yet, and nothing should until there are enough to mean something.

---

Read `docs/reviews/README.md` before the next run: a finding that keeps
reappearing is a finding that needs a guard, not a third mention.
