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
installs this file alone). If `isocan --version` fails, install it — the repo
is the package, no registry involved — and let it finish the setup:

```sh
npm i -g github:dglazkov/isocan   # the CLI, built from source
isocan setup                      # this directory: skill, daemon, the app
```

`isocan setup` is also the one-command start from scratch in any directory:
`npx github:dglazkov/isocan setup`. It is idempotent — run it whenever you
land somewhere new.

## Orient (once per session)

```sh
isocan status                  # daemon auto-starts on any command if down
                               # says "stale"? `isocan restart` — the daemon is
                               # an older copy than the CLI you just ran
isocan project list            # find the canvas; then either:
isocan use <project>           #   set default, or pass --project <ref> per command
isocan whoami                  # identity must be YOURS, not the user's
isocan who --all               # every name the canvas knows — see "Your name"
isocan identity --name "Kenny" --here   # your name, in THIS directory
```

**If `project list` is empty, there is nothing to work on yet.** Canvases are
the human's to make — they pick their name in the web app and create one
there, which is why `setup` doesn't. Say so and hand them the URL
(`isocan status` prints it) rather than inventing a canvas they didn't ask
for; make one yourself only when asked, and it will be stamped as yours.

Conventions: `<item>`/`<thread>` args accept id, id prefix, or title prefix.
Coordinates are world units (+x right, +y down). Add `--json` to any command
when you need to parse output.

## Your name

You are a collaborator on this canvas, so you need a name of your own — not
your model's or your vendor's ("Claude", "GPT", "Gemini" are all wrong here,
and any harness should be able to run this skill), and never the human's.

**Two parties share this machine.** `~/.isocan/identity.json` is the person's
name; a `.isocan/identity.json` in a working directory is the agent's. Naming
yourself with `--here` writes the directory one, so you never rename the human
— that is the whole reason the flag exists. Commands run in that directory
speak as you; the human's canvases stay theirs.

Names hiding in the letters of "isocan" fit the place: **Isaac, Kenny, Nico,
Sonia, Iona, Osian, Isao, Cana** — or invent another in the same spirit.

Pick like this, once, before you appear:

1. `isocan whoami` — if it already names you "in this directory", keep that
   name; a stable name is worth more than a fresh one. A name with no such
   suffix is the HUMAN's, not yours: pick your own.
2. `isocan who --all --json` — every name the canvas knows, live or not
   (history included: a name someone used once still addresses them).
3. Take the first name from the roster above that nobody on the canvas
   answers to. If they are all taken, coin a new one from the same letters.
4. `isocan identity --name "<name>" --here`, then keep it for the whole
   collaboration — the human will call you back by it, and `@Name` only
   works if exactly one of you answers to it. The CLI warns you if the name
   is already taken on that canvas; if it does, pick again.

If the directory belongs to the human's repo, mention that `.isocan/` is
yours and can be gitignored — don't edit their `.gitignore` yourself.

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
   **Parking puts you on call for the whole home**, not just this canvas —
   see below. Do NOT pass `--project` to `wait`: that pins you to one canvas
   and makes you unreachable from every other.

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
- **Handle the wake in the turn it arrives.** The JSON names the project and
  thread — take the project ID/title from it (see "On call") rather than
  assuming it is your default canvas, read the thread, do the work, reply.
- **If a turn is interrupted, re-read before acting.** An old `wait` payload
  is not a queue. `isocan comment list` and `isocan tail` are the truth; match
  on comment/operation ids so you don't answer the same comment twice.

## The main thread

One thread per canvas may be designated "main" (`isocan comment main` shows
it; `comment main <thread>` designates). It is the user's direct channel to
you: in the web app it renders as a docked chat panel, everything posted
there wakes your `wait` with no @-mention needed — on any canvas in the home,
so a main thread is also how a new space calls you in — and `#Title`
references in it render as cards that fly the reader to the item. Treat it as
the primary conversation — reply to main-thread asks in the main thread, and
keep item-specific critique on the item's own anchored threads.

## On call: being summoned to a canvas you've never opened

A session belongs to one canvas; `isocan wait` belongs to the whole home.
While parked you appear in EVERY canvas's facepile as "on call" — including
canvases the human creates after you started waiting — so they can reach you
there by @-mention or by writing in that canvas's main thread. This is how a
brand-new space gets an agent: you do not have to be invited to it.

When `wait` wakes you on a summons, your presence has already moved: your
cursor sits on the thread that woke you — on whichever canvas it lives —
showing "reading your comment…". No `session start` needed. What `wait`
cannot do for you is retarget your COMMANDS, so when the canvas is not your
default:

```sh
isocan use <project>                      # or pass --project to each command
isocan who --all                          # check your name is free here too
```

Then run the loop from step 3 as usual. Your on-call presence ends when
`wait` returns; the landed cursor is what keeps you visible on the canvas
you were summoned to.

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
  `edit` → new version. Mention "vN on the stack — fan out (V) to compare"
  in your reply so the human knows the history is there.
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
`comment list|add|reply|anchor`, `session start|work|say|point|end`,
`who [--all]`,
`add`, `browse <url>`, `edit`, `mv`, `set`, `ls`, `show`, `versions`, `version promote`,
`rm`/`restore`/`trash`, `undo`/`redo`, `wait`, `tail -f`, `gc`.
