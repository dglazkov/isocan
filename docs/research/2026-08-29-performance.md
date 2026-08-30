---
status: built
since: 2026-08-29
---
# Where the canvas is janky

**29 August 2026**

The question: *where does moving around this canvas cost more than it should,
and what is actually spending the time?*

**Answer, measured: panning and zooming both re-parsed Markdown, sixty times a
second, for text that had not changed.** Nearly half the CPU of a pan was
inside a Markdown tokenizer. Three `memo` calls and one `useMemo` fixed it, and
the fix is measured rather than argued:

| | pan p90 | pan frames > 32ms | zoom p90 | zoom frames > 32ms | script |
| --- | --- | --- | --- | --- | --- |
| **Before** | 33.2–33.7 ms | 21–24 of ~140 | 25.1–26.3 ms | 2–9 of 134 | 2.82–2.96 s |
| **After** | 9.0–9.2 ms | **0 of ~205** | 9.0–9.2 ms | **0–1 of 173** | 1.20–1.28 s |

Three runs each, same canvas (41 rendered items), headless Chrome at **4×
CPU throttle** — this laptop is not the machine the app is felt on, and at full
tilt an M-series hides everything short of a catastrophe.

---

## How it was measured

Two instruments, both driving a real browser over the devtools protocol
against a real daemon and a real canvas:

- **A frame census.** A rAF probe records every inter-frame gap through a
  scripted pan and zoom, and reports the **long-frame tail** — p90, p99, worst,
  and the count over 32 ms. Not an average: an average of 9 ms with one frame
  in seven at 33 ms reads as smooth and feels like stutter.
- **A sampling profile**, mapped back through the sourcemap and **grouped by
  source file**. A parser's work is spread over a dozen tiny functions and
  reads as noise in a top-N function list; grouped, it is the headline.

**The probe refuses to measure a page that is not the app.** It checks that
items rendered and reports a refusal otherwise. That guard fired three times —
the wrong URL shape, a name already claimed, and wheel events dispatched at
`document.body` where nothing listens — and each time the alternative was a
flawless 8 ms median from a page with nothing on it. Every one of those would
have looked like a result.

---

## What was actually spending the time

### Pan: 47% of samples in micromark

`CanvasViewport` subscribes to the whole viewport object, so it re-renders on
every pan frame. `ItemView` was not memoised, so all 41 items re-rendered with
it — and every Markdown item re-parsed its document from scratch. Grouped by
file, during a scripted pan:

```
lib/create-tokenizer.js            21.7%
lib/index.js                       11.0%
lib/syntax.js                       4.4%
initialize/text.js                  2.5%
micromark-util-chunked              2.1%
micromark-util-combine-extensions   1.8%
micromark-util-subtokenize          1.6%
micromark-util-character            1.2%
                                   ─────
                              about 47%   (with the smaller frames below)
react-dom                           7.3%
getBoundingClientRect               3.1%
idle                                7.6%
```

**Nearly half the cost of moving the canvas was parsing text nobody had
touched.** `memo(ItemView)` removed it: pan p90 33.4 → 9.9 ms, frames over
32 ms 21 → 0, and idle in the profile went 7.6% → 53.9%.

### Zoom: the same parser, a different component, and two wrong guesses

Zoom cannot be fixed the same way, and the reason is legitimate: `ItemView`
reads `viewport.scale` for counter-scaled labels, legibility and the title row.
Every item genuinely must re-render when the zoom changes.

**First wrong guess.** Memoising `ItemView` alone made zoom's worst frame
*worse* — 34 ms → 58 ms, consistently across three runs each way. The work pan
used to spread across frames now arrived all at once at the first scale change.
A p90 hid that entirely; the worst frame is what showed it.

**Second wrong guess.** So memoise the Markdown body, since text does not
depend on zoom. It changed nothing, and instrumenting the components said why:
during a zoom, `MarkdownView` rendered **0 times** and `CommentLayer`'s
Markdown **0 times** — while the tokenizer was still 28% of samples. Both
memos were working perfectly and neither was the culprit.

**What it was:** `DesignSystemView`, which called `parseDesign(load.text)` in
its render body and rendered a `ReactMarkdown` per section. It sits inside
`ItemView`, so every zoom frame re-parsed every DESIGN.md on the canvas and
re-rendered all of its sections. `src/designmd.ts` had been sitting in the
profile at 1.5% the whole time, which is what a clue looks like before you know
what it is.

`memo` on the component plus `useMemo` on the parse: zoom p90 25.1 → 9.1 ms,
frames over 32 ms 2–9 → 0–1.

---

## The unexplained 14%, explained — by counting renders

The note above used to end here, saying `getBoundingClientRect` was 14.3% of
zoom samples and had not been chased. It has been, by asking a question the
profile could not answer: **which components re-render, and how often.** A
temporary counter in all 103 components, through the same scripted pan and zoom:

| | pan (60 wheel events) | zoom (60 events) |
| --- | --- | --- |
| `ItemView` | **0** — the memo holds | 1342 — scale changed, so it must |
| every screen-space layer | 60 — once each | 60 |
| **`LaneTethers`** | **120 — twice per frame** | **120** |
| idle, 2.5s | `CursorLayer` ×1 (the 5s "quiet Ns" tick) | — |

One component rendered twice per frame, and it was the one holding the missing
14%. `LaneTethers` draws the dashed line from a message to the thing it made,
and it did two things on every viewport change:

- **`setLines([])` with a fresh array** while suppressed. `Object.is` sees two
  different arrays, so React never bails — a pan re-rendered it sixty times to
  set empty state that was already empty.
- **`getBoundingClientRect` on every chip**, in an effect keyed on `viewport`.
  That is the forced layout, and it was measuring something that had not moved:
  **a chip lives in the panel and does not move when the canvas pans.**

The fix is a split by what actually changes each part. Anchors are read from
the DOM only when the messages or the scroll move them; the lines are a
`useMemo` over those anchors and the viewport — pure arithmetic, no layout, no
state, and therefore no second render.

| | pan p90 | pan >32ms | zoom p90 | zoom worst | script |
| --- | --- | --- | --- | --- | --- |
| Before everything | 33.2–33.7 ms | 21–24 of ~140 | 25.1–26.3 ms | 33.4 ms | 2.82–2.96 s |
| After the memos | 9.0–9.2 ms | 0 | 9.0–9.2 ms | 9.3–33.5 ms | 1.20–1.28 s |
| **After the tether split** | **9.6–9.9 ms** | **0 of ~200** | **9.6–9.9 ms** | **10.4–17 ms** | **1.11–1.15 s** |

`getBoundingClientRect` no longer appears in the zoom profile at all.

**The lesson is the method, not the fix.** Two hypotheses about zoom were wrong
earlier in this note, and both were settled by counting renders rather than by
reading the component tree. The third finding came the same way: the profile
said *a forced layout is happening*, and only a render count could say *which
component, and why twice*.

### What is still not chased

`ItemView` re-renders 1342 times during a zoom and drags `VersionContent`
(1320), `KindIcon` (1192) and `Reactions` (792) with it. Most is legitimate —
`viewport.scale` really does change the counter-scaled chrome — but the
children whose props do not depend on scale are re-rendering for nothing.
**Left alone deliberately**: zoom already meets the frame budget with no frame
over 32 ms, and memoising four more components to move a number that is
already inside its bound is how a codebase acquires complexity it cannot
justify. Recorded here so the next person starts from the count instead of the
guess.

---

## Two things found by reading, not measuring

Neither is on the pan/zoom path, so neither is quantified here. Both are
recorded because they are the same shape as bugs already fixed once.

**Remote cursors are positioned with `left`/`top`; your own uses `transform`
with `will-change`.** The same picture, drawn two ways, and the slow one is the
one that can have many instances — every frame of every remote cursor's motion
is a layout rather than a compositor move. The comment above `.own-cursor` even
says "drawn like everyone else's", which is exactly what it is not.
`CursorLayer` also calls `force(n => n + 1)` on every frame while any cursor is
moving, which re-renders the whole layer — the same shape as the janky rail pan
already fixed by replacing a rAF loop with a CSS transition.

**`VersionFanOut` gates its mount on `requestAnimationFrame`.** `Minimap` has a
comment explaining why it deliberately uses `setTimeout` instead — rAF never
fires in a hidden tab, so anything gated on it never appears. The fan-out is
opened by a click, so a hidden tab is unlikely rather than impossible; the
inconsistency is worth closing while the lesson is written down three feet away.

---

## The shape worth keeping

Three times in this session a measurement looked clean because it was measuring
nothing — and every one was caught by an instrument that refused rather than
reported. That is the same lesson the graders learned this week, arriving from
a third direction.

And twice the obvious fix was wrong. Both times the thing that settled it was
**counting renders** rather than reasoning about which component ought to be
re-rendering. Two `window.__x = (window.__x ?? 0) + 1` probes answered in one
run what an hour of reading the component tree had not.
