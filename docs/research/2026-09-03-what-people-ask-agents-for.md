---
status: built
since: 2026-09-03
see: evals
note: Stage 1's deliverable — every ask at one home hand-labelled 3 Sep 2026, the distribution published, a classifier calibrated against it (84%) and shipped in `isocan evals corpus` with that number attached. Found and fixed a cancel bug that had inflated the cancelled count sixteen-fold on one canvas
---

# What people ask agents for

**3 September 2026.** The eval plan's Stage 1, done as it said: export the
corpus, label a sample by hand into categories that come out of the data,
classify the rest against those labels and report the agreement, publish the
distribution. Numbers only; the words stay on the machine.

**The sentence Stage 1 wanted finished.** *The most common thing anybody asks
an agent on a canvas is to change something that already exists — 21% of
asks — and edits of every kind (revise, restyle, repair, arrange, converge)
are 39%, twice the 18% that ask for something new.*

## What was labelled

`isocan evals corpus --json` over all 22 canvases at one home, 3 Sep:
**414 rows**. Every row was read and given two labels by hand: who wrote it,
and what kind of ask it is.

The first label mattered more than expected. **304 of the 414 rows — 73% —
were written by agents**, not people. The corpus counts them because in the
Chat every comment reaches every agent, and on a canvas where nobody has run
`agent.enroll` the daemon cannot tell an agent's receipt from a person's
question; `evals.ts` said so, and called the broadcast count an upper bound.
This is what the bound was hiding:

| Agent rows, by shape | Count | Of agent rows |
| --- | --- | --- |
| Notifications — a bot's commit-by-commit board posts | 137 | 45% |
| Arrival and presence — "here, parked", "back on the board" | 47 | 15% |
| Receipts — "done", "built", "v3 on the stack" | 25 | 8% |
| Diagnosis and status — the daemon, the blobs, why it fell off | 16 | 5% |
| A question to a person | 6 | 2% |
| Other agent prose | 73 | 24% |

One bot's build notifications are a third of the whole corpus by themselves.

Of the **110 rows people wrote**, 12 were probes on test canvases (`echo
check`, `please tidy this canvas` ×6 on a canvas made to test snapping) and
are set aside. **98 asks** are the subject of the rest of this note.

## The distribution

Hand labels over the 98 human asks. Categories emerged from the reading, not
from a list brought to it; the names are the ones now in `core/evals.ts`.

| Kind | What it is | Asks | Share | Answered | Median time to an answer |
| --- | --- | --- | --- | --- | --- |
| **revise** | change a thing that exists — swap an image, reword, add a bullet, reorder, animate, a hover state | 21 | 21% | 21 | 3 min |
| **create** | something that did not exist — a screen, an app, a deck, a card, a diagram, a drawing | 18 | 18% | 18 | 2 min |
| **orchestrate** | point an agent at work — a bare `@name`, "this one's for you", "are you there", `/sprint` | 13 | 13% | 12 | 2½ min |
| **question** | explain it — how did you build this, how does that work | 7 | 7% | 7 | 42 s |
| **arrange** | tidy, `/format`, rearrange, merge sketch layers, delete | 7 | 7% | 5 | 54 s |
| **social** | thanks, hello, "amazing" | 6 | 6% | 5 | — |
| **restyle** | the look of a thing that exists — redesign, apply a design system, "make it pop" | 5 | 5% | 5 | 3½ min |
| **document** | write it down — a README, a spec, an IA, a design system extracted from code | 5 | 5% | 5 | 1 min |
| **critique** | compare, audit, judge, grill | 4 | 4% | 3 | 1¾ min |
| **repair** | it is broken, or the last answer missed | 4 | 4% | 4 | 1¾ min |
| **variation** | several takes to choose between | 4 | 4% | 4 | 2½ min |
| **converge** | pick one, merge two, apply the chosen version | 2 | 2% | 2 | 3 min |
| **ops** | deploy it | 1 | 1% | 1 | — |
| **cancel** | `/cancel` | 1 | 1% | — | — |

Read together:

- **Editing beats making, two to one.** revise + restyle + repair + arrange +
  converge = 39 asks; create = 18. People make a thing once and then talk to
  it. The plan guessed the dominant ask would be "make me a screen"; it is
  "change the screen you made".
- **One ask in eight is aim, not work.** 13 `orchestrate` rows carry no
  request at all — they point an agent at a comment above, or ask whether it
  is there. Eleven of the thirteen name somebody, which is the highest
  addressed share of any kind: a person reaches for a name when the thing
  they want is *attention*.
- **Diverge and converge are real and small.** 4 `variation` asks and 2
  `converge`, 6% together — the plan's note that nothing generates preference
  pairs until divergence is something people use still holds, and here is
  the base rate it has to grow from.
- **Questions get the fastest answers** (42 s median) and cost nothing
  in ops; `restyle` and `revise` take the longest, because the answer is a
  new version.
- **Two-thirds of the ops come from a fifth of the asks.** The 21 `revise`
  asks produced 653 attributed ops; all 98 produced 1,502. A revise is a
  small sentence and a long tail of work.
- **People rarely ask twice.** 3 of 98 asks repeat an earlier one within the
  hour, and all three are `orchestrate` — a name said again when the first
  saying went unheard.

## The headline that changes

On 1 September this programme reported **"384 asks — 259 answered, 31
cancelled, 94 silent: one ask in four gets no answer."** Both halves of that
were wrong, in ways only a reading could find.

**The silent asks were agents talking to an empty room.** Of the 98 human
asks, **93 were answered (95%), 4 went silent (4%), 1 was cancelled.** The 112
silent rows in the whole corpus are agents' own notifications, arrivals and
receipts that nobody replied to, which is what should happen to a receipt.
One person in four was not being ignored; one bot in two was, correctly.

**The cancels were one cancel, counted sixteen times.** `buildCorpus` read
"cancelled" as *any later `/cancel` by the asker in the same thread*. The
Chat is one thread. One person typed `/cancel` once, after sixteen asks, and
all sixteen were scored cancelled — including the fourteen that had been
answered hours earlier. The reading is now *the asker's next own comment is
a `/cancel`*: the cancel belongs to the ask it follows. Fixed in
`core/evals.ts` with a test built from the shape that was measured, and the
count on that canvas went from 16 to 1.

Both are the lesson this programme keeps paying for, in the form
`lessons.md` gives it: **a number in a report whose job is to be believed
was believed, and it was a join's artefact.** The corpus's own caveat about
broadcast being an upper bound was true and insufficient — a caveat on a
number is not a correction to it. Stage 1's "label a sample by hand" was not
a preliminary to measurement; it was the measurement's audit.

## The classifier, with its number

`categoriseAsk` in `core/evals.ts` reads a comment's words (and its slash
command, which settles it outright: `/format` is `arrange`, `/design-audit`
is `critique`) and returns one of the fifteen kinds. Calibrated against the
98 hand labels: **agrees on 82, 84%.** Where it disagrees, mostly: it reads
a longer thank-you as a `revise` (3); it calls a `create` from references a
`restyle` (2) and a `revise` that says "make" a `create` (2); it hears
"version" in a restyle and says `variation`. It calls the twelve test-canvas probes `arrange` and
`orchestrate`, which is what their words say; only the canvas knew better.

It ships in `isocan evals corpus` — a `kinds:` line with the silent count
beside each kind, and a column per row — **labelled as a reading**, with a
pointer to this note. 84% is enough to see the shape of a canvas nobody has
labelled and not enough to score anything against; the number travels with
the output so the next reader knows which they hold.

## What this suggests for Stage 2

Golden tasks weighted by this distribution, not by what a task suite would
naturally reach for:

1. **Revise tasks first** — a fixture screen and an ask to change one thing
   about it (swap an image, reword a heading, reorder a list, add a hover
   state, animate a bar), graded by whether the one thing changed and
   nothing else did. This is the commonest ask and the one a grader can
   check most exactly: diff the DOM, count what moved.
2. **Create tasks second**, graded by the deterministic graders that exist —
   renders, contrast, 390-wide, named controls — and by whether the design
   system already on the canvas was used.
3. **A restyle task** with a `DESIGN.md` on the fixture, graded by
   `designcheck`: values in the scale or invented.
4. **An orchestrate task is a fixture, not a task**: a bare mention with a
   comment above it. What it tests is whether the agent reads the thread.
   13% of asks assume it does.
5. **Arrange** is `/format`, which already has tests; the two silent
   `arrange` asks were both a person asking for a tidy and nobody hearing —
   the empty-room case, which is a product problem before it is an eval one.

And two things for the product, found on the way:

- **The canvas should know who is an agent.** 73% of the corpus was agent
  prose the daemon could not tell from asks. `agent.enroll` records it, and
  almost nobody runs it. The roster should fill itself when an agent enters
  through `isocan identity --as` or `rc`, and a bot that posts on a timer
  should say so on its actor — so the next corpus does not need a person to
  sort 414 rows by hand. **Built 3 Sep:** every claim's session key names
  its harness, and the daemon now writes that into the actor registry
  (`harnesses`) and serves it as `GET /api/kinds` — people claim from
  `web:` and `home:`, everything else is an agent. The corpus reads it
  beside the roster; the face card says "agent" for one, live or gone.
- **A bot that posts 137 notifications into the Chat has made the Chat
  unusable as a channel.** The Repo Admin noticed this itself mid-run ("I have
  posted 80 of this thread's 96 messages") and quietened. Notifications want
  their own thread, or a panel, not the room. **Built 3 Sep:** the board's
  notices go to one thread anchored to its own Tree status panel.

## Method, for the next time

- Export: `isocan evals corpus --canvas <id> -n 100000 --json` per canvas,
  into one local file. Nothing in it leaves the machine; this note carries
  counts and no text.
- Author roles: eight human actor ids, named by hand; everyone else an agent.
- Labels: one category per human row, assigned by reading the row and, where
  it was a bare mention, the comment above it. 110 rows, 12 set aside as
  probes.
- Agreement: `categoriseAsk` over the 98, compared to the labels, with the
  confusion listed above.
- The labels file stays local. The categories, the counts and the classifier
  are the deliverable.
