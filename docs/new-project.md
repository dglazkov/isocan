# Starting a project on a canvas

How to go from an empty directory to a GitHub repo, a canvas bound to it, and
two or three agents parked on that canvas waiting for you to say what to build.

The shape to hold in your head: **the directory is the project, and the project
is a canvas.** `<dir>/.isocan/project.json` is what marries them. It resolves by
walking up like `.git`, it is meant to be committed, and once it exists every
`isocan` command run anywhere under that directory lands on the right canvas
without a flag.

## The short version

[`scripts/new-project.sh`](../scripts/new-project.sh) is this whole walk in one
command. It is idempotent — run it again in a directory it already set up and it
reports what is already true rather than making a second of anything.

```sh
scripts/new-project.sh acme-widgets --agents claude,codex --launch
```

That makes the directory, the repo and the GitHub remote; readies the directory;
creates the canvas and commits the marker that binds it; designates a main
thread; and either opens a terminal tab per agent (`--launch`, macOS) or prints
the line to paste into each one. `--here` uses the current directory,
`--no-github` skips the remote, `--help` lists the rest.

The command is not `isocan setup`, and deliberately: `setup` readies a directory
without creating a canvas, because creating one stamps it with whoever typed the
command — usually an agent, acting for a person who has not said their name yet.
The script is a *person* at a terminal, so it can do what setup must not.

The rest of this page is what the script does, step by step, for when you want
to do it by hand or to know what a step was for.

## 1. The directory and the repo

Nothing isocan-specific yet.

```sh
mkdir acme-widgets && cd acme-widgets
git init
gh repo create acme-widgets --private --source=. --remote=origin
```

## 2. Ready the directory

```sh
npx github:dglazkov/isocan#release setup
```

Keep the `#release` — from `main` npm installs an empty directory (#47). Setup
is idempotent, so run it whenever you land somewhere new. It puts `isocan` on
your PATH, starts the daemon, installs the skill at
`.agents/skills/isocan-collab` with a `.claude/skills/` symlink pointing at the
same file, and opens the app.

**Setup deliberately creates no canvas.** Making one here would stamp it with
whoever typed the command — usually an agent, acting for a person who has not
said their name yet. So the canvas comes into being one of three ways:

| How | What happens |
| --- | --- |
| You, in the browser | Pick your name, click to make a canvas, then `isocan use <ref>` in the directory to bind it |
| Your first agent | `isocan identity --session` in an unbound directory **creates a canvas named after the directory and binds it** |
| An existing canvas | `isocan use <ref>` writes the marker for a canvas that already exists |

The agent path is the one to reach for when you are starting from a terminal.
It is a single command and it produces exactly what you want:

```
$ isocan identity --session
identity saved: Nico (usr_4KcI50ihYq) → ~/.isocan/actors.json (doc-probe session)
this directory's canvas: "acme-widgets" (prj_4984VsHa2w) — created; bound via …/.isocan/project.json
```

## 3. Commit the marker

```sh
git add .isocan/project.json .agents/skills .claude/skills
git commit -m "Bind this directory to its canvas"
```

The marker is two fields — the canvas id and its title — and committing it is
what makes the canvas travel with the repo. A teammate who clones lands on the
*same* canvas: if their machine has never seen that id, their first addition
materializes it under the same id rather than forking a new one.

Commit the skill too. It is how any harness that clones this repo discovers the
protocol without being told.

## 3½. Joining a repo that already has a canvas

Everything above is the from-scratch case. Coming to a repo somebody else
already bound is one command:

```sh
isocan clone dglazkov/isocan          # or any URL git accepts
```

That clones, readies the directory exactly as `setup` does, and reports the
canvas the committed marker names. Because project ids are what let two homes
agree they are working on the same canvas, the clone **adopts the id** rather
than minting one — the first thing anybody adds materializes it under that id,
and you are on the same canvas as the person who committed the marker, not a
copy of it.

It deliberately does not install dependencies or start anything. `npm install`
runs the cloned repo's own `prepare` and `postinstall` scripts, and a command
whose whole input is a link somebody sent you should not turn into arbitrary
code execution. It prints the next line instead of running it.

Two answers worth recognising in its report:

- *"none committed in this repo"* — the repo has no marker. `isocan use <ref>`
  binds it to an existing canvas, or an agent's `identity --session` makes one
  named after the directory.
- *"lives at &lt;address&gt; and this machine could not get it from there"* — the
  marker names a home you have no reach to. Nothing is created, deliberately:
  making it locally would mint a TWIN under that id. Ask for a pass
  (`isocan pass` on a machine that is on the canvas) rather than working around
  it.

## 4. Bring the agents in

Each agent needs a name of its own — not its vendor's, and never yours. The
daemon hands out free ones (Isaac, Kenny, Nico… — names hiding in the letters of
"isocan") and refuses a name somebody already answers to, because `@Name` has to
resolve to exactly one of them.

**What separates one agent from another is the harness session id in its
environment.** A machine holds one person and any number of agents; `--session`
claims a session atomically, so two agents in one checkout are two people
without coordinating at all. isocan knows some harnesses without being told:

| Harness | Variable | Built in? |
| --- | --- | --- |
| Claude Code | `CLAUDE_CODE_SESSION_ID` | yes |
| Codex | `CODEX_THREAD_ID` | yes |
| Pi | `PI_SESSION_ID` | yes |
| Antigravity | `ANTIGRAVITY_CONVERSATION_ID` | yes |
| Gemini CLI, and anything else | — | **no — see below** |

For a harness isocan has not met, either export a session id yourself before the
agent names itself:

```sh
export ISOCAN_SESSION_ID="$(uuidgen)"
export ISOCAN_HARNESS="gemini"          # just the label `whoami` prints
```

or teach the home its variable once, in `~/.isocan/config.json`, and it works
every time after:

```json
{ "harnessVars": { "gemini": "GEMINI_SESSION_ID" } }
```

`ISOCAN_SESSION_ID` wins when it is set alongside a harness's own variable —
deliberate beats ambient.

### Launching them

Open a terminal per agent, in the project directory, and give each the same
opening instruction. The skill is already in the directory, so naming it is
enough:

```sh
claude 'Use the isocan-collab skill. Name yourself, appear on the canvas, then park on isocan wait.'
```

```sh
codex 'Use the isocan-collab skill. Name yourself, appear on the canvas, then park on isocan wait.'
```

```sh
ISOCAN_SESSION_ID="$(uuidgen)" ISOCAN_HARNESS=gemini gemini 'Read .agents/skills/isocan-collab/SKILL.md, then run isocan --agent-help and follow it.'
```

Single quotes on purpose: the instruction names commands, and backticks inside a
double-quoted shell string would run them instead of passing them along.

Want a specific name? The agent asks for it with `isocan identity --session
--name "Rhea"`, and the daemon refuses if it is taken rather than quietly
handing over a duplicate.

What each one then does, from `isocan --agent-help`: `session start` to appear
as a live cursor, `comment list` to read what is waiting, and `isocan wait` to
park. Parking is a **foreground** call — the blocking call returning *is* the
wake-up. An agent that backgrounds it keeps a cursor on the canvas but can never
be woken. One waiter per agent, ever.

### Give them one channel to listen on

```sh
isocan comment add --at 0,0 "Project channel"
isocan comment main <thread>
```

The main thread renders as a docked chat panel in the web app, and anything
posted there wakes every parked agent with no `@`-mention needed. It is the
closest thing to "tell the project what to do".

## 5. Screens that map to the real directory

Two different mappings, and it is worth knowing which one you want.

**A running app → a live item.** This is the one that stays in step by itself:

```sh
npm run dev &
isocan browse http://localhost:5173 --title "Acme Widgets (dev)"
```

That projects the real site onto the canvas as a mini-browser item. Vite's HMR
keeps it current with no further action; the item's ⟳ reloads anything else. An
agent editing source in the directory is editing what everyone on the canvas is
watching.

**A file → an item.** Explicit in both directions, which is the point — an item
is a versioned artifact, not a mirror of a path:

```sh
isocan add designs/checkout.html --title "Checkout"   # file → new item
isocan get <item> designs/checkout.html               # item → file
isocan edit <item> designs/checkout.html              # file → new VERSION
```

`edit` stacks a version rather than replacing one, so the history of a screen is
on the canvas where anyone can fan it out (`F`) and compare. Never re-`add` a
file you have already added; that makes a second item with no shared history.

Say where a thing came from with `--prop parent=<source item id>` — it costs one
property and it is what makes the canvas a tree instead of a pile. Then
`isocan format` arranges the whole thing: screens in a row keeping their reading
order, whatever was made *from* a screen in a column under it, images and video
gathered below. It is one operation, so it is one undo, and running it twice
changes nothing.

## Traps worth knowing

- **A directory with no marker does not create a canvas — it falls back.**
  Resolution is: this directory's marker, then the home-wide default from
  `isocan use --home`. So `isocan add` run from `/tmp/whatever` silently lands
  on whatever canvas you last used. Only `identity --session` creates one. If a
  command's output names a canvas you did not expect, stop and check
  `isocan project list` before writing anything else.
- **`isocan project delete` is not undoable** and needs `--force`. Never delete
  a canvas you did not make.
- **A pass is a credential, not an invitation.** `isocan share` prints an
  address you hand to a *person*; `isocan pass` prints a command carrying a
  bearer token you paste into a terminal on another *machine*. Never commit one
  and never post one on a thread.
- **Presence is honest.** An agent claims work by doing it, not by saying it
  did.
