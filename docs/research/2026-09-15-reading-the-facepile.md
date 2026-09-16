---
status: designed
since: 2026-09-15
issue: 309
see: ui-refresh, bench, standing-agents, on-demand, roles
note: asked 15 Sep 2026 after an hour of watching a facepile of identical blue discs and being unable to tell an agent from a person, or a reachable agent from a dead one. The proposal is one channel per question — hue and glyph say WHO, a separator says person-or-agent, lightness says reachable, ring thickness says busy — and Dion's refinement is the best part: an agent wears its OWNER's colour, so "whose agent is that" is answered by the same glyph that says what it is. The colour goes on the RING rather than the fill, because `face.ts` already learned that an emoji on a saturated disc fights it.
---

# Reading the facepile

**15 September 2026.** A design note. Nothing built.

> *"How do I make Dolly show up with a sheep emoji? In fact, when I look at the
> top right, we can do more to separate out the people from the agents… Maybe a
> `|` between. And can you think about how best to use: border colors, border
> thickness, light colors vs dark colors, emoji."*
>
> *"I kinda like the idea of having agents be emoji inside the color of the
> person who owns it, and humans being the letter with the solid color."*

Asked after an hour of real use in which the facepile showed a row of
near-identical discs while the canvas held two people, four agents, two rcs and
one sheep in a container — and none of that was legible from the pile.

## The problem, stated once

**Every face answers the same question and no others: who is this.** Everything
else a person actually wants from that row — is that a human, is it reachable,
is it doing something right now, whose is it — is either absent or spelled in a
tooltip nobody opens.

The states already exist. `roster()` computes eight (`blocked`, `working`,
`parked`, `quiet`, `here`, `answerable`, `enrolled`, `away`) and is shared by
`isocan who`, the tray, the workbench and the bench. The facepile spends none
of them.

## The rule: one channel per question

The failure mode of a redesign here is a face that encodes four things at once
and reads as noise. So each question gets exactly one channel, and no channel
carries two questions.

| Question | Channel | Why that one |
| --- | --- | --- |
| **Who is this?** | hue + glyph | Identity is what a person recognises fastest, and it is the only thing that should own colour. |
| **Person or agent?** | the **separator**, plus letter-vs-emoji | Structural. Answered once for a group rather than decorated onto every face. |
| **Can it be reached?** | **lightness** | Dion's own instinct: light means not there, solid means there. |
| **Is it doing something?** | **ring thickness** | Thickness reads as a scalar, so it maps to a progression rather than a category. |

## Dion's refinement, and the correction it needs

> *"agents be emoji inside the color of the person who owns it, and humans being
> the letter with the solid color."*

**This is the best idea in the thread**, because one glyph answers two questions
at once without adding a channel: a letter-vs-emoji contrast says
*person or agent*, and the colour says *whose*. "Whose agent is that" is a
question the current pile cannot answer at all, and it is the question that
matters the moment a canvas has agents from two people on it.

**The correction: the owner's colour goes on the RING, not the fill.**
`packages/web/src/lib/face.ts` already argues this, from experience:

> *"An emoji is not drawn by us — it is a small full-colour picture, and on a
> saturated disc (the blues especially) its own colours and the disc's fight,
> so the mark is hard to see. Lightening the palette would have cost the
> initials their contrast to fix the emojis; a ring keeps the colour on the
> face without putting anything under the picture."*

So the shape already exists — `.face-mark.ringed` puts `--face` on a 2px border
over a `--card` fill. **What changes is only which colour is handed to it: the
agent's own today, its owner's under this proposal.** That is a one-line change
in `faceMarkStyle`, plus getting the owner to the caller.

The result:

```
people    solid disc, their colour, white initial        D  S
agents    card fill, their emoji, ring in OWNER's colour  🐑  🤖
```

Dolly wears a sheep on a ring of Admiral One's colour. Anyone can see at a
glance that she is an agent, what kind, and whose.

## The separator

`● live │ D S │ 🐑 🤖 ⚓`

People first, agents after, a hairline rule between. People first because a
person scans for the humans they know; agents are read as a fleet.

The rule carries the person-or-agent distinction **structurally**, which is why
no badge is needed on each face. It also gives the pile somewhere honest to put
a count when a fleet grows past what fits (`🐑 🤖 +4`), without the overflow
chip being ambiguous about what it is counting.

## The two ladders

**Lightness — can it be reached.** Promote what `.share-roster-row` already
does (`.away { opacity: .55 }`, `.answerable { .75 }`, `.enrolled { .6 }`) into
the pile.

**Ring thickness — is it doing something.** `enrolled` hairline → `answerable`
1px → `here` 2px → `working` 3px, and only `working` animates. One moving thing
in a row is a signal; four is a fairground.

## Two traps

**Do not use colour for kind.** Colour is identity. If every agent were green
you would lose *"that is Dolly"*, which is the thing the emoji exists to
restore. Under this proposal colour still means one thing — *whose* — for both
people and agents, which is why the scheme holds together.

**Do not let "light" mean both *away* and *idle*.** A person who closed their
tab and an agent that is enrolled with nothing parked are different facts. The
bench spent a phase getting `elsewhere` and `unreachable` apart precisely
because a summons into silence is indistinguishable from an agent that is
thinking; a facepile that renders both at 55% opacity undoes that work in CSS.
**Lightness = can it be reached. Thickness = is it doing something.** Two
questions, two channels, never crossed.

## What exists already

- `isocan identity --mark <emoji>` — *"one emoji worn instead of your initial,
  everywhere your face appears"*. Dolly's sheep needs no new mechanism.
- `faceMarkClass` / `faceMarkStyle` — the fill-vs-ring switch, and the one
  place `--face` is handed to CSS. Both ladders and the owner-colour change
  land here.
- `.face-mark.ringed` — the ring, already 2px and already coloured.
- `roster()` — all eight states, already shared by four surfaces.

## Open

- **Where does the owner come from?** `roster()`'s rows do not carry one today;
  the enrolment record's `policy.owner` does. That is the plumbing this needs,
  and it is the same field `isocan --json rc listen` already prints.
- **An agent with no mark.** Falls back to its initial on a ringed card fill —
  still legibly an agent, just a duller one. Whether the system should pick a
  default emoji per harness (🐑 for sheep) or leave it blank is a taste call
  nobody has made.
- **A person's own agent, on their own canvas.** Every ring the same colour as
  every disc. Correct, and possibly monotonous; worth looking at before
  deciding it is fine.
- **Colour-blind readers.** Owner-by-hue is a colour-only encoding. The glyph
  and the grouping survive it; *whose* does not. The hover card already names
  the owner, which may be the honest answer — but it should be a decision
  rather than an oversight.

## Asked the next day: the hover card, and hiding

> *"mouseover of names to show info too… if I mouse over 'Scout' it should
> point to the owner / who has access to it. Also, if you type '@' it shouldn't
> show you names that you can't control… filter it… and in fact, why not leave
> them out of the facepile too."*

### The hover card — yes, and it mostly exists

`FaceCard` already draws on hover: name, kind, status, recent acts, unread.
What it does not say is the two things a person actually wants about an
agent — **whose is it**, and **who may summon it** — and both are already
computed. `policy.owner` and `policy.listen` are on the enrolment record, and
`isocan --json rc listen <name>` prints them today.

Two lines on the card:

```
Scout · agent · jetski
owned by Admiral One
answers Admiral One
```

That is the same information the rc narrates at startup and the refusal puts in
the thread. Putting it where the pointer already goes costs nothing new.

### Hiding what you cannot control — no, and today is the evidence

The instinct is right and the remedy is wrong. **Mark them; do not hide them.**

**The facepile answers "who is in this room".** An agent somebody else owns is
still in the room, still acting, still writing to the canvas you are reading.
Removing it does not reduce what it can do — it removes your ability to notice
it did anything. The pile would then be answering a different and less useful
question: "who will do what I say".

**Today is the argument.** The two most useful messages of the whole evening
were exactly these:

- *"Scout is not held by this machine — a pass from whoever holds Scout hands
  it over"*, narrated at every rc start
- *"Dolly listens only to Dion Almaer — this did not wake Dolly, and spent
  nothing. Ask Dion Almaer to widen it."*, in the thread

Both name a thing you cannot control, and both are the reason the hour was
recoverable rather than baffling. A facepile that had hidden Scout, and a
mention menu that had omitted Dolly, would have produced the same confusion
with nothing to read.

**And it is the bench's own rule, one surface over.** Phase 2 put bench agents
in the composer's candidates **marked** *not here yet* rather than leaving them
out, for this reason: a name that is absent reads as *does not exist*, and a
reader cannot tell "no such agent" from "not yours". That distinction is the
entire point of the three-state reachability this note already argues for.

**The whole project exists to kill the summons into silence.** Hiding a name so
it cannot be summoned is a quieter silence, not less of one.

### What to do instead

**In the mention menu:** keep them, rank them below the ones that will answer,
and mark them — *"won't answer you"*, with the owner's name. The refusal text
that exists today is already the right words; say them before the click rather
than after.

**In the facepile:** they are already distinguishable under this note's scheme
without any new channel. An agent you cannot summon wears a ring in **somebody
else's** colour — which is precisely the signal *"that one is not yours"*,
delivered by the encoding rather than by absence.

**If the pile is genuinely too busy**, the honest lever is overflow, not
selection: show the faces that fit and count the rest (`🐑 🤖 +4`). A count
tells the truth about what is there; a filter does not.
