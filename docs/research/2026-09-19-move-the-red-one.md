---
status: designed
since: 2026-09-19
issue: 337
see: judge, evals, embed
note: a video of voice-driven canvas editing ("move the red one next to the blue one, actually undo that") asked whether Gemini Live 3.8 and Jev could do this in isocan. Both halves of the marriage are further along than expected — `models/gemini-3.8-live` is wired and verified, `@isocan/talk` already hands the model 47 canvas ops as tools, and function calling is synchronous. The blocker is neither model. `canvasSnapshotText` hands a live session `title [id]` per item and nothing else — no position, no size, no kind, no colour — so "the red one" is not hard to resolve but IMPOSSIBLE, and "next to" is uncomputable from what the model is shown. The finding is that the bottleneck is the projection, not the judge: widening it needs no vendor at all and gets most of the demo with Gemini alone. Jev's contribution is specifically latency and a confidence that decides act-versus-ask — not capability. `Item` carries no colour field, so "red" is derivable for strokes and unknowable for a picture's face; that is the one genuinely new mechanism the demo needs.
---

# Move the red one

**19 September 2026.** Asked by Dion, from a video: a person says *"move the
red one next to the blue one — actually, undo that"*, and it happens instantly.
*Can we marry Gemini Live 3.8 and Jev to pull this off in isocan?*

The short answer is yes, and the useful answer is that **the two models are the
part that already works.** What stands between isocan and that video is a
sentence of about forty words that the canvas says about itself.

## What is already built, which is more than expected

[`2026-08-24-voice.md`](2026-08-24-voice.md) ([#139](https://github.com/dglazkov/isocan/issues/139))
still reads `status: designed`, and its front matter is stale. Against the
tree today:

| Piece | State |
| --- | --- |
| The model | `LIVE_MODEL = "models/gemini-3.8-live"`, with a comment recording it **verified current on 15 Sep 2026** against Google's Live API docs |
| The browser half | `@isocan/talk`, 2,565 lines — a Live session opened from this browser with this person's key |
| The standing half | `@isocan/voice-agent`, sharing one provider contract through `live.ts` |
| The tool surface | **47 function declarations**, each planned into ordinary operations by `planForCall` |
| The rule | *"Every voice action produces the same operation a click would"* — honoured; the talk module adds no op, no route, no server store |

And the note's first structural finding still holds and is the reason this is
worth doing at all:

> **Function calling is synchronous, and that is a gift.**

So the loop the video shows — hear, decide, mutate, see it — is not a thing to
invent. It runs.

## The projection, which is the whole finding

Here is every canvas fact a live session is given today. It is one function,
`canvasSnapshotText` in `packages/voice-agent/src/live.ts`:

```
Current canvas state (ids are authoritative — echo them in tool calls):
- items: Checkout screen [itm_abc]; Settings [itm_def]
- threads: thr_xyz (3 comments)
```

**A title and an id. That is the whole world the model is shown.**

No position. No size. No kind. No colour. No containment. And the tool that
would carry out the sentence declares its target as

```
item_ref: { type: "STRING", description: "Item title, prefix, or id." }
```

with `by_x`, `by_y`, `to_x`, `to_y` for the movement.

Read those two together and the video's sentence does not merely fail, it
**cannot be attempted**:

- *"the red one"* — colour is not in the projection, so there is nothing to
  resolve against. No model, cheap or expensive, can pick a referent by a fact
  it was never shown.
- *"next to the blue one"* — the tool takes pixels, not a second referent, and
  the model is not told where anything is. Even with both items identified,
  there is no arithmetic available to it.

This is the finding, and it is the thing that would not have been obvious
before opening the file: **the bottleneck is the projection, not the judge.**

## What the note already got right, and the one row it is missing

The 24 August note named deixis as the hard problem and gave a resolution
order, every step of it from parts that exist:

1. the speaker's **selection** — `this`, `these`, `it`
2. what they are **pointing at** — presence carries a cursor
3. a **title** — the `#Title` roster
4. what was **just discussed** — the thread's `comment.items`
5. **ask** — "the checkout screen or the settings one?", which costs a second

That list is excellent and it covers *pointing* and *naming*. The video's
sentence uses neither. **"The red one" is a referent given by description**, and
description has no row in that list — which is why the list's author could
write "the hard problem is already solved by the shared cursor" and be right
about every case except the one in the video.

Add the missing row and the shape of the work appears:

> **4.5 — a described referent, resolved against what the canvas looks like.**

That is a typed decision over a closed set of item ids, with a probability. It
is the [`Judgment`](../projects/judge/design.md) seam, unchanged, pointed at a
different question.

## Where Jev actually earns its place

It is tempting, and wrong, to say the demo needs Jev. Widen the projection and
give `move_item` a second referent, and **Gemini Live can do that sentence on
its own**, because resolving "the red one" from a list that says which one is
red is not a hard inference.

What Jev buys is narrower and better:

- **Latency, inside a synchronous call.** The tool call blocks the conversation.
  A judge at 70–500ms is a pause; an LLM round-trip inside that call is a stall,
  and the difference between the video's feel and a demo people describe as
  laggy is entirely here.
- **A confidence, which decides whether to act or to ask.** This is the part the
  projection alone cannot give. Step 5 of the resolution order — *ask* — is the
  one place a voice interface beats a GUI, and it is only reachable if something
  knows it is unsure. A model that always answers always guesses.
- **A cost that can be declared.** At a reported $0.042 per million input tokens
  with free output, a resolver called on every utterance is not a line item.

So the honest division of labour:

| | Does |
| --- | --- |
| **Gemini Live 3.8** | the ear and the conversation — audio, turn-taking, the mid-sentence *"actually…"*, which intent was meant |
| **Jev** | the pronoun — which of these N items is *the red one*, typed, with a probability |
| **isocan** | the act, the undo, the presence, the record |

## "Actually, undo that" is the part isocan is unusually ready for

It is the throwaway clause in the video and it is the hardest thing in most
canvas tools, because undo is a single stack and a voice agent shares it with
you: it undoes your work, or you undo its, and neither of you can tell.

In isocan **undo is per actor**, and a voice session is an actor. *"Undo that"*
means *undo the voice actor's last operation*, which cannot reach the thing you
did by hand a moment earlier. That falls out of the existing model with nothing
added, and it is worth naming because it is the kind of advantage that is
invisible until a competitor's demo shows the bug.

The note's own acceptance test applies unchanged and is the right one:

> **A spoken session must be replayable from its oplog with no audio.**

## The one genuinely new mechanism: is "red" knowable at all?

This is the question the demo turns on, and the answer in isocan today is
*mostly no*.

`Item` carries `id`, `containerId`, `x`, `y`, `width`, `height`, `title`,
`description`, `properties`, `reactions`, and its versions. **There is no
colour field.** Colour exists in exactly two places:

- **A stroke has one** — `Stroke.color`, a hex string, so a drawing's colour is
  a computable fact today.
- **A card's face has one only as pixels** — a screenshot that happens to be
  red is red to a person and silent to the data model.

So there are three roads, and choosing between them is the real design decision
this note hands on:

1. **Only resolve what is already text.** Strokes, titles, properties. Honest,
   free, and it will fail the first time somebody points at a picture — which
   is the common case on a real canvas.
2. **Derive a colour fact where the canvas already renders.** isocan draws
   every item and already keeps a visual face and miniatures; a dominant colour
   per item is small, derivable, and turns "red" into an ordinary text fact any
   judge can read. **This is the recommendation.**
3. **Show a judge pixels.** Whether Jev is multimodal is not known here and
   should not be assumed; every TypeSafe figure in this repository is
   second-hand, because `typesafe.ai` is egress-blocked from the build
   container.

Option 2 is also the one that generalises: *the big one*, *the one at the top*,
*the empty one* are all the same shape of question, and all of them are
answered by a wider projection rather than by a cleverer model.

## What this costs, honestly

- **A wider projection is not free.** Every item's position, size, kind and
  colour on every turn is more tokens than `title [id]`, on a socket that is
  already streaming audio. A canvas with four hundred items cannot send all of
  them, so the projection needs a viewport bound — which is a design question
  the current one never had to answer.
- **A second hop inside a synchronous call.** Whether 70–500ms reads as instant
  or as a stutter, inside Live's own turn detection, is a measurement nobody in
  this repository has taken.
- **A vendor, early-access, three months old.** The judge project's seam exists
  so that the resolver is an interface with a stub behind it, and this work
  should not be the thing that makes that seam load-bearing before it has been
  calibrated.

## What to do about it

The order falls out of what needs a vendor and what does not.

**Needs nobody:** widen `canvasSnapshotText` (position, size, kind, containment,
and a derived colour), and give the movement tool a second referent so *next
to* is expressible over the `groupArrangeAction` and `PLACEMENT_GAP` primitives
core already has.

> **Built 19 Sep 2026 — the geometry half.** Each row now reads
> `"Title" [id] kind WxH at (x,y)` with the group named when there is one, the
> header states the coordinate convention, and the list is capped at sixty in
> reading order with the remainder disclosed rather than dropped. Two things
> came out of building it. **The order is not the viewport**, though this note
> said it would be: a viewport is a fact the browser has and the standing
> harness does not, so ordering by it would fork the one wording the function
> exists to keep. And `packages/modules/talk/src/live.ts` turned out to be a
> deliberate byte-copy of the harness's file — reconciled *by hand*, per its
> own header, with nothing checking — so this change, the first to touch both,
> left `test/live-copy.test.ts` behind to make that a bound rather than a
> comment. Colour and the relational tool are still owed. That is most of the video, in isocan's own code, testable
without a key and valuable even if no judge ever lands — a live session that
knows where things are is better at everything.

**Needs the judge:** the described-referent resolver as row 4.5, with the
confidence deciding act-versus-ask. It slots into the `Judgment` seam
[#334](https://github.com/dglazkov/isocan/issues/334) already designed, and it
inherits that project's rule without amendment — **a typed judge triages, it
never rules.** Here the doubt routes not to a band on a canvas but to a
question out loud, which costs one second and is the thing voice is good at.

The through-line is worth stating, because it is the same argument twice: in
the filing floor a probability became a *place*; in a live loop it becomes a
*question*. The seam was designed right.

## Sources

- The video the question came from: [@jackcheng](https://x.com/jackcheng/status/2100729670991802386) (not read first-hand — `x.com` is egress-blocked from the build container; the contents were described by Dion)
- In this repository: [`2026-08-24-voice.md`](2026-08-24-voice.md), [`packages/voice-agent/src/live.ts`](../../packages/voice-agent/src/live.ts), [`packages/modules/talk/`](../../packages/modules/talk/), [the judge project](../projects/judge/design.md)
- [`2026-09-19-system-one-and-the-ledger.md`](2026-09-19-system-one-and-the-ledger.md) for what a System One model is, and for why every vendor figure here is second-hand
