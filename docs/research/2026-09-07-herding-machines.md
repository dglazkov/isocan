---
status: noted
since: 2026-09-07
see: standing-agents, personas, on-demand
note: herdr aggregates agents that live on MACHINES, over SSH, into one terminal. isocan and sheep have each already dissolved that problem rather than solved it — a canvas is the aggregator, and a cell has an address instead of a machine. Nothing to adopt here; one real gap it does name, and it is sheep's, not isocan's. Also: "herd" would mean two things one layer apart.
---

# Herding machines, when the thing you are herding has no machine

**7 September 2026.** A survey, prompted by Dion: *"do you think there is a
place for herdr in the persona / sheep work?"*

Sources: [herdr, *Connecting the machines*](https://herdr.dev/blog/connecting-the-machines/)
(v0.9) and [`dglazkov/sheep`](https://github.com/dglazkov/sheep), read
7 Sep 2026.

## What herdr is, in its own terms

A terminal UI for managing agents and machine terminals — 700,000 downloads
and about a thousand plugins, which is the most interesting number in the
post. Its v0.9 release splits the rendering:

> Herdr's outer UI is rendered on the client. The servers still own their
> sessions and supply the terminal views.

You add a machine with `herdr machine add workbox`, it reaches it over SSH,
and the machine's workspaces, tabs and agents appear in one client. The
problem it names is precise and real:

> remember where each agent was running and switch between those tabs

Persistence is the machine staying up. Discovery is SSH today and a promised
account system ("Herdr Cloud") later. Agents run inside a single server; the
post is explicit that cross-machine agent collaboration is aspiration, not
mechanism.

## The finding

**herdr is a very good answer to a question neither of these projects asks.**

Its whole architecture rests on one premise: *a session lives on a machine, so
to see several sessions you must reach several machines.* Both isocan and sheep
have removed that premise, by different routes and for different reasons, and a
tool that aggregates machines has nothing to aggregate once they have.

| | herdr | sheep | isocan |
| --- | --- | --- | --- |
| Where a session lives | on a **machine** | in a **cell** — one SQLite database with an address | against a **canvas** — an oplog at a home |
| How you reach it | SSH to the machine, render its view client-side | address the cell | address the canvas |
| What survives | the machine staying up | eviction; the cell resumes itself on an alarm | everything, because the log is the truth |
| Idle cost | a process | nothing | nothing |
| Where several agents meet | side by side in one client | in a pasture | **on the canvas**, as presence |

**sheep dissolved it.** *"Coding agents whose sessions live in cells rather
than on machines… A terminal attaches from anywhere, the cell resumes on its
own after being evicted mid-turn, and an idle session costs nothing."* There is
no machine to remember, so there is no list of machines to keep. `cd` is the
switch between kennels; `sheep home deploy` puts the home on Cloudflare and
`sheep home join` brings a second machine in — and neither is a thing you
browse.

**isocan answered it, and the answer is the product.** `isocan rc --all` parks
one process on every canvas a machine's enrolments name; the facepile says who
is standing by; `isocan history <actor>` leads with a row per canvas. **The
canvas is the aggregator.** Where herdr puts many sessions side by side in one
client, isocan puts many actors on one surface — which is not a view of the
work, it is the work.

That difference is the whole of it. herdr's client is a *window onto* several
places. A canvas is one *place*.

## For the persona work: a clean no

Personas are unattended by construction. A cron fires, a run writes a page, a
finding sits in a column until somebody decides it, and since 7 Sep an
undecided one reddens the build. Nobody watches a persona run in a terminal,
and nobody should have to — **herdr's value is watching; the persona system's
value is not having to.**

There is a sharper reason to refuse it, and it is one day old.
[The docket](2026-09-07-the-docket.md) (#206) argues at length that the thing
this project needs is a surface where a fact is *decided*, and quotes #148 on
what happens otherwise: *"If the canvas only ever displays, it is a dashboard
and will be looked at twice."* herdr is an excellent display. Adding one now
would be moving in the direction that note was written to argue against.

## What is genuinely worth taking

Three things, and only the first is a design.

**1. The split render — and it belongs to sheep, not isocan.** A sheepdog
herding six sheep today has `sheep ls`, `sheep status` and `sheep log`, which
are polls, and `sheep attach <id>`, which is one sheep in one terminal. **There
is no way to watch six at once**, and herdr's shape is exactly the right one
for it: the client draws the chrome, each session supplies its own view. The
part that does not transfer is the transport — sheep's cells already speak
WebSocket (pi's own client attaches over one, and two terminals already share a
cell), so this is a client, not a protocol. SSH is herdr's answer to machines,
and there are no machines here.

Filed as an observation about another repository rather than work for this
one.

**2. A thousand plugins and 700,000 downloads.** That is a real reading of what
people want from a multi-agent terminal, and it is exactly what
`.agents/personas/market-researcher.md` exists to bring back — *"a written
survey with a recommendation, not a list of links"*. Worth carrying into that
lens rather than into a dependency.

**3. The sentence.** *"remember where each agent was running and switch between
those tabs"* is the clearest statement of the cost this project's presence
model exists to remove, written by somebody who solved it the other way. It
belongs in the argument for why an agent stands on a canvas rather than in a
tab.

## The naming risk, stated before it happens

herdr herds **machines**. sheep's sheepdog herds **sheep**. Two systems, one
person, one metaphor, one layer apart — and if they ever meet, *herd* means two
things in one sentence.

This is not a hypothetical worry in this codebase. `archive` already meant the
gc'd oplog when the shelf wanted the word, and the split cost a design decision
(#194: the property is `shelved`, the UI says Archive). And on the day this
note was written, a test file called `fold.test.ts` was overwritten by a second
feature that also called itself folding — lesson 37.

If anything ever bridges them, the bridge needs its own word on the first day.

## Recommendation

**Nothing to adopt for isocan.** Not for the personas, not for the docket, not
for standing agents. The problem herdr solves is one this product answers by
being a canvas, and the answer is better for what this is.

**One thing to note for sheep**, which is not this repository's to build: the
dog cannot watch its herd, and herdr has the right shape for that view.

**And one thing to keep**: the naming collision, before there is anything to
rename.
