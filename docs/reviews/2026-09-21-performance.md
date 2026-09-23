# performance — 2026-09-21

Run by `scripts/persona-run.mjs` at `12a3dd0`. **Nothing was changed.**

| Goal | Target | Now | Verdict |
| --- | --- | --- | --- |
| the entry chunk a first visit downloads | at most 747000 | 753083 (was 600420 on 2026-09-02) | **MISSED** |
| bytes past the last size somebody agreed to | at most 0 of 747000 | 6083 (was 0 on 2026-09-07) | **MISSED** |

## Findings

| Finding | Outcome |
| --- | --- |
| the entry chunk a first visit downloads is 753083, past 747000 | accepted — fixed, not moved: the emoji picker's set (`emoji.ts`) and the picker now arrive on the `+`, and the Pen's colour names (`colour.ts`, `contrast.ts`) on the Pen's release; an A/B in one worktree read 756,060 → 726,962 (−29,098). One `@__PURE__` on `ALL_EMOJI`'s `flatMap` is what let `emoji.ts` leave: an effectful module stays wherever core's barrel reaches it. The goal stays at 747,000. |
| bytes past the last size somebody agreed to is 6083, past 0 of 747000 | accepted — fixed, and CEILING went DOWN 747,000 → 727,500 rather than up: the emoji picker's set (`emoji.ts`) and the picker now arrive on the `+`, and the Pen's colour names (`colour.ts`, `contrast.ts`) on the Pen's release; an A/B in one worktree read 756,060 → 726,962 (−29,098). One `@__PURE__` on `ALL_EMOJI`'s `flatMap` is what let `emoji.ts` leave: an effectful module stays wherever core's barrel reaches it. The reason is beside the number in `scripts/bundle-ceiling.mjs`. |

`unanswered` until somebody writes `accepted` or `rejected`. **After 3 days
an unanswered row fails `npm test`** — the queue can fail, so a correct report
cannot be quietly ignored the way six nights of them were (#197).

---

Read `docs/reviews/README.md` before the next run: a finding that keeps
reappearing is a finding that needs a guard, not a third mention.
