# The fast path in shadow — Jev listens while you talk

**Status: `unverified`.**

**What you need:** everything [talking to the canvas](2026-09-20-talk-on-canvas.md)
needs (a microphone, speakers, a Gemini API key), plus **a home with a judge**
— a home started with `TYPESAFE_API_KEY` in its environment, or isocan.io,
whose home already has one. Twenty minutes.

**Why this page exists.** Voice-agent phase 6 built a second listener. On
every finished spoken turn, Jev is asked — once, through the home's
`/api/judgment`, never with a key in the browser — which simple act you meant
(*move, bigger, smaller, delete, undo, select, show*), on which item, where.
It **never acts**: it writes down what it would have done beside what the live
model actually did, and whether you took the model's act back within ten
seconds. Phase 7 may only let Jev act on an action once this record says Jev
agrees with the model's un-undone acts 95% of the time on 30 of them.

The scripted proof (197 typed commands, `packages/modules/talk/scripts/fast-path-eval.ts`)
measured the resolver without a microphone. Nothing has measured it on **real
speech**, where the transcript arrives in pieces, mishears words, and may
arrive *after* the model has already acted. That last one is the question
phase 7 depends on and only a person talking can answer.

---

## 1. Get to a canvas with a few things on it

Follow steps 1–6 of [talking to the canvas](2026-09-20-talk-on-canvas.md),
with one change if you use a local home: **start it with a judge.** Before the
first `isocan` command of step 2, in the same terminal:

```bash
set -a; source ~/.config/secrets.env; set +a
```

(That is Dion's machine; anywhere else, `export TYPESAFE_API_KEY=…` with a key
of your own.) Add two or three more things than that walk does, so "the red
one" and "left of" have something to mean — a red sketch drawn with the Pen,
a second note, a screen.

## 2. Turn the shadow on

Open ⌘K → **Configure voice** (or ⌘-click the composer's mic).

**You should see:** a checkbox, **Fast path in shadow**, unticked, with a line
saying Jev notes what it would have done and never acts.

Tick it. **You should see:** `0 turns recorded in this browser`. If it says
*in this tab only*, the browser has no OPFS (a private window) and the record
will not survive a reload — still walkable, but say so in the result.

It takes effect on the **next** session: if one is running, stop it.

## 3. Talk to it

Start a session. **You should see**, among the first lines:
*fast path in shadow — Jev listens to each turn and never acts*.

Say ten or so of these, one at a time, waiting for the model each time:

- *"move the checkout screen to the left"*
- *"put the release notes next to the checkout screen"*
- *"make the red one bigger"*
- *"select the release notes"*
- *"show me the checkout screen"*
- *"undo that"*
- *"add a note that says ship on Friday"* — must escalate
- *"move the red one and then make it smaller"* — must escalate
- a mumble, a half sentence, a "hmm, let me think" — must escalate

**After each turn you should see** a dim line like:

> fast path (shadow, did nothing): Jev would move “Checkout screen” left · p 0.74

**You should NOT see** anything happen twice. The live model acts as it always
does; the shadow line is a note. If an item moves, resizes or disappears
*without* the model's own `move_item → done` row beside it, **stop: the shadow
acted**, which is the one thing it must never do. That is a bug with a
reproduction — write down the sentence.

**If the line says** *Jev could not be asked — this home has no judge*, the
home has no `TYPESAFE_API_KEY`; go back to step 1.

## 4. Take one back

Ask the model to move something, then within ten seconds press **⌘Z** (or say
*"undo that"*). Do it twice more with different items.

This is the label the whole record exists for — an act a person takes back was
a wrong act — and it is the half no test can produce.

## 5. Take the record

Stop the session. Open ⌘K → **Configure voice** again.

**You should see:** `N turns recorded in this browser` with **Download** and
**Clear**. Press **Download**: the browser saves `fast-path-shadow.jsonl`.

Then read it:

```bash
node --import tsx packages/modules/talk/scripts/fast-path-eval.ts --record ~/Downloads/fast-path-shadow.jsonl --out /tmp/fp-record
```

**You should see** a report: agreement with the model's un-undone acts, per
action; the reliability curve; latency (Jev's own round trip) and cost. The
three turns you took back should score as **wrong if Jev agreed with the model
and unscored otherwise**.

## 6. The one number only this walk can produce

Open the file and look at each turn's `timing`: `lastHeard` (the last piece of
your words, ms from the first) and `firstCall` (the model's first tool call).

**Write down how many turns have `lastHeard` greater than `firstCall`** — the
transcript still arriving after the model had already acted. Phase 7 has to
answer before the model does; if the words routinely finish arriving after the
model's call, phase 7's design changes (it would have to hold the model's call
until Jev answers, rather than racing it). The scripted set cannot measure
this: it types whole sentences.

---

## Where the record lives, and what it holds

In **this browser's OPFS**, under the page's origin, at
`voice/fast-path-shadow.jsonl` — the store the voice-agent page already uses
for its own memory. Never on the canvas, never on the home. At most 500 turns;
the oldest go first. Each turn holds what you said, Jev's answers with their
probabilities, the model's tool calls (with item ids), the titles of the items
the turn mentions, and timings. **Clear** empties it; so does clearing site
data.

## What this walk does not cover

- **The standing voice agent** (`packages/voice-agent`). The shadow runs in
  the canvas's own mic only; the standalone page has no switch.
- **Acting.** Nothing in phase 6 acts, by design. Phase 7 is where Jev's
  answer is executed — through the same `runTool` the model's call uses — and
  it will need its own walk.
