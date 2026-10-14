---
status: partial
since: 2026-10-14
see: proactive, personas, design-competition, agent-custody, roles, design-lint, wireframes
note: specified 14 Oct 2026 as the first proactive experiment to build in full. A person asks for a critique the way they would ask a colleague, and one or more critics — personas that live on the canvas, seeded from design-competition's nine packs — look at a screen, pin notes where they see something, and never change it. With two or more, one lead voice says where they agree, where they split, and what blocks. Built from what exists: the persona format and its parser, the packs' critique.md, the template-and-enrol path competitions already use, and threads anchored to a point on an item. Two things are new: a ceiling on one agent's claim so a critic is refused at the door if it tries to edit, and a fold that reads critics' notes into agree / split / blocker. Phase 0 CLOSED 14 Oct 2026: `isocan critic add|new|ls`, critics as persona items on the canvas, drawn as cards behind the `critique` experiment. Phase 1 PART-DONE the same day: `isocan critique <item> --by <critic>` summons a critic that pins typed notes and leaves the screen unchanged, walked once on a real harness; the dollar cap awaits a harness that reports cost.
---

# Critique

This is the **ideal**: asking for a critique of a screen should feel like
asking two people whose taste you trust to look over your shoulder. They
point at things, they say what they think and why, they never touch the
work, and when they disagree you hear about it. The mechanism is
[`design.md`](design.md); the walk is [`phases.md`](phases.md). It is the
first experiment from [`proactive`](../proactive/journey.md) to be built in
full, and it is that project's *Scene 5*, made precise.

The scenes are synthetic. Marlow is a made-up bakery's pre-order app.

---

## Scene 1 — Asking one critic

Priya has the Marlow checkout screen on a canvas. She types into the Chat:

> @Inevitable what do you make of #Checkout?

A cursor labelled **Inevitable** arrives at the screen. It does not ask
anything. Within a minute three small pins appear on the screen, graphite,
each where it is looking: one on the two filled buttons, one on the address
block, one on the order total. Each pin opens a note:

> **Risk** · *What could go until what is left feels inevitable?*
> Two filled buttons compete for the one action this screen exists for.
> Keep *Pay*; make *Save for later* a text link.

The last note is different:

> **Working** · *Does the interface defer to the content?*
> The total leads, in the largest type on the screen. Leave it.

The screen itself is untouched. Its version is the one she left.

**What the scene forces:** a critic is summoned the way any agent is, by
name; it reads the screen, not a description of it; each note sits at a
place on the screen; each says which of the critic's own questions it comes
from; *working* is a finding as much as *risk*; and nothing is changed.

## Scene 2 — Where the critic comes from

Before asking, Priya had opened **Critics** on the canvas and added two from
the list: *Inevitable* and *Form Follows Emotion*. Each became a card on the
canvas: its three questions, what it looks for first, how it ranks, and a
credit line — *after Jony Ive's work; not affiliated*. She edited
*Inevitable*'s card, adding a fourth line: *ignore the colour palette; that
is decided.*

Ravi, on the same canvas, writes a critic of his own: *The Counter Clerk —
asks whether someone queuing at 7am could do this one-handed.* It is a card
like the others, and it is summoned the same way.

**What the scene forces:** a critic is a thing on the canvas a person can
read and change, in one format whether it came from the shipped roster or
was written by hand; its name is a principle, never a person's; and an edit
to it changes the next critique.

## Scene 3 — Two critics, one voice

Priya asks:

> /critique #Checkout with Inevitable and Form Follows Emotion

Two cursors, two colours of pin. Neither critic sees the other's notes while
it works. When both are done, one reply arrives in the thread, from the
agent she asked:

> **They agree** the price is too quiet next to the photo (2 notes).
> **They split** on the photo: *Inevitable* would cut it; *Form Follows
> Emotion* would make it larger and warmer. That is *reduction* against
> *brand voice*. [Build both]
> **Blocker:** none.

She presses **Build both**. Two variations of the checkout appear beside
it, one without the photo and one with it larger, each citing the critic it
answers.

**What the scene forces:** critics are independent, so a split is real and
not negotiated; the synthesis is one voice and says the tension in design
words; a split is shown, never averaged; and acting on it is the person's
choice, made in one press.

## Scene 4 — The critic that tried to help

A critic, carried away, tries to fix the button it complained about. The
attempt is refused by the canvas, not by the critic's instructions: the
critic's claim on this canvas allows notes and nothing else. The refusal is
recorded, and the critic's note says what it would have changed instead.

**What the scene forces:** "critics never edit" is a permission the home
enforces, not a sentence in a prompt.

---

## What the scenes force

1. **A critic is a persona that lives on the canvas**, in the persona format
   this repository already reads, seeded from the packs' `critique.md`, and
   editable like any card.
2. **It is summoned like any agent**, by name in the Chat, by a command, or
   from a screen's menu, and runs on the person's own agent runner.
3. **A note is pinned to a place on the screen** and carries its kind
   (working, risk, blocker), the question it comes from, and one move.
4. **A critic cannot edit**, and that is enforced at the door.
5. **Critics are independent**, and **one voice synthesises** into agree,
   split and blocker. A split can be built both ways.
