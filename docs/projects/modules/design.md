---
status: partial
since: 2026-09-04
see: modules, extensions, workbench, mindmap, iso-api, atlas
note: designed 4 Sep from the research note's counts; phases 1 (the registries, the mind map as the first internal module), 2 (Mermaid, the first node-type module — the union paid), 3 (runtime loading — module add/rm/ls, a host object, no import map) and 4 (documents — the inspector, page and command slots; the prose editor deferred) built 4–5 Sep. Phase 5, sandboxes, waits on the content origin, extension actors and compute consent
---
# Modules — a package that contributes to both surfaces, and can be taken away

**4 September 2026.** The ask: *let's have a module system, and can we make
it dynamic so external modules can be loaded and unloaded outside of core?*
The [research note](../../research/2026-09-04-modules.md) counted what that
costs today and what makes it possible; this is the design it argued for, made
concrete enough to build, with the first phase built the same night.

## The sentence

> **A module is a package that contributes to the registries on both surfaces
> at once, and that can be removed leaving every item it made still readable
> as a file.**

Both halves are load-bearing. The first is the isomorphism applied to
packaging: a module that ships a renderer and no verb is the web-only feature
AGENTS.md forbids, in a box. The second is what makes *add and remove* honest
rather than a slogan, and it is already true of the data model — an item is a
file with a mime type and a property bag, the 33 operations know nothing about
kinds, and a canvas whose module is gone renders as files.

The rule a module lives under is the extensions design's rule, one step out:

> **A module may only add what a person could already do with a file and a
> verb.**

A new kind is a file with a new mime. A new panel is a list the CLI can
already print. A new tool is a gesture whose intent has a verb. A module that
cannot be described that way is asking for a product change — and product
changes are made in the product, with an op if they need one, never in a
module.

## What a module is made of

One package, `packages/modules/<name>/`, three entry points, each for the
surface that loads it:

| Entry | Loaded by | What it holds |
| --- | --- | --- |
| `core.ts` | both, through the other two | the pure facts: property keys, the functions that read them, and **the `CoreModule` record** — what this module contributes to core's registries (context pieces, edges, kinds) |
| `web.tsx` | the web shell's list, `packages/web/src/modules.ts` | components the shell mounts in its slots — today an *underlay* drawn inside `.world` under the items; next a *renderer* keyed by mime, a *panel*, a *page* |
| `cli.ts` | the CLI's list, `packages/cli/src/modules.ts` | `register(host)`: a verb family hung on the same commander program, through a **host** that hands it the CLI's own helpers; and the module's **guide section**, printed inside `isocan --agent-help` only while the module is loaded |

The two lists are the whole coupling. A distribution's modules are the
entries in those two files; everything else about a module is inside its own
directory. **The removability test is literal:** delete the module's
directory and its two list entries, and `npm run build`, `npm test` and
`isocan --help` all agree the feature never existed. A guard in `test/`
holds the weaker, mechanical half of that — a module's name may appear
outside its directory only in the two lists, the lockfile and the docs.

### Core's registry

`core/modules.ts` is small on purpose. `registerModule(record)` and
`modules()`; a module's record names what it contributes:

```ts
interface CoreModule {
  name: string;                                     // "@isocan/mindmap"
  propertyKeys?: readonly string[];                 // the keys it owns — namespaced, forever
  contextPieces?: (canvas) => ContextPiece[];       // rows in `isocan context` and the Context view
  edges?: (canvas) => { from: Item; to: Item }[];   // lines the canvas draws; edges JSON Canvas exports
  kinds?: readonly ModuleKind[];                    // phase 2: a mime, a label, a noun, an icon name
}
```

Core reads the registry where it used to call the mind map by name: the
context pieces walk asks every module for its rows; the JSON Canvas exporter
asks every module for its edges. **Core imports no module.** The web shell
and the CLI register each module's record from their lists, so a surface that
does not load a module gets a core that has never heard of it — which is the
only way "removed" can mean removed.

### The web contract

The shell owns the slots and the modules fill them. A slot is a place in the
shell's tree where it maps over `MODULES` and mounts what each contributes,
handing it **facts as props, never stores**: the module's component gets the
canvas and the live drag, not the zustand hooks. That keeps the dependency
pointing one way — a module knows core and React; it does not know the shell.

Slots, in the order they are needed:

1. **Underlay** (built): inside `.world`, before the items, in world units.
   The mind map's lines live here.
2. **Renderer** (phase 2): an entry in `VersionContent`'s chain, keyed by a
   mime test, mounted before the built-in chain so a module can own a mime
   the built-ins would otherwise call a document. Lazy — a renderer is a
   `React.lazy` chunk loaded when its kind is first seen, never at boot.
3. **Panel**, **page**, **inspector**, **tool**: designed in the research
   note's manifest and the extensions design; each lands when a module asks.

### The CLI contract

`CliHost` is the set of helpers the CLI's own verbs use and a module's verbs
need: the program, `run`, `ctxOf`, `resolveCanvas`, `resolveItem`, `sendOp`,
`printJson`, `sizeFor`, `placementFor`, `truncate`. Nothing else. A module
that wants more is asking for a helper to be promoted — a review question, not
a private import.

The guide is the same object it always was, with a rule added: `isocan
--agent-help` prints the base guide and then each loaded module's
`agent-guide.md`. `surface.test.ts` reads verbs from `main.ts` **and** from
every module's `cli.ts`, and documented verbs from the base guide **and**
every module's guide. A module verb nobody is told about does not exist,
exactly as before.

## What a module may not add

**Operations, ever.** **Protocol messages.** **Server routes, at first** — a
route is a door and the desk's whole job is that every door runs the same
test; if a second real module ever needs one it is `/api/m/<name>/…` behind
the same badge check. **A hidden store** — module state is an item, visible
and versioned. **Reading the desk.**

## Two trust classes

An **extension** is an item on a canvas, put there by a collaborator, trusted
like one: sandboxed, attributed, revoked by the desk. A **module** is a
package on a machine, put there by the operator of a home, trusted like the
CLI they installed: it runs as the app. The relationship: **a module is the
runtime an extension may need.** Where the module is absent the item is still
there, as a file, and the card can say *made with `@isocan/x`, not installed
here* from the mime alone.

## Dynamic: loading and unloading outside core

The ask's second half. Two shapes, and they are stages rather than rivals:

**Build-time modules** (phase 1, built): a distribution chooses its modules
when it builds — the two lists. isocan.io gets what CI built. A self-hosted
home that wants a different set edits two lines and rebuilds. No loader, no
import map, nothing on disk but the code.

**Runtime modules** (phase 3): a module ships **prebuilt** — `manifest.json`,
`web.js`, `cli.js`, `commands/`, `agent-guide.md` — into
`~/.isocan/modules/<name>/`. The mechanics, decided here so the phase is a
build and not a design:

- `isocan module add <dir | git spec>` copies it in after printing the
  manifest — every kind, verb, panel and page it declares — and refusing
  until `--yes`, the ceremony `command add --from` already has. `module rm`
  removes the directory; `module ls` prints what is loaded and why anything
  was refused.
- **The engines check.** A manifest names the isocan range it was built
  against; a home outside the range refuses that module with a sentence
  naming both versions and loads everything else.
- **The CLI half** is the easy half: before `parseAsync`, the program imports
  each `cli.js` and calls its `register(host)` with the same host build-time
  modules get.
- **The web half** cannot be compiled where it is installed, so it is not
  imported through the bundle. The daemon serves `/api/modules` (the loaded
  manifests) and `/modules/<name>/web.js`; the shell fetches the list at boot
  and `import()`s each file. A runtime module's `web.js` exports
  `activate(host)`, and the **host object** carries `React`, the JSX runtime
  and `core` — so a module is written against the host it is handed rather
  than against an import map the shell would have to emit for hashed chunks.
  Obsidian's shape, read from its docs; the one rule of theirs carried over
  verbatim: *never keep references to views; the factory may be called many
  times.*
- **Unload is the proof.** The acceptance for phase 3 is the Mermaid module
  removed from a home that has a diagram on a canvas: the item renders as a
  file, the card says which module made it, `isocan ls --kind` files it under
  `other`, the `diagram` verbs are gone from `--help`, and the oplog is
  untouched.

## What was decided against

- **A manifest as the only truth**, with the code registering nothing. The
  manifest is what a person reads before `--yes`; the record the code
  registers is what the app runs. Two copies, and a test that they agree, is
  cheaper than a manifest that has to be expressive enough to be code.
- **Modules importing the shell's stores.** It works and it is a dependency
  in the wrong direction; a module that reads `useUiStore` is a shell file
  in a different directory. Facts as props.
- **Wiring modules through an import map** for the web half. The bundle's
  chunks are hashed; an import map would pin React to a URL the next build
  changes. A host object is what every plugin system that survived a major
  version does.
- **Letting a module add an op.** Once, for a good reason, and the vocabulary
  is no longer closed. The mind map, the sprint, areas, context and personas
  each added zero; that is the standard.

## Open

- **Unions become strings** when the first module kind lands (phase 2):
  `ItemKind` widens, `KIND_LABEL` and `KindIcon` gain a fallback, and every
  exhaustive switch over kinds stops being exhaustive. Paid on purpose, in
  one commit, with the fallback tested.
- **The guide grows per module.** A module's section is printed only while
  it is loaded, which is the right first cut; printing it only when its kind
  is on the canvas is the short-brief idea and waits for #124.
- **Who runs modules on isocan.io** is the same decision as running
  `release` unattended, which auto-upgrade left open. One answer should cover
  both.
- **`@isocan` on npm.** Git specs work today and need no account; the scope
  is a distribution decision this design does not make.
