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
- **Assert your probe's preconditions.** More browser-probe "failures" in this
  repo have been the probe than the app: `elementsFromPoint` cannot see
  `pointer-events: none`, the route is `/p/` not `/canvas/`, a tap of `P`
  *toggles* the Pen off, and a stale log window shows a run that already ended.
- **Python's `str.replace()` replaces every occurrence.** Always assert the
  count before writing the file. Two of the worst entries above start here.

## Adding to this file

A new lesson needs three things: the shape stated so it applies beyond the
incident, what it actually cost, and the guard — a test if one is possible, a
habit if it genuinely is not. "Be careful about X" with no guard is not a
lesson, it is a wish.
