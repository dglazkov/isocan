# The fast path acting — say a move, and it is done

**Status: `unverified`.**

**What you need:** everything [talking to the canvas](2026-09-20-talk-on-canvas.md)
needs (a microphone, speakers, a Gemini API key), plus **a home with a judge**
— a home started with `TYPESAFE_API_KEY` in its environment, or isocan.io,
whose home already has one. Twenty minutes.

**Why this page exists.** Voice-agent phase 7 lets Jev ACT. On every spoken
turn Jev is asked — once, through the home, never with a key in the browser —
which simple act you meant. When the act is a **move** and every answer is at
least as sure as the measured threshold (`p ≥ 0.63`, read off 197 scripted
commands), the item moves at once, through the same code the live model's own
`move_item` uses, and the transcript says so: *moved “Checkout” left — say
undo*. The model's own calls for that sentence are held while Jev decides
(never longer than 1.5 s) and then answered "already done", so nothing moves
twice. Everything else — deletes, resizes, aligns, anything with a number in
it, anything Jev is unsure of — goes to the model exactly as before.

The scripted proof ran every command against a real daemon: 64 acted, and
61–63 of them were the act meant (Jev varies run to run — the misses were
"the blue one" when two things are blue, and "below Home" read as "down"),
every one a single operation that one undo took back; 133 escalated and wrote
nothing. What no script can say is whether it **feels**
instant when you talk, whether the words finish arriving before the move, and
whether it ever moves the wrong thing. That is this walk.

---

## 1. Get to a canvas with a few things on it

Follow steps 1–6 of [talking to the canvas](2026-09-20-talk-on-canvas.md),
with one change if you use a local home: **start it with a judge.** Before the
first `isocan` command of step 2, in the same terminal:

```bash
set -a; source ~/.config/secrets.env; set +a
```

(That is Dion's machine; anywhere else, `export TYPESAFE_API_KEY=…` with a key
of your own.) Put at least four things on the canvas with different names — a
screen called *Checkout*, one called *Home*, a note, a sketch — so "left of
Home" has something to mean.

## 2. Turn the fast path on

Open ⌘K → **Configure voice** (or ⌘-click the composer's mic).

**You should see:** three choices — **Fast path off** (picked), **Fast path in
shadow**, **Fast path acting**. Pick **Fast path acting**.

**You should see** the line under it change to say a move Jev is sure of is
done at once, and that the model holds its own calls for at most 1.5 s. It
takes effect on the **next** session: if one is running, stop it.

## 3. Talk to it — ten commands

Start a session. **You should see**, among the first lines:
*fast path acting — move done at once when Jev is sure; everything else goes
to the model*.

Say these one at a time, waiting for each to finish. After each, write down
three things: **did it feel instant** (yes / no), **what the transcript said**
(a `fast path: moved …` line, or the model's own `move_item → done`), and
**did it do the right thing**.

1. *"move the checkout screen to the left"*
2. *"put home to the right of checkout"*
3. *"move the note above home"*
4. *"undo"* — **must** take back the last move (it goes to the model, which now
   undoes instead of refusing)
5. *"push the sketch down a bit"*
6. *"move checkout 300 pixels to the right"* — **must** go to the model (a number)
7. *"make the note bigger"* — **must** go to the model (no measured threshold for resize)
8. *"delete the sketch"* — **must** go to the model; then say *"undo that"*
9. *"move the red one and then make it smaller"* — **must** go to the model
10. *"hmm, let me think"* — **must** do nothing

**When the fast path acts you should see**, in this order: the item moves,
then a line *fast path: moved “…” … — say undo*, and the model says it is done
**without** a second move. If an item moves **twice** — once on the fast
path's line and again on a `move_item → done` row — **stop: the duplicate was
not dropped.** Write down the sentence.

**If you see** *fast path: no answer in 1500 ms — the model has it*, Jev was
slow; the model did it. Note how often.

## 4. Take one back by voice

After any fast-path move, say *"undo"*. **You should see** `undo → done` and
the item go back where it was — one step, not two.

Then press **⌘Z** after a fast-path move instead. **You should see** the same.
(Both take back *your* last change: the voice writes as you, so if you dragged
something yourself after the move, that drag is what goes first — say whether
that surprised you.)

## 5. Take the record

Stop the session. Open ⌘K → **Configure voice** again. **You should see**
`N turns recorded in this browser` with **Download** and **Clear**. Press
**Download** (`fast-path-shadow.jsonl`), then read it:

```bash
node --import tsx packages/modules/talk/scripts/fast-path-eval.ts --record ~/Downloads/fast-path-shadow.jsonl --out /tmp/fp-record
```

**You should see**, at the end, a section *The fast path acting*: how many
turns acted, escalated or were released at the deadline; how long the model's
calls were held (p50, p90); last word → act; and **words still arriving after
the act: N of M**.

## 6. The numbers only this walk can produce

Write down:

- **words still arriving after the act** — if it is more than one in ten, the
  fast path is acting on half-sentences and the 300 ms quiet that decides "the
  words are done" is too short;
- **the hold** (p90) — the delay a person pays on every command the model
  handles while act mode is on;
- for each turn that acted, `fast.acted` beside `timing.firstCall` — how far
  ahead of the model the move landed. That is the latency the fast path exists
  to save, and nothing but a real conversation measures the model's side.

## What to report

For each of the ten: instant or not, fast path or model, right or wrong. Then
the three numbers above. One wrong fast-path move is a finding worth a
sentence: the phrase, the item it moved, the item you meant.

---

## What this walk does not cover

- **The standing voice agent** (`packages/voice-agent`). The fast path runs in
  the canvas's own mic only.
- **Any act but `move`.** Only `move` has a measured threshold; the others
  stay with the model until a record shows 95% on 30 for them.
