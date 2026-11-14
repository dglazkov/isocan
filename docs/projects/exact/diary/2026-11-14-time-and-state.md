# 2026-11-14 — time and state (isocan exact phase 4)

A canvas (isocan) films an interaction on Exact's virtual clock with
`screenshot <file>.apng over 600 every 16` after `tap add-to-cart`, reads
`state` (and `layout cart-sheet`) between `clock +16` steps on a second cold
driver, splits the APNG into frames in the browser to scrub it, and shows an
inspector panel from a cold `tree --ax`, `layout`, `perf`, `logs`.
The fixture grew a cart sheet whose entrance is
`transition="translate -exact-spring(300, 22, 1)"` on an always-mounted
sheet whose `translate` moves from `0px 360px` to `0px 0px`.

## Rough
- Every `web-build` / `agent web` prints "style row transition skipped by
  the web host: spring transitions are lowered to keyframes" — the spring
  plays, but the line reads as if it were dropped.
- State per frame needs a second cold driver: the clock only moves forward,
  so a film cannot be followed by reading the state at its frames.
- `clock +N` answers only `{clock}`; a spring's progress is visible only
  through `layout <testId>` (`style.translate.computed`).
- The same spring with (170, 12, 1) was still ~10 px off at 600 ms; picking
  numbers that settle inside a film took a measurement.

## Lean in
- Two cold films of 38 frames are byte-identical (sha256 equal), with each
  frame also kept beside the APNG — the virtual clock really owns motion.
- The APNG is whole frames (fcTL at 0,0, blend source), so it splits into
  stills with no decoding.
- `tree --ax` is identical across cold runs (deep-equal JSON), so a canvas
  panel can be checked against what an agent prints.

## Needed
- a film reply that carries each frame's `state` (by hand: second driver)
- a resident session a tool can hold (still; each inspection is ~2 s cold)
- a quieter spring note in web builds (by hand: ignore the warning)

## Checkpoints
- film of 600 ms every 16 ms on the web: ~6.6 s, state for 38 frames ~2.7 s
- inspector facts (tree --ax, layout, perf, logs) for one web screen: ~2 s
- the sheet's translate: 360 px → overshoot −27 px at 240 ms → 0.4 px at 592 ms
