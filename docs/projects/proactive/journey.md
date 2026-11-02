---
status: designed
since: 2026-10-13
see: design-partner, wireframes, standing-agents, on-demand, design-competition, memory, local-judge, judge, version-diff, design-lint, evals
note: specified 13 Oct 2026 from a brainstorm of ten drawn concepts. An agent that proposes without being asked, and teaches design words as it does. One primitive carries all of it — a proposal, an item that hangs under the screen it came from, drawn dashed, never replacing anything, citing what triggered it, at a fidelity that shows its confidence, deleted with one key and remembered when it is. Checked against the code first, then read against the concept canvas; most of the handoff's mapping onto existing features was wrong or partial, and the design says where. Nothing is built; phase 0 is the proposal primitive, on both surfaces.
---

# The agent that proposes

This is the **ideal**: what it feels like when the agent on a canvas stops
waiting to be asked. It notices, it offers, it says why in the words a
designer would use, and it is easy to say no to. The mechanism is
[`design.md`](design.md); the walk is [`phases.md`](phases.md).

The scenes are synthetic. Marlow is a made-up bakery's pre-order app, and
every number and quote in it is invented.

Three things the brainstorm asked for sit behind every scene:

1. Using the product should teach a person to **speak design**.
2. The agent should **feel like a designer** working beside them.
3. Deleting an idea is cheap, so the agent should **build and explain**.

---

## Scene 1 — A proposal under the screen

Priya has four screens for Marlow, and an agent she parked on the canvas this
morning with the words *watch for things worth proposing*. She retitles a
button on the order screen and goes to make coffee.

When she comes back, her four screens are exactly as she left them. Beneath
the order screen hangs a fifth, in a **dashed blue frame**: the same screen
with the pickup time moved above the fold. An ochre chip on the line joining
them reads *your edit · "Order for pickup"*. Two sentences sit beside it:
*The pickup time is the decision this screen exists for, so I raised it in
the <u>visual hierarchy</u>. It was below the fold on a phone.* The underlined
term opens a one-line definition where it stands.

She presses Backspace. The proposal goes. A line appears in a small card
called **Taste**: *noted: keep the order summary above the pickup time.* The
card is hers to edit, and she corrects it to say what she meant.

**What the scene forces:** a proposal that is a thing on the canvas, never a
change to her screen; drawn so it cannot be mistaken for her work; carrying
what triggered it; explained in design words defined in place; gone in one
key; and a delete that leaves a note she can see and change.

## Scene 2 — "Make it pop"

Ravi types into the Chat: *make the header pop*.

As he types, *pop* gains an underline, and the sentence a designer would
have typed appears as ghost text: *increase the header's contrast against
the page*. Tab takes it. He presses Enter on his own words instead, and that
is fine: nothing is graded and nothing waits.

The header comes back with more contrast — the first reading. Beside it
hang two hunches, pale and dashed: the same header by **scale**, and by
**colour**. He learns the three words by looking at them on his own screen,
and deletes two.

**What the scene forces:** only the ambiguous word is touched; the readings
are shown on his own work, not described; the designer's sentence is offered
and never imposed; and asking never stands between him and a result.

## Scene 3 — Stuck

Priya has asked for the menu screen four times in six minutes: *cleaner*,
*less busy*, *simpler*, each undone within seconds.

The fifth request does not generate. The agent says so: *I have been
guessing. You kept the photo every time and removed what I added around
it.* Four tiles follow, each a now-and-instead pair on her own screen:
**density**, **brand expression**, **layout**, **tone of voice** — with the
agent's own guess marked. Two ways out sit beneath: *show me extremes* and
*name a product that gets it right*.

**What the scene forces:** "stuck" is something the canvas can compute from
what it already records; the agent's response to it is to stop spending and
ask; and what it observed is said plainly, from behaviour.

## Scene 4 — The handoff, and the morning

At six Priya types `/handoff`. The agent writes a note: **settled today**
(what she kept), **left open** (what is unresolved, including a doubt she
voiced in passing: *not sure about the red*), and **tonight I will** — a
ticked list she can edit:

- *Draw three takes on Home for a first-timer* — at most three, one of them a
  sketch.
- *Fix the Menu contrast the critic flagged* — one proposal.
- *Watch whether the new Checkout loses fewer people at the address* — a
  report only, no design.
- unticked: *Draw empty states for five screens* — not unless she ticks it.

Below: **I will not touch** anything she settled today, the design system,
or her originals. A line to leave a thought for the night. *Ready by 9:00.*
On the canvas a dark lane opens with an empty dashed frame for each ticked
line, hanging under the screen it concerns.

In the morning her screens are where she left them, and the note says so
first: *nothing of yours changed.* Two frames are filled, the surer one
drawn finished and the other as a sketch. The watch frame holds a
sentence and a number. One take is missing, and its frame says why: *the
budget ran out before the third.* A short brief orders them by how much
the agent would bet on each, and a **left alone** list names what it saw
and chose not to act on.

**What the scene forces:** unattended work is something a person launched,
line by line, with a count and a price on each; a promise may be to look
and not to draw; the morning fills exactly the frames promised; a promise
that fails says so; and what was settled is not touched.

## Scene 5 — Two critics, one voice

Ravi switches on two critics for the order screen: *Less but Better* and
*Form Follows Emotion*. They leave pins on the screen — one colour each —
and never change it. The agent reads the room in three lists: **agree** (the
price is too quiet), **split** (one wants the photo gone, the other wants it
larger), **blocker** (none). Beside the split is a button: *build both*.

**What the scene forces:** critics are guests who cannot edit, and that is a
permission, not a promise; a disagreement is shown, never averaged; and only
the lead agent acts.

---

## What the scenes force

The load-bearing minimum, which is what to read before building anything
here:

1. **One primitive: the proposal.** An item on the canvas that names the item
   it came from, is drawn dashed, and never replaces anything. Keeping it is
   an ordinary act on the source; deleting it is one key.
2. **Every proposal cites its trigger**, as a reference a person can follow.
3. **Fidelity is confidence**, on one scale, and the lowest band is listed
   rather than drawn.
4. **A delete teaches**, into a note the person can see and edit.
5. **The agent's words are design words**, defined in place from one
   glossary.
6. **One lead voice, with its restraint visible**: a cap, a *left alone*
   list, a *will not touch* list.
7. **Nothing runs that nobody launched.** A trigger wakes only an agent a
   person parked and told to watch, or makes an offer inside a turn the
   person already started; unattended work is launched by the handoff note,
   with a budget per line.
