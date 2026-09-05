---
status: partial
since: 2026-09-02
see: context, inception, standing-agents
note: designed 2 Sep — memory as three layers of canvases (this canvas, canvases it links, the person's own), every layer a directory of files anyone can read and any repo can hold, shown in one Context view with provenance; Honcho stays an index over it, never the record. Phases 0–1 built 4 Sep — the Context view and `isocan context` in layers with a heading per source, and `memory=inherit` on a canvas card bringing the linked canvas's design system, pins and size in read-only with provenance and the override rule; `design check` reads the governing one. Phase 3 the same day — the Context sheet a first link lays and lands on, and the memory mark on the card as the switch. Phases 2 and 4 not built
---
# Memory, in layers you can see

**2 September 2026.** A design, before a build. As asked: *look at the context
system and think about Honcho and a memory system. Use the canvas to display
the memory the agent has access to. Layer it: project memory shared by
everyone on the project; memory inherited from linked canvases — a canvas
holding a design system shared with other projects; personal memory — a canvas
every user has, like a `~username` home directory, linked and unlinked from a
canvas as needed. What could it look like visually, what does it look like on
the file system so agents and humans can see it, and how does it get checked
into a repo, or live locally, or in cloud storage?*

The short version. **Memory is canvases, and a canvas is a directory.** The
[context project](../context/design.md) settled the hard question a week ago
and nothing here reopens it: the canvas is the record, a memory system is at
most an index, and three tests decide any proposal — can it be undone, can
everyone see it, does it work with the network off. What was missing was not
a store but *layers*: today an agent's context is one canvas's worth. This
design makes it three layers of the same thing — **this canvas**, **the
canvases it links**, and **the person's own canvas** — each an ordinary
canvas, each already a directory of files on disk, joined by one kind of
item and read by one command. Visually it is the Context panel with a
heading per layer and a *from* chip on every borrowed piece. On disk it is
`~/.isocan/projects/<id>/` three times over, which is why it can be a git
repository, a folder in a cloud drive, or nothing but local. Honcho and
Hindsight index it over MCP if somebody wants them to; they never hold a fact
the canvas does not.

## What memory already is

`isocan context` answers *what will an agent read when it starts here* by
counting, never storing: the design system and whether it checks out, the
pinned items, the Chat and how much of it, the recap at its current
resolution, the bound directory on this machine, the guide's version — each
with where it came from, how big it is, when it moved, and why it is stale
when it is. That list is layer one, and it is the whole of what an agent has
today. Everything below adds sources to that list; nothing changes what a
source is.

On disk a canvas is already a directory anyone can read:

```
~/.isocan/projects/prj_2quQpga4qZ/
  project.json     the record: title, description, properties
  oplog.jsonl      every fact, attributed, in order — the memory itself
  canvas.json      the fold, for a fast open
  blobs/           the files the items carry
  trash.json
```

There is no memory file to invent. There is a directory to point at, three
times.

## The three layers

**1. This canvas — project memory, shared.** What is here now. Unchanged,
except that the Context view learns to say *this canvas* as a heading once
there are other headings.

**2. Linked canvases — inherited memory.** A canvas holding a design system
that four product canvases follow; a canvas of research every project reads
first; a team's glossary. The link is the item [Canvas Inception](../inception/design.md)
designs — an ordinary item pointing at another canvas — wearing one more
property: `memory=inherit`. A linked canvas contributes its *context pieces*
here, read-only: its design system (if this canvas has none of its own, the
linked one governs; if both, this canvas's wins and the panel says so), its
pinned items, its recap's head. Not its Chat and not its items wholesale —
context is what somebody decided matters, and the link inherits exactly that
decision. Several links compose in the order they sit on the canvas, top to
bottom, left to right, because that is the order the room reads.

**3. The person's own canvas — personal memory.** Every actor gets a canvas
born at first sign-in, titled `~<name>`, private by construction: link grant
off, the actor's own badge the one admitted, the way a sprint desk is born.
It is the person's home directory — the notes they keep, the preferences an
agent should know, the things they pin for themselves. **Linking it** to a
canvas places a canvas item for it there with `memory=personal` — visible to
everyone on that canvas as *Maya's canvas is linked*, its pieces read only by
agents acting **as Maya** and only while she is on the canvas. Unlinking is
deleting the item, one undo. The link is a canvas fact — everyone can see
that it exists — while the contents stay behind the home canvas's own door,
which is the only way the second test (can everyone see it) and privacy both
hold: what can be seen is *that* Maya brought her memory, not *what* it says,
unless she shares the home canvas itself.

Layer three answers a question the context project deliberately left: where
does a preference about a *person* live? Here — on a canvas the person owns,
sees, can edit, undo and delete, rather than as a derived psychological fact
computed somewhere else. Honcho's user model becomes, at most, an index over
`~maya`.

## What it looks like

**The Context panel**, which exists, grows headings. *This canvas* first.
Then one per linked canvas, each with the canvas's title, a small picture of
it (the inception card, drawn live) and its contributed pieces — design
system, pinned items, recap — each piece wearing a *from Design System* chip
in the linked canvas's colour. Then *Your canvas*, with a switch: linked
here or not. A piece the same canvas would have contributed twice is shown
once with two chips. A design system that is overridden by a local one is
shown struck, with *this canvas's wins* beside it. Stale reasons apply across
layers: a linked design system older than the screens here says so.

**On the canvas**, a linked canvas is the inception card, with a small
*memory* mark on its strip — the way a slide wears 🎬 — so the link is a
thing you can see, move into a sheet, and delete. The recommended place is a
sheet named *Context* at the canvas's origin, laid by whoever links the first
one, so every canvas has a corner where its inheritance sits and a newcomer
reads it first.

**For the agent**, `isocan context` prints the same three headings with the
same provenance, and `isocan context pin --from <canvas>` pins a linked
canvas's item into this canvas's context without copying it. An agent that
starts work reads one list and knows where every piece came from, which is
the whole point of the context project restated with more sources.

## On the file system, and in a repo

Because every layer is a canvas and every canvas is a directory, **memory is
files**, and the questions about where it lives have the same answers files
have:

- **Locally.** It already is: `~/.isocan/projects/<id>/`. Human-readable
  JSON and JSONL, blobs by hash. `cat oplog.jsonl` is the memory.
- **In a repository.** `isocan export` (built 2 Sep) writes a canvas, or every
  canvas at a home, into a directory as its whole history, and `--git` makes
  a commit; `isocan import` brings one back with seqs and timestamps intact.
  A team's design-system canvas exported into the product repo under
  `memory/design-system/` is memory in version control, reviewable as a diff,
  and `import` is how a fresh machine or a CI runner gets it. A person's
  `~maya` exported to a private repo is their memory, theirs, portable.
- **In cloud storage.** The same directory in a synced folder. The home
  already treats a canvas's directory as the truth and the log as
  append-only, so a synced copy is a replica by another road — with the
  caveat every synced folder has, that two machines appending at once need
  the home, not the folder, to order them. The honest version: export to the
  folder on a schedule, import from it on a new machine, and let the home
  be the home.

What is deliberately **not** a file anywhere: a derived belief about a person
that nobody wrote. If an index (Honcho, Hindsight, a vector store) wants to
compute one, it computes it from these files and keeps it in its own store,
and the canvas never learns it unless somebody writes it down — as an item,
undoable, visible, on `~maya` or on the project.

## Honcho, again, and MCP

The context project's verdict stands and this design gives it a better
substrate. An index over three directories is a better index than one over
one. The MCP surface the context project named and did not build is where it
plugs in: *read the context* (all three layers, with provenance), *read a
canvas's recap*, *read a pinned item*. A memory system that speaks MCP gets
everything an agent gets, no more, and writes back only through the ops
anyone else would — a note on the canvas, a pin. Nothing imported, nothing
shipped, no vendor named in core.

## Journey, in four scenes

**1 — Inherit the design system.** Theo's team keeps *Design System* as a
canvas. On *Onboarding v2* he places it with the inception popup and ticks
*inherit memory*. The Context panel gains a heading, *from Design System*,
with the system and its two pinned rationale notes; `isocan design check`
on this canvas now checks against it; an agent building a screen here reads
it first without being told.
*Acceptance:* one link, and `isocan context` on the second canvas names the
first canvas's design system as governing here, with provenance.

**2 — Bring yourself.** Maya opens a client's canvas she has never seen.
Her `~maya` exists already. She flips *Your canvas: linked* in the Context
panel; a small card appears in the Context sheet saying *Maya's canvas is
linked*. Her agent, acting as her, now reads her standing preferences —
*I review on a phone; keep screens at 390 first* — and nobody else's agent
can. She unlinks when the engagement ends; ⌘Z would relink.
*Acceptance:* the link is visible to all, the contents to her and her
agents only; unlink is one undo.

**3 — Put it in the repo.** The team exports *Design System* into the
product repo with `isocan export --git`, reviews the diff of a token change
in a pull request, and a CI runner imports it to grade screens against it.
*Acceptance:* the memory a canvas inherits is the same bytes a repository
holds, round-tripped by `export`/`import`.

**4 — A newcomer reads the corner.** Ravi joins *Onboarding v2* and the
first thing at the origin is the *Context* sheet: two linked canvases and
their cards, and the panel says what governs here and why.
*Acceptance:* a canvas's inheritance is on the canvas, at the origin, not in
a settings page.

## Phases, in dependency order

0. **Context, with headings.** The panel and `isocan context` group by
   source canvas even when there is one — the seam the rest lands in.
1. **Inherited memory** (needs inception phase 0): `memory=inherit` on a
   canvas item; the linked canvas's design system, pins and recap head join
   the context read-only, with provenance and the override rule.
2. **The person's canvas**: `~<name>` born at first sign-in, private; a
   *Your canvas* switch that places or deletes the link item; pieces read
   only by the person's own actors while present.
3. **The Context sheet** convention, laid on first link; the memory mark on
   the card.
4. **MCP read surface** over the three layers, the context project's unbuilt
   stage, so any index can index this.

**Zero new op types** again: two property values on an item kind another
project defines, and a canvas born the way desks are born. **Both surfaces**
by the tests that hold every verb. **The record is never hidden**: every link
is an item anyone can see, and every piece of memory is a file anyone
admitted can read.

## What was built

**Phases 0 and 1, 4 September 2026.** `core/memory.ts` holds the contract:
`memory=inherit` on a canvas card (`memoryOf`, `memoryLinks` in reading
order — top to bottom, then left to right — and `memoryPatch`, cleared with
`removeProperties` the way a pin is); `inheritedPieces` is what a linked
canvas contributes — its design system, its pinned items, its size, each
piece wearing `from`; `contextLayers` puts *This canvas* first and a heading
per link after it, a link that could not be read keeping its heading with the
reason; `governingDesign` is the override rule as one function, this canvas's
own first, else the first inherited in reading order, with the inherited one
listed struck and *this canvas's wins* beside it when both exist. The Context
panel pulls each linked canvas the way the inception card does (same
`getSnapshot`, same two refusals in words — not admitted, or lives at another
home) and renders the layers with a *from* chip on every borrowed line;
`isocan context` prints the same headings and `--json` returns the layers.
The gestures: *Inherit its memory here* as a tick in the Add popover when a
canvas is what is being added; `isocan canvas place <ref> --inherit`; and
`isocan context inherit | uninherit <item>` on a card already placed.
`isocan design check` on a canvas with no design system of its own checks
against the governing inherited one and says whose. Proved in
`core/test/memory.test.ts`, `web/test/memory.test.ts` and
`cli/test/place.test.ts` over a real daemon.

Not built, and deliberately: the recap's head as a contributed piece (there
is no recap function in core to read it from — the "History" row counts
ops), the small picture of the linked canvas in the panel (the card on the
canvas already is one), phase 2's `~<name>` canvas, phase 3's *Context*
sheet convention and the memory mark on the card, and phase 4's MCP surface.

**Phase 3, later the same day.** The *Context* sheet is a convention with
one name: `contextSheet` is any sheet titled Context, and `contextSheetSpot`
is where the first link lays it — the origin when the origin is clear,
otherwise to the left of everything, level with the top, the rule `area
new` keeps. A link placed with nowhere else said (`canvas place --inherit`
with no `--at`, `--in`, `--anchor` or `--cell`; the popover's tick) goes onto
it, laid first if it is the first link; the app gained `addAreaItem`, the
sheet `isocan area new` makes spelled the same. The memory mark is a word
on the card's strip, *memory*, lit when the other canvas's context is read
here — and it is the switch, writing the same patch `isocan context inherit
| uninherit` writes, so a card already on the canvas becomes a link from
the strip. Not built: phase 2 and phase 4, as above.
