# performance — 2026-09-08

Run by `scripts/persona-run.mjs` at `cec25ce`. **Nothing was changed.**

| Goal | Target | Now | Verdict |
| --- | --- | --- | --- |
| the entry chunk a first visit downloads | at most 640000 | 699999 (was 600420 on 2026-09-02) | **MISSED** |
| bytes past the last size somebody agreed to | at most 0 | 3899 (was 0 on 2026-09-07) | **MISSED** |

## Findings

| Finding | Outcome |
| --- | --- |
| the entry chunk a first visit downloads is 699999, past 640000 | accepted — the entry budget remains outstanding; see the 11 September response below |
| bytes past the last size somebody agreed to is 3899, past 0 | accepted — the drift is real; keep the ceiling and jump guard unchanged |

`unanswered` until somebody writes `accepted` or `rejected`. **After 3 days
an unanswered row fails `npm test`** — the queue can fail, so a correct report
cannot be quietly ignored the way six nights of them were (#197).

---

Read `docs/reviews/README.md` before the next run: a finding that keeps
reappearing is a finding that needs a guard, not a third mention.


## Response — 11 September 2026

Accepted as outstanding performance debt while validating the Anatomy port.
The current production entry is about 658.2 kB, down from this run's 700.0 kB
but still over the 640 kB goal and 641.1 kB agreed ceiling. The earlier drop
does not make the remaining drift disappear. Anatomy keeps its parser,
workspace, cards and styles in lazy chunks; the host workspace boundary is
lazy too. Its registry and edge contribution still add entry bytes.

The existing `CEILING` and `JUMP` are unchanged. This response acknowledges
the repeated measurement; it does not claim the goal is met or move it to
make this branch pass. Further entry reduction remains a performance task.
