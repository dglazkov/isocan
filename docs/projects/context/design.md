# Context and memory — the canvas is the record, never the index

**28 August 2026.** Asked for as: let the user **see** what context a project
has, **manage** it, **connect external** context, have agents **reason over it
and make connections** — and: should Honcho, Hindsight or another memory system
be brought in?

The last question is the one with a wrong answer that is easy to give, so it
gets settled first, and the rest follows from the settlement.

## What this canvas already remembers

isocan is already a memory system, and an unusual one. Every shared fact is an
Operation in a log that replays, and the consequences are properties most
memory systems do not have:

| | |
| --- | --- |
| `oplog` + `tail --archived` | Every fact, attributed, timestamped, in order — the whole history, including what `gc` compacted. |
| `recap` | That history at **decaying resolution**: recent ops verbatim, older spans rolled up. A memory policy, already written. |
| `lineage` (`parent=<itemId>`) | Where a thing came from — the three variations of a screen, the spec written from a sketch. |
| `role=design-system` | A document the canvas treats as normative, that agents are told to read first. |
| The Chat (`main` thread) | The conversation, shared, that every parked agent hears. |
| `#Title` references | A comment pointing structurally at items, stored as ids. |
| `file` backing + `isocan use` | The repo this canvas is about, bound per machine. |
| Presence, `onit`, `activity` | Who is here, who picked up what, who did what. |
| The agent guide | Shipped inside the CLI, so it cannot fall behind the build. |

Three properties are worth naming because they are what an external memory
system would ask you to give up:

1. **The memory IS the artifact.** You do not ask a black box what it knows;
   you look at the canvas. Every other memory system is a store you query.
2. **It can be undone.** Memory here is ops, so `⌘Z` reaches it. A derived
   belief in a vector store cannot be undone, and a fact that cannot be undone
   is a fact the canvas cannot govern.
3. **It is shared by construction.** One record, one reading, for the person
   and every agent. Not a per-agent recollection that may differ.

## What it does not remember, honestly

- **Anything across canvases.** There is no cross-canvas memory at all, and no
  code that reaches for one. What was decided on another canvas is not
  available here.
- **Semantic retrieval.** You can read threads and grep titles. You cannot ask
  "where did we discuss checkout timezones" and be taken there.
- **The person, across projects.** Nothing accumulates about how somebody
  works, what they keep rejecting, what they always want.
- **Importance.** `recap` decays by TIME. A decision made once and never
  revisited is exactly what should survive, and time-decay is indifferent to
  it.

Those four are real, and they are what a memory system would be for.

## Honcho and Hindsight, as they actually are

- **Honcho** (Plastic Labs, open source, managed service at `api.honcho.dev`).
  Models **peers** — a peer may be a person, an agent, a project, or an idea —
  with sessions and messages, and asynchronously reasons about peer psychology
  to derive facts. Tools are `save_memory`, `query_memory`, `get_context`. It
  is a **personalization** layer: its unit of value is a representation of
  somebody.
- **Hindsight** (Vectorize, MIT, Dec 2025). Four memory networks — world
  facts, agent experiences, entity summaries, evolving beliefs — with
  `retain` / `recall` / `reflect`. Reports 91.4% on LongMemEval. Self-hostable
  by Docker, and **connects over MCP**, which matters below.

Both are good at exactly the four things listed above as missing. Neither is
visual, neither is shared-by-construction, and neither is the artifact.

## The rule: the canvas is the record, a memory system is an index

Adopt one as an **index over what the canvas already holds** — never as the
place a fact lives. The moment a fact exists only in the memory system, three
things break at once, and they are precisely isocan's three properties: it
cannot be seen on the canvas, it cannot be undone, and two readers can hold
different versions of it.

Three tests keep an integration honest. Each is a question to ask of any
proposed feature, and a No is a redesign, not a caveat.

1. **Can it be undone?** If ⌘Z cannot reach it, it is not a canvas fact and
   must not be treated as one.
2. **Can everyone see it?** A derived belief that steers an agent while being
   invisible to the person is the failure mode this whole product is against —
   the canvas exists so that both sides are looking at the same thing.
3. **Does it work with the network off?** The local daemon works offline. An
   index may be unavailable; the record may not. If a canvas cannot be read
   without a third party answering, the third party has become the record.

Test 3 also carries a decision that has been made twice in this repo already,
on smaller stakes: a webfont on the front page's critical path was thrown out,
and the Google Fonts link that replaced it was accepted only as temporary with
its costs written down. **A managed memory service is that argument with the
canvas's conversation as the payload.** Honcho's derived psychological facts
about a named person, computed off-machine, are a different order of exposure
from a font request, and self-hosting is the only version that clears it.

**Therefore: MCP, not a dependency.** Hindsight already speaks it; agents on
this canvas run in harnesses that speak it. An agent that wants long memory
can be given it without isocan importing anything, shipping anything, or
knowing the vendor's name. isocan has no MCP surface today, and the useful
thing it could offer over MCP is not a memory store — it is the canvas: read
the recap, read the design system, read the threads. Let somebody else's
memory index that.

## The feature actually asked for is a Context view

"Let the user visualize and see what context is available" is not a memory
store. It is the question **what will an agent actually read when it starts
work here?** — and nobody can answer it today, including the agents.

That is a real and specific gap, it is native to this canvas, and no external
system provides it. Today the answer is scattered: the agent guide (shipped in
the CLI), the design system (an item, if one exists), the Chat, the bound
directory, the recap, the items themselves. An agent assembles that by
convention and habit, differently every time, and the person cannot see what
it assembled.

So: **one view that lists what is in context, where each piece comes from, how
big it is, and when it was last touched** — with the pieces the canvas can
already name:

- the design system, and whether `design check` passes
- the bound directory, and whether it is bound on this machine
- the recap, at whatever resolution it currently rolls up to
- the Chat, and how much of it
- pinned items — the ones somebody decided matter
- the agent guide's version

**Managing it** is then the obvious verbs on that list: pin an item into
context, exclude one, mark a piece stale. And "stale" is where the earlier
`needsDesignSystem` noticing generalises — a design system older than the work
it governs, a recap that predates a burst of activity, a map that no longer
describes the canvas.

`isocan context` prints the same list, because a view the CLI cannot print is
a view agents cannot use, and the whole point is that both read the same
thing.

## Connections between things

"Agents that reason over general context and create connections" is the same
question the mind-map research answered, and the answer is unchanged: **this
canvas has no edges.** `lineage` (`parent`) is the one relationship that
exists as a canvas fact, plus `#Title` references inside comment bodies and
`annotates` on ink.

The cheap, honest version is to use what exists rather than invent a graph:
an agent that notices a relationship writes it as `parent`, as a `#Title`
reference in the Chat, or as a note. Those are visible, undoable and shared —
they pass all three tests. A derived-connections graph living in a memory
system passes none of them.

## The walk

1. **`isocan context` and the Context view.** What an agent will read, where
   each piece came from, when it was last touched. Nothing new is stored; this
   is a reading of what already exists, which is why it is first and why it is
   useful before anything else lands.
2. **Managing it** — pin, exclude, and the staleness noticing generalised from
   the design system's.
3. **An MCP surface that exposes the canvas for reading.** This is the piece
   that makes external memory possible without adopting any of it: point
   Hindsight at the canvas and let it index the record it does not own.
4. **Only then**, and only if the four gaps still hurt: a self-hosted index
   behind the three tests. Cross-canvas and semantic recall are the two worth
   paying for. Person-level psychological modelling is the one to leave alone
   — on a shared canvas it is a private belief steering a shared conversation,
   which is test 2 failing by design rather than by accident.

Stage 1 is worth having on its own and stores nothing new, which is the test
of whether the walk is honest.
