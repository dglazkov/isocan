# Seven things the brainstorm session hit

The session that drew the concepts ran into seven problems in isocan and
reported them as observed. Each was then traced in the code at `7bb1f4e9`.
None was reproduced against a daemon: these are readings, not fixes. They are
ordinary bugs, separate from the proactive work.

**All seven were fixed on 14 October 2026**, each with a test that failed
before its fix (lessons 113–117). Number 2's size failure could not be
reproduced — `--size 1800x1300` renders — but the message now names whatever
the real error is. Number 7 needed a decision: a replica never forgets on its
own, so the fix is `isocan canvas forget <id>`, explicit and recoverable,
and an inbox that says once that a canvas is gone.

| # | What happened | Verdict | Where it comes from |
| --- | --- | --- | --- |
| 1 | `isocan design workflow` on a new canvas: *Canonical review history is incomplete at sequence 1* | **Plausible** | `packages/api/src/design-review-reader.ts:107` requires every sequence from 1 in the local log. A canvas a replica adopted by snapshot has a `lastSeq` and no entries (`packages/server/src/engine.ts`), so sequence 1 is missing. Not confirmed that the canvas was a replica. |
| 2 | `isocan canvas shot … --size 1800x1300`: *the screenshot did not land (exit 1): Node.js v24.20.0* | **The message is the bug** | `packages/cli/src/package-script.ts:55` reports the last line of stderr, and for an uncaught throw that is Node's version trailer. The real error from `scripts/canvas-shot.mjs` is hidden. |
| 3 | `isocan fit` narrowed 840×400 text nodes to about 350×1600 and moved two | **Confirmed by reading** | `textNodeFit` (`packages/core/src/textnode.ts:782`) sizes from scratch at a 320-wide column and ignores a hand-set width. The taller boxes are then pushed to a free spot (`packages/core/src/fit.ts:60`). |
| 4 | `isocan edit` on a text node blew up its height | **Confirmed by reading** | `textRefit` (`textnode.ts:744`) takes the larger of the current and needed size per axis, and the needed height is computed for the 320-wide column. A wide box keeps its width and gains the narrow column's height. |
| 5 | `isocan mv` takes `x y`; `--at` elsewhere takes `x,y` | **Confirmed** | `mv <item> [x] [y]` (`packages/cli/src/main.ts:7339`), while its own `--by` and every `--at` take a comma pair. |
| 6 | HTML `add` prints `unsupported-expression … var() cannot be resolved statically for background` | **Confirmed by reading** | `resolve()` in `packages/core/src/designaudit.ts:259` expands only a top-level `var()`. One nested in a gradient, `rgb()` or `color-mix()` falls through to the unsupported branch. |
| 7 | `isocan inbox` opened with *prj_… unavailable: canvas not found* | **Plausible** | The inbox collects each canvas's read error and prints it before the entries (`packages/server/src/inbox.ts:24`, `main.ts:9656`). A listed canvas that no longer loads produces this. |

Numbers 3 and 4 are one cause: a text node's needed height is always
measured at the default 320 width, whatever width the node has.
