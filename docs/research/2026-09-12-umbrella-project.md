---
status: open
since: 2026-09-12
see: modules, extensions, standing-agents, sheep-harness, harnesses, on-demand
note: a strategy, not a measurement — the umbrella project that isocan, the sandbox canvas, anatomy and the live canvas graduate into. The argument is commoditize-the-complement in Eclipse's exact shape; the discipline is GitHub-only, no Google infrastructure, so the complement is actually commoditized rather than captured. Name shortlist inside, Umbra recommended
---

# The umbrella: where isocan goes from here

**12 September 2026.** A strategy in one page. Nothing built, on purpose:
this is the page that decides what the next things get built *under*.

## What we learned, four times

Four experiments ran this summer, and each proved one thing the others did
not:

- **isocan** proved the isomorphism. A canvas driven equally from a browser
  and a terminal, because both speak the same 33 ops to one reducer. People
  and agents collaborate on it; agents park on it and wait (`isocan rc`), one
  name across many canvases.
- **The sandbox canvas** proved a node can be a *machine*: each one an e2b
  VM, with inspectors that show what is running inside it.
- **anatomy**, now ported onto isocan, proved a canvas can hold a project's
  *understanding*: explore the code, set goals, watch them kept.
- **The live canvas** proved a canvas can have *semantics*: Gemini in live
  mode at the centre, image and video models at the edges, the whole map
  mirrored into a knowledge graph, every node reasoned over and cached so
  meaning sits on top of the pixels.

Every one of them wanted the same underlying thing — a node, an inspector
for its kind, an agent that can act on it from a CLI — and every one built
it again from scratch. That is the finding. The next project is the one where
nobody builds it a fifth time.

## What we build

One open umbrella project, in the spirit of Eclipse: a small, opinionated
kernel and a module system that is open *at runtime*, so the thing can be
morphed into whatever you need without asking anyone. Eclipse's insight was
"everything is a plugin" — the IDE was just the plugins that shipped first.
Ours is the same sentence: the canvas is just the modules that ship first.

The commitments, stated so they can be checked:

1. **Fully open source, on GitHub, and only on GitHub.** Issues, CI,
   releases, discussion, deploys. If a workflow needs Google infrastructure
   to run, it is not in the project.
2. **Bring your own agent.** Claude Code, Codex, pi, Gemini, a shell script:
   anything that can read a skill and run a CLI is a first-class
   collaborator. No preferred model, in the code or in the culture.
3. **Isomorphic CLIs.** A module that adds a node type adds its CLI verbs,
   so what an agent can do and what a person can click are the same set by
   construction. isocan's guarantee, promoted to a rule of the umbrella.
4. **Any node, with an inspector per kind.** A VM, a document, a goal, a
   model in live mode, a knowledge-graph entity: each is a module
   contributing a kind, its renderer, its inspector and its verbs. Remove the
   module and its items degrade to files, never to errors.
5. **Standing agents and sheep, as peers.** An agent that parks on a laptop
   and waits, and an agent that lives in a cell in the cloud and wakes on
   demand, are two answers to *how an agent stays*. The umbrella supports
   both and prefers neither.

The four experiments become the first four modules. That is the whole
migration plan.

## Why: commoditize the complement

Twenty-five years ago IBM took a forty-million-dollar IDE, gave it a name
widely read as a swipe at Sun, and gave it away. The IDE was the complement
to what IBM actually sold, and a free, excellent, extensible complement made
the whole market bigger while denying anyone else the chokepoint. It worked.
Eclipse is still here.

The workbench where people and agents meet — canvas, nodes, inspectors,
CLIs — is the complement to models. It is where model quality gets *felt*.
If that layer is proprietary and captured, whoever holds it taxes every
model. If it is open, ubiquitous and boring, models compete on merit and
demand flows to the best one. We intend to be the best one. So we want this
layer to be free, excellent, and everybody's.

That is also why *no Google infrastructure* is not a constraint we tolerate
but the point. A complement that only runs on our infrastructure is not
commoditized, it is captured, and nobody outside will adopt it. It keeps us
honest, too: anyone on the team should be able to run the whole thing on a
laptop against a non-Google model and feel exactly how different it is.
That feeling is data we cannot buy any other way.

## How we run it

- **An area to explore, not a product to polish.** The kernel is held to a
  high standard. Everything above it is allowed to be an experiment with a
  README.
- **Runtime-open modules**, in Eclipse's sense and in
  [isocan's design](2026-09-04-modules.md): install, remove, replace while it
  is running. The registry is the API.
- **Graduation is the only process.** An example project lives in its own
  repo until it becomes a module. No steering committee: a maintainer per
  module and a short kernel team.
- **"Should we support X?"** is always answered by "is there a module?"

## The name

Pull the three threads — Eclipse, isocan, Stitch — and the astronomy room and
the sewing room both offer words. A shortlist, with the reason each earns a
place:

| Name | Where it comes from | Why it fits | Watch out |
| --- | --- | --- | --- |
| **Umbra** | the full shadow an eclipse casts; the root of *umbrella* | an umbrella project named for what Eclipse casts. Short, one meaning, easy to say | Umbra (graphics middleware), Umbraco CMS |
| **Penumbra** | the half-shadow, where the eclipse is partial | the exploratory edge: unfinished, on purpose | Penumbra (privacy chain); three syllables |
| **Syzygy** | three bodies in a line | person, agent, canvas, aligned | nobody can spell it, which is a joke or a cost |
| **Selvedge** | the self-finished edge of cloth that stops it unravelling | the Stitch thread: a module system that lets anything be woven in without the whole coming apart | obscure outside denim |
| **Quilt** | squares by different hands, stitched into one | exactly what an umbrella of four projects is | Quilt (Minecraft mod loader) |
| **Seam** | where two things are stitched; in code, the place you change behaviour without editing it | isocan's own docs already reach for the word | JBoss Seam, dead but remembered |
| **Weft** | the thread that runs through the fixed warp | ops are the warp, modules the weft | small and quiet |

**Recommendation: Umbra**, with isocan, anatomy and the rest keeping their
names underneath it, the way Che and Theia sit under Eclipse. The bare word is
taken on npm — every single-word candidate is — so packages would be scoped,
and the GitHub org needs checking by hand.

## Next

1. Decide the name.
2. Stand up the org with the kernel and isocan inside it.
3. Port the sandbox canvas as the first module, and write down what it cost.
   That number is the first thing the umbrella exists to make smaller.
