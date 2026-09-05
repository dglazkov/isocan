# Writing a module

Everything you need to add a module to isocan: what one is, where it lives,
every extension point it can fill and the exact shape each expects, how it
reaches the platform, how it is built and installed, and the guards that
will hold it. [`design.md`](design.md) is the argument; this is the manual.
The three modules in `packages/modules/` — `mindmap`, `mermaid`,
`documents` — are the worked examples, and each one uses a different subset
of what is below.

## The sentence, and the rule

> A module is a package that contributes to both surfaces at once, and that
> can be removed leaving every item it made still readable as a file.

> A module may only add what a person could already do with a file and a
> verb.

A new kind is a file with a new mime. A new panel is a list the CLI can
already print. A new palette action is an op the CLI could already send. If
what you want cannot be described that way, it is a product change: make it
in the product, with an op if it needs one, and then a module may use it.

**A module may never add** an operation, a protocol message, a server route,
a hidden store, or a read of the identity desk. Module state is an item,
visible and versioned. Property keys a module writes are namespaced
(`whiteboard.grid`, never `grid`) and are yours forever: keys replay, and a
removed module's keys must read as orphaned rather than be reused by the
next one.

## The layout

```
packages/modules/<name>/
  package.json        name @isocan/<name>, "type": "module", exports ./core ./web ./cli
  tsconfig.json       extends ../../../tsconfig.base.json, jsx react-jsx, lib DOM
  agent-guide.md      the section `isocan --agent-help` prints while the module is loaded
  src/core.ts         the pure facts, and the CoreModule record — default export
  src/web.tsx         the WebModule record — default export
  src/cli.ts          the CliModule record — default export
  test/               vitest, picked up by the root config
```

Three entry points, one per surface that loads it. `core.ts` must not
import React or Node; `web.tsx` may import React; `cli.ts` may import Node.
All three may import `@isocan/core`. `cli.ts` may import types (only types)
from `@isocan/cli/modulehost`. Nothing in a module imports from
`packages/web/src` or `packages/cli/src` — a module knows core and its own
files, and is handed everything else.

**Default exports matter.** The build script reads `core.ts`'s default
export to write the manifest, and the runtime loaders read `web.tsx`'s and
`cli.ts`'s default exports to register the module. A named export alone
builds fine and loads nothing; `test/modules.test.ts` refuses it.

## `core.ts` — the `CoreModule` record

The part of a module core sees. Core computes some facts itself — the rows
of `isocan context`, the edges the canvas draws and JSON Canvas exports, the
kind of an item, the slash commands — and asks the registry for each
module's contribution. Core imports no module; both surfaces register the
record from their lists.

```ts
import type { CoreModule } from "@isocan/core";

export const myModule: CoreModule = {
  name: "@isocan/whiteboard",          // the package name; its last segment is the slug
  propertyKeys: ["whiteboard.grid"],   // every key you write, namespaced
  kinds: [{                            // a kind is a mime first
    id: "whiteboard",
    mimes: ["application/vnd.isocan.whiteboard+json"],
    extensions: ["whiteboard"],        // bare, lower-case — how `isocan add x.whiteboard` learns the mime
    label: "Whiteboards",              // the plural a list groups under
    noun: "whiteboard",                // the singular a tooltip uses
    icon: "drawing",                   // a built-in mark it borrows; unset = the plain file mark
  }],
  contextPieces: (canvas) => [...],    // rows in `isocan context` and the Context view
  edges: (canvas) => [...],            // { from: Item, to: Item }[] — lines the canvas draws, edges JSON Canvas exports
  commands: [...],                     // SlashCommand[] — see "Slash commands"
};
export default myModule;
```

Every field but `name` is optional. What each buys:

| Field | Read by | Effect |
| --- | --- | --- |
| `kinds` | `itemKind()` in core, ahead of the built-in mime tests but after the property-marked kinds (text nodes, canvas cards) | `isocan ls --kind <id>`, the files panel's groups, the card's icon and tooltip; `cli/mime.ts` and `web/lib/mime.ts` learn the extensions, so `isocan add` and a dropped file land the mime. With the module gone the same file falls through to whatever the built-ins call it — usually `document` or `other`. |
| `propertyKeys` | the manifest, `isocan module add`'s print | Declares what you own. Nothing enforces it yet; it is the record a reviewer reads. |
| `contextPieces` | `contextPieces()` in core | Rows in `isocan context` and the Context panel. The mind map's "Mind maps" row is one. |
| `edges` | `moduleEdges()` in core | The JSON Canvas export writes them as edges; your own underlay is what draws them. |
| `commands` | `withModuleCommands()` on both surfaces | Slash commands, source `module`, laid UNDER the built-ins and the home's own — a built-in or home command of the same name wins. |

**Kinds and the union.** `ItemKind` is `BuiltinKind | (string & {})`. Your
kind's id is a string every consumer looks up with a fallback: the web app's
`kindLabel`, `kindNoun` and `iconKindFor` read your `label`, `noun` and
`icon`. Do not name a built-in's id (`drawing`, `text`, `screen`, `image`,
`video`, `document`, `site`, `canvas`, `other`).

**Slash commands** are `SlashCommand` objects — `name`, `description`,
`usage`, `body` (markdown: what the agent should do), `source: "module"`.
The body is the skill: name the verbs the agent should use, and say what it
must never do. Because the daemon registers no module, `/api/commands` does
not list them; each surface lays them in for itself, so an agent reading
the composer's menu or `isocan command list` sees them, and an agent
reading the raw route does not.

## `web.tsx` — the `WebModule` record and the five slots

The shell owns the slots and maps over its module list to fill them. Every
slot is handed **facts as props, never stores**: a module component gets a
canvas, an item, a drag, a way to read bytes — not `useCanvasStore`. That is
what keeps the dependency pointing one way and what lets a runtime module
run without the shell's source.

```ts
import type { ComponentType } from "react";
import type { InspectorFacts, PageFacts, RendererFacts, UnderlayFacts, WebModule } from "@isocan/core";

export const myWeb: WebModule<
  ComponentType<UnderlayFacts>,
  ComponentType<RendererFacts>,
  ComponentType<InspectorFacts>,
  ComponentType<PageFacts>
> = {
  core: myModule,
  underlays: [Lines],
  renderers: [{ mimes: ["application/vnd.isocan.whiteboard+json"], component: Board }],
  actions: [tidy],
  inspectors: [{ kinds: ["whiteboard"], label: "Layers", component: Layers }],
  pages: [{ segment: "boards", label: "Whiteboards", hint: "every board on this canvas", component: Boards }],
};
export default myWeb;
```

The four type parameters are the component types of the four component
slots; leave a parameter off (it defaults to `never`) when you do not fill
that slot, as `mermaid` does with `WebModule<ComponentType<UnderlayFacts>,
ComponentType<RendererFacts>>`.

| Slot | Where it mounts | Facts it is handed | Notes |
| --- | --- | --- | --- |
| `underlays` | inside `.world`, before the items, in world units | `UnderlayFacts { canvas, drag }` — `drag` is `{ itemIds, dx, dy } \| null`, the live gesture, so a line can ride it before the replica moves | Draw under the items: a node is chromeless text and a line over it strikes through the words. The mind map's lines. |
| `renderers` | `VersionContent`, ahead of the built-in chain, on the card and on the stage | `RendererFacts { canvasId, blobHash, mimeType, filename, entered, url, readText }` | Key your effects on `blobHash`, not on `readText` — the shell may hand a fresh closure per render for the same bytes, and the first Mermaid renderer refetched on every presence tick. Put a heavy library behind `React.lazy` in a separate file so a canvas without your kind never downloads it. |
| `actions` | the ⌘K palette's Canvas group | `ModuleActionFacts { canvas, selection }` | `run` returns the ops to send (or nothing); the shell sends them echoed, so a tidy is an `items.move` the terminal sees as the same op. Every module action writes and is withheld on the read-only canvas. `available` decides whether it is offered. |
| `inspectors` | beside the workbench's stage, when the open item's kind is one you name | `InspectorFacts { canvasId, item, readText }` | Read, do not write. The documents module's Outline. |
| `pages` | a cover route at `x/<segment>` under the canvas's path, with the shell's bar (← Canvas, your label, your hint) above your component | `PageFacts { canvasId, canvas }` | Reachable from ⌘K ("Open <label>") and `isocan open --page <segment>`. Link to items with `workbenchItemPath` / `itemPath` from core; never spell `/p/`. |

Colours and spacing in anything you render come from the app's tokens
(`var(--ink)`, `var(--card)`, `var(--line)`, `var(--ink-soft)`,
`var(--radius)`): the token, scale and dimmed guards in `packages/web/test`
read `styles.css`, and your styles live there for now, under a comment that
names your module.

## `cli.ts` — the `CliModule` record and the host

```ts
import type { Command } from "commander";
import type { CliHost, CliModule } from "@isocan/cli/modulehost";

function register(host: CliHost): void {
  const { run, ctxOf, resolveCanvas, resolveItem, sendOp, printJson } = host;
  const board = host.program.command("board").description("Whiteboards: …");
  board.command("new <words...>").option("--canvas <canvas>").action(
    run(async (words: string[], _opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const p = await resolveCanvas(ctx);
      const snapshot = await ctx.client.snapshot(p.id);
      // … uploadBlob, sendOp(ctx, p.id, { type: "item.add", … })
      if (ctx.json) return printJson({ … });
    }),
  );
}

export const myCli: CliModule = {
  core: myModule,
  register,
  guide: readFileSync(fileURLToPath(new URL("../agent-guide.md", import.meta.url)), "utf8"),
};
export default myCli;
```

`CliHost` is the set of helpers the CLI's own verbs use, and nothing else:

| Member | What it is |
| --- | --- |
| `program` | the commander program — hang your family on it |
| `run(fn)` | wraps an action so its errors print as the CLI prints them |
| `ctxOf(cmd)` | the `Ctx`: `ctx.client` (snapshot, uploadBlob, downloadBlob, …), `ctx.json`, `ctx.canvasRef` |
| `resolveCanvas(ctx)` | the canvas the command means |
| `resolveItem(snapshot, ref)` | an item by id, prefix or title |
| `sendOp(ctx, canvasId, op, group?)` | the one door every op goes through; `group` makes several ops one undo |
| `printJson(value)` | `--json` output |
| `sizeFor(spec, fallback)` | `--size WxH` |
| `placementFor(snapshot, opts, size?)` | `--at`, `--anchor`, `--in`, `--cell` |
| `truncate(text, max)` | for a table cell |

A module that wants a helper not on this list is asking for one to be
promoted — a review question, not a private import. Keep the guide path as
`../agent-guide.md` relative to `src/`: the build puts `cli.mjs` in `dist/`,
one level down, so the same relative path resolves in both layouts.

**The guide.** Every verb `register` adds must appear in a backticked span
in your `agent-guide.md` (`isocan board new`), and the section is printed
after the base guide only while the module is loaded. `surface.test.ts`
reads verbs from every module's `cli.ts` and enforces it.

## Registering: the two lists

A build-time module is one line in each list, and those two lines are the
whole coupling:

```ts
// packages/web/src/modules.ts
const LIST: ShellModule[] = [mindmapWeb, mermaidWeb, documentsWeb, myWeb];
// packages/cli/src/modules.ts
export const CLI_MODULES: readonly CliModule[] = [mindmapCli, mermaidCli, documentsCli, myCli];
```

Plus: add `"packages/modules/<name>/package.json"` to the Dockerfile's
manifest layer (a missing line is not refused by `npm ci`; the image's web
build dies resolving your module later, and dev and prod sit still with no
GitHub signal — this happened), and run `npm install` so the workspace is
linked. Remove those lines and the module is gone from the build; its items
stay, as files. That is the acceptance every phase was held to.

## Runtime modules: build, install, load

A self-hosted home can load a module the build did not carry.

```
node --import tsx scripts/module-build.mjs <name> [--out <dir>]
```

writes `<dir>/manifest.json`, `agent-guide.md`, `dist/web.js` (+ chunks) and
`dist/cli.mjs`. The manifest comes from `package.json` (`name`, `version`,
`description`, `isocan.engines` defaulting to `>=0.1.0`) and from `core.ts`'s
default export (`kinds`, `propertyKeys`); the code halves are esbuild
bundles in which the four platform imports — `react`, `react/jsx-runtime`,
`react-dom`, `@isocan/core` — are rewritten to reads of `globalThis.isocan`.
Everything else you import is bundled in. The web half is code-split, so a
`React.lazy` boundary in your source stays lazy on the wire.

```
isocan module add <dir>                    # prints the manifest, installs nothing
isocan module add <dir> --yes              # copies it to ~/.isocan/modules/<slug>/
isocan module add github:owner/repo#ref    # or any URL git clones: root or build/
isocan module ls                           # built in, added, and why any is refused
isocan module rm <slug>
```

No restart on either surface. The daemon reads `~/.isocan/modules/` per
request: loaded manifests ride `GET /api/serving` and each module's files are
served under `/modules/<slug>/…`. The app registers every manifest's record
first (so your kinds are known before any code runs), sets
`globalThis.isocan = { React, jsxRuntime, core }`, `import()`s your `web.js`,
and hands its default export to the same list build-time modules are in. The
CLI does the same before it parses argv, with `globalThis.isocan = { core }`
and your `cli.mjs`'s default export's `register(host)`.

**The engines check.** `engines` is `>=a.b.c`, `^a.b.c` (npm's reading, the
same minor while the major is 0), or `*`. Judged against `ISOCAN_VERSION` at
`add` and again at every load; a refused module is a row with a reason in
`module ls` and loads nothing else's less.

**What a runtime module cannot do that a build-time one can:** nothing, by
design — the same record, the same slots. Two things to know: its CSS has
no home yet (inline styles or a `<style>` you mount), and the hosted home
does not load runtime modules; whether it ever should is a decision the
[design](design.md) leaves open.

## The guards that will hold you

- `test/modules.test.ts`: your package name appears outside your directory
  only in the two lists (comments included — write `@isocan/<name>` in
  prose); you are in both lists or neither; each half has a default export;
  your manifest is copied in the Dockerfile; a `cli.ts` has an
  `agent-guide.md` beside it.
- `packages/cli/test/surface.test.ts`: every verb your `cli.ts` registers is
  named in a backticked span in your guide.
- `packages/core/test/address.test.ts`: nothing hand-spells `/p/` — build
  addresses with `canvasPath`, `itemPath`, `workbenchItemPath`,
  `modulePagePath`.
- `packages/web/test/placement-guard.test.ts`: a coordinate placement says
  `chosen: true`, or a comment beside it says why the spot is not chosen.
- `packages/web/test/tokens.test.ts`, `scale.test.ts`, `dimmed.test.ts`: no
  literal colours, no new spacing step, no opacity on text.
- `packages/web/test/lint.test.ts`: the rules of hooks, over
  `packages/modules/*/src/**/*.tsx` too.

## Checklist

1. `packages/modules/<name>/` with `package.json` (`"type": "module"`,
   `exports` for `./core`, `./web`, `./cli`), `tsconfig.json`, `agent-guide.md`.
2. `src/core.ts`: the `CoreModule` record, default-exported. Namespace your keys.
3. `src/web.tsx`: the `WebModule` record, default-exported; facts as props;
   heavy libraries behind `React.lazy`; effects keyed on `blobHash`.
4. `src/cli.ts`: `register(host)`; the guide read from `../agent-guide.md`;
   default-exported.
5. One line in each list; one `COPY` line in the Dockerfile; `npm install`.
6. Tests in `test/`; run `npx vitest run packages/modules/<name>
   test/modules.test.ts packages/cli/test/surface.test.ts`.
7. Prove removal once by hand: take the directory and the two lines out,
   build, and watch it vanish from `--help` and the app.
8. If it is for a self-hosted home rather than the build: `node --import tsx
   scripts/module-build.mjs <name>` and `isocan module add`.

## What is not there yet

No panel or tool slot — a dock panel or a rail tool is still a shell change.
No inspector on the canvas, only in the workbench. No per-module CSS file.
No way for a card to name the module a file came from when that module is
absent. A prose editor for documents, deferred. Sandboxes, which wait on the
content origin, extension actors and compute consent. Each is listed in
[`phases.md`](phases.md) with what unblocks it.
