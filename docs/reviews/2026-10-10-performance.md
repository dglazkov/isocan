# performance — 2026-10-10

Run by `scripts/persona-run.mjs` at `50d8a8152`. **Nothing was changed.**

| Goal | Target | Now | Verdict |
| --- | --- | --- | --- |
| the entry chunk a first visit downloads | at most 747000 | 706269 (was 600420 on 2026-09-02) | held |
| bytes past the last size somebody agreed to | at most 0 of 706300 | 0 | held |
| main-thread time the costliest living ground adds to a frame, CPU throttled 4x | at most 2ms | 1.5ms | held |

## The living grounds, first reading

The third goal is new today (living grounds phase 5), and this is the first
page with its number. It is a reading, not a scan: taken by
`node scripts/frames.mjs --grounds --record scripts/ground-frames.json` and
read back by the goal's command.

**Taken on an Apple M4 Pro (48 GB, macOS arm64), not the M1 the budget in
`docs/projects/living-grounds/design.md` names.** Headless Chrome 154, GL
through ANGLE on Metal on that GPU, a 2560×1440 page at 1x, CPU throttled 4x
(the GPU is not throttled), six notes on a scratch canvas on a scratch daemon.
Each ground: three walks of 180 pointer moves, about 1,050 frames.

| Ground | p50 ms | p95 ms | worst ms | dropped | main thread ms/frame | added over plain | frames drawn asleep | asleep after |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| plain (no living ground) | 16.7 | 16.8 | 16.8 | 0 | 2.16 | — | — | — |
| meadow | 16.7 | 16.7 | 16.8 | 0 | 2.38 | 0.2 | 0 | 1.6 s |
| night | 16.7 | 16.8 | 16.8 | 0 | 3.62 | **1.5** | 0 | 1.6 s |
| galaxy | 16.7 | 16.7 | 16.8 | 0 | 2.36 | 0.2 | 0 | 15.8 s (its eddy window) |
| snow | 16.7 | 16.7 | 16.8 | 0 | 2.35 | 0.2 | 0 | 2.2 s |
| aurora | 16.7 | 16.7 | 16.8 | 0 | 3.21 | 1.0 | 0 | 2.6 s |
| pond | 16.7 | 16.7 | 16.8 | 0 | 2.44 | 0.3 | 0 | 2.6 s |
| zen | 16.7 | 16.7 | 16.8 | 0 | 2.36 | 0.2 | 0 | 1.6 s |

What it says: on this machine no ground drops a frame at 4x CPU, and every
one draws nothing while nothing moves, before and after each walk. The frame
gap is therefore flat and is not the number; the main thread's time per frame
is, and it separates the grounds. Night and Aurora are the two that write to
the page as well as to the GPU (a glow on nearby cards). Three earlier runs
the same evening read Night at +1.5 to +1.6.

What it does not say: GPU time per frame (the instrument cannot bracket
another program's draw calls; the bench's figures stand), anything about an
M1, or anything about Calm or Still.

## Findings

| Finding | Outcome |
| --- | --- |
| — | — |

`unanswered` until somebody writes `accepted` or `rejected`. **After 3 days
an unanswered row fails `npm test`** — the queue can fail, so a correct report
cannot be quietly ignored the way six nights of them were (#197).

---

Read `docs/reviews/README.md` before the next run: a finding that keeps
reappearing is a finding that needs a guard, not a third mention.
