# architect — 2026-09-17

Run by `scripts/persona-run.mjs` at `9d6a759`. **Nothing was changed.**

| Goal | Target | Now | Verdict |
| --- | --- | --- | --- |
| runtime dependencies of @isocan/core | at most 1 | 9 (was 1 on 2026-08-29) | **MISSED** |
| lines in the files every feature must edit | at most 24058 | 25297 (was 24058 on 2026-09-13) | **MISSED** |
| operations a person can send and an agent cannot | at most 0 | 0 | held |
| operations in the vocabulary | at most 46 | 46 (was 45 on 2026-09-15) | held |

## Findings

| Finding | Outcome |
| --- | --- |
| runtime dependencies of @isocan/core is 9, past 1 | accepted — Dion, 20 Sep 2026. The bound moved to 9; the portability argument is not withdrawn, and the way back is work that removes dependencies. Same decision as the 15 and 16 September pages, applied to this night so the queue stops asking a question already settled. |
| lines in the files every feature must edit is 25297, past 24058 | accepted — Dion, 20 Sep 2026. The bound moved to 25267, a ratchet that stands where the number stands. Same decision as the 15 and 16 September pages, applied to this night so the queue stops asking a question already settled. |

`unanswered` until somebody writes `accepted` or `rejected`. **After 3 days
an unanswered row fails `npm test`** — the queue can fail, so a correct report
cannot be quietly ignored the way six nights of them were (#197).

---

Read `docs/reviews/README.md` before the next run: a finding that keeps
reappearing is a finding that needs a guard, not a third mention.
