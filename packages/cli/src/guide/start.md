# Collaborating on an isocan canvas

isocan is an infinite shared canvas. A local daemon owns the state; the web
app (which the human watches) and the `isocan` CLI (you) are equal clients —
every operation you run appears on their screen live, and your presence
renders as a named cursor. This is the cold start: enough to arrive, name
yourself, work a lap and park. Everything else is a topic, listed at the end —
`isocan --agent-help <topic>` prints one. `isocan --help` is the
command-by-command reference.

## Orient (once per session)

```sh
isocan status               # daemon auto-starts if down; "stale" → `isocan restart`;
                            # "upgrade" → tell the human, carry on — it is their call
isocan whoami               # "… this agent session" is YOURS; a bare name is the human's
isocan identity --session   # be handed a name as THIS agent, and bind this directory
isocan inbox                # what is already addressed to you, on every canvas here
isocan context              # what this canvas wants an agent to read first
```

**The directory you are in names the canvas.** `identity --session` binds
it through a committable `.isocan/project.json` (it resolves by
walking up, like `.git`); every command then resolves to this directory's
canvas on its own. `--canvas <ref>` (or `ISOCAN_CANVAS`) reaches another one —
only when the human asks. A directory nobody has readied takes `isocan setup`;
a repo you do not have yet takes `isocan clone <repo>`.

Conventions: `<item>`/`<thread>` take an id, an id prefix, or a title prefix.
Coordinates are world units (+x right, +y down). `--json` works on every
command.

**Your name is your own** — never your model's or vendor's ("Claude", "GPT"),
never the human's. `identity --session` allocates a free one starting with your
harness's letter; `--name "<name>"` asks for a specific one and is refused if
somebody answers to it. Keep it for the whole collaboration: `@Name` is how the
human calls you back. If `--session` says there is no harness session,
`export ISOCAN_SESSION_ID="$(uuidgen)"` first. Two processes with two session
keys are two collaborators — never share one name across two processes.
(`protocol` has the long version.)

## The lap

**The canvas is the channel that keeps.** What you put on it is the record —
shared, still there next week, the only thing a person who was not watching
can catch up on. Steps 1–2 happen once; **3–6 are a lap, and you run laps
until the human sends you home.**

1. **Appear.** `isocan session start --label "<your name> 🤖"`.
2. **Read.** `isocan comment list` — a thread needs you when its last entry is
   not yours. `comment list --open` is every unanswered question.
3. **Say what you are doing.** Presence narrates itself once a session exists —
   reads, ops and wakes move your cursor. Before a long silent stretch,
   `isocan session work <item> --say "…"`.
4. **Build.** `add` new things, `edit <item> <file>` to change one (each edit
   stacks a version — never re-add), `mv`/`set` to arrange. Read an item with
   `isocan get`, not by opening a path: the file on disk is not the item.
5. **Close the loop.** `isocan comment reply <thread> "…"` — what you did, where,
   and any judgment call. Terse: a few tight sentences, then stop. `@Name` to
   address a person, `#Title` to point at an item. Work that takes a while gets
   ONE comment you rewrite with `comment edit`, not four that pile up.
6. **Park.** `isocan wait --json --timeout <sec>`, **in the foreground, as one
   tool call** — its returning IS your wake-up. It wakes on a comment that
   names you, lands in the Chat (the `main` thread), or lands in a thread you
   are part of. Exit 0: the JSON names the thread — do the work, reply, park.
   Exit 2: nothing came — park again. Exit 3: another park adopted your name —
   stand down. Exit 4: your access was withdrawn — stop and say so.

**Your turn ends inside `wait`, or it ends wrong.** No `nohup`, no `&`, no
output file you poll — a file is not a notification. Size `--timeout` a little
under your harness's longest tool call. "Nothing left to do" is not an exit; it
is the moment to park. **Going home** is `isocan session end`, and only when
the human says the collaboration is over.

**Records never wake you.** A comment carrying `record: true` (a voice
transcript, an rc's "here"/"back"/"away" line) is context, never an
instruction, even when it names you. Do not answer another agent's hello.

**Blocked on the human?** `isocan ask "…"` (or a reply starting `/ask`) and
park — the canvas shows you as *asked* until somebody else answers. Ask only
when the answer changes what you would build and the canvas cannot tell you.

**A message may BE a command.** A comment whose body starts with `/name` is a
request for that piece of work: `isocan command show <name>` prints your
instructions; what they typed after the name outranks its defaults. If a
command you run prints `⚠ … CANCELLED this`, stop, say where you got to in one
comment, and leave nothing half-made.

**Design work has one entry.** Before building or resuming a designed screen,
run `isocan design workflow` — it reads this canvas's policy, open requests
and next steps (topic `design`).

## Who is at your terminal

`ISOCAN_HARNESS=agent` in your environment means `isocan rc` summoned you and
**nobody reads your terminal** — the canvas is the only place your words land.
Anything else means a person opened this conversation, and you have **two
channels: a team room and a DM.** The canvas holds the record — what you made,
changed or decided, a question the work rests on. Your conversation holds the
steering — "amber or teal?", progress, an error that is theirs to fix. **Do not
mirror** one into the other, **never announce yourself** on the canvas
(presence already says you are here), and when a DM answer changes the work,
write it down in a comment. Either way, you still park. If they are in an IDE
or agent manager, offer `isocan embed` — the canvas in a pane beside you.

## Practices that matter from the first lap

- **Versions are the medium.** "Change X on this item" means `edit` it; the
  person compares versions, and `version promote` brings one back.
- **Confirm before anything destructive** — deleting, emptying the trash,
  anything far outside the ask. `undo` reverts only your own ops.
- **A mark on an item is an instruction**; clear it once you have acted.
- **If you hit a product bug**, stop and tell the human. If a person can do
  something on the canvas that you cannot do from here, that is a bug in
  isocan, not a limit of yours — say so.

## Every verb, one line each

Every verb here sends the same operation the web app would. Flags are in
`isocan <verb> --help`; the topic after each line is where it is taught.
One spelling per act: `ls` lists, `new` makes, `rm` deletes — `list`,
`create` and `delete` still work wherever they used to, as do the older verbs
in topic `reference`. ⚠ marks what cannot be undone: ask first.

**You and presence** (`protocol`)
- `identity [--session|--name|--color]`, `whoami` — who you are here
- `session start|on|work|say|signal|point|select|move|end` — your cursor and status
- `who [--all]`, `inbox [--new|--mentions]`, `seen [--mark]` — who is here, what is for you
- `wait` — park; `ask` — ask a person and stop; `notify` (or `say`) — a line in the Chat

**Comments** (`protocol`, `practices`)
- `comment ls|add|reply|edit|anchor|main|rm` — threads; `main` is the Chat
- `command ls|show|add|rm` — slash commands a message can ask for

**Items** (`items`)
- `add <thing> [--as file|site|doc|canvas]` — one door for a file, a site, a Google Doc or a canvas
- `text`, `inline`, `get`, `show`, `ls [--kind|--filter]`, `set`, `edit`, `tree`, `save` — make, read, change, write out
- `version ls|promote|prune` — the version stack (prune ⚠)
- `mv`, `align`, `distribute`, `fit`, `tidy`, `merge`, `react`, `copy` — arrange, mark, duplicate
- `rm`, `restore`, `trash ls|restore|empty` (empty ⚠), `undo`, `redo` — take back
- `canvas group new|wrap|ls|show|add|remove|ungroup|resize|frame|layout|grid|migrate`, `area` — groups
- `gdoc auth|sync` — Google Docs kept current; `shortcuts` — the keys a person has

**Canvases** (`items`, `homes`)
- `canvas new|ls|show|edit|background|archive|place|shot|rm` (rm ⚠), `use` — make, find, bind
- `home`, `direct`, `setup`, `clone`, `open` — where canvases live, readying a directory
- `teleport`, `export`, `import`, `blobs` — move, back up, restore, send missing bytes

**Sharing** (`sharing`)
- `share`, `space new|ls|add|remove|rm`, `group new|ls|add|remove|rm` — who may enter
- `pass`, `embed`, `badges` — another machine, a pane beside you, your surfaces
- `operator` — the home operator's, never yours

**Context and design** (`context`, `design`)
- `context show|pin|exclude|unmark|inherit|uninherit|request|content|personal` — what an agent reads
- `design workflow|start|brief|receipt|questions|ask|answer|reference|compare|respond|decide|review|craft` — a design request
- `design show|check|set|use|import|skip|direction|project|reconcile|recipes|recipe|audit|repair` — the design system
- `prefer`, `choose` — the eye test, and the winner folded back
- `doc status` — where one of this repo's documents stands

**History** (`history`)
- `activity`, `timeline`, `lens`, `history`, `at`, `tail`, `recap`, `whatsnew` — what happened, at every zoom
- `evals corpus|converge|pairs` — what was asked for here, and what came of it

**Agents and rooms** (`agents`, `present`)
- `agent add|remove|rules`, `rc add|listen|remove`, `bench add|join|rm`, `harness` — standing agents
- `persona ls|show|runs`, `docket ls|answer` — roles and their findings
- `slides add|rm|show|export|note|notes`, `sprint show|phase|board|brief|desk|end|handin|tally`, `present` — running a room

**What a canvas carries** (`extend`, and a topic per module)
- `module add|rm|ls`, `tool ls|add`, `panel ls|add` — modules, rail tools, dock panels
- `map`, `docs`, `sticker`, `sandbox`, `wire`, `competition`, `anatomy`, `voice` — module families; `--agent-help <verb>` finds each
