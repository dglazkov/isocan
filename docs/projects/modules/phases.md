# Modules — the walk

Each phase ends with something a person can remove and watch disappear.
Ordered by what settles the most with the least: the registries before any
loader, because a loader with nothing to load into is a loader.

**Where we are:** phases 1–4 built 4–5 September 2026. Phase 5 waits on three named gates.

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

## Phase 2 — Mermaid, the first node-type module ✅

*Built 4 Sep 2026.*

`packages/modules/mermaid/`: kind `diagram`, mime `text/vnd.mermaid`,
extensions `mmd` and `mermaid`, icon borrowed from `drawing`. This is the
phase that paid the union cost, in one commit: `ItemKind` is now
`BuiltinKind | (string & {})`, `itemKind()` asks the registry before its own
mime tests (and after the property-marked kinds, so a module names files and
not text nodes), `itemKinds()` puts module kinds before `other`, and the web
app's `kindLabel` / `kindNoun` / `iconKindFor` fall back to what the module
declared — the closed records keep their exhaustiveness over the built-ins.
`isocan ls --kind` reads the live list; both mime tables (`cli/mime.ts`,
`web/lib/mime.ts`) ask the registry for extensions first. The renderer is the
second web slot: `WebModule.renderers`, keyed by mime, asked ahead of the
built-in chain in `VersionContent` and handed `RendererFacts` (identity,
`url`, `readText`) rather than a blob path. The Mermaid library sits behind
a `React.lazy` boundary in `diagram.tsx`, rendered with `securityLevel:
"strict"`, themed by the page's three theme states. `isocan add flow.mmd`
needs no verb; the module's guide section says how the kind is used.

**Acceptance:** with the module registered a `.mmd` is a diagram in
`itemKind`, the kind list and both mime tables; unregistered, the same file
is a document. The guard tests hold the renderer to the slot and the library
to the far side of the boundary. What stays a hand check until phase 3's
runtime removal: the picture on a card at isocan.io once this promotes.

## Phase 3 — runtime loading, for self-hosted homes ✅

*Built 5 Sep 2026.*

`isocan module add <dir>` / `rm` / `ls`. `~/.isocan/modules/<slug>/` holds a
built module: `manifest.json`, `agent-guide.md`, `dist/web.js` (+ chunks),
`dist/cli.js`. `add` prints the manifest — name, version, engines, every
kind, key and half — and installs nothing until `--yes`; the engines check
(`>=a.b.c`, `^a.b.c`, `*`) refuses with a sentence naming both versions, at
add and again at every load. The daemon reads the directory per request: the
loaded manifests ride `/api/serving` (the fetch the shell already makes) and
each module's files are served under `/modules/<slug>/` — typed from the
static map, `no-cache`, `nosniff`, path-guarded to the module's real
directory. The shell registers every manifest's record first (kinds known
before any code runs), sets `globalThis.isocan` — the app's own React, JSX
runtime and core — and `import()`s each web half; `addModule` bumps a
generation the underlay slot, the renderer chain and the palette read. The
CLI does the same before it parses argv, through the same `CliHost` a
build-time module gets. `scripts/module-build.mjs <name>` makes the layout
with esbuild: platform imports rewritten to host reads, the web half
code-split so a lazy boundary stays lazy on the wire, the manifest written
from the package and the core record's default export.

**A git spec too, since phase 4:** `module add github:owner/repo#ref` (or
any URL git clones) is a shallow clone into a temporary directory in front
of the same code that reads a directory, the built module at the root or in
`build/`.

**Acceptance, run by hand on 5 Sep.** Mermaid taken out of both build-time
lists, the app rebuilt without it (no diagram chunks in `dist/`), a daemon
run from that tree on a scratch home. `isocan module ls`: the mind map only.
`module add <built mermaid>` printed the manifest and refused until `--yes`;
after it, `module ls` said `@isocan/mermaid 0.1.0 loaded`, `--agent-help`
printed the Diagrams section, `isocan add flow.mmd` landed a **diagram**
(the kind came from the manifest before any code ran — the first build's
CLI half was refused as CommonJS, and the kind still held), and the app
drew both diagrams from `/modules/mermaid/dist/web.js` with the host
object set and two SVGs on the cards. `module rm mermaid`: `ls --kind
diagram` refused the kind, the guide lost its section, the served path
answered 404, and the page showed both items as files — `flow.mmd
(text/vnd.mermaid)` — with the oplog untouched. Two things the proof found
and fixed on the spot: a `.js` CLI half under a home directory is
CommonJS to Node (built as `.mjs` now), and a web half with only a named
export loads nothing (default exports, and a guard).

## Phase 4 — documents: the inspector slot, the page slot, module commands ✅

*Built 5 Sep 2026.*

Three slots the earlier phases had no customer for, and the module that
asked for them. **Inspectors** (`WebModule.inspectors`, keyed by kind) mount
beside the workbench's stage for the open item's kind, handed the item and
its bytes on request. **Pages** (`WebModule.pages`) are cover routes of
their own at `/p/<canvas>/x/<segment>` — the same kind of thing the
workbench and the deck view are — mounted inside the canvas page with the
shell's own bar, reachable from ⌘K ("Open Documents") and from `isocan open
--page <segment>`; a segment nobody owns says so rather than showing a blank
cover. **Commands** (`CoreModule.commands`) are slash commands laid UNDER
the built-ins and the home's own on both surfaces, source `module` — the
daemon registers no module, so each surface lays them under whatever list
it holds.

`packages/modules/documents` fills all three and adds no kind, key or op: a
document is a markdown or text item brought as prose (not a caption, a note
or the design system). The **Outline** inspector reads headings and size;
the **Documents** page lists every document, newest edit first, opening on
the stage; `/outline` and `/summarize` are what an agent carries out;
`isocan docs ls` and `docs outline <item>` are the verbs they carry it out
with.

**Deferred on purpose:** the prose editor. The WYSIWYG note placed TipTap
and ProseMirror as the right layer for a markdown lens, and the renderer
slot from phase 2 is where it would go — but a markdown round trip through
a rich editor is its own project, with its own losses to measure, and
nothing in this phase's slots depends on it. The document still edits where
every text item does.

**Loose ends closed in the same PR:** `module add` takes a git spec
(`github:owner/repo#ref`, or any URL git clones — the built module at the
root or in `build/`), a shallow clone in front of the same code that reads a
directory, proved against a local bare repository in the test. Left open: a
card that names the module a file came from when the module is absent —
the mime does not carry the name, and inventing a registry of departed
modules is a second copy of a fact.

## Phase 5 — sandboxes

Gated, and the gates are named: the content origin, extension actors, and the
compute-consent question agent-custody left open. Not before all three.
