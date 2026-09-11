---
status: partial
since: 2026-09-11
issue: 185
see: ui-refresh, evals
note: an outside architecture review checked against the tree — most of it holds, four items are wrong in ways that change the fix, and the finding it missed was the nightly catching the bundle breach three nights running into unmerged PRs. Steps 0 and 2–8 done, step 9 decided against (no big-bang split). Step 1 is the one that will not stay done — the entry chunk went 768,993 → 635,728 by 8 Sep, under the 640,000 goal for the first time, and has crept back over it with features since (646,899 on 11 Sep); the ceiling moved with a reason 11 Sep
---

# The architecture review, checked against the tree

**6 September 2026.** A review arrived covering package boundaries, surface
isomorphism, documentation drift and code health, measured at `90fa030`. This
is that review verified item by item against `main` — what holds, what is
wrong, and what it did not look at.

**Where this stands, 11 Sep 2026.** Steps 0 and 2–8 are done and step 9 was
decided against. Step 1's numbers below are history: the entry chunk reached
**635,728 on 8 Sep**, under the 640,000 goal for the first time, and has
crept back over it one agreed feature at a time — **646,899 on 11 Sep**
(`docs/reviews/2026-09-11-performance.md`), over the goal, with the ceiling in
`scripts/bundle-ceiling.mjs` moved with a reason 11 Sep. The ratchet is doing
what step 2 built it to do; the goal is what is missed.

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
not been since phase 14; and `test/roadmap.test.ts` really did kill its child
at 60s inside a test that allows 120s — though the fix turned out to be
removing the reason it took a minute, not raising the minute (step 7).

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
768,993 → 720,659, and the bound is still missed.** (722,753 as measured on
the 6th after the day's other merges; step 2 now holds that line.) `LensPage`,
`CanvasListPage`, `NotHerePage`, the Share dialog and the history scrubber
are behind lazy boundaries; all five were already mounted conditionally, so
only the arrival of their bytes changed.

`FrontPage` and `TermsPage` were tried and put back. They are what a stranger
meets first, so deferring them costs a round trip to the one visitor
guaranteed to have nothing cached — and they are the two the door renders
outside the router, where `frontdoor.test.ts` reads them with
`renderToStaticMarkup`, which cannot resolve a lazy component. Twelve
kilobytes was not worth rewriting that guard to stream.

> **Corrected 8 September 2026. The paragraph below was wrong, and it was
> wrong because nothing could see inside the chunk.** `scripts/bundle-what.mjs`
> builds with sourcemaps and attributes generated bytes to their source: the
> entry chunk was **51.5% `@isocan/core`**, and `ItemView`, `CanvasViewport`,
> `api.ts` and the stores were **together under two per cent** of it —
> `api.ts` is 574 bytes, `uiStore.ts` is 526. Core was pinned there by one
> namespace import in `web/lib/runtimeModules.ts`, publishing the host object
> runtime modules read: `import * as core` asks for every export, so nothing
> could be dropped and `recap.ts`, `evals.ts` and `deckexport.ts` — which this
> app never calls — shipped to every first visit. Fetched inside the guard
> that already returns early when no manifest carries a web half, the entry
> went **699,999 → 635,728**, under the 640,000 bound for the first time.
>
> The inference below was reasonable from what imports what. It was not a
> measurement, and **a bound nobody can look behind is a bound nobody can act
> on** — which is why this number stayed red for six days while everybody
> agreed about what was in it.

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

**2. Make the bound fail a push, not a report.** ✅ **Done 6 Sep.** The nightly
said MISSED; CI said nothing. `test/bundle-budget.test.ts` now measures the
entry chunk in the ordinary suite — so it runs on every pull request, now that
`pr.yml` exists.

**It is a ratchet, not the bound**, and that is deliberate: the chunk is
722,753 today against a goal of 640,000, so asserting the goal would redden
main from the moment it landed, which is a red trunk rather than a guard.
The assertion is "no bigger than the last number somebody agreed to", and the
distance to the goal is printed on every run. Raising the ceiling is one line
in a diff with a reason beside it; what cannot happen again is a hundred
kilobytes arriving as a hundred unremarked commits.

**It measures the build and never makes one**, and that took two goes. The
first version built when `dist` was stale — because the trap bit immediately:
this machine's `dist` predated step 1 and measured 768,812 for a tree whose
real answer was 722,753. But building from inside a parallel suite is worse
than the problem: four other test files read `packages/web/dist`, and the
racing build made this test report **1,093,766** for a tree that actually
produces 725,291 — fifty per cent wrong, in the alarming direction, which is
how a guard teaches people to ignore it. So a missing or stale build is a loud
SKIP naming the command, and `ISOCAN_REQUIRE_BUNDLE=1` (which both workflows
set) turns that skip into a failure — the `ISOCAN_REQUIRE_EMULATOR` shape,
for the same reason.

**3. `formatBytes` to core**, with the terabyte as its test. ✅ **Done 6 Sep.**
`core/bytes.ts`, beside `elapsed.ts` and not in `format.ts` — that file is the
canvas tidy, and a size is not a layout. The CLI re-exports it from
`output.ts` so `main.ts`'s import list is untouched; the web imports it
directly and its shorter unit list is gone. The test leads with the terabyte,
which is the case that was wrong, and a guard names the two files that used
to hold a copy each so a re-introduction is caught where it happened.

**4. `defaultSize` and the extension table to core**, keeping `mimeFor` and
`mimeTypeOf` as two entry points. ✅ **Done 6 Sep.** `core/media.ts` holds the
fourteen-row table, the lookup ORDER (a loaded module's extensions first, then
the table — two copies of that is how one surface keeps calling a file a
diagram after the other has stopped), and `defaultSize`, which was three number
pairs written out twice.

`mimeFromName` answers `undefined` rather than a default, which is what lets
the two entry points stay two: the CLI has nothing else to go on and falls back
to `application/octet-stream`; the browser still has `file.type` and reaches
the table only as a patch. The web now sees all fourteen rows rather than the
five browsers get wrong, and that is not the dead weight it looks like — the
table is consulted only when `file.type` was empty or `octet-stream`, so extra
rows can only improve an answer the browser declined to give and can never
override one it did. It costs **276 bytes in the entry chunk**, measured, which
is what "the other nine would be dead weight" turns out to weigh. `media.test.ts` names the three files that held a copy, so
a re-introduction is caught where it happened.

**5. Restate the cloud-desk invariant** as `denormalize()`, with a source
guard. ✅ **Done 6 Sep.** The comment says what is true — every write of a
badge document passes its record through `denormalize()`, four write sites
sharing one derivation — and says out loud that it used to claim one writer,
so the next reader knows the sentence changed rather than the code.

The guard is `cloud-desk-writers.test.ts`, and deliberately **not** in
`cloud-desk-arrays.test.ts`, which needs a Firestore emulator and therefore
does not run on most machines or most pull requests. A guard that catches a
fifth writer has to run where the fifth writer is written. It reads the source,
resolves each `.set(` to the collection it targets — chained, `tx.set(ref, …)`
and plain receiver, all three — and requires `denormalize` on every badge
write, with `touch`'s `lastSeen` merge as the one named exception. Anything it
cannot classify comes back as **unresolved and fails**, rather than as "not a
badge write": the first version silently missed the chained
`collection(BADGES).doc(id).set(…)` entirely, which is a guard reporting green
about code it never looked at. Three mutations killed, including aliasing the
ref to a new name to dodge it.

**6–8. The small true things.** `architecture.md`'s stale inventory; the
`roadmap.test.ts` child timeout; the 49 unused exports.

**6 — the inventory, and why a list of ABSENCES rots quietly.** ✅ **Done
6 Sep.** "Distance to the map" said the Share dialog and the grant routes were
unbuilt for the three weeks after phase 14 built them (the dispatch path on the
same line is built too; `registrations/{id}` really is not, and now stands
alone). An absence is the one kind of claim that goes stale without anything
failing — the shape the roadmap exists to end for a document's status, one
level along.

So the section says how each bullet would be checked, and
`test/architecture.test.ts` checks the two that can be: no client mentions
`MAX_DIRECT_UPLOAD_BYTES`, and nothing queues blob bytes offline. Build either
and the suite asks for the doc in the same commit. The others carry their
reasoning instead, because "queueing bytes is a second durable store" is a
design position and not a grep. Both guards mutation-tested.

**8 — and the review undersold this one.** ✅ **Enforced 6 Sep.** It reported
"49 unused exports, not 47" — a small thing, same direction. The finding is in
`.agents/personas/reviewer.md`, which has said **`at most: 0`** since 2
September with the reasoning beside it: *"a ratchet set above its floor is
slack nobody decided to leave. The next one fails on the commit that adds it,
which is the whole point."*

Four days later it was **56**. The ratchet was at its floor, the principle was
written down, and fifty-six arrived anyway — because only the nightly read the
number, and a nightly report is not a commit failing. **That is step 2's
finding on a second metric**, which is what makes it a pattern rather than an
incident: a bound nothing enforces is a comment.

`test/unused-exports.test.ts` measures it in the ordinary suite, through the
same `scripts/measure.mjs` the persona declares. 56 → 39 by un-exporting every
server and web `lib/` name on the list, where nothing outside this repository
could have imported them, with the compiler as the check. **The 39 that remain
are all in `packages/core/src`** — and core is what a runtime module is handed
at load, so deleting from it is a decision about what `@isocan/core` promises a
module author, not a tidy-up. `ModuleEdge`, `ModuleActionFacts` and the DTCG
token types look exactly like surface somebody would build against. That
decision wants a person and is left as one; the drift is not.
`measure.mjs unused-exports --names` prints them.

**7 did not need its fix — it needed its cause removed.** ✅ **Done 6 Sep.**
The review is right that the child was killed at 60s inside a test allowing
120s, and raising the child would have made the test pass. But the question
raising it does not ask is *why a script that reads front matter out of 62
markdown files needs a minute*. It was spawning the whole CLI once per
document: `isocan --json doc status <file>`, and every spawn registers tsx and
transpiles `main.ts`'s 11,818 lines plus core, api and server before it reads
a single `---`. Measured: 571ms a spawn, 62 documents, ~35 seconds — the
slowest file in the suite by an order of magnitude, paid on every run.

`scripts/roadmap.mjs` now registers tsx once and imports `docStatus` directly.
**0.42s for the whole script**, and the test file went 35s → 1.8s. The "one
reader" invariant is untouched, because the reader was never the CLI — it was
`docStatus`, reached through eleven thousand lines of command definitions that
have nothing to do with front matter.

The guard moved with it, and this is the part worth keeping: it used to assert
`doc", "status"` appeared in the script — the *mechanism*, which made the 62
spawns a thing the suite required. It now asserts the invariant (core is the
one reader, no second parser here) and adds what the textual check cannot say:
that the roadmap and `isocan doc status` **agree about a document**, through
one spawn rather than 62.

**9. The monoliths — and this page disagrees with the review.** `main.ts` at
11,818 lines is a real cost. A big-bang split is a large, risky diff with no
user-visible result, and it damages something this project actually relies on:
`git log -p` is the densest design documentation here, and a move-only
refactor of eleven thousand lines makes every one of those lines answer "moved
in the great split" to `git blame`. Split **opportunistically** instead — a
new command lands in its own module, and a family is extracted when somebody
is already editing it for another reason. The same for `http.ts`.

**✅ Decided 6 Sep: no split.** Dion, asked directly: *"let's not refactor for
the sake of it now."* So this is settled rather than deferred, and the reason
is worth keeping because the numbers will grow and somebody will propose it
again.

The cost of the monolith is real and is paid by readers. The cost of the split
is paid once, by everybody, forever: eleven thousand lines whose `git blame`
answers "the great split" instead of naming the commit that made the decision.
In a repository where the commit message carries the REASONING — where the
answer to "why is this shaped like this" is routinely in the log and nowhere
else — that trade is worse than it looks on a file-size chart.

What would change the answer: a split that follows a real seam somebody found
while working, not one drawn to make a number smaller. `packages/cli/src/
main.ts` gaining `commands/sprint.ts` because sprint was being edited anyway
is the shape this should take, one family at a time, each with its own reason
in its own commit.

## 9 September follow-up: the checks and the writer queue

The checkout at `ca307057` passed type checking and lint but failed three
suite checks: unused exports 40 against 39, undocumented exports 333 against
331, and the review index. The export delta was in `peekplace.ts`: its
side-selection threshold is private to the helper, and its exported result
and function needed their purpose stated. No ceiling needed raising.

The index failure was **time-dependent**, not a missing run: the generated
cadence table committed `0d ago`, and the same tree checked after midnight UTC
wanted `1d ago`. Static dates now stay in the index; the live cadence command
still reports ages. A subprocess check with its clock advanced to 2040 holds
that distinction. Regenerating the index alone would have fixed one day.

The journeys workflow also discarded the runner's exit status and looked
only for `FAIL` in stdout. A boot or teardown exception before the report
could produce `failing=no`. The workflow now preserves the exit code in the
report and treats either a nonzero exit or a `FAIL` line as needing attention.
Six executing cases drive the workflow's own shell with a synthetic runner,
including boot and teardown exceptions. The nightly remains advisory.

**Queue coupling, measured at the engine seam.** Start an isolated daemon,
claim a synthetic actor, and create `prj_local`. Install a `HomeDirectory`
whose `for("prj_remote")` returns a controlled connection and whose local
lookup returns null. Hold the connection's `submitOp` promise, submit a remote
`project.update`, wait until it reaches the connection, then submit a local
`project.update`. During a 251 ms hold the local write remained pending while
`getSnapshot("prj_local")` completed. Rejecting the held remote request let
the local write finish at 272 ms elapsed. The rejection also confirms that
the queue recovers rather than remaining poisoned. These are observations
from one controlled run, not latency benchmarks or a real network outage.

The mechanism is direct: `Engine.submit` holds the one promise chain through
`forwardSubmit`, including its network await. `HomeLink.fetchHome` bounds the
fetch with a 30-second abort signal. `setActorMark` also awaits forwarding to
all homes inside the same chain, so canvas submissions are not the only path.

**A queue change is still unbuilt.** The next experiment should isolate
per-canvas work while retaining an explicit boundary for home-wide identity
changes. It must account for:

- `settled()` at replica dial: it prevents a cursor read between a forwarded
  birth and its local persistence. Moving network waits outside the chain
  without replacing this barrier reopens a documented snapshot race.
- Same-canvas submit, undo/redo, remote-entry application, snapshot adoption,
  blob registration and GC: each must keep its ordering and exclusion rules.
- Claims and identity updates that span canvases or homes: a per-canvas map
  alone does not serialize these against authorization checks.
- Re-homing and birth routing: deciding a destination and forwarding must
  not allow a routing change to strand an in-flight write at the old home.

Acceptance should use controllable promises rather than a timing benchmark:
an independent local write completes before the remote gate opens; two writes
to the same canvas keep order; failure releases subsequent work; and dial,
GC, undo and identity races still pass. No operation or client protocol change
is implied by this investigation.

## Not verified in the original 6 September review

Stated here rather than implied: the review's test counts (3,539 across 346
files) and its parallel-load timeout observations were not reproduced. Both
need a full instrumented run under load, and this page did not do one. The
`roadmap.test.ts` finding above is from reading the file, not from watching it
time out.
