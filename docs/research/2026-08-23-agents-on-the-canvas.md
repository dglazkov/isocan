---
status: noted
since: 2026-08-30
note: the category converged on MCP + a skill, which isocan has; edges deliberately declined
---
# Agents on the canvas: what the field shipped in a year

**23 August 2026**

The question: *what have infinite-canvas and design tools shipped in the last
year around multi-participant work and agent collaboration that isocan should
absorb?* — with two named sub-questions carried in from earlier work: whether
anyone has made **edges** a first-class primitive worth copying, and how other
tools handle **divergence and convergence**.

The short version: between May and June 2026 the entire category shipped the
same headline — *the canvas is a surface agents read and write* — and every one
of them shipped it as **MCP plus a skill**. Almost nobody shipped the other
half. Figma, Miro, MagicPath and Framer all made it cheap to produce five
answers; only Framer and Cursor made it a gesture to pick one. That asymmetry
is where isocan's gap is, and it is a small one.

## Standing findings, re-checked

- **[JSON Canvas](json-canvas.md) (22 Aug)** — **still true.** The spec is still
  1.0; no edge changes, no new node types, still MIT, still extensible by
  unknown fields. Nothing in the last year moves the "good export, bad storage
  format" conclusion. Its open product question — *do we want relationships
  visible?* — is now answerable from outside the spec; see **Edges** below.
- **[Agent skills](agent-skills.md) (22 Aug)** — **sharpened.** That survey's
  observation was that a skill is a file that changes agent behaviour with
  nowhere for the work to land. The vendors now agree with the first half:
  Figma ships `/figma-use` as a markdown skill *beside* its MCP server, and
  Miro and Excalidraw ship the same pair. The vendor-published skill is now the
  standard shape, which is exactly what `isocan command add --from
  <owner/repo/path>` already consumes.
- **[Feature readiness](feature-readiness.md) (21 Aug)** — untouched by this
  run. Nothing here re-grades a row.

## 1. The category converged on one interface, and it is MCP + a skill

| what shipped | when | mechanism |
| --- | --- | --- |
| [Figma opens the canvas to agents](https://www.figma.com/blog/the-figma-canvas-is-now-open-to-agents/) | Mar 2026 | native Figma MCP server; `use_figma` writes layers, `generate_figma_design` turns live-app HTML into editable layers; agents are oriented by a markdown skill, `/figma-use` |
| [Miro Canvas 26](https://miro.com/newsroom/miro-takes-aim-at-the-gap-between-ai-potential-and-organizational-reality/) | 19 May 2026 | MCP surface widened to **board creation, frames, comments, shapes and code blocks** — comments included, which almost nobody else exposes |
| [Figma's own agent](https://www.figma.com/blog/the-figma-agent-is-here/) | 20 May 2026 | first-party, in the file, "beside you on the canvas… as a true collaborator" |
| [MagicPath 2.0](https://alternativeto.net/news/2026/5/magicpath-2-0-debuts-multiplayer-ai-canvas-and-rebuilt-agent-system/) | mid-May 2026 | multiplayer canvas, humans and agents each with **visible presence**, several agents building different screens at once |
| [Framer 3.0](https://humblytics.com/blog/framer-3-agents-branching-community) — agents, branching, external agents (no primary changelog page found; secondary source) | 16 Jun 2026 | agents co-edit inside the canvas; **external** agents admitted |
| [Excalidraw+ MCP](https://plus.excalidraw.com/docs/mcp) | v2.0, 28 Jul 2026 | public API + MCP; separately, **guest commenting** — feedback without an account |

**What it means here.** It is tempting to read this as "isocan needs an MCP
server" and stop. Look at what MCP is actually doing in that table: it is the
*transport by which an agent that lives somewhere else acquires a vocabulary
for the canvas*. isocan already has that, and has had it longer — the CLI is
the vocabulary, `isocan --agent-help` is the orientation, and
`.agents/skills/isocan-collab` is the doorway. The difference is not capability;
it is **discoverability**, and it is real: an agent in a harness that speaks MCP
and nothing else cannot find isocan today.

An MCP adapter would be a thin server whose tools are the existing `Operation`
union, posting to the same `/api/ops`. Zero new ops. It survives the
one-reducer rule by construction, because it is not a second writer, it is a
second *dialer*. The risk is the one-vocabulary rule rather than the one-reducer
rule: a hand-written tool list is a third surface that can drift from the CLI
and the app, and AGENTS.md's parity test currently holds a line between two
surfaces, not three. If it is built, it should be **generated from the op union
and covered by that same test**, or not built.

Verdict: a runner-up. It is a distribution bet, not a product one.

## 2. Agent-native formats — and this is the real answer to the edge question

Miro's most specific decision at Canvas 26 was not the MCP surface, it was
adding **Mermaid, Markdown and HTML widgets** as first-class board content, on
the stated reasoning that these are formats "agents speak natively". Figma
reached the same place from the other side with [code layers](https://www.figma.com/blog/code-on-the-figma-canvas/)
(24 Jun 2026): live, runnable code sitting on the canvas as a layer, created by
the agent or by hand, with "extract designs" turning it back into editable
layers.

**Whether we already have it: mostly yes, and earlier.** isocan's items *are*
files. Markdown renders. HTML renders live in a sandboxed iframe with
`allow-scripts` and no `allow-same-origin` — which is Figma's code layer, minus
the round-trip to design layers, shipped before it. The one format in Miro's
list with no home here is **Mermaid**.

That gap matters more than it looks, because of what it says about edges. The
question inherited from [json-canvas.md](json-canvas.md) was whether isocan
should grow a native edge primitive so that diagrams become possible. Miro's
answer — from a tool that has had connectors since forever — is that **when the
author is an agent, the cheapest way to express a graph is to write the graph as
text**. An agent does not want a drawing gesture, a hit-test surface on four
sides of every item, or `fromSide: "right"`. It wants to emit six lines and have
them render.

A `text/vnd.mermaid` item is `item.add` with a blob and a renderer in the web
package. **No new operations. No inverses. No referential-integrity rule. No
counter-scaled edge labels at every zoom** — the single hardest thing in the
edge cost list, avoided entirely because the diagram is one item that scales as
a unit. It versions, it undoes, the CLI lists it, the blob on disk is a real
`.mmd`, and it is portable to Miro, GitHub, Obsidian and Notion without a
converter.

## 3. Edges: what the state of the art actually is, and why it still is not for us

Two genuinely different edge models exist, and neither wants what a native
isocan edge would be for.

**Bindings (tldraw).** The relationship is *its own record*, not a property on
either shape: an arrow attached to a rectangle is a `binding` row between them,
and deleting the rectangle cleans up the binding through the same mechanism
that cleans up any other. This is the best-designed edge model in the category,
and the lesson it carries is precisely the cost json-canvas.md flagged —
referential integrity is the hard part, not rendering. A binding-shaped design
here would be a third top-level collection beside `items` and `threads`, with
trash-and-restore semantics to match. That is not a small addition; it is a
change to the shape of `CanvasState`.

**Edges as execution (n8n, LangGraph, Miro Flows).** The other half of the world
gives the edge *control-flow meaning*: connecting two nodes means "when this,
then that". Miro shipped exactly this on a whiteboard as **Flows** — multiplayer
visible workflows, 250+ connectors, running against Slack, GitHub, Atlassian.
This is the only edge model that would earn its cost here, because it is the
only one where the edge does something rather than depicts something.

And isocan already has the vocabulary for it without edges. `isocan wait
--item <ref> --op item.addVersion` **is** an edge from a thing to an agent, and
it is one that survives without a rendering story. The
[feature-readiness](feature-readiness.md) row "trigger agents on events —
Assemble; needs a runner + durable triggers" is the same feature, one op
cheaper, and already graded.

**Where this lands.** json-canvas.md's resolution stands and is now better
supported: **`parent` stays, and projects to an edge in the view and on export
— one direction of truth, property → edge, never back.** What this run adds is
that the strongest argument *for* native edges — "without them we can't do
diagrams, and a diagramming tool is a category we're not in" — is answered by a
file type rather than a primitive. Ship the Mermaid item and the pressure to
add edges mostly evaporates.

One thing worth stealing from Miro anyway: its MCP surface includes **comments**.
Every other vendor exposes shapes and frames and stops. isocan is the only tool
in this survey where the conversation and the artefacts are the same
addressable state on both surfaces, and Miro is the only other one that thinks
agents should be able to reach it. That is a validation, not an action item.

## 4. Divergence and convergence: everyone shipped the going-wide half

This is the finding that reorders the list.

| tool | divergence | convergence |
| --- | --- | --- |
| [Figma agent](https://www.figma.com/blog/the-figma-agent-is-here/) (20 May) | "parallel prompt to play out multiple ideas at once"; "go wide" — N stylistic directions generated side by side, each using your design system, no manual frame duplication | **none named.** You delete the losers by hand |
| [Cursor `/best-of-n`](https://cursor.com/docs/configuration/worktrees) + Multi-Agent Judging (2.2) | same prompt across N models, each in its own git worktree, outputs surfaced side by side | pick a winner — and the tool **evaluates the candidates and recommends one with reasoning** |
| [Framer 3.0](https://humblytics.com/blog/framer-3-agents-branching-community) (16 Jun) | named isolated branches off `main`, agent edits land on a branch | **a branch graph, commit cards, one live diff, one-click merge** — and this is explicitly the safety story for letting an agent touch a production site |
| MagicPath 2.0 (mid-May) | one prompt fans out to several agents, each building a screen in parallel on the shared canvas | not described |

**Whether we already have it: the divergence half, yes, and arguably better.**
`/variation` (built-in, `packages/core/src/commands.ts`) already does what Figma
announced: N *real* alternatives — "two variations that differ by a font are one
variation" — each added with `--prop parent=<source>`, hung in a column under
their source by `/format`, **named by the idea rather than by a number**, and
closed with one comment saying what each is trying and which the agent would
keep. That last clause is Cursor's Multi-Agent Judging, written as a sentence in
a skill instead of a subsystem. And unlike every row in that table, each isocan
candidate carries its own author, timestamp, version stack and undo, because it
is an ordinary item.

**What we do not have is the convergence op.** There is no operation in the
union that means *this one won*. Grep confirms it: no `choose`, no merge, no
promote-to-parent. What exists is:

- `item.setCurrentVersion` — converges, but only **vertically**, inside one
  item's stack.
- `/variation` — diverges **horizontally**, into siblings that never rejoin.

So the two halves of diverge/converge are implemented in two different
geometries that do not meet. A person who asks for three variations and likes
the second one has no gesture and no command for saying so. They drag it, or
delete two items, and the canvas keeps no record that a decision was made. That
is precisely the hole Framer decided was important enough to build a whole
branch UI around, and the one Cursor decided was worth a judge.

The Progress survey of the category ([11 Aug 2026](https://www.progress.com/blogs/designing-on-the-canvas-with-agents))
names the same hole from outside: in multiplayer agent canvases, "how changes
get attributed, how they get reviewed and who signs off on what an agent
altered" is the part "the field has barely started to work through". isocan has
attribution solved — every op stamped with an Actor, undo scoped per actor,
every version signed. It is the **sign-off** half that is missing, and sign-off
is convergence.

## 5. Spatial scoping: tldraw's fairies, and the half of it worth taking

The most interesting mechanism found in this run is tldraw's, and it is an
experiment rather than a product: [Fairydraw](https://fairies.tldraw.com/), a
one-month run in December 2025, and the
[agent starter kit](https://tldraw.dev/starter-kits/agent) that came out of it.

The mechanism, in my words: **each agent has a position and a viewport of its
own**, and what it is told about the canvas is graded by distance from that
viewport. Three formats do the grading — `BlurryShape` for things in the
agent's viewport (bounds, id, type, text, and nothing else), `FocusedShape` for
the few it is actually attending to (colours, alignment, the full property set),
and `PeripheralShapeCluster` for everything else, which collapses to a bounding
box and a count. An **orchestrator agent that cannot create shapes** decomposes
the work and assigns *task bounds*; worker agents only perceive what is inside
their bounds.

The claim, which I find persuasive: the canvas beats a chat thread for running
several agents because **context boundaries become spatial instead of
filtered** — an agent's working set is defined by where it is, not by a
retrieval step — and because you can tell what an agent is doing by looking at
where it is, without parsing its output.

**Whether we already have it: half.** isocan agents already have a live cursor
(`session start|point|move`); ops move that cursor to their locus so presence
narrates itself; the facepile shows them in their identity colour; `wait --item`
and `wait --op` already scope what wakes one. What is missing is the **read**
side — an agent has no way to ask "what is near me" or "what is inside this
box". `isocan ls` lists the canvas; there is no `--near <item>` and no
`--within x,y,w,h`.

That gap is worth closing and costs nothing structural: **a query is not an
operation.** Adding spatial filters to `ls` and `show` touches no reducer, no
inverse, and no stored state — it is exactly the kind of thing the isomorphism
gets for free, and it would let a parked agent build the graded context tldraw
built by hand. The three-tier blurry/focused/peripheral rendering is a good
default for what `--json` returns at each level.

The **claim** side — an agent leasing a region so others stay out — is a bad fit
and should be said so plainly. A lease is coordination state that is not canvas
state: it expires, it is not undoable, it has no meaningful inverse, and putting
it in the op log would mean the oplog records who was *thinking about* an item.
isocan's single-writer engine plus actor-stamped ops already makes collisions
visible rather than destructive, which is the property a lease is trying to buy.
Good idea, wrong shape for us.

## What to be suspicious of, from this run

- **A native connector tool because Miro and Figma have one.** That is fear.
  The merit case for edges is execution semantics, and that case is already
  filled by `wait` filters and durable triggers.
- **Anything that assumes a model.** Figma's agent is trained on Figma and built
  with OpenAI and Anthropic; Miro's Sidekicks are Miro's. isocan ships no model
  and should not start. The reframing worth noticing: Miro's *headline* at
  Canvas 26 was letting **third-party** agents onto the board — Claude, ChatGPT,
  Copilot — and Framer 3.0 shipped "External Agents" as a named feature. The
  bring-your-own-agent stance stopped being isocan's handicap and became the
  thing the incumbents spent a year retrofitting.
- **Numbers.** None are quoted here that did not come from a vendor page, and
  none are estimated. Adoption figures for any of these products were not found
  from a primary source and are therefore absent.

## Recommendation

**Ship the convergence operation. BUILT 29 Aug 2026** — as `isocan choose`,
and **without a new op type**, which is the one place this recommendation was
overtaken by events. It asked for a composite op with a computed inverse, and
that was right when it was written; op grouping shipped on 28 Aug, so
`item.addVersion` plus one `item.delete` per child, all carrying one group,
gives the same one-gesture-one-undo out of ops that already exist and already
replay. A new op type would have been a second way to say something the
vocabulary could already say.

Two things the recommendation could not have known:

- **The winner goes to the trash too.** Its content is now the source's top
  version, so leaving it would be two copies of one decision and an invitation
  to edit the wrong one.
- **There is nowhere to carry the idea-name.** `ItemVersion` has a filename
  and an author, and a group is an ID rather than a label — grouping matches
  by string equality, so two decisions sharing a human name and landing next
  to each other would merge into one undo. What records the decision is the
  version on the source and the named children in the trash, both recoverable.

**The original recommendation, as written:** One op that means *this one won*: on a
sibling made by `/variation` (or on any item with a `parent`), fold the chosen
child back onto its source — `item.addVersion` on the parent from the child's
current blob, the losing siblings to the trash, the child's idea-name carried
onto the version so the stack records *what was chosen and why it was called
that*. `isocan choose <item>` on one surface; "Keep this" on the fanned-out
child, or on the version fan (`F`), on the other. One composite op with one
computed inverse, so the whole decision undoes as a unit and the losers come
back from the trash.

Why this one:

- It **completes something already shipped** rather than adding a surface.
  `/variation` and version stacks are both built; they simply do not meet.
- It is the half of diverge/converge the entire category left undone, and the
  half Framer and Cursor proved people want as a *gesture*, not a cleanup task.
- It turns the version stack into a record of decisions instead of a record of
  edits — which is the "sign-off" the field admits it has not solved, and which
  isocan is unusually placed to solve because it already has attribution.
- It is the correct shape: one `Operation`, one reducer, both surfaces, one
  undo. Nothing about it strains the constraint.

**Runner-up 1: a Mermaid item kind.** Cheaper than the recommendation — a mime
type and a renderer, days — and it is the answer to the edges question, which
makes it strategically load-bearing out of proportion to its size. It lost
because it is an *addition* rather than a *completion*: an agent that wants a
diagram today can already write an SVG or an HTML item and get one, so this
buys convenience and portability rather than a capability that is absent. Build
it second; build it soon.

**Runner-up 2: an MCP adapter over the existing op vocabulary.** The whole
category standardised on this in one year, and an agent that speaks only MCP
cannot find isocan. It lost because it is a distribution bet rather than a
product one — `--agent-help` and the `isocan-collab` skill already reach the
harnesses that matter — and because it introduces a third surface that can drift
from the other two. If it is built, generate the tool list from the `Operation`
union and put it under AGENTS.md's parity test, so the one-vocabulary rule holds
at three surfaces the way it holds at two.

**And one free thing while you are in there:** `isocan ls --near <item>` /
`--within x,y,w,h`. It is a query, it costs no operation, and it gives a parked
agent the graded spatial context tldraw had to build a whole prompt system to
produce.

## Sources

- [Agents, Meet the Figma Canvas](https://www.figma.com/blog/the-figma-canvas-is-now-open-to-agents/) — Figma, Mar 2026
- [The Figma Design Agent is Here](https://www.figma.com/blog/the-figma-agent-is-here/) — Figma, 20 May 2026
- [Code on the Figma Canvas](https://www.figma.com/blog/code-on-the-figma-canvas/) — Figma, 24 Jun 2026
- [Miro takes aim at the gap between AI potential and organizational reality](https://miro.com/newsroom/miro-takes-aim-at-the-gap-between-ai-potential-and-organizational-reality/) and [Canvas 26](https://miro.com/canvas/) — Miro, 19 May 2026
- [tldraw agent starter kit](https://tldraw.dev/starter-kits/agent) and [fairies.tldraw.com](https://fairies.tldraw.com/); talk: [Agents on the Canvas with tldraw](https://gitnation.com/contents/agents-on-the-canvas-with-tldraw), Steve Ruiz
- [Cursor worktrees](https://cursor.com/docs/configuration/worktrees) and [agent best practices](https://cursor.com/blog/agent-best-practices) — Cursor
- [Framer 3.0: agents, branching, community](https://humblytics.com/blog/framer-3-agents-branching-community) — 16 Jun 2026
- [Excalidraw+ MCP](https://plus.excalidraw.com/docs/mcp) and [changelog](https://plus.excalidraw.com/changelog) — v2.0, 28 Jul 2026
- [MagicPath 2.0](https://alternativeto.net/news/2026/5/magicpath-2-0-debuts-multiplayer-ai-canvas-and-rebuilt-agent-system/) — mid-May 2026
- [Designing on the Canvas, with Agents](https://www.progress.com/blogs/designing-on-the-canvas-with-agents) — Progress, 11 Aug 2026 (the cross-tool survey; source for the unsolved-review claim)
- [JSON Canvas](https://jsoncanvas.org) — spec still 1.0
