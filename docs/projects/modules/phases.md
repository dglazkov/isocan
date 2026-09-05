# Modules — the walk

Each phase ends with something a person can remove and watch disappear.
Ordered by what settles the most with the least: the registries before any
loader, because a loader with nothing to load into is a loader.

**Where we are:** phase 1 built 4 September 2026. Phase 2 next.

## Phase 1 — the registries, and the mind map as the first internal module ✅

*Built 4 Sep 2026.*

- `core/modules.ts`: `registerModule`, `modules()`, and the two readers core
  itself needs — `moduleContextPieces(canvas)` for `isocan context` and the
  Context view, `moduleEdges(canvas)` for the JSON Canvas export. Core
  imports no module.
- `packages/modules/mindmap/`: `core.ts` (the graph functions that were
  `core/mindmap.ts`, plus the `mindmap` record), `web.tsx` (the lines, as an
  underlay fed the canvas and the drag as props), `cli.ts` (the `map` family,
  registered through `CliHost`), `agent-guide.md` (the section that was in
  the base guide), and its tests.
- The two lists: `packages/web/src/modules.ts`, `packages/cli/src/modules.ts`.
- The web shell's first slot: `ModuleUnderlays`, inside `.world` before the
  items. The CLI's host object, and the guide printed with every loaded
  module's section after the base.
- `surface.test.ts` reads verbs and guides from modules as well as `main.ts`.
  `test/modules.test.ts` holds a module's name to its directory and the two
  lists.
- Root `workspaces` gains `packages/modules/*`; the workspace loader resolves
  `@isocan/<module>/<entry>` by path for git installs; vitest and eslint
  include the modules directory.

**Acceptance, run by hand on 4 Sep and recorded:** with the mind map's
directory moved out and its two list entries emptied, `tsc` was clean for
the web app and the CLI, `npm run build` passed, `isocan --help` had no
`map` and `--agent-help` no "Mind maps" section, and 999 tests across core,
the palette and the surface guard passed. Put back, the full suite is 3,401
green. The panel count from the research note is unchanged, on purpose:
this phase adds slots, not panels.

## Phase 2 — Mermaid, the first node-type module

`packages/modules/mermaid/`: kind `diagram`, mime `text/vnd.mermaid`,
extension `.mmd`. This is the phase that pays the union cost: `ItemKind`
widens to admit module kinds, `itemKind()` consults the registry before the
built-in chain, `KIND_LABEL` / `ICON_NOUN` / `KindIcon` fall back to the
module's label and a generic mark, `isocan ls --kind` accepts a module kind,
`cli/mime.ts` learns extensions from the registry. The renderer is the second
web slot, a `React.lazy` chunk carrying the Mermaid library, loaded when the
first diagram is seen. `isocan add diagram.mmd` needs no new verb; the guide
section says so. Acceptance: a diagram renders in the app, lists under
Diagrams in the files panel and `ls --kind diagram`, edits as text in the
stage and `$EDITOR`, and — with the module's list entries removed — renders
as a file that names the module.

## Phase 3 — runtime loading, for self-hosted homes

`isocan module add <dir | git spec>` / `rm` / `ls`; `~/.isocan/modules/<name>/`
holding `manifest.json`, `web.js`, `cli.js`, `agent-guide.md`; the engines
check; the manifest printed before `--yes`. The daemon serves `/api/modules`
and `/modules/<name>/web.js`; the shell activates each with a host object
carrying React and core; the CLI imports each `cli.js` before parsing. A
build script turns a `packages/modules/<name>` into that shape, so Mermaid is
both the build-time module of phase 2 and the runtime module that proves
phase 3 — and its removal is the acceptance: the diagram item stays, as a
file that names the module; the verbs are gone; the oplog is untouched.

## Phase 4 — documents

The module that needs the two slots that do not exist: an inspector (the
outline of the document, keyed to the kind) and a page (a doc-centric section
beside the workbench). A prose editor as the renderer; `/outline` and
`/summarize` as commands; export. Every edit is `item.addVersion`.

## Phase 5 — sandboxes

Gated, and the gates are named: the content origin, extension actors, and the
compute-consent question agent-custody left open. Not before all three.
