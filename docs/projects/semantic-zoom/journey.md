---
status: partial
since: 2026-10-13
see: canvas-groups
note: "Semantic Zoom, an experiment: zoomed out past where words can be read, a text node, a group or an area shows a short model-written summary of what it holds instead of an unreadable smear, kept until its content changes. Scenes here; the mechanism is design.md; the walk is phases.md."
---

# Semantic Zoom — the scenes

**13 October 2026.** Dion, after a text node too far away to read stopped
showing a lone "T" and started showing its opening words: *"What do you think
about a new feature... 'Semantic Zoom'. When it's too small to read, instead of
showing not much, we show a summary of the content? This can be of text
nodes... or it can be of groups of areas. We reason over the area and create a
summary and store it until something changes and we replace the semantic
summary. Can you spec this out and make it an experiment 'Semantic Zoom'?"*

Today, zooming out loses meaning in steps. Words shrink until they cannot be
read; then a text node shows its first line at a size you can read (13 Oct),
and a group or an area shows only its title strip, which shrinks with
everything else. A canvas of forty notes seen whole is forty first lines, or
forty grey blocks. Semantic Zoom is the next step down that ladder: the
farther out you are, the more each thing is described rather than drawn.

It is an **experiment**: off unless a person turns it on, in Settings →
Experiments, for themselves.

## Scene 1 — A long note, far away

Maya has a planning canvas. One text node is a page of meeting notes whose
first line is "Notes". Zoomed in, she reads it. She zooms out until the words
are grey lines. With Semantic Zoom off the node says **Notes**, which tells
her nothing. With it on, the node says, at a size she can read:

> *Q4 launch slips two weeks; Ravi owns the pricing page; open question on
> EU data residency.*

A small mark in the corner says this is a summary, not the words. She zooms
in and the real words come back the moment they can be read.

**What makes this right:** the summary appears only where the words cannot be
read, so it never stands in for words she could read herself, and it is
marked as a summary so nobody mistakes it for what the note says.

## Scene 2 — A group seen from across the canvas

Ravi zooms out until the whole canvas fits. The group "Onboarding flow" holds
eleven screens and four sticky notes; at this zoom its title is a few pixels
tall and its screens are thumbnails the size of stamps. Inside the group's
frame, counter-scaled so it reads, is two lines:

> *Eleven onboarding screens from sign-up to first project; the stickies flag
> the empty state and a confusing permissions step.*

He can tell at a glance which group is which without zooming into each.

## Scene 3 — An area on a board

A sprint board is laid out in areas: To do, Doing, Done. Zoomed out, each area
says what is in it:

> *Doing — 4 cards: the billing migration, two copy fixes, and the Safari
> crash Ana is on.*

An area's members are whatever sits inside it, so a card dragged from Doing to
Done changes both summaries.

## Scene 4 — Something changes

Ana edits the meeting notes. Nobody's view flashes or empties: everyone keeps
seeing the old summary, with a quiet mark that it is being brought up to
date, until the new one arrives a little later and replaces it. Ten more edits
in the next minute do not cost ten summaries; the summary waits for the note
to go quiet.

## Scene 5 — What it never does

- It never shows a summary where the words can be read.
- It never sends a model anything the canvas has marked excluded from context,
  and never anything a viewer cannot already see.
- It never spends somebody's model key without the rules that key already has:
  a view-only visitor to a public canvas sees summaries an editor's key paid
  for, and cannot cause one to be made.
- It never writes into the canvas's history. A summary is not an act anybody
  took; it does not appear in undo, the timeline or the oplog.
- An agent can read the same summaries from the terminal, and ask for one to
  be refreshed, with the same rules.
