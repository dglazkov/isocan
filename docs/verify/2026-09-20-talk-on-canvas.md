# Talking to the canvas itself

**Status: `unverified`.**

**What you need:** a microphone, speakers or headphones, a Gemini API key, and
about twenty minutes. A terminal for steps 1–3, then only the browser.

**Why this page exists.** This is the *other* voice surface. The
[voice walk](2026-09-20-voice.md) covers `@isocan/voice-agent` — a standalone
page on its own port, with its key on disk, which `@mention` can summon. This
one is `@isocan/talk`: a mic **on the canvas**, a Live session opened from your
own browser with your own key. Same model, same tools, different door, and
nobody has spoken to either.

It is the more discoverable of the two, so it is arguably the one a stranger
meets first — which makes "can a person find it at all" part of what this walk
measures.

**Everything up to the microphone was walked on 20 September and the steps
below are what was actually on screen.** From step 6 on, nothing has been
tried by anyone.

**Partly walked, 22 September — on the build BEFORE that day's fixes.** Dion
held a live session on `isocan.io` and reported it worked: the session opens,
the provider answers, and the tools run. That is worth having and it is what
steps 6 onward are mostly about.

It is not a walk of what shipped later the same day, and the difference is the
point of saying so. `isocan.io` was serving `8da3956` at the time; `f7f83e3`
changed four things a person can only judge by using them, and **each one is a
thing the earlier session would have shown the WRONG behaviour of**:

| What to watch | Before (what was seen) | After (what should happen) |
| --- | --- | --- |
| The reply's colour | The wave turned the reply's colour early and briefly — the meter was fed when audio ARRIVED, not when it played | The colour tracks what you can actually hear |
| What it said | Only the last fragment: `Enceladus: you need on the canvas.` | The whole sentence, written across the panel as it is spoken |
| The wave | A short stub at the left of the bar | Bars across the full width of the row, rising with the glow |
| A burst of tool calls | Seven `move_item → done` rows filling the panel | One row and `×7` |

There is a fifth, and it is not visible in the panel at all: **the session
block posted to Chat no longer wakes every agent on the canvas.** To see it,
park an agent on the canvas, hold a session, stop it, and check the agent did
not begin answering your transcript.

---

## 1. Build the app

The mic is only as new as the build serving it. **isocan.io runs a deployed
build that may be days behind `main`**, so to check work that landed this week,
build locally:

```bash
npm run build
```

**You should see:** `✓ built in …`. A chunk-size warning is normal.

## 2. Start a throwaway home

Do NOT point this at your real home — the agent will move things.

```bash
export ISOCAN_HOME=/tmp/talk-walk
```

```bash
node packages/cli/bin/isocan.js --port 4446 identity --name "Walk Tester"
```

```bash
node packages/cli/bin/isocan.js --port 4446 canvas create "Talk walk"
```

**You should see:** `created canvas prj_…`. Keep that id.

## 3. Give it two things to talk about

```bash
node packages/cli/bin/isocan.js --port 4446 text "Checkout screen" --title "Checkout screen" --paper blue --at 600,200
```

```bash
node packages/cli/bin/isocan.js --port 4446 text "Release notes" --title "Release notes" --paper green --at 1100,600
```

## 4. Open the canvas and say who you are

Open **`http://127.0.0.1:4446/p/<the prj_ id>`**.

**You should see:** *"Welcome to isocan — pick a name"*. This is the identity
door, and a fresh browser always gets it. Type any name and press **Start**.

**You should then see:** the canvas, with `live` in the top bar.

## 5. Turn the mic on — it is off by default

Click your **avatar, top right**, and scroll the menu to **EXPERIMENTS**.
Tick **"Talk to the canvas"**.

**You should see:** a round **microphone button appear on the right of the
canvas**, just left of the tool rail. It was not there a moment ago; the module
is fetched when you tick the box rather than shipped to everybody.

**If no mic appears**, that is a finding — the module failed to load and the
experiment lied about turning on.

## 6. Give it your key

Press the **mic**.

**You should see:** a small panel — *Gemini API key* ("stored in this browser
only"), *Model* (already `models/gemini-3.8-live`), and **Save and start**.
The same panel is in ⌘K under **"Configure voice"**, if you prefer.

Paste your key and press **Save and start**. Your browser will ask for
microphone permission; allow it.

**Your key stays in this browser** — never on the canvas, never in the daemon.
A different browser, or a different port, will ask again.

---

*Everything below here is unproven. This is where the walk starts earning its
place.*

## 7. Does it hear you, and does it answer out loud

Say:

> *"What's on this canvas?"*

**You should see:** the button pulse and level bars move while you speak.
**You should hear:** a spoken answer naming Checkout screen and Release notes.

If you get bars but no answer, or an answer that cannot name the items, stop
and note which — those are different faults.

## 8. Does it act, and does it feel like a partner

> *"Move the green one next to the blue one."*

**You should see:** Release notes move to sit right of Checkout screen, with a
gap, middles lined up.

**Time it, roughly, and write down a word.** From the end of your sentence to
the card moving: does it feel like a beat in a conversation, or like waiting
for a remote control? **No machine can answer this**, which is the single
biggest reason this page exists.

## 9. Undo — and here this surface is deliberately different

> *"Actually, undo that."*

**You should hear:** it say plainly that it **cannot undo here**, and suggest
you undo yourself (⌘Z).

**You should NOT see:** the card move back.

**This is the step most likely to fail, and the most important one.** The
module host this surface writes through has no retract, so the standalone voice
page can undo and this one cannot. What stops it faking an undo — moving the
card back by hand, which looks like success and records a second change — is a
sentence in the tool's description asking it not to. **That is a request to a
model, not a refusal in code.** If the card moves back, say so: it means prose
is not holding, and the fix is a real capability rather than a better sentence.

## 10. Does it ask when it cannot tell

> *"Move the red one next to the blue one."*

There is no red item here.

**You should hear:** it ask which one you mean. It must not pick one and move
it.

---

## When something is wrong

Note **which step**, what this page said would happen, and what happened.
A step you had to interpret is also a finding — this page should need no
guessing, and if you guessed, say where.

## What this walk does not cover

- **The standalone voice agent** — [its own walk](2026-09-20-voice.md).
- **`@mention` summoning.** Not this surface; the standalone one.
- **Anything on a phone.** Untried, and the mic is a floating button on a
  canvas that pans under your finger.
