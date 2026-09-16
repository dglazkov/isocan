# architect — 2026-09-12

Run by `scripts/persona-run.mjs` at `4c9ad30`. **Nothing was changed.**

| Goal | Target | Now | Verdict |
| --- | --- | --- | --- |
| runtime dependencies of @isocan/core | at most 1 | 6 (was 1 on 2026-08-29) | **MISSED** |
| operations a person can send and an agent cannot | at most 0 | 0 | held |
| operations in the vocabulary | at most 33 | 33 | held |

## Findings

| Finding | Outcome |
| --- | --- |
| runtime dependencies of @isocan/core is 6, past 1 | accepted — the deps stay; the thing the bound protects is held at 1, and the instrument is measuring the package rather than the entry. Walked 2026-09-15: see the note below. |

`unanswered` until somebody writes `accepted` or `rejected`. **After 3 days
an unanswered row fails `npm test`** — the queue can fail, so a correct report
cannot be quietly ignored the way six nights of them were (#197).

## The answer, 15 September 2026

Answered three nights late, by which time the same question had been asked
again at 9 (`2026-09-15-architect.md`). Answering it needed a measurement
nobody had taken, so here it is.

**`core-runtime-deps` counts keys in `packages/core/package.json`. The bound's
stated reason is narrower: *"the reducer must stay portable."*** Those were the
same number until core grew side entries, and they have not been the same
number since.

Walking the real runtime import graph from `packages/core/src/index.ts` — 133
modules, following only imports that survive compilation, since `import type`
and `export type` erase and cost a consumer nothing:

```
declared in package.json : 9  (nanoid, unified, remark-parse, remark-gfm,
                               remark-breaks, remark-rehype, css-tree,
                               parse5, entities)
reached from index.ts    : 1  (nanoid)
side-entry only          : 8
```

The eight split cleanly by the entry that pulls them, and `package.json`
already declares each one:

| Entry | Deps | Who imports them |
| --- | --- | --- |
| `.` — the reducer | `nanoid` | `ids.ts` |
| `./markdown` | `unified`, `remark-parse`, `remark-gfm`, `remark-breaks`, `remark-rehype` | `markdown-text.ts` |
| `./design-audit` | `css-tree`, `parse5`, `entities` | `designaudit.ts`, `design-contract-rules.ts` |

`index.ts:70` reaches `designaudit.ts`, and only through `export type` — a
type-only re-export of `ScreenAudit` and friends, which is erased.

**So the reducer is as portable as the day the bound was set, and the number
that says otherwise is measuring a different thing.** Somebody importing
`@isocan/core` to run the reducer installs nine packages and loads one.

**What this does NOT license.** Nine declared dependencies is still nine
things to audit, update and trust, and a reducer one careless `import` away
from the remark stack is not the same as one that cannot reach it. The bound
stays at **1**, because the day the closure goes to 2 is the day somebody
should have to argue for it.

**The thing that wants fixing is the instrument, and it is left for Dion.**
Measuring the closure instead of the manifest would make this bound say what
it means — and changing an instrument so a red number goes green is the move
that deserves the most suspicion, even when the argument is good. It changes
every past reading and every future one, so it is not a thing to do inside a
turn that was about something else. Recorded here, not done.

---

Read `docs/reviews/README.md` before the next run: a finding that keeps
reappearing is a finding that needs a guard, not a third mention.
