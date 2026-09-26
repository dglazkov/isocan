---
status: built
since: 2026-09-26
see: ui-refresh, evals
---
# The frame budget, measured again — and the instrument that lied

**26 September 2026**

The question: *does the canvas still feel fast, and where does the time go
now?* The last time anybody measured the frame budget was
[29 August](2026-08-29-performance.md), with a harness that lived and died in
one session. The nightly `performance` persona watches one number — the entry
chunk's bytes — because it is the only one measurable without a running
canvas. Everything below needed one.

**Answer, measured: pan was fine, and two ordinary things were not. When
somebody else dragged one item, every viewer's canvas ran at two frames a
second for as long as they dragged; and every step of a zoom re-rendered every
item on the canvas. Both were store subscriptions, both are fixed, and both are
now guarded by render counts. And the tool this repository used to see inside
its bundle had been reading the wrong field of every sourcemap segment for
eighteen days.**

## How it was measured

- **A frame census on a real canvas**, now kept as
  [`scripts/frames.mjs`](../../scripts/frames.mjs): a daemon on a throwaway
  home, 250 markdown notes and 40 comments seeded through `@isocan/api`,
  headless Chrome at **4x CPU throttle**, a rAF probe recording every
  inter-frame gap, and three gestures — **pan** (90 wheel events), **zoom** (60
  ctrl-wheel events, out and back) and **remote** (another client moving one
  item 60 times while this browser only watches). It reports the tail — p90,
  p99, frames over 32 ms — and **refuses** a gesture whose camera did not move.
- **Render counts**, from temporary counters in `ItemView` and the markdown
  renderer, in an isolated worktree build. A profile can say React is busy;
  only a count says which component, and why every one of them.
- **A sampling profile grouped by source file**, through the build's
  sourcemaps.
- **A reducer micro-benchmark** in Node: one `item.move` on canvases of 100,
  1,000 and 3,000 items.
- **Bundle attribution**, after fixing the attributor (below).

Every before/after figure is three runs of the whole census on clean builds
of `d6da4c36` (before) and `4dba76f7` (after), no counters.

## What was actually spending the time

| 250 notes, 4x CPU | before (3 runs) | after (3 runs) |
| --- | --- | --- |
| **remote** frame p50 | 500 / 517 / 517 ms | **50 / 50 / 50 ms** (33 with the roster fix, below) |
| remote, `ItemView` renders for 60 moves | 15,455 | **60** — the moved item |
| remote, markdown parses for 60 moves | 15,000 | ~0 |
| **zoom** frame p90 | 83 / 83 / 83 ms | **50 / 67 / 50 ms** |
| zoom, `ItemView` renders for a 30-step zoom | 7,500 | **1,250** — 250 × the 5 thresholds crossed |
| pan p99 | 16.8 ms | 16.8 ms — it was never the problem |

### Remote: three subscriptions to the whole canvas

Two hooks every `ItemView` calls — `useVotesHiddenOn` and `useRoundMarks`, for
the sprint's vote curtain — read `useCanvasStore((s) => s.canvas)`, and so did
every note's markdown renderer (to resolve links). The store hands out a new
canvas on every operation, so every operation re-rendered every item and
re-parsed every note. The answers were a boolean, a list of marks and — for
nearly every note — nothing at all; asking for exactly those is the fix. A note
subscribes to the canvas only once one of its links is a path to a file on it
(`markdownTargetOffCanvas`, split out of `markdownResource` so the rule has one
home).

Behind those, the same shape three more times: the `#` roster rebuilt its
candidates on every operation, so the Chat and every thread handed the
markdown renderer a new chip plugin and re-parsed every comment; the roster's
`referableNames` de-duplicated with `some()` inside a loop — 125,000
comparisons for 250 items, per call; and `moduleRounds` asked every module for
its rounds once per item per store change. Each is now kept per the thing it
is a function of.

### Zoom: one raw number, read by everything

Every item subscribed to `viewport.scale` and worked its chrome out in render.
What the scale drives splits in two: continuous values (the counter-scale, the
row's screen width, the room a name may run to, a mark's size) are now CSS
against the world's existing `--scale` and each item's `--w` / `--h`; the
decisions — six thresholds with core's hysteresis — are one selector packed
into bits, so an item re-renders when one of ITS decisions flips. Proved the
same by arithmetic (each CSS form held to its JS twin to nine places across
widths and zooms, in `chrome.test.ts`) and in a browser: chrome geometry of 24
varied items at ten zoom stops from ~2% to 800%, old build against new — 1,920
element states, **0 differences** at half-pixel resolution.

### Tried and rejected

**`will-change: transform` on `.world`**, to stop re-rasterising on zoom. Zoom
p99 went 116 → **383 ms** and pan began dropping frames: one layer holding a
canvas of 250 cards costs more to tile than to re-raster. Not shipped.

## The instrument that lied

`scripts/bundle-what.mjs` attributes the entry chunk's shipped bytes to their
sources through the sourcemap. It walked `sources` by each segment's
**fourth** field — the original column — instead of its **second**. Its
output had the shape of an answer: the right total, sensible percentages, a
modest "(unknown)". On 8 September it "corrected" the architecture review's
reading of the chunk — which had been right — and that correction stood for
eighteen days. Read with the right field:

| entry chunk, 729,760 bytes (239,020 gzipped) | the broken tool | actually |
| --- | --- | --- |
| `@isocan/web` | ~1 KB per file | **43.4%** — `ItemView` 27 KB, `CanvasViewport` 18 KB, `CanvasPage` 17.5 KB |
| `@isocan/core` | 52.6% | **29.3%** — `canvas-groups.ts` alone 46.6 KB |
| react-dom | 7.8% | **18.1%** |
| react-router | 2.4% | **5.2%** |

`test/bundle-what.test.ts` holds the field to a map built by hand; lesson 100.

## What the reducer costs per operation

One `item.move` through `applyOperation`, unthrottled: **0.027 ms** at 100
items, **0.21 ms** at 1,000, **1.28 ms** at 3,000 — and **65–82%** of it is
checks that walk the whole canvas after every operation: the group forest
(0.47 ms at 3,000), the design records (0.36 ms), and the reducer's own copy of
the items map (0.38 ms). Linear, and small at the sizes people use today.

## What is still not chased

- **Zoom's p99** (still ~150 ms) is the frames where every item crosses a
  threshold at once and remounts its content — and react-markdown re-parses on
  remount. A parse cache keyed on the text, below react-markdown, is the next
  step; it would also cheapen panning a canvas big enough that items leave the
  render window.
- **The browser's own work** — style, layout, raster — is now 39% of the
  remote and zoom samples. The moved item and the edge beacons' DOM are most of
  it.
- **`edgeradar.ts`** (8% of the remote op) recomputes every off-screen item's
  beacon on every operation.
- **During a running sprint**, `useSprint` hands every item a new state object
  per operation (`sprintState` is rebuilt per canvas), so the canvas-wide
  re-render returns for the length of a sprint.
- **The reducer's whole-canvas checks.** Making them incremental is sound for
  per-element rules (design records) and not for cross-item ones (the group
  forest), and it would change what happens to a canvas whose stored state a
  newer validator rejects. Linear and sub-millisecond below a thousand items.
- **Splitting the canvas page off the entry chunk.** `App.tsx` records why it
  is eager: almost every visit is a canvas, so the bytes would only move.
- **The design-partner family (~32 KB) and the sprint (~16 KB) in the entry**,
  reached through the reducer and `ItemView`. Worth a look, not a free cut.
