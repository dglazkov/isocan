# performance — 2026-09-06

Run by `scripts/persona-run.mjs` at `56a54ca`. **Nothing was changed.**

| Goal | Target | Now | Verdict |
| --- | --- | --- | --- |
| the entry chunk a first visit downloads | at most 640000 | 722753 (was 600420 on 2026-09-02) | **MISSED** |

## Findings

| Finding | Outcome |
| --- | --- |
| the entry chunk a first visit downloads is 722753, past 640000 | unanswered |

`unanswered` until somebody writes `accepted` or `rejected`. Nothing counts
them yet, and nothing should until there are enough to mean something.

---

Read `docs/reviews/README.md` before the next run: a finding that keeps
reappearing is a finding that needs a guard, not a third mention.
