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

**New here?** [`docs/start.md`](docs/start.md) is two commands and nothing
else — the shortest path to a canvas with an agent on it. (No, you do not
need Claude Code; any agent that reads `.agents/skills/` works.)
[`docs/how-to.md`](docs/how-to.md) is the five-minute version of actually
using it. What follows is the developer's route into the same thing.

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

On a machine that has never held a canvas, setup also writes **isocan.io** down
as the birth default — where the canvas you make next is born, so your laptop
and your desktop show the same one. It says so in its report, and `isocan home
--clear` is the whole of the way back: canvases made here then stay here, and
nothing already on the machine ever moves either way. A machine that already
holds canvases is left alone, and so is a git checkout of isocan itself.

Keep the `#release` on the spec. It is the branch you install from: this same
tree with the web app already built, and without the manifest keys npm's git
installer reads as "must build this first" — given any of them (`prepare`,
`build`, `workspaces`, …) npm runs a nested install that inherits your `-g`
and leaves an EMPTY directory with a dangling `isocan` on your PATH (#47).
`npm run release` publishes the branch; `scripts/release.mjs` tells the whole
story.

Starting a *new* project this way — an empty directory, a GitHub repo, a canvas
bound to it, and agents parked on that canvas waiting to be told what to build —
is walked end to end in [`docs/new-project.md`](docs/new-project.md), and runs
in one command as [`scripts/new-project.sh`](scripts/new-project.sh):

```sh
scripts/new-project.sh acme-widgets --agents claude,codex --launch
```

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
node bin/isocan.js canvas create "My canvas"
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
- **What it answers to (`?`)**: every key the canvas takes, in one panel —
  opened with `?`, or the `?` in the top bar, or by typing `/help`. The list
  lives in `@isocan/core` and a test checks the letter keys against the code
  that would have to answer them, because a help panel describing a different
  app than the one it is in is worse than no help panel. The same panel lists
  the slash commands available here, including any this home added.
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
- **The slide deck** (#87): full screen (`Enter`) is the projector — bare
  arrows and a clicker's Page Up/Down flip from item to item, each filling
  the window, the chrome resting while you present. Mark items as slides
  (right-click → *Make this a slide*, or `isocan slides add`) and the flip
  stops only at those, in reading order — rows top to bottom, left to right;
  with none marked, everything is a slide. Marked items wear 🎬, and `isocan
  slides show` prints the running order plus the address to hand an audience:
  the first slide's full-screen URL.
- **The design sprint**: type `/sprint` in the Chat and an agent facilitates a
  Knapp-style sprint — people and agents sketch as peers, one person decides.
  The facilitator calls phases (`/sprint crazy8s 8m`), and a clock chip shows
  the phase, the time left and how many sketches are in; `isocan sprint` prints
  the same line, derived from the Chat rather than stored anywhere. Hand in
  with right-click → *Hand in* or `isocan sprint handin`; vote with reactions
  (🔴 heat map, ⭐ straw poll, 🏆 the Decider's supervote), which the app hides
  until the bell and never hides from the record. `isocan sprint tally` shows
  human dots and agent dots apart. The sprint is a **board**: the facilitator
  lays one sheet per stretch of the week (`isocan sprint board`), each saying
  what happens there; calling a phase walks everyone to its sheet and the clock
  chip offers the phase's one action — *New note* in the sheet, *Hand in* onto
  it. Sketchers get desks (`isocan sprint desk Theo`): private canvases that
  show the sprint's clock and hand in across canvases. A vote is a picture:
  *Place a 🔴* and click the part of a sketch you like; dots hide on the Vote
  sheet until the bell. Grids draw the storyboard and the test wall
  (`isocan area grid Test 5x15`). See
  [the research](docs/research/2026-09-01-design-sprint.md) and
  [the journey](docs/projects/sprint/journey.md).
- **Areas**: a titled sheet things are placed on — `isocan area new "Sketches"`,
  then `--in Sketches` on `text`, `add` and `mv`, `isocan ls --in` to read it
  back, `isocan format --in` to tidy within it. A sheet lies behind everything,
  lets tools through to the canvas, and carries what is on it when dragged by
  its name. Membership is geometry, never stored.
- **The workbench (`W`)**: the same canvas flipped to the agent room — every
  agent with a live session in one roster (its status in its own words,
  expandable to what it is answering and what it last made), the main thread
  beside them, and one item on a stage. It is a route (`/w`, `/w/<item>`), so
  `isocan open --workbench [item]` hands somebody the exact view; Esc steps
  back out one level at a time, onto the canvas exactly where you left it.
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
- **Reactions**: select an item and a row of marks appears beneath it —
  click one to add yours, click it again to take it back, and the smiley
  button opens a picker (recents, groups, and a search) for everything else. A mark carries WHO left it, so a chip reads "3" and knows which
  three; yours is outlined, so agreeing with somebody is one click and never a
  guess about whether you already did.

  The right-hand dock is the canvas grouped by those marks: a section per
  emoji, ordered by how many items wear it, each entry previewing the item
  itself rather than reducing it to a first letter. It replaced a favourites
  star, and the reason is that a star is one shared bit with nobody's name on
  it — a team that wants "needs review" and "shipped" and "blocked" had one
  flag and an argument. Nothing here defines what 👀 means; the team does, by
  using it, and the dock shows whatever system they invented without our
  having built it. Marks are properties on the item, so they survive a reload,
  reach the other machine, and answer an agent asking what is in play
  (`isocan react 👀 <item>`, `isocan ls --reaction 👀`).
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
  only: canvas, connection, trash, and who's here. When the main-thread
  panel is open the Shelf recenters in the canvas the panel leaves visible.
- **Who's here, and who wants you**: a facepile in the top right holds
  everyone on the canvas — live people and agents in their identity color,
  plus anyone who left an unread comment behind, dimmed. A face badged with a
  count takes you to that comment; a live face takes you to their cursor.
- **Sharing**: **Share** sits beside the facepile, because the pile is *who's
  here* and Share is *who may be here*. It hands you the canvas's address with
  a copy button — that is the whole invitation, and it carries no installation
  instructions on purpose: whoever receives it lands on the populated canvas in
  a browser with nothing installed, and the canvas offers a terminal to anyone
  who reaches for one. Underneath is one revocable row: **"anyone with the
  link"** is a grant the canvas is born with. Turning it off turns the next
  stranger away **and expels the ones who got in on it** — and it tells you how
  many, because the other half of that gesture is the half nobody expects:
  anyone another grant still covers stays where they are, so turning off the
  link does not throw out the people who were invited by name. `isocan share`,
  `isocan share --link off|on` is the same endpoint from a terminal — sharing
  is the one gesture that is not a canvas op, because it acts on who may knock
  rather than on what is on the canvas, so it never appears in the oplog and
  `undo` will not take it back. A canvas that will not have you says so:
  `403 not-admitted`, which means ask whoever shared it — not "get a new
  credential". Beside the toggle is **one field for one person**: invite an
  email address, and whoever proves that address is let in whether or not the
  link is on. `isocan share <email>` and `isocan share --revoke <email>` are the
  same two gestures from a terminal. Removing somebody is not the same as
  keeping them out: if the link is on they can come straight back as a
  stranger, and both surfaces say so before offering **and keep them out** —
  a **bar**, a row that says no whatever the link or any invitation says,
  listed as **kept out** with who and when, and lifted with **Let back in**
  (`--revoke <email> --bar`, `--bar <email>`, `--unbar <email>` from a
  terminal). The creator cannot be barred. Every one of these is an **owner's**:
  whoever made the canvas, or anybody invited as **Owner** — an invited
  person's rung is a picker on their row, and raising it reaches the tab they
  have open without a reload. Everyone else sees the controls disabled with
  the owner's name, and the daemon refuses them with `403 not-owner`.
- **Spaces**: a named set of canvases access is set on once. **New space** on
  the canvas list makes one; the list draws a heading per space and **No
  space** last, and a card's **Move to space…** (or dragging it onto a
  heading) puts a canvas in — at most one space per canvas. The space's
  **Share**, from its heading, is the canvas's Share one scope wider, with one
  more row at the top: **Every canvas in this space**, which sets or turns
  off the link on each canvas in one gesture and says how many it reached.
  A person's rung on a canvas is the highest from any row on the canvas or
  on its space — the space's rows are a floor, never a ceiling, so one canvas
  in a locked space can still be opened to a client. A canvas's Share shows
  the space's rows first, greyed, as *from the space*. `isocan space
  new|list|add|remove|delete` and `isocan share --space <name>` are the same
  routes from a terminal, and `isocan canvas list` groups by space.
- **Proving an address, which is not a login**: isocan has no accounts and does
  not want any. What a person can do is **borrow an attester they already
  have** — click your own face, pick **"Prove your address…"**, and a link
  arrives in the inbox; opening it writes one line onto the badge this browser
  already carries. Nothing is created: no user record, no password, nothing to
  reset, and a person who never does it keeps using isocan exactly as before.
  What it buys is two things. Somebody can invite **you** by name instead of
  handing out the link — that is what an `email:` grant is satisfied by — and a
  second surface that proves the same address may **resume the person your
  first one already is**, which is how a phone becomes you without anybody
  asserting anything. A home that has borrowed no attester says so and offers
  no control, because the link is how sharing works there; whether a home has
  one is configuration, so the same build runs on a laptop and at isocan.io.
- **Escalation**: a thin guest goes thick in one command, and the canvas hands
  it to you — click your own face and pick **"Bring your own agent…"**: one
  sentence of concept, one line, a copy button, and a clock, because the
  thing it hands you is single-use and dies in fifteen minutes. What you paste
  it into is the agent you already have running, not a shell — the line tells
  it to set the directory up and park, so the paste is the whole instruction.
  The terminal half is the same gesture with a shell's reader in mind: from a canvas you are
  already on, `isocan pass` mints a short-lived, single-use **pass** and prints
  the whole line to paste on the other machine —
  `npx github:dglazkov/isocan#release setup <address>#<pass>` — and that one
  line joins **that canvas**: the daemon opens a link to that home, redeems the
  pass so the machine is admitted and knows whose it is, writes the marker and
  the canvas's row, and replicates it. Nothing else on the machine moves —
  canvases already here stay where they are, and the birth default is set only
  if none was, which setup says out loud.
  Your own second machine arrives **as you**: an identity is handed over by a
  session that already is you, never claimed at a door. `--admit-only` mints
  the other honest shape, for an agent that will name itself. A pass is a
  credential, not an invitation — it admits even when the link grant is off, so
  it is worth exactly one machine, once, for fifteen minutes, and the address
  from `isocan share` stays the thing you hand a person. `isocan open` uses the
  same mechanism the other way: the browser it spawns arrives already being
  you, while the address it prints carries no pass. The credential rides in a
  `#fragment`, which never leaves the browser — not into the home's access log,
  not into a `Referer` — and a tab that arrives on one comes up already being
  that person, or says in words which of "expired", "already used" and "no such
  pass" it met.
- **Direct machines**: a workspace that will be thrown away does not want a
  replica in it. `isocan setup <address> --direct` — or `ISOCAN_DIRECT=1` in a
  workflow file, which reads the address out of the committed marker — sets a
  machine up with **no daemon at all**: every command speaks to the home
  itself, nothing is copied to disk, and a torn-down sandbox loses nothing
  because its whole state was always the home's. `serve`, `restart` and `stop`
  refuse there rather than quietly giving the machine a second replica, and
  `isocan direct` shows which way a machine works, sets it, or undoes it. It is
  always declared and never guessed — no environment is sniffed and no vendor
  is named, because whether a directory is worth a replica is something only
  the person setting it up knows.
- **Your surfaces**: a canvas you can reach from four machines is four
  credentials, and one of them can go missing. Click your own face and pick
  **"Your surfaces…"** — every holder that carries your identity, what each
  speaks as, how many canvases it is in, and when it was last seen, with the
  one you are reading this on marked. Ending one stops it speaking as you
  anywhere, immediately, and takes with it anything that machine had passed
  onto a canvas. `isocan badges` and `isocan badges --kill <id>` are the same
  two gestures from a terminal, and on a laptop they act on the ledger of the
  **home your canvases are born at**, because that is the one that stops a
  machine you no longer have.
  Ending a surface is not the same as un-inviting it: it comes back as a
  stranger with none of your personas, and whether a stranger gets in is what
  the link grant decides. The two gestures compose, and neither pretends to be
  the other.
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
  that summoned it, and hands back a `--canvas` command that lands there.
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
- **Trash & undo**: deletes go to a per-canvas trash; undo is
  **actor-scoped** (`⌘Z`/`⇧⌘Z`, `isocan undo|redo`) — your undo walks your
  own ops, never a collaborator's. Entries invalidated by others (your target
  got deleted) are skipped; batch inverses shrink to their surviving members.
  Trash-empty and canvas-delete are confirmation-gated and not undoable.
- **Offline, in the browser**: a tab that loses its network keeps working. A
  service worker caches the app shell, the canvas and its seq cursor live in
  IndexedDB — so a reload with no network comes back to the canvas, not to a
  blank page — and changes made meanwhile are applied at once and queued. On
  reconnect the queue goes up FIRST and is ordered by the home; only then is
  the socket dialled with the cursor, so the tail that comes down already
  contains your work in the home's order. A bar says how many changes are
  being held; anything the home refuses is rolled back **and said out loud**,
  never silently. Every write carries a client-minted op id, so retrying one
  whose answer was lost is answered with the entry it already became rather
  than a duplicate-id refusal. Two things deliberately do not work offline
  and say so: adding a **file** (bytes are not queued) and **undo** (the
  stack is the home's, walked over the whole oplog).
- **Canvases**: a canvas is the unit of work; create/list/edit/delete from
  either surface.
- **A directory is its canvas** (#60): `<dir>/.isocan/project.json` binds a
  directory (git toplevel when in a repo) to a canvas — identity only, the
  state stays in `~/.isocan`. Written automatically when an agent names
  itself (`identity --session` creates the canvas if needed, named after
  the directory), or by hand with `isocan use <canvas>`. Resolution walks
  up like `.git`; a committed marker means a clone knows which canvas it
  is. A marker this machine has never seen that names **no** home is
  materialized under its own id on the first addition; one that names a home
  this machine has never dialled is **fetched from there** — the daemon opens
  a link, that home's door decides, and the row is written, with nothing else
  on the machine moving. In a bound directory `canvas list` narrows to
  that canvas (`--all` widens) and `wait` listens to it alone — there is no
  home-wide listening; the old "on call" presence was retired with this
  change. `~/.isocan/dirs.json` is the dir→canvas roster, a lazily healed
  cache.

## CLI surface

```
isocan --agent-help                # the collaboration protocol, for agents
isocan setup [dir | <address>#<pass>]  # ready a directory — or join that canvas
isocan identity [--session] [--name X] [--home|--new|--as <id>]|whoami
isocan serve [--force]|status|stop|restart|upgrade · open
isocan home [<url>|--clear]        # where each canvas here lives; set where
                                   # NEW ones are born (nothing already here moves)
isocan share [<email>] [--as own|edit|read|view] [--link on|off|edit|read|view]
             [--revoke <email> [--bar]] [--bar <email>] [--unbar <email>]
                                   # the address, and who may enter this canvas
isocan pass [--admit-only]         # a one-use pass: the command another
                                   # machine of yours pastes to join
isocan badges [--kill <badgeId>]   # the surfaces carrying your identity, and
                                   # what each has proved; end one
isocan canvas create|list [--all]|show|edit|delete
isocan use <canvas> [--home]      # bind this dir to a canvas (--home: fallback)
isocan add <file> [--at x,y | --anchor <item>] [--title] [-d] [--prop k=v]
isocan ls · show <item> · mv <item> <x> <y> · set <item> […] · rm · restore
isocan edit <item> [<file>]        # new version from a file or $EDITOR
isocan versions <item> · version promote <item> <version>
isocan comment add (--item <item> | --at x,y) <text> · reply · list · rm
isocan comment anchor <thread> (<item> | --at x,y)   # re-pin / detach a thread
isocan comment main [<thread> | --clear]   # the docked agent↔user channel
isocan undo · redo · trash list|restore|empty --force
isocan gc [--all] [--dry-run] [--keep-ops N]   # compact the oplog, sweep
                                       # unreachable blobs (--all: every canvas
                                       # you are admitted to at this home)
isocan session start|on|work|point|move|say|end · isocan who   # presence
isocan session on <thread> --say "…"    # picked it up; shows live in the thread
isocan activity [who] [-n N]           # what has been happening here, newest first
isocan design [--css|--tokens] · design set <file> · design check
#   the canvas's own design system: a DESIGN.md whose front matter is
#   typed design tokens (W3C-compatible) and whose sections are the reasoning
isocan command list|show|add|rm        # slash commands: work a message can ask for
#   built-in: /help /format /variation /grill-me /accessibility-audit
#             /app-store-assets /web-assets /marketing-kit
#             /design-audit /design-system /skill
isocan command add --from <owner/repo/path>  # a published skill, shown before it lands
isocan format [--dry-run]              # tidy the canvas: rows, children, references
isocan merge <drawings...>             # several drawings into one, exactly
isocan shortcuts                       # every key the canvas answers to
isocan wait [--timeout s] [--all-ops]  # park; wake on a comment for you on
                                       # this dir's canvas
isocan tail [-f] [--archived]          # print/stream the operation log
                                       # (--archived: reach back through what
                                       # gc compacted — the full history)
isocan recap [-n N]                    # that history at decaying resolution:
                                       # old spans summarized to a line each,
                                       # the last N ops verbatim
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

**The logged-out surface is a route, not a site.** A browser that is nobody yet
and asks for `/` gets a front page — the idea in two sentences, the three steps
that get you onto a canvas with the install line ready to copy, one screenshot
of a real canvas with four cursors on it, and the ledger that is the whole
argument: a gesture on the left, the command that performs the identical
operation on the right. Every other address still asks who you are, so a share
link is unchanged. This used to be a separate static site under `marketing/`,
which nothing served and which drifted from the app the day it was written; it
was folded into `packages/web` and the directory deleted, because two front
doors is one too many.

Storage lives under `~/.isocan` (override with `ISOCAN_HOME`): per-canvas
directories with human-readable JSON snapshots, an append-only `oplog.jsonl`
as the source of truth (crash recovery replays the tail), and sha256
content-addressed blobs. Every op's inverse is computed from pre-state and
stored in the log — undo/redo replay stored inverses, never re-derive them.

Storage is reclaimed by `isocan gc` (or the trash panel's "Reclaim storage"):
it compacts the oplog to an undo horizon (default: the last 500 ops, kept
pair-complete so redo never dangles; dropped entries go to
`oplog-archive.jsonl`, which `tail --archived` and `recap` still read —
compacted history is archived, never lost to the product), then sweeps blobs
unreachable from live items, the
trash, and the retained log. Blobs younger than ten minutes are never swept,
covering the gap between upload and `item.add`.

The daemon also does this to itself: every canvas it holds, a minute after it
starts serving and every hour after that (`ISOCAN_GC_INTERVAL_MS`), so a home
that runs for months does not need anybody to remember — and one that is only
alive in short bursts still collects, which is why the first sweep is a minute
out rather than an hour. Nothing schedules it from outside: a home collects its
own garbage, which is why there is no credential anywhere in this story.

## Answering to a home

**The home is a property of the canvas, not of the machine.** One daemon is
the **home** of some canvases — it holds them, serves their pages, and is the
single writer of everything on them — and a **replica** for others: it still
answers your CLI instantly from a local copy, but their writes travel to the
home that holds them and come back, and their pages are served there. Which is
which is decided per canvas, by two things that must agree: the
`.isocan/project.json` marker, which carries the address a canvas was born at
and travels with a clone, and `~/.isocan/homes.json`, this machine's own row
per canvas written when it is born or joined and never guessed. A canvas with
no row is one this daemon is the home of. When the two disagree, the command is
refused with both addresses named — moving a canvas between homes is a
deliberate act, never something a stray command does on your behalf.

That is the one-origin rule, and it was always per canvas: every canvas has
exactly one door, so its cookie, its service worker and its browser replica
live in one origin's storage. So a daemon serves the app for the canvases it is
the home of and, for the rest, answers a page request by naming the home that
does. A laptop can hold local work and a team's work at once without either
canvas getting two doors.

As a replica it carries **the canvases it was let into**, not everything at
that home: one you joined with a pass (`isocan setup <address>#<pass>`), one
born in a directory here, one named by a `.isocan/project.json` that came with
a clone. So a fresh replica starts empty on purpose, and a canvas at the home
that is not on this machine is not missing — nobody has handed it over.

```sh
isocan home                       # where each canvas here lives, and whether
                                  # each of those homes is answering
isocan home https://isocan.io     # canvases born here are born there
isocan home --clear               # canvases born here stay here
```

`isocan home` with no argument reports per canvas, because that is where the
answer lives:

```
role             home of 2 canvases; replica of https://isocan.io (1); new canvases → https://isocan.io
birth default    https://isocan.io — a canvas born here is born there; nothing already here moved
answering        yes — https://isocan.io is up

canvases
CANVAS           ID        HOME
Acme Sprint      prj_7f3a  here — this daemon is its home
Test Fixture     prj_91b2  here — this daemon is its home
Widget Redesign  prj_c40d  https://isocan.io
```

`isocan home <url>` sets the **birth default** — where a canvas born here from
now on is born — and **nothing already here moves**: canvases already at a home
still answer to it, canvases already local stay local, and `--clear` says the
same in the mirror. It writes `~/.isocan/config.json` and restarts the daemon,
because a daemon reads that file once, at boot; it checks the address answers
first, since a canvas whose home cannot be reached refuses every write and
queues nothing (`--force` sets it anyway). `ISOCAN_HOME_URL` overrides the file
and means the same narrow thing. There is **no default address** — `isocan
serve` with nothing configured births locally, which is what every daemon in
this repo does.

`isocan serve` on a rented VM is a complete home: the same daemon, the same
code, reachable by anyone you point at it.

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

**New contributor?** [`docs/getting-started.md`](docs/getting-started.md) is
the first hour: clone to running, the three homes and which one you are
pointing at, how work reaches production, and the house practices that are not
obvious from the code.

[`docs/development.md`](docs/development.md) is the whole of it, written for the
people who actually work here: an **upgrade** door for a rig built before
the home work landed, and a **first entry** door — `git clone` to a running dev
setup to a canvas of your own at dev.isocan.io — plus the shared matter, the
clean-shell discipline and the hazards. What follows is the command list it
expands on.

```sh
npm run dev         # daemon + Vite with hot reload
npm run dev:replica # a scratch machine on :4442 with its OWN isocan home —
                    # `-- <command>` runs any CLI command against it. It starts
                    # from empty on purpose, badge included, so join a canvas
                    # with `-- setup <address>#<pass>` and exercise that path
                    # from zero
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

Agents working in this repo start at [`AGENTS.md`](AGENTS.md). What teaches
one to collaborate on a canvas is `isocan --agent-help`: the protocol —
naming yourself, appearing, the comment→build→reply→`wait` lap — shipped
inside the CLI (`packages/cli/src/agent-guide.md`), so it always describes
the build in hand rather than whatever was installed months ago (#75). The
[Agent Skill](https://agentskills.io/specification) at
`.agents/skills/isocan-collab/` — the location most harnesses discover on
their own; Claude Code reaches the same file through the committed symlink at
`.claude/skills/isocan-collab` — is the doorway that points there. Adding a
harness means adding a doorway to that file, never a second copy of it
(`test/skills.test.ts` holds the line).
