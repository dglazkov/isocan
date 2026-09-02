---
status: partial
since: 2026-09-01
see: atlas, personas, on-demand
note: stages 0-2 built 1 Sep — the `/sprint` command, `sprintState` derived from the Chat, `isocan sprint` and the clock chip, hand-in as a property, the vote curtain by lens, the split tally, the bell; stage 3 (rival rooms, the overnight Monday) is practice, not code, and the sprint has not yet been run for real
---

# The design sprint, as a game the canvas already knows how to play

**1 September 2026.** Research, and stages 0–2 built the same day — see
[§ What was built](#what-was-built) at the end. Stage 3 remains practice, and
the note's own first recommendation — run one for real — has not happened yet.

The question: *run a design sprint — the Knapp/GV five-day ritual, or its
four-day AJ&Smart cut — as a multiplayer activity between people and agents on
a canvas, and make it creative, joyful and experimental in the way great
facilitators make it in a room.* And think through everything the canvas, and
what sits beyond it, could do for that.

The short version. A sprint is not a new kind of canvas and not a new kind of
item. It is a **script a facilitator runs** over a small ritual vocabulary —
*phase, timebox, silence, quota, vote, reveal, decide* — and the canvas holds
almost all of it already, in verbs built for other reasons. The parking
primitive is a timer. `/ask` already shows how to derive a state from the Chat
without storing one. A reaction is a dot. `/variation` is Crazy 8s. `choose`
is the supervote landing. What is missing is small and specific, and what
must be **refused** is more important than what must be built: the canvas
cannot keep a secret, and an agent must not be the Decider or the Friday user.

## What was measured

Counted 1 Sep across every oplog on this machine — **45 canvas directories,
2,954 ops, 56 distinct actors** (the home of 10 canvases and a replica of
11 more; the count is of logs on disk, not of what each home holds):

| Thing the sprint needs | What the canvas has done so far |
| --- | --- |
| Diverging (a sketch made from a source) | **72** children of **31** parents; **19** parents with two or more children; the biggest fan-outs are 9, 9, 4, 4 |
| Converging (this one won) | **15** `item.setCurrentVersion` ops against **941** versions minted |
| Voting | **57** reactions on, across **10** canvases; the top marks are 👀 (15) and 🚧 (9) — status, not preference; ⭐ was used twice |
| Words on the wall | **136** text nodes, **69** drawings |
| Talking | **78** threads, **397** replies |
| Asking for a ritual | `/variation` **2**, `/grill-me` **1**, `/format` **3**, `/ask` **3**, `/cancel` **5** |

Three readings. Divergence is real and convergence is rare, which is the same
asymmetry [agents on the canvas](2026-08-23-agents-on-the-canvas.md) found in
the field and which `choose` was built to close — a sprint is the ritual that
*forces* the convergence step to happen, on a clock, with a named decider.
Reactions have never been used as votes here; the two most common marks say
"I am looking" and "under construction". And the ritual commands exist but are
barely reached for: the vocabulary is there, the *occasion* is not. A sprint is
an occasion.

## The method, and the rules that make it work

The five days, in Knapp's shape, with the rule each day turns on. A feature
that keeps the shape and drops the rule is a template, not a sprint.

| Day | What happens | The rule |
| --- | --- | --- |
| **Monday — Map** | Long-term goal, sprint questions, a map of the customer's path (5–15 steps, actors left, ending right), *Ask the Experts* (15–30 min each, "pretend you're a reporter"), How-Might-We notes, HMW voting (two votes each, before discussion), pick a target | Experts are interviewed, not debated; everybody writes HMWs *while listening*, silently, one per note; the **Decider** picks the target, not the room |
| **Tuesday — Sketch** | Lightning Demos (3 minutes each, then whiteboard the one idea worth stealing), then the four-step sketch: Notes (20 min), Ideas (20 min), **Crazy 8s** (8 frames, one minute each), Solution Sketch (3 panels, self-explanatory, ugly is fine, words matter, catchy title) | **Work alone together.** No group brainstorm. The solution sketch is **anonymous** — "you won't be there to explain the deeper meaning" |
| **Wednesday — Decide** | Art Museum (taped in a row, nobody presents), **Heat Map** (silent dots on the parts you like, before anyone speaks), Speed Critique (3 min per sketch; the group narrates, a scribe captures big ideas, the author speaks *last* and only to say what was missed), **Straw Poll** (one dot each, chosen silently, placed simultaneously), **Supervote** (the Decider's three dots, with initials, are the decision), then a 15-frame Storyboard | Silence before speech. No sales pitch. The straw poll is *advisory*; the **Decider** decides |
| **Thursday — Prototype** | Fake it: Goldilocks quality, "a façade". Roles: Makers, Stitcher, Writer, Asset Collector, Interviewer. A trial run at day's end | Build only what the storyboard shows; the Stitcher owns consistency |
| **Friday — Test** | Five one-on-one interviews, the five-act interview, notes on a grid (interviewee × storyboard section), find patterns, revisit the goal and questions | **Five real users** — five is Nielsen's number, not Knapp's. The Decider "considers everyone's votes and selects the overall yes or no" |

Two facilitation truths sit under all of it and neither is decoration. **The
timebox is the facilitator's authority**: a room stays creative because
somebody neutral owns the clock, and the bell is never negotiated. And
**silent, individual work followed by public, structured choosing** is the
whole reason a sprint outperforms a meeting — the literature GV leans on
says group brainstorms produce fewer and worse ideas than the same people
alone, and the ritual is engineered around that finding.

Sources for the method: the checklist Knapp's own firm maintains at
[character.vc/guide/design-sprint](https://www.character.vc/guide/design-sprint)
(thesprintbook.com now redirects there), [gv.com/sprint](https://www.gv.com/sprint/),
Google's [Design Sprint Kit](https://designsprintkit.withgoogle.com/methodology/phase3-sketch/crazy-8s)
for Crazy 8s, AJ&Smart's [Design Sprint 2.0](https://facilitator.com/blog/design-sprint-101)
for the four-day cut ("the only update approved by sprint inventor Jake Knapp";
decisions finish by end of day 2, experts leave, days 3–4 are prototype and
test), Knapp's [Note-and-Vote](https://www.fastcompany.com/3034772/note-and-vote-how-google-ventures-avoids-groupthink-in-meetings)
for the ritual compressed to a meeting, and NN/g's [five
users](https://www.nngroup.com/articles/why-you-only-need-to-test-with-5-users/).
The Lightning Decision Jam's step-by-step time boxes are not on any AJ&Smart
page that could be fetched today; treat any numbers for it as unverified.

## The canvas already speaks most of this

Every one of these is a verb that exists today, built for another reason, and
each maps to a sprint moment without a new op.

| Sprint moment | Today's verb | The fit |
| --- | --- | --- |
| The Map | `isocan map new / add / link` | A mind map with real nodes and a `mapParent` edge is exactly the customer-path map; `tidy` lays it out |
| HMW notes | `isocan text "…" --paper yellow` | The post-it is a text node wearing a property, built this morning; `--file -` takes a paragraph from an agent's stdin |
| Lightning Demos | `isocan browse <url>` | A live site as an item, with `frameable` saying honestly when a site refuses to be shown |
| Sketch, human | the Pen, `T`, `⇧C` | Ink in world units; an annotation is ink *about* an item |
| Crazy 8s, agent | `/variation 8 <how>` | Eight real alternatives, each carrying `parent`, laid under the source by `format` |
| The Art Museum | `isocan format`, `align`, `distribute` | A row of sketches at reading order; the wall |
| Heat Map, Straw Poll, Supervote | `isocan react <emoji> <items…>`, `--who` | Per-actor, undoable, visible; `ls --reaction 🔴` lists what has dots |
| Speed Critique's scribe | `isocan text --paper` beside the sketch, or `comment add --item` | Words visible on the wall, or a thread pinned to the thing |
| The Decider's landing | `isocan choose <winner>` | The winner folds into its source as a version; the siblings go to the trash; one undo takes the decision back |
| The Storyboard | fifteen items in a row, `slides add` | The deck IS the storyboard; full screen flips through it |
| Thursday's build | `add`, `edit`, `design check`, personas | Screens are HTML items; the Stitcher is a persona with a goal it is judged against |
| Friday's grid | `text --paper` on a grid | Rows are interviewees, columns are storyboard frames — geometry, no schema |
| Bring the room to a sketch | `isocan present <item>`; follow mode | An invitation in the Chat, never a yank; follow needs a subject and the facilitator is one |
| The retro | `isocan timeline`, `isocan at <seq>`, `recap` | The wall as it stood at each bell; the seams mark the births and the decisions |
| The bell | `isocan wait --timeout <sec>` | See below — this is the finding |

**The parking primitive is a timer.** `wait --timeout 480` blocks for eight
minutes and exits 2 when nothing came — "the quiet half of a conversation, not
the end of one". Read from the facilitator's chair that is the bell for Crazy
8s: park for the timebox, and when the call returns with nothing, time is up
and the next phase is announced. A summons during the box wakes the
facilitator early, which is also right — somebody asked a question and the
facilitator is the one who answers it. No scheduler, no clock service, no new
op: the thing every agent already does between laps *is* the thing a
facilitator does between phases.

**Phase is derived, not stored.** `/ask` established the pattern this note
leans on: an open question is not a flag somebody sets and forgets, it is
*derived* from a thread — asked, and not yet answered by somebody else. A
sprint's phase is the same shape. The facilitator posts `/sprint sketch 20m`
in the Chat; the current phase is the most recent such command in the Chat,
and its end is that comment's `ts` plus its duration. Every client computes the
same countdown from the same daemon-stamped timestamp, so two browsers and a
CLI cannot disagree about how long is left. There is no `sprint.setPhase` op
and there should never be one; the record is the conversation, which is where
the room would look anyway.

## What is missing, precisely

Four things, and they are not equal.

**1. A clock somebody can see.** The derivation above is one pure function in
core — `sprintState(threads, now)` beside `openAsks` — and two renderings of
it: a chip on the stage saying *Sketch · 14:02 left · 3 of 6 handed in*, and
`isocan sprint` printing the same line. Cheap, and the thing that makes a
canvas feel like a room with a clock on the wall.

**2. A way to be silent.** This is the hard one and it is worth being honest
about. Every op names its actor and lands in a public log; presence shows
whose cursor is where. There is no private state anywhere in the model and
this note does not propose one. But the method's anonymity was never about
secrecy — a Post-it face-down on a table is not encrypted — it is about **not
knowing who drew what while you vote**. Three ways to get that far, and the
third is the one to take:

* *A veil property.* Items wearing `veiled=sketch` render as blank cards until
  the phase ends. The bytes are in the log and `isocan get` reads them, so this
  is a courtesy that the app enforces and the daemon does not — which is the
  one law this project actually has, broken. Refused.
* *Sketch elsewhere, land at the bell.* Each sketcher works on a scratch
  canvas of their own (canvases are cheap; an agent's is its working
  directory) and hands in at the reveal with `isocan copy <items> --to
  <sprint>`. Nothing is on the wall until everything is. This is what the
  physical ritual does — draw, then pin — and it costs zero ops.
* *And hide the names by lens, never by record.* During a vote phase the app
  does not draw author badges or reaction counts on wall items — a *lens*
  decision like the heat-map rendering below, derived from the phase — while
  `isocan ls --json` keeps saying exactly who made what. Authorship stays in
  the record, where Friday's wrap-up wants it; the room simply is not shown it
  while choosing.

The second and third together are the recommendation, and it is worth saying
which half carries the weight. The scratch canvas is **real** privacy, not a
courtesy: the other sketchers are not admitted to it, and admission is a rule
the daemon enforces at the door. The lens is the courtesy, and it covers only
the one thing the method actually needs — not seeing names *while choosing* —
for a wall that is already public. What neither gives is anonymity against
somebody who opens a terminal after the reveal, and the note should say so
rather than promise it: **the curtain is etiquette**, and the sprint works
because the room agrees to it, exactly as it does in a building.

If a later ritual needs more than that — a sketch that is on *this* canvas and
genuinely unreadable until a reveal — the honest shape is a daemon-side
**read** rule, a blob withheld until a reveal op, and it belongs beside the
[roles ladder](2026-09-01-roles.md) as a capability question, not beside paper
colour as a property. That is the same ladder the Decider needs: `choose` is
the Decider's gesture and shipped before there was a sprint, but nothing yet
says *who may perform it*, and a rung is the answer rather than a sprint rule.

**3. A vote that is also a picture.** Reactions are the right store — per
actor, undoable, one op — and the wrong picture: a row of tiny emoji under a
card is not a heat map. The heat map is a rendering: dots sized by count, drawn
*on* the sketch, with counts hidden while the phase is open and shown at the
bell. It needs no op. What it needs is a convention the facilitator announces —
🔴 for the heat map, unlimited; ⭐ for the straw poll, one each; 🏆 for the
supervote, the Decider's only — and the facilitator reading `react --who` to
hold the quota, because the daemon does not enforce "one each" and should not:
a rule about a ritual belongs to the ritual's referee.

One rendering decision is the thing no other tool can make. Because a reaction
records *who*, the heat map can show **two tallies on one sketch — human dots
and agent dots** — and the room can read them differently: the humans' as
the vote, the agents' as a second opinion from six readers who each saw every
sketch. FigJam and Mural hide who voted by design, which protects their humans
and makes this split impossible for them. Here it is a query over data already
kept, filtered by the roster the facilitator holds (presence already says
which sessions are `cli` and which harness they run), and costs no op.

**4. A hand-in count.** *Three of six sketches are in.* Derived from items
wearing `sprint=<phase>`, which `copy --to` can stamp and the facilitator can
read with `ls --filter`. A property, not an op — the same answer `slide`,
`context` and `paper` reached.

## Roles: who is a person and who is an agent

The sprint has named chairs, and the interesting design work is deciding which
ones an agent may sit in. The repo already has eight personas — a lens, tools,
a goal judged by a command, and a memory of past runs — so "an agent in a
role" is a thing this codebase has a word for.

| Chair | Who | Why |
| --- | --- | --- |
| **Facilitator** | an agent | Neutral, tireless, owns the clock and never negotiates the bell; parks on `wait` between phases; posts every phase to the Chat so the phase is derivable. Knapp wants a human here because humans get bored of facilitating; that objection does not apply |
| **Decider** | a person, always | The supervote is the point of the week. An agent's `🏆` does not count and the app should refuse to draw it as one |
| **Sketchers** | people and agents, as peers, under the same rules | Same HMW notes, same silence, same hand-in moment, same quota: 8 for Crazy 8s, **1** solution sketch each. An agent that can make 40 makes 1 |
| **Experts** (Monday) | agents wearing personas, plus whoever the team names | The performance, accessibility and copy personas already know what they measured; `market-researcher` is a Lightning Demo machine |
| **Scribe** | an agent | Captures Speed Critique's big ideas as post-its beside the sketch as the room talks; reads the Chat, writes to the wall |
| **Makers, Stitcher, Writer, Asset Collector** (Thursday) | agents, one name each, fanned out | Two agents on two screens is "the thing this canvas is for"; the Stitcher runs `design check` and `format` and owns the deck |
| **Interviewer** (Friday) | a person, with an agent as note-taker | The five-act interview needs a human in the chair; the agent fills the grid from what it hears |
| **The five users** | **people** | See the trap below |

**The speed asymmetry is a feature only if the rules hold.** An agent can
produce eight variations in the first minute of an eight-minute box. Left to
itself it will, and then the wall is one voice. The quota does the work — one
solution sketch per chair — and the reveal-at-once does the rest, because a
sketch that lands early is not seen early. What the asymmetry buys is
*breadth*: three humans and three agents make six sketches in twenty minutes,
and the agent sketches are clickable.

**Silent phases must not run through the Chat.** Every parked agent wakes on a
Chat message. A facilitator who narrates "two minutes left" in the Chat wakes
six sketchers mid-sketch; the narration belongs on the clock chip and in the
facilitator's own status (`session say`), and the phase commands — the only
Chat traffic during a box — are the very thing the sketchers should wake for.

## What only this canvas can do

This is the "and beyond" of the question, and it is where the joy is.

**Clickable sketches.** A solution sketch on paper is three panels; an agent's
is a working HTML item with the same three-panel discipline (*give it a title,
make it self-explanatory, words matter*). Wednesday's Art Museum has some
sketches you can click through, and the Heat Map dots land on states not
drawings. The rule that keeps it fair: an agent sketch is judged as a sketch.
Polish is not a vote.

**The retro is free.** `isocan at <seq>` shows the wall as it stood at
Monday's target, at the Heat Map, at the supervote. `timeline --majors` marks
the births and the decisions; `recap` compresses the week to a page. A sprint
that ran here has a replayable record that no room has, and a Friday wrap-up
can scrub back to Monday's questions and answer them against what was built.

**Rival rooms.** Tiny Stitch's founding move — *run rival teams on the same
task* — is two canvases running the same `/sprint` brief with different
sketchers, and a Thursday where each room's prototype is copied into a third
canvas for a single Friday. `copy --to` carries a selection with its
arrangement; convergence across canvases is a copy of the winner followed by
`choose` at home. Nothing new, and the first genuinely multiplayer use of
several canvases at once.

**An overnight Monday.** Ask the Experts does not need the room. The personas
can be interviewed by the facilitator overnight — each answers in its own
thread, each HMW lands as a post-it — and the humans arrive to a wall of notes
to vote on. The [night shift](2026-08-24-the-night-shift.md) note wanted an
off-hours loop with something to do; a sprint gives it a Monday.

**Emissaries at the table.** A person's own persona sketches when they cannot
be in the room, under their name-with-a-mark, and the person's supervote is
still theirs when they are back. The trust battery in the vision has an
obvious first reading here: how often the emissary's sketch was the one its
person would have drawn.

**Friday's grid becomes evidence.** Notes on a grid are text nodes at
coordinates; patterns are the facilitator's heat map on the notes; the
"revisit the sprint questions" step is a thread that quotes Monday's questions
by `#Title` and answers each with a `#` to the note that answers it. The lane
rendering — *what a message made* — draws the arrows.

**The small joys, chosen carefully.** A bell that is a sound and a one-second
flash on the clock chip. A reveal that lays the wall out in one `format` so six
sketches arrive together, which is a better moment than six arrivals. A cursor
parade during the Art Museum: everyone following the facilitator's cursor from
sketch to sketch, which follow mode already does for one chosen actor and which
the facilitator can lead by `present`ing each in turn. Reactions as stamps
during the critique — 🔥 and 🐛 as the room reads. Confetti is a decoration
and the [motion](2026-08-28-motion.md) rule says it must be skippable; the
reveal laying out at once is the *data* motion that actually lands.

## Traps

* **A sprint mode.** A canvas-wide "mode" stored on the project, toggled by a
  button, that the CLI cannot see or that means something different in the
  app. Everything here is a comment in the Chat and a property on an item,
  reachable from both surfaces, or it is not built. The suite that holds the
  CLI and the app to one vocabulary must hold this too.
* **A new kind called Sketch.** A sketch is a screen, a drawing or a text node
  wearing `sprint=<phase>`. The post-it note answered this yesterday.
* **Faking anonymity.** Promising the room that nobody can know who drew what
  is a promise the log breaks. Say "not shown while voting" and mean it.
* **An agent Decider.** The temptation is real — the facilitator agent has
  read every sketch and can argue for one — and it is the end of the method.
  The facilitator may say what it saw, the way `/variation` already does
  (*"which you would keep and why"*); the 🏆 is a person's.
* **Agents as the five users.** Synthetic users produce confident notes about
  a prototype nobody used. Agents may run the Thursday *trial run*, a
  heuristic walk, and the accessibility persona's measured pass; Friday is
  five people. An agent that fills the Friday grid should be transcribing a
  human interview, never inventing one.
* **A group brainstorm in the Chat.** The most likely failure, because the Chat
  is where everyone already talks. The facilitator's job is to keep the box
  silent, and the design's job is to give the facilitator somewhere else to
  narrate.
* **A daemon that enforces the ritual.** One vote each, eight sketches, no
  reactions during silence — every one of these is a rule of *this* ritual,
  and the next ritual (a Lightning Decision Jam wants six dots and a
  different silence) has different ones. The referee is the facilitator, and
  its skill body is where the rules live.

## The generalisation, said once

A sprint is one script. The vocabulary it runs on — **phase**, **timebox**,
**silence**, **quota**, **vote**, **reveal**, **decide** — runs a Lightning
Decision Jam in an hour, a design crit in thirty minutes, a Six-Thinking-Hats
review with six personas, a bug bash, a retro over `timeline`. The feature is
not `/sprint`; it is that a **facilitator agent can run a ritual over the
canvas**, and `/sprint` is the first and largest one. Commands are already
skills that a home can add or shadow by dropping a file in
`~/.isocan/commands/`, so the second ritual is a file, not a release.

## What the field shipped

Surveyed 1 Sep by the market-researcher persona; primary pages where they
could be fetched, and marked where they could not.

**The facilitation primitives are old and complete, and they are chrome.**
Miro has had a [Timer](https://help.miro.com/hc/en-us/articles/360017730933-Timer),
[Voting](https://help.miro.com/hc/en-us/articles/360017572274-Voting),
[attention management](https://help.miro.com/hc/en-us/articles/360013358479-Attention-management)
(*Follow*, *Bring to me*, *Bring everyone to me*) and a [Private
mode](https://help.miro.com/hc/en-us/articles/9794413310482-Private-mode) for
years: sticky text hidden from everyone but its author, a five-second
countdown on reveal, and a *make names anonymous* toggle that is permanent once
set (Miro's help centre refuses automated fetch, so the wording is paraphrase).
Mural's [facilitation superpowers](https://www.mural.co/features/superpowers)
are the fullest named set: Summon, Take control, Facilitator lock, Hide &
reveal, Timer, anonymous Voting, Private mode "to avoid group think", Laser
pointer, Hide cursors, Reactions, Celebrate. FigJam's [voting
sessions](https://help.figma.com/hc/en-us/articles/9359912208663-Run-voting-sessions-in-FigJam)
are the closest thing in the category to a straw poll: votes per participant
are set up front, **collaborators' votes stay hidden until the session ends,
and multiplayer cursors are hidden during voting so a vote is not revealed by a
hand** — which is the hide-by-lens decision above, made by a vendor for the
same reason. Anyone in the file can end the session, and a timer is optional.

Two things follow. Every one of these is *facilitator* power; **none of them
models the Decider**, who is a different person with a different job. And a
timer that merely counts is chrome everywhere, which is right — here it
belongs on the ephemeral plane beside presence, derived from a comment's
timestamp, while a timer that *auto-reveals* would be state and would need an
op. This note keeps them apart: the countdown is derived, the reveal is the
facilitator's explicit act.

**The AI story is generation, not participation.** Miro's [Canvas 26](https://miro.com/blog/canvas-26-product-highlights/)
(19 May 2026) announced Sidekicks with voice, Flows and Prototypes; its own
[May round-up](https://miro.com/blog/whats-new-may-2026/) marks Sidekicks
*coming soon*. The widely repeated claim that it shipped a **"Facilitator
Sidekick"** running timed activities appears only in aggregators and in
neither of Miro's posts — **unverified, and not to be built against**. The
same pattern holds for a Mural "Lumina" facilitator, absent from
[mural.co/mural-ai](https://www.mural.co/mural-ai), whose real list is
clustering, summarising, sentiment, mind maps. Figma's [AI Design Sprint
Assistant](https://www.figma.com/solutions/ai-design-sprint-assistant/) is a
landing page promising parallel high-fidelity concepts — explicitly *not*
sketches — with no voting, no decider and no testing. Butter was [acquired by
Miro](https://www.butter.us/blog/a-new-chapter-for-butter-with-miro) in March
2025. **Nothing found ships an AI as a named participant in a facilitated
workshop.** The nearest is tldraw's [agent starter
kit](https://tldraw.dev/starter-kits/agent), where an agent has a viewport and
a position.

**And tldraw's complaint is the sprint's rule.** Their docs name the hard part
of canvas agents: they *"only receive new context when they're prompted…
they're essentially working blind."* That blindness is exactly what a
facilitator spends Tuesday enforcing on humans — no peeking, no sales pitch,
work alone together. The property every whiteboard vendor is engineering away
is free in agents; the participants who need policing are the people. An agent
sketching in its own directory, handing in at the bell, is not a workaround
for a limitation. It is the method.

**Synthetic Friday, measured.** NN/g ran [synthetic
users](https://www.nngroup.com/articles/synthetic-users/) against three of its
own real studies (June 2024) and found the answers "too shallow to be useful";
ACM *Interactions* [catalogued the same](https://interactions.acm.org/archive/view/january-february-2026/the-challenges-of-synthetic-users-in-ux-research)
in Jan–Feb 2026. Friday exists to put the team in contact with somebody who
was not in the room; an agent trained on the room is the room.

## Recommendation, in stages

**Stage 0 — a command, zero code, run for real.** Write `/sprint` as a
built-in slash command: the facilitator's skill, in the shape of `/grill-me`
(rounds, `wait`, stop). A command is a skill any agent runs, so this is *not*
a shipped facilitator model — isocan hands agents a CLI and a body of
instructions, and whichever harness the team already runs takes the chair.
The skill walks the four AJ&Smart days over today's verbs —
`map` for Monday, `text --paper` for HMWs, `browse` for demos, `/variation`
for Crazy 8s, `copy --to` for the hand-in, `format` for the museum, `react`
with announced emoji for the three votes, `choose` for the landing, `slides`
for the storyboard and the trial run, `wait --timeout` as the bell. Then
**run one** on this repo's own canvas with two people and three agents,
bootstrapping commitment and all, and write down what broke. Nothing below
should be built until that has happened, because the sprint is the one
feature whose spec is a week of practice.

**Stage 1 — the clock and the curtain.** `sprintState` in core, derived from
the Chat; a stage chip and `isocan sprint` reading it; the heat-map lens
with counts and author badges hidden while a vote phase is open; a hand-in
count from `sprint=<phase>`. One property, one pure function, no op.

**Stage 2 — the room.** Follow-the-facilitator as the museum walk, `present`
per sketch; a bell sound; the reveal as one `format`. Each is a small change
to a surface that exists.

**Stage 3 — rival rooms and the overnight Monday.** Two canvases, one brief,
a third for Friday; the personas interviewed while the room sleeps. This is
the stage that touches the vision directly, and it waits on stage 0 having
been lived.

The size of the whole thing is deliberately small: the canvas was built for
divergence and convergence with named actors, and a sprint is what happens
when you put those on a clock and hand one person the last vote.

## What was built

**1 September 2026, the same evening.** Stages 0 to 2, as recommended, with
one departure marked. Zero new operations; one new property.

**Stage 0 — `/sprint`.** A built-in slash command in `commands.ts`, the
facilitator's skill: setup round, the clock, silence, quotas, one verb per
phase, and the list of what a facilitator never does. It is a skill any agent
runs, not a shipped model.

**Stage 1 — the clock and the curtain.** `core/sprint.ts` holds the phase
table (eighteen phases with Knapp's timeboxes as defaults, plus `end`),
`parseSprintCommand`, and `sprintState` — the newest `/sprint <phase>` line
in the Chat, timed from its daemon stamp, exactly the `/ask` derivation. A
hand-in is `sprint=<phase>` on the item. `hidesVotes` is true while a vote
phase's clock runs. `tally` splits human dots from agent dots, with "agent"
meaning a harness-bearing cli session or an enrolment, never a guess. On the
CLI: `isocan sprint [show|phase|end|handin|tally]`, with `--json` carrying
`remainingSeconds` for the bell. In the app: a clock chip under the toolbar;
reaction chips that draw the mark and hide the count under the curtain; the
item byline gone from the tooltip while voting; a *Hand in for …* entry on
the item menu while a phase runs; and the split count on every chip while a
sprint is on. Twenty-one core tests and one end-to-end CLI test, plus a
real browser driven against a scratch daemon serving the built app: the chip
read *Heat Map · 3:41 · votes hidden*, a 🔴 chip under a sketch drew the mark
and no number, a 25-second straw poll rang on time with the chip's ring
visible and both counts revealed on the same tick, and the item menu offered
*Hand this in for Straw Poll*.

**Stage 2 — the room.** The bell rings (two generated tones, swallowed
where the browser refuses audio) and the chip flashes when a clock somebody
watched reaches zero, and flashes once on a new phase. Follow-the-facilitator
needed nothing: the agent tray's follow button already follows one chosen
actor, and `present` already invites. The reveal-as-one-`format` is a rule in
the skill, because `format` already lays out a wall in one gesture.

**Stage 3 — not code.** Rival rooms are two canvases and `copy --to`; the
overnight Monday is the facilitator interviewing personas while the room
sleeps. Both are written into the skill as practice. Neither has been done.

**The departure.** The note said counts and names are hidden "on wall
items"; the build hides them on every item while a vote is open, because the
wall is whatever the room is looking at and a lens that had to know which
items were the wall would be a second definition of the wall. `wallFor`
exists for the tally, where the question is precise.

**Not done, and said so.** The sprint has not been run for real, which the
recommendation put before everything else. One known tell survives the
curtain: the Chat's lane arrows still say who handed in what, because a
hand-in is an op with an actor, and the note's own rule is that the record is
never hidden.
