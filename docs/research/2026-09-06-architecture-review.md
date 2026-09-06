---
status: partial
since: 2026-09-06
issue: 185
see: ui-refresh, evals
note: step 0 done (the eight-PR queue drained) and step 1 partly (768,993 → 720,659, still over the 640,000 bound — the rest is shell code, not chunk boundaries); an outside architecture review checked against the tree — most of it holds, four items are wrong in ways that change the fix, and the finding it missed is that the nightly caught the bundle breach three nights running and every report is sitting in an unmerged PR
---

# The architecture review, checked against the tree

**6 September 2026.** A review arrived covering package boundaries, surface
isomorphism, documentation drift and code health, measured at `90fa030`. This
is that review verified item by item against `main` — what holds, what is
wrong, and what it did not look at.

Most of it holds. The parts that do not are worth writing down not because
the reviewer was careless but because each wrong item points at a **real
problem with a different shape**, and building the recommended fix would have
left the actual defect in place.

## What holds

Checked and confirmed: core's runtime dependencies are still exactly one
(`nanoid`); the vocabulary is still 33 operations; `packages/cli/src/main.ts`
is 11,818 lines and `packages/server/src/http.ts` 4,542; all six pages in
`App.tsx` are statically imported; `docs/architecture.md`'s "Distance to the
map" still lists the Share dialog and grant routes as unbuilt, which they have
not been since phase 14; and `test/roadmap.test.ts` really does kill its child
at 60s inside a test that allows 120s, so raising the child is exactly right.

Unused exports measure 49, not 47. A small thing, and the direction is the
same.

## The four that are wrong

### The bundle bound is 640,000, and the breach is worse than reported

The review gives the target as "< 600 KB" and the measurement as 765.4 KB. The
project's own bound is **640,000 bytes**, declared in
`.agents/personas/performance.md` with a baseline of 600,420 set 2 September.
Built from `main` and measured with the project's own instrument:

```
node scripts/measure.mjs bundle-bytes   →  768,993
```

**Twenty per cent over its bound**, against a target the review had wrong in
the safe direction. The bound is not arbitrary and its history matters: it was
tightened from 700,000 to 640,000 deliberately, and the note beside it says
why — a max-over-chunks bound "could be satisfied by splitting an eager chunk
in two and downloading exactly the same bytes. This one cannot." That sentence
decides part of the fix below.

### `formatBytes` has already drifted, which is a better argument than duplication

The review calls the two implementations identical. They are not:

| | units |
| --- | --- |
| `cli/src/output.ts:31` | `KB MB GB **TB**` |
| `web/src/components/TrashPanel.tsx:7` | `KB MB GB` |

A two-terabyte trash total prints `2.0 TB` in the terminal and `2048.0 GB` in
the browser. This is not a duplication that might drift one day; it is a fold
that drifted, sitting in the tree, in exactly the way rule 4 predicts. It also
hands the move its test: assert the terabyte, and the guard fails today.

### The MIME tables should NOT be consolidated

The review reads the web's five extensions as an incomplete copy of the CLI's
fourteen and proposes one canonical `mimeFor`. They answer different
questions, and collapsing them would be a regression dressed as tidying:

* `mimeFor(filename)` has **only an extension** to go on. The table is its
  whole knowledge.
* `mimeTypeOf(file: File)` already holds `file.type` from the browser and
  consults the table **only as a patch** — its own comment says so: "Browsers
  report empty/odd types for .md and .html." A browser gets `image/png` right;
  it gets `.md` wrong.

So the web's five are not a subset that fell behind. They are precisely the set
browsers get wrong, and the other nine would be dead weight. **The shared fact
is the table and the module-kinds lookup order, not the signature.** Move
those; leave two entry points.

`defaultSize` is a real duplication and the review is right about it:
`web/src/lib/upload.ts` repeats `480×360`, `480×270` and `420×320` verbatim
from `cli/src/mime.ts`.

### `cloud-desk.ts`: the comment is stale, the invariant is not

The review reports that `mutate()`, `touch()` and `killBadge()` now write
badges, breaking the file's "nothing writes a badge except `writeBadge`". The
count is right — five write sites, not one — and the conclusion is wrong.

**Four of the five pass through `denormalize()`**, and the fifth (`touch`)
merges only `lastSeen`, which is not one of the denormalized arrays. So the
invariant the comment exists to protect — that the arrays can never be
forgotten — still holds. What has changed is that `writeBadge` is no longer
where it lives.

This matters more than a stale sentence, because the comment ends by telling a
reviewer that their "whole job on this file is to confirm there is one writer".
Anyone doing that today concludes the file is broken, or adds a sixth writer by
a different path and believes it is fine. **Restate the invariant as what it
actually is — every badge write goes through `denormalize()` — and give it a
source guard**, so the next writer cannot skip it quietly.

## What the review did not look at, and it is the largest finding

The bundle did not go over unobserved. **The performance persona caught it
three nights running and wrote it down each time.**

| | entry chunk | verdict |
| --- | --- | --- |
| 2 Sep | 600,688 | held |
| 3 Sep | 648,435 | **MISSED** |
| 4 Sep | 650,621 | **MISSED** |
| 5 Sep | 753,610 | **MISSED** |
| 6 Sep (`main`) | 768,993 | 20% over |

Every one of those reports is in an **unmerged pull request**. Eight are open
— four persona runs and four grade runs, 2 through 5 September. The workflow
fires on its cron, completes, reports success, opens a PR, and stops. Nothing
downstream reads it.

The 5 September report closes with a line written for exactly this:

> a finding that keeps reappearing is a finding that needs a guard, not a
> third mention.

It is now the fourth mention.

**This is the sharper version of a pattern already recorded here.** The night
of 31 August found four instruments reporting healthy while broken, and the
lesson taken was that "an instrument is not believed until it has been shown
to fail". This one was not broken. It ran, it measured correctly, it used the
right word, and it changed nothing — because a report that lands in a PR
queue nobody drains is indistinguishable from a report never written.

A measurement is not a control. The bound is checked nightly and enforced
never: nothing fails on a push, so the number moved 600,688 → 768,993 in four
days across a dozen ordinary feature commits, each individually reasonable.

## The plan

Ordered by what unblocks the rest, not by size.

**0. Drain the eight nightly PRs.** ✅ **Done 6 Sep.** All eight merged — four
grade runs and four persona runs, 2 through 5 September. The queue is empty
for the first time since 1 September. Three of the persona branches needed a
rebase, because each rewrites the same `scripts/reviews.mjs`-generated block
in `docs/reviews/README.md`; regenerating it after each merge is the
resolution, and it is worth knowing that this conflict is structural and will
recur every time more than one night is drained at once.

**1. Get the entry chunk under 640,000.** ⚠️ **Partly done 6 Sep —
768,993 → 720,659, and the bound is still missed.** `LensPage`,
`CanvasListPage`, `NotHerePage`, the Share dialog and the history scrubber
are behind lazy boundaries; all five were already mounted conditionally, so
only the arrival of their bytes changed.

`FrontPage` and `TermsPage` were tried and put back. They are what a stranger
meets first, so deferring them costs a round trip to the one visitor
guaranteed to have nothing cached — and they are the two the door renders
outside the router, where `frontdoor.test.ts` reads them with
`renderToStaticMarkup`, which cannot resolve a lazy component. Twelve
kilobytes was not worth rewriting that guard to stream.

**Splitting is spent, and the remaining 80KB is not a chunk-boundary
problem.** Two measurements say so: removing all three build-time module web
halves saves 8KB, and what is left in the entry is `ItemView`,
`CanvasViewport`, `api.ts` and the stores — the canvas itself. Getting under
the bound honestly now means less shell code, which is a different and larger
piece of work than this step. Step 2 is what stops the next hundred kilobytes
arriving the same way.

The original recommendation, kept here because the reasoning still holds:
lazy-load the secondary pages — and **not `CanvasPage`**.
Splitting `CanvasPage` out would put the bound back inside its budget while
every canvas visitor downloaded the same bytes and one more round trip, which
is the precise move the bound was reshaped to make impossible. A metric
satisfied that way is worse than a metric breached honestly.

**2. Make the bound fail a push, not a report.** The nightly says MISSED; CI
says nothing. Until the number can redden a commit, step 1 is a one-time
cleanup rather than a floor.

**3. `formatBytes` to core**, with the terabyte as its test.

**4. `defaultSize` and the extension table to core**, keeping `mimeFor` and
`mimeTypeOf` as two entry points.

**5. Restate the cloud-desk invariant** as `denormalize()`, with a source
guard.

**6–8. The small true things.** `architecture.md`'s stale inventory; the
`roadmap.test.ts` child timeout; the 49 unused exports.

**9. The monoliths — and this page disagrees with the review.** `main.ts` at
11,818 lines is a real cost. A big-bang split is a large, risky diff with no
user-visible result, and it damages something this project actually relies on:
`git log -p` is the densest design documentation here, and a move-only
refactor of eleven thousand lines makes every one of those lines answer "moved
in the great split" to `git blame`. Split **opportunistically** instead — a
new command lands in its own module, and a family is extracted when somebody
is already editing it for another reason. The same for `http.ts`.

## Not verified

Stated here rather than implied: the review's test counts (3,539 across 346
files) and its parallel-load timeout observations were not reproduced. Both
need a full instrumented run under load, and this page did not do one. The
`roadmap.test.ts` finding above is from reading the file, not from watching it
time out.
