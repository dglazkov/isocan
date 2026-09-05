# Collaborating on an isocan canvas

isocan is an infinite shared canvas. A local daemon owns the state; the web
app (which the human watches) and the `isocan` CLI (you) are equal clients —
every operation you run appears on their screen live, and your presence
renders as a named cursor. `isocan --help` is the command-by-command
reference; this is the protocol. Read both once per session.

## Orient (once per session)

```sh
isocan status                  # daemon auto-starts on any command if down
                               # says "stale"? `isocan restart` — the daemon is
                               # an older copy than the CLI you just ran
                               # says "upgrade"? relay it to the human and carry
                               # on — catching up is their call, not yours
isocan whoami                  # identity must be YOURS, not the user's
isocan identity --session      # be handed a name, as THIS agent — and bind
                               # this directory to its canvas (see below)
isocan canvas list            # the directory's canvas; --all for the home
```

A directory nobody has readied yet takes one command: `isocan setup` puts
this guide's skill where agents look, the CLI on PATH, and the daemon behind
the app. On a machine that has never held a canvas it also writes **isocan.io**
down as the birth default, so the first canvas somebody makes is at the hosted
home rather than trapped on one laptop — it says so in its report, and `isocan
home --clear` undoes it. A machine that already holds canvases keeps birthing
them where it always did. A repo you do not have yet takes `isocan clone <repo>` — it clones,
readies the directory the same way, and reports the canvas the repo's
committed `.isocan/project.json` names, so a clone lands on THE canvas rather
than a copy of it. It installs nothing from the repo and runs nothing: `npm
install` executes the repo's own scripts, so that stays a line you type.

**The directory you are in IS the project.** `identity --session` makes sure
of it: if `<dir>/.isocan/project.json` already names a canvas (the marker is
committable and resolves by walking up, like `.git`), you are on that canvas;
if the marker names one this machine has never seen (a fresh clone), your
first addition materializes it under the same id; if there is no marker, a
canvas named after the directory is created and bound. So there is always a
canvas to work on — this directory's. Every command resolves to it on its
own; pass `--canvas <ref>` only when deliberately reaching for another
canvas, and treat the human's other canvases as their business
(`canvas list --all` shows them). `ISOCAN_CANVAS=<id>` in the environment
means the same as `--canvas` — an rc sets it for a summons, so a standing
agent's shells act on the canvas the summons is FOR, whatever directory
they run in.

Conventions: `<item>`/`<thread>` args accept id, id prefix, or title prefix.
Coordinates are world units (+x right, +y down). Add `--json` to any command
when you need to parse output.

## Your name

You are a collaborator on this canvas, so you need a name of your own — not
your model's or your vendor's ("Claude", "GPT", "Gemini" are all wrong here,
and any harness should be able to run this guide), and never the human's.

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
   A bare name is the HUMAN's — never yours to keep. (A `badge bdg_…` line
   under it is this machine's credential with the daemon, handed out
   automatically; there is nothing for you to do with it.) On a machine where
   nobody has been named yet it errors with "no identity configured" — that
   is the answer "nobody, yet", not a broken install; same for a `canvas
   list` that is empty before you have named yourself (the handshake is what
   creates this directory's canvas). Neither is a reason to reinstall
   anything.
2. `isocan identity --session` — ask, receive. The daemon knows every name
   every canvas answers to and hands you a free one; no roster to read, no
   race to lose. **It starts with the same letter your harness does** where it
   can — a Claude Code session gets a C name, a Gemini one gets a G — so a
   person looking at three agents can tell which is which. It is the initial
   and never the vendor's own name, for the reason above.

   Eight names per letter, and allocation enters that roster at a point
   derived from your session key rather than at the top, so two agents who
   cannot see each other do not both reach for the same one. Which C name you
   get is therefore not predictable and not worth predicting; that it is a C
   name, and that it is yours for the whole collaboration, is the promise. A
   harness with no letter of ours is handed an isocan name (Isaac, Kenny,
   Nico… — names hiding in the letters of "isocan"), which is also where a
   letter falls through to when its eight are worn. Want a specific name? `--name "<name>"` — if somebody already
   answers to it the command REFUSES and names the holder; take what
   allocation offers instead of forcing it with `--new`. Then keep the name
   for the whole collaboration — the human will call you back by it, and
   `@Name` only works if exactly one of you answers to it.

Your session id is durable across resume — a resumed conversation gets the
same actor back by running the same command. Only if your conversation is
truly gone (fresh session, no transcript) and you must be your old self
again: `isocan identity --as <your old usr_… id>` — deliberate reincarnation,
never a way to take a name that isn't yours.

`isocan identity --join <actorId>` folds another actor into the one you are —
its comments, mentions and undo become yours, and the home refuses it unless
this machine already speaks for both. It exists for a person who spent weeks
as a second name on a second machine; an agent almost never wants it, and
never for an actor that is not its own earlier self.

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
   they will say so, and `--canvas <ref>` is how you reach it.

**Blocked on the human?** Say so in a way the system can see: start a comment
with `/ask` — `isocan comment reply <thread> "/ask blue header or green?"` —
and park. An unanswered `/ask` is a derived state, not a flag: the workbench
pins your row to the top marked "asked", and `isocan who` shows `blocked`,
until somebody OTHER than you replies in that thread. It clears on the
answer, never on being seen — so ask real questions, in the thread the work
is in, and amend your own ask freely (your own replies keep it open).

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
- **Exit 4 means your access was withdrawn.** An owner removed you from the
  canvas while you were parked, and the daemon said so — `wait:
  withdrawn` — instead of going quiet. Do not park on that canvas again
  unless an owner lets you back in; say so wherever you report, and stop.
- **One waiter per NAME — enforced.** The daemon keeps one cursor row per
  actor per canvas, and the newest park adopts it: an older park speaking as
  the same actor exits 3 with "another park adopted this actor's cursor",
  delivering nothing. Exit 3 means stand down, not park again. Start your own
  next `wait` only after the work is done and the receipt is posted. (Two
  parked processes with two different names is a different thing entirely —
  see below, and it is allowed.)
- **Your place in the log survives you.** The cursor lives with the daemon,
  per actor per canvas: a park that is killed — mid-gap, mid-turn — resumes
  exactly where it left off on the next `wait`, with everything from the gap
  delivered. You never need `--since`. An entry that was already handed to a
  turn that died arrives flagged `redelivered: true` — you may have answered
  it before you died, so check the thread before answering twice.
- **The daemon is allowed to die under you.** A park survives a restart: it
  retries, starts the daemon again if nobody else has, and resumes at the
  same cursor, so nothing that landed meanwhile is missed. If it has been
  gone a few seconds you get one line on stderr saying so. You do not need a
  supervisor loop around `wait`, and you should not write one.
- **Handle the wake in the turn it arrives.** The JSON names the thread that
  woke you — read it, do the work, reply.
- **If a turn is interrupted, re-read before acting.** An old `wait` payload
  is not a queue. `isocan comment list` and `isocan tail` are the truth; match
  on comment/operation ids so you don't answer the same comment twice.

## More than one of you

A name is not a machine — it is a **session key**. Whatever the harness
exports (`ISOCAN_SESSION_ID`, or your harness's own variable) decides which
actor a command speaks as, so two processes on one machine with two different
session keys are two collaborators: two names, two cursors, two parks, two
undo histories. The canvas cannot tell them from two people on two laptops,
because there is nothing to tell.

That is how you do several things at once. One agent per concern, each with
its own name and its own park:

```sh
ISOCAN_SESSION_ID=scout  isocan identity --name Scout  --session
ISOCAN_SESSION_ID=scribe isocan identity --name Scribe --session
# then each process runs its own lap, parking on its own `isocan wait`
```

Both wake on the same summons in the Chat, and each answers as itself. What
you must NOT do is share one name across two processes — that is the "one
waiter per name" rule above, and it is the only way this goes wrong.

Two things worth knowing before you fan out. **Say who is doing what**, in
the Chat, before you start: three cursors appearing with no explanation is
alarming rather than impressive. And **fan out for work that is genuinely
separate** — two agents editing the same item is a merge nobody asked for,
while two agents on two screens is the thing this canvas is for.

## Scripting

The CLI has a library underneath it, and it is the same code. Reach past the
CLI when the work is a loop rather than a gesture — forty ops in a batch, a
watcher reacting to the log, a tool that composes many reads — because a
spawned `isocan` costs a process per action and hands you strings where the
library hands you typed values.

Install it locally, in the directory you are working in — never `-g`, a
global install is not importable:

```sh
npm i github:dglazkov/isocan#release
```

That line is the answer everywhere, a readied directory included: `isocan
setup` put the CLI on your PATH, and a PATH is not a module, so a script's
import needs the local install even where the CLI already works.

```js
import { connect } from "isocan";

const home = await connect();        // this directory's canvas, this
                                     // session's actor — the CLI's own
                                     // resolution, because it IS it
const canvas = await home.canvas();  // or home.canvas("<ref>") for another
const items = await canvas.items();  // typed reads: items, threads, who, activity
const item = await canvas.add({ title: "Report", content: html, mime: "text/html" });
for await (const entry of canvas.tail()) { /* entry.seq is your resume cursor */ }
```

Run it with plain `node` — the import registers its own TypeScript loaders.
`connect()` resolves the directory marker, the canvas, and your session
identity exactly as every `isocan` command does, so the script's ops land as
the same actor your CLI commands do; a script that is its own actor states it
(`connect({ identity: { session, harness } })`, claimed first with `isocan
identity --session`). `add` and `edit` take content as values and return the
item they made; `notify` speaks in the Chat; a refusal is an `ApiError`
carrying the wire's code, with `unreachable` when nothing answered.

The reference is the types themselves: the package is TypeScript source, so
your editor answers what `connect()` returns straight from the install, and
there is no separate API document to go stale. The ops a script sends are the
ops you would have typed — one op per user-visible act is still one undo.

## Standing agents

An agent can also be a **record instead of a process**: enrolled on this
canvas, answerable when something arrives, running only then. When a person
asks you to set one up — `@You add a reviewer here` — do it with:

```sh
isocan agent add <name>     # enrol an agent beside yourself, on THIS canvas
isocan agent remove <name>  # withdraw its standing (the history stays)
isocan agent rules [name]   # what an agent answers for here, and why
```

The syntax is the containment: no `--canvas`, no `--dir` — the agent you add
lives where you already are. Add one when a person asks, and only then; the
add is an op everyone can read. If a person tells you "you're done here",
`isocan agent remove <your name>` is how you take your own standing away.
What any standing agent answers for — its routing rules, and the truths
that hold through every rule set — is readable with `isocan agent rules`.

The person's side of this is `isocan rc` — a long-running command they start
that answers for enrolled agents. It is not your verb: inside a harness
session it refuses, and everything you need is the `agent` spelling above.

One name, one machine, many canvases: a name this machine already answers
for, enrolled on another canvas (`isocan rc add --canvas <ref> <name>`, the
person's gesture), is the SAME agent — one actor, one history, standing on
both. Nothing is duplicated and nothing needs a vouch; the enrolment key is
the name. One `isocan rc --all` (the person's, again) answers on every canvas
this machine's enrolments name: one budget per agent across all of them, one
conversation per agent that carries on wherever it is summoned, and
`ISOCAN_CANVAS` in your environment says which canvas asked this time.

Which harness a summoned agent runs in is the enrolment's `--harness`
(claude-code, pi, codex and antigravity are known; `~/.isocan/config.json`'s `acpAdapters`
declares others), and an agent enrolled with none named runs on the
machine's default: the only runnable harness, or the one picked with
`isocan rc --default-harness <name>`. `isocan harness` lists what this
machine can run and which is the default (`--json` adds a `runnable`
field) — the thing to read before presenting the choice to a person, and
the thing to tell them when a summons fails for want of one.

## The Chat

**The web app calls it the Chat**; on the wire and in this CLI it is the
thread flagged `main`, and the two are the same object — one thread per
canvas, designated with `isocan comment main <thread>` (`comment main` alone
shows which). It is the canvas's own conversation and the user's direct
channel to you: it renders as a docked panel rather than a pin, everything
posted there wakes your `wait` with no @-mention needed, and `#Title`
references in it render as cards that fly the reader to the item.

`isocan notify "…"` is how you say something there in one command — it
replies to the Chat, or starts it if the canvas has none. Reach for it
whenever you have an announcement rather than a remark about a thing: the
human sees it arrive, and every other parked agent wakes on it.

Do NOT use `comment add` for that. A comment is a PIN — it sticks to a spot
on the canvas — so announcing "the deploy is done" with one leaves a marker
on a place that had nothing to do with it, and a canvas collects them.

The distinction worth holding, because the words now carry it: **the Chat is
the canvas's conversation; a comment is pinned to a thing.** Reply to asks
made in the Chat in the Chat, and keep item-specific critique on the item's
own anchored comment — which `⇧C` and `comment add --item` both put at that
item's top-right corner, one per item.

## Words on the canvas

`isocan text "…"` puts words down as a **text node**: no card, no filename on
its face, editable by anyone who clicks it. Use it for the things that are
about the canvas rather than on it — a heading over a row of screens, a
caveat beside a mock, the question you want answered next to the thing it is
about.

It is an ordinary markdown item underneath, so nothing is special-cased: it
versions when edited, `#Title` points at it, `isocan get` hands back a `.md`,
and if it turns out to belong in the repo, `set --file` and `save` write it
there like anything else.

Prefer it over a comment when the words should be VISIBLE on the canvas
rather than folded into a pin — a label is not a conversation. Prefer a
comment when you are talking TO somebody.

The human has the same tool: `T`, then click the canvas and type. So a heading
you put down can be re-worded by them without asking you, and one they put
down is yours to read with `isocan get`. Double-clicking a node re-opens its
words, which lands as a new version like every other edit.

**Size is how far out it stays readable, not decoration.** A text node's size
is in world units, so it shrinks with the canvas: default text is a grey
smear by 25% zoom, and below 5 screen pixels the canvas stops drawing it at
all and shows a `T` mark instead. The ladder doubles, so each step survives
twice as far out:

| `--style` | readable to |
|---|---|
| `body` (default) | 50% |
| `heading` | 25% |
| `title` | 12% |
| `display` | 6% |

So label a CLUSTER with `--style title` and it is still legible in the
whole-board view where the notes beside it have become marks. That is the
whole point of having both — put the orientation in the big text.

`--face sans|mono|serif|hand` picks the voice. Reach for `mono` when the
words are a command or a path, which yours often are, and `hand` when you
are scribbling on the board rather than labelling it.

Markdown lines start with `-` and so do options, so a bullet given as an
argument needs `--` first. For anything with more than one line in it, pipe it:

```sh
printf '## Standup\n\n- text tool landed\n- park bug fixed\n' | isocan text -f -
```

## What you are about to read

`isocan context` answers the question nobody could answer before, including
you: **what will an agent actually read when it starts work here?** The design
system and whether it passes its own check, the Chat and how much of it, the
items somebody marked, the maps, the size of the canvas, and which guide this
build ships.

```
! Design system  v1 · 6m
                 2 findings from `design check`
                 → `isocan design check` lists them
  The Chat       7 messages · 2h
· Marked items   not here
  Mind maps      Lake house (5)
  The canvas     19 items · 6m
```

**It stores nothing.** Every line is counted at the moment you ask, so there
is no context record that can fall out of step with the canvas it describes.
Run it at the start of a task rather than assuming: a design system that is
three versions behind the screens it governs is the difference between work
that lands and work that gets redone.

`!` is a piece that needs attention, and it always says WHY — "3 items have
changed since it was last written" is something to act on, and a bare warning
is an accusation. `·` is simply absent, which most things are on most canvases
and is usually fine.

The same list is a panel on the canvas, so the person can see what you see.

## Choosing between variations

Explore with `/variation`, then `isocan choose <item>` says **this one won**:
the winner's content becomes a new version of the screen it was made from, and
every sibling — the winner included — goes to the trash.

The winner goes too, and that is deliberate: its content now lives on the
source's stack, so leaving it would be two copies of one decision and an
invitation to edit the wrong one. Nothing is lost. `--dry-run` says what would
happen and does nothing.

**One undo takes the whole decision back**, because the version and the
deletions share a group. The version comes off the source and every child
comes out of the trash in one gesture. (`isocan undo` names one op when it
does this — it is terse rather than wrong; the whole gesture is undone.)

It refuses with a reason rather than a shrug: an item made from nothing has
nowhere to fold back into, and an item whose source has been deleted since
says so.

## Where the seams are

`isocan timeline` draws the canvas's history as a track: a bar per bucket of
seqs, drawn from SIGNIFICANCE rather than from raw count, with a tick under
every bucket holding a seam. `--majors` lists the seams alone.

A seam is a structural change — something born, something deleted, a version
minted, a conversation started, the Chat moving. A run of forty moves is one
ripple, not forty ticks, which is why a tall bar with no tick under it means
that stretch was churn.

The significance function is in core, so `isocan timeline` and the app mark the
same seams. Two surfaces disagreeing about what mattered is the one thing this
architecture does not permit.

`isocan at <seq>` is the other half: the canvas as it stood at that point.

```sh
isocan timeline               # find a seq worth looking at
isocan at 50 --items          # what existed then
```

It is a fold of the same reducer the daemon runs, over the log from the
beginning, so it is the real past rather than a tidied one — **an undone entry
is replayed**, because at a seq before the undo landed, the undone thing was
still there. That is the opposite of what `timeline` does when DRAWING a track,
where both ends of an undo pair are skipped, and the difference is deliberate:
one question is what was true, the other is what is worth a tick.

Nothing is sent and no operation is invented. A position in history is a `seq`,
which both surfaces already speak, which is why the app's scrubber and this
verb land on the same past by construction. In the app it is the clock in the
tool rail: the same track, with a playhead you drag, and the canvas becomes
what it was while you hold it.

**The past does not take writes.** Standing at a seq is a way of LOOKING, not
a branch — there is no operation meaning "and from here it went differently".
The app refuses at the door, not in the interface, so an agent write lands the
same refusal a click does.

## What has been going on

`isocan canvas list` orders by recent activity and says what each canvas last
did, in words:

```
TITLE            LAST                          WHEN
Lake House       Di moved something            41h
Pen tool check   UIcheck moved something       3h
```

`--sort name|created`, and `--filter <words>` matches title and description in
any order — every word must match, so `--filter "lake rules"` finds "Rules of
the Lake".

`isocan history [who]` is the same question asked of a PERSON rather than a
canvas: what somebody has been doing across every canvas here, newest first.

```sh
isocan history            # everyone
isocan history Kenny -n 8 # one agent, across all their canvases — led by where they stand:
                          # a row per canvas (here / standing by / enrolled, nobody listening),
                          # acts, replies, and when the last was
```

It ends with the shape of the week — `8 of 286, across 9 canvases` — which is
the thing a per-canvas view cannot tell you and the reason this verb exists.

Both read the same words from `opWords` in core, so a canvas card in the app, a
seam on a timeline and these tables describe one event identically.

`isocan lens [who]` is the third view of the same facts: what somebody has
**made**, across every canvas, grouped.

```sh
isocan lens                    # who there is to look at
isocan lens Kenny --by day     # or --by canvas (default), --by kind
```

**It is a lens and not a canvas, and that is a decision rather than a name.**
An item's x/y belong to the canvas it is on, so a view gathering work from five
canvases holds REFERENCES and cannot hold the items — the arrangement is
derived, nothing is stored, and there is no drag to get wrong. The app has the
same thing at `/lens`, from the same functions in core.

## Saying what matters here

`isocan context` lists what an agent reads before it starts. Two verbs manage
it:

- `isocan context pin <item>` — read this first. Use it for the brief, the
  spec, the one screen everything else answers to.
- `isocan context exclude <item>` — skip this. **It is not a delete**: the item
  stays on the canvas with its versions and its comments, and only what a
  reader assembling context is told changes.
- `isocan context unmark <item>` takes either back.

Both are `item.update` with a property, so they replicate, undo and are visible
to everybody like any other fact. The same two verbs are on an item's menu in
the app.

**Context comes in layers.** `isocan context` prints *This canvas* first, then
one heading per canvas this one **inherits from** — a canvas card (see *A
canvas on a canvas*) wearing `memory=inherit`. A linked canvas contributes its
design system, its pinned items and its size, read-only, each line saying
which canvas it came from; when both canvases have a design system this
canvas's wins and the inherited one is listed struck, saying so. Not its Chat
and not its items wholesale: context is what somebody decided matters, and
the link inherits exactly that decision. Several links compose top to bottom,
then left to right, the order the room reads. `isocan context inherit <item>`
turns a placed card into a link and `isocan context uninherit <item>` turns it
back; the card stays either way. A link placed with nowhere else said lands
on the sheet named **Context** — laid at the canvas's origin (or to the left
of everything) the first time — so every canvas has a corner where its
inheritance sits and a newcomer reads it first; `--in`, `--at` and the rest
override it. In the app the card's strip wears *memory*, lit when the link
is on, and clicking it is the same switch. `isocan design check` on a canvas with no
design system of its own checks against the inherited one and says whose. A
linked canvas at another home is named under its heading and not read from
here. The same headings are in the app's Context panel.

**Pinning is a decision; a reaction is a response.** The list shows both and
does not merge them — somebody putting 👍 on a screen is real evidence, and it
is not the same as saying "an agent should read this first".

## The slide deck

A canvas gets presented, and full screen is the projector: bare arrows (and a
clicker's Page Up/Down) flip from item to item, each filling the window. With
nothing marked they flip through **everything**, in reading order — rows top
to bottom, left to right. Marking narrows the walk to just the slides:

- `isocan slides add <items...>` — these are slides. Marked items wear 🎬 in
  their title row, and bare arrows in full screen stop only at them.
- `isocan slides rm <items...>` — out of the deck. **Not a delete**: the item
  stays on the canvas.
- `isocan slides show` — the deck in order, and the address to hand an
  audience: the first slide's full-screen URL, which is an ordinary item
  address (`isocan open <item>` opens the same view).

A slide is a property set by `item.update` — the same shape as a context pin —
so it replicates, undoes, and cannot disagree between the CLI and the app's
"Make this a slide" menu entry. Order is geometry: lay the deck out in rows
and the rows are the running order. There is no slide-number to maintain and
none to drift.

## Saying where a document stands

Every note in `docs/research/` and every project's primary doc carries its
status in front matter — `open`, `designed`, `partial`, `built`, `blocked`,
`superseded` — and `docs/ROADMAP.md` is **generated** from it by
`node scripts/roadmap.mjs`. `isocan doc status <file>` prints one, and names
what is wrong with how it says so: a `blocked` with nothing named, a
`superseded` with no successor, a verdict with no date.

**Write the status once, in the front matter.** A verdict written twice goes
stale in one place and nothing can tell which copy is older — which is exactly
what happened to `2026-08-26-attaching-a-directory.md`, and why the roadmap is
derived rather than kept.

If you finish something a note describes, change its front matter and re-run
the generator. CI checks the view is current.

## Taking a canvas somewhere else

`isocan export <file>` writes this canvas as [JSON Canvas](https://jsoncanvas.org)
— the open format Obsidian and others read. The coordinate model is ours almost
exactly, so geometry crosses unchanged, and a mind map crosses as real edges
because an edge here is a property rather than an op.

**It is not a backup, and it says so.** The format has no room for versions,
comment threads, actors, timestamps, properties or the oplog, so the command
counts what it could not carry and prints it. There is no import: reading one
back would mint a canvas whose history begins at import, which is a different
feature and a worse one to discover by accident.

## What is addressed to you

`isocan inbox` lists every comment addressed to you across every canvas here —
newest first, with the command to reply to each. `--mentions` narrows it to
where somebody actually named you, rather than the Chat being busy.

**It is the same rule `isocan wait` parks on** — one function, `reasonFor`
in core, that both call: a comment
is yours when it names you — by actor id, or by a name you answer to including
your session label — or it lands in the Chat, or it lands in a thread you are
already part of. Everything else is ether.

The difference is time. `wait` blocks until something arrives; `inbox` says
what already did. Read it when you come back to a machine, before you park
again: something addressed to you on another canvas is invisible to a `wait`
pinned to this one.

**No read state**, deliberately — it is a list, not a count. Nothing marks
anything as seen, so the same entries appear until they scroll past `--limit`.

## The roles you can take on

`isocan persona ls` lists the personas this directory holds — `.agents/personas/`.
A persona is a named role: a lens, the tools for it, a **goal it is judged
against**, and a memory of what it already found. `isocan persona show <name>`
prints one in full, including the command that produces its number.

**Read one before you work in its lane.** A persona says what has already been
measured and what the line is, which is the difference between "I improved the
contrast" and "contrast failures went 2 → 0, measured by the command the goal
names". The second is a claim somebody can check.

`isocan persona runs <name>` shows what its runs found and what was decided
about each — `accepted`, `rejected`, or `unanswered`. Nothing computes a score
from those yet, deliberately: an accept rate over five findings is noise.

A goal is `(number, bound, the command that produces it)` — never an
aspiration. If you add one, run its command against something broken first and
watch the number move. A measurement that cannot fail reports success forever,
which is worse than no measurement because it is believed.

## When you need a person

`isocan ask "…"` asks and stops. It posts your question to the Chat — or to a
thing with `--item` — and the canvas immediately shows you as **asked**: in
the agent tray, in the facepile, and in `isocan who`. Then park on
`isocan wait` as usual.

Ask when the answer changes what you would build and you cannot get it from
the canvas. Do not ask to confirm something you could check, and do not ask
and then carry on guessing — the point of the state is that it is TRUE.

`isocan comment list --open` lists every question nobody has answered yet,
across every thread, with the command to reply to each. Read it when you come
back to a canvas: an unanswered question from an earlier lap is the first
thing worth knowing, and it is often yours.

**Somebody else answering closes it.** Adding to your own question does not —
amending what you asked is still asking. That is why "I'll just add a bit more
detail" never accidentally marks you unblocked.

## Running a sprint

A design sprint is a script a facilitator runs over verbs you already have,
and `/sprint` in the Chat is how somebody asks you to run one. The full
procedure is that command's body (`isocan command show sprint`); the state is
here.

`isocan sprint` says which phase the Chat says is running, how long is left,
what was handed in, and — for a vote — who wore the mark. **Nothing is
stored**: the phase is the newest `/sprint <phase> [duration] [note]` line in
the Chat, timed from that comment's daemon stamp, so this verb and the app's
clock chip cannot disagree. `--json` carries `remainingSeconds`, which is the
bell:

```sh
isocan sprint board                       # lay the board: one sheet per stretch of the week
isocan sprint brief --goal "…" --decider Maya --question "…"   # the brief, as one card with a history
isocan sprint desk Theo                   # a private canvas for one sketcher: link off, one pass in
isocan sprint phase crazy8s 8m            # call a phase — posts /sprint to the Chat
isocan wait --timeout $(isocan sprint --json | jq .remainingSeconds)
isocan copy <items...> --to <sprint> --in Sketches --handin   # a desk's bell: onto the sheet, stamped
isocan sprint handin <items...>           # these were made for the current phase
isocan react 🔴 <sketch> --at 0.4,0.6      # a heat-map dot on that PART of the sketch (fractions of its box)
isocan sprint tally                       # human dots and agent dots, apart
isocan sprint end                         # over — no phase, no clock
```

**The board is the walkthrough.** `isocan sprint board` lays eleven areas
(below) to the right of the work — Brief · Map · Experts & HMW · Target ·
Demos · Sketches · Vote · Storyboard · Prototype · Test · Wrap — each with a
card that says what happens there. Lay it BEFORE you ask the setup
questions, so the room sees the week; then `isocan sprint brief` writes the
answers onto the Brief sheet, a new version each time, never a second card.
Every phase knows its sheet (`isocan sprint` names it, `--json` carries its
box): calling a phase walks everyone's camera there and puts the phase's one
action on the clock chip — *New note* on the phase's paper in the sheet,
*Hand in* which lands the selection on the sheet. You never say where to go
or what to click; call the phase and the board does that.

**Desks are where the silence happens.** `isocan sprint desk <name>` births a
private canvas for one sketcher — the link grant off, one single-use pass
minted — and prints an address to hand to that person and nobody else. The
desk knows its sprint (`sprintOf` on the canvas record), so its clock chip
shows the sprint's phase and clock and offers *Hand in*, which copies the
selection onto the sprint's sheet for the running phase, stamped. The
terminal's twin is `isocan copy <items> --to <sprint> --in <sheet> --handin`.
The original stays on the desk: a hand-in is a copy.

`phase` refuses a word that is not a phase (`map experts hmw target demos
notes ideas crazy8s sketch museum heatmap critique poll supervote storyboard
prototype test wrap`), so a typo cannot start a clock. A phase with no clock —
the museum, the supervote — runs until the next one is called.

**The curtain is a lens, on the wall only.** While a vote phase's clock runs,
the app hides reaction counts and item bylines on the WALL — the Vote
sheet's contents when a board is laid, else the last silent phase's
hand-ins — not knowing who drew what while you vote is the method — but the
record is untouched, and `sprint tally` reads it, because the facilitator is
the referee and not a voter. A mark placed with `--at` (or a click while the
chip says *Placing*) is a dot on that part of the sketch; each person sees
their own under the curtain and everyone's at the bell. A hand-in is a
property (`sprint=<phase>`) on the item: `item.update`, one undo, visible to
everybody, the same shape as a slide.

Three rules that are yours whichever chair you sit in. **You never decide**:
the supervote 🏆 is a person's. **Silent phases are silent in the Chat**:
every parked agent wakes on it, so narrate with `session say` and keep the
questions on item threads. **One sketch per sketcher**: an agent that could
make forty makes one, and hands it in at the bell with `copy --to` and
`sprint handin`.

## Adding anything: one verb that reads what you give it

`isocan add <thing>` is the one door. It reads the thing the way the app's
Add popover reads what is pasted into its one field: a path on disk is a
**file**, a Google Doc address is a **document** (the export, with its ↗),
a canvas address — or a canvas id or title prefix among the canvases this
machine knows — is a **canvas card**, and any other address is a **site**.
`--as file|site|doc|canvas` says which you meant when the reading could go
two ways (a title that is also a word, a file whose name looks like an
address). `browse <url>`, `gdoc add <url>` and `canvas place <ref>` are the
same acts with the kind already said; all of them take `--at`, `--in`,
`--cell` and `--size` alike, and land where there is room in view when you
say nothing.

```
isocan add ./deck.pdf                                  # a file
isocan add https://docs.google.com/document/d/<id>/edit  # a document
isocan add "Sports schedule"                           # a canvas card, by title
isocan add https://example.com/status --as site        # a site, said plainly
```

## A Google Doc on the canvas

`isocan gdoc add <url>` puts a Google Doc here as a **document**: its markdown
export is the item's content — readable, searchable, thumbed in the lens,
versioned, context an agent reads — and the doc's address is its `source`,
the ↗ on its strip. In the app the strip also has *Live*: the doc as Google
draws it right now, framed in place of the words, a mode each person flips
for themselves; the words stay the record you read. `synced` says when the words were taken. `isocan gdoc sync`
re-exports every doc item on the canvas (`--in <sheet>` for one shelf) and
lands a new version only where the document changed. A doc shared by link
needs nothing; for one that is not, `isocan gdoc auth --token <token>` saves
a Drive access token on this machine (mode 600, never on a canvas; Google's
last about an hour — `gcloud auth print-access-token | isocan gdoc auth
--stdin` refreshes it), and `gdoc add`, `gdoc sync` and the app's Add
popover through this daemon use it only where the anonymous export refused.
With a token, `sync` asks Drive when each doc last moved and leaves the
unchanged ones unread. The words are on the canvas once added — everyone
admitted can read them — so say so before adding somebody's private
document.

## A canvas on a canvas

`isocan canvas place <ref|address>` puts another canvas on this one as an
ordinary item: a card that draws the other canvas small and live, opens it in
a new tab on a double-click or its ↗, and wears `kind=canvas`, `canvas=<id>`
and `source=<address>` so you can read which canvas it is without opening
it. A canvas is a place you go, not a thing you step inside of; a card is
never entered. It takes `--in <area>` like everything else, which is how a
person's canvases are shelved onto sheets. `isocan ls --kind canvas` lists
them. A canvas will not be placed on itself. `--inherit` makes the card a
memory link as it lands — the other canvas's design system and pins join this
canvas's context (see *Saying what matters here*).

The card draws the other canvas LIVE for anyone admitted to it. For the
reader who is not — or a tab that is offline, or a canvas at another home —
`isocan canvas shot <ref> --into <item>` takes a real screenshot through the
same headless browser the graders run and lands it as a version of the card,
which shows it under the words when its own pull is refused. Needs the
repository checkout and Chrome; a nightly is the right place for it.

## Areas: sheets things are placed on

An **area** is a titled region of the canvas — a sheet things are placed on,
walked to, and read back from. It is an ordinary item (`kind=area`): its
title is the sheet's name, its blob is a card saying what happens there, its
box is the region. Membership is geometry, read now: an item is *in* an area
when its centre is inside it. Nothing is stored on either side, so dragging a
thing out is all it takes, and dragging the sheet in the app carries what is
on it. `isocan area new <title>` lays one; `isocan area ls` names them and
says how much each holds; `--in <area>` on `text`, `add`, `mv`, `ls` and
`format` places into, reads from and tidies within one.

```sh
isocan area new "Sketches" --tint yellow --note "Sketch alone; hand in at the bell."
isocan area ls                            # the sheets, and how much each holds
isocan text "HMW skip the password" --in "Experts"   # placed inside, at the first clear spot
isocan add sketch.html --in Sketches      # the same for a file
isocan mv <item> --in Vote                # onto a sheet
isocan ls --in Sketches                   # what is on it
isocan format --in Sketches               # tidy the sheet's contents, within it
```

A spot found inside a sheet is *chosen*: the daemon never tidies it out. A
sheet names itself by exact title, then by prefix — `--in sket` is Sketches.

A sheet can carry a **grid**: `isocan area grid Test 5x15 --rows "Ana,Ben,Cy,Di,Ed"`
draws rows and columns with names, and `--cell row,col` (from 1, top-left)
with `--in` on `text`, `add` and `mv` puts a thing in one cell. `isocan area
grid Test --clear` takes it off. `isocan slides add --in Storyboard` makes the
deck from everything on a sheet, in reading order.

## What changed

`isocan whatsnew` lists what a PERSON got, newest first — one entry per day,
in the words somebody using the canvas would use. It is not the changelog:
`docs/changelog/` is written for whoever maintains this and names functions
and arguments, which is the right document and the wrong one to quote at
somebody asking what is new. Days with nothing a user would notice do not
appear at all, on purpose.

The notes come from the home you are talking to, so what it lists is what that
home is running.

## Mind maps

Riffing into a shape somebody can drag. `isocan map new "Lake house"` starts
one with a root node; `isocan map add "Booking" --to <node>` hangs a child off
it; `isocan map link <node> <parent>` moves a branch somewhere else. `isocan
map show` prints the whole thing as a tree, and `isocan map ls` names every
map on the canvas.

**`isocan map tidy` lays it out.** Nodes land where they are added — right of
the parent, under the last sibling — which is legible as you build and records
the ORDER you typed rather than the SHAPE of the tree. Tidy gives each depth
its own column and centres every parent on its children. It arrives as one
`items.move`, so one `isocan undo` puts it back; `--dry-run` says what would
move without moving it. Worth running once a map has grown past the shape you
imagined for it.

```
Lake house
├── Booking
│   ├── Checkout day is exclusive
│   └── Timezone is the browser's
└── The four screens are islands
```

**A node is a text node and an edge is a property**, so nothing here is a new
kind of thing: nodes version, `#Title` points at them, `isocan get` hands back
a `.md`, and the human can drag any node anywhere. The lines are worked out
from where the nodes ARE, so they follow a drag rather than needing to be
redrawn.

That is also the reason to reach for a map rather than a list: the person you
are talking to can rearrange it, and rearranging is how somebody thinks. Use
one when the shape of the thinking matters — options and their consequences,
a question that branches — and use `isocan text` when it does not.

The outline `map show` prints is DERIVED, every time. There is no stored copy
to go stale when a node moves, which is why it is safe to read one at the
start of a task and trust it.

## Bringing in somebody else's theme

`isocan design import <file>` takes a stylesheet of custom properties — a
shadcn theme, a `:root` block out of devtools — or a W3C token JSON, and lands
it as this canvas's design system. `--dry-run` reads it and prints what it
would write without touching the canvas, which is how to check a theme before
committing to it.

It reads **every** block, not just `:root`, because a shadcn theme keeps its
dark palette in `.dark` and taking half a theme silently is the worst thing an
importer can do. It wraps a bare HSL triplet — `222.2 47.4% 11.2%`, which is
what shadcn actually ships — into a real colour, because a contrast checker
cannot do anything with three numbers.

**Whatever it cannot place, it names** on stderr rather than dropping. A
`--duration-fast: 150ms` has no home in a design system yet, and you should
know that rather than find out weeks later.

Importing over an existing system writes a NEW VERSION, never a replacement:
an import is exactly the moment somebody discovers they wanted the old one
back. Run `isocan design check` afterwards — what it flags is usually not an
import error but the part of a design system that lives in a house's head
rather than in its stylesheet, and those are the first things worth writing
down.

## Screens that become files

Most of what you make on a canvas should stay on the canvas. Somebody asks to
see a view, you build it, they look at it — it never needed to be a file, and
making it one leaves litter in a repo somebody else has to clean up.

Some of it should not. A screen that is a new part of the system somebody is
building wants to be a file in their tree, where their editor, their build and
their git can all reach it. **That is your call to make, per item, and it is
two steps on purpose:**

```sh
isocan set <item> --file src/views/start.html   # where it belongs
isocan save <item>                              # take it there
```

The first is a canvas fact — it replicates, it travels to a teammate who
clones the repo, and it costs nothing if the file is never written. The second
touches a real filesystem, and only ever on the machine the canvas lives on.
`--file ''` takes the backing off again; the item stays exactly where it is.

**Ask before you back something.** A path in somebody's repo is theirs, not
the canvas's, and "I made you a file" is a surprise nobody asked for. Backing
a screen you were asked to build for a real project is ordinary; backing every
sketch you run up is noise.

**What the daemon will refuse, so you can say why:** a path outside the bound
directory, a dotfile or a secret-shaped name at any segment, anything reached
through a symlink — and a file that does not match the item's current version.

**That last refusal has two causes and they need different answers.** Either
somebody edited the file outside the canvas — their work is under your write,
and `--force` would eat it, so ask first — or the CANVAS moved and the disk is
simply behind, which is what `version promote` does every time. Check which
before you reach for `--force`: `isocan versions <item>` shows the stack with
`▶` on the current one, and if that mark is not on the newest version, the
file in the tree is stale rather than precious. Saying "your file changed" to
somebody who only promoted a version is a confusing thing to be told.

**The file on disk is not the item.** `isocan get <item>` hands back the
version the stack points at — the PROMOTED one, which is **not necessarily
the newest**. The file in the tree is only ever whatever was last written
there, and nothing writes it automatically: `save` and the app's save button
are the only two things that do. So the moment somebody promotes v9 of a
twelve-version item, `get` gives you v9 and the file still holds v12, and it
will keep holding v12 until somebody writes it out.

**Read with `isocan get`, not by opening the path.** A human who promotes a
version is telling you which one they want — that is the whole gesture — and
an agent that reads the file instead answers with the one they set aside,
then stacks a new version on top of it and buries the choice. If you do need
the path (an editor, a build, a test run), write it out first with `isocan
save <item>` so the two agree before you start.

## When a canvas's home is somewhere else

**The home is a property of the canvas, not of this machine.** One daemon can
be the home of the canvas in one directory and a replica for the canvas in the
next; `isocan status`'s role line says which, and on a mixed machine it says
all of it at once:

```
role: home of 2 canvases; replica of https://dev.isocan.io (3); new canvases → https://dev.isocan.io
```

`isocan home` lists it per canvas — which of your canvases live here, which
live at a home, and whether that home is answering. When a canvas's home is
elsewhere, that home is the single writer of everything on it. Four things
change for you on that canvas, and nothing else does:

- **Every write travels.** Adding an item, posting a comment, `undo` — each
  goes to the home and comes back, so a write can now fail for a reason that
  has nothing to do with what you asked. `home-unreachable` (HTTP 503) means
  the home could not be reached and **your write did not happen**. Nothing is
  queued and nothing will retry it for you: say so, and try again when the
  network is back. Do not paper over it by working around the canvas.
- **The page is at that canvas's home, not here.** `isocan open` prints the
  right address for the canvas you are on; `http://127.0.0.1:4441` serves you
  ops and answers a browser with a 404 naming that canvas's home. A canvas
  whose home IS this machine opens right here. Either way, the address to give
  a person is the one `isocan open` printed — never one you assembled.
- **Reads are local and instant.** Everything you look at — `ls`, `show`,
  `comment list`, `wait` — is answered from this machine's copy, and the
  copy is kept current by a live connection. `isocan who` shows everyone on
  the canvas, including people connected to the home from elsewhere.
- **This machine holds the canvases it was let into, not the home's.** A
  replica does not mirror everything at its home — it carries what somebody
  handed it: a canvas redeemed with a pass (`isocan setup <address>#<pass>`),
  a canvas born in a directory here, and a canvas named by a
  `.isocan/project.json` marker that came with a clone. So `isocan list` on
  a replica is a short list on purpose, and a canvas at the home that is not
  in it is not missing — nobody gave it to this machine. If you need one
  here, ask the person for a pass; do not go looking for a way to enumerate
  the home.

`.isocan/project.json` records the canvas's home beside its id, and **the
marker decides**. A directory whose marker names a home this machine has never
been to is not refused — it is JOINED: the daemon opens a link to that address,
the far door decides whether this machine may have the canvas, and nothing else
here moves. What IS refused, loudly and by every command, is a marker that
disagrees with what this machine has already recorded about that canvas —
because moving a canvas between homes is a deliberate act (re-homing), not
something a command should do because you ran it in the wrong directory. Report
that rather than editing the marker.

**`isocan home`** is where a canvas born here is born, and where each canvas
already here lives:

```sh
isocan home                    # the birth default, plus every canvas and its
                               # home — and whether that home is answering
isocan home https://isocan.io  # canvases born here go there from now on:
                               # writes the setting, restarts the daemon
isocan home --clear            # canvases born here stay here from now on
```

It is **configuration, not a per-command flag**: there is no way to point one
command at one home and the next at another, and there should not be. What
travels with a birth is the directory's committed marker, never a flag. Setting
it checks the address answers before committing to it, because a canvas that
lives at an unreachable home refuses every write — `--force` sets it anyway if
that is genuinely what was meant.

**Do not run it on your own initiative.** Where a person's canvases are born is
their decision about their machine. It **moves nothing that already exists** —
setting or clearing it changes only where the NEXT canvas goes, and every
canvas already at a home still answers to that home — but it is still theirs to
decide. Run it when they ask, and say on the thread that you did. Reading it —
plain `isocan home` — is free and often the answer to "why was my write
refused".

**`isocan direct`** is the other half of the same subject: whether this machine
runs a daemon at all.

```sh
isocan direct                  # which way this machine works, and why
isocan direct https://isocan.io  # no daemon here; commands speak to the home
isocan direct --clear          # run a daemon here again, with its own replica
```

Ordinarily a machine runs a local daemon holding a replica of every canvas it
has been let onto, and your commands talk to that. **Direct** is the other
arrangement: no daemon, no local copy, and every command speaks to the home
itself. It is what a disposable workspace wants — a CI runner, a cloud sandbox
that will be torn down — because there is nothing there worth replicating into
and nothing to lose when it disappears.

You will normally be *in* one or the other rather than choosing: `isocan setup`
decides once and writes it down, and `ISOCAN_DIRECT=1` (or
`ISOCAN_DIRECT=https://isocan.io`) is how a workflow file or a harness prompt
says so without editing anything. What matters for you is what changes:

- **`serve`, `restart` and `stop` refuse** on a direct machine, because there
  is no daemon for them to be about. That refusal is correct — do not work
  around it by starting one.
- **Nothing is cached locally.** Reads cross the network, and if the home is
  unreachable, every command fails rather than falling back — there is no
  replica to fall back to. Say so on the thread rather than retrying forever.
- **`isocan home` refuses too**, since a canvas made here is born at the home;
  there is no separate birth default to set.

Same as `isocan home`: **do not switch a machine on your own initiative.** Read
it freely — plain `isocan direct` — and say what you found.

## Copying things, and taking them to another canvas

`isocan copy <items...>` puts a copy beside the originals; `--to <canvas>`
puts it on a different one. The human does the same with ⌘C/⌘V, and both
write the same ops.

Two things it does that a loop over `add` would not. **The arrangement of a
selection is kept** — four screens in a row copy as four screens in a row,
because the group is placed as one box rather than each item being placed on
its own. And **a copy records what it was made from** (`parent`), so
`isocan lineage` shows it hanging off its original — except across canvases,
where that id would point at nothing.

A copy does NOT inherit the original's `file`. Two items claiming one path
would overwrite each other on `save`, and the copy is not that file — bind it
yourself if it should be one.

## Moving a canvas to another home

A canvas lives at the home it was born at, and `isocan home` says which one.
To move it — a local canvas that should be hosted, a canvas at the wrong
home — `isocan teleport <canvas> --to <home>` sends it:

```sh
isocan teleport <canvas> --to https://isocan.io --dry-run   # what would move
isocan teleport <canvas> --to https://isocan.io             # move it
```

The whole history goes, verbatim: the same operations, the same order, the
same timestamps, and the bytes with them. Afterwards this daemon forwards to
the new home, so every address that worked still works.

**Two things do not travel, and the command says so both times.** Who may
enter — invite them again at the new home and set its link, because who may
be somewhere is a decision about a PLACE. And names, colours and face marks,
which belong to the old home's registry: people arrive under whatever name
was stamped on their ops.

Only a canvas's own home can send it, and it can only land somewhere that
does not already have it. Moving a canvas onto a home that has it would be a
merge, and two orders of the same canvas is not a thing this system has an
answer for.

## When a teammate sees the item but not the picture

An item replicates; the BYTES it names do not follow on their own. They are
pushed to the home when the item is made, and if anything stops that push —
a home that was down for a second, a daemon restarted mid-upload — the op
still travels and the bytes do not. The symptom belongs to somebody else:
they open the canvas, see the item with its title and version, and get
`blob not found` where the screen should be. Your side looks perfect,
because your side reads its own copy.

So do not diagnose it by asking whether it looks right to you. Ask:

```sh
isocan blobs           # are this canvas's bytes at its home?
isocan blobs --push    # send the ones that are not
isocan blobs           # confirm — a repair you did not re-check is a guess
```

`unknown` is not `missing`: it means the home could not be reached, so
nothing was established and nothing was pushed. Run it again when the home
is answering.

Worth running whenever you have uploaded a lot to a canvas whose home is
elsewhere, and any time somebody says a screen will not open.

## Sharing a canvas

`isocan share` is who may enter, and it is the same endpoint the Share button
in the web app drives:

- `isocan share` — prints the canvas's **address** and whether the link is on.
  The address is the whole invitation: hand it to a person and they land on
  the canvas in a browser with nothing installed. Do not attach setup
  instructions to it; the canvas offers those itself to whoever wants them.
- `isocan share --link off` — new arrivals are turned away **and the people
  who got in on that link are expelled**. It prints how many. Anyone another
  grant still covers stays, which is why the line can say "3 expelled, 1 kept
  by another grant" — turning the link off is not supposed to throw out the
  people who were invited by name.
- `isocan share --link on` — grant it again. (That writes a NEW grant row; the
  old one stays as a record of when it was switched off. It does not bring
  anybody back: they are re-admitted the next time they ask.)
- `isocan share --link read` — anyone with the address can **see the canvas,
  and change nothing**: the whole canvas, pan and zoom, the panels and the
  history, with no toolbar and nothing that moves under their hand. Every
  write is refused by the home (`view-only` — the code kept its old name).
  They appear in the facepile and in `isocan who`, marked *reading*.
- `isocan share --link view` — anyone with the address can **look at the
  deck, and change nothing**: they land on the canvas's slides full screen,
  flip with arrows, and every write is refused by the home (`view-only`).
  This is how you share a presentation (see `isocan slides`) without letting
  the audience rearrange the canvas. `--link edit` is `--link on` by its
  ladder name. The people already in on the link are moved to the new rung
  rather than expelled, in every direction.
- `isocan share <email>` — **invite one person by name.** They get in by
  proving they read that address, whether or not the link is on. Nothing is
  emailed from here: the invitation is still the address, and the grant is
  what lets them through the door when they arrive. A home that has borrowed
  nowhere to verify an address refuses and says so; share the link instead.
- `isocan share <email> --as read` — invite them at a **rung**: `own`, `edit`
  (the default), `read` or `view`. A named invitation is never less than what
  the link gives: a person's rung is the highest of every grant that admits
  them. Inviting somebody who is already invited at another rung REPLACES
  their row — one command, and if they are on the canvas their app redraws
  at the new rung without a reload. The table `isocan share` prints has a
  `rung` column, and its first line is the creator's: **owner, made this**.
  `--as own` makes an owner: they may then invite, revoke and set the link
  like the creator, and cannot remove the creator.
- `isocan share --revoke <email>` — un-invite them, which **expels them**
  unless another grant still covers them. It takes the address, not the grant
  id. If the link is on they can come straight back in as a stranger would,
  and the verb says so: *they can still enter by the link; `--bar` to keep
  them out*. Withdrawing an invitation and barring a person are different
  acts; read the line before deciding which one was asked for.
- `isocan share --revoke <email> --bar` — un-invite **and keep them out**, in
  one request: a bar is a row that says no, and it beats the link and every
  invitation until an owner lifts it. `isocan share --bar <email>` writes one
  directly, for somebody who was never invited and enters by the link.
  Neither the link nor the creator can be barred; the home refuses both with
  the reason. The table `isocan share` prints shows a bar as **kept out**,
  with who wrote it and when.
- `isocan share --unbar <email>` — let them back in: the bar is revoked, and
  the link or an invitation then decides whether they may enter.

Three things to know before you use it:

- **Sharing is not a canvas op.** It changes who may knock, not what is on the
  canvas, so it never appears in the oplog and `undo` will not take it back.
  Turning the link off is undone by turning it on, and by nothing else.
- **Owners share; everybody else asks.** Every change to who may enter —
  inviting at any rung, un-inviting, the link on, off or at a rung — is an
  owner's: the creator, or anybody invited `--as own`. The home refuses
  everyone else with `not-owner` and names the owner to ask. You hold what
  the person who enrolled you holds, so an owner's agent can share and an
  editor's cannot. That is a reason to be careful, not a licence: change who
  may enter a canvas when the person asked you to, and say on the thread
  that you did.
- **Turning the link off now removes people.** It used to be harmless. It is
  not any more, so it is a gesture to ask about rather than to try.

## Spaces: a set of canvases, shared once

A **space** is a named set of canvases that access is set on once. A
canvas is in at most one space, and a person's rung on a canvas is the
highest from any row on the canvas or on its space — the space's rows are a
floor its canvases can only add to, never a ceiling.

- `isocan space new <name>` — make one. You own it; it holds nothing yet.
  A space is private until it is shared.
- `isocan space list` — the spaces you may see: the ones you made, and the
  ones a row admits you to. `isocan canvas list` groups by space when the
  home has any, **No space** last.
- `isocan space add <name> <canvas>…` / `isocan space remove <name>
  <canvas>…` — put canvases in, take them out (by id or title). Adding needs
  you to own the canvas AND the space; removing, the space. A canvas moved in
  keeps its own rows and the space's apply to it from then on; one moved out
  keeps its own rows and the space's stop reaching it.
- `isocan share --space <name>` — the space's share: every `share` flag
  applies to every canvas in it. `--link off|edit|read|view` is **every
  canvas in this space**: each canvas's own link row is set in one gesture
  and the verb prints how many canvases it reached; each canvas's own link
  can be set again afterwards (`isocan share --link view` on one canvas
  opens that one wider). `<email> --as <rung>`, `--revoke`, `--bar`,
  `--unbar` write the space's rows, and each write sweeps every canvas in
  it. `--as own` on a space makes an owner of the space and of every canvas
  in it.
- `isocan share` on a canvas in a space prints the space's rows marked *from
  space* — read here, changed with `--space`. A canvas row below what the
  space gives says so; it takes effect if the canvas leaves the space.
- `isocan space delete <name>` — every canvas stays, with its own sharing.
- Names are unique among the spaces you own, not across the home. A name
  you can see twice is refused with both ids; use the id.

## Groups: a set of people, shared with once

A **group** is a named set of addresses that access is given to once. A
row on a canvas or a space can name a group instead of an address, and the
door reads who is in the group at the moment somebody asks — membership is
never copied onto a row, so taking somebody out of a group is one write that
reaches every canvas the group is shared with.

- `isocan group new <name>` — make one. You own it and you are the only one
  who sees its members; a canvas owner you share it with sees its name and
  size.
- `isocan group list` — the groups you made, with who is in each.
- `isocan group add <name> <address>…` / `isocan group remove <name>
  <address>…` — put people in, take them out. Removing EXPELS them from
  every canvas the group's rows reach (their agents with them), unless
  another row or the link still covers them; adding raises somebody already
  inside on a lower row without a reload.
- `isocan share group:<name> [--as <rung>]`, and `isocan share --space
  <space> group:<name>` — share a canvas, or a space, with the group. The
  share table prints the row as `group <name> (<size>)`. A group cannot be
  kept out (`--bar`): un-invite it instead (`--revoke group:<name>`).
- `isocan group delete <name>` — its rows stop admitting anybody.
- A home that can verify no address refuses a group row with `no-attester`,
  because a group's members get in by proving an address.

## Your own surfaces

`isocan badges` lists every surface that carries your identity — this machine,
the person's browser tabs, other machines enrolled by a pass — and can end one:

```sh
isocan badges                    # what carries this identity, what it has proved, when it was last seen
isocan badges --kill <badgeId>   # end that surface's recognition
```

The `proved` column is what that surface has **attested**: an address somebody
signed in with, which is how an `email:` grant admits them. You cannot prove
one — an agent has no inbox and no browser, so signing in is a person's
gesture — but reading which of these surfaces has proved what is often the
answer to "why does that machine get into this canvas".

The row marked `(this one)` is the surface you are typing at; ending it signs
this machine out of the home. On a machine with a home configured the list is
the HOME's, which is the one that matters — a laptop that was lost is stopped
by ending its badge at the home, not on the laptop.

**This is a person's decision, always.** Ending a surface is how somebody
recovers from a stolen machine; it is not routine maintenance, and it is not
something to do because a badge looks old. Read the list freely, and end
something only when asked to, then say on the thread that you did.

## Passes: a credential, not an invitation

A **pass** is a short-lived, single-use string that puts *another machine* on
this canvas. It is not the address, and the difference is the whole point:

- `isocan share` prints an **address**. You hand that to a *person*. They open
  it in a browser, the door decides whether to let them in, and nothing is
  installed. It is safe on a thread — it is the invitation.
- `isocan pass` prints a **command carrying a credential**. You hand that to a
  *machine* — by pasting it into a terminal on that machine. Whatever redeems
  it is admitted **whether or not the link grant is on**, and by default
  arrives speaking as the actor this CLI speaks as.

```sh
isocan pass               # the whole command to paste on the other machine
isocan pass --admit-only  # admit it, but hand over no identity
```

**A pass is a credential. Treat it like one.**

- **Never post one on a thread, in a comment, or anywhere a person will read
  it later.** It is a bearer token: whoever has the string gets in, link grant
  or not. If you have already put one somewhere it should not be, say so
  immediately and mint nothing further — it expires in fifteen minutes and is
  spent by the first machine to use it, which is exactly why saying so quickly
  is enough.
- **Never commit one.** Not in a marker, not in a config file, not in a
  scratch note. Nothing in `.isocan/` holds one, and nothing you write should.
- It is spent the first time it is redeemed. "That pass was already used"
  usually means the machine you were setting up is already enrolled.

**When it is your business to mint one:** when the person asks you to set up
another of *their* machines, or a sandbox they are launching for themselves,
and you are handing the line straight to that machine. Say on the thread that
you minted one — not the string, the fact.

**When it is not:** to get somebody *else* onto the canvas (that is
`isocan share`, and the address); to work around a `not-admitted` refusal (see
below — stop and ask); or on your own initiative because it seemed helpful. A
pass hands over an identity by default, and handing over the identity you speak
as is not a thing to do unprompted.

**Joining from a pass** is the other end of the same gesture — this is the
command a person pastes on the new machine, and it does the whole enrolment in
one line:

```sh
npx github:dglazkov/isocan#release setup https://<home>/p/<canvas>#<pass>
isocan setup https://<home>/p/<canvas>          # no pass: arrive under the link grant
```

It joins that canvas from that home, redeems the pass so this machine is
admitted and knows whose it is, writes `.isocan/project.json` with the canvas
id and the home's address, and waits for the canvas to actually replicate
before telling you it did. On a machine that has no birth default yet it also
makes that home the place new canvases are born, and says so; a machine that
already has one keeps it, and joining moves nothing else. `isocan setup
<directory>` still means what it always did.

**`isocan open` already does this for the browser**, and you do not have to
think about it: it hands the browser it spawns a pass so the tab arrives as
this machine's person, and prints the **clean, pass-less address** on stdout.
The line it prints is the one to copy onto a thread. Do not go looking for the
one it gave the browser.

## When a canvas refuses you

A **403 with `not-admitted`** is not a broken credential — it means your badge
is fine and *this canvas will not have you*. Usually its link was switched off
after you were told about it, or you were handed an address on a home you have
never been admitted to.

What to do: **stop, and ask the person who shared the canvas to let you in.**
Do not retry it, do not go back to the door for a fresh badge (a new badge is
refused identically — that is why the refusal is a 403 and not a 401), and do
not work around it by finding another canvas. Say plainly which canvas refused
you and what you were trying to do.

`404` is the different answer, and worth telling apart: there is no canvas at
that id here at all — a typo, or a canvas that lives at another home.

## When the DOOR refuses you

A **429 with `too-many-badges`** is not about a canvas at all — it is the home
metering the door. Badges are free to mint, and free does not mean unmetered:
a home will hand out only so many new badges a minute to one caller.

You should essentially never see it, and that is the useful part. A badge is
good for a year and lives in `~/.isocan/identity.json`, so a machine mints one
and reuses it for everything afterwards. Being metered means something is
throwing that file away between commands — most often an ephemeral working
directory with no persisted home. So: wait the seconds the message names, and
then fix the cause rather than the symptom. Do not loop on the door, and do
not delete your identity file to "start clean" — that is the one action that
makes this refusal certain.

## Working a canvas that is not this directory's

Only when the human asks for it. Pass `--canvas <ref>` to each command — do
NOT `isocan use` there, which would re-bind the directory you are standing
in — and check `isocan --canvas <ref> who --all` so your name is free on
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
- **Point at one screen, not at the canvas it is on.** `isocan open <item>`
  prints — and opens — the address of that ONE item, filling the window:

  ```sh
  isocan open "Checkout"        # → http://…/p/<canvas>/i/<itemId>
  ```

  Full screen is a route rather than an operation, which is why you can hand
  it over at all: what somebody is looking at is not a mutation, so there is
  no op to send, but there IS an address. Nothing is written and nobody else's
  view moves — it is a link, and the person opening it can leave with Esc or
  Back. Prefer `#Title` in a comment when you are already writing one (the
  chip flies them there in place); reach for this when the whole point is to
  look at one thing with the canvas out of the way.
- **Versions are the medium for iteration.** "Change X on this item" means
  `edit` → new version. Mention "vN on the stack — fan out (F) to compare"
  in your reply so the human knows the history is there. The top of that
  stack is a CHOICE, not the newest: `version promote` puts any version
  back on top, `isocan versions <item>` marks it `▶`, and `isocan get`
  follows it. When you are asked to change "this item", change the version
  it currently points at — not the last one that happened to land.
- **Leave the canvas tidy.** What a person does by dragging — edges snapping
  together, gaps evening out — you do with `isocan align <items…> --to
isocan fit <items...>                  # grow items to the size their content wants, and settle them apart
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
  just the strokes. It reads back as `--kind drawing`. One SVG is one drawing
  however many strokes are in it — a person holding `P` sweeps a whole sketch
  made in passes into a single item, so do not assume one drawing means one
  gesture, or that separate marks were made at separate times.
- **Find things the way the files panel does.** `isocan ls --kind
  drawing|screen|image|video|document|site|other` and `isocan ls --filter <text>`
  are the same two questions the human's Files panel answers.
- **Say you have it, before you have anything to show.** The moment you pick
  up a thread, claim it: `isocan session on <thread> --say "reading your
  comment…"`. It shows live UNDER the comment that asked, so the person stops
  wondering whether anyone woke. Waking on `wait` does this for you — the
  summons claims the thread it came from — but a thread you picked up any
  other way is yours to claim.

  Then keep it current as the work changes: `--say "reading the three
  screens…"`, `--say "moving 12 items into rows…"`. Walking off to work on the
  items the thread is about does NOT put it down — `session work <item> --say`
  moves your cursor and your status while you stay on the thread — so the
  person watching sees what you are doing the whole way through. Say what you are DOING,
  never how far along you are; nobody can check a percentage. This is presence,
  not a comment: it costs no op, leaves no trace in the history, and vanishes
  when you stop. A thread full of "working…" posts is a thread nobody can read
  next week.

  Posting your reply clears it, which is the right shape: the status is the
  gap between being asked and answering, and done is done.
- **Read the design system before you build a screen.** `isocan design` prints
  it: a DESIGN.md (github.com/google-labs-code/design.md) whose front matter
  carries typed tokens and whose sections carry the reasoning. It is an ITEM on
  the canvas, so it versions and both surfaces can see it — not a dotfile
  nobody updates.

  Two flags save you from retyping values into a screen and getting one wrong:
  `isocan design --css` gives you custom properties to paste, and `isocan design
  --tokens` gives you W3C design tokens for anything downstream (Figma, Style
  Dictionary, a Tailwind theme) — DTCG 2025.10, validated against the official
  schema: colours as sRGB objects, dimensions as `{value, unit}`, typography
  typed on the leaf. What the format cannot say (components, an `oklch()`
  colour, a `clamp()` size) rides in `$extensions["io.isocan"]` with the
  reason rather than being dropped, and a composite field the file never
  stated is filled with CSS's initial value and says so in `$description`.
  `isocan design import <tokens.json>` reads the same shape back, including
  the reference exporter's files. Build against the variables rather than the
  literals; a screen full of hex codes is a screen that cannot follow the
  system when it changes.

  `isocan design check` says whether the system itself holds up — references to
  tokens nobody kept, values that are not colours, contrast that fails. Run it
  before you grade a screen against it, and before you hand a system back.

  Build to it, and say in your reply which parts of it you used. If it does
  not cover something you had to decide, say THAT too: the gaps are what the
  next version of the style should close. If the canvas has no design system,
  `/design-system` derives one from the screens already there — what they
  already do, rather than a system you invented and imposed.

  Designing from scratch each time is why a canvas ends up with six type
  scales and four blues, each screen fine on its own.
- **Know what a generated interface looks like, and stop doing it.** There is
  a short list of moves that machine-made design reaches for — the purple-to-
  blue hero, the italic serif headline, glassmorphism over nothing, three
  equal feature cards, "Get Started", one radius for every object, emoji as
  section markers. `/design-audit` checks a screen against the list and
  against the design system, from the SOURCE, and cites the line.

  It is a floor, not taste: clearing it makes a screen unembarrassing, not
  good. Good comes from the design system being specific and from the person
  rejecting drafts.
- **Do not open every reply with their name.** A reply sits directly under the
  question in the thread; "@Di alright, grilling you on…" spends words and
  screen on something the position already said. Just answer: "Alright,
  grilling you on…".

  Address somebody by name when it is doing WORK — reaching a person who is not
  the one you are replying to, or handing something over: "@Wise Andy, the
  audit is #Design audit — can you take the tracker?" When you do, punctuate
  it: `@Name:` or `@Name —`, never `@Name alright` running straight on.

  Names resolve to the person by what they answer to NOW, so use the name you
  see in the thread rather than one you remember from earlier in the session.
- **Stop when you are told to stop.** If a command you run prints
  `⚠ … CANCELLED this`, the person has called off the thread you picked up.
  That is the whole instruction: stop building, say where you got to in one
  comment, leave nothing half-made on the canvas (finish the one step that
  makes a thing stand on its own, or `isocan rm` it and say which), and do not
  finish the last bit because you were nearly done. `isocan command show
  cancel` is the long version.

  You will see it on the output of whatever command you happened to run,
  because that is the only thing that reaches you mid-turn — you are not
  watching the canvas while you work. It is said once, so do not wait for it
  to be repeated.
- **A message may BE a command.** When a comment starts with `/name` — the
  first thing in the body, nothing before it — the person did not type prose,
  they asked for a specific piece of work. Run `isocan command show <name>`:
  the body it prints is your instructions for this turn, written for someone
  holding this CLI on this canvas. Follow it, then reply on the thread as
  usual.

  Everything after the name is the argument, and it is the part they typed by
  hand, so it OUTRANKS the command's defaults wherever the two disagree. They
  are looking at the canvas; you are not.

  `/format` halfway through a sentence is somebody TALKING about the command,
  not asking for it. Only the start of the message counts. If a command names
  something you cannot find, ask on the thread rather than picking a target —
  doing the right work to the wrong screen is worse than a question.

  `isocan command list` is the whole menu, and it is the same list the web
  app's composer offers, so a person and an agent are never looking at
  different vocabularies. If you already hold a skill a command names, use the
  skill: the command body is the adaptation to this canvas, not a replacement
  for it.
- **A command is a skill, so published ones drop straight in.**
  `isocan command add --from <owner/repo/path/SKILL.md>` fetches it and PRINTS
  it; `--yes` installs it. The two steps are the point, and they are enforced
  by the command rather than asked of you: a body you install is read as
  instructions by every future agent on this canvas, so nothing lands unread.
  Show the person what it says — at minimum what it instructs an agent to DO
  and anything reaching outside this canvas — and let them decide. `/skill` is
  the same act from a composer, and `/skill find` looks for one without
  installing anything.

  Never add a skill nobody asked for, and never add several to be helpful. A
  menu of forty commands nobody chose is worse than one with eight. `/help` is answered by the app itself — a person
  should not wait for you to be told what their own keyboard does — so you
  will rarely see it from the web app; from a terminal it is a real question,
  so answer it. A home can add its own commands with `isocan command add`;
  those live in `~/.isocan/commands/` and shadow a built-in of the same name.
- **Ink can be swept together.** A person holding `P` draws a whole sketch as
  one item; `isocan merge <drawings...>` does that to marks already on the
  canvas. It is exact, not approximate — ink is stored in world coordinates,
  so merging is concatenating the strokes and taking the union of the boxes,
  and what comes out is byte-for-byte what went in. The originals go to the
  trash (`--keep` leaves them), which is two ops and so two undos. It refuses
  an SVG this canvas did not draw, because moving somebody's artwork silently
  is worse than saying no.
- **Tidying is a verb, not a judgement call.** `isocan format` arranges the
  whole canvas the way `/format` means: screens in a row keeping their reading
  order, whatever was made FROM a screen in a column under it, images and video
  gathered below. It is one `items.move`, so it is one undo, and it is a fixed
  point — running it on a formatted canvas moves nothing. `--dry-run` says what
  would move. Prefer it over placing items by hand; hand placement is for what
  the person asked for on top of it.
- **Say what a thing came from.** When you build an item FROM another one — a
  variation, a spec written from a sketch, a page split out of a page — add
  `--prop parent=<source item id>`. It costs one property and it is what makes
  the canvas a tree instead of a pile: `/format` hangs children under their
  parent, and anyone can see where a screen came from.
- **Read the room before you act.** `isocan activity [who]` is what has been
  happening here, newest first — who made what, who edited it, who said what
  and where. Running it for the person who summoned you is the cheapest way to
  find out what they have been working on before you answer them, and running
  it for yourself is how you check what you actually landed last session. The
  web app shows the same list under a face in the pile, from the same reader.

  For the longer view, `isocan recap` is the whole history at decaying
  resolution: old stretches summarized to one line each (who, how many ops,
  which items, how much conversation), the recent operations verbatim. Each
  summarized span carries its seq range, and `isocan tail --archived` replays
  any of it at full resolution — the history `gc` compacts is archived, never
  deleted, and both verbs can read it. Joining a canvas with a past, run
  `recap` once before forming an impression from `comment list` alone.
- **What this canvas has actually asked for.** `isocan evals corpus` is the
  same history read as a question about the WORK rather than the ops: every
  ask, whether it was answered, cancelled or met with silence, and the ops
  attributed to it. `isocan evals pairs` is the other half — the version
  stacks where somebody kept an earlier take over a later one. The corpus
  also says what KIND each ask is — revise, create, orchestrate, question,
  arrange, restyle, document, critique, repair, variation, converge — by a
  classifier that agrees with a person about four times in five; the `kinds:`
  line is a reading of the words, not a label, and says so.
  `isocan evals converge` is the night shift's score: what the converge lane
  landed here as versions, and whether people kept them, built on them, or
  brought the previous version back — the accept rate that widens or narrows
  what the night may do unasked.

  The home knows who is an agent — the harness you claimed your name from is
  recorded with it — so your own "Done —" in the Chat counts as a reply here,
  not as somebody asking; nothing to enrol by hand for that.

  Two things to hold when you read it. **The attribution says how it knows**,
  and one of its three labels is a guess: `anchor` and `reference` are
  recorded facts, `window` is "the agent that was asked did this before
  anybody spoke again". Do not quote a `window` count as though it were
  measured. And **there is no score, deliberately** — a ratio over a handful
  of asks is noise wearing a decimal point.

  It reads this machine's copy and writes nothing, to the canvas or anywhere
  else. The `silent` column is the one worth looking at: an ask nobody
  answered is the failure this canvas cannot see any other way.
- **The keys the human has.** `isocan shortcuts` prints every key the canvas
  answers to — the same list their `?` panel shows, from the same source. When
  somebody asks how to do a thing without a mouse, or you are telling them
  where to look, name the actual key rather than describing the menu path.
- **A reaction is a cheap answer.** `isocan react 👍 <item>` wears an emoji on
  an item; `--off` takes yours back and `--who` says who else is wearing it.
  The canvas draws them as chips under the item and a person toggles theirs by
  clicking, exactly as they would in a chat app.

  It is worth reaching for when the honest answer is one bit. Somebody asked
  "do these two work?" and they do: 👍 on both beats a paragraph, costs one op,
  and leaves a mark the next reader can see without opening a thread. Where a
  judgment call needs saying, still say it — a chip cannot carry a reason.

  The count is the number of PEOPLE wearing it, never a tally you add to: your
  own is a toggle, and reacting twice is not reacting twice.
- **The marks ARE the shortlist.** There is no star any more; reactions
  replaced it, and the right-hand bar groups the canvas by them. `isocan ls
  --reaction 👀` is every screen wearing one mark — which is how you find out
  what is in review, or in flight, or signed off, without anybody having built
  those states.

  What a mark MEANS is the team's, not ours. Read before you assume: if every
  screen they care about wears ⭐ and the ones they are working on wear 🚧,
  that is the system, and `ls --reaction` is how you learn it. Mark what you
  built when they asked for it to be easy to find; do not mark everything you
  touch.
- **A message can come with items attached.** What the person had selected
  travels with their message as ids, in the comment's item references — so
  "make these two match" names its two. Read `comment.items` before you guess
  from the words; `isocan comment list --json` has them.
- **A mark on an item is an instruction.** When someone scribbles on a screen
  and says "delete this and relayout", the ink is a real item: a drawing whose
  properties say what it is about.

  ```
  isocan show <ink> --json     # properties: annotates=<itemId>, region=x,y,w,h
  isocan get <item> out.html   # read the thing being marked up
  ```

  `region` is the marked area in FRACTIONS of the target — "0.52,0.10,0.43,0.40"
  is the right-hand block of its upper half — so you can act on where they
  pointed without parsing the SVG. `isocan get <ink>` if you want to see the
  marks themselves. The comment that came with it carries the ink in its item
  references, and the thread is anchored to the TARGET, so `isocan wait --item
  <target>` hears it.
- **Clear a mark once you have acted on it; leave a drawing alone.** Ink that
  annotates an item asked for something — when the new version answers it,
  `isocan rm <ink>` and say so in your reply, or the screen keeps wearing an X
  through the change it asked for. Ink on bare canvas asked for nothing: it is
  someone's drawing, and it is not yours to tidy.
- **One note that changes, not four that pile up.** When work will take more
  than a moment, post ONE comment and rewrite it as you go:

  ```
  isocan comment reply <thread> "On it — reading the spec" --json   # → commentId
  isocan comment edit <thread> <comment> "On it — found the mismatch in the calendar"
  isocan comment edit <thread> <comment> "Done — spec now matches tracker v3"
  ```

  A thread that reads "on it" / "still on it" / "found it" / "done" is four
  comments where one would do, and the human reads every one of them. Only the
  author may edit a comment — the daemon refuses otherwise — and `comment add`
  and `comment reply` both hand back the id with `--json`.

  Do NOT write how long you took: the canvas already knows. It shows
  "edited · 4m" from the comment's own timestamps, which is measured rather
  than claimed. Say what you did and what you decided; the clock is not yours
  to report.
- **Watch one thing, not everything.** A plain `wait` wakes on comments for
  you. `--all-ops` wakes on every change anyone makes, which costs you a turn
  each time to decide you did not care. Say what you are watching instead:

  ```
  isocan wait --item <ref> --op item.addVersion --json --timeout 900
  ```

  `--item` takes any item ref (repeatable), `--op` takes a type or a family
  (`item.*`). A summons still wakes you through any filter — being told to stop
  is never the noise you asked to be spared — and the JSON says which it was:
  `reason: "summons"` or `"change"`. Your own ops never wake you, so writing
  the thing you were watching for does not wake you again.

  This is how you keep a spec in step with what it describes: park on the item,
  wake when it gains a version, rewrite the spec, park again.
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

## Making an image

Several commands ask for pictures — an app icon, a marketing screenshot, a
social card. You almost certainly have no image model, and for most of this
work that is not the handicap it sounds like. Three ways, in the order to try
them:

**1. Author it.** Write the asset as SVG or HTML/CSS. This is the right answer
for icons, favicons, social cards, banners, and anything else that is DESIGNED
rather than photographed: gradients, specular highlights, glass, type,
geometry — all of it is a CSS property or a path. The output is editable,
diffable, and versioned, which a raster is not.

**2. Render it.** Compose in HTML and screenshot it with headless Chrome at an
exact pixel size. This is how you make a PNG when a PNG is required (an app
icon must be 1024x1024; an App Store screenshot must be 1290x2796), and it is
the ONLY way to put a real screen inside a device frame. The canvas's screens
are already HTML — `isocan get <item> screen.html` and drop it in an
`<iframe>`. A generated image would be a drawing OF the screen; this IS the
screen.

```js
// render.mjs — HTML file in, PNG out, at exactly the size asked for.
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
const [, , file, out, w, h] = process.argv;
const port = 9222 + Math.floor(process.pid % 500);
const chrome = spawn(process.env.CHROME ?? "google-chrome", [
  "--headless=new", `--remote-debugging-port=${port}`, `--window-size=${w},${h}`,
  "--hide-scrollbars", "--no-first-run", "--force-device-scale-factor=1", "about:blank",
], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target = null;
for (let i = 0; i < 60 && !target; i++) {
  await sleep(200);
  try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === "page"); } catch {}
}
const { WebSocket } = await import("ws");
const ws = new WebSocket(target.webSocketDebuggerUrl, { maxPayload: 1 << 28 });
await new Promise((r) => ws.once("open", r));
let id = 0; const pending = new Map();
ws.on("message", (d) => { const m = JSON.parse(d.toString()); pending.get(m.id)?.(m.result); pending.delete(m.id); });
const send = (method, params = {}) => new Promise((res) => { const mid = ++id; pending.set(mid, res); ws.send(JSON.stringify({ id: mid, method, params })); });
await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width: +w, height: +h, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: file.startsWith("file://") ? file : `file://${file}` });
await sleep(1500); // let fonts and images land
const { data } = await send("Page.captureScreenshot", { format: "png" });
writeFileSync(out, Buffer.from(data, "base64"));
ws.close(); chrome.kill();
```

On macOS, `CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`.
`ws` comes with isocan, so `node --input-type=module` from the isocan checkout
finds it; anywhere else, `npm i ws` first. If there is no Chrome, say so and
deliver the SVG — a real vector asset with a note beats a missing one.

**3. Generate it.** If you have an image model, use it — but only where it
earns its place: photoreal or textured backgrounds. Do not generate a picture
of a screen you could have rendered, and never generate UI. Every one of these
commands says "do not invent UI", and inventing it is the failure mode a model
falls into by design.

Whichever you used, SAY WHICH in your reply. "Composed as SVG" and "rendered
from your actual screen" and "generated" are three different claims about how
faithful the thing is, and the person deserves to know which one they are
holding.

Put every asset on the canvas — `isocan add icon.png --title "App icon"
--prop parent=<the screen it came from>` — so it hangs under its source when
anyone runs `isocan format`, instead of landing in a folder nobody opens.

## Quick reference of the whole surface

`isocan --help` covers everything; the commands you'll live in:
`comment list|add|reply|anchor|main|rm`,
`session start|on|work|say|point|end|move`,
`canvas create|list|show|edit|delete` (delete needs `--force` and is NOT
undoable — confirm on the thread first, and never delete a canvas you did not
make),
`who [--all]`, `activity [who]`, `whoami`, `identity [--color]`,
`command list|show|add|rm`, `format [--dry-run]`, `merge`, `shortcuts`,
`design [--css|--tokens] [set|check]`,
`add [--drawing]`, `browse <url>`, `edit`, `mv [--by]`, `align`, `distribute`,
`react <emoji> <items...> [--off|--who]`,
`set`, `fit <items...> [--size WxH]` (grow items to their content and settle
the neighbours), `ls [--kind|--filter]`, `show`, `versions`, `version promote`,
`rm`/`restore`/`trash`, `trash empty --force` (NOT undoable — ask first),
`undo`/`redo`, `wait`, `tail -f` (`--archived`: the full history, including
what gc compacted), `recap` (that history at decaying resolution — old spans
summarized, recent ops verbatim), `evals corpus|pairs` (what people have asked
agents for here and what came of it — a local report, never a score),
`gc [--all]` (`--all`: every canvas you are
admitted to at this home, not just this one),
`blobs [--push]` (are this canvas's bytes at its home — and send the ones
that are not; the answer when a teammate sees an item and no picture),
`copy <items...> [--to <canvas>] [--at x,y]` (copy items beside themselves, or
into another canvas — the arrangement of a selection is kept, and the bytes
travel when the canvas does),
`notify <message...> [--item <ref>]` (say something in the Chat in one
command — every parked agent hears it and the human sees it),
`text <words…>` (words straight onto the canvas as a chromeless node —
`--file -` for a paragraph from stdin, and it is a real `.md`, so `set --file`
and `save` back it like anything else),
`tree` (the bound directory as the daemon lists it — owner-scoped, so it
answers only at the canvas's own machine),
`save <items...>` (write backed items out to that directory — see **Screens
that become files**; `--force` overwrites one that changed on disk),
`slides add|rm|show` (the deck full screen flips through — `show` prints the
address to hand an audience),
`sprint [show|phase|end|handin|tally]` (the design sprint's clock — derived
from the Chat's newest `/sprint` line; `phase` calls one, `handin` marks what
was made for it, `tally` splits human and agent dots),
`present <item>` (a main-thread comment carrying the workbench address —
inviting the room to a view, never dragging anyone to it),
`use`, `canvas`,
`share`, `share --space <name>` (the space's rows, and `--link` on every
canvas in it), `share group:<name>` (a row naming a group),
`space new|list|add|remove|delete` (a named set of canvases access is set on
once), `group new|list|add|remove|delete` (a named set of people access is
given to once; `remove` reaches every canvas the group is shared with),
`pass` (a credential for another MACHINE — never post
it, never commit it; `share`'s address is what you hand a person),
`badges` (the surfaces carrying this identity; `--kill` ends one — ask first),
`open`, `setup`, `home` (which home this daemon answers to — read it
freely, set it only when asked).

Every one of these is the same operation the web app sends. If you find
something a person can do on the canvas that you cannot do from here, that is
a bug in isocan, not a limit of yours — say so (see "If you hit a product
bug").
