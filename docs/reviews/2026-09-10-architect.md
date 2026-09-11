# architect — 2026-09-10

Run by `scripts/persona-run.mjs` at `86cc4cb`. **Nothing was changed.**

| Goal | Target | Now | Verdict |
| --- | --- | --- | --- |
| runtime dependencies of @isocan/core | at most 1 | 1 | held |
| operations a person can send and an agent cannot | at most 0 | 0 | held |
| operations in the vocabulary | at most 33 | 35 (was 33 on 2026-09-01) | **MISSED** |

## Findings

| Finding | Outcome |
| --- | --- |
| operations in the vocabulary is 35, past 33 | rejected — the vocabulary is still 33 and the bound held; the instrument miscounted. `op-types` counted every line of `ops.ts` that opens a union arm at two spaces of indent, and #214 (`c8213d7`) reformatted `Placement`, a neighbouring type and not an operation, from one line into a two-arm union across several. Those two arms (lines 40 and 48) scored as two new operations. The `Operation` union did not change and still carries 33 distinct `type` literals. The metric now reads that union alone and counts its `type` literals, so neither a reformat nor a neighbouring type can move it, and its selftest breaks the union itself rather than appending a type elsewhere in the file, which the corrected count would rightly ignore. |

`unanswered` until somebody writes `accepted` or `rejected`. **After 3 days
an unanswered row fails `npm test`** — the queue can fail, so a correct report
cannot be quietly ignored the way six nights of them were (#197).

---

Read `docs/reviews/README.md` before the next run: a finding that keeps
reappearing is a finding that needs a guard, not a third mention.
