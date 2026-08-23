# The atlas journey

Understanding a system you did not write, on a canvas, with an agent — and
keeping that understanding current as the system moves.

Written in the same form as [the multiuser journey](multiuser-journey.md):
scenes first, mechanism only where a scene forces one. The scenes use
[`inkboard/system-atlas`](https://github.com/inkboard/system-atlas) (MIT), a
skill that renders one data file as an explorable isometric map plus a text
twin. Nothing here proposes changing that skill. The question this document
answers is what a *canvas* adds to it, and what isocan must build to earn that.

Read the last two sections first if you are deciding anything: most of this
journey runs on machinery that already exists, and the parts that do not are
small and named.

## Cast

- **Priya** — has just inherited `meridian`, a synthetic ingest service of
  some size and a migration half-finished inside it. Works thick: local
  daemon, terminal, agent.
- **Isaac** — Priya's agent, parked in `isocan wait`.
- **Jordan** — wrote a third of `meridian` two years ago and remembers about
  half of that. Enters thin, in a browser.

## Scene 0 — The canvas already knows which repo it is

Priya clones `meridian` and binds the directory to a canvas:

```sh
isocan use "Meridian"
```

From here every command in that folder means *this* canvas, and an agent
started there inherits it without being told. This scene is the precondition
for all of the others and it is the one that already works.

## Scene 1 — She asks the canvas, not the terminal

In the canvas's main thread she writes:

    /system-atlas map this repo so I can talk about it

She does not run anything. The canvas never executes a command — it writes
down what was asked, and an agent does the work. Isaac is parked in `isocan
wait`; the ask wakes him, and his cursor appears on the canvas with a status
under it. Jordan, who is not doing anything yet, can see that a thing was
asked and that somebody picked it up.

That difference matters more than it sounds. The same ask typed in a terminal
is invisible to everybody else and unrecoverable tomorrow. Here it is a
comment with an author and a timestamp, and the work that answers it is joined
to it.

## Scene 2 — The proposal comes back as something to look at

The skill does not draw first. It reads the repo, then proposes the structures
it intends to show and asks whether the shape is right — and on a canvas that
proposal arrives as an **item**, not as a wall of terminal output Priya has to
scroll. She can put it next to the README, point at a box and say "these two
are one thing", and Isaac revises before anything is rendered.

Priya answers the skill's other question — where the atlas lives — with
`docs/meridian/atlas/`, in the repo, because she wants it reviewed like code.

## Scene 3 — Three items, and the canvas shows why they cannot drift

Isaac runs the build and adds what it produced:

```sh
isocan add docs/meridian/atlas/data.mjs   --title "Meridian — atlas source"
isocan add docs/meridian/atlas/atlas.html --title "Meridian — the map"  --prop parent=<data>
isocan add docs/meridian/atlas/SYSTEM.md  --title "Meridian — the twin" --prop parent=<data>
isocan format
```

`data.mjs` is the only thing anyone edits; the map and the twin are generated
from it. On a canvas that relationship is not a claim in a README — it is
`parent`, and `/format` lays both children under the file they came from. You
can see that the two views have one source, which is the whole argument the
skill makes about drift.

The map renders in place. isocan serves an item's file to a sandboxed iframe,
`atlas.html` is self-contained with no runtime dependencies, and the two facts
meet with nothing in between.

## Scene 4 — Stepping inside

At canvas zoom the atlas is a picture. Priya double-clicks to step into it and
it becomes live: hover to read, click to pin, arrow keys to walk into a
structure's steps, packets moving along the flows with payloads she can open.
Chapters reveal three structures at a time, so the first thing she meets is
not the whole system.

She spends twenty minutes there and comes out understanding the ingest path.
The atlas stays on the canvas beside the screens and the threads, which is the
part a browser tab does not do.

*Designing rather than reading?* Then Isaac serves the atlas while he works and
projects it live instead: `isocan browse http://localhost:4173`. Edits to
`data.mjs` rebuild and the item refreshes in place, so pieces can be moved
around before anything is written.

## Scene 5 — The open questions become threads

Reading the repo produced questions the code cannot answer. The skill already
tracks them: every one gets a stable id (`Q-IN3`) and a state — open, routed to
somebody, or resolved with an answer and a date.

On the canvas each open question becomes a **comment thread on the atlas item**,
carrying its id as a property and its routing as an `@mention`:

    @Jordan Q-IN3 — retries: does the dead-letter path re-enter at the parser
    or at the queue? Both are reachable and they disagree about ordering.

Now the question has the two things a question in a document never has: a
person it was asked of, and a place the answer will be found. Jordan's face
shows on the canvas; the thread shows he picked it up.

## Scene 6 — An answer lands, and both views move together

Jordan replies in the thread. Isaac takes it (`isocan session on <thread>`),
writes the answer into `data.mjs` as the question's resolution, rebuilds, and
lands the result:

```sh
isocan edit <the map>  docs/meridian/atlas/atlas.html
isocan edit <the twin> docs/meridian/atlas/SYSTEM.md
```

Two things happen that are worth naming. The thread resolves, so the canvas
stops showing it as open. And `isocan edit` makes a **new version** of the same
items rather than new items beside them — so the atlas has one identity across
every rebuild, and its history is a stack rather than a graveyard.

"Wait, did we decide that?" now has three answers that agree: the atlas says
resolved, the twin has it in the question index, and the thread has the
sentence Jordan actually wrote.

## Scene 7 — The system moves, and the atlas follows

Three weeks later the migration lands: a module splits in two and a queue
appears between them.

An agent parked on the repo notices — not because the diff was large, but
because the **shape** changed. It keeps a structural fingerprint (the module
graph's edges, the exported surface, the dependency list) and only acts when
that differs, because a new version per commit would make the stack useless.

It updates `data.mjs`, rebuilds, and lands a version of each view with a
comment saying what moved: *"`ingest.parser` split; `retry.queue` is new
between them."*

Priya presses `S` on the atlas. The stack fans out, and she is looking at the
architecture's history — the shape in March, the shape in June, the shape now.
No other tool in this space keeps that: they all overwrite, and the previous
shape is gone.

## Scene 8 — Arguing about a shape before building it

Jordan wants to propose collapsing two services. He does not edit the atlas —
he makes a **variation** of it: a sibling item carrying `parent=<data>`, with
his proposed `data.mjs` and its rendered map, sitting on the canvas beside the
current one.

Two atlases, side by side, at the same zoom, both explorable. The argument
happens on the thread between them. When it settles, one of them wins.

**And this is where the journey stops working** — see
[convergence](design/convergence.md), which takes this up. isocan can diverge — that is
`/variation`, and it is good — but it has no operation for *this one won*. The
version stack converges inside one item (`item.setCurrentVersion`); nothing
converges siblings back into the thing they came from. The
[market survey](research/2026-08-23-agents-on-the-canvas.md) reached the same
gap from an entirely different direction on the same day.

## What the scenes force (the load-bearing minimum)

**Scenes 0–4 need nothing built.** The skill installs onto a canvas today
(`isocan command add --from inkboard/system-atlas/skills/system-atlas/SKILL.md`),
`atlas.html` is self-contained, HTML items render in a sandboxed iframe with
scripts allowed, `parent` already expresses the lineage, and `isocan browse`
already projects a live one. That is the headline: most of this is a
convention, not a feature.

Four things are genuinely forced, smallest first.

1. **A question is a thread with an id.** A property — `question=Q-IN3` — on
   the thread, in the same spirit as `parent`, `annotates` and `star`. No new
   operation, and it makes the mapping queryable in both directions.
2. **A rebuild loop with a structural fingerprint.** A script and a scheduled
   job, exactly the shape of the changelog workflow, plus the fingerprint that
   decides when a change is *large*. Without the fingerprint the version stack
   fills with noise and Scene 7 is worthless.
3. **The answer round-trip.** Reading a resolved thread and writing it into
   `data.mjs` is the only place the two systems have to agree on a format. It
   belongs in the skill's own vocabulary, not in isocan's.
4. **Convergence.** Scene 8 needs `isocan choose <item>` — adopt this child as
   the parent's next version, retire its siblings, one op so it is one undo.
   Two independent lines of work now want it.

## Open debts

- **Pinned state does not survive a reload.** ~~HTML items are sandboxed
  without `allow-same-origin`.~~ **Taken up**, and the answer is not to widen
  the sandbox: item content is served from the app's own origin and the badge
  is a cookie, so `allow-same-origin` would let any item call the API as you.
  See [the content origin](design/content-origin.md) — move the content, not
  the flag.
- **A thread can be pinned to the atlas, not to a box inside it.** The atlas is
  one item; isocan cannot anchor a comment at `ingest.parser`. Closing this
  needs the atlas to emit a structure manifest with coordinates, and isocan to
  pin at them — worth doing only if Scene 5 proves itself first.
- **Who runs the rebuild?** A local agent that only notices when somebody is
  working, or CI that notices always and cannot ask a question. Probably CI for
  the fingerprint and an agent for the prose, which is the same split the
  changelog workflow already makes.
- **The atlas is only as good as its data file.** Everything here assumes the
  proposal in Scene 2 was right. A bad atlas is a confident wrong map, which is
  worse than no map — and it is exactly the kind of thing the eval plan's
  autoraters would have to judge, because no deterministic grader can.
