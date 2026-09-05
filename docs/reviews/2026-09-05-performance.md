# performance — 2026-09-05

Run by `scripts/persona-run.mjs` at `408de47`. **Nothing was changed.**

| Goal | Target | Now | Verdict |
| --- | --- | --- | --- |
| the entry chunk a first visit downloads | at most 640000 | 753610 (was 600420 on 2026-09-02) | **MISSED** |

## Findings

| Finding | Outcome |
| --- | --- |
| the entry chunk a first visit downloads is 753610, past 640000 | unanswered |

`unanswered` until somebody writes `accepted` or `rejected`. Nothing counts
them yet, and nothing should until there are enough to mean something.

---

Read `docs/reviews/README.md` before the next run: a finding that keeps
reappearing is a finding that needs a guard, not a third mention.
