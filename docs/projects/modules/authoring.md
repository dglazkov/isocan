# Writing a module

Everything you need to add a module to isocan: what one is, where it lives,
every extension point it can fill and the exact shape each expects, how it
reaches the platform, how it is built and installed, and the guards that
will hold it. [`design.md`](design.md) is the argument; this is the manual.
The modules in `packages/modules/` — `mindmap`, `mermaid`,
`documents`, `stickers`, and `anatomy` — are the worked examples, and each one uses a different subset
of what is below.

## How early this is — read this first

**The module API is pre-1.0 and we intend to break it.** It is at
`MODULE_API_VERSION` 0.2.2, it moved on the day a second person wrote a module
against it, and it will move again. Nothing here is frozen.

Two things follow, and they are the whole contract:

**Say what you need.** `engines` in your manifest names the module API range
you were built against — `^0.2.0`, not `*`. A build that cannot satisfy it
refuses you with a sentence naming both versions, which is the outcome you
want: a refusal you can read beats a module that half-loads.

**Say if you use the unstable parts.** `overlays`, `drops`, `host` and `workspaces` are
**proposed**: they exist, they work, and they have had one caller each. A
manifest that uses one names it in `proposed`, and `isocan module add` refuses
it unless the person adding it passes `--proposed`. That is VS Code's bargain
in the shape this codebase can afford — their stable API has essentially never
broken since 1.0 because everything unfinished lives behind a list a person
opts into, and cannot be published at all.

The parts NOT on that list — kinds, renderers, actions, inspectors, pages, the
CLI host — are older, have more than one caller each, and are where we will try
hardest not to break you. Try hardest is not a promise yet.

If you are exploring rather than shipping, do what #219 did: build it, find
where the API stops you, and say so. That is what moved this from 0.1 to 0.2.

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

## `web.tsx` — the `WebModule` record and the eight slots

The shell owns the slots and maps over its module list to fill them. Every
slot is handed **facts as props, never stores**: a module component gets a
canvas, an item, a drag, a way to read bytes — not `useCanvasStore`. That is
what keeps the dependency pointing one way and what lets a runtime module
run without the shell's source.

```ts
import type { ComponentType, ReactNode } from "react";
import type {
  InspectorFacts, OverlayFacts, PageFacts, RendererFacts, UnderlayFacts, WebModule, WorkspaceFacts,
} from "@isocan/core";

export const myWeb: WebModule<
  ComponentType<UnderlayFacts>,
  ComponentType<RendererFacts>,
  ComponentType<InspectorFacts>,
  ComponentType<PageFacts>,
  ComponentType<OverlayFacts>,
  ComponentType<WorkspaceFacts<ReactNode>>
> = {
  core: myModule,
  underlays: [Lines],
  renderers: [{ mimes: ["application/vnd.isocan.whiteboard+json"], component: Board }],
  actions: [tidy],
  inspectors: [{ kinds: ["whiteboard"], label: "Layers", component: Layers }],
  pages: [{ segment: "boards", label: "Whiteboards", hint: "every board on this canvas", component: Boards }],
  overlays: [{ region: "left", label: "Shapes", component: ShapeTray }],   // proposed
  workspaces: [{ segment: "explore", label: "Explore", cli: "board show", component: Explore }], // proposed
  drops: [{ mimes: ["application/vnd.acme.shape-id"], run: dropShape }],   // proposed
};
export default myWeb;
```

The six type parameters are the component types of the six component
slots; leave a parameter off (it defaults to `never`) when you do not fill
that slot, as `mermaid` does with `WebModule<ComponentType<UnderlayFacts>,
ComponentType<RendererFacts>>`.

| Slot | Where it mounts | Facts it is handed | Notes |
| --- | --- | --- | --- |
| `underlays` | inside `.world`, before the items, in world units | `UnderlayFacts { canvas, drag }` — `drag` is `{ itemIds, dx, dy } \| null`, the live gesture, so a line can ride it before the replica moves | Draw under the items: a node is chromeless text and a line over it strikes through the words. The mind map's lines. |
| `renderers` | `VersionContent`, ahead of the built-in chain, on the card and on the stage | `RendererFacts { item?, canvasId, blobHash, mimeType, filename, entered, url, readText }` | Key your effects on `blobHash`, not on `readText` — the shell may hand a fresh closure per render for the same bytes, and the first Mermaid renderer refetched on every presence tick. Put a heavy library behind `React.lazy` in a separate file so a canvas without your kind never downloads it. |
| `actions` | the ⌘K palette's Canvas group | `ModuleActionFacts { canvas, selection }` | `run` returns the ops to send (or nothing); the shell sends them echoed, so a tidy is an `items.move` the terminal sees as the same op. Every module action writes and is withheld on the read-only canvas. `available` decides whether it is offered. |
| `inspectors` | beside the workbench's stage, when the open item's kind is one you name | `InspectorFacts { canvasId, item, readText, host }` | **Writes now** (9 Sep 2026) — it read and could not write until `host` landed, which made "change the thing you are inspecting" impossible. The documents module's Outline; the stickers module changes a sticker with `item.addVersion`. |
| `pages` | a cover route at `x/<segment>` under the canvas's path, with the shell's bar (← Canvas, your label, your hint) above your component | `PageFacts { canvasId, canvas, host }` | Reachable from ⌘K ("Open <label>") and `isocan open --page <segment>`. Link to items with `workbenchItemPath` / `itemPath` from core; never spell `/p/`. |
| `overlays` **(proposed)** | screen space above the viewport, against a `region` you name — `"left"` or `"right"` | `OverlayFacts { canvasId, canvas, host }` | You name an EDGE; the shell owns where that edge is, and two overlays in one region stack in module order. You cannot position yourself, deliberately: two modules that both could is how a canvas ends up with two trays on top of each other. The stickers tray. |
| `drops` **(proposed)** | the canvas's drop handler, ahead of the built-ins, by mime | `DropFacts { canvasId, data, mimeType, at, host }` | `run` returns ops (or nothing — a claim on a mime is not a promise about its payload). Native OS file drops never reach you: those are the shell's own gesture. First match wins in module order. |
| `workspaces` **(proposed)** | replaces the ordinary canvas chrome with module composition at `x/<segment>` | `WorkspaceFacts<ReactNode> { canvasId, canvas, selection, canEdit, host, canvasView }` | One native viewport, placed once; reports may omit it. See the contract below. |

### `workspaces` — module chrome around the native canvas **(proposed)**

Use a workspace when a module needs a hierarchy, inspector or report lenses
around the existing canvas. Use a page when it needs to cover the canvas.
Both use `x/<segment>`, so choose a distinct segment and give the workspace a
`cli` equivalent. The launcher lists both; existing page registrations work
unchanged. Anatomy is the worked example.

`WorkspaceFacts<ReactNode>` supplies `viewState`, `canvasId`, `canvas`, `selection`,
`canEdit`, `host`, and `canvasView`. Render `canvasView` **once** in a sized
container with real height and width. A report lens may omit it while that
report is open. The shell measures the slot, clips the native viewport to it,
and uses those bounds for framing and radar; the native world keeps its screen
coordinate origin so dragging and zooming do not acquire sidebar offsets.
There is one replica and one socket. Never instantiate a second viewport.

`WorkspaceHost` extends `WebHost` with:

| Capability | Contract |
| --- | --- |
| `present(view)` | Temporary bounds/detail over native IDs; `null` restores saved geometry. See below. |
| `navigateView(patch, replace?)` | Update query keys (`null` removes); push one browser Back step, or replace the current address. The reactive `viewState` reports the result. |
| `readText(hash)` | Authenticated, hash-cached UTF-8 blob read for this canvas. |
| `getCanvas()` | The currently displayed snapshot; re-read before writes to detect stale drafts. |
| `select(ids)` | Replace native item selection; ignore missing ids. |
| `focus(ids)` | Frame the items in the visible native stage. Call after the canvas slot mounts. |
| `openItem(id)` | Navigate to the ordinary host item viewer. |
| `openChat()` | Show the native Chat, for example after a module posts an agent request. |
| `onActivateItem(handler)` | Subscribe to native double-clicks and underlay links; return true to consume, false for normal viewing. Returns cleanup. |

`present` accepts `{items, isolate?, focusIds?, maxScale?}`. `items` maps native
IDs to finite positive bounds (`x`, `y`, `width`, `height`) plus `detail`
(`full`, `compact`, `marker`) and optional `emphasis`. The host animates from its
current frame, honors reduced motion, and stops scheduling frames when settled.
No `items.move` is sent. Explicit native drags still apply a durable delta.
`isolate` limits the stage to these items. Omit `focusIds` on incoming content
updates: a collaborator editing a concept must not move the reader’s camera.
Use it only for navigation; `maxScale` limits magnification.

The same frame drives card hit targets, selection, connection underlays,
spatial navigation, version fans and anchored comments. `UnderlayFacts.canvas`
is the disposable geometry view; `presentation` supplies detail/emphasis.
`RendererFacts.presentation` is supplied only inside this local presentation.
Marker content is a lightweight native glyph. Compact and full structured
content uses the module renderer, which can adapt to the supplied detail;
compact unstructured files fall back to a native title.

Item selection outlines and working-session labels remain native. Free-space
cursors and pins are hidden in an isolated layout, because their coordinates
have no meaning in somebody else’s focus view. Pin new discussion to an item.
Saved sizes can be edited on the ordinary canvas or from the CLI; projected
sizes express semantic detail and have no resize handles. A workspace is for
exploring its native items, while free placement and annotation use the canvas.
The host restores the ordinary camera on exit and remembers the workspace’s
last address and view cameras for this browser session. Modules own their local
pane preferences. These capabilities require module API **0.2.2**.

`canEdit` is false for a reader or a past-state view. Hide mutation controls;
`host.send` still enforces the host's capability gate. The shell supplies Back,
Undo/Redo shortcuts, lazy loading and an error boundary. Module chrome owns its keyboard
events, while native canvas gestures and the global launcher retain their
normal behavior. A report's invisible selection cannot receive Delete.

`WorkspaceFacts.project` carries the native canvas record, including its properties.
An optional `workspace.projectEntry({project, canvas})` returns `{label, glyph}`
for the project menu and right tool rail, or null when there is no relevant
work. The shell owns navigation to the workspace; the module owns whether its
project metadata warrants a door. Runtime modules use the same contribution.

`UnderlayFacts.activateItem` is supplied inside a workspace. It routes a
connection link to that workspace's activation subscribers; it is absent on
the plain canvas. Use narrow hit targets so empty canvas remains pannable.
Subscribers must clean up on unmount. Activation and camera framing are local
UI state; they never move or rewrite items.

`RendererFacts.item` is optional native metadata, useful when a structured
file's title belongs to the item. It does not change the blob requested by
`readText`, so older renderers remain compatible.

### `host` — how a component changes anything **(proposed)**

Every slot that a person interacts with — overlays, inspectors and pages — is
handed a `WebHost` beside its facts. Two members, and no more:

```ts
interface WebHost {
  send: (ops: readonly Operation[], group?: string) => Promise<void>;
  putBlob: (bytes: Blob, filename: string) => Promise<{ blobHash: string; size: number }>;
}
```

`send` is the same door `ModuleAction.run` returns into, so a write from a
component is an ordinary op: echoed, undoable, groupable, and visible to the
terminal as the same op. One `group` for one undo.

`putBlob` is the only thing an operation cannot say. `item.add` and
`item.addVersion` both name a `blobHash`, and a blob is minted through a
channel that is not an op — so without it a module could express every canvas
change EXCEPT the ones that need new content, which is most of what a
node-type module does. Mint the bytes, then say what to do with them:

```tsx
const put = await host.putBlob(new Blob([text], { type: MY_MIME }), "shape.json");
await host.send([
  { type: "item.add", itemId: newItemId(), version: { …, blobHash: put.blobHash, size: put.size },
    width: 120, height: 120, placement: { x, y }, title: "Square" },
]);
```

Two steps rather than one `dropFile(file, at)` helper, and the second step is
where your title, size, properties and grouping live — none of which a host
helper could have known. Underlays and renderers DRAW and are not handed a
host; if you need one there, say so, and it is a review question rather than a
private import.

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

A self-hosted home can load a module the build did not carry. Declare needed
proposals under `isocan.proposed` in the source package; the builder copies them
to the manifest. Modules with CSS receive a stylesheet loader in their web
entry, so runtime imports include styles used by lazy chunks.

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
No inspector on the canvas, only in the workbench (an overlay is the way to
put something beside the work today). No per-module CSS file, and an overlay
that needs positioning still needs a rule in `styles.css` — the stickers tray
shipped invisible for a day because the region had no CSS at all.
No way for a card to name the module a file came from when that module is
absent. A prose editor for documents, deferred. Sandboxes, which wait on the
content origin, extension actors and compute consent. Each is listed in
[`phases.md`](phases.md) with what unblocks it.
