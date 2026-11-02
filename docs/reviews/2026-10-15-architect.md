# architect — 2026-10-15

Run by `scripts/persona-run.mjs` at `28af2e6`. **Nothing was changed.**

| Goal | Target | Now | Verdict |
| --- | --- | --- | --- |
| runtime dependencies of @isocan/core | at most 9 | 9 (was 1 on 2026-08-29) | held |
| lines in the files every feature must edit | at most 25267 | 25954 (was 25267 on 2026-09-20) | **MISSED** |
| tokens an agent reads before its first act | at most 3500 | 3499 (was 2982 on 2026-09-24) | held |
| operations a person can send and an agent cannot | at most 0 | 0 | held |
| operations in the vocabulary | at most 46 | 47 (was 45 on 2026-09-15) | **MISSED** |

## Findings

| Finding | Outcome |
| --- | --- |
| lines in the files every feature must edit is 25954, past 25267 | unanswered |
| operations in the vocabulary is 47, past 46 | accepted — `agent.ceiling` is the deliberate 47th operation, shipped in `834018105` (critique phase 2). Its own type makes older homes refuse an unsupported permission restriction instead of silently enrolling an uncapped critic. The architect goal now records this one operation, with no spare capacity. See the verification below. |

`unanswered` until somebody writes `accepted` or `rejected`. **After 3 days
an unanswered row fails `npm test`** — the queue can fail, so a correct report
cannot be quietly ignored the way six nights of them were (#197).

---

Read `docs/reviews/README.md` before the next run: a finding that keeps
reappearing is a finding that needs a guard, not a third mention.

## Operation disposition — 19 October 2026

`node scripts/measure.mjs op-types` reports **47** on `ebc32ae7c`;
`web-only-ops` reports **0**. The additional member is `agent.ceiling` in
`packages/core/src/ops.ts`, not a parser error or a redundant metadata edit.
The original design and implementation record are
[critique phase 2](../projects/critique/phases.md#phase-2--the-ceiling).

The operation persists a note-only restriction on one agent's enrolment on
one canvas. `packages/core/src/ceiling.ts` narrows the allowed writes and
`Engine.applyAndPersist` enforces it at the home, including forwarded writes.
A field on `agent.enroll` would be ignored by an older decoder; an unknown
operation is refused. Removing or folding this vocabulary to meet the old
count would lose that compatibility boundary. The operation cannot be
undone, and a critic cannot lift its own ceiling.

Existing proofs cover reducer custody (`packages/core/test/agents.test.ts`),
actual home and replica enforcement (`packages/api/test/ceiling.test.ts`),
and refusal/rollback when an old home cannot cap a critic
(`packages/modules/critique/test/cli.test.ts`). Both surfaces reach the same
operation through the critique module. No runtime or permission behavior is
changed by this disposition; the declared count catches the next new op at
48. The separate hotspot-size finding is not accepted by this answer.
