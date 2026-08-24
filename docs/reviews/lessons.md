# Lessons

Failure modes this codebase has actually produced, and what now catches each
one. Not a style guide and not a wish list — every entry happened, and the
"guard" column is the thing that would have caught it.

The point is the pattern, not the incident. A bug that can only happen once is
not a lesson; a bug whose *shape* recurs is, and three of these have already
recurred.

## The guards that exist

| # | The shape of it | What it cost | Guard |
| --- | --- | --- | --- |
| 1 | **A search-and-replace drops a selector's scope.** Replacing `X {` matches `X` in its scoped forms too, leaving the tail behind as a bare rule that now applies to everything. | Twice. First mangled `.project-editor`; then `.face.away .face-mark` lost its scope and dimmed *every* face, so a canvas full of live people rendered as a canvas where nobody came (`0e51081` → `8cafca5`). | `packages/web/test/oneblock.test.ts` — one canonical block per class, and nothing dims a `.face-mark` outside `.away`. |
| 2 | **A nullable interpolated into a template string becomes the word "null".** | `PresenceSession.label` is a display override, absent unless somebody passes `--label`, so the canvas said **"null is working"** over an item — for every agent that ever ran `isocan session start`. | `packages/web/test/presence.test.ts` — the working-here name falls back through the registry, and never renders "null". |
| 3 | **An HTML presentational hint wins when CSS only sets the other axis.** `width`/`height` attributes have a *used* value; setting `width` in CSS leaves the attribute's height in force. | The marketing hero shipped 1158×1346 on a 2880×1346 file — a stretched screenshot, on a page selling a design tool. | `test/marketing.test.ts` — every image gets `height: auto`, and no rule pins an image's height. |
| 4 | **A test written around the keystroke instead of the invariant.** | The first version of #3's guard required any rule setting an image's *width* to also set `height: auto` — so sizing with `max-width` reproduced the identical squash with the suite green. | Mutation testing. Break it several ways before believing a new test; if only your own typo is caught, the test is an anecdote. |
| 5 | **A guard that restates the rule instead of importing it can only test itself.** A test that defines the logic locally and then asserts on it is green whatever the app does. | #2's guard. `presence.test.ts` defined its own `nameOf` and made four confident assertions about it, importing nothing; the rule it named lived inline in a zustand selector in `ItemView.tsx`. Reintroducing the exact "null is working" bug left it 10/10 green. The local copy had also silently drifted from `actorNameIn`. So lesson #2's guard was decorative for its entire life. | Give the rule ONE home and point the test at that home: `sessionName` in `packages/web/src/lib/names.ts`, imported by `ItemView.tsx` and by the test. If a guard imports nothing from `src/`, it is not a guard. |
| 6 | **A mutation that HANGS is not a mutation that failed.** A loop whose only exit is a helper's side effect turns a broken helper into a wedge, not a red test. | Making `UndoStacks.discardUndoTarget` a no-op wedges `Engine.undo`'s `for (;;)` inside the single-writer chain: the daemon stops answering, the run never ends, and 15 minutes later there is nothing to read. In production that is a canvas that stops responding to everybody, from one actor pressing ⌘Z. | `packages/server/test/undo-stacks.test.ts` asserts the contract directly — discarding never hands the same seq back twice — so the no-op fails in 3ms with a reason. When a mutation makes the suite hang rather than fail, that IS the finding: the invariant needs a test one layer below the loop. |
| 7a | **A walk whose answer for one item depends on another item's PENDING answer is decided by iteration order.** Reading a neighbour's current state instead of its outcome makes the result a function of the list, not of the data. | Phase 9's provenance sweep. Jordan's daemon was admitted by a pass from her tab; considering the daemon first resolved its chain through a tab whose grant had just been revoked, so the daemon was expelled a moment before the tab re-rooted onto the grant that had invited her by name. Two badges of one person, one kept and one thrown out, by array order. | Decide each item once, recursively, and let a dependant adopt its dependency's OUTCOME (`server/sweep.ts`'s memoized `decide`). The guard is `sweep.test.ts`, whose cases are the design's named failure modes — a chain, a chain with a dead middle, a cycle — rather than the happy path. Write the test from the failure the design warns about and it fails on the first run. |
| 7 | **Anything that edits source on disk will be committed by somebody else.** Concurrent agents (or a stray `git commit -a`) capture whatever the working tree holds at that instant. | A mutation was live for ~20 seconds while a scoped test ran, and `110027d` — a commit about persona frontmatter — swept up the reducer line with it, removing `item.add`'s trash check and leaving `main` red. | Run mutation testing (and any deliberate temporary break) in a `git worktree` with `node_modules` symlinked, never in the working checkout. Check `git log -- <file>` for the file you were mutating before you believe a clean `git status`. |

| 5 | **A measurement that reports zero when it is broken.** `Runtime.evaluate` answers a malformed expression with `exceptionDetails` rather than rejecting; a helper that reads `result.value` and ignores that returns `undefined`, and every `?? []` downstream turns a broken instrument into a clean bill of health. | `scripts/grade.mjs` shipped its first version scoring a page with a stretched image at 8/8. Every rendered check had been vacuous from the start. | `--selftest` against `test/fixtures/deliberately-bad.html`: seven checks, all of which must fire on a page built to break them. |

## The habits, from bugs with no test to give

- **Verify against what is actually served.** The daemon serves the built
  `packages/web/dist`, not Vite. A fix "not working" was a fix never built —
  `npm run build` after every web change, or you are testing yesterday.
- **A zustand selector returning a new array, object or Set every call is an
  infinite render loop.** It has happened three times, once blanking the whole
  app. Return a scalar and derive outside, or select the pieces.
- **Measure→setState in a layout effect with no deps loops too**, even when the
  value stabilises, because StrictMode double-invokes. Write placement straight
  to the DOM instead.
- **Guard keyup wherever you guarded keydown.** Typing "p" in a text field
  selected the Pen because only the keydown checked. Guard on the press you
  started (`penDownAt.current !== 0`), not on the event target — a target check
  strands a real hold when focus moves mid-press.
- **A stamped name is a log entry, not an identity.** Mentions matched the name
  frozen on the comment, so renaming "Dion 2" to "Di" meant `@Di` reached
  nobody. Resolve against the current registry (`actorsAnswerTo`).
- **Hang a feature off a signal the path actually touches.** Cancellation was
  hung off presence updates, but `ls` never touches presence, so it never
  arrived. Ask what the command already does before choosing where to listen.
- **A code comment that reasons about browser behaviour is a hypothesis until
  somebody measures it.** `isOpen` held the blob route open for four phases on
  a correct fact about sandboxed iframes (opaque origin ⇒ null
  site-for-cookies) applied to the wrong request: what has no cookie is what
  the loaded document requests AFTERWARDS, while the iframe's own load is
  issued by the parent, same-site, and carries the `Lax` cookie. Ten minutes
  with a Node server that logs request headers and a real Chrome settled it.
  Cheapest instrument in the box, and the one this repo keeps not reaching for.
- **When a behaviour inverts, the copy describing the old one is a bug in
  every place it survives.** `isocan share --link off` printed the new "1
  expelled" and then, two lines down, the old "people already on this canvas
  keep their access". Both lines were individually defensible and no test
  compared them, because no test reads a command's whole output as prose. The
  places are found by running the thing, not by grepping for the feature's
  name.
- **Assert your probe's preconditions.** More browser-probe "failures" in this
  repo have been the probe than the app: `elementsFromPoint` cannot see
  `pointer-events: none`, the route is `/p/` not `/canvas/`, a tap of `P`
  *toggles* the Pen off, and a stale log window shows a run that already ended.
- **Python's `str.replace()` replaces every occurrence.** Always assert the
  count before writing the file. Two of the worst entries above start here.
- **A guard that counts duplicates only sees the second one.** `oneblock`'s
  "each class once" fires when a dropped scope leaves a *second* bare rule; for
  the 57 classes in `styles.css` that have never had a bare rule, the leftover
  is the first and the count is 1. Ask what the guard's shape misses before
  believing the class of bug is closed — and prefer an invariant derived from
  the file (a chained class is a modifier, and modifiers are never bare) to a
  list somebody has to maintain.
- **A scale test's timeout is set from what it costs, not left at the default.**
  A 200-item test at 4.3s alone passed alone and failed 3 of 3 full runs on
  vitest's 5s default, because a full run is fifteen files fighting for the
  same cores. Repeat a suite before calling it green: a new test that only ever
  ran alone has not been run.
- **A timeout message with no evidence teaches people to re-run.** `timed out
  waiting for the squatting daemon` is the same sentence for a loaded machine,
  a stolen port and a process that crashed at startup — and `stdio: "ignore"`
  had thrown away the one thing that could tell them apart. Say how long you
  waited, what the last probe saw, and whether the process is still alive; fail
  immediately once it has exited.

- **A number with no subject attaches itself to the nearest sentence.** The
  Share dialog held one `swept` count for two different revocations, so
  un-inviting one person by email rendered *"anyone with the link — 2 surfaces
  lost this canvas"* under the link toggle. Every word of it was true and the
  sentence was a lie. Report WHICH gesture a count belongs to, or put it beside
  the control that produced it — and note that the same file had already
  learned this once, in the CLI, one stage earlier.
- **A destructive gesture can remove the person performing it, and then the
  re-read lies.** Un-inviting somebody expels the caller when the caller was
  admitted by the row they just revoked — the ordinary case for anyone tidying
  up an invitation they were themselves on. The follow-up list request then
  403s, and a dialog that only trusts the re-read leaves the revoked row on
  screen with a live-looking button. Drop what you know is gone locally BEFORE
  re-reading, and translate the refusal into what actually happened. Neither
  half is reachable from a unit test: both are about the screen after a request
  that succeeded.
- **When a capability looks like it must be compiled in, check whether what
  really varies is an input the code already needs.** `attest.ts` shipped its
  roster of attesters as a constant, on the reasonable-sounding ground that
  configuration could make a home claim an attester it does not have. But the
  verification ships in every build identically; what varies is whether there
  is a project to check tokens against — and that project id is what `iss` and
  `aud` are bound to anyway. So the configuration is not a claim that could be
  false, it is the thing the work is done with, and a wrong one fails loudly at
  the first use. The constant would have made "one image, many homes"
  impossible for the sake of a lie that cannot be told.

## Working alongside agents

- **`git add -A` commits whatever the other agents have on disk right now.**
  Four reviewers ran concurrently in this checkout; one of them had a deliberate
  mutation live in `packages/core/src/reducer.ts` for about twenty seconds while
  it checked that a test caught it. A commit meant to touch four frontmatter
  blocks swept the mutation up with it, and `main` carried a reducer with
  `item.add`'s trash check deleted — a commit that failed its own suite. It was
  caught by the agent that made it, and it was never pushed.

  While background work is running, stage the paths you actually changed. `-A`
  is a claim that everything in the tree is yours, and with agents in the room
  it is not.

## Adding to this file

A new lesson needs three things: the shape stated so it applies beyond the
incident, what it actually cost, and the guard — a test if one is possible, a
habit if it genuinely is not. "Be careful about X" with no guard is not a
lesson, it is a wish.
