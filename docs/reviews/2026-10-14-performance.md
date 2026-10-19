# performance — 2026-10-14

Run by `scripts/persona-run.mjs` at `6df0920`. **Nothing was changed.**

| Goal | Target | Now | Verdict |
| --- | --- | --- | --- |
| the entry chunk a first visit downloads | at most 747000 | 710246 (was 600420 on 2026-09-02) | held |
| bytes past the last size somebody agreed to | at most 0 of 706300 | 3946 (was 0 on 2026-09-07) | **MISSED** |
| main-thread time the costliest living ground adds to a frame, CPU throttled 4x | at most 2ms | 1.5ms | held |

## Findings

| Finding | Outcome |
| --- | --- |
| bytes past the last size somebody agreed to is 3946, past 0 of 706300 | accepted — the historical measurement is correct. The existing 15 October decision in `scripts/bundle-ceiling.mjs` (`3c5e65a85`) accounts for the intervening core/canvas features and moves the baseline to 734,500. This answers the old 706,300-baseline finding only; it does not accept later growth. See the verification below. |

`unanswered` until somebody writes `accepted` or `rejected`. **After 3 days
an unanswered row fails `npm test`** — the queue can fail, so a correct report
cannot be quietly ignored the way six nights of them were (#197).

---

Read `docs/reviews/README.md` before the next run: a finding that keeps
reappearing is a finding that needs a guard, not a third mention.

## Verification — 19 October 2026

Checked current main at `ebc32ae7c`, using Node 24.20.0 and the locked
dependencies. A fresh `npm run build` and `node scripts/measure.mjs
bundle-bytes` reproduce **743,979 bytes**; `bundle-over-ceiling` reports
**9,479** against the existing 734,500 baseline. The 15 October change
recorded 729,497 bytes plus 5,000 bytes of headroom, including named fidelity
faces and the other core/canvas additions listed beside `CEILING`. It already
replaced the baseline this historical report measured. No size limit is
changed by this answer.

The [18 October finding](2026-10-18-performance.md) is a different question
against 734,500 and remains unanswered. Neither that growth nor a new
baseline is approved here. The 20,000-byte hard jump guard and the three-day
review gate remain in force.
