# architect — 2026-09-11

Run by `scripts/persona-run.mjs` at `a2deb19`. **Nothing was changed.**

| Goal | Target | Now | Verdict |
| --- | --- | --- | --- |
| runtime dependencies of @isocan/core | at most 1 | 1 | held |
| operations a person can send and an agent cannot | at most 0 | 0 | held |
| operations in the vocabulary | at most 33 | 35 (was 33 on 2026-09-01) | **MISSED** |

## Findings

| Finding | Outcome |
| --- | --- |
| operations in the vocabulary is 35, past 33 | rejected — a counting bug, not vocabulary. `Operation` has 33 members, read with TypeScript's own parser. `op-types` counted every line in `ops.ts` shaped like a union member opening a brace, and `c8213d70` reformatted `Placement` — a type an operation carries — into a multi-line union that added two such lines while adding no operation. The metric now reads the members of `export type Operation` and nothing beside it (`operationMembers` in `scripts/isomorphism.mjs`, shared with the isomorphism audit), `test/measure.test.ts` holds it against this exact shape, and the selftest's mutation adds an operation instead of a union next to one — the old mutation is why the selftest passed while the number was wrong. |

`unanswered` until somebody writes `accepted` or `rejected`. **After 3 days
an unanswered row fails `npm test`** — the queue can fail, so a correct report
cannot be quietly ignored the way six nights of them were (#197).

---

Read `docs/reviews/README.md` before the next run: a finding that keeps
reappearing is a finding that needs a guard, not a third mention.
