---
status: designed
since: 2026-08-31
see: multiuser, on-demand
note: "#78 — the third isomorphic surface. design.md is the argument: the API already exists as the CLI's private middle layer, and the work is a seam. These journeys are the acceptance suite, phases.md the walk — four phases, the seam first, each journey closed by playing it for real."
---

# The isomorphic API — the journeys

**31 August 2026.** The ideal, written as jobs to be done: each journey
names who hires the API, the job they hire it for, and what "done" looks
like walked for real. [design.md](design.md) argues the mechanism. Each
journey is an acceptance test — a phase that claims one closes only when
you can run it, on a real canvas, and the run behaves as written here.
Where a journey seems to force a mechanism, the mechanism is what bends.

The journeys are ordered by how much they already exist. The first is a
working script in this repository whose every friction is measurable
today; the last is a stranger's machine this repo has never seen.

## 1. The board run — hired to publish derived facts

**When** my repository has facts worth showing (goals, CI, the
fortnight's commits), **I hire the API to** publish them as panels on a
canvas from one script run, **so that** the canvas stays true without
anyone curating it.

The hirer exists: `scripts/canvas-board.mjs`. It does this job today by
spawning the CLI — roughly 10–25 processes per run at ~150–210 ms each —
and its shape is a requirements list written in workarounds:

- It writes to the **board's canvas** and reads the **repo's canvas**,
  threading `--canvas` into every call. One process, two canvases.
- It is its **own actor**: `board-identity.mjs` builds environment
  variables so the run is not the person at the keyboard, and `--as-me`
  undoes it.
- It writes HTML to a **temp directory** so `isocan add <file>` can read
  it back.
- It **re-runs `ls` after every create**, because a spawned `add` prints
  its result and exits — the script never holds the item it just made.
- Its load-bearing rule — *unreachable is not empty* — is implemented by
  catching a child-process throw and slicing `err.stderr` to 200
  characters, three times.

The job, done through the API:

```js
const home = await connect({ identity: boardIdentity }); // its own actor, stated
const board = await home.canvas(CANVAS);           // where the panels live
const repo = await home.canvas(marker.projectId);  // what they describe
const item = await board.add({ title, content: html, mime: "text/html", ... });
```

One process. The temp directory is gone; the re-listing is gone; the
item comes back from the call that made it, carrying the `blobHash` the
no-op check compares; unreachable is an `ApiError` with a wire code, not
a stderr slice.

**The board is one instance of a general job: the canvas as a place
apps live.** A panel is an HTML item; a set of panels with a script
behind them is a dashboard; a dashboard whose panels answer questions is
most of the way to a mini app. Nothing about this is board-specific —
"read some source of truth, render it, publish it as items, version it
when it changes" describes a sprint board over a tracker, a status page
over a fleet, a gallery over a directory of designs. The API is what
makes this an evening's work instead of a project: the script is the
app's entire build-and-deploy, and the canvas supplies what an app
platform would otherwise have to — hosting, sharing, presence, history
(the version stack *is* the deploy log), and an audience already looking
at it.

The limitation, stated so nobody discovers it as a surprise: **these
apps update by re-push.** A published panel is bytes at rest — it shows
what was true when its script last ran, and changing what it shows means
running the script again. There is no live data path from canvas item to
source of truth. Journey 2 is the honest half-answer (a watcher re-pushes
when the source changes, so "stale" shrinks to a reaction time), and the
[extensions](../extensions/design.md) project owns the full one — a tool
that is *of* the canvas rather than pushed onto it. This journey
deliberately stops at re-push: it is the shape that needs no new
mechanism, and the board proves it is already worth having.

**Deliberately unsolved, left here because it is too good not to write
down: what if these apps had their own API?** A panel renders in its own
frame today, inert. Give that frame a `window.isocan` and the app pushed
onto the canvas could poke at the world around it — read the items
beside it, post to the Chat, answer the question it displays instead of
telling the reader which CLI command would. The board's "Waiting on a
person" table becomes buttons; the re-push limitation dissolves from the
inside, because the panel *is* a client now, the fourth surface speaking
the same vocabulary. Every hard question arrives with it, which is why
it stays unsolved here: who is the ACTOR when an item writes an op — the
panel, its author, or whoever is looking at it? What does the door make
of a credential held by content someone else pushed? The framing rules
the [architecture](../../architecture.md) already drew (`frame-ancestors`
derived per canvas, origin-checked `postMessage`) are where such a bridge
would bolt on, and [extensions](../extensions/design.md) owns the tier
model it would live under. This project builds the Node API; it leaves
`window.isocan` as the morsel — but the vocabulary being one contract is
exactly what makes it a bridge to specify someday, not a platform to
invent.

**A second unsolved twist, more elegant than the first: what if the web
UI used this API?** Today the repo holds two client implementations —
the browser's `lib/api.ts` and the Node client this project extracts —
and [design.md](design.md) is honest that lockstep between them is the
core contract, not shared code. But most of `DaemonClient` is not Node
at all: typed routes, ops in, entries out, `fetch` on both sides. If the
API had a browser build — the transport kernel without the Node half
(daemon lifecycle, `homes.json`, the marker walk) — the web app could
consume it, and lockstep would stop being two implementations held
together by core and become one client worn three ways. The web app is
not *only* a client, which is what keeps this unsolved rather than
merely undone: it is a replica — IndexedDB, the service worker, the
optimistic queue — and that whole layer sits above anything the Node
client has. The line would have to be drawn between "speaking to the
daemon" (shared) and "being a replica" (the browser's own). The two
morsels also meet: a `window.isocan` handed into a panel's frame would
simply BE this browser build, credentialed somehow — one more reason the
kernel wants to exist.

**Acceptance:** `canvas-board.mjs` ported to the API and running on the
real board canvas — same panels, same bytes, same no-op-when-unchanged
behavior. The diff is the argument and the run time is the measurement;
both get recorded. This is the journey that settles
[design.md](design.md)'s open door about `connect()`'s surface, because
the board cannot be written against "this directory's canvas" alone.

## 2. The watcher — hired to react

**When** something happens on a canvas — a comment lands, a panel's
question gets answered — **I hire the API to** wake my script with the
entry, **so that** reacting does not mean polling, and a reaction script
is a loop rather than a process manager.

The hirer half-exists: the board's own panel text promises `npm run
board:watch`, and today "watch" means spawning `isocan wait` and
re-spawning it on every timeout. The job, done through the API:

```js
for await (const entry of canvas.tail({ since })) {
  if (entry.opType === "thread.reply") await refresh();
}
```

The cursor is the caller's, so a watcher that dies resumes where it
stopped — the same seq-cursor gesture every replica uses, exposed as an
iterator instead of a flag.

**Acceptance:** a board watcher that refreshes panels when the repo's
canvas changes, runs across a daemon restart, and holds no process but
its own.

## 3. The agent's one-off — hired for the batch

**When** an agent working in a session needs forty ops, not four — lay
out these items in a grid, retitle everything matching a pattern — **it
hires the API to** do the batch in one script it writes and runs on the
spot, **so that** the work is one process and one review-able artifact
instead of forty CLI calls in a loop.

This journey carries the discoverability question in #78's second
comment, so its walk starts earlier than the code: the agent knows the
CLI, runs `isocan --agent-help`, and the guide's Scripting section tells
it when to reach past the CLI and what to type. The script it writes
resolves *exactly* as its CLI calls would — same directory marker, same
session claim, same actor on the canvas — so the batch appears on the
human's screen as the same named collaborator who was just typing
`isocan` commands.

**Acceptance:** an agent that has never been told the API exists, given
a batch-shaped task in a readied directory, finds the API through
`--agent-help` and completes the job as the same actor its CLI commands
were — including the `npm i` its script needs, because a readied
directory has the CLI on PATH and nothing importable. (The house
precedent: phase 11's Scene 6 was closed by playing it for real.)

## 4. The stranger's machine — hired off this repository

**When** I am not in this repo at all — a different project, a cloud
workspace, a teammate's tool — **I hire the API to** script a canvas at
its home, **so that** "isocan has an API" is true the way "isocan has a
CLI" is true: one install line, no workspace, no checkout of this
repository.

```sh
npm i github:dglazkov/isocan#release
```

```js
import { connect } from "isocan";
```

against a canvas whose home is isocan.io. This is the distribution
journey: the tsx-register export entry, the release branch carrying the
API package, and the types arriving with the install so an editor can
answer what `connect()` returns.

**Acceptance:** walked on a machine (or empty directory) with no
workspace resolution available — the install line, ten lines of script,
an op landing on a hosted canvas as the right actor, with the machine
admitted the way any machine is (a pass minted elsewhere, redeemed here)
rather than through some door the API invented. Journey 1 cannot
substitute for this one: the board runs inside the workspace, where
imports resolve for reasons a stranger's machine does not have.

## What the journeys force

Named here so the mechanism doc can be held to it:

- **A home handle, not only a directory handle** (journey 1):
  `connect()` defaults to the directory's canvas but opens others by
  ref, across homes, with `direct.ts`'s resolution underneath.
- **Identity as a parameter** (journey 1): ambient resolution by default
  — the CLI's own rule — with an explicit identity for a script that is
  its own actor. Both shapes exist today as env-var surgery; the API
  makes the second one a stated argument.
- **Content as values** (journey 1): add and edit take strings and
  buffers with a mime type; files are one convenience atop that, not the
  substrate.
- **Ops return what they made** (journey 1): the item, with its version
  and `blobHash`, from the call that created it.
- **Errors as types** (journeys 1, 2, 4): wire codes on an `ApiError`,
  because "unreachable is not empty" deserves better than a stderr
  slice.
- **The log as an iterator** (journey 2): `tail({ since })`, cursor with
  the caller, resumable across restarts.
- **The same actor either way** (journeys 3, 4): a script and a CLI in
  the same directory and session are one collaborator. Anything else
  makes the third surface a liar.

One tension, decided rather than discovered later: this repo's
`scripts/*.mjs` are deliberately dependency-free and reach isocan by
spawning the CLI (`roadmap.mjs` spawns it 39 times for front matter, *by
design* — one reader). Porting the board (journey 1) breaks the
dependency-free rule for that one script, on purpose: in-repo it imports
the workspace the same way the bin does, and that is the point of the
test. Scripts with no loop and no canvas — `roadmap.mjs` included — keep
spawning the CLI, which remains a fine way to do a small job.
