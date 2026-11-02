---
status: designed
since: 2026-09-23
see: voice-agent, judge, wireframes
note: a fast path for spoken commands. Jev reads the transcript of a simple command — "move the login page to the left" — as typed choices over the acts the voice tools already have, the items on the canvas and a relation; when every answer clears a threshold MEASURED on this canvas's own commands, isocan acts at once and says what it did, and one "undo" takes it back; anything else goes to the live model, which already has the audio. Phase 6 listens without acting to build the calibration set; phase 7 acts.
---

# The fast path: Jev does the simple commands, the model does the rest

Asked for by Dion on 23 September 2026: *with voice, what if Jev tries to work
out tasks — "move the login page to the left" — and does it, but if the prompt
is too complex then use the normal model?*

## The debt it discharges

Every spoken command today goes through the live model's tool call
(`packages/modules/talk/src/live.ts` declares ~30 tools: `move_item`,
`items_move`, `resize_item`, `undo`, `find_items`, …). That is right for the
conversation and wasteful for the sentence that is really one act on one
named thing: the model round-trip is the stall a voice interface is judged
by, and the model always answers, so it always guesses — nothing knows when
it is unsure. [The 19 Sep voice research](../../research/2026-09-19-move-the-red-one.md)
named Jev's place as "the pronoun"; this widens it to the whole simple
command, with the model as the fallback rather than the only path.

## The shape

**One Jev call per finished user turn**, on the input transcription the talk
module already receives, asked through the home's `POST /api/judgment`
(wireframes phase 5 — the key stays on the home, the route checks the badge
can edit this canvas). The `state` carries the utterance and the same
projection of the canvas the model is given (items by title, kind, colour,
position, what is selected, the last act). The questions:

| Question | Type | Options |
| --- | --- | --- |
| `action` | choice | the fast-path acts — `move`, `move-beside`, `align`, `resize`, `delete`, `keep`, `undo`, … — plus **`none`** ("not one of these") |
| `subject` | choice | the items on the canvas by title (≤ 255; a larger canvas escalates) plus `none` |
| `relation` | choice | `left-of`, `right-of`, `above`, `below`, `beside`, `into`, `none` |
| `target` | choice | the items again, plus `none` |
| `simple` | yes/no | "is this one act on things already on the canvas?" |

**Act when every answer clears its threshold**, and escalate otherwise:
`action` is `none`; `simple` is no; the utterance needs words written ("add a
screen explaining returns" — Jev cannot write); more than one act; a referent
not on the canvas; or any answer's probability below the threshold for that
action. The act is executed through **the same tool implementation the
model's tool call uses**, so it mints the same `Operation`, is one undo, and
shows the same presence. It is announced — *moved Login left of Home — say
undo* — and "undo" is itself a fast-path act.

**The model must not do it twice.** When the fast path acts on a turn, the
live session is told (a text turn: what was done) and any tool call the model
makes for that same turn is dropped. When it escalates, nothing was done and
the model proceeds as today — it already heard the audio, so escalation
costs nothing but the ~200 ms the question took.

## The threshold is measured, never guessed

Wireframes phase 6 measured Jev overconfident by ~0.4 on screen archetypes:
at p ≥ 0.9 it was right half the time. So no threshold here is a number
somebody picked. Phase 6 below runs the resolver on every command **without
acting**, and records beside it what the model actually did and whether it
was undone within a few seconds — undo is a labelled failure. The threshold
for each action is the lowest p at which Jev's answer agreed with the model's
unreverted act at least 95% of the time on at least 30 commands; an action
that never gets there stays with the model.

## What it refuses

- **No new operation, no new tool.** The fast path picks among acts that
  already exist.
- **No acting on a guess.** Below threshold, or `none`, it escalates.
- **No second executor.** Same tool code as the model's call.
- **No key in the browser.** Through the home's judgment route only.
