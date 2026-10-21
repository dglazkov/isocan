---
status: partial
since: 2026-10-14
see: design-partner, wireframes, standing-agents, personas, version-diff, copy-edit
note: "A proactive agent: an agent on the canvas that works beside a person rather than over them, and teaches the language of design as it goes. Its work arrives as proposals, dashed and hanging beneath what they came from, each citing what prompted it and saying why in design words; a delete is one key and teaches it something. Nine moments: the night watch and the morning review, explain this item, the brief as a card, changes ripple, stuck detection, critics in the room, walking a flow as someone else, and saying it like a designer. Scenes here; the mechanism is design.md; the walk is phases.md."
---

# A proactive agent — the scenes

**14 October 2026.** Dion asked for *"specs for each of the features that
make sense, in GitHub issues / plates format"*, from a set of concepts for an
agent that guides a person through design work the way a good designer
would: one that understands what they are making, says something at the
right moment rather than every moment, and leaves the person better at
saying what they mean.

isocan has most of the parts. Agents already stand on a canvas and answer
when summoned (`isocan rc`), make variations that remember their parent,
fold a winner back (`choose`), draw a screen they were unsure of as a
dashed *maybe* (wireframes), keep a design brief whose facts say whether
somebody stated them or an agent assumed them, and ask design questions
with pictures. What none of it does is **speak first**: every agent in
isocan waits to be asked. These scenes are the moments an agent should
speak first, and the one grammar that keeps that from becoming noise.

Three principles hold every scene:

1. **The person learns to speak design** by seeing their own work described
   in it, never by a tutorial.
2. **The agent behaves like a designer colleague**: it leaves work beside
   yours with a note, it does not overwrite your file.
3. **Ideas are cheap to delete**, so the agent builds and explains rather
   than asking permission to think.

The fixture throughout is synthetic: **Acme Bakery**, a pre-order app for a
neighbourhood bakery, on a canvas Maya owns, with Ravi as a teammate and
Kit, a standing agent enrolled on the canvas.

## Scene 1 — A proposal, and a delete that teaches

Kit thinks the checkout screen should show the pickup time before the
total. It does not edit Maya's screen. A copy of the screen appears below
it, framed in a dashed blue line, joined to the original by a connector. A
small ochre chip on the frame says what prompted it: *Ravi's comment, "people
miss the pickup slot"*. One line under it says why, in design words:
*"Summary before detail: the decision the person must check comes first."*
"Summary before detail" is dotted-underlined; hovering it says what it
means.

Maya presses **Keep**, and the proposal becomes the next version of her
checkout screen; the dashed copy is gone. On a second proposal, a sketchy
wireframe that adds a sign-up step before the menu, she presses Delete.
One key, no dialog. A line appears in the Chat: *"Noted: no gates before
value."* The note joins a short list, **What your deletes taught**, which
she can open, edit or clear. Kit reads it before it proposes anything
again.

**What makes this right:** nothing of Maya's moved. The confident proposal
was drawn finished and the hunch was drawn as a wireframe, so she knew how
hard to look before reading a word. And the delete cost her nothing and
told Kit something.

## Scene 2 — The night watch

At six Maya types `/goodnight` in the Chat (or presses *Hand off* when she
closes the tab). Kit writes a handoff note on the canvas:

- **Settled today:** the menu layout (she chose a variation), the brand
  colour (a DESIGN.md version).
- **Left open:** the empty basket state; *"not sure about the red"*, which
  she said in passing at three.
- **Tonight I will:** a ticked, editable list. *Three takes on the empty
  basket, one of them a sketch. Check the red against contrast on every
  screen. Only watch the checkout thread.* Each line names its budget.
- **Will not touch:** anything settled today, the design system, her
  originals.
- **Leave a thought**, and **ready by 8:00**.

Under each screen a promise concerns, an empty dashed frame appears, so she
can see tomorrow's shape before she leaves. She unticks the contrast check;
it stays an offer, not a promise.

**What makes this right:** the work overnight is consented to, item by
item, and the return visit has a reason and a time.

## Scene 3 — The morning review

Maya opens the canvas at 8:10. Her screens are where she left them. The
empty frames are filled: three takes on the empty basket, two drawn
finished and one a wireframe, each with its trigger chip and a two-line
why. A short brief in the Chat, ordered by how much Kit would bet on each:

> *Two takes I'm confident in, one hunch. I left Ravi's note about delivery
> alone: it's a business decision, not a design one. The contrast check
> was not promised, so I didn't run it.*

One promise failed: the frame under the order-history screen says *"Nothing
worth showing: every take I tried broke the list's scan line. Here's the
one I'd have shown."* An empty frame never stays empty without a reason.

**What makes this right:** a cap of five, the restraint said out loud
("left alone"), and failure reported plainly, so the three that did arrive
are worth reading.

## Scene 4 — Explain this item

Ravi joins the project late. He selects the checkout screen and chooses
**Explain**. A panel opens beside the canvas (Escape closes it) with:

- **How it got here:** not fifty versions, the four that mattered, each a
  named move with who made it and the reason given at the time ("Maya chose
  variation B: shorter form"). Pins tie each move to a place on the screen.
- **The roads not taken:** the two variations Maya did not choose, still
  in the trash, one click from being seen again.
- **What has moved around it since:** the design system's primary colour
  changed after this version; the order-history screen now uses a different
  word for "pickup".
- **Speak design:** phrases typed about this screen beside how a designer
  would say them ("make the total more obvious" → *raise it in the visual
  hierarchy*).

He can copy the explanation onto the canvas as a rationale for somebody
outside the team.

## Scene 5 — The brief, as a card

A card sits at the top of the Acme canvas: **Making** a pre-order app.
**For** regulars who order weekly. **Should feel** warm, quick. **Never**
pushy. **Constraints** pickup only. **Right now** refining. Lines Maya said
have a solid rule; lines Kit inferred have a pencil rule and *Right* /
*Wrong* beside them.

Every proposal's chip says which line it answers (*cites · For*). When Maya
changes **For** to *"regulars, and weekend first-timers"*, nothing on the
canvas changes. Each screen is sorted instead: *still holds*, *assumed the
old line*, *matters more now*. Kit asks one question: *"As well as
regulars, or instead?"*

## Scene 6 — Changes ripple

Maya spends twenty minutes on the menu screen and stops. A minute later Kit
reads her edits back as three decisions: *anchored the primary action;
summary before detail; a tighter type scale*. Then it shows every other
screen as it would look after those decisions, changed regions outlined and
tagged, in three states: **would change**, **already in sync**,
**disagrees, your call**. For Profile it argues for the exception: *"a
settings list, not a decision screen."* Maya chooses the altitude: put the
type scale in the design system, go screen by screen, or mark the menu a
one-off so Kit stops asking. Nothing changes until she does.

A row of ticks in the canvas's top bar, one per screen (current, behind, in
conflict), is the quiet proof that nothing was left behind.

## Scene 7 — Stuck

Maya asks Kit for a new header four times in ten minutes, each ask shorter
("again", "no"), undoing each result. The fifth time Kit does not make one.
It says it has been guessing, and what it noticed: *"You kept the photo
every time. You undid the colour twice."* It asks with pictures: four
now-and-instead pairs (density, brand expression, layout, tone of voice),
its own guess highlighted, and two ways out: *show me extremes*, or *name a
product that gets it right*.

## Scene 8 — Critics in the room

Maya switches on two critics for the canvas: **The Reductionist** (*cut
until it breaks, then add one thing back*) and **The Brand Voice** (*would
you know whose app this is with the logo covered?*). They speak only when
asked, or before she shares. She asks for a crit of the home screen. Pins
land in each critic's colour. Kit does not forward six notes; it says where
they **agree** (the hero image is too tall), where they **split** (the
promotion banner: cut it, or make it braver) and what is a **blocker**
(none). On the split it offers *build both*: two proposals, each tagged
with the critic it answers. Critics never edit; only Kit acts, and only
when Maya says.

When Maya runs `isocan share`, the same room runs a desk check first:
contrast, touch targets, words against the Voice, screens behind the design
system, and any critic set to *before I share*.

## Scene 9 — Walk it as someone else

Maya asks Kit to walk *"order a loaf for Saturday"* as other people. Lanes
appear, one per walker, each drawing the screens as that person meets them:
one-handed on a bus (a thumb-reach overlay), low vision in sunlight (the
screens blurred and washed out, so the problem is seen, not read as a
ratio), a screen reader, a first-timer. Stumbles are pinned where they
happen, and each lane ends *made it*, *stumbled* or *gave up*. Kit calls out
the stumble that trips three walkers at once ("Edit" on checkout) and
proposes one fix. The panel says plainly that these are simulations, and
what they do not replace.

## Scene 10 — Say it like a designer

Maya types *"make the header pop more, it feels cramped"* in the Chat. Two
words get a dotted underline: *pop* and *cramped*. Hovering *pop* shows
three readings on her own header: more contrast, more scale, more colour.
She picks contrast by looking. Kit offers the sentence a designer would
say, *"raise the header's contrast and add space between the sections"*;
Tab takes it, Return keeps her words, and both are fine. Most messages get
no underline at all, and the underlines grow rarer as her asks get
sharper.

## What it never does

- It never overwrites a person's work. A proposal sits beside its source
  until somebody keeps it.
- It never proposes without a trigger it can cite.
- It never speaks over a run of edits.
- It never makes more than it said it would: five proposals, and the
  budget each promise named.
- It never lets a critic or a walker act. They are guests; one agent
  synthesises and acts, and only when asked.
- It never grades the person.
