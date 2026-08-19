---
name: isocan-collab
description: Collaborate on an isocan canvas as a visible agent — address comments, build/edit items, and run the wait-driven feedback loop via the isocan CLI. Use when asked to work on a canvas, address canvas comments, "park" and wait for feedback, or run a canvas session. Triggers on "isocan", "canvas comments", "park on the canvas", "address my comments".
---

# Collaborating on an isocan canvas

isocan is an infinite shared canvas. A local daemon owns the state; the web
app (which the human watches) and the `isocan` CLI (you) are equal clients —
every operation you run appears on their screen live, and your presence
renders as a named cursor. `isocan --help` is the full reference and is
written for you; read it once per session.

## If `isocan` isn't there

The skill can arrive without the tool (`npx skills add dglazkov/isocan`
installs this file alone). If `isocan --version` fails, one command installs
it and sets up the directory you are in — the repo is the package, no registry
involved:

```sh
npx github:dglazkov/isocan#release setup   # CLI on PATH, skill, daemon, app
```

It is idempotent — run it whenever you land somewhere new — and it puts
`isocan` on your PATH itself, so every command below is just `isocan …`.

Keep the `#release` on the spec — without it npm installs nothing usable.
Setup's report says where the CLI landed, and if your shell cannot see it (a
non-login subshell often can't see nvm's or asdf's directories) that line
carries the `export PATH=…` that reaches it. Prefixing every command with
`npx github:dglazkov/isocan#release` also works, with no install at all.

## Orient (once per session)

```sh
isocan status                  # daemon auto-starts on any command if down
                               # says "stale"? `isocan restart` — the daemon is
                               # an older copy than the CLI you just ran
isocan whoami                  # identity must be YOURS, not the user's
isocan identity --session      # be handed a name, as THIS agent — and bind
                               # this directory to its canvas (see below)
isocan project list            # the directory's canvas; --all for the home
```

**The directory you are in IS the project.** `identity --session` makes sure
of it: if `<dir>/.isocan/project.json` already names a canvas (the marker is
committable and resolves by walking up, like `.git`), you are on that canvas;
if the marker names one this machine has never seen (a fresh clone), your
first addition materializes it under the same id; if there is no marker, a
canvas named after the directory is created and bound. So there is always a
canvas to work on — this directory's. Every command resolves to it on its
own; pass `--project <ref>` only when deliberately reaching for another
canvas, and treat the human's other canvases as their business
(`project list --all` shows them).

Conventions: `<item>`/`<thread>` args accept id, id prefix, or title prefix.
Coordinates are world units (+x right, +y down). Add `--json` to any command
when you need to parse output.

## Your name

You are a collaborator on this canvas, so you need a name of your own — not
your model's or your vendor's ("Claude", "GPT", "Gemini" are all wrong here,
and any harness should be able to run this skill), and never the human's.

**A machine holds one person and any number of agents.** Two slots keep them
apart. `~/.isocan/identity.json` is the person's name. A session — the id
your harness puts in the environment of every command it runs — belongs to
you alone, and `--session` claims it: naming yourself is an operation the
daemon applies atomically, so two agents in one checkout are two people
without having to coordinate at all, even claiming in the same second. There
is no directory slot — a directory cannot tell one agent from another, so a
name written there would be handed to whoever walks in next. `--session` can
never rename the human — that is the whole reason the flag exists.

If `--session` reports no harness session, export a session id yourself
before naming yourself — any stable string works for the length of your run:

```sh
export ISOCAN_SESSION_ID="$(uuidgen)"   # with ISOCAN_HARNESS for the label
```

or name your harness's own variable once in `~/.isocan/config.json` under
`harnessVars` so it works every time after.

Pick like this, once, before you appear:

1. `isocan whoami` — a name followed by "this agent session" is YOURS, from
   earlier in this same session: keep it, a stable name beats a fresh one.
   A bare name is the HUMAN's — never yours to keep. On a machine where
   nobody has been named yet it errors with "no identity configured" — that
   is the answer "nobody, yet", not a broken install; same for a `project
   list` that is empty before you have named yourself (the handshake is what
   creates this directory's canvas). Neither is a reason to reinstall
   anything.
2. `isocan identity --session` — ask, receive. The daemon knows every name
   every canvas answers to and hands you a free one (Isaac, Kenny, Nico… —
   names hiding in the letters of "isocan"); no roster to read, no race to
   lose. Want a specific name? `--name "<name>"` — if somebody already
   answers to it the command REFUSES and names the holder; take what
   allocation offers instead of forcing it with `--new`. Then keep the name
   for the whole collaboration — the human will call you back by it, and
   `@Name` only works if exactly one of you answers to it.

Your session id is durable across resume — a resumed conversation gets the
same actor back by running the same command. Only if your conversation is
truly gone (fresh session, no transcript) and you must be your old self
again: `isocan identity --as <your old usr_… id>` — deliberate reincarnation,
never a way to take a name that isn't yours.

If `--session` found no harness session, mention it to the human after you
have worked around it: a harness isocan has not met can opt in for good by
exporting `ISOCAN_SESSION_ID` (with `ISOCAN_HARNESS` for the label), or by
naming its variable once in `~/.isocan/config.json` under `harnessVars`.

## The session protocol

**The canvas is the only channel.** The human is watching the web app, not
your terminal — anything you say outside a comment is said to nobody. Once
you have appeared, everything you would have told them goes in a comment.

Steps 1–2 happen once. **Steps 3–6 are a lap, and you run laps until the
human sends you home.** Every lap ends at step 6 — including the one you
think is the last.

1. **Appear.** `isocan session start --label "<your name> 🤖"` — the label is
   what the human sees on your cursor, so keep your name in it.
2. **Read.** `isocan comment list` — a comment needs addressing when the last
   entry in its thread is not yours.
3. **Presence narrates itself — add your own words for the quiet parts.**
   Once a session exists, every command you run updates your cursor and
   status automatically: reads narrate ("looking at…", "reading the
   comments…"), ops move your cursor to where they happened, waking from
   `wait` lands you on the summoning thread, and posting a comment clears
   your status. What the system cannot see is you authoring files or
   thinking — the canvas shows "quiet Ns" honestly, but better is
   `isocan session work <item> --say "what you're doing…"` (or
   `session work --at x,y --say …`) BEFORE a long silent stretch. Your words
   outrank the derived narration until your next comment.
4. **Build.** `add` new files, `edit <item> <file>` for changes to existing
   items (each edit stacks a version — never re-add), `mv`/`set` to arrange.
   Every op you run snaps your cursor to where it happened.
5. **Close the loop on the thread.** Always `isocan comment reply <thread>
   "…"` describing what you did, where you put it, and any judgment calls.
   The reply is the deliverable's receipt. Comments render as markdown in
   the web app, so structure is welcome — but keep it short (see below).
   Address a specific person with
   `@Name` (first names work) — mentions are resolved when you post.
   Point at your work with `#Title` (an item's exact title, or `#itm_…` its
   full id) — in the web app the chip flies the reader to the item, so
   "done, see #Roadmap" beats describing where things are.
6. **Park.** `isocan wait --json --timeout <sec>` blocks until the next comment
   that is FOR YOU: one that @-mentions you (name or session label), lands in
   a MAIN thread (see below), or lands in a thread you wrote in or were
   mentioned in. Everything else — comments for others, comments mentioning
   nobody — is ether and won't wake you.
   Exit 2 on timeout, 0 with the feedback as JSON. **Run it in the
   foreground, as one tool call** — the call returning IS your wake-up (see
   "Parking is a foreground call"). While parked your cursor shows "waiting
   for you…" automatically. On wake, or on a timeout: start the next lap.
   The wait is on THIS directory's canvas — the one your work is on. There
   is no home-wide listening; if the human wants you on a different canvas,
   they will say so, and `--project <ref>` is how you reach it.

**Going home** is not a step, it is an interruption: run `isocan session end`
when the human has told you the collaboration is over, and only then. Nothing
else ends it — not an empty comment list, not a finished task, not a `wait`
that timed out. Until those words come, the answer to "what now?" is always
step 6.

## Parking is a foreground call

`wait` is not a job you start; it is the turn you are having. The blocking
tool call is the notification channel: when it returns, your harness hands you
the JSON and you are awake, in the same turn, with the work in front of you.

A detached `wait` keeps your cursor on the canvas but cannot wake the model —
its stdout ends up somewhere nobody reads, and **a file is not a
notification**. So no `nohup`, no `&`, no "run this in the background" mode of
your shell tool, no `> wait.json` you come back to poll. If your harness
cannot hold a long-running tool call open, that is a harness gap to fix with
event forwarding, not something to paper over with a detached supervisor.

- **Your turn ends inside `wait`, or it ends wrong.** Before you stop, look
  at the last command you ran: if it is not `isocan wait`, you have not
  finished the lap — you have walked off the canvas while the human is still
  typing, and they have no way to tell the difference. "Nothing left to do"
  is not an exit; it is precisely the moment to park.
- **Size the timeout to your harness.** Set `--timeout` a little under the
  longest tool call your harness allows, and raise the tool's own timeout to
  match: `--timeout 3600` where calls can run an hour, `--timeout 570` under a
  10-minute cap. A short park is fine — it just means more laps.
- **Exit 2 means nothing came.** It is the quiet half of a conversation, not
  the end of one: park again. Never invent work out of a timeout, and never
  read one as permission to leave.
- **One waiter, ever.** Two parked processes race for the same wake and one of
  them will be doing invisible work. Start the next `wait` only after the work
  is done and the receipt is posted.
- **Handle the wake in the turn it arrives.** The JSON names the thread that
  woke you — read it, do the work, reply.
- **If a turn is interrupted, re-read before acting.** An old `wait` payload
  is not a queue. `isocan comment list` and `isocan tail` are the truth; match
  on comment/operation ids so you don't answer the same comment twice.

## The main thread

One thread per canvas may be designated "main" (`isocan comment main` shows
it; `comment main <thread>` designates). It is the user's direct channel to
you: in the web app it renders as a docked chat panel, everything posted
there wakes your `wait` with no @-mention needed, and `#Title` references in
it render as cards that fly the reader to the item. Treat it as the primary
conversation — reply to main-thread asks in the main thread, and keep
item-specific critique on the item's own anchored threads.

## Working a canvas that is not this directory's

Only when the human asks for it. Pass `--project <ref>` to each command — do
NOT `isocan use` there, which would re-bind the directory you are standing
in — and check `isocan --project <ref> who --all` so your name is free on
that canvas too. Waking from a `wait` still lands your cursor on the thread
that woke you, with no `session start` needed.

## Practices that earn trust

- **Comments are read in a small thread window — be terse.** Precise and
  concise wins: a few tight sentences saying what you did, where it is, and
  any judgment call, then stop. No preamble, no restating the ask, no
  bullet-point reports. If detail truly matters, put it in an item on the
  canvas and point to it.
- **Placement**: honor the comment's location. Anchored comments → work on
  that item. Freestanding comments → place results near the pin
  (`--at x,y` close to the comment's coordinates), or use
  `--anchor <item>` to sit neatly left of a related item.
- **Anchor the thread to what it produced.** When a freestanding comment
  asks for something and you build the item, run
  `isocan comment anchor <thread> <item>` so the thread pins to the result
  and follows it from then on.
- **Show running software, don't describe it.** When your work is a dev
  server the human could look at, `isocan browse http://localhost:<port>`
  projects the live site onto the canvas as a mini-browser item — vite
  HMR keeps it current on its own; the item's ⟳ reloads anything else.
- **Versions are the medium for iteration.** "Change X on this item" means
  `edit` → new version. Mention "vN on the stack — fan out (F) to compare"
  in your reply so the human knows the history is there.
- **Leave the canvas tidy.** What a person does by dragging — edges snapping
  together, gaps evening out — you do with `isocan align <items…> --to
  left|hcenter|right|top|vcenter|bottom` and `isocan distribute <items…>
  --axis h|v`. Both are one op, so one undo, and both are no-ops when things
  are already in place. `isocan mv <item> --by 0,-40` nudges without doing the
  arithmetic yourself.
- **Renaming moves the file too.** `isocan set <item> --title "Bass tab v2"`
  also renames the blob to `bass-tab-v2.png`, stepping aside from any name the
  canvas already uses — the same act the web app performs, so the two never
  disagree. `--keep-filename` opts out.
- **Ink is a kind of item.** If you generate an SVG as annotation rather than
  as artwork — circling a thing, sketching a flow — `isocan add note.svg
  --drawing` lands it the way the web app's Pen does: no card, no titlebar,
  just the strokes. It reads back as `--kind drawing`.
- **Find things the way the files panel does.** `isocan ls --kind
  drawing|image|video|document|site|other` and `isocan ls --filter <text>`
  are the same two questions the human's Files panel answers.
- **Wear your color.** `isocan identity --color teal` (or any of crimson,
  violet, amber, forest, periwinkle, graphite, a `#hex`, or `none`) sets the
  color your cursor, face, and pins wear for everyone, on every canvas.
- **Verify before you ship.** HTML items: test logic headlessly (extract the
  script, run in node with DOM stubs). Risky renders: upload the blob alone
  (`POST /api/projects/<id>/blobs`) and eyeball it in a browser before
  creating the version — orphaned preview blobs are GC'd later. Note:
  cursor ANIMATION cannot be verified from a background/automation tab
  (Chrome throttles rAF when hidden); verify static layout only.
- **External content**: prefer cleanly-licensed sources (Wikimedia Commons);
  put attribution in the item title or reply. Say what you skipped and why.
- **Scope discipline**: comments are the user's instructions — but confirm on
  the thread before anything destructive (deleting items, emptying trash) or
  far outside the comment's ask.
- **Undo is per-actor**: your `isocan undo` only reverts your own ops.
- **If you hit a product bug**, stop the session work and tell the user —
  fixing the tool comes before continuing the choreography.

## Quick reference of the whole surface

`isocan --help` covers everything; the commands you'll live in:
`comment list|add|reply|anchor|main|rm`, `session start|work|say|point|end`,
`project create|list|show|edit|delete` (delete needs `--force` and is NOT
undoable — confirm on the thread first, and never delete a canvas you did not
make),
`who [--all]`, `whoami`, `identity [--color]`,
`add [--drawing]`, `browse <url>`, `edit`, `mv [--by]`, `align`, `distribute`,
`set`, `ls [--kind|--filter]`, `show`, `versions`, `version promote`,
`rm`/`restore`/`trash`, `undo`/`redo`, `wait`, `tail -f`, `gc`, `use`, `project`,
`open`, `setup`.

Every one of these is the same operation the web app sends. If you find
something a person can do on the canvas that you cannot do from here, that is
a bug in isocan, not a limit of yours — say so (see "If you hit a product
bug").
