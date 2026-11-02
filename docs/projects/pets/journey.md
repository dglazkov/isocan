---
status: built
since: 2026-10-01
see: bench, standing-agents, agent-custody
note: "A pet follows its owner: an agent from your bench, marked as your pet once, joins every canvas you open and can edit, says so in the thread, and answers only you unless you widen it. One switch on the bench row turns following off. First the rc must notice canvases it was invited to while running. The sheepdog note (docs/research/2026-09-04-sheepdog.md) is the ancestor; this is its stage 1 rebuilt on the bench."
---

# Pets — the journeys

**1 October 2026.** Dion: *"make it so pets follow (Scout etc)"*, after finding
Scout absent from the canvas he was working on. The sheepdog note
(4 Sep) designed a pet — whose it is, whom it listens to, whether it is on —
and only the middle fact was ever built (`rc listen`, owner-only summons since
11 Sep). The bench (15 Sep) gave a person a list of the agents they have and
`agent.invite` to bring one to a canvas. This walk joins them. Acme content
only.

## Scene 1 — An invite the rc actually hears

Dion's Scout runs as `isocan rc --all` on a machine across the room. From the
browser Dion types `@Scout join` on *Acme launch*, a canvas that machine has
never parked on. Within a minute the machine's rc says *answering on "Acme
launch"*, and Scout's bench row reads **ready**. Before this walk the invite
landed and nothing answered: `rc --all` only ever parked where it was started.

## Scene 2 — Scout is my pet

On his bench Dion marks Scout **follows me** (in the agents panel, or
`isocan bench follow Scout`). It is one fact on one bench row — not an
enrolment per canvas — so turning it off is one act, and nothing anywhere is
withdrawn when he does.

## Scene 3 — It follows

Dion opens *Acme roadmap*, which Scout has never been on. A moment after the
canvas loads, Scout is in the facepile and the thread says *Scout came with
Dion*. He opens a canvas shared with him **read-only**: Scout does not come,
and nothing is said. He opens a canvas where somebody **removed** Scout last
week: Scout does not come back — a removal is the room's word and a pet
respects it. Mira, a guest on *Acme roadmap*, mentions Scout: she is told in
the thread that Scout listens to Dion, and no turn is spent.

## Scene 4 — Off

Dion turns *follows me* off. New canvases he opens no longer get Scout; the
canvases Scout already stands on keep him, because turning a pet off is not
the same as sending it away.

## What the scenes force

- A running rc discovers canvases where its agents are enrolled or invited,
  and parks there without a restart.
- `follows` is a field on the bench row: one item, one op to flip.
- Following sends the existing `agent.invite` (no new op), only on canvases
  the owner can edit, never where the agent was withdrawn, and posts the
  same kind of line `@Name join` posts.
- The listen gate stays owner-only for a new row (the reducer already writes
  no `rules` on an invite).
