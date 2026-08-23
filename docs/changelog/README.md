# Changelog

One page per day, oldest at the bottom. Each says what changed and — more
usefully — *why*, because the reasoning is the part that is expensive to
recover and the diff is the part that is not.

Written from the commit history, which in this repo carries the argument as
well as the change — by hand at the end of a session, or by the nightly
workflow for the days that ended without one. Where a day's work was later reverted, the entry says so
rather than quietly dropping it: a road not taken is worth as much as the one
taken, and costs less to read.

**[The whole changelog, laid out properly →](https://claude.ai/code/artifact/0d2b285f-f913-4987-b1d9-0dbe48724106)**

| Day | | What happened |
| --- | --- | --- |
| **[23 Aug](2026-08-23.md)** | 4 commits | The lid closes, and the daemon learns to dial. Phase 6: a local daemon stops being a home and becomes a replica of one — it dials, forwards every write, and reconnects by saying "I have through N". The day's best catch was a guard that said yes to the empty list: an emptied live log answered a resume with "you're current" while four ops were missing, and a quiet canvas leaves nothing to correct it. |
| **[22 Aug](2026-08-22.md)** | 46 commits | The home goes up, and a room of ghosts. The multiuser build is redesigned *and provisioned* — by evening a real canvas is served from Google Cloud off Firestore, with 150 ops written straight through two revision rollovers and not one refused. On the app side: a contrast audit, a changelog, a cursor that says who it belongs to, and the day's best bug — a lost CSS scope that rendered a room of live people as a room of absent ones. |
| **[21 Aug](2026-08-21.md)** | 24 commits | A vocabulary for asking. Slash commands arrive — the app never *runs* one, it writes down what was asked and an agent does the work. Plus the design system as a DESIGN.md, the `?` panel, and a layer scale that fixed four bugs which were all the same bug. |
| **[20 Aug](2026-08-20.md)** | 20 commits | Pointing at things: annotation as ink that knows what it is about, the selection riding along with the message, favourites, real thumbnails. And, on the other branch, a whole multiuser era on a designated host and a Firestore mirror — shipped this day, reverted the next. |
| **[19 Aug](2026-08-19.md)** | 9 commits | Agents get hands. Everything shipped web-only got a CLI verb, after renaming exposed an isomorphism bug: the web app moved the filename and the CLI did not. The rule got teeth the same day — a test that reads the CLI's registered commands and fails the build when the guide does not teach one. |
| **[18 Aug](2026-08-18.md)** | 12 commits | The Pen, the edge radar, and the decision that a directory is a project. Ink lands as an ordinary SVG item in world coordinates — the choice that later made merging drawings exact rather than approximate. |
| **[17 Aug](2026-08-17.md)** | 18 commits | Identity becomes an operation. Four stores and two client-side guesses become `actor.claim`, with one continuity rule applied by the single writer. The tool rail, the Zoom tool's tap/hold idiom, and ⌘K. |
| **[16 Aug](2026-08-16.md)** | 37 commits | The day it learned to be installed. Almost no features: version skew, two people on one machine, tests that outlive themselves, an install that unpacked to nothing. Also themes, and projecting a running localhost site as an item. |
| **[15 Aug](2026-08-15.md)** | 38 commits | Day one, and the spine is already here: one reducer for both clients, a single-writer daemon, actor-scoped undo, blob GC, presence with live cursors, comments, and an agent loop that parks on `wait`. |

## What goes in an entry

The headline change, the reasoning behind it, and the bugs worth remembering —
especially the ones whose cause was not where it looked. Then every commit
subject from that day, so nothing is hidden by the summary.
