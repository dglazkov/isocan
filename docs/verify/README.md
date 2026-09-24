# What needs a person

**The third lane.** Two already exist and neither covers this:

| Lane | Proves | Blind to |
| --- | --- | --- |
| `npm test` | the code does what it says it does | whether anybody can use it |
| [`journeys`](../../.agents/personas/journeys.md), nightly | a screen renders and a walk completes | anything needing a microphone, a phone, a second person, or taste |
| **this** | somebody used it and it worked | nothing — it is the last resort, so it stays short |

A thing lands here when it is **built, shipped, and never once exercised by a
human being**. Not "untested" — most of what is here has thorough automated
proof. It is here because the automated proof cannot reach the part that
matters: that a person can find the button, that the voice comes out of the
speakers, that the colour on screen is the colour the data claims.

## The rule

**A walk on this page is written by whoever built the thing, not by whoever
will run it.** The builder knows which step is the one that breaks, and the
person running it should need no context at all — no repo knowledge, no
guessing at a command, no "obviously you first…". If a step needs a paragraph
of background to make sense, the walk is not finished.

**There is deliberately no gate.** The review queue reddens `npm test` after
three days because answering a finding costs one word. Verifying costs a
person twenty minutes, a microphone and sometimes a phone, and a hard stop on
that would be switched off by the first person who needed to ship at midnight
— the same argument the architect's line bound makes about itself. This page
is a list that can be read, not a bound that can be missed.

**A walk that finds something writes it down and stops being a walk.** If step
4 is broken, that is a bug with a reproduction, and the fix gets a test in the
lane that should have caught it. The walk's job is to turn "nobody has tried
it" into either `works` or an issue.

## Status words

- `unverified` — built, shipped, nobody has run it.
- `works` — somebody ran it, on a date, and it did what the page said.
- `broken` — somebody ran it and it did not. Say what happened and link the
  issue; leave the walk here until the fix lands.

## The queue

| Walk | What has never been exercised | Why a machine cannot | Status |
| --- | --- | --- | --- |
| [Talking to the canvas itself](2026-09-20-talk-on-canvas.md) | the mic ON the canvas — the surface a stranger meets first | needs a microphone, ears, and a judgement about whether the pause feels like a conversation | `unverified` |
| [Voice, out loud](2026-09-20-voice.md) | the STANDALONE voice agent on its own port, the one `@mention` can summon | needs a microphone, ears, and a judgement about whether the pause feels like a conversation | `unverified` |
| [A drawing's colour](2026-09-20-drawing-colour.md) | the Pen recording the ink colour it was drawn in | needs a hand drawing with a pointer, and eyes to agree the stroke is the colour the data now claims | `unverified` |
| [The fast path in shadow](2026-09-23-voice-fast-path-shadow.md) | Jev resolving REAL speech beside the live model, and the take-back label | needs a microphone, speech that mishears, and a person pressing undo on a wrong act — plus the timing of words against the model's call | `unverified` |
| [Undo, in both doorways](2026-09-20-undo.md) | the harness retracting through the daemon, and the browser dialog's refusal | the harness branch has never executed against a live daemon; the browser refusal has never rendered | `unverified` |

## Adding one

Copy the shape of an existing page: what was built, why it is here, the
numbered steps, what you should see at each, and what to do when it is wrong.
Add a row above. Keep the queue short by running the walks rather than by
lowering the bar for entering it.
