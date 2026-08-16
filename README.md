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
runs the daemon (`:4441`) and Vite (`:5173`, proxying `/api` + `/ws`) together;
it takes the port from any daemon already there, so you are never quietly
served by a stale one. `isocan stop` (or `isocan serve --force`) does the same
from the CLI — both ask the port who it is rather than trusting the pidfile.

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
  `#Title` links an item the same way (`#` opens an item picker, recently
  touched first) and clicking the chip flies the reader to the item;
  `comment anchor` re-pins a thread after the fact — e.g. onto the item it
  asked for.
- **The main thread**: one thread per canvas can be designated "main"
  (`comment main <thread>`, or "Make main" on a pin's popover; the panel also
  births one from its first message). It docks as a chat panel on the left
  instead of a pin — messages hug the composer, `#Title` references render as
  artifact-style cards that fly you to the item, and agents' `wait` always
  wakes on comments landing there, no @-mention needed. Its toggle (wearing
  the unread count) lives on the Shelf; demote with "detach" (or
  `comment main --clear`) and the pin returns to where the thread was born.
- **The Shelf**: every verb in one dock at bottom center, in grouped
  segments — create (`＋ File`) · converse (comment mode, main thread) ·
  history (undo/redo) · navigate (zoom, `⌖ Fit`). The top bar holds identity
  only: project, connection, trash, and who's here. When the main-thread
  panel is open the Shelf recenters in the canvas the panel leaves visible.
- **Who's here, and who wants you**: a facepile in the top right holds
  everyone on the canvas — live people and agents in their identity color,
  plus anyone who left an unread comment behind, dimmed. A face badged with a
  count takes you to that comment; a live face takes you to their cursor.
- **On call**: a session belongs to one canvas, but `isocan wait` belongs to
  the *home*. A parked agent wears a dashed ring in **every** canvas's
  facepile — including one created after it started waiting — and the `@`
  picker offers it there. So a brand-new space is never empty: @-mention the
  agent, or just write in its main thread, and `wait` wakes, names the canvas
  that summoned it, and hands back a `--project` command that lands there.
- **New comments announce themselves**: one arriving raises a toast naming who
  wrote it; clicking it flies to the pin. Until you read it the pin wears an
  unread badge, its author's face is badged in the pile, and the tab title
  carries the count. Read state is per-viewer, kept in the browser — so
  reopening a canvas shows what happened while you were away.
- **Identity**: a name you pick at the door (web dialog / CLI prompt); stamped
  on every mutation, comment, and version. Click your own face in the pile to
  change it: *rename* keeps your actor id, so your undo stack and the comments
  addressed to you stay yours (`isocan identity --name` does the same); *leave*
  returns you to the door, which now offers every name this browser has worn —
  coming back as one resumes that same actor, not a stranger sharing a name.
  A rename re-labels your face on everyone else's screen on the next presence
  beat, without dropping the socket. Architected so authenticated identity
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
isocan identity|whoami · serve [--force]|status|stop · open
isocan project create|list|show|edit|delete · isocan use <project>
isocan add <file> [--at x,y | --anchor <item>] [--title] [-d] [--prop k=v]
isocan ls · show <item> · mv <item> <x> <y> · set <item> […] · rm · restore
isocan edit <item> [<file>]        # new version from a file or $EDITOR
isocan versions <item> · version promote <item> <version>
isocan comment add (--item <item> | --at x,y) <text> · reply · list · rm
isocan comment anchor <thread> (<item> | --at x,y)   # re-pin / detach a thread
isocan comment main [<thread> | --clear]   # the docked agent↔user channel
isocan undo · redo · trash list|restore|empty --force
isocan gc [--dry-run] [--keep-ops N]   # compact the oplog, sweep unreachable blobs
isocan session start|work|point|move|say|end · isocan who [--all]  # presence
isocan wait [--timeout s] [--all-ops]  # park on call; wake on a comment for
                                       # you on ANY canvas (--project: one)
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
