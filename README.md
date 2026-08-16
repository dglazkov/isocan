# isocan

An **isomorphic canvas**: an infinite 2.5D canvas you can drive from a web app
*and* from your terminal. Both are views/controllers over the same live state —
every operation possible with a click is possible with a command, and each
surface sees the other's changes instantly.

```
┌─────────┐   HTTP POST /api/ops   ┌───────────────────┐
│   CLI    │ ─────────────────────▶ │  isocan daemon     │──▶ ~/.isocan/
└─────────┘                        │  :4441 (127.0.0.1) │    (JSON + blobs)
┌─────────┐   WS snapshot + ops    │  single op engine  │
│ Web app  │ ◀────────────────────▶ └───────────────────┘
└─────────┘
```

**The isomorphism guarantee.** All mutations are `Operation` values from
`@isocan/core` — a discriminated union (`item.add`, `item.move`,
`thread.reply`, …) — sent to one endpoint and applied by one pure reducer that
the daemon runs authoritatively and the web client runs against its replica.
The CLI and the web app cannot diverge, because they speak the same vocabulary
to the same engine.

## Quick start

```sh
npm install
npm run build          # build the web app once (daemon serves it)

cd packages/cli
node bin/isocan.js identity --name "You"
node bin/isocan.js project create "My canvas"
node bin/isocan.js add notes.md
node bin/isocan.js open          # opens the canvas in your browser
```

The CLI auto-starts the daemon. For development, `npm run dev` at the repo root
runs the daemon (`:4441`) and Vite (`:5173`, proxying `/api` + `/ws`) together.

## What it does

- **Canvas**: infinite pan/zoom surface with a minimap; items are files —
  markdown, images, video, and HTML rendered live in sandboxed iframes
  (`allow-scripts` without `allow-same-origin`; double-click to interact).
- **Versions (the 0.5D)**: editing an item stacks a new version on top —
  subtle elevation plies hint at the stack; fan it out (`V`) to preview and
  promote any version.
- **Comments**: threads pinned to the canvas or anchored to items (pins follow
  drags); create, reply, delete from either surface. Bodies render as
  markdown; `@Name` addresses a collaborator (mentions are resolved when
  posted and drive the CLI's `wait` filter) — typing `@` in the web composer
  opens a picker of everyone on the canvas, live sessions first, and resolved
  mentions read as chips in the composer and in the posted comment;
  `comment anchor` re-pins a thread after the fact — e.g. onto the item it
  asked for.
- **New comments announce themselves**: one arriving raises a toast naming who
  wrote it; clicking it flies to the pin. Until you read it the pin wears an
  unread badge, the toolbar offers "N new" (each click walks to the next one,
  wherever it is), and the tab title carries the count. Read state is
  per-viewer, kept in the browser — so reopening a canvas shows what happened
  while you were away.
- **Identity**: a name you pick once (web dialog / CLI prompt); stamped on
  every mutation, comment, and version. Architected so authenticated identity
  later only changes how an `Actor` is minted. Agents pick a name of their
  own — one hiding in the letters of "isocan" (Isaac, Kenny, Nico, …), not
  their vendor's — checking `isocan who --all` first so no two collaborators
  answer to the same `@Name`.
- **Trash & undo**: deletes go to a per-project trash; undo is
  **actor-scoped** (`⌘Z`/`⇧⌘Z`, `isocan undo|redo`) — your undo walks your
  own ops, never a collaborator's. Entries invalidated by others (your target
  got deleted) are skipped; batch inverses shrink to their surviving members.
  Trash-empty and project-delete are confirmation-gated and not undoable.
- **Projects**: each project is its own canvas; create/list/edit/delete from
  either surface.

## CLI surface

```
isocan identity|whoami · serve|status|stop · open
isocan project create|list|show|edit|delete · isocan use <project>
isocan add <file> [--at x,y | --anchor <item>] [--title] [-d] [--prop k=v]
isocan ls · show <item> · mv <item> <x> <y> · set <item> […] · rm · restore
isocan edit <item> [<file>]        # new version from a file or $EDITOR
isocan versions <item> · version promote <item> <version>
isocan comment add (--item <item> | --at x,y) <text> · reply · list · rm
isocan comment anchor <thread> (<item> | --at x,y)   # re-pin / detach a thread
isocan undo · redo · trash list|restore|empty --force
isocan gc [--dry-run] [--keep-ops N]   # compact the oplog, sweep unreachable blobs
isocan session start|work|point|move|say|end · isocan who [--all]  # presence
isocan wait [--timeout s] [--all-ops]  # block until a comment addresses you
isocan tail [-f]                       # print/stream the operation log
```

Items and threads resolve by id, id prefix, or title prefix. `--json`
everywhere for scripting.

## Architecture

npm-workspaces monorepo, source-mode TypeScript (tsx + Vite consume `.ts`
directly; the only build is the web bundle):

| Package | Role |
|---|---|
| `packages/core` | The contract: state model, operation vocabulary, pure reducer, inverse engine, placement math |
| `packages/server` | The daemon: Fastify + WS, single-writer op pipeline, fsynced oplog, snapshots, content-addressed blobs, undo stacks |
| `packages/cli` | `isocan` — commander CLI mapping 1:1 to operations, daemon auto-spawn |
| `packages/web` | React + zustand canvas in the "Drafting Table" design; WS replica applying the shared reducer |

Storage lives under `~/.isocan` (override with `ISOCAN_HOME`): per-project
directories with human-readable JSON snapshots, an append-only `oplog.jsonl`
as the source of truth (crash recovery replays the tail), and sha256
content-addressed blobs. Every op's inverse is computed from pre-state and
stored in the log — undo/redo replay stored inverses, never re-derive them.

Storage is reclaimed by `isocan gc` (or the trash panel's "Reclaim storage"):
it compacts the oplog to an undo horizon (default: the last 500 ops, kept
pair-complete so redo never dangles; dropped entries go to
`oplog-archive.jsonl`), then sweeps blobs unreachable from live items, the
trash, and the retained log. Blobs younger than ten minutes are never swept,
covering the gap between upload and `item.add`.

## Development

```sh
npm run dev         # daemon + Vite with hot reload
npm test            # vitest: reducer round-trips, random-walk undo property
                    # tests, storage crash recovery, daemon HTTP/WS integration
npm run typecheck   # strict tsc across all packages
```
