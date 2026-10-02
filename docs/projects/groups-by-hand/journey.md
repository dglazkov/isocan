---
status: built
since: 2026-10-01
see: canvas-groups
note: "Working with groups by hand, as scenes: hover that says what a press takes, ⌘ that takes one item and lets it leave, a lift while you drag, a drag others watch live, and a group shown as a stack. The design and its evidence are docs/research/2026-10-01-groups-stacks-lift.md; the walk is phases.md. Phases 1 (the lift) 2 (⌘ takes one item, hover that says what a press takes), 3 (others see the drag live) and 4 (stacks) closed 1 Oct 2026; every scene is built."
issue: 373
---

# Groups by hand — the journeys

**1 October 2026.** The ideal, as scenes. The argument, the measurements and
the prototype are in
[the research note](../../research/2026-10-01-groups-stacks-lift.md); this page
is what a person should be able to do when the work is done. Acme content only.

## Scene 1 — Aiming

Mara has an *Onboarding* group of four screens. At the canvas level she points
at *Sign up*: the dashed outline goes round **the group**, because a click there
takes the group. She moves into the space between *Sign up* and *Welcome*,
still inside the frame: the group stays outlined. She holds ⌘ and the outline
jumps to *Sign up* alone. What the outline says is always what a press takes.

## Scene 2 — Taking one out

Still holding ⌘, she drags *Sign up*. It rises off the canvas with a deeper
shadow, the same size, exactly where her hand is. As she crosses the frame's
edge a pill says *Out of Onboarding*; over the *Archive* group it says *Add to
Archive*. She lets go on open canvas. *Sign up* is on the canvas, Onboarding
says three items, and one ⌘Z puts it back. Without ⌘ the same drag would have
grown the frame instead, as it always has.

## Scene 3 — Watching it move

Theo has the same canvas open. While Mara drags, Theo sees *Sign up* travel
with Mara's cursor, lifted and edged in her colour, rather than sitting still and
then jumping. When she lets go it settles where she put it. If Mara's laptop
had dropped off mid-drag, the card would have glided home on Theo's screen.

## Scene 4 — A stack

Mara presses *Stack* on *Archive*. Seven screens become a pile: one card
upright in the middle, the rest turned and nudged behind it, tinted with their
own colours. Theo sees the same pile, turned the same way. Pointing at it fans
it into a hand; clicking opens it into a grid she can ⌘-drag a card out of.
Esc closes it. Tomorrow it is still a stack. *Spread* puts every screen back
exactly where it was.

## What the scenes force

- One function decides both the hover outline and what a press takes.
- ⌘-drag sends the existing `transform` with `containerId`; `null` is the
  canvas. No new op.
- A drag in progress travels on presence and is never an op; it cancels
  against where the drag began.
- Stacked is a `GroupLayout` field, shared and stored; fanned and opened are
  never stored. Members' positions do not change when stacked.
- The pile's turns are a pure function of the item ids.
