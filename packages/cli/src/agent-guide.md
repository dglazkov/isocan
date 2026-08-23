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
isocan whoami                  # identity must be YOURS, not the user's
isocan identity --session      # be handed a name, as THIS agent — and bind
                               # this directory to its canvas (see below)
isocan project list            # the directory's canvas; --all for the home
```

A directory nobody has readied yet takes one command: `isocan setup` puts
this guide's skill where agents look, the CLI on PATH, and the daemon behind
the app.

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
  just the strokes. It reads back as `--kind drawing`. One SVG is one drawing
  however many strokes are in it — a person holding `P` sweeps a whole sketch
  made in passes into a single item, so do not assume one drawing means one
  gesture, or that separate marks were made at separate times.
- **Find things the way the files panel does.** `isocan ls --kind
  drawing|image|video|document|site|other` and `isocan ls --filter <text>`
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
  Dictionary, a Tailwind theme). Build against the variables rather than the
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
- **The keys the human has.** `isocan shortcuts` prints every key the canvas
  answers to — the same list their `?` panel shows, from the same source. When
  somebody asks how to do a thing without a mouse, or you are telling them
  where to look, name the actual key rather than describing the menu path.
- **Stars are the canvas's shortlist.** `isocan ls --starred` is what the
  person has marked as worth getting back to — the screens actually in play,
  which nothing else on the canvas tells you. `isocan star <item>` (or
  `--off`) sets it, and it is an ordinary property, so it undoes like anything
  else. Star what you build when they asked for it to be easy to find; do not
  star everything you touch.
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
`comment list|add|reply|anchor|main|rm`, `session start|on|work|say|point|end`,
`project create|list|show|edit|delete` (delete needs `--force` and is NOT
undoable — confirm on the thread first, and never delete a canvas you did not
make),
`who [--all]`, `activity [who]`, `whoami`, `identity [--color]`,
`command list|show|add|rm`, `format [--dry-run]`, `merge`, `shortcuts`,
`design [--css|--tokens] [set|check]`,
`add [--drawing]`, `browse <url>`, `edit`, `mv [--by]`, `align`, `distribute`,
`set`, `ls [--kind|--filter]`, `show`, `versions`, `version promote`,
`rm`/`restore`/`trash`, `undo`/`redo`, `wait`, `tail -f`, `gc`, `use`, `project`,
`open`, `setup`.

Every one of these is the same operation the web app sends. If you find
something a person can do on the canvas that you cannot do from here, that is
a bug in isocan, not a limit of yours — say so (see "If you hit a product
bug").
