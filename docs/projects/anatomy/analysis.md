# Anatomy: what is being ported

Read from the sibling Anatomy checkout on 11 September 2026. This inventory
is about the application, not the projects somebody happened to analyse in it.

## The product

Anatomy explores a software project through a graph of domain concepts. Each
concept belongs to Goal & Intent, Structure & Flow, Data & States, or Rules &
Guardrails. Its status is settled, conflict, risk, or missing. A concern has a
plain-English reason and can name another axis in tension with its own.
Product, UX, engineering, and security assessments are optional evidence;
an absent assessment must not be presented as a completed review.

The current source implements **four** lenses (the README still says three):

| Surface | What it does | Source in Anatomy |
| --- | --- | --- |
| Project index | Saved projects, goal, repository, counts, import/export | `src/lenses/overview-lens.ts` |
| Overview | Editable goal and a narrative Markdown brief | `src/lenses/overview-lens.ts` |
| Blueprint | Hierarchy tree, spatial concept cards, focus/drill path, dependencies, inspector | `src/lenses/blueprint-lens.ts`, `src/spatial-stage.ts` |
| Open Decisions | Conflict/risk/missing queue, explanation, assessments, evidence, jump to concept | `src/lenses/decisions-lens.ts` |
| Coverage | Concepts by axis crossed with four discipline assessments and citations | `src/lenses/coverage-lens.ts` |
| Inspector | Summary, parent, dependencies/dependants, citations, discussion, proposed mock | `src/lenses/blueprint-lens.ts` |
| Source preview | Source text with line/citation context | `src/lenses/coverage-lens.ts`, `/api/source-content` |
| Agent panel | Prompt input, ephemeral progress, activity transcript | `src/lenses/shell-modals.ts` |

The live Blueprint uses Pixi (`SpatialStage`). Three.js `SpatialUniverse` and
the canvas-2D `NeighborhoodMap2D` also exist, but `main.ts` does not instantiate
them. Porting every renderer would preserve experiments rather than the UI
people currently use. `src/stage/layout-math.ts` holds graph distances,
connections, and a radial layout; `src/graph/topology.ts` holds convergence,
hierarchy and inferred dependency direction.

## The state and its transport

`SystemGraphState` contains project identity, repository path, goal, analysis
settings, brief, sources, nodes, edges, checkpoints, and activity. Nodes own
citations, resolution options, comments, and optional HTML mock proposals.
Checkpoints contain complete node/edge snapshots. Exports are plain JSON.

The browser and CLI talk to an Express daemon on port 4455, with whole-state
WebSocket updates. The daemon persists JSON under `data/projects`, keeps a
global active project, serves local source files, and maintains a separate
long-poll notification queue. `main.ts` owns routing, selection, modal state,
DOM replacement and incremental canvas updates in one large class.

Those are replacement boundaries: isocan already has per-canvas identity,
operations, versions, undo, offline replicas, comments, permissions, presence,
and waiting agents. A second daemon or a graph hidden inside one HTML iframe
would prevent native selection, comments, movement, and agent access.

## Behaviours to improve while preserving the intent

- Missing discipline assessments currently read as settled in coverage. The
  port must say **Not assessed**; zero nodes is not 100% convergence.
- Dependency direction is inferred from English labels and category-specific
  heuristics. Preserve explicit directed edges and labels in the port;
  parenthood is its own relationship, not a guessed dependency direction.
- Goal edits ask for reevaluation; they do not establish that analysis has
  happened. Agent activity belongs to isocan presence, never imported as a
  claim that an agent is presently working.
- Checkpoint selection in the prototype records an active id but its current
  `getEffectiveState()` still returns live state. The port must distinguish a
  checkpoint preview from live state and make restore an explicit undoable act.
- A source path is a citation, not authority to read arbitrary server files.
  Imported citations show their snippets; source bytes are available only
  after somebody explicitly adds a file to the canvas.
- Historical comments retain their original author/time as provenance. They
  must not be replayed as though those authors just posted through isocan.

## Existing isocan seams

Modules already contribute kinds, renderers, underlays, palette actions,
inspectors, pages, overlays and drops. `WebHost` supplies writes and blob
uploads; `CliHost` supplies the normal command context and client. Runtime
bundles use the host's React/core objects. Core imports no module, and tests
enforce that the only module imports outside a module are the two registries.

A full page covers the canvas; an overlay has no selection or camera access
and cannot reserve space. Neither models this product. The missing seam is a
**workspace**: module-owned chrome around one host-owned canvas, with bounded
read/navigation capabilities. See [design.md](design.md) for the contract and
[phases.md](phases.md) for the implementation order and acceptance gates.
