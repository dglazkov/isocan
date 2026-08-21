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

From any directory, one command — no npm publishing involved, the repo *is*
the package:

```sh
npx github:dglazkov/isocan#release setup
```

That installs the CLI's own skill where agents look for it
(`.agents/skills/isocan-collab`, plus the `.claude/` doorway), makes sure
`isocan` is on your PATH, starts the daemon, and opens the app. You pick your
name there and make a canvas — one click, and it is yours: setup creates no
canvas precisely so that none is stamped with whoever typed the command,
usually an agent acting for a person who hasn't said their name yet. It is
idempotent; run it again anywhere. `isocan setup --help` for the knobs
(`--no-open`, `--no-install`, `--force`).

Keep the `#release` on the spec. It is the branch you install from: this same
tree with the web app already built, and without the manifest keys npm's git
installer reads as "must build this first" — given any of them (`prepare`,
`build`, `workspaces`, …) npm runs a nested install that inherits your `-g`
and leaves an EMPTY directory with a dangling `isocan` on your PATH (#47).
`npm run release` publishes the branch; `scripts/release.mjs` tells the whole
story.

Want only the skill, for an agent that will install the rest itself?

```sh
npx skills add dglazkov/isocan
```

From a checkout:

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

Every feature below is reachable from both surfaces. Where a person drags,
snaps, or double-clicks, an agent has a verb — `isocan align`, `isocan
distribute`, `isocan mv --by`, `isocan set --title` (which renames the file
too), `isocan add --drawing`, `isocan ls --kind`, `isocan identity --color`.
That parity is a house rule with a test behind it: see AGENTS.md.

- **Canvas**: infinite pan/zoom surface with a minimap; items are files —
  markdown, images, video, and HTML rendered live in sandboxed iframes
  (`allow-scripts` without `allow-same-origin`). "Double-click to interact"
  hangs under the item while you point at it, rather than lying across the
  bottom of the document it is describing.
- **The Pen (`P`)**: draw freehand on the canvas in your identity color — the
  same color your cursor and your face in the pile wear, so ink is signed by
  how it looks; the ink well beside the rail switches to any other color in
  the palette, and remembers. The nib follows you over items too, so you can
  circle the thing you mean. A moment after you lift the pen the ink settles
  into an ordinary item — no commit step to find; strokes drawn in one breath
  land as one drawing. **Hold `P`** when the drawing takes longer than one
  breath: while the key is down the ink never settles, so a sketch made in
  passes — draw, stop, pan across, add an arrow — is one drawing however long
  you take between strokes, and the bar under the canvas counts what is riding
  on it. Let go and all of it settles as a single SVG. (A tap of `P` latches
  the Pen as it always has; a hold borrows it and hands your tool back, the
  same shape as `Z`.) That item is an `item.add` whose blob is an SVG, so the
  CLI lists it, the blob on disk is a real `.svg`, and it selects, moves,
  resizes, deletes, undoes, and versions like anything else. It just wears no
  card: the ink IS the item — and since that makes its box invisible, pointing
  at a drawing outlines the box you would grab, and `⌥`-click steps down
  through a stack of them.
- **Names**: an item's name sits above it rather than inside a chrome bar —
  the item is the content — and stays hidden until you point at the item or
  select it, so a canvas of sketches reads as the sketches rather than as a
  column of the word "Sketch". Double-click the label (or `F2` on the selection) to
  rename in place — the label itself becomes the field, same type and same
  spot — and the file underneath follows: "Bass tab v2" makes
  `bass-tab-v2.png`, keeping the extension, so what you call a thing on the
  canvas is the name the blob wears on disk. A name already spoken for on the
  canvas steps aside to `-2`. One op, so name and file undo together.
- **Annotation**: ink drawn over an item becomes a mark *about* it, not a
  drawing that happens to sit on top — it carries the item it annotates and the
  region it covers (in fractions, so it survives a resize), paints above its
  target, and travels with it when the target moves, from either surface. A
  composer opens on the spot for what should happen there; posting anchors the
  thread to the target, so an agent parked on that item wakes, reads the region
  without parsing a single stroke, rebuilds, and clears the mark. Ink on bare
  canvas stays a drawing: nobody asked for anything, so there is nothing to
  clear.
- **Versions (the 0.5D)**: editing an item stacks a new version on top —
  subtle elevation plies hint at the stack; fan it out (`F`, or the count badge)
  to preview and promote any version. The count badge is chrome, not content: it holds its size as you
  zoom, sits at the bottom-right of every item — where the plies are already
  cascading, and the same place every time — and gets out of the way entirely
  once an item is too small to wear a label. It steps up to the top edge only
  when a comment pin is literally on it, because a pin marks a place a person
  chose and the badge is ours to move.
- **Your color**: the color you wear — cursor, face in the pile, comment pins,
  the outline on an item you are holding, and your Pen's default ink. It is
  derived from your actor id so a new actor has one immediately, and picking
  another (identity menu, or `isocan identity --color teal`) is
  `actor.setColor`: it lands in the daemon's actor registry beside your name,
  so everyone on every canvas sees you change, live, without a reload.
- **Snapping**: dragging an item shows alignment guides — a line for every
  edge or center it has settled onto — and the item lands exactly on them. The
  pull is measured in screen pixels, so it feels the same at any zoom, and
  holding `⇧` mid-drag makes it markedly more magnetic for when you are aiming
  at a line rather than a place. A multi-item drag snaps as one shape. Where an
  axis has no line to claim it, equal spacing does: dropped between two
  neighbours, the item centers itself and purple measure bars — a rule with end
  caps across each gap — say the two distances match.
- **The edge radar**: items that pan out of sight leave a bar lying flush along
  the rim — tucked under the top bar, against the window elsewhere, and against
  the docked panel when one is open — where a ray from the middle of the screen
  leaves the window and as long as the thing out there would be — the edge becomes a shadow of what is
  off screen, and nothing juts into the canvas. Bars on the same wall that
  overlap merge into one; hovering lists everything that bar speaks for —
  thumbnail, title, and its own distance, nearest first — and any row takes you
  to that item, while the bar itself fits the whole group. Only items entirely
  out of sight get one: something with a corner still showing is already
  telling you where it is.
- **The minimap folds away**: hover it for the fold control and it slides into
  its corner, leaving a handle that slides it back. Remembered per browser, and
  instant for anyone who has asked for less motion.
- **Walking the canvas**: `⌘`/`Ctrl` + an arrow moves the SELECTION to the next
  item that way — edge distance with a heavy penalty on sideways drift, so a
  walk stays in its row instead of wandering to whatever is nearest in a
  straight line. With nothing selected it starts from the item nearest the
  middle of the screen; the camera pans only as far as it must, so an item
  already on screen never moves the world.
- **Nudging**: arrow keys move the selection a world unit at a time, `⇧` ten.
  A held key is one gesture — the items track the key, and one `items.move` is
  written when you stop, so it is one line in the log and one undo.
- **Comments**: threads pinned to the canvas or anchored to items (pins follow
  drags); create, reply, delete from either surface. `⌘⏎` sends, in every
  composer — a box that takes more than one line has to keep `⏎` for newlines,
  which otherwise leaves the mouse as the only way to post. Bodies render as
  markdown; `@Name` addresses a collaborator (mentions are resolved when
  posted and drive the CLI's `wait` filter) — typing `@` in the web composer
  opens a picker of everyone on the canvas, live sessions first, and resolved
  mentions read as chips in the composer and in the posted comment;
  `#Title` links an item the same way (`#` opens an item picker, recently
  touched first) and clicking the chip flies the reader to the item;
  `comment anchor` re-pins a thread after the fact — e.g. onto the item it
  asked for.
- **Favourites**: the star at the end of an item's name (it appears when the
  name does) marks it, and the starred shortlist docks on the right — a click
  away from flying there. Each entry previews the item itself, rendered small
  and inert rather than reduced to its first letter, and the rail's star is
  solid when there is anything in there. The star is a property on the item
  rather than a note in one browser, so it survives a reload, reaches the other
  machine, and tells an agent which screens are actually in play
  (`isocan ls --starred`, `isocan star <item>`).
- **The files panel**: the same dock, showing the canvas as what it is — a
  directory of files. Grouped by kind (drawings, images, documents, sites),
  filterable by name, each row carrying the filename, size, and version count.
  Pointing at a row outlines that item on the canvas and opens a peek beside the
  panel — thumbnail, name, file, size, who touched it last — the same card the
  edge radar opens off a beacon, because it answers the same question: what is
  this, before I go to it. Clicking flies to it and
  fits it in the space the panel leaves, so the thing you asked for never lands
  underneath the list you asked from. The dock holds one panel at a time.
- **Working notes**: a comment can be rewritten by its author (`comment edit`,
  and only ever your own — the daemon refuses the rest), so an agent that will
  be a while posts one note and keeps it current instead of narrating into the
  thread four times. The canvas then says how long that took — "edited · 4m",
  measured from the comment's own timestamps rather than claimed by whoever
  wrote it.
- **Selection travels with the message**: what you have selected shows as chips
  over the composer (in the docked panel and behind `⌘K`), and posts as item
  ids on the comment — so "make these two match" tells an agent which two,
  exactly, instead of leaving it to read your mind or your words. The chips ARE
  the selection: removing one deselects it, so there is one answer to "what am
  I pointing at". On the way back, a message with items renders them as cards
  that fly you there.
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
- **Watching one thing**: `isocan wait` is the agent's feedback loop, and it
  can be told what to care about — `--item <ref>` and `--op item.addVersion`
  (or a family, `item.*`) narrow which changes wake it, so a watcher does not
  spend a turn deciding it did not care. A summons comes through any filter,
  because an agent you cannot reach is worse than one that wakes too often, and
  an agent's own ops never wake it — so writing the thing it was watching for
  does not start it again.
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
- **Two parties, two names**: the person who owns the machine, and the agents
  working on it. `~/.isocan/identity.json` is yours; an agent claims an actor
  against the session id its harness exports (`isocan identity --session` —
  naming yourself is an operation, applied atomically by the daemon, which
  hands out a free name when none is asked for), so two agents sharing a
  directory stay two people. An agent introducing itself can never rename
  you, and a CLI with no terminal and no session gets an error rather than a
  slot — because the thing at the other end of a pipe is not the person.
  (`isocan setup` sidesteps the question entirely: it makes no canvas, so
  none is stamped with whoever typed it.)
- **Identity**: a name you pick at the door (web dialog / CLI prompt); stamped
  on every mutation, comment, and version. Click your own face in the pile to
  change it: *rename* keeps your actor id, so your undo stack and the comments
  addressed to you stay yours (`isocan identity --name` does the same); *leave*
  returns you to the door, which now offers every name this browser has worn —
  coming back as one resumes that same actor, not a stranger sharing a name.
  A rename re-labels your face on everyone else's screen on the next presence
  beat, without dropping the socket — in the terminal too: `isocan identity
  --name` pushes the new name to your live cursor at once, and every command
  that narrates re-states who is holding the session. Architected so
  authenticated identity
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
- **A directory is its project** (#60): `<dir>/.isocan/project.json` binds a
  directory (git toplevel when in a repo) to a canvas — identity only, the
  state stays in `~/.isocan`. Written automatically when an agent names
  itself (`identity --session` creates the project if needed, named after
  the directory), or by hand with `isocan use <project>`. Resolution walks
  up like `.git`; a committed marker means a clone knows which project it
  is, and a marker this home has never seen is materialized under its own
  id on the first addition. In a bound directory `project list` narrows to
  that canvas (`--all` widens) and `wait` listens to it alone — there is no
  home-wide listening; the old "on call" presence was retired with this
  change. `~/.isocan/dirs.json` is the dir→project roster, a lazily healed
  cache.

## CLI surface

```
isocan setup [dir]                 # skill + CLI + daemon for a directory
isocan identity [--session] [--name X] [--home|--new|--as <id>]|whoami
isocan serve [--force]|status|stop|restart|upgrade · open
isocan project create|list [--all]|show|edit|delete
isocan use <project> [--home]      # bind this dir to a project (--home: fallback)
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
isocan wait [--timeout s] [--all-ops]  # park; wake on a comment for you on
                                       # this dir's canvas
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

## Updating

```sh
isocan upgrade      # fetch the newest build, then restart the daemon on it
isocan restart      # just restart: run the build you already have
isocan status       # who holds the port, and which copy they are running
```

The daemon outlives the command that started it — `ensureDaemon` only starts
one when the port is silent — so upgrading the CLI leaves yesterday's daemon
serving yesterday's app. Every build now says which copy it is (`root`, and
when its code was written), so a CLI notices when the daemon isn't its
sibling: it says so once per daemon rather than on every command, `setup`
restarts a stale one outright, and an open tab whose bundle no longer matches
the one being served offers a reload.

`npx github:dglazkov/isocan#release …` re-resolves the branch every run, so it
always fetches the newest *release* — but it cannot replace a daemon an
earlier run left behind; `isocan restart` does. From a checkout,
`git pull && npm install`, then restart.

## Development

```sh
npm run dev         # daemon + Vite with hot reload
npm test            # vitest: reducer round-trips, random-walk undo property
                    # tests, storage crash recovery, daemon HTTP/WS integration
npm run typecheck   # strict tsc across all packages
npm run release     # build, commit onto the `release` branch, push it
```

Work happens on `main`; `release` is generated, and generating it is CI's job:
[`.github/workflows/release.yml`](.github/workflows/release.yml) tests,
typechecks and releases every commit pushed to `main`, so what people install
is never older than what landed. A red test leaves the last good release
standing until the next green commit.

`npm run release` is the same thing by hand, for when you want one now: it
refuses a dirty tree or an unpushed HEAD, builds the web app, and commits that
build alongside this tree under a manifest with no `prepare` and no
`workspaces` (`-- --no-push` to stop before the push). Each release commit has
two parents — the previous release, and the `main` commit it was built from —
so the branch never needs a force push and `git log release` answers "which
build is this?".

Agents working in this repo start at [`AGENTS.md`](AGENTS.md). The skill that
teaches one to collaborate on a canvas is an
[Agent Skill](https://agentskills.io/specification) at
`.agents/skills/isocan-collab/` — the location most harnesses discover on
their own; Claude Code reaches the same file through the committed symlink at
`.claude/skills/isocan-collab`. Adding a harness means adding a doorway to
that file, never a second copy of it (`test/skills.test.ts` holds the line).
